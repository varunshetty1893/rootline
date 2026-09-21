import { GoogleGenAI } from "@google/genai";
import { PersonOut, Family, store } from "./store.js";
import { determineKinship, KinshipResult } from "./kinship.js";
import { logger } from "./logger.js";

export type AIProvider = "gemini" | "groq" | "rule_based_fallback";
export type PreferredProvider = "auto" | "gemini" | "groq";

export interface AIChatRequestOptions {
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  familyId: string;
  userId: string;
  preferredProvider?: PreferredProvider;
  person1Id?: string | null;
  person2Id?: string | null;
}

export interface AIChatResponse {
  message: string;
  provider: AIProvider;
  model: string;
  failoverOccurred: boolean;
  failoverDetails?: string;
  detectedKinship?: KinshipResult | null;
  familySummary: {
    id: string;
    name: string;
    memberCount: number;
  };
}

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: key });
  }
  return geminiClient;
}

/**
 * Formats a person with disambiguating dates and lineage details
 */
export function formatPersonSummary(person: PersonOut, byId: Map<string, PersonOut>): string {
  const dates = [
    person.date_of_birth ? `b. ${person.date_of_birth}` : "",
    person.date_of_death ? `d. ${person.date_of_death}` : "",
  ]
    .filter(Boolean)
    .join(" - ");

  const parents = (person.parent_ids || [])
    .map((id) => byId.get(id)?.name)
    .filter(Boolean);

  const spouses = (person.spouse_ids || [])
    .map((id) => byId.get(id)?.name)
    .filter(Boolean);

  const details: string[] = [];
  if (person.gender) details.push(`Gender: ${person.gender}`);
  if (dates) details.push(`Dates: ${dates}`);
  if (parents.length) details.push(`Parents: ${parents.join(", ")}`);
  if (spouses.length) details.push(`Spouse(s): ${spouses.join(", ")}`);
  if (person.occupation) details.push(`Occupation: ${person.occupation}`);
  if (person.place_of_birth) details.push(`Born in: ${person.place_of_birth}`);

  return `- ${person.name} (ID: ${person.id}): ${details.join(" | ")}`;
}

/**
 * Scans the user message for mentioned family members to enhance kinship understanding
 */
function findMentionedPeople(
  text: string,
  people: PersonOut[]
): PersonOut[] {
  const normalizedText = text.toLowerCase();
  const matched: PersonOut[] = [];

  for (const person of people) {
    if (!person.name) continue;
    const nameLower = person.name.toLowerCase().trim();
    // Check for full name or distinct first name
    const firstName = nameLower.split(" ")[0];

    if (
      normalizedText.includes(nameLower) ||
      (firstName.length > 2 && new RegExp(`\\b${firstName}\\b`, "i").test(text))
    ) {
      if (!matched.some((m) => m.id === person.id)) {
        matched.push(person);
      }
    }
  }
  return matched;
}

/**
 * Built-in Rule-Based Genealogy & Kinship Engine
 * Seamlessly provides instant, accurate answers if external AI APIs are unconfigured or fail.
 */
