export function assignGenerations(units) {
  const generation = new Map();
  const visiting = new Set();

  // Longest-path generation is stable when a child has one or two parents.
  // The cycle guard prevents malformed data from making the UI recurse
  // forever; malformed cycles are placed as close to their oldest reachable
  // generation as possible.
  const depthOf = (unitId) => {
    if (generation.has(unitId)) return generation.get(unitId);
    if (visiting.has(unitId)) return 0;
    visiting.add(unitId);
    const unit = units.get(unitId);
    const parents = [...(unit?.parentUnits || [])];
    const depth = parents.length ? Math.max(...parents.map((id) => depthOf(id) + 1)) : 0;
    visiting.delete(unitId);
    generation.set(unitId, depth);
    return depth;
  };

  for (const unitId of units.keys()) depthOf(unitId);

  // Bottom-up alignment:
  // When an in-law joins at generation G, their parents (if unconstrained by higher
  // ancestors) belong at generation G - 1, not pushed to the top generation 0.
  // Similarly, unattached siblings of that in-law belong in generation G.
  for (let pass = 0; pass < 5; pass += 1) {
    let changed = false;
    for (const unit of units.values()) {
      for (const childId of unit.childUnits) {
        const childGen = generation.get(childId);
        const requiredParentGen = childGen - 1;
        const currentGen = generation.get(unit.id);
        if (currentGen < requiredParentGen) {
          const parents = [...unit.parentUnits];
          const maxParentGen = parents.length ? Math.max(...parents.map((p) => generation.get(p))) : -1;
          if (maxParentGen < requiredParentGen) {
            generation.set(unit.id, requiredParentGen);
            changed = true;
          }
        }
      }
    }
    for (const unit of units.values()) {
      const parents = [...unit.parentUnits];
      if (parents.length) {
        const minChildGen = Math.max(...parents.map((p) => generation.get(p) + 1));
        if (generation.get(unit.id) < minChildGen) {
          generation.set(unit.id, minChildGen);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  return generation;
}
