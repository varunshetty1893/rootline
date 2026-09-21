import { fullChildrenMap, parentGroupsFor } from "./units.js";

// Heuristic peripheral branch collapse and ancestor walk.
// Protects the user's direct lineage (focus person, direct ancestors, descendants, siblings)
// while collapsing distant collateral branches (cousins, nieces/nephews, secondary marriages)
// so the tree starts clean and focused, and users can click "+" to expand branches.
export function recommendedCollapsedFamilyKeys(allPeople, focusIds = new Set()) {
  if (!allPeople || allPeople.length <= 6) return new Set();

  const byId = new Map(allPeople.map((person) => [person.id, person]));
  const effectiveFocus =
    focusIds && focusIds.size > 0
      ? new Set([...focusIds].filter((id) => byId.has(id)))
      : new Set([allPeople[0].id]);

  if (!effectiveFocus.size) return new Set();

  // Find all ancestor IDs for the focus people
  const ancestorIds = new Set();
  for (const focusId of effectiveFocus) {
    for (const aId of ancestorsOf(focusId, allPeople)) {
      ancestorIds.add(aId);
    }
  }

  // Identify all family keys with their children
  const familyKeysWithChildren = new Map();
  for (const person of allPeople) {
    for (const parents of parentGroupsFor(person, byId)) {
      const key = parents.join("|");
      if (!familyKeysWithChildren.has(key)) familyKeysWithChildren.set(key, []);
      familyKeysWithChildren.get(key).push(person.id);
    }
  }

  const collapsed = new Set();

  for (const [key, childIds] of familyKeysWithChildren) {
    const parentIds = key.split("|").filter(Boolean);

    // Never collapse a branch where the focus person is a parent (immediate children)
    if (parentIds.some((pId) => effectiveFocus.has(pId))) {
      continue;
    }

    // Never collapse a branch where a child is in the direct ancestor chain
    const hasDirectAncestorChild = childIds.some((cId) => ancestorIds.has(cId));
    if (hasDirectAncestorChild) {
      continue;
    }

    // Never collapse the focus person's own parent family (where focus person or direct sibling is a child)
    const hasFocusOrDirectSiblingChild = childIds.some((cId) => {
      if (effectiveFocus.has(cId)) return true;
      for (const fId of effectiveFocus) {
        const fp = byId.get(fId);
        if (fp && (fp.parentIds || []).some((pid) => (byId.get(cId)?.parentIds || []).includes(pid))) {
          return true;
        }
      }
      return false;
    });
    if (hasFocusOrDirectSiblingChild) {
      continue;
    }

    // Collateral branches (aunts/uncles' children, cousins, siblings' children, distant descendants)
    // are collapsed so the initial view is clean and readable!
    collapsed.add(key);
  }

  return collapsed;
}

// Ancestor chain (parents, grandparents, ...) for a person, walking every
// parentIds branch. Used to auto-expand collapsed branches when a search match
// is hiding behind them.
export function ancestorsOf(id, people) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const acc = new Set();
  const queue = [id];
  while (queue.length) {
    const current = byId.get(queue.shift());
    if (!current) continue;
    for (const parentId of current.parentIds || []) {
      if (acc.has(parentId)) continue;
      acc.add(parentId);
      queue.push(parentId);
    }
  }
  return acc;
}
