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
    const bloodMemberForParent = (childUnit) => {
      if (!childUnit?.members?.length) return null;
      return (
        childUnit.members.find((member) => childUnit.memberParents.get(member.id)?.has(unitId)) ||
        childUnit.members[0]
      );
    };

    children.sort((a, b) => {
      const ga = generation.get(a) ?? 0;
      const gb = generation.get(b) ?? 0;
      if (ga !== gb) return ga - gb;
      const memberA = bloodMemberForParent(units.get(a));
      const memberB = bloodMemberForParent(units.get(b));
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
