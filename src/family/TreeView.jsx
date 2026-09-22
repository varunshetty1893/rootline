import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  User,
  Calendar,
  X,
  Minus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  ChevronsDownUp,
  ChevronsUpDown,
  Plus,
  UserPlus,
  Loader2,
  Printer,
  Pencil,
  Trash2,
  LocateFixed,
  Focus,
  Check,
  GitBranch,
  Menu,
  UserCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import AppHeader from "./AppHeader.jsx";
import RelationshipChat from "./RelationshipChat.jsx";
import { useFamily } from "./FamilyContext.jsx";
import { computeLayout, ancestorsOf, recommendedCollapsedFamilyKeys, parentGroupsFor } from "./treeLayout.js";
import { findRelationship, pathToEdgeKeySet } from "./relationship.js";

const CARD_W = 136;
const ROW_HEIGHT = 190;
const ZOOM_MIN = 0.15;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.15;

const RELATION_OPTIONS = [
  { value: "father", label: "is their father" },
  { value: "mother", label: "is their mother" },
  { value: "parent", label: "is their parent" },
  { value: "spouse", label: "is their spouse / partner" },
  { value: "child", label: "is their child" },
  { value: "sibling", label: "is their sibling" },
];

function familyKeysFor(person) {
  const keys = (person?.parentFamilies || [])
    .map((family) => [...(family.partner_ids || [])].sort().join("|"))
    .filter(Boolean);
  if (keys.length) return keys;
  const fallback = person?.parentIds?.length ? [...person.parentIds].sort().join("|") : "";
  return fallback ? [fallback] : [];
}

function familyKeyFor(person) {
  return familyKeysFor(person)[0] || "";
}

export function getShortFamily(allPeople, focusId) {
  if (!focusId || allPeople.length === 0) return allPeople;

  const byId = new Map(allPeople.map((person) => [person.id, person]));
  const focus = byId.get(focusId);
  if (!focus) return allPeople;

  const resultIds = new Set([focusId]);

  // Helper to extract parent IDs
  const getParents = (person) => {
    if (!person) return [];
    const parentIds = new Set();
    for (const pid of person.parentIds || []) parentIds.add(pid);
    for (const fam of person.parentFamilies || []) {
      for (const pid of fam.partner_ids || []) parentIds.add(pid);
    }
    return [...parentIds].filter((id) => id !== person.id && byId.has(id));
  };

  // Helper to extract partner/spouse IDs
  const getPartners = (person) => {
    if (!person) return [];
    const partnerIds = new Set();
    for (const sid of person.spouseIds || []) partnerIds.add(sid);
    for (const fam of person.partnerFamilies || []) {
      for (const pid of fam.partner_ids || []) {
        if (pid !== person.id) partnerIds.add(pid);
      }
    }
    return [...partnerIds].filter((id) => byId.has(id));
  };

  // Helper to extract child IDs
  const getChildren = (person) => {
    if (!person) return [];
    const childIds = new Set();
    for (const fam of person.partnerFamilies || []) {
      for (const cid of fam.child_ids || []) childIds.add(cid);
    }
    for (const p of allPeople) {
      if ((p.parentIds || []).includes(person.id)) childIds.add(p.id);
      if ((p.parentFamilies || []).some((f) => f.partner_ids?.includes(person.id))) {
        childIds.add(p.id);
      }
    }
    return [...childIds].filter((id) => id !== person.id && byId.has(id));
  };

  // 1. Direct Parents of focus
  const myParents = getParents(focus);
  for (const pid of myParents) resultIds.add(pid);

  // 2. Siblings of focus and their partners
  if (myParents.length > 0) {
    for (const p of allPeople) {
      if (p.id === focusId) continue;
      const pParents = getParents(p);
      const isSibling = pParents.some((pid) => myParents.includes(pid));
      if (isSibling) {
        resultIds.add(p.id);
        // Sibling's partners ("simply her sbling and thier parterns")
        for (const partnerId of getPartners(p)) {
          resultIds.add(partnerId);
        }
      }
    }
  }

  // 3. Partners of focus (husband/wife)
  const myPartners = getPartners(focus);
  for (const partnerId of myPartners) {
    resultIds.add(partnerId);
    const partner = byId.get(partnerId);
    if (partner) {
      // 4. In-laws: Father-in-law & Mother-in-law (parents of partner)
      // ("her parter n her parteners parents")
      const inLawParents = getParents(partner);
      for (const inLawId of inLawParents) {
        resultIds.add(inLawId);
      }
    }
  }

  // 5. Children of focus (and partner's shared children)
  const myChildren = getChildren(focus);
  for (const childId of myChildren) {
    resultIds.add(childId);
  }
  for (const partnerId of myPartners) {
    const partner = byId.get(partnerId);
    if (partner) {
      for (const partnerChildId of getChildren(partner)) {
        resultIds.add(partnerChildId);
      }
    }
  }

  return allPeople.filter((person) => resultIds.has(person.id));
}

/* ------------------------------------------------------------------ */
/* Left panel: add-person form, always on screen, updates tree live    */
/* ------------------------------------------------------------------ */

const inputClass =
  "w-full rounded-lg border border-[#D9D3C3] bg-white px-3 py-2 text-sm text-[#1C1F1D] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 focus:border-[#1C4B3C]";
const inputWithIconClass = `${inputClass} pl-9`;

function Field({ label, icon: Icon, children }) {
  return (
    <label className="block mb-4">
      <span className="block text-xs font-medium text-[#374151] mb-1.5">{label}</span>
      <div className="relative">
        {Icon && <Icon className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />}
        {children}
      </div>
    </label>
  );
}

const emptyForm = { name: "", dob: "", dod: "", gender: "unspecified", notes: "" };

