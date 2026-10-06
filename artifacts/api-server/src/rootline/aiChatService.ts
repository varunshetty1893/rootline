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

const COMMON_STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "in", "on", "at", "to", "of", "for",
  "with", "by", "from", "about", "as", "into", "like", "through", "after", "over",
  "between", "out", "against", "during", "without", "before", "under", "around",
  "among", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "do", "does", "did", "can", "could", "will", "would", "should", "may", "might",
  "must", "who", "what", "when", "where", "why", "how", "which", "whom", "whose",
  "i", "me", "my", "mine", "myself", "you", "your", "yours", "yourself", "u", "ur",
  "he", "him", "his", "she", "her", "hers", "it", "its", "we", "us", "our", "ours",
  "they", "them", "their", "theirs", "this", "that", "these", "those", "all", "any",
  "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not",
  "only", "own", "same", "so", "than", "too", "very", "tell", "show", "explain",
  "compare", "family", "tree", "member", "members", "person", "people", "relative",
  "relatives", "related", "relation", "relationship", "relationships", "connection",
  "connections", "parent", "parents", "father", "mother", "dad", "mom", "child",
  "children", "son", "daughter", "kids", "sibling", "siblings", "brother", "sister",
  "spouse", "partner", "husband", "wife", "married", "cousin", "cousins", "uncle",
  "aunt", "nephew", "niece", "grandparent", "grandparents", "grandfather", "grandmother",
  "grandchild", "grandchildren", "ancestor", "ancestors", "descendant", "descendants",
  "oldest", "youngest", "earliest", "according", "mean", "means", "meaning", "define",
  "hi", "hello", "hey", "thanks", "thank", "help", "know", "list", "everyone",
]);

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
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
    .replace(/^[ \t]*(?:\*{3,}|-{3,}|_{3,})[ \t]*$/gm, "")
    .replace(/\*{3}([^*]+)\*{3}/g, "$1")
    .replace(/\*{2}([^*]+)\*{2}/g, "$1")
    .replace(/\*{2,}/g, "")
    .replace(/^[ \t]*\*[ \t]+/gm, "• ")
    .replace(/^[ \t]*#{1,6}[ \t]+(.+)$/gm, "$1")
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

  const siblings = Array.from(byId.values())
    .filter(
      (m) =>
        m.id !== person.id &&
        (m.parent_ids || []).length > 0 &&
        (m.parent_ids || []).some((pid) => (person.parent_ids || []).includes(pid))
    )
    .map((m) => m.name)
    .filter(Boolean);

  const details: string[] = [];
  if (person.gender) details.push(`Gender: ${person.gender}`);
  if (dates) details.push(`Dates: ${dates}`);
  if (parents.length) details.push(`Parents: ${parents.join(", ")}`);
  if (spouses.length) details.push(`Spouse(s): ${spouses.join(", ")}`);
  if (siblings.length) details.push(`Siblings: ${siblings.join(", ")}`);
  if (children.length) details.push(`Children: ${children.join(", ")}`);
  if (person.occupation) details.push(`Occupation: ${person.occupation}`);
  if (person.place_of_birth) details.push(`Born in: ${person.place_of_birth}`);
  if (person.address) details.push(`Location: ${person.address}`);
  if (person.bio && person.bio !== "You") details.push(`Bio: ${person.bio}`);

  return `- ${person.name} (ID: ${person.id}): ${details.join(" | ") || "No extra details"}`;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Scans the user message for mentioned family members using strict word boundaries
 * and span claiming so shorter names (e.g. "x", "Sh") never match inside longer names ("xf", "Babu Shetty").
 */
export function findMentionedPeople(text: string, people: PersonOut[]): PersonOut[] {
  if (!text || !people.length) return [];

  const claimedSpans: Array<{ start: number; end: number }> = [];
  const matched: Array<{ person: PersonOut; index: number }> = [];

  const isSpanFree = (start: number, end: number) =>
    !claimedSpans.some((s) => start < s.end && end > s.start);

  // Sort people by full name length descending so longer names claim their character spans first
  const sortedByFullName = [...people]
    .filter((p) => p.name && p.name.trim().length > 0)
    .sort((a, b) => b.name.trim().length - a.name.trim().length);

  // Pass 1: Match full names with strict non-alphanumeric word boundaries
  for (const person of sortedByFullName) {
    const cleanName = person.name.trim();
    const lowerName = cleanName.toLowerCase();

    // If a person's full name happens to be a common English stop word, only match if capitalized or quoted
    if (COMMON_STOP_WORDS.has(lowerName)) {
      const capRe = new RegExp(`(?<![a-zA-Z0-9])(?:["']${escapeRegExp(cleanName)}["']|${escapeRegExp(cleanName)})(?![a-zA-Z0-9])`, "g");
      let m: RegExpExecArray | null;
      while ((m = capRe.exec(text)) !== null) {
        if (m[0] === cleanName || m[0].startsWith('"') || m[0].startsWith("'")) {
          const start = m.index;
          const end = start + m[0].length;
          if (isSpanFree(start, end)) {
            claimedSpans.push({ start, end });
            matched.push({ person, index: start });
            break;
          }
        }
      }
      continue;
    }

    const re = new RegExp(`(?<![a-zA-Z0-9])${escapeRegExp(cleanName)}(?![a-zA-Z0-9])`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (isSpanFree(start, end)) {
        claimedSpans.push({ start, end });
        matched.push({ person, index: start });
        break;
      }
    }
  }

  // Pass 2: Match distinct first/middle/last name tokens (length >= 2, non-stopword) for multi-word names
  for (const person of sortedByFullName) {
    if (matched.some((item) => item.person.id === person.id)) continue;
    const tokens = person.name
      .trim()
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !COMMON_STOP_WORDS.has(t.toLowerCase()));

    for (const token of tokens) {
      const re = new RegExp(`(?<![a-zA-Z0-9])${escapeRegExp(token)}(?![a-zA-Z0-9])`, "gi");
      let m: RegExpExecArray | null;
      let matchedToken = false;
      while ((m = re.exec(text)) !== null) {
        const start = m.index;
        const end = start + m[0].length;
        if (isSpanFree(start, end)) {
          claimedSpans.push({ start, end });
          matched.push({ person, index: start });
          matchedToken = true;
          break;
        }
      }
      if (matchedToken) break;
    }
  }

  matched.sort((a, b) => a.index - b.index);
  return matched.map((m) => m.person);
}

