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
  rootPersonId?: string | null;
  selectedPersonId?: string | null;
  rootPersonName?: string | null;
  selectedPersonName?: string | null;
  selectedRelationship?: string | null;
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
 * Strips stray markdown asterisks (***, **, *), horizontal rules, and raw markdown headers
 * so responses render cleanly in all chat surfaces without "***" artifacts between text.
 */
export function cleanChatbotText(rawText: string): string {
  if (!rawText) return "";
  return rawText
    // Remove horizontal rule lines like *** or --- or ___
    .replace(/^[ \t]*(?:\*{3,}|-{3,}|_{3,})[ \t]*$/gm, "")
    // Replace inline ***text*** with text
    .replace(/\*{3}([^*]+)\*{3}/g, "$1")
    // Replace inline **text** with text
    .replace(/\*{2}([^*]+)\*{2}/g, "$1")
    // Remove any remaining stray ** or *** sequences
    .replace(/\*{2,}/g, "")
    // Convert markdown bullet "* item" at start of line to "• item"
    .replace(/^[ \t]*\*[ \t]+/gm, "• ")
    // Convert markdown headings "### Title" to clean Title
    .replace(/^[ \t]*#{1,6}[ \t]+(.+)$/gm, "$1")
    // Collapse 3+ consecutive newlines into 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

  const children = Array.from(byId.values())
    .filter((m) => (m.parent_ids || []).includes(person.id))
    .map((m) => m.name)
    .filter(Boolean);

  const details: string[] = [];
  if (person.gender) details.push(`Gender: ${person.gender}`);
  if (dates) details.push(`Dates: ${dates}`);
  if (parents.length) details.push(`Parents: ${parents.join(", ")}`);
  if (spouses.length) details.push(`Spouse(s): ${spouses.join(", ")}`);
  if (children.length) details.push(`Children: ${children.join(", ")}`);
  if (person.occupation) details.push(`Occupation: ${person.occupation}`);
  if (person.place_of_birth) details.push(`Born in: ${person.place_of_birth}`);
  if (person.address) details.push(`Location: ${person.address}`);
  if (person.bio) details.push(`Bio: ${person.bio}`);

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
  const matched: { person: PersonOut; index: number }[] = [];

  for (const person of people) {
    if (!person.name) continue;
    const nameLower = person.name.toLowerCase().trim();
    const firstName = nameLower.split(/\s+/)[0];

    let matchIdx = normalizedText.indexOf(nameLower);
    if (matchIdx === -1 && firstName.length >= 2) {
      const escaped = firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "i");
      const m = re.exec(text);
      if (m) matchIdx = m.index;
    }

    if (matchIdx !== -1 && !matched.some((item) => item.person.id === person.id)) {
      matched.push({ person, index: matchIdx });
    }
  }

  matched.sort((a, b) => a.index - b.index);
  return matched.map((m) => m.person);
}

