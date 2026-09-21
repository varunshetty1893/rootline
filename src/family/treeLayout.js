/*
 * Layered family-tree layout engine.
 *
 * Modular architecture:
 * - layout/constants.js: Spacing constants and disjoint-set union-find
 * - layout/units.js: Contracting partner groups into family units
 * - layout/generations.js: Longest-path generation alignment
 * - layout/ordering.js: Barycentric order and branch traversal
 * - layout/spacing.js: Symmetric collision resolution and coordinate assignments
 * - layout/edges.js: Family-child and spouse connector edges
 * - layout/collapse.js: Heuristic peripheral branch collapse and ancestor walk
 */

import { CARD_WIDTH, PERSON_PITCH } from "./layout/constants.js";
import { fullChildrenMap, parentGroupsFor, descendantsOf, spouseMapFor, buildUnits } from "./layout/units.js";
import { assignGenerations } from "./layout/generations.js";
import { orderUnits } from "./layout/ordering.js";
import { layoutUnitCenters, makeRows } from "./layout/spacing.js";
import { makeEdges } from "./layout/edges.js";
import { recommendedCollapsedFamilyKeys, ancestorsOf } from "./layout/collapse.js";

export { fullChildrenMap, recommendedCollapsedFamilyKeys, ancestorsOf };

