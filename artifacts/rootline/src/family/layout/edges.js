import { parentGroupsFor } from "./units.js";
import { validIds } from "./constants.js";

export function makeEdges(people, byId) {
  const familyGroups = new Map();
  for (const person of people) {
    for (const parents of parentGroupsFor(person, byId)) {
      const key = parents.join("|");
      if (!familyGroups.has(key)) familyGroups.set(key, { parents, children: [] });
      familyGroups.get(key).children.push(person.id);
    }
  }

  const edges = [...familyGroups.values()].map((family) => ({
    type: "family-child",
    parents: family.parents,
    children: family.children,
    familyKey: family.parents.join("|"),
  }));

  const seenSpousePairs = new Set();
  for (const person of people) {
    for (const spouseId of validIds(person.spouseIds, byId)) {
      const pairKey = [person.id, spouseId].sort().join("|");
      if (seenSpousePairs.has(pairKey)) continue;
      seenSpousePairs.add(pairKey);
      edges.push({ type: "spouse", from: person.id, to: spouseId });
    }
  }
  return edges;
}