function getExtendedRelatives(p: PersonOut, people: PersonOut[]) {
  const byId = new Map(people.map((m) => [m.id, m]));
  const parents = (p.parent_ids || []).map((id) => byId.get(id)).filter((x): x is PersonOut => Boolean(x));
  const spouses = (p.spouse_ids || []).map((id) => byId.get(id)).filter((x): x is PersonOut => Boolean(x));
  const children = people.filter((m) => (m.parent_ids || []).includes(p.id));
  const siblings = people.filter(
    (m) =>
      m.id !== p.id &&
      (m.parent_ids || []).length > 0 &&
      (m.parent_ids || []).some((pid) => (p.parent_ids || []).includes(pid))
  );

  const grandparents = Array.from(
    new Set(parents.flatMap((par) => par.parent_ids || []))
  )
    .map((id) => byId.get(id))
    .filter((x): x is PersonOut => Boolean(x));

  const grandchildren = Array.from(
    new Set(children.flatMap((ch) => people.filter((m) => (m.parent_ids || []).includes(ch.id)).map((m) => m.id)))
  )
    .map((id) => byId.get(id))
    .filter((x): x is PersonOut => Boolean(x));

  const auntsUncles = Array.from(
    new Set(
      parents.flatMap((par) =>
        people
          .filter(
            (m) =>
              m.id !== par.id &&
              (m.parent_ids || []).length > 0 &&
              (m.parent_ids || []).some((gpid) => (par.parent_ids || []).includes(gpid))
          )
          .map((m) => m.id)
      )
    )
  )
    .map((id) => byId.get(id))
    .filter((x): x is PersonOut => Boolean(x));

  const niecesNephews = Array.from(
    new Set(
      siblings.flatMap((sib) =>
        people.filter((m) => (m.parent_ids || []).includes(sib.id)).map((m) => m.id)
      )
    )
  )
    .map((id) => byId.get(id))
    .filter((x): x is PersonOut => Boolean(x));

  const cousins = Array.from(
    new Set(
      auntsUncles.flatMap((au) =>
        people.filter((m) => (m.parent_ids || []).includes(au.id)).map((m) => m.id)
      )
    )
  )
    .map((id) => byId.get(id))
    .filter((x): x is PersonOut => Boolean(x));

  return {
    parents,
    spouses,
    children,
    siblings,
    grandparents,
    grandchildren,
    auntsUncles,
    niecesNephews,
    cousins,
  };
}

function buildPersonProfileLines(p: PersonOut, people: PersonOut[]): string {
  const rels = getExtendedRelatives(p, people);
  const lines: string[] = [];

  if (p.date_of_birth || p.date_of_death) {
    lines.push(
      `• Lifespan: ${p.date_of_birth || "Birth date unrecorded"} ${
        p.date_of_death ? `to ${p.date_of_death}` : "(Living)"
      }`
    );
  }
  if (rels.parents.length > 0) lines.push(`• Parents: ${rels.parents.map((x) => x.name).join(" & ")}`);
  if (rels.grandparents.length > 0) lines.push(`• Grandparents: ${rels.grandparents.map((x) => x.name).join(", ")}`);
  if (rels.spouses.length > 0) lines.push(`• Partner / Spouse: ${rels.spouses.map((x) => x.name).join(", ")}`);
  if (rels.siblings.length > 0) lines.push(`• Siblings: ${rels.siblings.map((x) => x.name).join(", ")}`);
  if (rels.children.length > 0) lines.push(`• Children: ${rels.children.map((x) => x.name).join(", ")}`);
  if (rels.grandchildren.length > 0) lines.push(`• Grandchildren: ${rels.grandchildren.map((x) => x.name).join(", ")}`);
  if (rels.auntsUncles.length > 0) lines.push(`• Aunts / Uncles: ${rels.auntsUncles.map((x) => x.name).join(", ")}`);
  if (rels.niecesNephews.length > 0) lines.push(`• Nieces / Nephews: ${rels.niecesNephews.map((x) => x.name).join(", ")}`);
  if (rels.cousins.length > 0) lines.push(`• First Cousins: ${rels.cousins.map((x) => x.name).join(", ")}`);
  if (p.occupation) lines.push(`• Occupation: ${p.occupation}`);
  if (p.place_of_birth) lines.push(`• Place of Birth: ${p.place_of_birth}`);
  if (p.address) lines.push(`• Location: ${p.address}`);
  if (p.bio && p.bio !== "You") lines.push(`• Notes: ${p.bio}`);
  return lines.join("\n");
}

/**
 * Checks if the question is a general knowledge / conceptual / genealogy education question
 */
