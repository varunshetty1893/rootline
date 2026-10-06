import { PersonOut } from "./store";

export interface KinshipResult {
  related: boolean;
  title: string;
  reverseTitle?: string;
  path: string[];
  steps: string[];
  stepDescriptions?: string[];
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
  if (aId === bId) return { up: 0, down: 0, path: [aId], ancestorId: aId, commonAncestorIds: [aId] };

  const aAnc = ancestorDepths(aId, people, byId);
  const bAnc = ancestorDepths(bId, people, byId);

  let best: { total: number; up: number; down: number; aPath: string[]; bPath: string[]; ancestorId: string } | null = null;
  const lowestCommonAncestors: string[] = [];

  for (const [ancId, aInfo] of aAnc) {
    const bInfo = bAnc.get(ancId);
    if (!bInfo) continue;
    const total = aInfo.depth + bInfo.depth;
    if (!best || total < best.total) {
      best = { total, up: aInfo.depth, down: bInfo.depth, aPath: aInfo.path, bPath: bInfo.path, ancestorId: ancId };
      lowestCommonAncestors.length = 0;
      lowestCommonAncestors.push(ancId);
    } else if (best && total === best.total && aInfo.depth === best.up && bInfo.depth === best.down) {
      lowestCommonAncestors.push(ancId);
    }
  }
  if (!best) return null;

