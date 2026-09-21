import { fullChildrenMap, parentGroupsFor } from "./units.js";

// Picks peripheral family branches to collapse on the first visit to a dense
// tree. The focus person's lineage, descendants, and immediate family stay open;
// distant branches hanging off distant cousins are collapsed until the user
// expands them. This keeps a large tree readable without changing the saved relationships.
export function recommendedCollapsedFamilyKeys(allPeople, focusIds = new Set()) {
  // Trees under 25 people are compact enough to read without collapsing.
  // Never hide family members automatically on small/medium trees.
  if (allPeople.length < 25) return new Set();

  const byId = new Map(allPeople.map((person) => [person.id, person]));
  const childrenMapFull = fullChildrenMap(allPeople);
  const familyChildren = new Map();
  for (const person of allPeople) {
    for (const parents of parentGroupsFor(person, byId)) {
      const key = parents.join("|");
      if (!familyChildren.has(key)) familyChildren.set(key, { parents, children: [] });
      familyChildren.get(key).children.push(person.id);
    }
  }

  const protectedIds = new Set(focusIds);

  // 1. Spouses of focusIds
  for (const id of [...protectedIds]) {
    const person = byId.get(id);
    for (const spouseId of person?.spouseIds || []) protectedIds.add(spouseId);
  }

  // 2. Descendants of protectedIds (children, grandchildren, etc.) and their spouses
  const descendantQueue = [...protectedIds];
  while (descendantQueue.length) {
    const currentId = descendantQueue.shift();
    for (const childId of childrenMapFull.get(currentId) || []) {
      if (!protectedIds.has(childId)) {
        protectedIds.add(childId);
        descendantQueue.push(childId);
        const childPerson = byId.get(childId);
        for (const spouseId of childPerson?.spouseIds || []) {
          if (!protectedIds.has(spouseId)) {
            protectedIds.add(spouseId);
            descendantQueue.push(spouseId);
          }
        }
      }
    }
  }

  // 3. Ancestors of protectedIds and their spouses
  const ancestorQueue = [...protectedIds];
  while (ancestorQueue.length) {
    const currentId = ancestorQueue.shift();
    const person = byId.get(currentId);
    for (const parentId of person?.parentIds || []) {
      if (!protectedIds.has(parentId)) {
        protectedIds.add(parentId);
        ancestorQueue.push(parentId);
        const parentPerson = byId.get(parentId);
        for (const spouseId of parentPerson?.spouseIds || []) {
          if (!protectedIds.has(spouseId)) {
            protectedIds.add(spouseId);
            ancestorQueue.push(spouseId);
          }
        }
      }
    }
  }

  return new Set(
    [...familyChildren.values()]
      .filter(
        ({ parents, children }) =>
          children.length >= 3 &&
          !parents.some((id) => protectedIds.has(id)) &&
          !children.some((id) => protectedIds.has(id))
      )
      .sort(
        (a, b) =>
          b.children.length - a.children.length ||
          a.parents.join("|").localeCompare(b.parents.join("|"))
      )
      .map(({ parents }) => parents.join("|"))
  );
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
