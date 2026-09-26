export const CARD_WIDTH = 136;
export const PERSON_PITCH = 160;
export const UNIT_GAP = 48;

export function stableKey(person, indexById) {
  const created = person.created_at || person.createdAt || "";
  return `${created}|${person.name || ""}|${indexById.get(person.id) ?? 0}|${person.id}`;
}

export function validIds(ids, byId) {
  return [...new Set((ids || []).filter((id) => byId.has(id) && id))];
}

export function unionFind(ids) {
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (id) => {
    let current = id;
    while (parent.get(current) !== current) {
      parent.set(current, parent.get(parent.get(current)));
      current = parent.get(current);
    }
    return current;
  };
  const union = (a, b) => {
    const left = find(a);
    const right = find(b);
    if (left !== right) parent.set(right, left);
  };
  return { find, union };
}
