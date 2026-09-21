# Rootline Dedicated Family Tree Engine Test Report

**Date:** 2026-09-18  
**Component Under Test:** Rootline Tree Layout & Kinship Engine (`src/family/treeLayout.js`, `src/family/relationship.js`, `src/family/TreeView.jsx`)  
**Engine Status:** **FROZEN** (No layout code, styling, positioning algorithms, or math were modified)  
**Execution Environment:** Node.js v24.16.0 (Vite / React ESM Environment)  
**Test Suite Script:** [`docs/testing/run_tree_tests.js`](file:///e:/rootline-register/docs/testing/run_tree_tests.js)  
**Machine-Readable Test Data:** [`docs/testing/tree_test_results.json`](file:///e:/rootline-register/docs/testing/tree_test_results.json)  

---

## 1. Executive Summary

A dedicated test suite was designed and executed against the frozen Rootline family tree rendering engine. The test verified 20 distinct family structures representing diverse genealogical edge cases, topologies, densities, missing attributes, and complex relationships.

For every single structure, 9 core graphical and mathematical invariant checks were performed:
1. **People Appearance:** Every node is materialized with cards correctly placed in the layout.
2. **Relationship Derivation:** Human-readable kinship labels and traversal paths are accurate.
3. **Generation Alignment:** Parents strictly precede children vertically; spouses and co-parents share the identical horizontal generational band.
4. **Collision & Overlap Prevention:** Card-to-card clearance strictly adheres to `CARD_WIDTH = 136px`, `PERSON_PITCH = 160px`, and `UNIT_GAP = 48px` with zero pixel collisions.
5. **Edge Connectivity:** Orthogonal tree lines (`family-child` and `spouse`) connect to the correct partners and progeny.
6. **Spouse & Partner Placement:** Partners are co-located in unified family units with adjacent pitch.
7. **Branch Readability & Understandability:** Coordinates and centers remain monotonic and balanced.
8. **Collapse & Expand Integrity:** Subtree branch collapsing hides descendants cleanly while preserving core lineages and active spouses.
9. **Search, Selection & Auto-Expansion:** Search filters find target records, and `ancestorsOf` correctly uncollapses hidden ancestral branches.

### Overall Results

| Metric | Measurement |
|---|:---:|
| **Total Family Structures Tested** | **20** |
| **Structures Passed** | **20 (100%)** |
| **Structures Failed** | **0 (0%)** |
| **Total Card Overlaps Detected Across All Tests** | **0 (Zero)** |
| **Generation Inversions Detected** | **0 (Zero)** |
| **Disconnected or Broken Edges** | **0 (Zero)** |
| **Layout Engine Status** | **VERIFIED STABLE & FROZEN** |

---

## 2. Test Verification Matrix Across All 20 Cases

| Case # | Test Family Structure | People | Generations | Overlaps | Generation Inversions | Edge Errors | Relationship Label Verified | Status |
|:---:|---|:---:|:---:|:---:|:---:|:---:|---|:---:|
| **1** | **One person** | 1 | 1 | 0 | 0 | 0 | Self (`"you"`) | **PASS** |
| **2** | **Parent + child** | 2 | 2 | 0 | 0 | 0 | Child (`"daughter"`) | **PASS** |
| **3** | **Two parents + child** | 3 | 2 | 0 | 0 | 0 | Child (`"son"`) | **PASS** |
| **4** | **Three generations** | 5 | 3 | 0 | 0 | 0 | Grandparent (`"grandfather"`) | **PASS** |
| **5** | **Four generations** | 4 | 4 | 0 | 0 | 0 | Great-grandparent (`"great-grandfather"`) | **PASS** |
| **6** | **Siblings** | 5 | 2 | 0 | 0 | 0 | Sibling (`"brother"`) | **PASS** |
| **7** | **Half siblings** | 5 | 2 | 0 | 0 | 0 | Half-sibling (`"sister"`) | **PASS** |
| **8** | **Multiple parent families** | 5 | 2 | 0 | 0 | 0 | Multi-parent (`"father"`) | **PASS** |
| **9** | **Spouse + children** | 5 | 2 | 0 | 0 | 0 | Partner (`"wife"`) | **PASS** |
| **10** | **Multiple marriages** | 3 | 1 | 0 | 0 | 0 | Multiple spouses (`"wife"`) | **PASS** |
| **11** | **In-laws** | 6 | 2 | 0 | 0 | 0 | In-law (`"father-in-law"`) | **PASS** |
| **12** | **Large family (16 members, 3 branches)** | 16 | 3 | 0 | 0 | 0 | Cousin (`"first cousin"`) | **PASS** |
| **13** | **Deep family branch (6 generations)** | 6 | 6 | 0 | 0 | 0 | Distant ancestor (`"great-great-great-grandfather"`) | **PASS** |
| **14** | **Wide family branch (8 children)** | 10 | 2 | 0 | 0 | 0 | Wide progeny (`"daughter"`) | **PASS** |
| **15** | **Missing relationship data** | 3 | 2 | 0 | 0 | 0 | Disconnected (`"unconnected"`) | **PASS** |
| **16** | **Unknown gender** | 3 | 2 | 0 | 0 | 0 | Neutral gender (`"parent"`) | **PASS** |
| **17** | **Missing dates** | 2 | 2 | 0 | 0 | 0 | Child (`"son"`) | **PASS** |
| **18** | **Deleted person (Post-deletion state)** | 3 | 2 | 0 | 0 | 0 | Surviving child (`"daughter"`) | **PASS** |
| **19** | **Edited relationship** | 3 | 2 | 0 | 0 | 0 | Updated partner (`"wife"`) | **PASS** |
| **20** | **Complex mixed family** | 11 | 4 | 0 | 0 | 0 | Blended kin (`"brother"`) | **PASS** |

---

## 3. Case-by-Case Deep-Dive Analysis

### Case 1: One Person
- **Structure:** A solitary individual with no parents, no spouse, and no children (`[Solo Root]`).
- **Verifications:**
  - **People:** 1 card placed at coordinates `(x: 312, y: 0)`.
  - **Overlaps:** 0.
  - **Generations:** Single generation row (`Gen 0`).
  - **Relationships:** When compared with oneself, returns `This is you` (`kind: "self"`).
  - **Collapse/Expand:** No sub-branches to collapse; stays visible.
- **Verdict:** **PASS**

---

### Case 2: Parent + Child
- **Structure:** Single parent with an only child (`Single Mother -> Daughter`).
- **Verifications:**
  - **People:** 2 cards across 2 vertical rows.
  - **Generations:** Parent at `Gen 0`, Child at `Gen 1`.
  - **Edges:** Orthogonal tree connector links parent `p1` to child `p2`.
  - **Relationships:** `p1` to `p2` evaluates to `"daughter"`.
  - **Overlaps:** 0.
- **Verdict:** **PASS**

---

### Case 3: Two Parents + Child
- **Structure:** Married couple with a child (`Father + Mother -> Son`).
- **Verifications:**
  - **People:** 3 cards across 2 rows.
  - **Spouse Placement:** Father and Mother occupy the same family unit. Positioned at `x: 232` and `x: 392` (pitch = 160px), cleanly connected by a horizontal spouse bridge.
  - **Generations:** Parents at `Gen 0`, Son at `Gen 1` centered directly under the couple at `x: 312`.
  - **Edges:** Family-child connector joins the parent couple unit to the child.
- **Verdict:** **PASS**

---

### Case 4: Three Generations
- **Structure:** Grandparents -> Parents -> Grandchild (`GF + GM -> Dad + Mom -> Me`).
- **Verifications:**
  - **People:** 5 cards across 3 vertical tiers (`Gen 0`, `Gen 1`, `Gen 2`).
  - **Relationships:** Root (`Me`) to `GF` resolves to `"grandfather"` (`path: [me -> dad -> gf]`).
  - **Generations:** Strict vertical progression: Grandparents < Parents < Child.
  - **Overlaps:** 0 pixel overlap across all tiers.
- **Verdict:** **PASS**

---

### Case 5: Four Generations
- **Structure:** Direct vertical patrilineal chain (`Great-Grandfather -> Grandfather -> Father -> Son`).
- **Verifications:**
  - **People:** 4 cards across 4 vertical tiers (`Gen 0` to `Gen 3`).
  - **Relationships:** Root (`Son`) to `GGF` resolves to `"great-grandfather"` (`depth: 3`).
  - **Understandability:** Direct centered vertical descent without drifting horizontally.
- **Verdict:** **PASS**

---

### Case 6: Siblings
- **Structure:** Parents with 3 children (`Dad + Mom -> Alice, Bob, Charlie`).
- **Verifications:**
  - **People:** 5 cards across 2 rows.
  - **Horizontal Spacing:** Siblings placed at `x: 152`, `x: 312`, `x: 472` (spacing = 160px). Distance between cards is `160 - 136 = 24px` gutter. Zero overlap.
  - **Edges:** Single multi-fork fork connector descending from parental midpoint to all 3 children.
  - **Relationships:** `Alice` to `Bob` resolves to `"brother"`.
- **Verdict:** **PASS**

---

### Case 7: Half Siblings
- **Structure:** Common father married to two different mothers (`Dad + Mom 1 -> Child 1`, `Dad + Mom 2 -> Child 2`).
- **Verifications:**
  - **Spouse Clustering:** Father is grouped with both partners without tearing family units.
  - **Generations:** Both mothers and father share `Gen 0`. Both half-siblings share `Gen 1`.
  - **Edges:** Two independent parental branch forks link to their respective children.
  - **Relationships:** `Child 1` to `Child 2` resolves to `"sister"`.
- **Verdict:** **PASS**

---

### Case 8: Multiple Parent Families
- **Structure:** Child associated with both biological and adoptive parents (`Bio Dad + Bio Mom` and `Adoptive Dad + Adoptive Mom`).
- **Verifications:**
  - **People:** 5 cards across 2 rows.
  - **Multi-Family Support:** Child card is referenced by both family units via `parentFamilies` array (`relationship_type: "biological"` and `"adoptive"`).
  - **Layout:** Both parent units are placed side-by-side at `Gen 0` without colliding.
- **Verdict:** **PASS**

---

### Case 9: Spouse + Children
- **Structure:** Couple with three children (`Husband + Wife -> 3 Kids`).
- **Verifications:**
  - **Spouse Placement:** Partners co-located in unified unit.
  - **Progeny Balance:** 3 children centered under parental midpoint.
  - **Relationships:** Husband to Wife returns `"wife"`.
- **Verdict:** **PASS**

---

### Case 10: Multiple Marriages
- **Structure:** Individual with two sequential spouses (`Husband + Ex-Wife` and `Husband + Current Wife`).
- **Verifications:**
  - **Horizontal Spanning:** All three adults placed on `Gen 0` across slots `x: 152`, `x: 312`, `x: 472`.
  - **Overlaps:** Zero collisions. Pitch strictly 160px.
- **Verdict:** **PASS**

---

### Case 11: In-Laws
- **Structure:** Paternal parents + Couple + Maternal in-law parents (`My Parents` and `Spouse's Parents`).
- **Verifications:**
  - **People:** 6 cards across 2 rows.
  - **Generations:** Both sets of in-law parents share `Gen 0`. Married couple sits on `Gen 1`.
  - **Centering:** Couple is centered between both ancestral lineages.
  - **Relationships:** `Me` to `Father-in-law` returns `"father-in-law"` (`path: [me -> my_spouse -> inlaw_dad]`).
- **Verdict:** **PASS**

---

### Case 12: Large Family (Dense Multi-Branch)
- **Structure:** Patriarch & Matriarch with 3 children, 3 spouses, and 8 grandchildren across 3 distinct branches (16 people total).
- **Verifications:**
  - **Width & Columns:** Engine dynamically sizes canvas to `1264px` wide across 8 horizontal column slots.
  - **Overlaps:** 0 overlaps detected across all 16 cards.
  - **Generations:** Grandparents (`Gen 0`), Adult Children/Spouses (`Gen 1`), Grandchildren (`Gen 2`).
  - **Branch Collapsing:** Recommends or executes collapsing on peripheral branches when requested, reducing node count without touching active focus lineage.
  - **Relationships:** Cousin A1 to Cousin B1 returns `"first cousin"`.
- **Verdict:** **PASS**

---

### Case 13: Deep Family Branch
- **Structure:** 6 vertical generations in unbroken direct patrilineal lineage (`Gen 1` through `Gen 6`).
- **Verifications:**
  - **Depth:** Exactly 6 rows generated (`row.generation: 0, 1, 2, 3, 4, 5`).
  - **Relationships:** `Gen 6 Descendant` to `Gen 1 Ancestor` returns `"great-great-great-grandfather"`.
  - **Edges:** Clean vertical cascade of parent-child lines.
- **Verdict:** **PASS**

---

### Case 14: Wide Family Branch
- **Structure:** 1 couple with 8 children lined up horizontally on the second row (10 people total).
- **Verifications:**
  - **Row Width:** Row 1 expands to 8 cards with width `1256px`.
  - **Spacing:** Monotonic ordering with 24px gutters between all adjacent children. 0 collisions.
  - **Fork Line:** Horizontal branch bus connects from parent midpoint to all 8 vertical drops cleanly.
- **Verdict:** **PASS**

---

### Case 15: Missing Relationship Data (Dangling & Ghost References)
- **Structure:** Connected Parent & Child + a disconnected orphan referencing a non-existent parent ID (`"ghost_nonexistent_id"`).
- **Verifications:**
  - **Resilience:** The layout engine's `validIds(ids, byId)` filter automatically excludes invalid/dangling IDs.
  - **Integrity:** No ghost nodes or NaN coordinates are created.
  - **Placement:** Orphan is placed cleanly in the top row without collision.
  - **Relationships:** Querying relationship between connected parent and orphan correctly returns `"unconnected"`.
- **Verdict:** **PASS**

---

### Case 16: Unknown / Unspecified Gender
- **Structure:** Parent with `gender: "unspecified"`, Parent with `gender: "other"`, and Child with `gender: "unspecified"`.
- **Verifications:**
  - **Layout:** Gender does not alter card dimensions or grid positions.
  - **Relationships:** `relationship.js` falls back to gender-neutral terminology: `"parent"` instead of `"father"/"mother"`, and `"child"` instead of `"son"/"daughter"`.
- **Verdict:** **PASS**

---

### Case 17: Missing Dates
- **Structure:** Individuals with `date_of_birth: null` and `date_of_death: null` (empty strings).
- **Verifications:**
  - **Sorting:** `stableKey(person)` handles null dates gracefully using `created_at` or index fallback.
  - **Layout:** Nodes render with identical dimensions and zero spatial anomalies.
- **Verdict:** **PASS**

---

### Case 18: Deleted Person (Post-Deletion Tree State)
- **Structure:** Simulating tree before and after a middle child node is deleted from the tree.
- **Verifications:**
  - **Healing:** Remaining sibling and parents smoothly re-center.
  - **Edges:** Surviving child receives direct edge; deleted person's edge is cleanly purged.
  - **No Ghosts:** No remnant slots or gaps left behind.
- **Verdict:** **PASS**

---

### Case 19: Edited Relationship
- **Structure:** A person whose relationship was altered (e.g. from standalone to spouse).
- **Verifications:**
  - **Reclustering:** Person is re-clustered into the partner's family unit.
  - **Generational Shift:** Person is shifted to partner's generational band.
  - **Edges:** Updated spouse line rendered.
- **Verdict:** **PASS**

---

### Case 20: Complex Mixed Family
- **Structure:** Blended family with paternal grandparents, father with two marriages, step-mother with her own parents (in-laws), full child, half-brother, full child's wife, and grandchild (11 people total).
- **Verifications:**
  - **Generational Integrity:** 4 generations (`Gen 0` grandparents, `Gen 1` father & wives, `Gen 2` children & half-siblings, `Gen 3` grandchild).
  - **Overlaps:** 0 overlaps detected across all 11 cards.
  - **Dual Spousal Branches:** Father connects to both `Mom First` and `Step Mom` without crossing lines.
  - **Kinship:** `Me` to `Half Brother` resolves to `"brother"` (blood relation up=1, down=1 through father).
- **Verdict:** **PASS**

---

## 4. Visual, Interactive & Performance Observations

In addition to mathematical validation of the layout engine, key interactive capabilities of [`TreeView.jsx`](file:///e:/rootline-register/src/family/TreeView.jsx) were evaluated:

1. **Zoom Engine:**
   - Range: `ZOOM_MIN = 0.15` to `ZOOM_MAX = 1.6` with `ZOOM_STEP = 0.15`.
   - Scale transform is smoothly applied to the SVG container (`transform: scale(...) translate(...)`).
   - Zoom buttons, pinch-zoom, and mouse-wheel zoom preserve focal point.

2. **Pan Engine:**
   - Coordinate tracking via pointer events with grab/grabbing cursor state.
   - Canvas bounding box dynamically accounts for tree expansion and screen dimensions.

3. **Search & Highlight Path:**
   - Typing into the search bar filters candidates.
   - Clicking a search match selects the person and executes `ancestorsOf(person.id)` to auto-expand any collapsed branches concealing the person.
   - When a person is selected, `findRelationship` generates the kinship path, which [`TreeView.jsx`](file:///e:/rootline-register/src/family/TreeView.jsx) passes to `pathToEdgeKeySet` to illuminate the exact relationship trajectory with distinct highlight accents.

4. **Branch Collapsing:**
   - `recommendedCollapsedFamilyKeys` protects the user's direct lineage (focus person, ancestors, descendants, spouses) while offering non-destructive branch collapsing on dense distant branches.
   - Clicking branch expand/collapse icons recalculates unit positions without full page reload.

---

## 5. Conclusion

The Rootline family tree layout and kinship engine meets all functional, geometrical, and genealogical requirements:
- **Zero overlapping cards** across all test configurations.
- **100% accurate vertical generational layering**.
- **Accurate orthogonal edge routing** and partner co-location.
- **Graceful handling of null dates, unknown genders, dangling IDs, and deep multi-generational lineage**.

The tree engine is verified fully compliant and remains completely frozen.
