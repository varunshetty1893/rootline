import { describe, it, expect } from "vitest";
import { findRelationship, byIdMap } from "./relationship.js";

describe("Kinship pathfinding and relationship labels", () => {
  const people = [
    { id: "p-root", name: "Varun", gender: "male", parentIds: ["p-dad", "p-mom"], spouseIds: ["p-wife"] },
    { id: "p-dad", name: "Babu", gender: "male", parentIds: ["p-grandpa"], spouseIds: ["p-mom"] },
    { id: "p-mom", name: "Rajani", gender: "female", parentIds: [], spouseIds: ["p-dad"] },
    { id: "p-grandpa", name: "Ananda", gender: "male", parentIds: [], spouseIds: [] },
    { id: "p-sister", name: "Varsha", gender: "female", parentIds: ["p-dad", "p-mom"], spouseIds: [] },
    { id: "p-wife", name: "Wife", gender: "female", parentIds: [], spouseIds: ["p-root"] },
    { id: "p-uncle", name: "Vinod", gender: "male", parentIds: ["p-grandpa"], spouseIds: [] },
    { id: "p-cousin", name: "Cousin", gender: "male", parentIds: ["p-uncle"], spouseIds: [] },
    { id: "p-child", name: "Son", gender: "male", parentIds: ["p-root", "p-wife"], spouseIds: [] },
  ];

  it("identifies self", () => {
    const rel = findRelationship("p-root", "p-root", people);
    expect(rel).not.toBeNull();
    expect(rel.label).toBe("This is you");
    expect(rel.kind).toBe("self");
  });

  it("identifies parent", () => {
    const dadRel = findRelationship("p-root", "p-dad", people);
    expect(dadRel).not.toBeNull();
    expect(dadRel.label).toBe("father");

    const momRel = findRelationship("p-root", "p-mom", people);
    expect(momRel).not.toBeNull();
    expect(momRel.label).toBe("mother");
  });

  it("identifies grandparent", () => {
    const grandpaRel = findRelationship("p-root", "p-grandpa", people);
    expect(grandpaRel).not.toBeNull();
    expect(grandpaRel.label).toBe("grandfather");
  });

  it("identifies sibling", () => {
    const sisterRel = findRelationship("p-root", "p-sister", people);
    expect(sisterRel).not.toBeNull();
    expect(sisterRel.label).toBe("sister");
  });

  it("identifies child", () => {
    const childRel = findRelationship("p-root", "p-child", people);
    expect(childRel).not.toBeNull();
    expect(childRel.label).toBe("son");
  });

  it("identifies uncle and cousin", () => {
    const uncleRel = findRelationship("p-root", "p-uncle", people);
    expect(uncleRel).not.toBeNull();
    expect(uncleRel.label).toBe("uncle");

    const cousinRel = findRelationship("p-root", "p-cousin", people);
    expect(cousinRel).not.toBeNull();
    expect(cousinRel.label).toBe("first cousin");
  });

  it("identifies spouse", () => {
    const wifeRel = findRelationship("p-root", "p-wife", people);
    expect(wifeRel).not.toBeNull();
    expect(wifeRel.label).toBe("wife");
    expect(wifeRel.kind).toBe("spouse");
  });

  it("reuses byId Map correctly without errors", () => {
    const map = byIdMap(people);
    expect(map.size).toBe(9);
    expect(map.get("p-root").name).toBe("Varun");
  });
});
