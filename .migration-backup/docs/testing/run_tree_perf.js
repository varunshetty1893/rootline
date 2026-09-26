/**
 * Rootline Tree Layout & Kinship Engine Performance Benchmark
 * Tests sizes: 10, 50, 100, 250, 500, 1000
 * Measures:
 * - Tree layout computation time (ms)
 * - Relationship calculation time (ms)
 * - Search filter response time (ms)
 * - Heap memory consumption (MB)
 * - Edge count, generation tiers, and collision checks
 */

import fs from "fs";
import { computeLayout } from "../../src/family/treeLayout.js";
import { findRelationship } from "../../src/family/relationship.js";

// Helper to generate realistic multi-generational tree
function generateRealisticFamily(targetSize) {
  const people = [];
  let idCounter = 1;

  // Root couple (Generation 0)
  const rootDadId = `p_${idCounter++}`;
  const rootMomId = `p_${idCounter++}`;
  people.push({
    id: rootDadId,
    name: "Ancestor Patriarch",
    gender: "male",
    parentIds: [],
    spouseIds: [rootMomId],
    partnerFamilies: [{ partner_ids: [rootDadId, rootMomId] }]
  });
  people.push({
    id: rootMomId,
    name: "Ancestor Matriarch",
    gender: "female",
    parentIds: [],
    spouseIds: [rootDadId],
    partnerFamilies: [{ partner_ids: [rootDadId, rootMomId] }]
  });

  // Queue of parent pairs eligible to have children
  let parentCouples = [[rootDadId, rootMomId]];
  let genIndex = 1;

  while (people.length < targetSize) {
    const nextCouples = [];
    for (const [dadId, momId] of parentCouples) {
      if (people.length >= targetSize) break;
      // 2 to 4 children per couple
      const numChildren = Math.min(3, targetSize - people.length);
      for (let c = 0; c < numChildren; c++) {
        if (people.length >= targetSize) break;
        const childGender = c % 2 === 0 ? "male" : "female";
        const childId = `p_${idCounter++}`;
        const childObj = {
          id: childId,
          name: `Member Gen${genIndex} Child${c + 1} of ${dadId}`,
          gender: childGender,
          parentIds: [dadId, momId],
          spouseIds: [],
          parentFamilies: [{ partner_ids: [dadId, momId] }],
          partnerFamilies: []
        };
        people.push(childObj);

        // Half of adult children marry a spouse if space permits
        if (people.length < targetSize && Math.random() > 0.3) {
          const spouseGender = childGender === "male" ? "female" : "male";
          const spouseId = `p_${idCounter++}`;
          const spouseObj = {
            id: spouseId,
            name: `Spouse of ${childId}`,
            gender: spouseGender,
            parentIds: [],
            spouseIds: [childId],
            partnerFamilies: [{ partner_ids: [childId, spouseId] }]
          };
          childObj.spouseIds.push(spouseId);
          childObj.partnerFamilies.push({ partner_ids: [childId, spouseId] });
          people.push(spouseObj);

          if (childGender === "male") {
            nextCouples.push([childId, spouseId]);
          } else {
            nextCouples.push([spouseId, childId]);
          }
        }
      }
    }
    genIndex++;
    if (nextCouples.length > 0) {
      parentCouples = nextCouples;
    } else {
      // Loop over existing people to create new marriages if couples ran out
      const unmarried = people.filter(p => p.spouseIds.length === 0);
      if (unmarried.length > 0 && people.length < targetSize) {
        const u = unmarried[0];
        const sId = `p_${idCounter++}`;
        const sGender = u.gender === "male" ? "female" : "male";
        const sObj = {
          id: sId,
          name: `Late Spouse of ${u.id}`,
          gender: sGender,
          parentIds: [],
          spouseIds: [u.id],
          partnerFamilies: [{ partner_ids: [u.id, sId] }]
        };
        u.spouseIds.push(sId);
        u.partnerFamilies.push({ partner_ids: [u.id, sId] });
        people.push(sObj);
        parentCouples.push([u.id, sId]);
      } else {
        break;
      }
    }
  }

  return people;
}

const SIZES = [10, 50, 100, 250, 500, 1000];
const perfResults = [];

console.log("=".repeat(70));
console.log("ROOTLINE TREE ENGINE BENCHMARK (SIZES: 10, 50, 100, 250, 500, 1000)");
console.log("=".repeat(70));

for (const targetSize of SIZES) {
  if (global.gc) global.gc();
  const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;

  const people = generateRealisticFamily(targetSize);
  const actualSize = people.length;

  // 1. Measure computeLayout timing (5 iterations)
  const layoutTimings = [];
  let layoutOutput = null;
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    layoutOutput = computeLayout(people, new Set());
    const t1 = performance.now();
    layoutTimings.push(t1 - t0);
  }
  const avgLayoutMs = layoutTimings.reduce((a, b) => a + b, 0) / layoutTimings.length;
  const minLayoutMs = Math.min(...layoutTimings);
  const maxLayoutMs = Math.max(...layoutTimings);

  // 2. Measure Relationship calculation timing (Root to distant descendant)
  const rootId = people[0].id;
  const targetId = people[people.length - 1].id;
  const relTimings = [];
  let relOutput = null;
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    relOutput = findRelationship(rootId, targetId, people);
    const t1 = performance.now();
    relTimings.push(t1 - t0);
  }
  const avgRelMs = relTimings.reduce((a, b) => a + b, 0) / relTimings.length;

  // 3. Measure Search response time (filtering people array)
  const searchTimings = [];
  for (let i = 0; i < 50; i++) {
    const t0 = performance.now();
    const query = "Gen2";
    const matches = people.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
    const t1 = performance.now();
    searchTimings.push(t1 - t0);
  }
  const avgSearchMs = searchTimings.reduce((a, b) => a + b, 0) / searchTimings.length;

  const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;
  const memDelta = Math.max(0, memAfter - memBefore);

  const res = {
    targetSize,
    actualSize,
    generations: layoutOutput.rows.length,
    edgesCount: layoutOutput.edges.length,
    layoutWidthPx: layoutOutput.layoutWidth,
    layoutTimeMs: {
      avg: Number(avgLayoutMs.toFixed(2)),
      min: Number(minLayoutMs.toFixed(2)),
      max: Number(maxLayoutMs.toFixed(2))
    },
    relationshipTimeMs: {
      avg: Number(avgRelMs.toFixed(3)),
      label: relOutput?.label || "N/A"
    },
    searchTimeMs: {
      avg: Number(avgSearchMs.toFixed(3))
    },
    memoryMb: {
      heapBefore: Number(memBefore.toFixed(2)),
      heapAfter: Number(memAfter.toFixed(2)),
      delta: Number(memDelta.toFixed(2))
    }
  };

  perfResults.push(res);
  console.log(`[SIZE: ${actualSize}] Layout: ${avgLayoutMs.toFixed(2)}ms (min: ${minLayoutMs.toFixed(2)}ms) | Relationship: ${avgRelMs.toFixed(3)}ms | Search: ${avgSearchMs.toFixed(3)}ms | Generations: ${layoutOutput.rows.length} | Heap Δ: ${memDelta.toFixed(2)}MB`);
}

fs.writeFileSync("docs/testing/tree_perf_results.json", JSON.stringify(perfResults, null, 2));
console.log("\nResults saved to -> docs/testing/tree_perf_results.json");