function runRuleBasedEngine(
  message: string,
  people: PersonOut[],
  family: Family,
  kinship: KinshipResult | null,
  detectedPeople: PersonOut[]
): string {
  const q = message.toLowerCase();

  // If specific kinship was calculated
  if (kinship) {
    if (kinship.related) {
      const p1 = detectedPeople[0];
      const p2 = detectedPeople[1];
      const p1Dates = p1?.date_of_birth ? ` (b. ${p1.date_of_birth})` : "";
      const p2Dates = p2?.date_of_birth ? ` (b. ${p2.date_of_birth})` : "";

      let text = `Based on verified records in the ${family.name} family tree:\n\n`;
      text += `• **Kinship**: **${p2?.name || "Relative"}**${p2Dates} is the **${kinship.title}** of **${p1?.name || "Reference"}**${p1Dates}.\n`;
      text += `• **Generational Step**: ${
        kinship.generationDiff === 0
          ? "They belong to the same generation."
          : kinship.generationDiff > 0
          ? `${kinship.generationDiff} generation(s) younger.`
          : `${Math.abs(kinship.generationDiff)} generation(s) older.`
      }\n`;
      text += `• **Lineage Chain**: ${kinship.steps.join(" → ")}\n`;
      if (kinship.commonAncestors.length > 0) {
        text += `• **Shared Ancestor(s)**: ${kinship.commonAncestors.join(", ")}\n\n`;
      }
      text += kinship.explanation;
      return text;
    } else {
      return `According to current records in the ${family.name} tree, no direct ancestral, descendant, or marital relationship path was found between ${detectedPeople[0]?.name || "the first person"} and ${detectedPeople[1]?.name || "the second person"}. They may belong to distinct branches or have unlinked parent records.`;
    }
  }

  // General kinship terminology inquiries
  if (q.includes("first cousin once removed") || q.includes("once removed")) {
    return `### What Does "Once Removed" Mean?\n\nIn genealogy, **"removed" indicates a generational difference** between cousins:\n\n1. **First Cousins**: Share the same grandparents and are in the **same generation** as you.\n2. **First Cousin Once Removed**: One generation away from being first cousins. This can mean:\n   - Your **parent's first cousin** (one generation above you), OR\n   - Your **first cousin's child** (one generation below you).\n\n3. **Twice Removed**: Two generations apart (e.g. your grandparent's first cousin, or your first cousin's grandchild).\n\nIn your **${family.name}** family tree, our kinship engine computes these exact generational offsets automatically!`;
  }

  if (q.includes("second cousin") || q.includes("2nd cousin")) {
    return `### Understanding Second Cousins\n\n**Second cousins** share the **same great-grandparents**, but have different grandparents.\n\n• **Sibling**: Share parents (1 generation to common ancestor)\n• **1st Cousin**: Share grandparents (2 generations to common ancestor)\n• **2nd Cousin**: Share great-grandparents (3 generations to common ancestor)\n• **3rd Cousin**: Share great-great-grandparents (4 generations to common ancestor)\n\nIf you'd like to check if anyone in your tree is your second cousin, ask me about any two family members!`;
  }

  if (q.includes("double cousin")) {
    return `### Double First Cousins\n\n**Double first cousins** occur when two siblings from one family have children with two siblings from another family (for example, two brothers marry two sisters).\n\nBecause they share **all four grandparents** rather than just two, double cousins share approximately **25% of their DNA** (the same amount as half-siblings) rather than the standard 12.5% of regular first cousins.`;
  }

  if (q.includes("consanguinity") || q.includes("affinity")) {
    return `### Consanguinity vs. Affinity\n\n• **Consanguinity** refers to kinship by **blood / genetic descent** from a common ancestor (e.g. parents, children, siblings, aunts, uncles, cousins).\n• **Affinity** refers to kinship created by **marriage** (e.g. spouses, mothers-in-law, brothers-in-law, step-children).\n\nRootline tracks both types in your family tree graph and can trace paths through both marriage links and direct bloodlines.`;
  }

  if (q.includes("granduncle") || q.includes("great uncle") || q.includes("great-uncle")) {
    return `### Granduncle vs. Great-Uncle\n\nBoth terms refer to the **brother of your grandparent**! Genealogists traditionally prefer the term **"granduncle"** because it mirrors "grandfather", whereas "great-uncle" is commonly used in everyday speech. Similarly, a **grandaunt** is the sister of your grandparent.`;
  }

  if (q.includes("how many") || q.includes("summary") || q.includes("overview") || q.includes("members")) {
    const living = people.filter((p) => !p.date_of_death).length;
    const deceased = people.length - living;
    return `### ${family.name} Family Overview\n\nYour active family tree currently has **${people.length} recorded members**:\n• **Living Members**: ${living}\n• **Ancestors Remembered**: ${deceased}\n\nYou can ask me how any two members are connected, inquire about someone's parents or children, or ask general genealogy questions!`;
  }

  if (detectedPeople.length === 1) {
    const p = detectedPeople[0];
    const byId = new Map(people.map((m) => [m.id, m]));
    const parents = (p.parent_ids || []).map((id) => byId.get(id)?.name).filter(Boolean);
    const spouses = (p.spouse_ids || []).map((id) => byId.get(id)?.name).filter(Boolean);
    const children = people.filter((m) => m.parent_ids?.includes(p.id)).map((m) => m.name);

    return `### ${p.name}'s Family Connections\n\n` +
      `• **Birth / Lifespan**: ${p.date_of_birth || "Unknown birth date"} ${p.date_of_death ? `– ${p.date_of_death}` : "(Living)"}\n` +
      `• **Parents**: ${parents.length > 0 ? parents.join(" & ") : "None recorded"}\n` +
      `• **Spouse / Partner**: ${spouses.length > 0 ? spouses.join(", ") : "None recorded"}\n` +
      `• **Children**: ${children.length > 0 ? children.join(", ") : "None recorded"}\n\n` +
      `Ask me how **${p.name}** is related to any other relative in your tree!`;
  }

  return `Hello! I am your **Rootline Family & Kinship AI Assistant** for the **${family.name}** family tree.\n\nI can help you with:\n1. **Relationship Paths**: Ask *"How is Person A related to Person B?"* or select two members to trace their exact connection.\n2. **Generational Questions**: Ask about cousins, granduncles, in-laws, or second cousins once removed.\n3. **Genealogy Insights**: Ask for tips on interviewing grandparents, preserving family lore, or deciphering naming conventions.\n\nHow can I help you explore your family story today?`;
}