function buildPersonProfileLines(p: PersonOut, people: PersonOut[]): string {
  const byId = new Map(people.map((m) => [m.id, m]));
  const parents = (p.parent_ids || []).map((id) => byId.get(id)?.name).filter(Boolean);
  const spouses = (p.spouse_ids || []).map((id) => byId.get(id)?.name).filter(Boolean);
  const children = people.filter((m) => (m.parent_ids || []).includes(p.id)).map((m) => m.name);
  const siblings = people
    .filter(
      (m) =>
        m.id !== p.id &&
        (m.parent_ids || []).length > 0 &&
        (m.parent_ids || []).some((pid) => (p.parent_ids || []).includes(pid))
    )
    .map((m) => m.name);

  const lines: string[] = [];
  if (p.date_of_birth || p.date_of_death) {
    lines.push(`• Lifespan: ${p.date_of_birth || "Unknown birth date"} ${p.date_of_death ? `to ${p.date_of_death}` : "(Living)"}`);
  }
  if (parents.length > 0) lines.push(`• Parents: ${parents.join(" & ")}`);
  if (spouses.length > 0) lines.push(`• Partner / Spouse: ${spouses.join(", ")}`);
  if (siblings.length > 0) lines.push(`• Siblings: ${siblings.join(", ")}`);
  if (children.length > 0) lines.push(`• Children: ${children.join(", ")}`);
  if (p.address) lines.push(`• Location: ${p.address}`);
  if (p.bio && p.bio !== "You") lines.push(`• Notes: ${p.bio}`);
  return lines.join("\n");
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
  detectedPeople: PersonOut[],
  rootPerson?: PersonOut | null
): string {
  const q = message.toLowerCase();
  const byId = new Map(people.map((m) => [m.id, m]));

  // Check if user is asking a specific question about one person's parents, children, siblings, spouse, etc.
  const subjectPerson =
    detectedPeople.length === 1
      ? detectedPeople[0]
      : detectedPeople.length === 2 && rootPerson && detectedPeople[0].id === rootPerson.id
      ? detectedPeople[1]
      : null;

  if (subjectPerson) {
    const parents = (subjectPerson.parent_ids || []).map((id) => byId.get(id)?.name).filter(Boolean);
    const spouses = (subjectPerson.spouse_ids || []).map((id) => byId.get(id)?.name).filter(Boolean);
    const children = people.filter((m) => (m.parent_ids || []).includes(subjectPerson.id)).map((m) => m.name);
    const siblings = people
      .filter(
        (m) =>
          m.id !== subjectPerson.id &&
          (m.parent_ids || []).length > 0 &&
          (m.parent_ids || []).some((pid) => (subjectPerson.parent_ids || []).includes(pid))
      )
      .map((m) => m.name);

    if (/\b(parent|parents|father|mother|mom|dad)\b/.test(q) && !q.includes("related")) {
      return parents.length > 0
        ? `${subjectPerson.name}'s recorded parents are ${parents.join(" and ")}.`
        : `No parents are recorded yet for ${subjectPerson.name} in the ${family.name} tree.`;
    }
    if (/\b(child|children|kids|son|daughter)\b/.test(q) && !q.includes("related")) {
      return children.length > 0
        ? `${subjectPerson.name} has ${children.length} recorded ${children.length === 1 ? "child" : "children"}: ${children.join(", ")}.`
        : `No children are recorded yet for ${subjectPerson.name} in the ${family.name} tree.`;
    }
    if (/\b(sibling|siblings|brother|brothers|sister|sisters)\b/.test(q) && !q.includes("related")) {
      return siblings.length > 0
        ? `${subjectPerson.name}'s siblings are ${siblings.join(", ")}.`
        : `No siblings are recorded for ${subjectPerson.name} in the ${family.name} tree.`;
    }
    if (/\b(spouse|spouses|partner|husband|wife|married)\b/.test(q) && !q.includes("related")) {
      return spouses.length > 0
        ? `${subjectPerson.name} is partnered/married with ${spouses.join(", ")}.`
        : `No spouse or partner is recorded for ${subjectPerson.name} in the ${family.name} tree.`;
    }
  }

  // If specific kinship was calculated between two people
  if (kinship && detectedPeople.length >= 2) {
    const p1 = detectedPeople[0];
    const p2 = detectedPeople[1];
    const isP1Root = rootPerson && p1.id === rootPerson.id;
    const p1Label = isP1Root ? `You (${p1.name})` : p1.name;
    const p1Dates = p1?.date_of_birth ? ` (b. ${p1.date_of_birth})` : "";
    const p2Dates = p2?.date_of_birth ? ` (b. ${p2.date_of_birth})` : "";

    if (kinship.related) {
      let text = `${p2.name}${p2Dates} is the ${kinship.title} of ${p1Label}${p1Dates}.\n\n`;
      text += `• Relationship: ${kinship.title}\n`;
      text += `• Generational Step: ${
        kinship.generationDiff === 0
          ? "Same generation"
          : kinship.generationDiff > 0
          ? `${kinship.generationDiff} generation(s) younger`
          : `${Math.abs(kinship.generationDiff)} generation(s) older`
      }\n`;
      if (kinship.steps && kinship.steps.length > 0) {
        text += `• Lineage Path: ${kinship.steps.join(" → ")}\n`;
      }
      if (kinship.commonAncestors && kinship.commonAncestors.length > 0) {
        text += `• Shared Ancestor(s): ${kinship.commonAncestors.join(", ")}\n`;
      }
      if (kinship.explanation) {
        text += `\n${kinship.explanation}`;
      }
      const profileInfo = buildPersonProfileLines(p2, people);
      if (profileInfo) {
        text += `\n\nAbout ${p2.name}:\n${profileInfo}`;
      }
      return cleanChatbotText(text);
    } else {
      return cleanChatbotText(
        `No direct ancestral, descendant, or marital relationship path was found between ${p1Label} and ${p2.name} in the ${family.name} tree. They may belong to separate branches that have not been linked yet.`
      );
    }
  }

  // General kinship terminology inquiries
  if (q.includes("first cousin once removed") || q.includes("once removed")) {
    return cleanChatbotText(
      `What Does "Once Removed" Mean?\n\nIn genealogy, "removed" indicates a generational difference between cousins:\n\n• First Cousins: Share the same grandparents and are in the same generation as you.\n• First Cousin Once Removed: One generation away from being first cousins. This can mean either your parent's first cousin (one generation above you) or your first cousin's child (one generation below you).\n• Twice Removed: Two generations apart (for example, your grandparent's first cousin, or your first cousin's grandchild).\n\nIn your ${family.name} family tree, the kinship engine computes these generational offsets automatically.`
    );
  }

  if (q.includes("second cousin") || q.includes("2nd cousin")) {
    return cleanChatbotText(
      `Understanding Second Cousins\n\nSecond cousins share the same great-grandparents, but have different grandparents.\n\n• Siblings: Share parents (1 generation to common ancestor)\n• 1st Cousins: Share grandparents (2 generations to common ancestor)\n• 2nd Cousins: Share great-grandparents (3 generations to common ancestor)\n• 3rd Cousins: Share great-great-grandparents (4 generations to common ancestor)\n\nAsk me about any two family members to check if they are cousins!`
    );
  }

  if (q.includes("double cousin") || q.includes("double first cousin")) {
    return cleanChatbotText(
      `Double First Cousins\n\nDouble first cousins occur when two siblings from one family have children with two siblings from another family (for example, two brothers marry two sisters).\n\nBecause they share all four grandparents rather than just two, double first cousins share approximately 25% of their DNA (the same as half-siblings) instead of the usual 12.5% for regular first cousins.`
    );
  }

  if (q.includes("consanguinity") || q.includes("affinity")) {
    return cleanChatbotText(
      `Consanguinity vs. Affinity\n\n• Consanguinity: Kinship by blood or genetic descent from a common ancestor (such as parents, children, siblings, aunts, uncles, and cousins).\n• Affinity: Kinship created through marriage (such as spouses, mothers-in-law, brothers-in-law, and step-relatives).\n\nRootline tracks both bloodlines and marriage links to explain how any two relatives are connected.`
    );
  }

  if (q.includes("granduncle") || q.includes("great uncle") || q.includes("great-uncle")) {
    return cleanChatbotText(
      `Granduncle vs. Great-Uncle\n\nBoth terms refer to the brother of your grandparent. Genealogists often use "granduncle" because it parallels "grandfather", while "great-uncle" is common in everyday conversation. Similarly, a grandaunt (or great-aunt) is the sister of your grandparent.`
    );
  }

  if (q.includes("oldest") || q.includes("earliest ancestor")) {
    const withBirth = people
      .filter((p) => p.date_of_birth && !isNaN(new Date(p.date_of_birth).getTime()))
      .sort((a, b) => new Date(a.date_of_birth!).getTime() - new Date(b.date_of_birth!).getTime());
    const rootAncestors = people.filter((p) => !p.parent_ids || p.parent_ids.length === 0);
    let resp = `Oldest & Earliest Recorded Ancestors in ${family.name}:\n\n`;
    if (withBirth.length > 0) {
      const oldest = withBirth[0];
      resp += `• Earliest Birth Date: ${oldest.name} (born ${oldest.date_of_birth})\n`;
    }
    if (rootAncestors.length > 0) {
      resp += `• Top-Level Branch Ancestors (${rootAncestors.length}): ${rootAncestors.slice(0, 10).map((p) => p.name).join(", ")}\n`;
    }
    return cleanChatbotText(resp);
  }

  if (q.includes("youngest")) {
    const withBirth = people
      .filter((p) => p.date_of_birth && !isNaN(new Date(p.date_of_birth).getTime()))
      .sort((a, b) => new Date(b.date_of_birth!).getTime() - new Date(a.date_of_birth!).getTime());
    if (withBirth.length > 0) {
      const youngest = withBirth[0];
      return cleanChatbotText(`The youngest person with a recorded birth date in ${family.name} is ${youngest.name} (born ${youngest.date_of_birth}).`);
    }
  }

  if (q.includes("interview") || q.includes("oral") || q.includes("elders") || q.includes("questions should i ask")) {
    return cleanChatbotText(
      `Questions to Ask Elders for Oral Family History\n\n• What are your earliest childhood memories and what was your home like?\n• How did your parents and grandparents meet, and what were their occupations?\n• What family traditions, recipes, or sayings were passed down to you?\n• Where did our family live before moving here, and what stories were told about our ancestors?\n• Are there any old photographs, letters, or heirlooms whose stories we should record in the tree?`
    );
  }

  if (q.includes("how many") || q.includes("summary") || q.includes("overview") || q.includes("members") || q.includes("related in our family")) {
    const living = people.filter((p) => !p.date_of_death).length;
    const deceased = people.length - living;
    const withParents = people.filter((p) => (p.parent_ids || []).length > 0).length;
    const withSpouses = people.filter((p) => (p.spouse_ids || []).length > 0).length;
    return cleanChatbotText(
      `${family.name} Family Tree Summary\n\nYour tree currently has ${people.length} recorded members:\n• Living Members: ${living}\n• Deceased / Remembered Ancestors: ${deceased}\n• Members Linked to Parents: ${withParents}\n• Members with Recorded Partners: ${withSpouses}\n${rootPerson ? `• Tree Starter (You): ${rootPerson.name}\n` : ""}\nAsk me how any two relatives are connected (for example, "How is ${people[Math.min(1, people.length - 1)]?.name || "Person A"} related to ${rootPerson?.name || people[0]?.name || "me"}?") or ask about anyone's parents, spouse, or children!`
    );
  }

  if (detectedPeople.length >= 1) {
    const p = detectedPeople[0];
    const profileLines = buildPersonProfileLines(p, people);
    let text = `${p.name}'s Family Connections\n\n${profileLines || "• No additional details recorded yet."}`;
    if (rootPerson && rootPerson.id !== p.id) {
      const relToRoot = determineKinship(rootPerson.id, p.id, people);
      if (relToRoot && relToRoot.related) {
        text = `${p.name} is your ${relToRoot.title} (relative to ${rootPerson.name}).\n• Lineage Path: ${relToRoot.steps.join(" → ")}\n\n${text}`;
      }
    }
    return cleanChatbotText(text);
  }

  return cleanChatbotText(
    `Hello! I am your Family Guide for the ${family.name} tree (${people.length} members).\n\nYou can ask me:\n• How is [Name] related to me?\n• How is [Person A] related to [Person B]?\n• Who are [Name]'s parents, children, or siblings?\n• Who is the oldest ancestor in this tree?\n• What does "first cousin once removed" mean?`
  );
}

