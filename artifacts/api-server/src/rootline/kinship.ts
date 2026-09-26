import { PersonOut } from "./store";

export interface KinshipResult {
  related: boolean;
  title: string;
  path: string[];
  steps: string[];
  generationDiff: number;
  commonAncestors: string[];
  explanation: string;
}

function byIdMap(people: PersonOut[]): Map<string, PersonOut> {
  return new Map(people.map((p) => [p.id, p]));
}

function ancestorDepths(startId: string, people: PersonOut[], byId: Map<string, PersonOut>) {
  const result = new Map<string, { depth: number; path: string[] }>();
  const queue = [{ id: startId, depth: 0, path: [startId] }];
  const seen = new Set([startId]);

  while (queue.length) {
    const { id, depth, path } = queue.shift()!;
    result.set(id, { depth, path });
    const person = byId.get(id);
    if (!person) continue;
    for (const parentId of person.parent_ids || []) {
      if (seen.has(parentId) || !byId.has(parentId)) continue;
      seen.add(parentId);
      queue.push({ id: parentId, depth: depth + 1, path: [...path, parentId] });
    }
  }
  return result;
}

function bloodRelation(aId: string, bId: string, people: PersonOut[], byId: Map<string, PersonOut>) {
  if (aId === bId) return { up: 0, down: 0, path: [aId], ancestorId: aId };

  const aAnc = ancestorDepths(aId, people, byId);
  const bAnc = ancestorDepths(bId, people, byId);

  let best: { total: number; up: number; down: number; aPath: string[]; bPath: string[]; ancestorId: string } | null = null;
  for (const [ancId, aInfo] of aAnc) {
    const bInfo = bAnc.get(ancId);
    if (!bInfo) continue;
    const total = aInfo.depth + bInfo.depth;
    if (!best || total < best.total) {
      best = { total, up: aInfo.depth, down: bInfo.depth, aPath: aInfo.path, bPath: bInfo.path, ancestorId: ancId };
    }
  }
  if (!best) return null;

  const downSide = [...best.bPath].reverse();
  const path = [...best.aPath.slice(0, -1), ...downSide];
  return { up: best.up, down: best.down, path, ancestorId: best.ancestorId };
}

function ordinal(n: number): string {
  const names = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
  if (n < names.length) return names[n];
  return `${n}th`;
}

function greatPrefix(count: number): string {
  return count > 0 ? `${"great-".repeat(count)}` : "";
}

function genderWord(gender: string | null, male: string, female: string, neutral: string): string {
  const g = (gender || "").toLowerCase();
  if (g === "male") return male;
  if (g === "female") return female;
  return neutral;
}