/**
 * Call Gemini 3.8 Flash via @google/genai
 */
async function callGemini(
  systemInstruction: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  latestMessage: string
): Promise<{ text: string; model: string }> {
  const client = getGeminiClient();
  if (!client) {
    throw new Error("GEMINI_API_KEY environment variable is not configured.");
  }

  // Construct contents with chat history
  const contents: any[] = [];
  for (const m of messages.slice(-8)) {
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    });
  }
  contents.push({
    role: "user",
    parts: [{ text: latestMessage }],
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Gemini API request timed out after 6 seconds")), 6000)
  );

  const response = await Promise.race([
    client.models.generateContent({
      model: "gemini-3.8-flash",
      contents,
      config: {
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        temperature: 0.4,
      },
    }),
    timeoutPromise,
  ]);

  const text = response.text?.trim();
  if (!text) {
    throw new Error("Empty response returned from Gemini API");
  }

  return { text, model: "gemini-3.8-flash" };
}

/**
 * Call Groq API (OpenAI compatible) using native fetch
 */
async function callGroq(
  systemInstruction: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  latestMessage: string
): Promise<{ text: string; model: string }> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    throw new Error("GROQ_API_KEY environment variable is not configured.");
  }

  const model = "llama-3.3-70b-versatile";
  const formattedMessages = [
    { role: "system", content: systemInstruction },
    ...messages.slice(-8).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: latestMessage },
  ];

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model,
      messages: formattedMessages,
      temperature: 0.4,
      max_tokens: 1200,
    }),
    signal: AbortSignal.timeout(6000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq API returned HTTP ${response.status}: ${errorBody}`);
  }

  const data = (await response.json()) as any;
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Empty response received from Groq API");
  }

  return { text, model };
}

/**
 * Main AI Chat Processor with Multi-Tenant Isolation and Dual-Provider Failover
 */
export async function processFamilyChat(
  options: AIChatRequestOptions
): Promise<AIChatResponse> {
  const {
    message,
    history = [],
    familyId,
    userId,
    preferredProvider = "auto",
    person1Id,
    person2Id,
  } = options;

  // STRICT MULTI-TENANT ISOLATION CHECK
  const access = store.checkFamilyAccess(userId, familyId);
  if (!access) {
    throw new Error("Access denied: You do not have permission to view or query this family tree.");
  }

  const family = store.getFamily(familyId);
  if (!family) {
    throw new Error("Target family was not found.");
  }

  // Load ONLY people belonging to this verified family
  const people = store.getPeopleForOwner(familyId);
  const byId = new Map(people.map((p) => [p.id, p]));

  // Disambiguation & Kinship Detection
  let detectedKinship: KinshipResult | null = null;
  let targetP1: PersonOut | undefined;
  let targetP2: PersonOut | undefined;

  if (person1Id && person2Id && person1Id !== person2Id) {
    targetP1 = byId.get(person1Id);
    targetP2 = byId.get(person2Id);
  } else {
    const mentioned = findMentionedPeople(message, people);
    if (mentioned.length >= 2) {
      targetP1 = mentioned[0];
      targetP2 = mentioned[1];
    } else if (mentioned.length === 1) {
      targetP1 = mentioned[0];
    }
  }

  if (targetP1 && targetP2) {
    detectedKinship = determineKinship(targetP1.id, targetP2.id, people);
  }

  // Build isolated system prompt with active family records
  const peopleSummaries = people
    .map((p) => formatPersonSummary(p, byId))
    .join("\n");

  let kinshipContext = "";
  if (targetP1 && targetP2 && detectedKinship) {
    const p1Dates = [targetP1.date_of_birth ? `b. ${targetP1.date_of_birth}` : "", targetP1.date_of_death ? `d. ${targetP1.date_of_death}` : ""].filter(Boolean).join(" - ");
    const p2Dates = [targetP2.date_of_birth ? `b. ${targetP2.date_of_birth}` : "", targetP2.date_of_death ? `d. ${targetP2.date_of_death}` : ""].filter(Boolean).join(" - ");

    kinshipContext = `\nPRE-VERIFIED RELATIONSHIP FACT FOR THIS QUERY:
Reference Person 1: ${targetP1.name} (${p1Dates || "dates unrecorded"})
Relative Person 2: ${targetP2.name} (${p2Dates || "dates unrecorded"})
Verified Kinship Title: ${detectedKinship.title}
Generational Difference: ${detectedKinship.generationDiff} (${detectedKinship.generationDiff === 0 ? "same generation" : detectedKinship.generationDiff > 0 ? `${detectedKinship.generationDiff} generation(s) down` : `${Math.abs(detectedKinship.generationDiff)} generation(s) up`})
Exact Chain of Lineage: ${detectedKinship.steps.join(" → ")}
${detectedKinship.commonAncestors.length ? `Common Ancestor(s): ${detectedKinship.commonAncestors.join(", ")}` : ""}
Mathematical Explanation: ${detectedKinship.explanation}
CRITICAL MANDATE: You MUST use these exact verified mathematical facts when answering. If individuals share the same first/last name, use their birth or death years to clearly disambiguate who is who.`;
  }

  const systemInstruction = `You are Rootline's Kinship & Family AI Assistant, a warm, knowledgeable genealogical scholar and family relationship expert.

ACTIVE FAMILY TREE CONTEXT (STRICT TENANT ISOLATION):
- Family Name: "${family.name}" (ID: ${family.id})
- Total Members in Tree: ${people.length}
- Verified Family Members:
${peopleSummaries}
${kinshipContext}

CORE CAPABILITIES & RULES:
1. UNDERSTAND RELATIONSHIPS:
   - When asked about relationships between people in this family tree, explain their connection clearly, warmly, and accurately based ONLY on the verified records above.
   - Trace lineage paths step by step (e.g. "Arthur is the father of Eleanor, who is the mother of David...").
   - If two people share the same name (e.g. father and son both named "Arthur"), explicitly cite their birth years (e.g. "Arthur (b. 1920)" vs "Arthur (b. 1955)") so there is zero confusion.
   - If no connection exists in the recorded records, politely state that no direct path has been recorded yet in this tree.

2. GENERAL FAMILY & KINSHIP KNOWLEDGE:
   - You have deep general knowledge of genealogy and family structures!
   - Answer general questions with thorough clarity: e.g. "What does first cousin once removed mean?", "What is a double first cousin?", "Explain consanguinity degrees", "How do in-law relationships work?", "What questions should I ask my grandmother about family history?", "How do I celebrate a 50th golden anniversary?".
   - Connect general knowledge back to the user's family tree whenever helpful and relevant.

3. TONE & FORMATTING:
   - Warm, respectful, clear, and engaging.
   - Use clean Markdown formatting (bullet points, bold highlights for kinship titles and names).
   - Never invent fictitious family members not listed in the verified family context.`;

  // DUAL-PROVIDER FAILOVER LOGIC
  let primaryProvider: "gemini" | "groq" = "gemini";
  let secondaryProvider: "gemini" | "groq" = "groq";

  if (preferredProvider === "groq") {
    primaryProvider = "groq";
    secondaryProvider = "gemini";
  }

  // Attempt Primary Provider
  try {
    if (primaryProvider === "gemini" && process.env.GEMINI_API_KEY) {
      const res = await callGemini(systemInstruction, history, message);
      return {
        message: res.text,
        provider: "gemini",
        model: res.model,
        failoverOccurred: false,
        detectedKinship,
        familySummary: { id: family.id, name: family.name, memberCount: people.length },
      };
    } else if (primaryProvider === "groq" && process.env.GROQ_API_KEY) {
      const res = await callGroq(systemInstruction, history, message);
      return {
        message: res.text,
        provider: "groq",
        model: res.model,
        failoverOccurred: false,
        detectedKinship,
        familySummary: { id: family.id, name: family.name, memberCount: people.length },
      };
    }
  } catch (primaryErr: any) {
    logger.warn(`Primary provider (${primaryProvider}) failed: ${primaryErr.message}. Attempting failover to ${secondaryProvider}...`);

    // Attempt Secondary Provider
    try {
      if (secondaryProvider === "groq" && process.env.GROQ_API_KEY) {
        const res = await callGroq(systemInstruction, history, message);
        return {
          message: res.text,
          provider: "groq",
          model: res.model,
          failoverOccurred: true,
          failoverDetails: `Primary (${primaryProvider}) encountered an error. Successfully failed over to Groq (${res.model}).`,
          detectedKinship,
          familySummary: { id: family.id, name: family.name, memberCount: people.length },
        };
      } else if (secondaryProvider === "gemini" && process.env.GEMINI_API_KEY) {
        const res = await callGemini(systemInstruction, history, message);
        return {
          message: res.text,
          provider: "gemini",
          model: res.model,
          failoverOccurred: true,
          failoverDetails: `Primary (${primaryProvider}) encountered an error. Successfully failed over to Gemini (${res.model}).`,
          detectedKinship,
          familySummary: { id: family.id, name: family.name, memberCount: people.length },
        };
      }
    } catch (secondaryErr: any) {
      logger.warn(`Secondary provider (${secondaryProvider}) also failed: ${secondaryErr.message}. Falling back to rule-based engine.`);
    }
  }

  // If primary didn't run (e.g. key missing), try the other if its key is present
  if (secondaryProvider === "groq" && process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
    try {
      const res = await callGroq(systemInstruction, history, message);
      return {
        message: res.text,
        provider: "groq",
        model: res.model,
        failoverOccurred: false,
        detectedKinship,
        familySummary: { id: family.id, name: family.name, memberCount: people.length },
      };
    } catch (err: any) {
      logger.warn("Groq fallback call failed:", err);
    }
  } else if (secondaryProvider === "gemini" && process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    try {
      const res = await callGemini(systemInstruction, history, message);
      return {
        message: res.text,
        provider: "gemini",
        model: res.model,
        failoverOccurred: false,
        detectedKinship,
        familySummary: { id: family.id, name: family.name, memberCount: people.length },
      };
    } catch (err: any) {
      logger.warn("Gemini fallback call failed:", err);
    }
  }

  // Built-in intelligent rule-based engine fallback
  const detectedPeople = [targetP1, targetP2].filter(Boolean) as PersonOut[];
  const ruleBasedText = runRuleBasedEngine(message, people, family, detectedKinship, detectedPeople);

  return {
    message: ruleBasedText,
    provider: "rule_based_fallback",
    model: "local-kinship-engine",
    failoverOccurred: true,
    failoverDetails: "Running on built-in offline kinship & genealogy knowledge engine.",
    detectedKinship,
    familySummary: { id: family.id, name: family.name, memberCount: people.length },
  };
}
