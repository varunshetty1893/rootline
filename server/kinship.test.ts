import { describe, it, expect } from "vitest";
import { determineKinship } from "./kinship.js";

describe("Backend Kinship Deterministic Engine", () => {
  const people: any[] = [
    { id: "p-root", name: "Varun", gender: "male", parent_ids: ["p-dad", "p-mom"], spouse_ids: ["p-wife"] },
    { id: "p-dad", name: "Babu", gender: "male", parent_ids: ["p-grandpa"], spouse_ids: ["p-mom"] },
    { id: "p-mom", name: "Rajani", gender: "female", parent_ids: [], spouse_ids: ["p-dad"] },
    { id: "p-grandpa", name: "Ananda", gender: "male", parent_ids: [], spouse_ids: [] },
    { id: "p-sister", name: "Varsha", gender: "female", parent_ids: ["p-dad", "p-mom"], spouse_ids: [] },
    { id: "p-wife", name: "Wife", gender: "female", parent_ids: ["p-fil"], spouse_ids: ["p-root"] },
    { id: "p-fil", name: "FatherInLaw", gender: "male", parent_ids: [], spouse_ids: [] },
    { id: "p-uncle", name: "Vinod", gender: "male", parent_ids: ["p-grandpa"], spouse_ids: [] },
    { id: "p-cousin", name: "Cousin", gender: "male", parent_ids: ["p-uncle"], spouse_ids: [] },
    { id: "p-child", name: "Son", gender: "male", parent_ids: ["p-root", "p-wife"], spouse_ids: [] },
    { id: "p-unrelated", name: "Stranger", gender: "other", parent_ids: [], spouse_ids: [] },
  ];

  it("identifies self", () => {
    const res = determineKinship("p-root", "p-root", people);
    expect(res).not.toBeNull();
    expect(res?.title).toBe("Same Person");
    expect(res?.generationDiff).toBe(0);
  });

  it("identifies father and mother", () => {
    const dad = determineKinship("p-root", "p-dad", people);
    expect(dad?.title).toBe("Father");
    expect(dad?.generationDiff).toBe(-1);

    const mom = determineKinship("p-root", "p-mom", people);
    expect(mom?.title).toBe("Mother");
  });

  it("identifies grandfather", () => {
    const grandpa = determineKinship("p-root", "p-grandpa", people);
    expect(grandpa?.title).toBe("Grandfather");
    expect(grandpa?.generationDiff).toBe(-2);
  });

  it("identifies sister", () => {
    const sister = determineKinship("p-root", "p-sister", people);
    expect(sister?.title).toBe("Sister");
    expect(sister?.generationDiff).toBe(0);
  });

  it("identifies son", () => {
    const son = determineKinship("p-root", "p-child", people);
    expect(son?.title).toBe("Son");
    expect(son?.generationDiff).toBe(1);
  });

  it("identifies spouse / wife", () => {
    const wife = determineKinship("p-root", "p-wife", people);
    expect(wife?.title).toBe("Wife");
  });

  it("identifies uncle and cousin", () => {
    const uncle = determineKinship("p-root", "p-uncle", people);
    expect(uncle?.title).toBe("Uncle");

    const cousin = determineKinship("p-root", "p-cousin", people);
    expect(cousin?.title).toBe("First cousin");
  });

  it("identifies father-in-law", () => {
    const fil = determineKinship("p-root", "p-fil", people);
    expect(fil?.title).toBe("Father-in-law");
  });

  it("returns null for unrelated individuals", () => {
    const unrel = determineKinship("p-root", "p-unrelated", people);
    expect(unrel).toBeNull();
  });
});