function bloodLabel(up: number, down: number, targetGender: string | null): string {
  if (up === 0 && down === 0) return "Self";

  if (down === 0) {
    if (up === 1) return genderWord(targetGender, "Father", "Mother", "Parent");
    const g = greatPrefix(up - 2);
    return `${g}Grand${genderWord(targetGender, "father", "mother", "parent")}`;
  }
  if (up === 0) {
    if (down === 1) return genderWord(targetGender, "Son", "Daughter", "Child");
    const g = greatPrefix(down - 2);
    return `${g}Grand${genderWord(targetGender, "son", "daughter", "child")}`;
  }
  if (up === 1 && down === 1) {
    return genderWord(targetGender, "Brother", "Sister", "Sibling");
  }
  if (up >= 2 && down === 1) {
    const g = greatPrefix(up - 2);
    const grand = up > 2 ? "grand-" : "";
    return `${g}${grand}${genderWord(targetGender, "Uncle", "Aunt", "Aunt/Uncle")}`;
  }
  if (up === 1 && down >= 2) {
    const g = greatPrefix(down - 2);
    const grand = down > 2 ? "grand-" : "";
    return `${g}${grand}${genderWord(targetGender, "Nephew", "Niece", "Niece/Nephew")}`;
  }
  const degree = Math.min(up, down) - 1;
  const removed = Math.abs(up - down);
  let label = `${ordinal(degree)} cousin`;
  if (removed > 0) label += ` ${removed} time${removed > 1 ? "s" : ""} removed`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function spouseLabel(gender: string | null): string {
  return genderWord(gender, "Husband", "Wife", "Spouse");
}

function inLawLabel(up: number, down: number, targetGender: string | null, coreGender: string | null, via: string): string {
  if (up === 1 && down === 0) {
    return genderWord(targetGender, "Father-in-law", "Mother-in-law", "Parent-in-law");
  }
  if (up === 0 && down === 1) {
    return genderWord(targetGender, "Son-in-law", "Daughter-in-law", "Child-in-law");
  }
  if (up === 1 && down === 1) {
    return genderWord(targetGender, "Brother-in-law", "Sister-in-law", "Sibling-in-law");
  }
  const core = bloodLabel(up, down, coreGender);
  if (via === "target-spouse") {
    return `${spouseLabel(targetGender)} of your ${core}`;
  }
  return `Your spouse's ${core}`;
}

export function determineKinship(person1Id: string, person2Id: string, people: PersonOut[]): KinshipResult | null {
  if (!person1Id || !person2Id) return null;
  const byId = byIdMap(people);
  const p1 = byId.get(person1Id);
  const p2 = byId.get(person2Id);
  if (!p1 || !p2) return null;

  if (person1Id === person2Id) {
    return {
      related: true,
      title: "Same Person",
      path: [person1Id],
      steps: [p1.name],
      generationDiff: 0,
      commonAncestors: [p1.name],
      explanation: `${p1.name} is the selected individual.`,
    };
  }

  // 1. Blood relation
  const blood = bloodRelation(person1Id, person2Id, people, byId);
  if (blood) {
    const title = bloodLabel(blood.up, blood.down, p2.gender);
    const steps = blood.path.map((id) => byId.get(id)?.name || id);
    const generationDiff = blood.down - blood.up;
    const ancPerson = byId.get(blood.ancestorId);
    const commonAncestors = ancPerson ? [ancPerson.name] : [];

    let explanation = `${p2.name} is the ${title.toLowerCase()} of ${p1.name}.`;
    if (ancPerson && ancPerson.id !== p1.id && ancPerson.id !== p2.id) {
      explanation += ` They are connected through their shared ancestor, ${ancPerson.name}.`;
    }

    return {
      related: true,
      title,
      path: blood.path,
      steps,
      generationDiff,
      commonAncestors,
      explanation,
    };
  }

  // 2. Direct spouse
  if ((p1.spouse_ids || []).includes(person2Id)) {
    const title = spouseLabel(p2.gender);
    return {
      related: true,
      title,
      path: [person1Id, person2Id],
      steps: [p1.name, p2.name],
      generationDiff: 0,
      commonAncestors: [],
      explanation: `${p2.name} is married to ${p1.name} (${title.toLowerCase()}).`,
    };
  }

  // 3. In-laws
  let bestInLaw: {
    rel: { up: number; down: number; path: string[]; ancestorId: string };
    path: string[];
    via: string;
    coreGender: string | null;
  } | null = null;

  for (const spouseOfTarget of p2.spouse_ids || []) {
    const rel = bloodRelation(person1Id, spouseOfTarget, people, byId);
    if (rel && (!bestInLaw || rel.up + rel.down < bestInLaw.rel.up + bestInLaw.rel.down)) {
      bestInLaw = {
        rel,
        path: [...rel.path, person2Id],
        via: "target-spouse",
        coreGender: byId.get(spouseOfTarget)?.gender || null,
      };
    }
  }

  for (const spouseOfRoot of p1.spouse_ids || []) {
    const rel = bloodRelation(spouseOfRoot, person2Id, people, byId);
    if (rel && (!bestInLaw || rel.up + rel.down < bestInLaw.rel.up + bestInLaw.rel.down)) {
      bestInLaw = {
        rel,
        path: [person1Id, ...rel.path],
        via: "root-spouse",
        coreGender: p2.gender,
      };
    }
  }

  if (bestInLaw) {
    const title = inLawLabel(
      bestInLaw.rel.up,
      bestInLaw.rel.down,
      p2.gender,
      bestInLaw.coreGender,
      bestInLaw.via
    );
    const steps = bestInLaw.path.map((id) => byId.get(id)?.name || id);
    const generationDiff = bestInLaw.rel.down - bestInLaw.rel.up;
    const ancPerson = byId.get(bestInLaw.rel.ancestorId);
    const commonAncestors = ancPerson ? [ancPerson.name] : [];

    return {
      related: true,
      title,
      path: bestInLaw.path,
      steps,
      generationDiff,
      commonAncestors,
      explanation: `${p2.name} is related by marriage to ${p1.name} as their ${title.toLowerCase()}. Connection chain: ${steps.join(" → ")}.`,
    };
  }

  return null;
}