export function computeLayout(allPeople, collapsedFamilyKeys = new Set(), rootPersonId = null) {
  if (!allPeople.length) {
    return { rows: [], edges: [], childrenCount: new Map(), layoutColumns: 1, layoutWidth: 760 };
  }

  const childrenMapFull = fullChildrenMap(allPeople);
  const childrenCount = new Map(
    allPeople.map((person) => [person.id, (childrenMapFull.get(person.id) || []).length])
  );
  const hidden = new Set();
  const allById = new Map(allPeople.map((person) => [person.id, person]));
  const familyChildren = new Map();
  for (const person of allPeople) {
    for (const parents of parentGroupsFor(person, allById)) {
      const key = parents.join("|");
      if (!familyChildren.has(key)) familyChildren.set(key, []);
      familyChildren.get(key).push(person.id);
    }
  }

  const spouseMap = spouseMapFor(allPeople, allById);

  // A person who is directly collapsed should NOT be hidden if they are married
  // to a spouse whose parents' branch is NOT collapsed (i.e. an in-law marrying
  // into an active, visible branch).
  const isProtectedSpouse = (personId) => {
    for (const spouseId of spouseMap.get(personId) || []) {
      const spouse = allById.get(spouseId);
      if (!spouse) continue;
      const spouseParentFamilies = parentGroupsFor(spouse, allById);
      if (!spouseParentFamilies.length) {
        continue;
      }
      const spouseHasUncollapsedParentFamily = spouseParentFamilies.some(
        (parents) => !collapsedFamilyKeys.has(parents.join("|"))
      );
      if (spouseHasUncollapsedParentFamily) return true;
    }
    return false;
  };

  for (const familyKey of collapsedFamilyKeys) {
    for (const childId of familyChildren.get(familyKey) || []) {
      if (isProtectedSpouse(childId)) continue;
      hidden.add(childId);
      for (const sId of spouseMap.get(childId) || []) {
        const spouse = allById.get(sId);
        if (spouse && parentGroupsFor(spouse, allById).length === 0) {
          hidden.add(sId);
        }
      }
      descendantsOf(childId, childrenMapFull).forEach((descendantId) => {
        const descendant = allById.get(descendantId);
        const otherParentVisible = (descendant?.parentIds || []).some(
          (pId) => pId !== childId && !hidden.has(pId) && allById.has(pId)
        );
        if (!otherParentVisible) {
          hidden.add(descendantId);
          for (const sId of spouseMap.get(descendantId) || []) {
            const spouse = allById.get(sId);
            if (spouse && parentGroupsFor(spouse, allById).length === 0) {
              hidden.add(sId);
            }
          }
        }
      });
    }
  }

  // Second pass: ensure no person who has an uncollapsed parent family or
  // is a spouse of a visible person with lineage remains hidden.
  let changed = true;
  while (changed) {
    changed = false;
    for (const hiddenId of [...hidden]) {
      const person = allById.get(hiddenId);
      const parentFamilies = parentGroupsFor(person, allById);
      const hasUncollapsedFamily = parentFamilies.some(
        (parents) => !collapsedFamilyKeys.has(parents.join("|")) && parents.some((pId) => !hidden.has(pId))
      );
      if (hasUncollapsedFamily) {
        hidden.delete(hiddenId);
        changed = true;
        continue;
      }
      const hasVisibleSpouse = [...(spouseMap.get(hiddenId) || [])].some(
        (spouseId) => !hidden.has(spouseId) && allById.has(spouseId)
      );
      if (hasVisibleSpouse) {
        const visibleSpouses = [...(spouseMap.get(hiddenId) || [])].filter(
          (sId) => !hidden.has(sId) && allById.has(sId)
        );
        const spouseWithLineage = visibleSpouses.some(
          (sId) => parentGroupsFor(allById.get(sId), allById).length > 0 || (childrenMapFull.get(sId) || []).some((c) => !hidden.has(c))
        );
        if (spouseWithLineage) {
          hidden.delete(hiddenId);
          changed = true;
        }
      }
    }
  }

  // Third pass: if an in-law couple has NO parents in the tree, and ALL of their
  // children in allPeople are hidden, hide the in-law parents too so they don't
  // float as disconnected orphan cards at the top row.
  for (const person of allPeople) {
    if (hidden.has(person.id)) continue;
    const parentFamilies = parentGroupsFor(person, allById);
    if (parentFamilies.length === 0) {
      const children = childrenMapFull.get(person.id) || [];
      if (children.length > 0 && children.every((cId) => hidden.has(cId))) {
        const spouses = [...(spouseMap.get(person.id) || [])];
        const hasVisibleSpouseWithLineage = spouses.some(
          (sId) => !hidden.has(sId) && (parentGroupsFor(allById.get(sId), allById).length > 0 || (childrenMapFull.get(sId) || []).some((c) => !hidden.has(c)))
        );
        if (!hasVisibleSpouseWithLineage) {
          hidden.add(person.id);
        }
      }
    }
  }

  // Safety protection: if everything would be hidden or if rootPersonId is hidden,
  // ensure the tree never collapses into an empty/invisible void.
  if (hidden.size >= allPeople.length) {
    hidden.clear();
  } else if (rootPersonId && hidden.has(rootPersonId)) {
    // If "Me" was caught in a collapsed branch, restore "Me" and their direct path
    hidden.delete(rootPersonId);
    let curr = allById.get(rootPersonId);
    while (curr && (curr.parentIds || []).length > 0) {
      for (const pId of curr.parentIds) {
        hidden.delete(pId);
      }
      curr = allById.get(curr.parentIds[0]);
    }
  }

  const people = hidden.size ? allPeople.filter((person) => !hidden.has(person.id)) : allPeople;
  if (!people.length) return { rows: [], edges: [], childrenCount, layoutColumns: 1, layoutWidth: 760 };

  const { units, byId, indexById } = buildUnits(people);
  const generation = assignGenerations(units);
  const order = orderUnits(units, generation, indexById);
  const { rows, centers } = layoutUnitCenters(units, generation, order);
  const positionedRows = makeRows(units, generation, order, centers);
  const maxRight = Math.max(
    760,
    ...positionedRows.flatMap((row) => row.people.map((entry) => entry.x + CARD_WIDTH))
  );

  const personGeneration = new Map();
  for (const unit of units.values()) {
    for (const person of unit.members) personGeneration.set(person.id, generation.get(unit.id));
  }

  return {
    rows: positionedRows,
    edges: makeEdges(people, byId),
    generation: personGeneration,
    childrenCount,
    layoutColumns: Math.ceil(maxRight / PERSON_PITCH),
    layoutWidth: maxRight + 24,
  };
}
