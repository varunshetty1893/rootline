import { fullChildrenMap, parentGroupsFor } from "./units.js";

// Trees should remain fully expanded by default; never auto-collapse family branches without explicit user action.
export function recommendedCollapsedFamilyKeys(allPeople, focusIds = new Set()) {
  return new Set();
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