  const downSide = [...best.bPath].reverse();
  const path = [...best.aPath.slice(0, -1), ...downSide];
  return {
    up: best.up,
    down: best.down,
    path,
    ancestorId: best.ancestorId,
    commonAncestorIds: lowestCommonAncestors,
  };
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
    const base = genderWord(targetGender, "Grandfather", "Grandmother", "Grandparent");
    return g ? `${g.charAt(0).toUpperCase() + g.slice(1)}${base.toLowerCase()}` : base;
  }
  if (up === 0) {
    if (down === 1) return genderWord(targetGender, "Son", "Daughter", "Child");
    const g = greatPrefix(down - 2);
    const base = genderWord(targetGender, "Grandson", "Granddaughter", "Grandchild");
    return g ? `${g.charAt(0).toUpperCase() + g.slice(1)}${base.toLowerCase()}` : base;
  }
  if (up === 1 && down === 1) {
    return genderWord(targetGender, "Brother", "Sister", "Sibling");
  }
  if (up >= 2 && down === 1) {
    const g = greatPrefix(up - 2);
    const grand = up > 2 ? "grand-" : "";
    const raw = `${g}${grand}${genderWord(targetGender, "uncle", "aunt", "aunt/uncle")}`;
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  if (up === 1 && down >= 2) {
    const g = greatPrefix(down - 2);
    const grand = down > 2 ? "grand-" : "";
    const raw = `${g}${grand}${genderWord(targetGender, "nephew", "niece", "niece/nephew")}`;
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  const degree = Math.min(up, down) - 1;
  const removed = Math.abs(up - down);
  let label = `${ordinal(degree)} cousin`;
  if (removed > 0) label += ` ${removed === 1 ? "once" : removed === 2 ? "twice" : `${removed} times`} removed`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function spouseLabel(gender: string | null): string {
  return genderWord(gender, "Husband", "Wife", "Spouse");
}

function inLawLabel(
  up: number,
  down: number,
  targetGender: string | null,
  coreGender: string | null,
  via: "target-spouse" | "root-spouse"
): string {
  if (via === "root-spouse") {
    if (up === 1 && down === 0) {
      return genderWord(targetGender, "Father-in-law", "Mother-in-law", "Parent-in-law");
    }
    if (up === 0 && down === 1) {
      return genderWord(targetGender, "Stepson", "Stepdaughter", "Stepchild");
    }
    if (up === 1 && down === 1) {
      return genderWord(targetGender, "Brother-in-law", "Sister-in-law", "Sibling-in-law");
    }
    if (up === 2 && down === 0) {
      return genderWord(targetGender, "Grandfather-in-law", "Grandmother-in-law", "Grandparent-in-law");
    }
    if (up === 2 && down === 1) {
      return genderWord(targetGender, "Uncle (by marriage)", "Aunt (by marriage)", "Aunt/Uncle (by marriage)");
    }
    if (up === 1 && down === 2) {
      return genderWord(targetGender, "Nephew (by marriage)", "Niece (by marriage)", "Niece/Nephew (by marriage)");
    }
    const core = bloodLabel(up, down, targetGender);
    return `Spouse's ${core}`;
  }

  // via === "target-spouse": target is married to root's blood relative
  if (up === 0 && down === 1) {
    return genderWord(targetGender, "Son-in-law", "Daughter-in-law", "Child-in-law");
  }
  if (up === 1 && down === 0) {
    return genderWord(targetGender, "Stepfather", "Stepmother", "Stepparent");
  }
  if (up === 1 && down === 1) {
    return genderWord(targetGender, "Brother-in-law", "Sister-in-law", "Sibling-in-law");
  }
  if (up === 0 && down === 2) {
    return genderWord(targetGender, "Grandson-in-law", "Granddaughter-in-law", "Grandchild's Spouse");
  }
  if (up === 2 && down === 1) {
    return genderWord(targetGender, "Uncle (by marriage)", "Aunt (by marriage)", "Aunt/Uncle (by marriage)");
  }
  if (up === 1 && down === 2) {
    return genderWord(targetGender, "Nephew-in-law", "Niece-in-law", "Niece/Nephew's Spouse");
  }
  const core = bloodLabel(up, down, coreGender);
  return `${core}'s ${spouseLabel(targetGender)}`;
}

function twoMarriageInLawLabel(
  up: number,
  down: number,
  targetGender: string | null,
  spouseOfTargetGender: string | null
): string {
  if (up === 1 && down === 1) {
    return genderWord(
      targetGender,
      "Co-brother-in-law (Spouse's Sibling's Husband)",
      "Co-sister-in-law (Spouse's Sibling's Wife)",
      "Spouse's Sibling's Spouse"
    );
  }
  if (up === 1 && down === 2) {
    return genderWord(
      targetGender,
      "Nephew-in-law (Spouse's Niece/Nephew's Husband)",
      "Niece-in-law (Spouse's Niece/Nephew's Wife)",
      "Spouse's Niece/Nephew's Spouse"
    );
  }
  if (up === 2 && down === 1) {
    return genderWord(
      targetGender,
      "Uncle-in-law (Spouse's Aunt/Uncle's Husband)",
      "Aunt-in-law (Spouse's Aunt/Uncle's Wife)",
      "Spouse's Aunt/Uncle's Spouse"
    );
  }
  const core = bloodLabel(up, down, spouseOfTargetGender);
  return `Spouse's ${core}'s ${spouseLabel(targetGender)}`;
}

/**
 * Builds human-readable descriptions for every step along a path of person IDs.
 */
export function describePathSteps(path: string[], byId: Map<string, PersonOut>): string[] {
  const descriptions: string[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = byId.get(path[i]);
    const b = byId.get(path[i + 1]);
    if (!a || !b) continue;

    const aParents = a.parent_ids || [];
    const bParents = b.parent_ids || [];
    const aSpouses = a.spouse_ids || [];
    const bSpouses = b.spouse_ids || [];

    if (aParents.includes(b.id)) {
      const role = genderWord(b.gender, "father", "mother", "parent");
      descriptions.push(`${b.name} is the ${role} of ${a.name}`);
    } else if (bParents.includes(a.id)) {
      const role = genderWord(b.gender, "son", "daughter", "child");
      descriptions.push(`${b.name} is the ${role} of ${a.name}`);
    } else if (aSpouses.includes(b.id) || bSpouses.includes(a.id)) {
      const role = genderWord(b.gender, "husband", "wife", "partner/spouse");
      descriptions.push(`${b.name} is the ${role} of ${a.name}`);
    } else if (aParents.length > 0 && aParents.some((pid) => bParents.includes(pid))) {
      const role = genderWord(b.gender, "brother", "sister", "sibling");
      descriptions.push(`${b.name} is the ${role} of ${a.name}`);
    } else {
      descriptions.push(`${a.name} connects to ${b.name}`);
    }
  }
  return descriptions;
}

/**
 * Shortest-path BFS across all parent, child, and spouse connections
 * for distant or multi-marriage family branches.
 */
function findGeneralFamilyPath(
  startId: string,
  endId: string,
  people: PersonOut[],
  byId: Map<string, PersonOut>
): { path: string[]; generationDiff: number } | null {
  const childrenByParent = new Map<string, string[]>();
  for (const p of people) {
    for (const pid of p.parent_ids || []) {
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
      childrenByParent.get(pid)!.push(p.id);
    }
  }

  const queue: Array<{ id: string; path: string[]; genDiff: number }> = [
    { id: startId, path: [startId], genDiff: 0 },
  ];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const { id, path, genDiff } = queue.shift()!;
    if (id === endId) {
      return { path, generationDiff: genDiff };
    }
    const person = byId.get(id);
    if (!person) continue;

    // 1. Parents (genDiff - 1)
    for (const pid of person.parent_ids || []) {
      if (!visited.has(pid) && byId.has(pid)) {
        visited.add(pid);
        queue.push({ id: pid, path: [...path, pid], genDiff: genDiff - 1 });
      }
    }
    // 2. Children (genDiff + 1)
    for (const cid of childrenByParent.get(id) || []) {
      if (!visited.has(cid) && byId.has(cid)) {
        visited.add(cid);
        queue.push({ id: cid, path: [...path, cid], genDiff: genDiff + 1 });
      }
    }
    // 3. Spouses (genDiff + 0)
    for (const sid of person.spouse_ids || []) {
      if (!visited.has(sid) && byId.has(sid)) {
        visited.add(sid);
        queue.push({ id: sid, path: [...path, sid], genDiff });
      }
    }
  }

  return null;
}

function computeSingleDirectionKinship(
  person1Id: string,
  person2Id: string,
  people: PersonOut[],
  byId: Map<string, PersonOut>
): Omit<KinshipResult, "reverseTitle"> | null {
  const p1 = byId.get(person1Id);
  const p2 = byId.get(person2Id);
  if (!p1 || !p2) return null;

  if (person1Id === person2Id) {
    return {
      related: true,
      title: "Same Person",
      path: [person1Id],
      steps: [p1.name],
      stepDescriptions: [],
      generationDiff: 0,
      commonAncestors: [p1.name],
      explanation: `${p1.name} is the same individual.`,
    };
  }

  // 1. Direct spouse (check before blood in case of data overlap, or right after)
  if ((p1.spouse_ids || []).includes(person2Id) || (p2.spouse_ids || []).includes(person1Id)) {
    const title = spouseLabel(p2.gender);
    const path = [person1Id, person2Id];
    const steps = [p1.name, p2.name];
    return {
      related: true,
      title,
      path,
      steps,
      stepDescriptions: describePathSteps(path, byId),
      generationDiff: 0,
      commonAncestors: [],
      explanation: `${p2.name} is the ${title.toLowerCase()} of ${p1.name}.`,
    };
  }

  // 2. Blood relation
  const blood = bloodRelation(person1Id, person2Id, people, byId);
  if (blood) {
    const title = bloodLabel(blood.up, blood.down, p2.gender);
    const steps = blood.path.map((id) => byId.get(id)?.name || id);
    const stepDescriptions = describePathSteps(blood.path, byId);
    const generationDiff = blood.down - blood.up;
    const commonAncestors = blood.commonAncestorIds
      .map((id) => byId.get(id)?.name)
      .filter((n): n is string => Boolean(n));

    let explanation = `${p2.name} is the ${title.toLowerCase()} of ${p1.name}.`;
    const externalAncestors = blood.commonAncestorIds
      .filter((id) => id !== p1.id && id !== p2.id)
      .map((id) => byId.get(id)?.name)
      .filter(Boolean);
    if (externalAncestors.length > 0) {
      explanation += ` They are connected through their shared ancestor${externalAncestors.length > 1 ? "s" : ""} ${externalAncestors.join(" & ")}.`;
    }

    return {
      related: true,
      title,
      path: blood.path,
      steps,
      stepDescriptions,
      generationDiff,
      commonAncestors,
      explanation,
    };
  }

  // 3. 1-Marriage-Hop In-laws (target's spouse is blood-related to p1, OR p1's spouse is blood-related to target)
  let bestInLaw: {
    rel: { up: number; down: number; path: string[]; ancestorId: string; commonAncestorIds: string[] };
    path: string[];
    via: "target-spouse" | "root-spouse";
    coreGender: string | null;
    bridgeSpouseName: string;
  } | null = null;

  for (const spouseOfTarget of p2.spouse_ids || []) {
    const rel = bloodRelation(person1Id, spouseOfTarget, people, byId);
    if (rel && (!bestInLaw || rel.up + rel.down < bestInLaw.rel.up + bestInLaw.rel.down)) {
      const sp = byId.get(spouseOfTarget);
      bestInLaw = {
        rel,
        path: [...rel.path, person2Id],
        via: "target-spouse",
        coreGender: sp?.gender || null,
        bridgeSpouseName: sp?.name || "",
      };
    }
  }

  for (const spouseOfRoot of p1.spouse_ids || []) {
    const rel = bloodRelation(spouseOfRoot, person2Id, people, byId);
    if (rel && (!bestInLaw || rel.up + rel.down < bestInLaw.rel.up + bestInLaw.rel.down)) {
      const sp = byId.get(spouseOfRoot);
      bestInLaw = {
        rel,
        path: [person1Id, ...rel.path],
        via: "root-spouse",
        coreGender: p2.gender,
        bridgeSpouseName: sp?.name || "",
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
    const stepDescriptions = describePathSteps(bestInLaw.path, byId);
    const generationDiff = bestInLaw.rel.down - bestInLaw.rel.up;
    const commonAncestors = bestInLaw.rel.commonAncestorIds
      .filter((id) => id !== p1.id && id !== p2.id)
      .map((id) => byId.get(id)?.name)
      .filter((n): n is string => Boolean(n));

    return {
      related: true,
      title,
      path: bestInLaw.path,
      steps,
      stepDescriptions,
      generationDiff,
      commonAncestors,
      explanation: `${p2.name} is the ${title.toLowerCase()} of ${p1.name} (connected through ${bestInLaw.bridgeSpouseName}). Connection chain: ${steps.join(" → ")}.`,
    };
  }

  // 4. 2-Marriage-Hop In-laws: p1's spouse is blood-related to p2's spouse
  // Example: Babu Shetty (spouse of Sh) <-> xf (spouse of xx, where xx is Sh's niece/nephew)
  let bestTwoMarriage: {
    rel: { up: number; down: number; path: string[]; ancestorId: string; commonAncestorIds: string[] };
    path: string[];
    spouseOfRoot: PersonOut;
    spouseOfTarget: PersonOut;
  } | null = null;

  for (const sRootId of p1.spouse_ids || []) {
    const sRoot = byId.get(sRootId);
    if (!sRoot) continue;
    for (const sTargetId of p2.spouse_ids || []) {
      const sTarget = byId.get(sTargetId);
      if (!sTarget) continue;
      const rel = bloodRelation(sRootId, sTargetId, people, byId);
      if (rel && (!bestTwoMarriage || rel.up + rel.down < bestTwoMarriage.rel.up + bestTwoMarriage.rel.down)) {
        bestTwoMarriage = {
          rel,
          path: [person1Id, ...rel.path, person2Id],
          spouseOfRoot: sRoot,
          spouseOfTarget: sTarget,
        };
      }
    }
  }

  if (bestTwoMarriage) {
    const title = twoMarriageInLawLabel(
      bestTwoMarriage.rel.up,
      bestTwoMarriage.rel.down,
      p2.gender,
      bestTwoMarriage.spouseOfTarget.gender
    );
    const coreRel = bloodLabel(
      bestTwoMarriage.rel.up,
      bestTwoMarriage.rel.down,
      bestTwoMarriage.spouseOfTarget.gender
    );
    const steps = bestTwoMarriage.path.map((id) => byId.get(id)?.name || id);
    const stepDescriptions = describePathSteps(bestTwoMarriage.path, byId);
    const generationDiff = bestTwoMarriage.rel.down - bestTwoMarriage.rel.up;
    const commonAncestors = bestTwoMarriage.rel.commonAncestorIds
      .map((id) => byId.get(id)?.name)
      .filter((n): n is string => Boolean(n));

    const explanation = `${p2.name} is the ${title.toLowerCase()} of ${p1.name}: ${p1.name} is married to ${bestTwoMarriage.spouseOfRoot.name}, ${bestTwoMarriage.spouseOfTarget.name} is ${bestTwoMarriage.spouseOfRoot.name}'s ${coreRel.toLowerCase()}, and ${p2.name} is married to ${bestTwoMarriage.spouseOfTarget.name}. Connection chain: ${steps.join(" → ")}.`;

    return {
      related: true,
      title,
      path: bestTwoMarriage.path,
      steps,
      stepDescriptions,
      generationDiff,
      commonAncestors,
      explanation,
    };
  }

  // 5. General Family Graph Fallback (e.g., co-parents-in-law whose children married, etc.)
  const general = findGeneralFamilyPath(person1Id, person2Id, people, byId);
  if (general && general.path.length > 1) {
    const steps = general.path.map((id) => byId.get(id)?.name || id);
    const stepDescriptions = describePathSteps(general.path, byId);
    let title = "Extended Relative (by Marriage)";

    // Detect co-parents-in-law (child of p1 married to child of p2)
    if (general.path.length === 4) {
      const mid1 = byId.get(general.path[1]);
      const mid2 = byId.get(general.path[2]);
      if (
        mid1 &&
        mid2 &&
        (mid1.parent_ids || []).includes(p1.id) &&
        (mid2.parent_ids || []).includes(p2.id) &&
        ((mid1.spouse_ids || []).includes(mid2.id) || (mid2.spouse_ids || []).includes(mid1.id))
      ) {
        title = "Co-parent-in-law (Child's Parent-in-law)";
      }
    }

    return {
      related: true,
      title,
      path: general.path,
      steps,
      stepDescriptions,
      generationDiff: general.generationDiff,
      commonAncestors: [],
      explanation: `${p2.name} is connected to ${p1.name} as an ${title.toLowerCase()}. Connection chain: ${steps.join(" → ")} (${stepDescriptions.join("; ")}).`,
    };
  }

  return null;
}

export function determineKinship(person1Id: string, person2Id: string, people: PersonOut[]): KinshipResult | null {
  if (!person1Id || !person2Id) return null;
  const byId = byIdMap(people);
  const forward = computeSingleDirectionKinship(person1Id, person2Id, people, byId);
  if (!forward) return null;

  const reverse =
    person1Id === person2Id
      ? forward
      : computeSingleDirectionKinship(person2Id, person1Id, people, byId);

  return {
    ...forward,
    reverseTitle: reverse?.title,
  };
}
