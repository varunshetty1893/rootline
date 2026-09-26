import { CARD_WIDTH, PERSON_PITCH, UNIT_GAP } from "./constants.js";

export function unitWidth(unit) {
  if (!unit || !unit.members?.length) return CARD_WIDTH;
  return Math.max(CARD_WIDTH, (unit.members.length - 1) * PERSON_PITCH + CARD_WIDTH);
}

export function placeRow(units, desired, current) {
  if (!units.length) return;

  const positions = units.map((unit) => desired.get(unit.id) ?? current.get(unit.id) ?? 0);
  const widths = units.map(unitWidth);

  // Push colliding blocks apart symmetrically. Keeping the correction
  // symmetric is important: two children of one couple remain centred under
  // that couple instead of drifting to the right.
  for (let pass = 0; pass < units.length * 3 + 3; pass += 1) {
    let changed = false;
    for (let i = 1; i < positions.length; i += 1) {
      const minDistance = (widths[i - 1] + widths[i]) / 2 + UNIT_GAP;
      const distance = positions[i] - positions[i - 1];
      if (distance < minDistance) {
        const correction = (minDistance - distance) / 2;
        positions[i - 1] -= correction;
        positions[i] += correction;
        changed = true;
      }
    }
    if (!changed) break;
  }

  const minLeft = Math.min(...positions.map((center, index) => center - widths[index] / 2));
  const shift = Math.max(24 - minLeft, 0);
  units.forEach((unit, index) => current.set(unit.id, positions[index] + shift));
}

export function layoutUnitCenters(units, generation, order) {
  const rows = new Map();
  for (const unit of units.values()) {
    if (!rows.has(generation.get(unit.id))) rows.set(generation.get(unit.id), []);
    rows.get(generation.get(unit.id)).push(unit);
  }
  for (const row of rows.values()) row.sort((a, b) => order.get(a.id) - order.get(b.id));

  const centers = new Map();
  for (const row of rows.values()) {
    let cursor = 24;
    for (const unit of row) {
      const width = unitWidth(unit);
      centers.set(unit.id, cursor + width / 2);
      cursor += width + UNIT_GAP;
    }
  }

  // Relax parent/child alignment without ever allowing cards to overlap.
  // Repeating from both directions handles a couple whose two partners have
  // parents on different sides, as well as sibling rows with different widths.
  const maxGeneration = Math.max(...rows.keys(), 0);
  for (let pass = 0; pass < 16; pass += 1) {
    for (let g = 0; g <= maxGeneration; g += 1) {
      const row = rows.get(g) || [];
      const desired = new Map();
      for (const unit of row) {
        const parentTargets = [];
        for (const member of unit.members) {
          const parentCenters = [...(unit.memberParents.get(member.id) || [])]
            .map((id) => centers.get(id))
            .filter((value) => Number.isFinite(value));
          if (!parentCenters.length) continue;
          const parentTarget = parentCenters.reduce((sum, value) => sum + value, 0) / parentCenters.length;
          const memberIndex = unit.members.findIndex((entry) => entry.id === member.id);
          const memberOffset = (memberIndex - (unit.members.length - 1) / 2) * PERSON_PITCH;
          parentTargets.push(parentTarget - memberOffset);
        }
        const childCenters = [...unit.childUnits]
          .map((id) => centers.get(id))
          .filter((value) => Number.isFinite(value));
        const neighbours = parentTargets.length ? parentTargets : childCenters;
        if (neighbours.length) {
          const target = neighbours.reduce((sum, value) => sum + value, 0) / neighbours.length;
          desired.set(unit.id, (centers.get(unit.id) + target * 3) / 4);
        }
      }
      row.sort((a, b) => (desired.get(a.id) ?? centers.get(a.id) ?? 0) - (desired.get(b.id) ?? centers.get(b.id) ?? 0));
      placeRow(row, desired, centers);
    }
    for (let g = maxGeneration; g >= 0; g -= 1) {
      const row = rows.get(g) || [];
      const desired = new Map();
      for (const unit of row) {
        const childTargets = [];
        for (const childId of unit.childUnits) {
          const child = units.get(childId);
          if (!child) continue;
          for (const member of child.members) {
            if (!child.memberParents.get(member.id)?.has(unit.id)) continue;
            const memberIndex = child.members.findIndex((entry) => entry.id === member.id);
            const memberOffset = (memberIndex - (child.members.length - 1) / 2) * PERSON_PITCH;
            const memberCenter = (centers.get(child.id) || 0) + memberOffset;
            childTargets.push(memberCenter);
          }
        }
        const childCenters = childTargets.length
          ? childTargets
          : [...unit.childUnits]
              .map((id) => centers.get(id))
              .filter((value) => Number.isFinite(value));
        if (childCenters.length) {
          const target = childCenters.reduce((sum, value) => sum + value, 0) / childCenters.length;
          desired.set(unit.id, (centers.get(unit.id) + target * 2) / 3);
        }
      }
      row.sort((a, b) => (desired.get(a.id) ?? centers.get(a.id) ?? 0) - (desired.get(b.id) ?? centers.get(b.id) ?? 0));
      placeRow(row, desired, centers);
    }
  }

  return { rows, centers };
}

export function makeRows(units, generation, order, centers) {
  const rowNumbers = [...new Set([...units.values()].map((unit) => generation.get(unit.id)))].sort((a, b) => a - b);
  return rowNumbers.map((generationNumber) => {
    const rowUnits = [...units.values()]
      .filter((unit) => generation.get(unit.id) === generationNumber)
      .sort((a, b) => centers.get(a.id) - centers.get(b.id) || order.get(a.id) - order.get(b.id));
    const people = [];
    for (const unit of rowUnits) {
      const center = centers.get(unit.id);

      if (unit.members.length === 2) {
        const [m1, m2] = unit.members;
        const p1Centers = [...(unit.memberParents.get(m1.id) || [])]
          .map((id) => centers.get(id))
          .filter(Number.isFinite);
        const p2Centers = [...(unit.memberParents.get(m2.id) || [])]
          .map((id) => centers.get(id))
          .filter(Number.isFinite);

        if (p1Centers.length && p2Centers.length) {
          const avg1 = p1Centers.reduce((s, v) => s + v, 0) / p1Centers.length;
          const avg2 = p2Centers.reduce((s, v) => s + v, 0) / p2Centers.length;
          unit.members = avg1 <= avg2 ? [m1, m2] : [m2, m1];
        } else if (p1Centers.length && !p2Centers.length) {
          const avg1 = p1Centers.reduce((s, v) => s + v, 0) / p1Centers.length;
          unit.members = avg1 <= center ? [m1, m2] : [m2, m1];
        } else if (!p1Centers.length && p2Centers.length) {
          const avg2 = p2Centers.reduce((s, v) => s + v, 0) / p2Centers.length;
          unit.members = avg2 <= center ? [m2, m1] : [m1, m2];
        }
      }

      const totalWidth = (unit.members.length - 1) * PERSON_PITCH;
      unit.members.forEach((person, index) => {
        people.push({
          person,
          slot: (center - totalWidth / 2) / PERSON_PITCH,
          x: center - totalWidth / 2 + index * PERSON_PITCH - CARD_WIDTH / 2,
          unitId: unit.id,
        });
      });
    }
    return {
      generation: generationNumber,
      people,
      componentIndex: 0,
      firstInComponent: false,
      label: "Family branch",
    };
  });
}