/**
 * Call Gemini Flash via @google/genai with automatic model fallback
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

  // Candidate models: prioritize official Gemini 3 Flash and 2.5 Flash models
  const candidateModels: string[] = [];
  const configuredModel = process.env.GEMINI_MODEL;
  if (configuredModel && !configuredModel.includes("1.5") && !configuredModel.includes("2.0")) {
    candidateModels.push(configuredModel);
  }
  for (const m of ["gemini-3-flash-preview", "gemini-2.5-flash"]) {
    if (!candidateModels.includes(m)) {
      candidateModels.push(m);
    }
  }

  let lastError: any = null;

  for (const modelName of candidateModels) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Gemini API request timed out after 12 seconds (${modelName})`)), 12000)
      );

      const response = await Promise.race([
        client.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
            temperature: 0.35,
          },
        }),
        timeoutPromise,
      ]);

      const text = cleanChatbotText(response.text?.trim() || "");
      if (text) {
        return { text, model: modelName };
      }
    } catch (err: any) {
      lastError = err;
      logger.warn(`Gemini model attempt (${modelName}) failed: ${err?.message || err}. Trying next candidate model if available...`);
    }
  }

  throw lastError || new Error("Empty response returned from Gemini API");
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

  const candidateGroqModels = [
    process.env.GROQ_MODEL,
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
  ].filter(Boolean) as string[];

  const formattedMessages = [
    { role: "system", content: systemInstruction },
    ...messages.slice(-8).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: latestMessage },
  ];

  let lastGroqError: any = null;

  for (const model of candidateGroqModels) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model,
          messages: formattedMessages,
          temperature: 0.35,
          max_tokens: 1200,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Groq API returned HTTP ${response.status}: ${errorBody}`);
      }

      const data = (await response.json()) as any;
      const text = cleanChatbotText(data.choices?.[0]?.message?.content?.trim() || "");
      if (text) {
        return { text, model };
      }
    } catch (err: any) {
      lastGroqError = err;
      logger.warn(`Groq model (${model}) failed: ${err?.message || err}. Trying next fallback...`);
    }
  }

  throw lastGroqError || new Error("Empty response received from Groq API");
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
    rootPersonId,
    selectedPersonId,
    rootPersonName,
    selectedPersonName,
  } = options;

  // STRICT MULTI-TENANT ISOLATION CHECK
  const access = store.checkFamilyAccess(userId, familyId);
  if (!access) {
    throw new Error("Access denied: You do not have permission to view or query this family tree.");
  }

  const family = access.family || store.getFamily(familyId);
  if (!family) {
    throw new Error("Target family was not found.");
  }

  // Load ONLY people belonging to this verified family
  const people = store.getPeopleForOwner(family.id);
  const byId = new Map(people.map((p) => [p.id, p]));

  // Resolve Root Person ("You" / Tree Starter)
  let rootPerson: PersonOut | undefined =
    (rootPersonId ? byId.get(rootPersonId) : undefined) ||
    (family.root_person_id ? byId.get(family.root_person_id) : undefined) ||
    (rootPersonName ? people.find((p) => p.name.toLowerCase() === rootPersonName.toLowerCase()) : undefined) ||
    people[0];

  // Resolve Selected Person from UI if provided
  let selectedPerson: PersonOut | undefined =
    (selectedPersonId ? byId.get(selectedPersonId) : undefined) ||
    (selectedPersonName ? people.find((p) => p.name.toLowerCase() === selectedPersonName.toLowerCase()) : undefined);

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
      const mPerson = mentioned[0];
      if (rootPerson && rootPerson.id !== mPerson.id) {
        targetP1 = rootPerson;
        targetP2 = mPerson;
      } else if (selectedPerson && selectedPerson.id !== mPerson.id) {
        targetP1 = selectedPerson;
        targetP2 = mPerson;
      } else {
        targetP1 = mPerson;
      }
    } else if (selectedPerson) {
      if (rootPerson && rootPerson.id !== selectedPerson.id) {
        targetP1 = rootPerson;
        targetP2 = selectedPerson;
      } else {
        targetP1 = selectedPerson;
      }
    }
  }

  if (targetP1 && targetP2 && targetP1.id !== targetP2.id) {
    detectedKinship = determineKinship(targetP1.id, targetP2.id, people);
  }

  // Build isolated system prompt with active family records
  const peopleSummaries = people
    .map((p) => formatPersonSummary(p, byId))
    .join("\n");

  let kinshipContext = "";
  if (rootPerson) {
    kinshipContext += `\nTREE STARTER / REFERENCE PERSON ("You" / "Me"): ${rootPerson.name} (ID: ${rootPerson.id})`;
  }
  if (selectedPerson) {
    kinshipContext += `\nCURRENTLY SELECTED PERSON IN UI: ${selectedPerson.name} (ID: ${selectedPerson.id})`;
  }
  if (targetP1 && targetP2 && detectedKinship) {
    const p1Dates = [targetP1.date_of_birth ? `b. ${targetP1.date_of_birth}` : "", targetP1.date_of_death ? `d. ${targetP1.date_of_death}` : ""].filter(Boolean).join(" - ");
    const p2Dates = [targetP2.date_of_birth ? `b. ${targetP2.date_of_birth}` : "", targetP2.date_of_death ? `d. ${targetP2.date_of_death}` : ""].filter(Boolean).join(" - ");

    kinshipContext += `\nPRE-VERIFIED RELATIONSHIP FACT FOR THIS QUERY:
Reference Person 1: ${targetP1.name} (${p1Dates || "dates unrecorded"})
Relative Person 2: ${targetP2.name} (${p2Dates || "dates unrecorded"})
Verified Kinship Title: ${detectedKinship.title}
Generational Difference: ${detectedKinship.generationDiff} (${detectedKinship.generationDiff === 0 ? "same generation" : detectedKinship.generationDiff > 0 ? `${detectedKinship.generationDiff} generation(s) down` : `${Math.abs(detectedKinship.generationDiff)} generation(s) up`})
Exact Chain of Lineage: ${detectedKinship.steps.join(" → ")}
${detectedKinship.commonAncestors.length ? `Common Ancestor(s): ${detectedKinship.commonAncestors.join(", ")}` : ""}
Mathematical Explanation: ${detectedKinship.explanation}
CRITICAL MANDATE: You MUST use these exact verified mathematical facts when answering. If individuals share the same first/last name, use their birth or death years to clearly disambiguate who is who.`;
  }

  const systemInstruction = `You are Rootline's Kinship & Family Guide, a warm, clear, and accurate genealogy assistant.

ACTIVE FAMILY TREE CONTEXT (STRICT TENANT ISOLATION):
- Family Name: "${family.name}" (ID: ${family.id})
- Total Members in Tree: ${people.length}
- Verified Family Members:
${peopleSummaries}
${kinshipContext}

CORE CAPABILITIES & RULES:
1. UNDERSTAND RELATIONSHIPS:
   - When the user says "me", "my", or "I", they refer to the Tree Starter (${rootPerson ? rootPerson.name : "the tree starter"}).
   - When asked about relationships between people in this family tree, explain their connection clearly, warmly, and accurately based ONLY on the verified records above.
   - Trace lineage paths step by step (e.g. "Babu is the father of Varun...").
   - If two people share the same name, cite their birth years or spouses/parents to clearly disambiguate who is who.
   - If no connection exists in the recorded records, politely state that no direct path has been recorded yet in this tree.

2. GENERAL FAMILY & KINSHIP KNOWLEDGE:
   - Answer general genealogy questions clearly (e.g. "What does first cousin once removed mean?", "What is a double first cousin?", "Consanguinity vs affinity", "Questions to ask elders").

3. STRICT FORMATTING RULE (NO ASTERISKS):
   - NEVER use "***" or "**" or Markdown asterisks anywhere in your response.
   - Use plain text and simple "•" bullet points when listing items.
   - Keep answers concise, warm, and easy to read.`;

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
  const ruleBasedText = runRuleBasedEngine(message, people, family, detectedKinship, detectedPeople, rootPerson);

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