function AddPersonPanel() {
  const { people, addPerson } = useFamily();

  const [form, setForm] = useState(emptyForm);
  const [relationType, setRelationType] = useState("father");
  const [relatedToId, setRelatedToId] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const relatedPerson = people.find((person) => person.id === relatedToId);
  const addingParent = ["father", "mother", "parent"].includes(relationType);
  const parentFamilies = relatedPerson?.parentFamilies || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (people.length > 0 && !relatedToId) {
      setError("Choose who this person is related to.");
      return;
    }
    if (addingParent && parentFamilies.length > 1 && !familyId) {
      setError("Choose which parent family this person belongs to.");
      return;
    }

    setSaving(true);
    try {
      const relation =
        people.length === 0
          ? null
          : { type: relationType, toId: relatedToId, familyId: familyId || null };
      await addPerson(form, relation);
      // Tree on the right updates via FamilyContext refresh — reset the form
      // so the panel is ready for the next person, without navigating away.
      setForm(emptyForm);
      setRelatedToId("");
      setFamilyId("");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="w-full lg:w-[340px] shrink-0 border-b lg:border-b-0 lg:border-r border-[#E7E2D6] bg-[#FBFAF6]">
      <div className="lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto px-6 py-8">
        <h2 className="text-lg font-serif font-bold text-[#1C1F1D] mb-1">Add a family member</h2>
        <p className="text-xs text-[#6B7280] mb-6">
          Fill this in — the tree on the right updates as soon as you save.
        </p>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 text-sm text-[#B3441C] bg-[#FBEAE1] border border-[#F0C7B3] rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <Field label="Full name" icon={User}>
            <input
              type="text"
              value={form.name}
              onChange={update("name")}
              placeholder="e.g. Meera Rao"
              className={inputWithIconClass}
            />
          </Field>

          <label className="block mb-4">
            <span className="block text-xs font-medium text-[#374151] mb-1.5">Gender</span>
            <select value={form.gender} onChange={update("gender")} className={inputClass}>
              <option value="unspecified">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date of birth" icon={Calendar}>
              <input type="date" value={form.dob} onChange={update("dob")} className={inputWithIconClass} />
            </Field>
            <Field label="Date of death" icon={Calendar}>
              <input type="date" value={form.dod} onChange={update("dod")} className={inputWithIconClass} />
            </Field>
          </div>

          {people.length > 0 ? (
            <div className="border-t border-[#E7E2D6] pt-4 mt-1 mb-2">
              <span className="block text-xs font-medium text-[#374151] mb-2">Relationship</span>
              <select
                value={relationType}
                onChange={(e) => setRelationType(e.target.value)}
                className={`${inputClass} mb-2`}
              >
                {RELATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {form.name || "This person"} {opt.label}
                  </option>
                ))}
              </select>
              <span className="block text-xs font-medium text-[#374151] mb-1.5">Related to</span>
              <select
                value={relatedToId}
                onChange={(e) => {
                  setRelatedToId(e.target.value);
                  setFamilyId("");
                }}
                className={inputClass}
              >
                <option value="">Select a person…</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {addingParent && parentFamilies.length > 1 && (
                <>
                  <span className="block text-xs font-medium text-[#374151] mt-3 mb-1.5">
                    Parent family
                  </span>
                  <select
                    value={familyId}
                    onChange={(e) => setFamilyId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Choose a parent family…</option>
                    {parentFamilies.map((family) => {
                      const names = family.partner_ids
                        .map((id) => people.find((person) => person.id === id)?.name)
                        .filter(Boolean);
                      return (
                        <option key={family.id} value={family.id}>
                          {names.length ? names.join(" & ") : "Unknown parent family"}
                        </option>
                      );
                    })}
                  </select>
                </>
              )}
            </div>
          ) : (
            <p className="text-xs text-[#9CA3AF] mb-2">
              This is the first person in your tree — no relationship needed yet.
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full mt-5 bg-[#1C4B3C] text-white text-sm font-medium rounded-lg py-2.5 hover:bg-[#163C30] transition-colors disabled:opacity-60"
          >
            {saving ? "Adding…" : "Add to tree"}
          </button>
        </form>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Right panel: the tree itself                                        */
/* ------------------------------------------------------------------ */

function PersonCard({
  person,
  cardRef,
  highlighted,
  onPath,
  isRoot,
  isSelected,
  onSelect,
}) {
  // Border colour communicates *why* a card is drawn attention to — gold for
  // a search match or a highlighted relationship path. This is intentionally
  // decoupled from `isSelected`: several cards can be on-path at once, so if
  // selection reused the same gold styling, the one card you actually
  // clicked was indistinguishable from the others. Selection now gets its
  // own always-visible ring + corner badge that layers on top regardless of
  // the border colour underneath, so there's never any doubt which single
  // card is selected.
  const borderClass = highlighted || onPath ? "border-[#D2A338]" : "border-[#1C4B3C]";
  const selectionRingClass = isSelected ? "ring-4 ring-[#174F61] ring-offset-2 ring-offset-white" : "";

  return (
    <div className="flex flex-col items-center text-center" style={{ width: CARD_W }}>
      {/* This inner box is what line anchors measure — fixed height regardless
          of whether the collapse pill below is present, so siblings in the
          same row always connect at the same Y position. */}
      <div
        ref={cardRef}
        data-person-id={person.id}
        onClick={() => onSelect?.(person.id)}
        className={`relative flex flex-col items-center w-[122px] min-h-[138px] mx-auto rounded-md border-[3px] bg-[#1C4B3C] px-2 py-2 text-white shadow-sm cursor-pointer transition-transform hover:-translate-y-0.5 ${borderClass} ${selectionRingClass}`}
        title="Select this person"
      >
        {isSelected && (
          <span
            title="Selected"
            className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-[#174F61] text-white flex items-center justify-center shadow ring-2 ring-white z-10"
          >
            <Check className="w-3 h-3" strokeWidth={3} />
          </span>
        )}
        <div className="relative mb-1">
          <div
            className="w-12 h-12 rounded-full bg-[#EDF4F3] border-2 border-white/70 shadow-sm flex items-center justify-center overflow-hidden"
          >
            {person.photo_url ? (
              <img
                src={person.photo_url}
                alt={person.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <GitBranch className="w-5 h-5 text-[#C9BEA8]" strokeWidth={2.5} />
            )}
          </div>
          {isRoot && (
            <span
              title="This is you (Tree Starter)"
              className="absolute -bottom-1 -right-2 text-[9px] font-bold bg-[#174F61] text-white rounded-full px-1.5 py-0.5 leading-none shadow-sm ring-1 ring-white"
            >
              You
            </span>
          )}
        </div>
        <p className="text-[11px] font-semibold leading-tight truncate w-full">{person.name}</p>
        <p className="text-[9px] text-white/85 h-3.5 mt-0.5">
          {person.dob ? person.dob.slice(0, 4) : "Birth unknown"}
          {person.dod ? ` – ${person.dod.slice(0, 4)}` : ""}
        </p>
        <p className="text-[8px] text-white/75 leading-tight line-clamp-2 mt-1">{person.notes || "Family member"}</p>
      </div>

      {/* Branch controls are rendered at the connector junction, not under
          individual cards. That makes one family branch feel like one unit. */}
      <div className="h-6" />
    </div>
  );
}

export default function TreeView() {
  const [searchParams] = useSearchParams();
  const { people, rootPersonId, setRootPersonId, addPerson, linkPeople, deletePerson } = useFamily();
  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const cardRefs = useRef({});
  const [lines, setLines] = useState([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [collapsedFamilyKeys, setCollapsedFamilyKeys] = useState(() => new Set());
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState("");
  const [highlightId, setHighlightId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [quickRelation, setQuickRelation] = useState(null);
  const [quickName, setQuickName] = useState("");
  const [quickGender, setQuickGender] = useState("unspecified");
  const [quickParentType, setQuickParentType] = useState("parent");
  const [quickFamilyRelationship, setQuickFamilyRelationship] = useState("unknown");
  const [quickPartnerStatus, setQuickPartnerStatus] = useState("partner");
  const [quickFamilyId, setQuickFamilyId] = useState("");
  const [quickPartnerName, setQuickPartnerName] = useState("");
  const [quickPartnerId, setQuickPartnerId] = useState("");
  const [quickPartnerMode, setQuickPartnerMode] = useState("add");
  const [quickPartnerSaving, setQuickPartnerSaving] = useState(false);
  const [quickSuccess, setQuickSuccess] = useState("");
  const [quickError, setQuickError] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);
  const [inspectorTab, setInspectorTab] = useState("personal");
  const [changeRootModalOpen, setChangeRootModalOpen] = useState(false);
  const [changeRootSearch, setChangeRootSearch] = useState("");
  const [confirmSetMePerson, setConfirmSetMePerson] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [collapseControls, setCollapseControls] = useState([]);
  const [focusedView, setFocusedView] = useState(true);
  const [smartAccordion, setSmartAccordion] = useState(true);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [mobileSheetMinimized, setMobileSheetMinimized] = useState(false);
  const panState = useRef(null);
  const lastRootRef = useRef(null);

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const directAncestors = useMemo(() => {
    const root = rootPersonId || people[0]?.id;
    if (!root) return new Set();
    return new Set([root, ...ancestorsOf(root, people)]);
  }, [rootPersonId, people]);

  // Focused Short Family: when a person is selected, display only their immediate short family
  // (parents, spouse, children, in-laws, and siblings with their partners).
  // The full tree across all generations can still be toggled with one click.
  const focusId = selectedId || rootPersonId;
  const scopedPeople = useMemo(
    () => (focusedView ? getShortFamily(people, focusId) : people),
    [people, focusedView, focusId]
  );

  const { rows, edges, layoutWidth } = useMemo(
    () => computeLayout(scopedPeople, focusedView ? new Set() : collapsedFamilyKeys, focusId),
    [scopedPeople, focusedView, collapsedFamilyKeys, focusId]
  );

  // Initialize recommended collapsed branches on first load or when the root person changes,
  // so the tree opens focused on closely related family with "+" buttons on collateral branches.
  useEffect(() => {
    if (!people.length) return;
    const focus = rootPersonId || people[0]?.id;
    if (!focus) return;
    if (lastRootRef.current !== focus) {
      lastRootRef.current = focus;
      const recommended = recommendedCollapsedFamilyKeys(people, new Set([focus]));
      if (recommended.size > 0) {
        setCollapsedFamilyKeys(recommended);
      }
    }
  }, [people, rootPersonId]);

  // Safety guard: If collapsing ever leads to 0 rows while people exist in this tree,
  // automatically reset collapsed branches so the tree is never invisible.
  useEffect(() => {
    if (scopedPeople.length > 0 && rows.length === 0 && collapsedFamilyKeys.size > 0) {
      setCollapsedFamilyKeys(new Set());
    }
  }, [scopedPeople.length, rows.length, collapsedFamilyKeys.size]);

  // "How am I related?" — recomputed whenever the selection or the root
  // ("you") changes. Cheap even for large trees: bounded by tree depth.
  const relationship = useMemo(() => {
    if (!selectedId || !rootPersonId || selectedId === rootPersonId) return null;
    return findRelationship(rootPersonId, selectedId, scopedPeople);
  }, [selectedId, rootPersonId, scopedPeople]);

  const pathIdSet = useMemo(
    () => new Set(relationship?.path || []),
    [relationship]
  );
  const pathEdgeKeys = useMemo(
    () => pathToEdgeKeySet(relationship?.path || []),
    [relationship]
  );

  const selectedPerson = selectedId ? people.find((p) => p.id === selectedId) : null;
  const rootPerson = useMemo(() => people.find((p) => p.id === rootPersonId) || null, [people, rootPersonId]);

  useEffect(() => {
    if (people.length && !people.some((p) => p.id === selectedId)) {
      setSelectedId(rootPersonId && people.some((p) => p.id === rootPersonId) ? rootPersonId : people[0].id);
    }
  }, [people, rootPersonId, selectedId]);

  const openQuickAdd = (relation) => {
    const person = selectedPerson;
    const parentFamilies = person?.parentFamilies || [];
    const partnerFamilies = person?.partnerFamilies || [];
    setQuickRelation(relation);
    setQuickName("");
    setQuickGender("unspecified");
    setQuickParentType("parent");
    setQuickFamilyRelationship("unknown");
    setQuickPartnerStatus("partner");
    setQuickPartnerName("");
    setQuickPartnerId("");
    setQuickPartnerMode("add");
    setQuickFamilyRelationship("unknown");
    setQuickPartnerStatus("partner");
    setQuickSuccess("");
    if (relation === "sibling") {
      setQuickFamilyId(parentFamilies.length === 1 ? parentFamilies[0].id : parentFamilies.length === 0 ? "new-family" : "");
    } else if (relation === "child") {
      setQuickFamilyId(partnerFamilies.length === 1 ? partnerFamilies[0].id : partnerFamilies.length === 0 ? "no-partner" : "");
    } else if (relation === "parent") {
      const available = parentFamilies.filter((family) => family.partner_ids.length < 2);
      setQuickFamilyId(available.length === 1 ? available[0].id : "");
    } else {
      setQuickFamilyId("");
    }
    setQuickError("");
  };

  const closeQuickAdd = () => {
    setQuickRelation(null);
    setQuickName("");
    setQuickFamilyId("");
    setQuickPartnerName("");
    setQuickPartnerId("");
    setQuickPartnerMode("add");
    setQuickSuccess("");
    setQuickError("");
  };

  const addPartnerBeforeChild = async () => {
    if (!selectedPerson || !quickPartnerName.trim()) {
      setQuickError("Enter the partner's name first.");
      return;
    }
    setQuickPartnerSaving(true);
    setQuickError("");
    try {
      const partnerId = await addPerson(
        { name: quickPartnerName.trim(), gender: "unspecified", dob: "", dod: "", notes: "" },
        { type: "spouse", toId: selectedPerson.id }
      );
      setQuickPartnerId(partnerId);
      setQuickPartnerName("");
      setQuickSuccess("Partner added. Select that partner below, then add the child.");
    } catch (err) {
      setQuickError(err.message || "Could not add the partner.");
    } finally {
      setQuickPartnerSaving(false);
    }
  };

  const submitQuickAdd = async (e) => {
    e.preventDefault();
    const linkingExistingPartner = quickRelation === "spouse" && quickPartnerMode === "select";
    if ((!quickName.trim() && !linkingExistingPartner) || !selectedPerson || !quickRelation) {
      setQuickError("Enter their name to add them to the tree.");
      return;
    }
    if (quickRelation === "sibling" && !quickFamilyId) {
      setQuickError(
        selectedPerson.parentFamilies?.length
          ? "Choose which parent family this sibling shares."
          : "Add a parent family to this person before adding a sibling."
      );
      return;
    }
    if (quickRelation === "parent" && !quickFamilyId && parentFamilyOptions.length > 1) {
      setQuickError("Choose which parent family this new parent belongs to.");
      return;
    }
    if (quickRelation === "child" && !quickFamilyId) {
      setQuickError("Choose the partner or choose different partner to continue.");
      return;
    }
    if (quickRelation === "child" && quickFamilyId === "different-partner") {
      if (!quickPartnerId) {
        setQuickError("Add or select the different partner first, then add the child.");
        return;
      }
    }
    setQuickSaving(true);
    setQuickError("");
    try {
      if (quickRelation === "spouse" && quickPartnerMode === "select") {
        if (!quickPartnerId) {
          setQuickError("Select the existing person you want to link.");
          return;
        }
        await linkPeople(selectedPerson.id, quickPartnerId, quickPartnerStatus);
        setSelectedId(quickPartnerId);
        closeQuickAdd();
        requestAnimationFrame(() => revealAndFocus(quickPartnerId));
        return;
      }
      const id = await addPerson(
        { name: quickName.trim(), gender: quickGender, dob: "", dod: "", notes: "" },
        {
          type: quickRelation === "parent" ? quickParentType : quickRelation,
          toId: selectedPerson.id,
          familyId: ["no-partner", "new-family", "different-partner"].includes(quickFamilyId)
            ? null
            : quickFamilyId || null,
          partnerId: quickFamilyId === "different-partner" ? quickPartnerId : null,
          familyRelationship: quickFamilyRelationship,
          partnerStatus: quickPartnerStatus,
          newFamily: quickFamilyId === "new-family",
        }
      );
      if (quickRelation !== "child") setSelectedId(id);
      requestAnimationFrame(() => revealAndFocus(id));
      if (quickRelation === "child") {
        setQuickName("");
        setQuickSuccess("Child added. Add another child below, or choose Done.");
      } else {
        closeQuickAdd();
      }
    } catch (err) {
      setQuickError(err.message || "Could not add this family member. Please try again.");
    } finally {
      setQuickSaving(false);
    }
  };

  useEffect(() => {
    if (!quickPartnerId || !selectedPerson?.partnerFamilies?.length) return;
    const family = selectedPerson.partnerFamilies.find((entry) => entry.partner_ids.includes(quickPartnerId));
    if (family) setQuickFamilyId(family.id);
  }, [quickPartnerId, selectedPerson]);

  // Uncollapse any family branch that conceals this person, their spouse,
  // their children, or their in-laws, ensuring their complete family is visible.
  const uncollapseImmediateFamily = useCallback((personId) => {
    if (!personId || !people.length) return;
    const person = people.find((p) => p.id === personId);
    if (!person) return;
    const keysToExpand = new Set();

    // 1. Person's parent families
    for (const key of familyKeysFor(person)) keysToExpand.add(key);

    // 2. Person's partner families (their children with spouses)
    for (const fam of person.partnerFamilies || []) {
      const key = [...(fam.partner_ids || [])].sort().join("|");
      if (key) keysToExpand.add(key);
    }

    // 3. Person's spouses' parent families (in-laws! e.g. Praveen's parents for n)
    for (const spouseId of person.spouseIds || []) {
      const spouse = people.find((p) => p.id === spouseId);
      if (spouse) {
        for (const key of familyKeysFor(spouse)) keysToExpand.add(key);
      }
    }

    // 4. Person's children's parent families
    for (const other of people) {
      if ((other.parentIds || []).includes(personId)) {
        for (const key of familyKeysFor(other)) keysToExpand.add(key);
      }
    }

    setCollapsedFamilyKeys((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const key of keysToExpand) {
        if (next.has(key)) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [people]);

  // When Nearby family mode is active or focus person changes, keep their family expanded
  useEffect(() => {
    if (focusedView && focusId) {
      uncollapseImmediateFamily(focusId);
    }
  }, [focusedView, focusId, uncollapseImmediateFamily]);

  // Reveal a person hidden behind a collapsed ancestor, then scroll to them.
  const revealAndFocus = (id) => {
    uncollapseImmediateFamily(id);
    const ancestors = ancestorsOf(id, people);
    setCollapsedFamilyKeys((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const ancestorId of [...ancestors, id]) {
        for (const branch of familyKeysFor(people.find((person) => person.id === ancestorId))) {
          if (next.has(branch)) {
            next.delete(branch);
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
    requestAnimationFrame(() => {
      cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    });
  };

  const handleSelectPerson = (id) => {
    if (!id) {
      setSelectedId(null);
      return;
    }
    setSelectedId(id);
    setFocusedView(true);
    revealAndFocus(id);
  };

  const handleDeleteSelected = async () => {
    if (!selectedPerson) return;
    await deletePerson(selectedPerson.id);
    setSelectedId(null);
  };

  // Delete/Backspace removes the selected card immediately, matching the
  // inspector action. Never intercept normal typing in a form field.
  // Bails out whenever focus is inside a text field (input/textarea/select/
  // contentEditable) so ordinary typing and backspacing elsewhere in the app
  // — the add-person form, search box, quick-add modal — is never hijacked.
  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const target = e.target;
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (isEditable || !selectedId) return;

      e.preventDefault();
      await deletePerson(selectedId);
      setSelectedId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, deletePerson]);

  // Click-and-drag panning on empty canvas — a large tree needs this far
  // more than thin scrollbars. Bails out if the mousedown started on an
  // actual person card, so clicking someone still selects them normally.
  const handleCanvasMouseDown = (e) => {
    if (e.button !== 0 || e.target.closest("[data-person-id]")) return;
    const viewport = scrollRef.current;
    if (!viewport) return;
    panState.current = {
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    setIsPanning(true);
  };

  const handleCanvasWheel = (e) => {
    e.preventDefault();
    const viewport = scrollRef.current;
    if (!viewport) return;
    const bounds = viewport.getBoundingClientRect();
    const cursorX = e.clientX - bounds.left;
    const cursorY = e.clientY - bounds.top;

    setZoom((current) => {
      // Convert the cursor into the tree's unscaled coordinate system, then
      // restore that same point under the cursor after the scale changes.
      // This makes ordinary wheel zoom feel anchored to the graph, rather
      // than jumping toward a fixed canvas corner.
      const treeX = (viewport.scrollLeft + cursorX) / current;
      const treeY = (viewport.scrollTop + cursorY) / current;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, +(current * factor).toFixed(3)));
      requestAnimationFrame(() => {
        viewport.scrollLeft = Math.max(0, treeX * next - cursorX);
        viewport.scrollTop = Math.max(0, treeY * next - cursorY);
      });
      return next;
    });
  };

  const centerPerson = (id) => {
    cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  };

  const toggleFullscreen = async () => {
    if (!scrollRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen?.();
    else await scrollRef.current.requestFullscreen?.();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      const state = panState.current;
      const viewport = scrollRef.current;
      if (!state || !viewport) return;
      viewport.scrollLeft = state.scrollLeft - (e.clientX - state.startX);
      viewport.scrollTop = state.scrollTop - (e.clientY - state.startY);
    };
    const handleMouseUp = () => {
      panState.current = null;
      setIsPanning(false);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Issue #27: Touch pan and pinch-to-zoom for mobile/tablet devices
  const touchState = useRef(null);

  const getTouchDistance = (t1, t2) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
  };

  const handleTouchStart = (e) => {
    if (e.target.closest("[data-person-id]")) return;
    const viewport = scrollRef.current;
    if (!viewport) return;

    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchState.current = {
        mode: "pan",
        startX: t.clientX,
        startY: t.clientY,
        scrollLeft: viewport.scrollLeft,
        scrollTop: viewport.scrollTop,
      };
      setIsPanning(true);
    } else if (e.touches.length === 2) {
      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      touchState.current = {
        mode: "pinch",
        startDist: dist,
        startZoom: zoom,
      };
    }
  };

  const handleTouchMove = (e) => {
    const state = touchState.current;
    const viewport = scrollRef.current;
    if (!state || !viewport) return;

    if (state.mode === "pan" && e.touches.length === 1) {
      const t = e.touches[0];
      viewport.scrollLeft = state.scrollLeft - (t.clientX - state.startX);
      viewport.scrollTop = state.scrollTop - (t.clientY - state.startY);
    } else if (state.mode === "pinch" && e.touches.length === 2) {
      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      if (state.startDist > 0) {
        const factor = dist / state.startDist;
        const nextZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, +(state.startZoom * factor).toFixed(3)));
        setZoom(nextZoom);
      }
    }
  };

  const handleTouchEnd = () => {
    touchState.current = null;
    setIsPanning(false);
  };

  const toggleCollapse = (familyKey) => {
    setCollapsedFamilyKeys((prev) => {
      const next = new Set(prev);
      const isExpanding = next.has(familyKey);
      if (isExpanding) {
        next.delete(familyKey);

        if (smartAccordion) {
          // When expanding a collateral sibling family branch, auto-collapse other
          // collateral sibling families in the same generation sharing parents
          // so branches remain centered under parents and don't push each other outwards or overlap.
          const partnerIds = familyKey.split("|").filter(Boolean);
          const parentGroupKeys = new Set();
          for (const pid of partnerIds) {
            const person = peopleById.get(pid);
            if (!person) continue;
            for (const group of parentGroupsFor(person, peopleById)) {
              parentGroupKeys.add(group.slice().sort().join("|"));
            }
          }

          if (parentGroupKeys.size > 0) {
            for (const person of people) {
              if (partnerIds.includes(person.id)) continue;
              if (directAncestors.has(person.id)) continue;

              const personParentGroups = parentGroupsFor(person, peopleById).map((g) =>
                g.slice().sort().join("|")
              );
              const isSibling = personParentGroups.some((g) => parentGroupKeys.has(g));
              if (!isSibling) continue;

              for (const fam of person.partnerFamilies || []) {
                const famKey = [...(fam.partner_ids || [])].sort().join("|");
                next.add(famKey);
              }
            }
          }
        }
      } else {
        next.add(familyKey);
      }
      return next;
    });
  };

  const collapseAll = () => {
    const withChildren = scopedPeople.flatMap((person) => familyKeysFor(person));
    setCollapsedFamilyKeys(new Set(withChildren));
  };
  const expandAll = () => setCollapsedFamilyKeys(new Set());
  const resetExpand = () => {
    const focus = rootPersonId || people[0]?.id;
    if (focus) {
      setCollapsedFamilyKeys(recommendedCollapsedFamilyKeys(people, new Set([focus])));
    } else {
      setCollapsedFamilyKeys(new Set());
    }
  };

  const handleBackToMe = useCallback(() => {
    if (!rootPersonId) return;
    setSelectedId(rootPersonId);
    setFocusedView(true);
    uncollapseImmediateFamily(rootPersonId);
    requestAnimationFrame(() => {
      centerPerson(rootPersonId);
    });
  }, [rootPersonId, centerPerson, uncollapseImmediateFamily]);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    const match = people.find((p) => p.name.toLowerCase().includes(q));
    if (!match) return;

    // If an ancestor is collapsed, this person is hidden — reveal them first.
    uncollapseImmediateFamily(match.id);
    const ancestors = ancestorsOf(match.id, people);
    setCollapsedFamilyKeys((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const ancestorId of [...ancestors, match.id]) {
        for (const branch of familyKeysFor(people.find((person) => person.id === ancestorId))) {
          if (next.has(branch)) {
            next.delete(branch);
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });

    setHighlightId(match.id);
    setSelectedId(match.id); // also surfaces "how you're related" + path highlight
    setFocusedView(true);
    // Wait a tick for any expand to re-render, then scroll to it.
    requestAnimationFrame(() => {
      const el = cardRefs.current[match.id];
      el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    });
    setTimeout(() => setHighlightId((cur) => (cur === match.id ? null : cur)), 2200);
  };

  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));

  // Actually fits the whole tree in the viewport, rather than just resetting
  // to 100% — measures the tree's true (unscaled) size via scrollWidth /
  // scrollHeight, which CSS transforms don't affect, then picks whichever
  // scale (width- or height-limited) is smaller so nothing gets clipped.
  const fitToScreen = () => {
    const content = containerRef.current;
    const viewport = scrollRef.current;
    if (!content || !viewport) return;

    const contentW = content.scrollWidth;
    const contentH = content.scrollHeight;
    const viewportW = viewport.clientWidth;
    const viewportH = viewport.clientHeight;
    if (!contentW || !contentH) return;

    const scale = Math.min(viewportW / contentW, viewportH / contentH, 1) * 0.94;
    const nextZoom = Math.max(0.08, +scale.toFixed(3));
    setZoom(nextZoom);

    // Center horizontally, start from the top so ancestors are visible first.
    requestAnimationFrame(() => {
      const scaledW = contentW * nextZoom;
      viewport.scrollTo({
        left: Math.max(0, (scaledW - viewportW) / 2),
        top: 0,
        behavior: "smooth",
      });
    });
  };

  useLayoutEffect(() => {
    if (!containerRef.current || people.length === 0) return;

    const recompute = () => {
      const containerRect = containerRef.current.getBoundingClientRect();
      const points = {};
      for (const [id, el] of Object.entries(cardRefs.current)) {
        if (!el) continue;
        const r = el.getBoundingClientRect();
        points[id] = {
          top: { x: (r.left + r.width / 2 - containerRect.left) / zoom, y: (r.top - containerRect.top) / zoom },
          bottom: { x: (r.left + r.width / 2 - containerRect.left) / zoom, y: (r.bottom - containerRect.top) / zoom },
          left: { x: (r.left - containerRect.left) / zoom, y: (r.top + r.height / 2 - containerRect.top) / zoom },
          right: { x: (r.right - containerRect.left) / zoom, y: (r.top + r.height / 2 - containerRect.top) / zoom },
        };
      }
      const visibleById = new Map(scopedPeople.map((person) => [person.id, person]));
      const nextCollapseControls = [];

      const newLines = edges
        .map((edge) => {
          if (edge.type === "family-child") {
            const parentEntries = edge.parents
              .map((id) => ({ id, point: points[id] }))
              .filter((entry) => entry.point);
            const children = edge.children.map((id) => ({ id, point: points[id] })).filter((entry) => entry.point);
            if (!parentEntries.length || !children.length) return null;

            // When the parents are a couple, begin at the midpoint of their
            // horizontal partner connector. The previous implementation
            // began at the midpoint of their card bottoms, which left a
            // visible disconnected-looking section between the partner line
            // and the parent-to-child stem. For parent records without a
            // partner link, build a small bottom-edge family bar instead.
            const isPartnerPair =
              parentEntries.length === 2 &&
              parentEntries.every(({ id }) => visibleById.has(id)) &&
              parentEntries.every(({ id }) => {
                const partner = visibleById.get(id);
                return partner.spouseIds?.includes(parentEntries.find((entry) => entry.id !== id)?.id);
              });
            let startX;
            let startY;
            let parentConnector = "";
            if (isPartnerPair) {
              const [first, second] = parentEntries.map(({ point }) => point).sort((a, b) => a.left.x - b.left.x);
              startX = (first.right.x + second.left.x) / 2;
              startY = (first.right.y + second.left.y) / 2;
            } else {
              const parentBarY = Math.max(...parentEntries.map(({ point }) => point.bottom.y));
              const parentXs = parentEntries.map(({ point }) => point.bottom.x);
              startX = parentXs.reduce((sum, x) => sum + x, 0) / parentXs.length;
              startY = parentBarY;
              const parentDrops = parentEntries
                .map(({ point }) =>
                  point.bottom.y < parentBarY
                    ? `M ${point.bottom.x} ${point.bottom.y} L ${point.bottom.x} ${parentBarY}`
                    : ""
                )
                .join("");
              const parentMinX = Math.min(...parentXs);
              const parentMaxX = Math.max(...parentXs);
              parentConnector = `${parentDrops}${
                parentMaxX - parentMinX > 0.5
                  ? ` M ${parentMinX} ${parentBarY} L ${parentMaxX} ${parentBarY}`
                  : ""
              }`;
            }
            const junctionY = Math.min(...children.map(({ point }) => point.top.y)) - 26;
            nextCollapseControls.push({
              key: edge.familyKey,
              x: startX,
              y: junctionY,
              collapsed: collapsedFamilyKeys.has(edge.familyKey),
            });
            const childXs = children.map(({ point }) => point.top.x);
            const onPath = children.some(({ id }) => edge.parents.some((parentId) => pathEdgeKeys.has(`${parentId}|${id}`))) ||
              edge.parents.includes(selectedId) || edge.children.includes(selectedId);
            const stem = `M ${startX} ${startY} L ${startX} ${junctionY}`;
            // The bar must always span from the parents' stem to every child,
            // not just between the children themselves — with one child (or
            // children whose x-range doesn't include startX), the old code
            // skipped this segment entirely, leaving the stem and the drop
            // as two disconnected pieces (a visible gap in the line).
            const barXs = [startX, ...childXs];
            const barMinX = Math.min(...barXs);
            const barMaxX = Math.max(...barXs);
            const bar = barMaxX - barMinX > 0.5 ? ` M ${barMinX} ${junctionY} L ${barMaxX} ${junctionY}` : "";
            const drops = children.map(({ point }) => ` M ${point.top.x} ${junctionY} L ${point.top.x} ${point.top.y}`).join("");
            return {
              key: `family-${edge.parents.join("-")}-${edge.children.join("-")}`,
              type: "family-child",
              onPath,
              path: `${parentConnector}${stem}${bar}${drops}`,
            };
          }
          const from = points[edge.from];
          const to = points[edge.to];
          if (!from || !to) return null;
          const onPath = pathEdgeKeys.has(`${edge.from}|${edge.to}`) || edge.from === selectedId || edge.to === selectedId;
          if (edge.type === "spouse") {
            // Stored spouse links are not guaranteed to be left-to-right.
            // Choose visual anchors first so a reversed one-sided link
            // cannot draw through the two cards.
            const [left, right] = from.left.x <= to.left.x ? [from, to] : [to, from];
            return {
              key: `${edge.from}-${edge.to}-spouse`,
              type: "spouse",
              onPath,
              x1: left.right.x,
              y1: left.right.y,
              x2: right.left.x,
              y2: right.left.y,
            };
          }
          const midY = (from.bottom.y + to.top.y) / 2;
          return {
            key: `${edge.from}-${edge.to}-pc`,
            type: "parent-child",
            onPath,
            path: `M ${from.bottom.x} ${from.bottom.y} L ${from.bottom.x} ${midY} L ${to.top.x} ${midY} L ${to.top.x} ${to.top.y}`,
          };
        })
        .filter(Boolean);

      // A collapsed branch no longer has visible children to measure. Keep
      // its plus control at the family connector just below the parent cards.
      // This is the same junction used while expanded, so the control never
      // jumps under one arbitrary card.
      const visibleControlKeys = new Set(nextCollapseControls.map((control) => control.key));
      for (const familyKey of collapsedFamilyKeys) {
        if (visibleControlKeys.has(familyKey)) continue;
        const parentIds = familyKey.split("|").filter(Boolean);
        const parentPoints = parentIds.map((id) => points[id]).filter(Boolean);
        if (!parentPoints.length) continue;
        nextCollapseControls.push({
          key: familyKey,
          x: parentPoints.reduce((sum, point) => sum + point.bottom.x, 0) / parentPoints.length,
          y: Math.max(...parentPoints.map((point) => point.bottom.y)) + 18,
          collapsed: true,
        });
      }

      setLines(newLines);
      setCollapseControls(nextCollapseControls);
      setSize({ w: containerRect.width / zoom, h: containerRect.height / zoom });
    };

    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [scopedPeople, edges, rows, zoom, pathEdgeKeys, selectedId, collapsedFamilyKeys]);

  // Start every tree at a predictable, readable scale. People can still use
  // the Fit control when they want to see an unusually large tree at once.
  const hasAutoFitted = useRef(false);
  useEffect(() => {
    if (hasAutoFitted.current || scopedPeople.length === 0) return;
    if (!containerRef.current?.scrollWidth) return;
    hasAutoFitted.current = true;
    setZoom(0.9);
    requestAnimationFrame(() => centerPerson(selectedId || rootPersonId));
  }, [scopedPeople, rows]);

  const familyLabel = (family) => {
    const otherPartners = (family.partner_ids || [])
      .filter((id) => id !== selectedPerson?.id)
      .map((id) => people.find((person) => person.id === id)?.name)
      .filter(Boolean);
    const partnerText = otherPartners.length ? `With ${otherPartners.join(" & ")}` : "Without a partner";
    return family.relationship_status && family.relationship_status !== "partner"
      ? `${partnerText} · ${family.relationship_status}`
      : partnerText;
  };
  const parentFamilyOptions = (selectedPerson?.parentFamilies || []).filter(
    (family) => family.partner_ids.length < 2
  );
  const childFamilyOptions = selectedPerson?.partnerFamilies || [];

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[#F7F5F0] flex flex-col">
      <AppHeader />

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <aside className="hidden lg:block w-full lg:w-[330px] shrink-0 border-b lg:border-b-0 lg:border-r border-[#DCE3E1] bg-white shadow-sm z-10">
          <div className="lg:sticky lg:top-0 lg:h-[calc(100vh-69px)] lg:overflow-y-auto">
            <div className="flex border-b border-[#DCE3E1] px-5 gap-6">
              {[
                ["personal", "Personal"],
              ].map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setInspectorTab(tab)}
                  className={`py-4 text-xs font-semibold uppercase tracking-wide border-b-2 -mb-px ${
                    inspectorTab === tab ? "border-[#1C4B3C] text-[#1C4B3C]" : "border-transparent text-[#7B8794] hover:text-[#1C4B3C]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {selectedPerson ? (
              <div className="p-5">
                {inspectorTab === "personal" && (
                  <>
                    <div className="border border-[#DCE3E1] rounded-lg overflow-hidden mb-5">
                      {[
                        ["Person’s name", selectedPerson.name],
                        ["Gender", selectedPerson.gender ? selectedPerson.gender[0].toUpperCase() + selectedPerson.gender.slice(1) : "Not recorded"],
                        ["Date of birth", selectedPerson.dob || "Not recorded"],
                        ["Date of death", selectedPerson.dod || "—"],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-3 px-3 py-2.5 border-b last:border-b-0 border-[#DCE3E1] text-sm">
                          <span className="text-[#374151]">{label}</span>
                          <span className="text-[#5A6980] text-right truncate">{value}</span>
                        </div>
                      ))}
                    </div>
                    <Link
                      to={`/people/${selectedPerson.id}/edit`}
                      className="flex items-center justify-center gap-2 w-full rounded-md bg-[#1C4B3C] text-white text-sm font-medium py-2.5 shadow-sm hover:bg-[#163C30]"
                    >
                      <Pencil className="w-4 h-4" /> Edit person
                    </Link>
                    {rootPersonId === selectedPerson.id ? (
                      <div className="mt-2.5 flex items-center justify-between px-3 py-2 rounded-md bg-[#E7F1EB] border border-[#1C4B3C]/30 text-[#1C4B3C] text-xs font-semibold">
                        <div className="flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-[#1C4B3C]" strokeWidth={2.5} />
                          <span>Marked as "You" (Tree Starter)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setChangeRootSearch("");
                            setChangeRootModalOpen(true);
                          }}
                          className="text-[10px] text-[#1C4B3C] underline hover:text-[#163C30]"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmSetMePerson(selectedPerson)}
                        className="mt-2.5 flex items-center justify-center gap-2 w-full rounded-md border border-[#1C4B3C] bg-white text-[#1C4B3C] hover:bg-[#1C4B3C] hover:text-white text-xs font-semibold py-2 transition-colors shadow-2xs"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Set as "You" (Tree Starter)
                      </button>
                    )}
                  </>
                )}

                <div className="border-t border-[#DCE3E1] mt-5 pt-5 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7B8794] mb-3">Build this branch</p>
                  <button
                    type="button"
                    onClick={() => openQuickAdd("parent")}
                    className="w-full rounded-md bg-[#D7E7DF] text-[#1C4B3C] text-sm font-medium py-2.5 hover:bg-[#C5DDD2]"
                  >
                    Add parent
                  </button>
                  <button type="button" onClick={() => openQuickAdd("sibling")} className="w-full rounded-md bg-[#1C4B3C] text-white text-sm font-medium py-2.5 hover:bg-[#163C30]">Add sibling</button>
                  <button type="button" onClick={() => openQuickAdd("spouse")} className="w-full rounded-md bg-[#1C4B3C] text-white text-sm font-medium py-2.5 hover:bg-[#163C30]">Add partner</button>
                  <button type="button" onClick={() => openQuickAdd("child")} className="w-full rounded-md bg-[#1C4B3C] text-white text-sm font-medium py-2.5 hover:bg-[#163C30]">Add child</button>
                </div>

                <div className="border-t border-[#DCE3E1] mt-5 pt-4">
                  <button type="button" onClick={handleDeleteSelected} className="flex items-center justify-center gap-1.5 w-full text-xs font-medium text-[#A65035] border border-[#E7C4B8] rounded-md py-2 hover:bg-[#FBEAE1]"><Trash2 className="w-3.5 h-3.5" /> Delete person</button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center">
                <User className="w-8 h-8 text-[#C9BEA8] mx-auto mb-3" />
                <p className="text-sm text-[#5A6980]">Select someone in the tree to view and build their family branch.</p>
              </div>
            )}
          </div>
        </aside>

        {selectedPerson && (
          <section className="lg:hidden fixed inset-x-0 bottom-0 z-30 transition-all duration-200 border-t border-[#DCE3E1] bg-white shadow-[0_-8px_28px_rgba(28,31,29,0.16)] rounded-t-2xl">
            {mobileSheetMinimized ? (
              /* Minimized / Peek Bar */
              <div className="flex items-center justify-between px-4 py-2.5 bg-white">
                <div className="min-w-0 flex-1 mr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7B8794]">Selected</span>
                    {rootPersonId === selectedPerson.id && (
                      <span className="text-[9px] font-bold bg-[#E7F1EB] text-[#1C4B3C] px-1.5 py-0.2 rounded border border-[#1C4B3C]/20">You</span>
                    )}
                  </div>
                  <p className="truncate text-sm font-semibold text-[#1C1F1D]">{selectedPerson.name}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {rootPersonId !== selectedPerson.id && (
                    <button
                      type="button"
                      onClick={() => setConfirmSetMePerson(selectedPerson)}
                      className="rounded-lg bg-[#E7F1EB] border border-[#1C4B3C]/35 px-2.5 py-1 text-xs font-semibold text-[#1C4B3C] flex items-center gap-1 hover:bg-[#D7E7DF] shadow-2xs"
                      title={`Set ${selectedPerson.name} as "Me"`}
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>Set as Me</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMobileSheetMinimized(false)}
                    className="rounded-lg bg-[#F7F5F0] border border-[#E7E2D6] px-2.5 py-1 text-xs font-medium text-[#374151] flex items-center gap-1 hover:bg-[#EAE6DD]"
                  >
                    <span>Actions</span>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F7F5F0]"
                    aria-label="Close person details"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Expanded Bottom Sheet */
              <div className="max-h-[50dvh] overflow-y-auto">
                <div className="sticky top-0 flex items-center justify-between border-b border-[#DCE3E1] bg-white px-4 py-2.5 z-10">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7B8794]">Selected person</p>
                      {rootPersonId === selectedPerson.id && (
                        <span className="text-[9px] font-bold bg-[#E7F1EB] text-[#1C4B3C] px-1.5 py-0.2 rounded border border-[#1C4B3C]/20">You</span>
                      )}
                    </div>
                    <p className="truncate text-sm font-semibold text-[#1C1F1D]">{selectedPerson.name}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setMobileSheetMinimized(true)}
                      className="rounded-lg px-2.5 py-1 text-xs font-medium text-[#6B7280] hover:bg-[#F7F5F0] flex items-center gap-0.5 border border-[#E7E2D6]"
                      title="Minimize to see tree"
                    >
                      <span>Peek</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F7F5F0]"
                      aria-label="Close person details"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-4 py-2.5 text-xs text-[#5A6980] bg-[#FAF8F4]/60 border-b border-[#E7E2D6]/60">
                  <span>Born: {selectedPerson.dob || "Not recorded"}</span>
                  <span>Gender: {selectedPerson.gender || "Not recorded"}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 p-4">
                  <Link
                    to={`/people/${selectedPerson.id}/edit`}
                    className="col-span-2 flex items-center justify-center gap-2 rounded-md bg-[#1C4B3C] py-2 text-xs font-medium text-white shadow-2xs"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit person profile
                  </Link>
                  {rootPersonId === selectedPerson.id ? (
                    <div className="col-span-2 flex items-center justify-between px-3 py-1.5 rounded-md bg-[#E7F1EB] border border-[#1C4B3C]/30 text-[#1C4B3C] text-xs font-semibold">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" /> Marked as "You" (Tree Starter)
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setChangeRootSearch("");
                          setChangeRootModalOpen(true);
                        }}
                        className="text-[10px] text-[#1C4B3C] underline"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmSetMePerson(selectedPerson)}
                      className="col-span-2 min-h-[42px] flex items-center justify-center gap-1.5 rounded-lg border border-[#1C4B3C] bg-white text-[#1C4B3C] text-xs font-semibold py-2 transition-colors hover:bg-[#E7F1EB]"
                    >
                      <UserCheck className="w-3.5 h-3.5" /> Set as "You" (Tree Starter)
                    </button>
                  )}
                  <button type="button" onClick={() => openQuickAdd("parent")} className="rounded-md bg-[#D7E7DF] py-2 text-xs font-medium text-[#1C4B3C] hover:bg-[#c6ddd2] transition-colors">+ Parent</button>
                  <button type="button" onClick={() => openQuickAdd("sibling")} className="rounded-md bg-[#D7E7DF] py-2 text-xs font-medium text-[#1C4B3C] hover:bg-[#c6ddd2] transition-colors">+ Sibling</button>
                  <button type="button" onClick={() => openQuickAdd("spouse")} className="rounded-md bg-[#D7E7DF] py-2 text-xs font-medium text-[#1C4B3C] hover:bg-[#c6ddd2] transition-colors">+ Partner</button>
                  <button type="button" onClick={() => openQuickAdd("child")} className="rounded-md bg-[#D7E7DF] py-2 text-xs font-medium text-[#1C4B3C] hover:bg-[#c6ddd2] transition-colors">+ Child</button>
                </div>
              </div>
            )}
          </section>
        )}

        <main className="flex-1 min-h-0 flex flex-col min-w-0">
          <div className="flex items-center justify-between gap-2.5 sm:gap-4 px-3 sm:px-6 lg:px-10 py-2.5 sm:py-3.5 border-b border-[#E7E2D6] bg-white/80 backdrop-blur-xs flex-wrap">
            <div>
              <h1 className="text-base sm:text-xl font-serif font-bold text-[#1C1F1D] tracking-tight">Your family tree</h1>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {/* Search */}
              <form onSubmit={handleSearch} className="relative">
                <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="text-xs rounded-lg border border-[#D9D3C3] bg-white pl-8 pr-2.5 py-1.5 w-24 xs:w-32 sm:w-36 focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 focus:border-[#1C4B3C]"
                />
              </form>

              {/* Back to Me button (always available whenever rootPerson exists) */}
              {rootPerson && (
                <button
                  type="button"
                  onClick={handleBackToMe}
                  title={`Move view back to Me (${rootPerson.name})`}
                  className="flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 sm:px-3 py-1.5 bg-[#1C4B3C] text-white hover:bg-[#163C30] active:scale-95 shadow-2xs transition-all shrink-0"
                >
                  <LocateFixed className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Back to Me</span>
                </button>
              )}

              {/* Set as Me button when any node in the tree is selected */}
              {selectedPerson && selectedPerson.id !== rootPersonId && (
                <button
                  type="button"
                  onClick={() => setConfirmSetMePerson(selectedPerson)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#1C4B3C] bg-[#E7F1EB] hover:bg-[#D7E7DF] border border-[#1C4B3C]/40 rounded-lg px-2.5 sm:px-3 py-1.5 shadow-2xs transition-all shrink-0 animate-in fade-in"
                  title={`Set ${selectedPerson.name} as "Me" (Tree starter)`}
                >
                  <UserCheck className="w-3.5 h-3.5 text-[#1C4B3C] shrink-0" />
                  <span className="whitespace-nowrap">Set as Me</span>
                  <span className="hidden md:inline font-normal text-[#1C4B3C]/80 truncate max-w-[120px]">
                    ({selectedPerson.name})
                  </span>
                </button>
              )}

              {/* If selected person is currently Root */}
              {selectedPerson && selectedPerson.id === rootPersonId && (
                <span className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-[#1C4B3C] bg-[#E7F1EB] border border-[#1C4B3C]/25 rounded-lg px-2.5 py-1.5 shrink-0">
                  <Check className="w-3.5 h-3.5" />
                  <span>You ({rootPerson.name})</span>
                </span>
              )}

              {/* Short family vs Full tree mode */}
              <button
                type="button"
                onClick={() => setFocusedView((value) => !value)}
                title={focusedView ? "Switch to viewing the complete tree across all branches" : "Switch to viewing the selected person's immediate short family"}
                className={`hidden xs:flex items-center gap-1 text-xs border rounded-lg px-2 sm:px-2.5 py-1.5 transition-colors ${
                  focusedView
                    ? "border-[#1C4B3C] bg-[#E7F1EB] text-[#1C4B3C] font-semibold"
                    : "border-[#D9D3C3] bg-white text-[#374151] hover:bg-[#F0EDE3]"
                }`}
              >
                <Focus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{focusedView ? "Short family" : "Full tree"}</span>
              </button>

              {/* Branch auto-accordion focus toggle */}
              <button
                type="button"
                onClick={() => setSmartAccordion((val) => !val)}
                title={
                  smartAccordion
                    ? "Branch focus is ON: Expanding a branch automatically collapses other sibling branches to keep the layout neat and prevent sprawling or overlapping."
                    : "Branch focus is OFF: Multiple sibling branches can remain open simultaneously."
                }
                className={`hidden md:flex items-center gap-1 text-xs border rounded-lg px-2 sm:px-2.5 py-1.5 transition-colors shadow-2xs ${
                  smartAccordion
                    ? "border-[#1C4B3C] bg-[#E7F1EB] text-[#1C4B3C] font-semibold"
                    : "border-[#D9D3C3] bg-white text-[#374151] hover:bg-[#F0EDE3]"
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>{smartAccordion ? "Branch focus" : "Branch focus: off"}</span>
              </button>

              {/* Zoom controls */}
              <div className="flex items-center border border-[#D9D3C3] rounded-lg overflow-hidden bg-white shadow-2xs">
                <button
                  type="button"
                  onClick={zoomOut}
                  title="Zoom out"
                  className="p-1.5 hover:bg-[#F0EDE3] text-[#374151]"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] text-[#6B7280] w-8 sm:w-9 text-center select-none font-medium">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={zoomIn}
                  title="Zoom in"
                  className="p-1.5 hover:bg-[#F0EDE3] text-[#374151]"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Fit to screen */}
              <button
                type="button"
                onClick={fitToScreen}
                title="Fit to screen"
                className="hidden sm:flex items-center gap-1 text-xs text-[#374151] border border-[#D9D3C3] rounded-lg px-2 sm:px-2.5 py-1.5 bg-white hover:bg-[#F0EDE3] shadow-2xs"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Fit</span>
              </button>

              {/* Center selected */}
              <button
                type="button"
                onClick={() => centerPerson(selectedId || rootPersonId)}
                title="Center on selected person"
                className="p-1.5 text-[#374151] border border-[#D9D3C3] rounded-lg bg-white hover:bg-[#F0EDE3] shadow-2xs"
              >
                <LocateFixed className="w-3.5 h-3.5" />
              </button>

              {/* Fullscreen */}
              <button
                type="button"
                onClick={toggleFullscreen}
                title="Fullscreen canvas"
                className="hidden md:flex p-1.5 text-[#374151] border border-[#D9D3C3] rounded-lg bg-white hover:bg-[#F0EDE3] shadow-2xs"
              >
                <Focus className="w-3.5 h-3.5" />
              </button>

              {/* Print */}
              <button
                type="button"
                onClick={() => window.print()}
                title="Print this family tree"
                className="hidden md:flex items-center gap-1 text-xs text-[#374151] border border-[#D9D3C3] rounded-lg px-2.5 py-1.5 bg-white hover:bg-[#F0EDE3] shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>

              {/* Root Person Indicator when no one is selected */}
              {!selectedPerson && rootPerson && (
                <div className="relative hidden lg:block">
                  <button
                    type="button"
                    onClick={() => {
                      setChangeRootSearch("");
                      setChangeRootModalOpen(true);
                    }}
                    title="Change starting person ('You') for the tree"
                    className="flex items-center gap-1.5 text-xs text-[#1C1F1D] border border-[#1C4B3C]/35 rounded-lg px-2.5 py-1.5 bg-white hover:bg-[#E7F1EB] shadow-2xs transition-colors"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-[#1C4B3C]" />
                    <span>
                      You: <strong className="font-semibold text-[#1C4B3C]">{rootPerson.name}</strong>
                    </span>
                    <span className="text-[10px] text-[#1C4B3C] bg-[#E7F1EB] px-1.5 py-0.5 rounded font-semibold border border-[#1C4B3C]/20">
                      Change
                    </span>
                  </button>
                </div>
              )}

              {/* Mobile more options */}
              <div className="relative sm:hidden">
                <button
                  type="button"
                  onClick={() => setMobileToolsOpen((open) => !open)}
                  className="flex items-center gap-1 rounded-lg border border-[#D9D3C3] bg-white px-2.5 py-1.5 text-xs text-[#374151] shadow-2xs"
                  aria-expanded={mobileToolsOpen}
                >
                  <Menu className="h-3.5 w-3.5" /> More
                </button>
                {mobileToolsOpen && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-xl border border-[#D9D3C3] bg-white py-1 shadow-lg animate-in fade-in zoom-in-95">
                    <button
                      type="button"
                      onClick={() => {
                        setFocusedView((v) => !v);
                        setMobileToolsOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-[#374151] hover:bg-[#F7F5F0] flex items-center gap-2"
                    >
                      <Focus className="w-3.5 h-3.5 text-[#1C4B3C]" />
                      {focusedView ? "Full tree view" : "Nearby family view"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSmartAccordion((v) => !v);
                        setMobileToolsOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-[#374151] hover:bg-[#F7F5F0] flex items-center gap-2"
                    >
                      <GitBranch className="w-3.5 h-3.5 text-[#1C4B3C]" />
                      {smartAccordion ? "Branch focus: ON" : "Branch focus: OFF"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        fitToScreen();
                        setMobileToolsOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-[#374151] hover:bg-[#F7F5F0] flex items-center gap-2"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-[#374151]" /> Fit to screen
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        toggleFullscreen();
                        setMobileToolsOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-[#374151] hover:bg-[#F7F5F0] flex items-center gap-2"
                    >
                      <Focus className="w-3.5 h-3.5 text-[#374151]" /> Fullscreen
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        window.print();
                        setMobileToolsOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-[#374151] hover:bg-[#F7F5F0] flex items-center gap-2"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#374151]" /> Print tree
                    </button>
                    <div className="border-t border-[#F0EDE3] my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setChangeRootSearch("");
                        setChangeRootModalOpen(true);
                        setMobileToolsOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-[#1C4B3C] font-semibold hover:bg-[#F7F5F0] flex items-center gap-1.5"
                    >
                      <UserCheck className="h-3.5 w-3.5" /> Change "You" ({rootPerson?.name || "None"})
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {scopedPeople.length === 0 ? (
            <div className="m-8 border border-dashed border-[#C9BEA8] rounded-xl px-8 py-20 text-center">
              <p className="text-sm text-[#6B7280] mb-1">Nothing to show yet.</p>
              <p className="text-xs text-[#9CA3AF]">Add someone on the left and the tree will build itself.</p>
            </div>
          ) : (
            <div
              ref={scrollRef}
              onMouseDown={handleCanvasMouseDown}
              onWheel={handleCanvasWheel}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              className={`flex-1 overflow-auto px-6 lg:px-10 py-8 bg-white touch-none ${
                isPanning ? "cursor-grabbing select-none" : "cursor-grab"
              }`}
              style={{ backgroundImage: "radial-gradient(#DCE3E1 0.7px, transparent 0.7px)", backgroundSize: "16px 16px" }}
            >
              <div
                ref={containerRef}
                className="relative mx-auto origin-top-left"
                style={{
                  minWidth: layoutWidth,
                  minHeight: rows.length * ROW_HEIGHT + 32,
                  transform: `scale(${zoom})`,
                }}
              >
                <svg
                  className="absolute top-0 left-0 pointer-events-none overflow-visible"
                  width={size.w}
                  height={size.h}
                  style={{ width: "100%", height: "100%" }}
                >
                  {lines.map((line) =>
                    line.type === "spouse" ? (
                      <line
                        key={line.key}
                        x1={line.x1}
                        y1={line.y1}
                        x2={line.x2}
                        y2={line.y2}
                        stroke={line.onPath ? "#B8862E" : "#C9BEA8"}
                        strokeWidth={line.onPath ? 3 : 2}
                      />
                    ) : (
                      <path
                        key={line.key}
                        d={line.path}
                        fill="none"
                        stroke={line.onPath ? "#B8862E" : "#C9BEA8"}
                        strokeWidth={line.onPath ? 2.5 : line.type === "family-child" ? 2 : 1.5}
                      />
                    )
                  )}
                </svg>

                <div
                  className="relative"
                  style={{
                    height: rows.length * ROW_HEIGHT + 32,
                    minWidth: layoutWidth,
                  }}
                >
                  {rows.map((row, i) => (
                    <div
                      key={`${row.componentIndex}-${i}`}
                      className="absolute left-0 right-0"
                      style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
                    >
                      {row.people.map(({ person, x }) => {
                        return (
                          <div
                            key={person.id}
                            className="absolute top-0"
                            style={{ left: x }}
                          >
                            <PersonCard
                              person={person}
                              cardRef={(el) => (cardRefs.current[person.id] = el)}
                              highlighted={highlightId === person.id}
                              onPath={pathIdSet.has(person.id)}
                              isRoot={rootPersonId === person.id}
                              isSelected={selectedId === person.id}
                              onSelect={handleSelectPerson}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {!focusedView &&
                    collapseControls.map((control) => (
                      <button
                        key={control.key}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCollapse(control.key);
                        }}
                        title={control.collapsed ? "Show this family's children" : "Hide this family's children"}
                        aria-label={control.collapsed ? "Show this family's children" : "Hide this family's children"}
                        className="absolute z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[#174F61] text-white shadow-md hover:bg-[#1C4B3C] focus:outline-none focus:ring-2 focus:ring-[#174F61]/40"
                        style={{ left: control.x, top: control.y }}
                      >
                        {control.collapsed ? <Plus className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {quickRelation && selectedPerson && (
        <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-[#1C1F1D]/30 p-4" onMouseDown={closeQuickAdd}>
          <form
            onSubmit={submitQuickAdd}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl bg-white shadow-xl border border-[#E7E2D6] p-5"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-[#1C4B3C]/10 flex items-center justify-center shrink-0">
                <UserPlus className="w-4 h-4 text-[#1C4B3C]" />
              </div>
              <div>
                <h2 className="text-base font-serif font-bold text-[#1C1F1D]">
                  Add {quickRelation === "spouse" ? "a partner" : quickRelation === "parent" ? "a parent" : `a ${quickRelation}`}
                </h2>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  {quickRelation === "child"
                    ? `Choose which partner family ${selectedPerson.name} belongs to.`
                    : quickRelation === "sibling"
                    ? `This sibling will share the selected parent family.`
                    : `The new person will be linked directly to ${selectedPerson.name}.`}
                </p>
              </div>
            </div>

            {quickError && <p className="mb-3 rounded-lg bg-[#FBEAE1] px-3 py-2 text-xs text-[#B3441C]">{quickError}</p>}
            {quickSuccess && <p className="mb-3 rounded-lg bg-[#E7F3ED] px-3 py-2 text-xs text-[#1C4B3C]">{quickSuccess}</p>}

            {quickRelation === "parent" && (
              <>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Parent family</label>
                <select value={quickFamilyId} onChange={(e) => setQuickFamilyId(e.target.value)} className={inputClass}>
                  {parentFamilyOptions.length > 1 && <option value="">Choose a parent family…</option>}
                  {parentFamilyOptions.map((family) => (
                    <option key={family.id} value={family.id}>{familyLabel(family)}</option>
                  ))}
                  <option value="new-family">Create a new parent family</option>
                </select>
                <label className="block text-xs font-medium text-[#374151] mt-3 mb-1.5">Parent type</label>
                <select
                  value={quickParentType}
                  onChange={(e) => {
                    setQuickParentType(e.target.value);
                    setQuickGender(e.target.value === "father" ? "male" : e.target.value === "mother" ? "female" : "unspecified");
                  }}
                  className={inputClass}
                >
                  <option value="parent">Parent</option>
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                </select>
                <label className="block text-xs font-medium text-[#374151] mt-3 mb-1.5">Relationship to this family</label>
                <select value={quickFamilyRelationship} onChange={(e) => setQuickFamilyRelationship(e.target.value)} className={inputClass}>
                  <option value="biological">Biological</option>
                  <option value="adoptive">Adoptive</option>
                  <option value="step">Step-parent</option>
                  <option value="unknown">Unknown</option>
                </select>
              </>
            )}

            {quickRelation === "sibling" && (
              <>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Shared parent family</label>
                <select value={quickFamilyId} onChange={(e) => setQuickFamilyId(e.target.value)} className={inputClass}>
                  {parentFamilyOptions.length === 0 && <option value="">No parent family available</option>}
                  {parentFamilyOptions.length > 1 && <option value="">Choose a parent family…</option>}
                  {selectedPerson.parentFamilies?.map((family) => (
                    <option key={family.id} value={family.id}>{familyLabel(family)}</option>
                  ))}
                  <option value="new-family">Different / unknown parent family</option>
                </select>
                <label className="block text-xs font-medium text-[#374151] mt-3 mb-1.5">Sibling relationship</label>
                <select value={quickFamilyRelationship} onChange={(e) => setQuickFamilyRelationship(e.target.value)} className={inputClass}>
                  <option value="biological">Biological sibling</option>
                  <option value="adoptive">Adoptive sibling</option>
                  <option value="step">Step-sibling</option>
                  <option value="unknown">Unknown</option>
                </select>
              </>
            )}

            {quickRelation === "child" && (
              <>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Partner for this child</label>
                <select value={quickFamilyId} onChange={(e) => setQuickFamilyId(e.target.value)} className={inputClass}>
                  {childFamilyOptions.length > 1 && <option value="">Choose a partner family…</option>}
                  {childFamilyOptions.map((family) => (
                    <option key={family.id} value={family.id}>{familyLabel(family)}</option>
                  ))}
                  <option value="no-partner">No partner / just {selectedPerson.name}</option>
                  <option value="different-partner">Different partner — add partner first</option>
                </select>
                {quickFamilyId === "different-partner" && (
                  <div className="mt-3 rounded-lg border border-[#DCE3E1] bg-[#F7F9F7] p-3">
                    <p className="text-xs text-[#5A6980] mb-2">Add or select the partner first. The child form stays open after that.</p>
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => { setQuickPartnerMode("add"); setQuickPartnerId(""); }}
                        className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium ${quickPartnerMode === "add" ? "bg-[#1C4B3C] text-white" : "bg-white text-[#5A6980] border border-[#DCE3E1]"}`}
                      >
                        Add partner
                      </button>
                      <button
                        type="button"
                        onClick={() => { setQuickPartnerMode("select"); setQuickPartnerName(""); }}
                        className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium ${quickPartnerMode === "select" ? "bg-[#1C4B3C] text-white" : "bg-white text-[#5A6980] border border-[#DCE3E1]"}`}
                      >
                        Select existing
                      </button>
                    </div>
                    {quickPartnerMode === "add" ? (
                      <>
                        <input
                          value={quickPartnerName}
                          onChange={(e) => setQuickPartnerName(e.target.value)}
                          placeholder="Partner's full name"
                          className={inputClass}
                        />
                        <button
                          type="button"
                          onClick={addPartnerBeforeChild}
                          disabled={quickPartnerSaving}
                          className="mt-2 w-full rounded-lg border border-[#1C4B3C]/30 py-2 text-xs font-medium text-[#1C4B3C] hover:bg-white disabled:opacity-60"
                        >
                          {quickPartnerSaving ? "Adding partner…" : "Add partner and continue"}
                        </button>
                      </>
                    ) : (
                      <select
                        value={quickPartnerId}
                        onChange={(e) => setQuickPartnerId(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Select an existing person…</option>
                        {people
                          .filter((person) => person.id !== selectedPerson.id)
                          .map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                      </select>
                    )}
                  </div>
                )}
                <label className="block text-xs font-medium text-[#374151] mt-3 mb-1.5">Child relationship</label>
                <select value={quickFamilyRelationship} onChange={(e) => setQuickFamilyRelationship(e.target.value)} className={inputClass}>
                  <option value="biological">Biological child</option>
                  <option value="adoptive">Adopted child</option>
                  <option value="step">Stepchild</option>
                  <option value="unknown">Unknown</option>
                </select>
              </>
            )}

            {quickRelation === "spouse" && (
              <div className="mb-4 rounded-lg border border-[#DCE3E1] bg-[#F7F9F7] p-3">
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => { setQuickPartnerMode("add"); setQuickPartnerId(""); }}
                    className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium ${quickPartnerMode === "add" ? "bg-[#1C4B3C] text-white" : "bg-white text-[#5A6980] border border-[#DCE3E1]"}`}
                  >
                    Add new
                  </button>
                  <button
                    type="button"
                    onClick={() => { setQuickPartnerMode("select"); setQuickName(""); }}
                    className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium ${quickPartnerMode === "select" ? "bg-[#1C4B3C] text-white" : "bg-white text-[#5A6980] border border-[#DCE3E1]"}`}
                  >
                    Link existing
                  </button>
                </div>
                {quickPartnerMode === "select" && (
                  <select
                    value={quickPartnerId}
                    onChange={(e) => setQuickPartnerId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select an existing person…</option>
                    {people
                      .filter((person) => person.id !== selectedPerson.id)
                      .map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                )}
              </div>
            )}

            {!(quickRelation === "spouse" && quickPartnerMode === "select") && (
              <>
                <label className="block text-xs font-medium text-[#374151] mb-1.5" htmlFor="quick-relative-name">Full name</label>
                <input
                  id="quick-relative-name"
                  autoFocus
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder="e.g. Asha Rao"
                  className={inputClass}
                />

                <label className="block text-xs font-medium text-[#374151] mt-3 mb-1.5" htmlFor="quick-relative-gender">Gender</label>
                <select id="quick-relative-gender" value={quickGender} onChange={(e) => setQuickGender(e.target.value)} className={inputClass}>
                  <option value="unspecified">Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </>
            )}
            {quickRelation === "spouse" && (
              <>
                <label className="block text-xs font-medium text-[#374151] mt-3 mb-1.5">Partner status</label>
                <select value={quickPartnerStatus} onChange={(e) => setQuickPartnerStatus(e.target.value)} className={inputClass}>
                  <option value="partner">Partner</option>
                  <option value="married">Married</option>
                  <option value="separated">Separated</option>
                  <option value="divorced">Divorced / remarriage history</option>
                  <option value="unknown">Unknown</option>
                </select>
              </>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={closeQuickAdd} className="text-xs font-medium text-[#6B7280] px-3 py-2 hover:text-[#1C1F1D]">Cancel</button>
              {quickRelation === "child" && quickSuccess && (
                <button type="button" onClick={closeQuickAdd} className="text-xs font-medium text-[#1C4B3C] px-3 py-2 hover:underline">Done</button>
              )}
              <button type="submit" disabled={quickSaving} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1C4B3C] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#163C30] disabled:opacity-60">
                {quickSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {quickRelation === "spouse" && quickPartnerMode === "select"
                  ? "Link partner"
                  : quickRelation === "child" && quickSuccess
                  ? "Add another child"
                  : "Add to tree"}
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Change Root Person ("You") Modal */}
      {changeRootModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setChangeRootModalOpen(false)}>
          <div
            className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-[#E7E2D6] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E7E2D6] px-5 py-4 bg-[#F7F9F7]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#1C4B3C]/10 flex items-center justify-center">
                  <UserCheck className="w-4 h-4 text-[#1C4B3C]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#1C1F1D]">Change Starting Person ("You")</h3>
                  <p className="text-[11px] text-[#6B7280]">Select who should be the reference point for relationships</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChangeRootModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7280] hover:bg-[#EAE6DD]"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b border-[#E7E2D6]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={changeRootSearch}
                  onChange={(e) => setChangeRootSearch(e.target.value)}
                  placeholder="Filter by name…"
                  className="w-full text-xs rounded-lg border border-[#D9D3C3] pl-8 pr-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 focus:border-[#1C4B3C]"
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto p-2 divide-y divide-[#F0EDE3]">
              {people
                .filter((p) => !changeRootSearch || p.name.toLowerCase().includes(changeRootSearch.toLowerCase()))
                .map((p) => {
                  const isCurrent = p.id === rootPersonId;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg transition-colors ${
                        isCurrent ? "bg-[#E7F1EB]" : "hover:bg-[#F7F5F0]"
                      }`}
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#EDF4F3] border border-[#1C4B3C]/20 flex items-center justify-center text-xs font-semibold text-[#1C4B3C]">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#1C1F1D] truncate">{p.name}</p>
                          <p className="text-[10px] text-[#6B7280]">
                            {p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : "Person"}
                            {p.dob ? ` · Born ${p.dob.slice(0, 4)}` : ""}
                          </p>
                        </div>
                      </div>
                      {isCurrent ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-[#1C4B3C] bg-white border border-[#1C4B3C]/30 px-2 py-1 rounded-md">
                          <Check className="w-3 h-3" /> Current "You"
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setChangeRootModalOpen(false);
                            setConfirmSetMePerson(p);
                          }}
                          className="text-[11px] font-semibold text-white bg-[#1C4B3C] hover:bg-[#163C30] px-2.5 py-1 rounded-md shadow-2xs"
                        >
                          Set as "You"
                        </button>
                      )}
                    </div>
                  );
                })}
              {people.filter((p) => !changeRootSearch || p.name.toLowerCase().includes(changeRootSearch.toLowerCase())).length === 0 && (
                <div className="p-4 text-center text-xs text-[#6B7280]">
                  No matching people found.
                </div>
              )}
            </div>

            <div className="bg-[#F7F9F7] px-4 py-3 border-t border-[#E7E2D6] flex justify-end">
              <button
                type="button"
                onClick={() => setChangeRootModalOpen(false)}
                className="text-xs font-medium text-[#5A6980] hover:text-[#1C1F1D] px-3 py-1.5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set as "Me" Confirmation Modal */}
      {confirmSetMePerson && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setConfirmSetMePerson(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#E7E2D6] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#E7F1EB] text-[#1C4B3C] flex items-center justify-center shrink-0 mt-0.5">
                <UserCheck className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-serif font-bold text-[#1C1F1D]">
                  Set {confirmSetMePerson.name} as "Me"?
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Confirm change of the tree's starting person
                </p>
              </div>
            </div>

            <p className="text-sm text-[#374151] mb-6 leading-relaxed">
              Are you sure you want to set <strong className="font-semibold text-[#1C1F1D]">{confirmSetMePerson.name}</strong> as <strong>"Me"</strong>? 
              The family tree will re-orient around them, with relationship paths and generational levels calculated from their perspective.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmSetMePerson(null)}
                className="px-4 py-2 text-xs font-medium text-[#6B7280] hover:text-[#1C1F1D] hover:bg-[#F7F5F0] rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = confirmSetMePerson.id;
                  setRootPersonId(targetId);
                  setSelectedId(targetId);
                  setFocusedView(true);
                  setCollapsedFamilyKeys(new Set());
                  uncollapseImmediateFamily(targetId);
                  setConfirmSetMePerson(null);
                  requestAnimationFrame(() => centerPerson(targetId));
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#1C4B3C] hover:bg-[#163C30] rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Yes, set as Me</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <RelationshipChat
        people={people}
        rootPersonId={rootPersonId}
        selectedPerson={selectedPerson}
        selectedRelationship={relationship}
        defaultOpen={searchParams.get("guide") === "1"}
        isMobileSheetOpen={Boolean(selectedPerson)}
        isMobileSheetMinimized={mobileSheetMinimized}
      />
    </div>
  );
}
