import { stableKey } from "./constants.js";

export function orderUnits(units, generation, indexById) {
  // A child couple has a meaningful left/right member order. Carry that
  // order back up to the parent units so the parents of the left partner stay
  // on the left and the parents of the right partner stay on the right,
  // regardless of the names or insertion order of those parents.
  const branchMemo = new Map();
  const branchVisiting = new Set();
  const branchKey = (unitId) => {
    if (branchMemo.has(unitId)) return branchMemo.get(unitId);
    if (branchVisiting.has(unitId)) return "";
    branchVisiting.add(unitId);
    const unit = units.get(unitId);
    const childKeys = [...(unit?.childUnits || [])].map((childId) => {
      const child = units.get(childId);
      if (!child?.members?.length) return "";
      const side = child.members.findIndex((member) => child.memberParents.get(member.id)?.has(unitId));
      return `${stableKey(child.members[0], indexById)}|${String(Math.max(side ?? 0, 0)).padStart(3, "0")}|${branchKey(childId)}`;
    }).filter(Boolean);
    branchVisiting.delete(unitId);
    const key = childKeys.sort()[0] || (unit?.members?.[0] ? stableKey(unit.members[0], indexById) : "");
    branchMemo.set(unitId, key);
    return key;
  };

  const roots = [...units.values()]
    .filter((unit) => unit.parentUnits.size === 0)
    .sort((a, b) => branchKey(a.id).localeCompare(branchKey(b.id)));
  const order = new Map();
  let next = 0;
  const seen = new Set();

  const visit = (unitId) => {
    if (seen.has(unitId)) return;
    seen.add(unitId);
    order.set(unitId, next++);
    const unit = units.get(unitId);
    const children = [...(unit?.childUnits || [])];
    const referenceCouple = children
      .map((childId) => units.get(childId))
      .find((child) =>
        child?.members.length > 1 &&
        child.members.some((member) => child.memberParents.get(member.id)?.has(unitId))
      );
    const referenceSide = referenceCouple
      ? referenceCouple.members.findIndex((member) => referenceCouple.memberParents.get(member.id)?.has(unitId))
      : -1;

    children.sort((a, b) => {
      // If this parent unit is the left partner's parent, siblings belong
      // before the couple. If it is the right partner's parent, siblings
      // belong after the couple. This prevents a sibling of babu from being
      // laid out on shubha's side merely because babu and shubha are a
      // contracted partner unit.
      if (referenceCouple && (a === referenceCouple.id || b === referenceCouple.id)) {
        if (a === referenceCouple.id) return referenceSide === 0 ? 1 : -1;
        if (b === referenceCouple.id) return referenceSide === 0 ? -1 : 1;
      }
      const ga = generation.get(a) ?? 0;
      const gb = generation.get(b) ?? 0;
      if (ga !== gb) return ga - gb;
      const memberA = units.get(a)?.members?.[0];
      const memberB = units.get(b)?.members?.[0];
      if (!memberA || !memberB) return 0;
      return stableKey(memberA, indexById).localeCompare(
        stableKey(memberB, indexById)
      );
    });
    children.forEach(visit);
  };

  roots.forEach((unit) => visit(unit.id));
  // Covers disconnected components and the safe fallback for a cyclic record.
  [...units.values()]
    .sort((a, b) => branchKey(a.id).localeCompare(branchKey(b.id)))
    .forEach((unit) => visit(unit.id));

  return order;
}
