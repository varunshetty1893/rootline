import { stableKey, validIds, unionFind } from "./constants.js";

export function fullChildrenMap(people) {
  const map = new Map();
  for (const person of people) {
    for (const parentId of person.parentIds || []) {
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId).push(person.id);
    }
  }
  return map;
}

export function parentGroupsFor(person, byId) {
  const groups = (person.parentFamilies || [])
    .map((family) => validIds(family.partner_ids, byId).sort())
    .filter((parents) => parents.length);
  if (groups.length) return groups;
  const fallback = validIds(person.parentIds, byId).sort();
  return fallback.length ? [fallback] : [];
}

export function descendantsOf(id, childrenMap, acc = new Set()) {
  for (const childId of childrenMap.get(id) || []) {
    if (acc.has(childId)) continue;
    acc.add(childId);
    descendantsOf(childId, childrenMap, acc);
  }
  return acc;
}

export function spouseMapFor(people, byId) {
  const spouseMap = new Map(people.map((person) => [person.id, new Set()]));
  const connect = (leftId, rightId) => {
    if (!byId.has(leftId) || !byId.has(rightId) || leftId === rightId) return;
    spouseMap.get(leftId)?.add(rightId);
    spouseMap.get(rightId)?.add(leftId);
  };

  for (const person of people) {
    for (const spouseId of validIds(person.spouseIds, byId)) connect(person.id, spouseId);
    for (const family of person.partnerFamilies || []) {
      const partners = validIds(family.partner_ids, byId);
      for (const partnerId of partners) connect(person.id, partnerId);
    }
  }
  return spouseMap;
}

export function buildUnits(people) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const indexById = new Map(people.map((person, index) => [person.id, index]));
  const uf = unionFind(people.map((person) => person.id));

  // Treat the relationship as undirected. Older records can contain only one
  // side of a spouse link, but the visual relationship is still a couple.
  for (const person of people) {
    for (const spouseId of validIds(person.spouseIds, byId)) uf.union(person.id, spouseId);
  }

  const membersByRoot = new Map();
  for (const person of people) {
    const root = uf.find(person.id);
    if (!membersByRoot.has(root)) membersByRoot.set(root, []);
    membersByRoot.get(root).push(person);
  }

  const units = new Map();
  const unitByPerson = new Map();
  for (const members of membersByRoot.values()) {
    members.sort((a, b) => stableKey(a, indexById).localeCompare(stableKey(b, indexById)));
    const id = members[0].id;
    units.set(id, {
      id,
      members,
      parentUnits: new Set(),
      childUnits: new Set(),
      memberParents: new Map(),
    });
    for (const person of members) unitByPerson.set(person.id, id);
  }

  for (const unit of units.values()) {
    for (const person of unit.members) {
      const parentUnits = new Set();
      for (const parentGroup of parentGroupsFor(person, byId)) {
        for (const parentId of parentGroup) {
          const parentUnitId = unitByPerson.get(parentId);
          if (!parentUnitId || parentUnitId === unit.id) continue;
          parentUnits.add(parentUnitId);
          units.get(parentUnitId).childUnits.add(unit.id);
          unit.parentUnits.add(parentUnitId);
        }
      }
      unit.memberParents.set(person.id, parentUnits);
    }
  }

  return { units, unitByPerson, byId, indexById };
}