function answerGeneralKnowledgeQuestion(
  message: string,
  family: Family,
  people: PersonOut[],
  rootPerson?: PersonOut | null
): string | null {
  const q = message.toLowerCase().trim();

  // 1. "What is family according to you" / philosophy & meaning of family
  if (
    /\b(what is family|what's family|meaning of family|define family|family according to|importance of family|why is family important|concept of family|about family)\b/.test(q)
  ) {
    return cleanChatbotText(
      `What Family Means\n\nFamily is both a living story and a circle of belonging that connects across time:\n\n• Emotional & Human Bond: At its heart, family is made of the people who nurture, support, and stand by one another through life's milestones—united by love, shared values, and mutual care.\n• Living Bridge Across Generations: Genealogically, a family links the ancestors whose sacrifices and stories shaped the past with the present generation and the children who carry that legacy forward.\n• Bloodlines & Chosen Bonds: In genealogy, family weaves together both consanguinity (shared blood and ancestry) and affinity (bonds formed through marriage, partnership, and adoption).\n• Cultural Identity & Memory: Every family preserves unique traditions, values, lessons, and stories that give each member a sense of roots and identity.\n\nIn your ${family.name} tree (${people.length} recorded members), every card and connection line preserves a piece of that shared human story.`
    );
  }

  // 2. "What is a family tree" / "What is genealogy" / "What is ancestry" / "What is lineage"
  if (
    /\b(what is genealogy|what is a family tree|what is ancestry|what is lineage|what is a pedigree|purpose of a family tree|why build a family tree)\b/.test(q)
  ) {
    return cleanChatbotText(
      `Understanding Genealogy & Family Trees\n\n• Genealogy: The study and tracing of family lineages, history, and kinship connections across generations using oral history, vital records, and genetic relationships.\n• Family Tree (Pedigree & Descendancy): A visual map showing how individuals are connected through parentage (vertical lines) and partnerships/marriages (horizontal links).\n• Lineage vs. Ancestry: A "lineage" traces a direct line of descent from a specific ancestor (such as a paternal or maternal line), whereas "ancestry" encompasses all of your biological and familial forebears.\n\nYour ${family.name} tree currently documents ${people.length} members.`
    );
  }

  // 3. First Cousin Once Removed / Removed Cousins
  if (q.includes("once removed") || q.includes("twice removed") || q.includes("cousin removed")) {
    return cleanChatbotText(
      `What Does "Once Removed" Mean?\n\nIn genealogy, "removed" measures how many generations apart two cousins are:\n\n• First Cousins: Share the same grandparents and sit in the same generation.\n• First Cousin Once Removed: Separated by 1 generation. This is either your parent's first cousin (1 generation older than you) or your first cousin's child (1 generation younger than you).\n• First Cousin Twice Removed: Separated by 2 generations (your grandparent's first cousin, or your first cousin's grandchild).\n\nQuick Rule: The cousin number (1st, 2nd, 3rd) tells you which ancestor you share (grandparents, great-grandparents, great-great-grandparents), while "removed" tells you the generation gap between the two cousins.`
    );
  }

  // 4. First vs Second vs Third Cousins / Cousin Chart
  if (/\b(second cousin|2nd cousin|third cousin|3rd cousin|how do cousins work|types of cousins|what is a cousin)\b/.test(q)) {
    return cleanChatbotText(
      `How Cousin Relationships Work\n\nCousins are relatives who share a common ancestor at least two generations back (grandparents or earlier):\n\n• Siblings: Share the same parents (1 step up to common ancestor)\n• First Cousins: Share the same grandparents (2 steps up)\n• Second Cousins: Share the same great-grandparents, meaning your parents are first cousins (3 steps up)\n• Third Cousins: Share the same great-great-grandparents, meaning your grandparents were first cousins (4 steps up)\n\nIf two cousins are in different generations, we add "once removed" (1 generation apart) or "twice removed" (2 generations apart).`
    );
  }

  // 5. Double First Cousins & Parallel vs Cross Cousins
  if (q.includes("double cousin") || q.includes("double first cousin") || q.includes("parallel cousin") || q.includes("cross cousin")) {
    return cleanChatbotText(
      `Special Cousin Relationships\n\n• Double First Cousins: Occur when two siblings from one family marry/partner with two siblings from another family. Their children share all four grandparents instead of two, sharing ~25% of their DNA (similar to half-siblings) rather than the standard 12.5% for first cousins.\n• Parallel Cousins: Cousins from same-gender parent siblings (your father's brother's child, or your mother's sister's child).\n• Cross Cousins: Cousins from opposite-gender parent siblings (your father's sister's child, or your mother's brother's child).`
    );
  }

  // 6. Consanguinity vs Affinity
  if (q.includes("consanguinity") || q.includes("affinity") || q.includes("blood relative vs")) {
    return cleanChatbotText(
      `Consanguinity vs. Affinity\n\n• Consanguinity (Blood Kinship): Relationships by genetic descent from a shared ancestor—such as parents, children, siblings, grandparents, aunts, uncles, nieces, nephews, and cousins.\n• Affinity (Kinship by Marriage): Relationships formed through marriage or partnership—such as a spouse, mother-in-law, father-in-law, brother-in-law, sister-in-law, son/daughter-in-law, or co-in-laws.\n\nRootline automatically traces both bloodlines and marital links across your tree.`
    );
  }

  // 7. Maternal vs Paternal / Patrilineal vs Matrilineal
  if (/\b(maternal|paternal|patrilineal|matrilineal)\b/.test(q)) {
    return cleanChatbotText(
      `Maternal vs. Paternal Lineage\n\n• Maternal Line: Relatives connected through your mother's side of the family. A matrilineal line traces strictly from mother to mother.\n• Paternal Line: Relatives connected through your father's side of the family. A patrilineal line traces strictly from father to father.\n• Bilateral (Cognatic) Kinship: Tracing family equally through both mother's and father's branches, which is how Rootline maps your complete tree.`
    );
  }

  // 8. Granduncle / Great-Uncle / Grandaunt / Great-Aunt / Grandnephew / Grandniece
  if (/\b(granduncle|great uncle|great-uncle|grandaunt|great aunt|great-aunt|grandnephew|grandniece|great nephew|great niece)\b/.test(q)) {
    return cleanChatbotText(
      `Granduncle / Great-Uncle & Grandnephew / Grandniece\n\n• Granduncle (or Great-Uncle): The brother of your grandparent (your parent's uncle).\n• Grandaunt (or Great-Aunt): The sister of your grandparent (your parent's aunt).\n• Grandnephew / Grandniece: The grandchild of your brother or sister (your niece's or nephew's child).`
    );
  }

  // 9. Half-sibling vs Stepsibling / Nuclear vs Joint Family
  if (/\b(half sibling|half-sibling|half brother|half sister|step sibling|stepsibling|stepbrother|stepsister|nuclear family|joint family|extended family)\b/.test(q)) {
    return cleanChatbotText(
      `Family Structure & Sibling Terms\n\n• Full Siblings: Share both biological parents.\n• Half-Siblings: Share one biological parent (either the same mother or the same father).\n• Stepsiblings: Connected by the marriage of their parents, without sharing a biological parent.\n• Nuclear Family: Parents and their immediate children living or grouped together.\n• Extended / Joint Family: Multiple generations and branches—including grandparents, aunts, uncles, cousins, and in-laws—connected as a broader family network.`
    );
  }

  // 10. Shared DNA & Genetics in Genealogy
  if (/\b(dna|shared dna|genetic|centimorgan|heredity|chromosome)\b/.test(q)) {
    return cleanChatbotText(
      `Average Shared DNA Between Relatives\n\nIn genetic genealogy, relatives share predictable average percentages of autosomal DNA:\n\n• Parent / Child / Full Sibling: ~50% shared DNA\n• Grandparent / Grandchild / Aunt / Uncle / Niece / Nephew / Half-Sibling: ~25% shared DNA\n• First Cousin / Great-Grandparent / Granduncle / Grandaunt: ~12.5% shared DNA\n• First Cousin Once Removed: ~6.25% shared DNA\n• Second Cousin: ~3.125% shared DNA\n• Third Cousin: ~0.78% shared DNA`
    );
  }

  // 11. Indian & South Asian Kinship Terms (Mama, Chacha, Bua, Mausi, Atte, Mava, Doddappa, Chikkappa, etc.)
  if (
    /\b(indian kinship|mama|mami|chacha|chachi|tau|tai|bua|fufa|mausi|mausa|nana|nani|dada|dadi|bhabhi|jija|sala|sali|samdhi|samdhan|devar|nanad|atte|mava|doddappa|chikkappa|doddamme|chikkamma|bhava|maiduna)\b/.test(q)
  ) {
    return cleanChatbotText(
      `Indian Kinship Terms & English Equivalents\n\nIndian languages use precise titles that distinguish maternal, paternal, elder, and younger relatives:\n\n• Paternal Grandparents: Dada / Ajja (Grandfather) & Dadi / Ajji (Grandmother)\n• Maternal Grandparents: Nana / Ajja (Grandfather) & Nani / Ajji (Grandmother)\n• Father's Brother: Tau / Doddappa (Elder Uncle) & Chacha / Chikkappa / Kaka (Younger Uncle)\n• Father's Sister: Bua / Atte (Paternal Aunt) & Fufa / Mava (Paternal Aunt's Husband)\n• Mother's Brother: Mama / Mava (Maternal Uncle) & Mami / Atte (Maternal Uncle's Wife)\n• Mother's Sister: Mausi / Doddamme / Chikkamma (Maternal Aunt)\n• In-Laws: Bhabhi / Anni (Brother's Wife), Jija / Bhava (Sister's Husband), Sala / Maiduna (Wife's Brother), Samdhi / Samdhan (Child's Parents-in-law).`
    );
  }

  // 12. Oral History & Interviewing Elders
  if (q.includes("interview") || q.includes("oral") || q.includes("elders") || q.includes("questions should i ask") || q.includes("preserve family history")) {
    return cleanChatbotText(
      `Questions to Ask Elders for Oral Family History\n\n• What are your earliest childhood memories and what was your family home like?\n• How did your parents and grandparents meet, and what were their occupations?\n• What family traditions, festival customs, or recipes were passed down to you?\n• Where did our family live generations ago, and what stories were told about our ancestors?\n• What is the story behind our family surname or ancestral hometown?\n• Are there old photographs, letters, or heirlooms we should document in our family tree?`
    );
  }

  // 13. Greetings / Capabilities / Help
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|namaste|greetings|who are you|what can you do|help|how do you work)\b/.test(q)) {
    return cleanChatbotText(
      `Hello! I am your Rootline Kinship & Family Guide for the ${family.name} tree (${people.length} recorded members).\n\nHere is what I can help you with:\n• Relationship Finder: Ask how any two people in your tree are related (e.g., "How is [Person A] related to [Person B]?"), including bloodlines and multi-step marriage/in-law connections.\n• Member Profiles: Ask "Tell me about [Name]" or ask who someone's parents, spouse, siblings, children, grandchildren, or nieces/nephews are.\n• Tree Directory & Stats: Ask "Who is in this family tree?", "Who are the couples?", or "Who is the oldest ancestor?"\n• General Family & Genealogy Knowledge: Ask about what family means, how cousins and removals work, Indian/cultural kinship terms, shared DNA percentages, or tips for oral family history!`
    );
  }

  if (/^(thanks|thank you|thx|awesome|great|nice|ok|okay)\b/.test(q)) {
    return cleanChatbotText(
      `You're very welcome! Feel free to ask anytime if you want to explore another relationship in the ${family.name} tree or learn more about family history and kinship.`
    );
  }

  return null;
}

