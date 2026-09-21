import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useAuth } from "../AuthContext.jsx";
import { api } from "../api.js";

const FamilyContext = createContext(null);

// Maps the backend's snake_case Person (with parent_ids/spouse_ids derived
// from Family Units) onto the field names the tree layout and forms expect.
function mapPerson(person) {
  return {
    ...person,
    dob: person.date_of_birth || "",
    dod: person.date_of_death || "",
    notes: person.bio || "",
    address: person.address || "",
    phone: person.phone || "",
    parentIds: person.parent_ids || [],
    spouseIds: person.spouse_ids || [],
    parentFamilies: person.parent_families || [],
    partnerFamilies: person.partner_families || [],
  };
}

// "Who are you?" — the tree needs one reference point to describe every
// other person's relationship from ("your grandmother", "your cousin"...).
// Stored per-account in localStorage rather than the backend since it's a
// pure viewing preference, not family data other people would ever need.
function rootStorageKey(userId) {
  return `rootline:root-person:${userId}`;
}

/** Key used to persist which tree was last active for this user. */
function activeTreeStorageKey(userId) {
  return `rootline:active-tree:${userId}`;
}

export function FamilyProvider({ children }) {
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [rootPersonId, setRootPersonIdState] = useState(null);

  // ── Tree state ──────────────────────────────────────────────────────────
  /** { owned_trees: TreeOut[], shared_trees: TreeOut[] } */
  const [treeList, setTreeList] = useState({ owned_trees: [], shared_trees: [] });
  /** UUID string of the currently viewed tree, or null = default (own) tree */
  const [activeTreeId, setActiveTreeIdState] = useState(null);
  /** "owner" | "editor" | "viewer" for the active tree */
  const [myRole, setMyRole] = useState("owner");

  // ── Load tree list whenever the user changes ─────────────────────────
  const refreshTreeList = useCallback(async () => {
    if (!user) {
      setTreeList({ owned_trees: [], shared_trees: [] });
      return;
    }
    try {
      const data = await api.listTrees();
      setTreeList(data);
      return data;
    } catch (_) {
      // Non-fatal — keep whatever we had
    }
  }, [user]);

  useEffect(() => {
    refreshTreeList();
  }, [refreshTreeList]);

  // Restore the last active tree from localStorage
  useEffect(() => {
    if (!user?.id) {
      setActiveTreeIdState(null);
      setMyRole("owner");
      return;
    }
    const saved = localStorage.getItem(activeTreeStorageKey(user.id));
    setActiveTreeIdState(saved || null);
  }, [user?.id]);

  /** Switch the active tree. Accepts a tree UUID string (or null = own default). */
  const setActiveTreeId = useCallback(
    (treeId) => {
      setActiveTreeIdState(treeId);
      if (user?.id) {
        if (treeId) localStorage.setItem(activeTreeStorageKey(user.id), treeId);
        else localStorage.removeItem(activeTreeStorageKey(user.id));
      }
    },
    [user?.id]
  );

  // Derive role from tree list whenever activeTreeId or treeList changes
  useEffect(() => {
    if (!activeTreeId) {
      setMyRole("owner");
      return;
    }
    const owned = treeList.owned_trees.find((t) => t.id === activeTreeId);
    if (owned) {
      setMyRole("owner");
      return;
    }
    const shared = treeList.shared_trees.find((t) => t.id === activeTreeId);
    if (shared) {
      setMyRole(shared.role);
      return;
    }
    // Tree not found in list — default to viewer (safe)
    setMyRole("viewer");
  }, [activeTreeId, treeList]);

  /** Convenience flags derived from the current role. */
  const canEdit = myRole === "owner" || myRole === "editor";
  const canManage = myRole === "owner";

  // ── Active tree record ─────────────────────────────────────────────────
  const activeTree = useMemo(() => {
    if (!activeTreeId) {
      return treeList.owned_trees[0] || null;
    }
    return (
      treeList.owned_trees.find((t) => t.id === activeTreeId) ||
      treeList.shared_trees.find((t) => t.id === activeTreeId) ||
      null
    );
  }, [activeTreeId, treeList]);

  // ── People for the active tree ─────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!user) {
      setPeople([]);
      setLoaded(true);
      return;
    }
    try {
      const data = await api.listPeople(activeTreeId || undefined);
      setPeople(data.map(mapPerson));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoaded(true);
    }
  }, [user, activeTreeId]);

  useEffect(() => {
    setLoaded(false);
    refresh();
  }, [refresh, user?.id]);

  // Load the saved root person for this account once we know who's logged
  // in; falls back to the oldest-created person (usually the one the user
  // added first, i.e. themself) until they explicitly pick someone else.
  useEffect(() => {
    if (!user?.id) {
      setRootPersonIdState(null);
      return;
    }
    const saved = localStorage.getItem(rootStorageKey(user.id));
    setRootPersonIdState(saved || null);
  }, [user?.id]);

  const setRootPersonId = useCallback(
    (id) => {
      setRootPersonIdState(id);
      if (user?.id) {
        if (id) localStorage.setItem(rootStorageKey(user.id), id);
        else localStorage.removeItem(rootStorageKey(user.id));
      }
    },
    [user?.id]
  );

  // Effective root: the saved choice if it still exists, otherwise the
  // earliest-added person, otherwise nothing (empty tree).
  const effectiveRootPersonId = useCallback(() => {
    if (rootPersonId && people.some((p) => p.id === rootPersonId)) return rootPersonId;
    return people[0]?.id || null;
  }, [rootPersonId, people]);

  // Issue #34: Memoized byId lookup map so getPerson is O(1) instead of repeated linear scans.
  const peopleById = useMemo(() => {
    const map = new Map();
    for (const p of people) {
      map.set(p.id, p);
    }
    return map;
  }, [people]);

  const getPerson = useCallback((id) => peopleById.get(id) || null, [peopleById]);

  const addPerson = useCallback(
    async (details, relation) => {
      const payload = {
        name: details.name,
        gender: details.gender && details.gender !== "unspecified" ? details.gender : null,
        date_of_birth: details.dob || null,
        date_of_death: details.dod || null,
        bio: details.notes || null,
        address: details.address || null,
        phone: details.phone || null,
        photo_url: details.photo_url || null,
        relation_type: relation?.type || null,
        related_to_id: relation?.toId || null,
        family_id: relation?.familyId || null,
        partner_id: relation?.partnerId || null,
        family_relationship: relation?.familyRelationship || null,
        partner_status: relation?.partnerStatus || null,
        new_family: Boolean(relation?.newFamily),
      };
      const created = await api.createPerson(payload, activeTreeId || undefined);
      // A relation can change other people's parent/spouse lists too
      // (e.g. a new spouse links back to the existing partner), so
      // refresh the whole list rather than patching just the new node.
      await refresh();
      return created.id;
    },
    [refresh, activeTreeId]
  );

  const updatePerson = useCallback(
    async (id, details) => {
      const payload = {
        name: details.name,
        gender: details.gender && details.gender !== "unspecified" ? details.gender : null,
        date_of_birth: details.dob || null,
        date_of_death: details.dod || null,
        bio: details.notes || null,
        address: details.address || null,
        phone: details.phone || null,
        photo_url: details.photo_url || null,
      };
      const updated = await api.updatePerson(id, payload);
      setPeople((prev) => prev.map((p) => (p.id === id ? mapPerson(updated) : p)));
    },
    []
  );

  const linkPeople = useCallback(
    async (firstPersonId, secondPersonId, relationshipStatus = "partner") => {
      await api.linkPeople(
        {
          first_person_id: firstPersonId,
          second_person_id: secondPersonId,
          relationship_type: "spouse",
          relationship_status: relationshipStatus,
        },
        activeTreeId || undefined
      );
      await refresh();
    },
    [refresh, activeTreeId]
  );

  const deletePerson = useCallback(
    async (id) => {
      await api.deletePerson(id);
      await refresh();
    },
    [refresh]
  );

  const childrenOf = useCallback(
    (id) => people.filter((p) => p.parentIds.includes(id)),
    [people]
  );

  const siblingsOf = useCallback(
    (id) => {
      const person = getPerson(id);
      if (!person || person.parentIds.length === 0) return [];
      return people.filter(
        (p) => p.id !== id && p.parentIds.some((pid) => person.parentIds.includes(pid))
      );
    },
    [people, getPerson]
  );

  return (
    <FamilyContext.Provider
      value={{
        people,
        loaded,
        error,
        addPerson,
        linkPeople,
        updatePerson,
        deletePerson,
        getPerson,
        childrenOf,
        siblingsOf,
        rootPersonId: effectiveRootPersonId(),
        setRootPersonId,
        // ── Sharing / multi-tree ──────────────────────────────────────
        activeTreeId,
        setActiveTreeId,
        activeTree,
        myRole,
        canEdit,
        canManage,
        treeList,
        refreshTreeList,
        refresh,
      }}
    >
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error("useFamily must be used within a FamilyProvider");
  return ctx;
}
