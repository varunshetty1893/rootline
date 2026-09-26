/**
 * Filters a list of people according to a genealogical branch mode around a focus person.
 *
 * @param {Array} allPeople - List of all family members
 * @param {string|null} focusId - The person ID to anchor the branch around
 * @param {"all"|"ancestors"|"descendants"|"paternal"|"maternal"} branchMode
 * @returns {Array} Filtered list of family members
 */
export function filterPeopleByBranch(allPeople, focusId, branchMode) {
  if (!focusId || !branchMode || branchMode === "all" || !allPeople.length) {
    return allPeople;
  }

  const byId = new Map(allPeople.map((p) => [p.id, p]));
  const focus = byId.get(focusId);
  if (!focus) return allPeople;

  const visible = new Set([focusId]);

  if (branchMode === "ancestors") {
    const queue = [...(focus.parentIds || [])];
    while (queue.length) {
      const pid = queue.shift();
      if (!visible.has(pid)) {
        visible.add(pid);
        const p = byId.get(pid);
        if (p) {
          for (const parentId of p.parentIds || []) {
            queue.push(parentId);
          }
        }
      }
    }
  } else if (branchMode === "descendants") {
    const queue = [focusId];
    while (queue.length) {
      const currId = queue.shift();
      const curr = byId.get(currId);
      if (curr) {
        for (const spId of curr.spouseIds || []) {
          visible.add(spId);
        }
      }
      for (const p of allPeople) {
        if ((p.parentIds || []).includes(currId) && !visible.has(p.id)) {
          visible.add(p.id);
          queue.push(p.id);
        }
      }
    }
  } else if (branchMode === "paternal") {
    // Find father
    const parents = (focus.parentIds || []).map((id) => byId.get(id)).filter(Boolean);
    const father = parents.find((p) => p.gender === "male") || parents[0];
    if (father) {
      visible.add(father.id);
      const queue = [father.id];
      while (queue.length) {
        const curId = queue.shift();
        const p = byId.get(curId);
        if (p) {
          // Ancestors of paternal line
          for (const parentId of p.parentIds || []) {
            if (!visible.has(parentId)) {
              visible.add(parentId);
              queue.push(parentId);
            }
          }
          // Spouses on paternal line
          for (const spId of p.spouseIds || []) {
            visible.add(spId);
          }
        }
      }
    }
  } else if (branchMode === "maternal") {
    // Find mother
    const parents = (focus.parentIds || []).map((id) => byId.get(id)).filter(Boolean);
    const mother = parents.find((p) => p.gender === "female") || parents[1];
    if (mother) {
      visible.add(mother.id);
      const queue = [mother.id];
      while (queue.length) {
        const curId = queue.shift();
        const p = byId.get(curId);
        if (p) {
          // Ancestors of maternal line
          for (const parentId of p.parentIds || []) {
            if (!visible.has(parentId)) {
              visible.add(parentId);
              queue.push(parentId);
            }
          }
          // Spouses on maternal line
          for (const spId of p.spouseIds || []) {
            visible.add(spId);
          }
        }
      }
    }
  }

  const result = allPeople.filter((p) => visible.has(p.id));
  return result.length > 0 ? result : allPeople;
}