/**
 * Built-in Rule-Based Genealogy, Kinship & General Knowledge Engine
 * Seamlessly provides accurate answers about relationships, tree members, and general knowledge.
 */
function runRuleBasedEngine(
  message: string,
  people: PersonOut[],
  family: Family,
  kinship: KinshipResult | null,
  refPerson: PersonOut | undefined,
  subjectPerson: PersonOut | undefined,
  mentionedPeople: PersonOut[],
  rootPerson?: PersonOut | null
): string {
  const q = message.toLowerCase().trim();
  const byId = new Map(people.map((m) => [m.id, m]));

  // 1. If two people are being compared (either 2 people mentioned, or 1 person compared to "me"/"you")
  if (kinship && refPerson && subjectPerson && refPerson.id !== subjectPerson.id) {
    const isRefRoot = rootPerson && refPerson.id === rootPerson.id;
    const isSubjRoot = rootPerson && subjectPerson.id === rootPerson.id;
    const refLabel = isRefRoot ? `${refPerson.name} (You)` : refPerson.name;
    const subjLabel = isSubjRoot ? `${subjectPerson.name} (You)` : subjectPerson.name;
    const refDates = refPerson.date_of_birth ? ` (b. ${refPerson.date_of_birth})` : "";
    const subjDates = subjectPerson.date_of_birth ? ` (b. ${subjectPerson.date_of_birth})` : "";

    if (kinship.related) {
      let text = `${subjLabel}${subjDates} is the ${kinship.title} of ${refLabel}${refDates}.\n`;
      if (kinship.reverseTitle && kinship.reverseTitle !== "Same Person") {
        text += `(Conversely, ${refPerson.name} is the ${kinship.reverseTitle} of ${subjectPerson.name}.)\n`;
      }
      text += `\n• Relationship (${subjectPerson.name} to ${refPerson.name}): ${kinship.title}\n`;
      if (kinship.reverseTitle) {
        text += `• Reverse Relationship (${refPerson.name} to ${subjectPerson.name}): ${kinship.reverseTitle}\n`;
      }
      text += `• Generational Step: ${
        kinship.generationDiff === 0
          ? "Same generation"
          : kinship.generationDiff > 0
          ? `${kinship.generationDiff} generation(s) younger than ${refPerson.name}`
          : `${Math.abs(kinship.generationDiff)} generation(s) older than ${refPerson.name}`
      }\n`;
      if (kinship.steps && kinship.steps.length > 0) {
        text += `• Lineage / Connection Path: ${kinship.steps.join(" → ")}\n`;
      }
      if (kinship.commonAncestors && kinship.commonAncestors.length > 0) {
        text += `• Shared Ancestor(s): ${kinship.commonAncestors.join(", ")}\n`;
      }
      if (kinship.stepDescriptions && kinship.stepDescriptions.length > 0) {
        text += `\nStep-by-Step Connection:\n`;
        kinship.stepDescriptions.forEach((step, idx) => {
          text += `${idx + 1}. ${step}\n`;
        });
      } else if (kinship.explanation) {
        text += `\n${kinship.explanation}\n`;
      }

      const profileInfo = buildPersonProfileLines(subjectPerson, people);
      if (profileInfo) {
        text += `\nAbout ${subjectPerson.name}:\n${profileInfo}`;
      }
      return cleanChatbotText(text);
    } else {
      return cleanChatbotText(
        `No direct ancestral, descendant, or marital relationship path was found between ${subjLabel} and ${refLabel} in the ${family.name} tree. They may belong to separate branches that have not been linked yet.`
      );
    }
  }

  // 2. If 2 people were mentioned, but no connection path exists between them
  if (refPerson && subjectPerson && refPerson.id !== subjectPerson.id && !kinship) {
    return cleanChatbotText(
      `No direct ancestral, descendant, or marital relationship path was found between ${subjectPerson.name} and ${refPerson.name} in the ${family.name} tree. Make sure their connecting parents or spouse links are recorded on the tree.`
    );
  }

  // 3. Check if user is asking about a single specific person (either mentioned by name or via pronoun)
  const singleTarget = mentionedPeople.length === 1 ? mentionedPeople[0] : subjectPerson || null;
  if (singleTarget) {
    const rels = getExtendedRelatives(singleTarget, people);

    if (/\b(grandparent|grandparents|grandfather|grandmother|grandpa|grandma)\b/.test(q) && !q.includes("related")) {
      return rels.grandparents.length > 0
        ? cleanChatbotText(`${singleTarget.name}'s recorded grandparents are ${rels.grandparents.map((x) => x.name).join(", ")}.`)
        : cleanChatbotText(`No grandparents are recorded yet for ${singleTarget.name} in the ${family.name} tree.`);
    }
    if (/\b(parent|parents|father|mother|mom|dad)\b/.test(q) && !q.includes("related")) {
      return rels.parents.length > 0
        ? cleanChatbotText(`${singleTarget.name}'s recorded parents are ${rels.parents.map((x) => x.name).join(" and ")}.`)
        : cleanChatbotText(`No parents are recorded yet for ${singleTarget.name} in the ${family.name} tree.`);
    }
    if (/\b(grandchild|grandchildren|grandson|granddaughter|grandkids)\b/.test(q) && !q.includes("related")) {
      return rels.grandchildren.length > 0
        ? cleanChatbotText(`${singleTarget.name}'s recorded grandchildren are ${rels.grandchildren.map((x) => x.name).join(", ")}.`)
        : cleanChatbotText(`No grandchildren are recorded yet for ${singleTarget.name} in the ${family.name} tree.`);
    }
    if (/\b(child|children|kids|son|daughter)\b/.test(q) && !q.includes("related")) {
      return rels.children.length > 0
        ? cleanChatbotText(
            `${singleTarget.name} has ${rels.children.length} recorded ${
              rels.children.length === 1 ? "child" : "children"
            }: ${rels.children.map((x) => x.name).join(", ")}.`
          )
        : cleanChatbotText(`No children are recorded yet for ${singleTarget.name} in the ${family.name} tree.`);
    }
    if (/\b(sibling|siblings|brother|brothers|sister|sisters)\b/.test(q) && !q.includes("related")) {
      return rels.siblings.length > 0
        ? cleanChatbotText(`${singleTarget.name}'s recorded siblings are ${rels.siblings.map((x) => x.name).join(", ")}.`)
        : cleanChatbotText(`No siblings are recorded for ${singleTarget.name} in the ${family.name} tree.`);
    }
    if (/\b(spouse|spouses|partner|husband|wife|married)\b/.test(q) && !q.includes("related")) {
      return rels.spouses.length > 0
        ? cleanChatbotText(`${singleTarget.name} is partnered/married with ${rels.spouses.map((x) => x.name).join(", ")}.`)
        : cleanChatbotText(`No spouse or partner is recorded for ${singleTarget.name} in the ${family.name} tree.`);
    }
    if (/\b(uncle|uncles|aunt|aunts)\b/.test(q) && !q.includes("related")) {
      return rels.auntsUncles.length > 0
        ? cleanChatbotText(`${singleTarget.name}'s aunts/uncles are ${rels.auntsUncles.map((x) => x.name).join(", ")}.`)
        : cleanChatbotText(`No aunts or uncles are recorded for ${singleTarget.name} in the ${family.name} tree.`);
    }
    if (/\b(niece|nieces|nephew|nephews)\b/.test(q) && !q.includes("related")) {
      return rels.niecesNephews.length > 0
        ? cleanChatbotText(`${singleTarget.name}'s nieces/nephews are ${rels.niecesNephews.map((x) => x.name).join(", ")}.`)
        : cleanChatbotText(`No nieces or nephews are recorded for ${singleTarget.name} in the ${family.name} tree.`);
    }
    if (/\b(cousin|cousins)\b/.test(q) && !q.includes("related")) {
      return rels.cousins.length > 0
        ? cleanChatbotText(`${singleTarget.name}'s first cousins are ${rels.cousins.map((x) => x.name).join(", ")}.`)
        : cleanChatbotText(`No first cousins are recorded for ${singleTarget.name} in the ${family.name} tree.`);
    }

    const profileLines = buildPersonProfileLines(singleTarget, people);
    let text = `${singleTarget.name}'s Family Connections\n\n${profileLines || "• No additional connections recorded yet."}`;
    if (rootPerson && rootPerson.id !== singleTarget.id) {
      const relToRoot = determineKinship(rootPerson.id, singleTarget.id, people);
      if (relToRoot && relToRoot.related) {
        text = `${singleTarget.name} is your ${relToRoot.title} (relative to ${rootPerson.name}).\n• Lineage Path: ${relToRoot.steps.join(" → ")}\n\n${text}`;
      }
    } else if (rootPerson && rootPerson.id === singleTarget.id) {
      text = `${singleTarget.name} is the Tree Starter ("You") of the ${family.name} tree.\n\n${text}`;
    }
    return cleanChatbotText(text);
  }

  // 4. Whole-Tree Directory & Overview Queries ("Who is in this family tree?", "List all members", "How many people", etc.)
  if (
    /\b(who is in|who all are in|who are in|everyone in|people in this|members in this|list all|show all|family tree|how many|summary|overview|members|related in our family|all relatives|directory)\b/.test(
      q
    ) &&
    !/\b(what is a family tree|what is family)\b/.test(q)
  ) {
    if (people.length === 0) {
      return cleanChatbotText(`The ${family.name} tree does not have any members recorded yet.`);
    }
    const living = people.filter((p) => !p.date_of_death).length;
    const deceased = people.length - living;
    const withParents = people.filter((p) => (p.parent_ids || []).length > 0).length;
    const withSpouses = people.filter((p) => (p.spouse_ids || []).length > 0).length;

    const memberLines = people.slice(0, 35).map((p) => {
      const pNames = (p.parent_ids || []).map((id) => byId.get(id)?.name).filter(Boolean);
      const sNames = (p.spouse_ids || []).map((id) => byId.get(id)?.name).filter(Boolean);
      const cNames = people.filter((m) => (m.parent_ids || []).includes(p.id)).map((m) => m.name);
      const tags: string[] = [];
      if (rootPerson && p.id === rootPerson.id) tags.push("Tree Starter / You");
      else if (rootPerson) {
        const rel = determineKinship(rootPerson.id, p.id, people);
        if (rel?.related) tags.push(rel.title);
      }
      if (pNames.length) tags.push(`Parents: ${pNames.join(" & ")}`);
      if (sNames.length) tags.push(`Spouse: ${sNames.join(", ")}`);
      if (cNames.length) tags.push(`Children: ${cNames.join(", ")}`);
      return `• ${p.name}${tags.length ? ` — ${tags.join(" | ")}` : ""}`;
    });

    let resp = `${family.name} Family Tree Members (${people.length} total)\n\n`;
    resp += `Tree Summary:\n• Total Members: ${people.length} (${living} living${deceased > 0 ? `, ${deceased} deceased` : ""})\n`;
    resp += `• Linked to Parents: ${withParents} | Partnered/Married: ${withSpouses}\n`;
    if (rootPerson) {
      resp += `• Tree Starter (You): ${rootPerson.name}\n`;
    }
    resp += `\nRecorded Family Members:\n${memberLines.join("\n")}`;
    if (people.length > 35) {
      resp += `\n• ...and ${people.length - 35} more members.`;
    }
    return cleanChatbotText(resp);
  }

  // 5. Oldest / Youngest / Couples in the tree
  if (q.includes("oldest") || q.includes("earliest ancestor") || q.includes("forefather") || q.includes("root ancestor")) {
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
      resp += `• Top-Generation Ancestors (${rootAncestors.length}): ${rootAncestors.slice(0, 12).map((p) => p.name).join(", ")}\n`;
    }
    return cleanChatbotText(resp);
  }

  if (q.includes("youngest")) {
    const withBirth = people
      .filter((p) => p.date_of_birth && !isNaN(new Date(p.date_of_birth).getTime()))
      .sort((a, b) => new Date(b.date_of_birth!).getTime() - new Date(a.date_of_birth!).getTime());
    if (withBirth.length > 0) {
      const youngest = withBirth[0];
      return cleanChatbotText(
        `The youngest person with a recorded birth date in ${family.name} is ${youngest.name} (born ${youngest.date_of_birth}).`
      );
    }
    const leafMembers = people.filter(
      (p) => !people.some((m) => (m.parent_ids || []).includes(p.id))
    );
    return cleanChatbotText(
      `Birth dates are not recorded for all members yet, but the youngest-generation members (with no recorded children yet) in ${family.name} include: ${leafMembers
        .slice(0, 10)
        .map((p) => p.name)
        .join(", ")}.`
    );
  }

  if (/\b(couples|marriages|married couples|spouses in this tree)\b/.test(q)) {
    const seenPairs = new Set<string>();
    const coupleList: string[] = [];
    for (const p of people) {
      for (const sid of p.spouse_ids || []) {
        const sp = byId.get(sid);
        if (!sp) continue;
        const key = [p.id, sp.id].sort().join("|");
        if (!seenPairs.has(key)) {
          seenPairs.add(key);
          coupleList.push(`• ${p.name} & ${sp.name}`);
        }
      }
    }
    return coupleList.length > 0
      ? cleanChatbotText(`Recorded Couples in ${family.name} (${coupleList.length}):\n\n${coupleList.join("\n")}`)
      : cleanChatbotText(`No married or partnered couples are recorded yet in the ${family.name} tree.`);
  }

  // 6. General Knowledge & Genealogy Concepts
  const generalAnswer = answerGeneralKnowledgeQuestion(message, family, people, rootPerson);
  if (generalAnswer) {
    return generalAnswer;
  }

  // 7. Thoughtful Fallback that answers open-ended questions without dumping an unrelated person's card
  const sampleP1 = people[0]?.name || "Person A";
  const sampleP2 = people[Math.min(1, people.length - 1)]?.name || "Person B";
  return cleanChatbotText(
    `I am your Family & Kinship Guide for the ${family.name} tree (${people.length} recorded members).\n\nHere are some ways I can help you right now:\n• Compare Any Two Relatives: Try asking "How is ${sampleP1} related to ${sampleP2}?"\n• Explore a Family Member: Try asking "Tell me about ${sampleP1}" or "Who are ${sampleP1}'s parents and children?"\n• See the Full Tree Directory: Ask "Who is in this family tree?" or "Who are the couples in this tree?"\n• General Family & Kinship Knowledge: Ask "What is family according to you?", "How do first and second cousins work?", "What does once removed mean?", or "Explain Indian kinship terms."`
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

  const candidateModels: string[] = [];
  const configuredModel = process.env.GEMINI_MODEL;
  if (configuredModel && !configuredModel.includes("1.5") && !configuredModel.includes("2.0")) {
    candidateModels.push(configuredModel);
  }
  for (const m of ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3-flash-preview", "gemini-2.5-flash"]) {
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
            systemInstruction,
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
  const rootPerson: PersonOut | undefined =
    (rootPersonId ? byId.get(rootPersonId) : undefined) ||
    (family.root_person_id ? byId.get(family.root_person_id) : undefined) ||
    (rootPersonName ? people.find((p) => p.name.toLowerCase() === rootPersonName.toLowerCase()) : undefined) ||
    people[0];

  // Resolve Selected Person from UI if provided
  const selectedPerson: PersonOut | undefined =
    (selectedPersonId ? byId.get(selectedPersonId) : undefined) ||
    (selectedPersonName ? people.find((p) => p.name.toLowerCase() === selectedPersonName.toLowerCase()) : undefined);

  const lowerMsg = message.toLowerCase();
  const mentioned = findMentionedPeople(message, people);

  // Check whether user is asking a relationship comparison or referring to themselves / selected person
  const refersToSelf = /\b(me|my|myself|i)\b/.test(lowerMsg) && !/\b(tell me about|show me|give me|explain to me)\b/.test(lowerMsg);
  const asksHowRelated = /\b(related|relation|relationship|connect|connected|connection|who is .+ to|what is .+ to)\b/.test(lowerMsg);
  const refersToSelectedPronoun =
    mentioned.length === 0 &&
    /\b(this person|selected person|he|him|his|she|her|hers)\b/.test(lowerMsg) &&
    !answerGeneralKnowledgeQuestion(message, family, people, rootPerson);

  // Determine Reference Person (targetP1) and Subject Person (targetP2, where we answer "targetP2 is the [Title] of targetP1")
  let detectedKinship: KinshipResult | null = null;
  let targetP1: PersonOut | undefined;
  let targetP2: PersonOut | undefined;

  if (person1Id && person2Id && person1Id !== person2Id) {
    // Explicit pair selector: person1Id is Reference, person2Id is Subject
    targetP1 = byId.get(person1Id);
    targetP2 = byId.get(person2Id);
  } else if (mentioned.length >= 2) {
    // In natural English ("How is A related to B?"), the first mentioned person (A) is the subject
    // and the second mentioned person (B) is the reference person ("of B").
    targetP2 = mentioned[0];
    targetP1 = mentioned[1];
  } else if (mentioned.length === 1) {
    const mPerson = mentioned[0];
    if ((refersToSelf || asksHowRelated) && rootPerson && rootPerson.id !== mPerson.id) {
      targetP1 = rootPerson;
      targetP2 = mPerson;
    } else {
      targetP2 = mPerson;
    }
  } else if (refersToSelectedPronoun && selectedPerson) {
    if (asksHowRelated && rootPerson && rootPerson.id !== selectedPerson.id) {
      targetP1 = rootPerson;
      targetP2 = selectedPerson;
    } else {
      targetP2 = selectedPerson;
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
    kinshipContext += `\nCURRENTLY SELECTED PERSON IN UI (only use if user's question is about them): ${selectedPerson.name} (ID: ${selectedPerson.id})`;
  }
  if (targetP1 && targetP2 && detectedKinship) {
    const p1Dates = [targetP1.date_of_birth ? `b. ${targetP1.date_of_birth}` : "", targetP1.date_of_death ? `d. ${targetP1.date_of_death}` : ""].filter(Boolean).join(" - ");
    const p2Dates = [targetP2.date_of_birth ? `b. ${targetP2.date_of_birth}` : "", targetP2.date_of_death ? `d. ${targetP2.date_of_death}` : ""].filter(Boolean).join(" - ");

    kinshipContext += `\nPRE-VERIFIED RELATIONSHIP FACT FOR THIS QUERY:
Reference Person: ${targetP1.name} (${p1Dates || "dates unrecorded"})
Subject Relative: ${targetP2.name} (${p2Dates || "dates unrecorded"})
Verified Kinship (${targetP2.name} to ${targetP1.name}): ${targetP2.name} is the ${detectedKinship.title} of ${targetP1.name}
${detectedKinship.reverseTitle ? `Reverse Kinship (${targetP1.name} to ${targetP2.name}): ${targetP1.name} is the ${detectedKinship.reverseTitle} of ${targetP2.name}` : ""}
Generational Difference: ${detectedKinship.generationDiff} (${detectedKinship.generationDiff === 0 ? "same generation" : detectedKinship.generationDiff > 0 ? `${detectedKinship.generationDiff} generation(s) younger than ${targetP1.name}` : `${Math.abs(detectedKinship.generationDiff)} generation(s) older than ${targetP1.name}`})
Exact Chain of Lineage: ${detectedKinship.steps.join(" → ")}
${detectedKinship.stepDescriptions?.length ? `Step-by-Step Breakdown: ${detectedKinship.stepDescriptions.join(" -> ")}` : ""}
${detectedKinship.commonAncestors.length ? `Common Ancestor(s): ${detectedKinship.commonAncestors.join(", ")}` : ""}
Mathematical Explanation: ${detectedKinship.explanation}
CRITICAL MANDATE: You MUST use these exact verified mathematical facts when answering how ${targetP2.name} and ${targetP1.name} are related.`;
  }

  const systemInstruction = `You are Rootline's Kinship & Family Guide, an intelligent, warm, and articulate genealogy and general knowledge assistant.

ACTIVE FAMILY TREE CONTEXT (STRICT TENANT ISOLATION):
- Family Name: "${family.name}" (ID: ${family.id})
- Total Members in Tree: ${people.length}
- Verified Family Members:
${peopleSummaries}
${kinshipContext}

CORE CAPABILITIES & RULES:
1. ACCURATE FAMILY RELATIONSHIPS & TREE QUERIES:
   - When the user says "me", "my", or "I", they refer to the Tree Starter (${rootPerson ? rootPerson.name : "the tree starter"}).
   - When asked how Person A is related to Person B, state clearly what Person A is to Person B AND what Person B is to Person A, then trace the exact step-by-step lineage/marriage path using the verified records above.
   - When asked "Who is in this family tree?", list the members of the ${family.name} tree and their relationships clearly.
   - Do NOT answer with a single person's connections unless the user actually asked about that specific person.

2. BROAD GENERAL KNOWLEDGE & GENEALOGY EXPERTISE:
   - You have full general knowledge! If the user asks philosophical, cultural, historical, scientific, or general questions (such as "What is family according to you?", "What is genealogy?", "How do cousins and removals work?", "Indian kinship terms", "Shared DNA", or any general knowledge question), answer thoughtfully, accurately, and naturally.

3. STRICT FORMATTING RULE (NO ASTERISKS):
   - NEVER use "***" or "**" or Markdown asterisks anywhere in your response.
   - Use plain text and simple "•" bullet points when listing items.
   - Keep answers clear, warm, and well-structured.`;

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
      logger.warn(`Secondary provider (${secondaryProvider}) also failed: ${secondaryErr.message}. Falling back to built-in knowledge engine.`);
    }
  }

  // If primary didn't run because its key was missing, try secondary if its key is present
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

  // Built-in intelligent rule-based & general knowledge engine fallback
  const ruleBasedText = runRuleBasedEngine(
    message,
    people,
    family,
    detectedKinship,
    targetP1,
    targetP2,
    mentioned,
    rootPerson
  );

  return {
    message: ruleBasedText,
    provider: "rule_based_fallback",
    model: "local-kinship-engine",
    failoverOccurred: true,
    failoverDetails: "Running on built-in kinship & general knowledge engine.",
    detectedKinship,
    familySummary: { id: family.id, name: family.name, memberCount: people.length },
  };
}
