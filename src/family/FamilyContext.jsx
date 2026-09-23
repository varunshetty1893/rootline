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
function rootStorageKey(userId, treeId) {
  return `rootline:root-person:${userId}${treeId ? `:${treeId}` : ""}`;
}

/** Key used to persist which tree was last active for this user. */
function activeTreeStorageKey(userId) {
  return `rootline:active-tree:${userId}`;
}

/** Key used to cache tree list for instant rendering and offline resilience. */
function treeListStorageKey(userId) {
  return `rootline:treelist:${userId}`;
}

function normalizeTreeList(raw, currentUserId) {
  if (!raw || typeof raw !== "object") {
    return { owned_trees: [], shared_trees: [], owned: null, shared: [] };
  }

  let owned_trees = [];
  let shared_trees = [];

  if (Array.isArray(raw.owned_trees)) {
    owned_trees = [...raw.owned_trees];
  } else if (raw.owned?.family) {
    owned_trees = [
      {
        id: raw.owned.family.id,
        name: raw.owned.family.name,
        owner_id: raw.owned.family.owner_id,
        role: "owner",
        people_count: raw.owned.people_count ?? 0,
      },
    ];
  }

  if (Array.isArray(raw.shared_trees)) {
    shared_trees = [...raw.shared_trees];
  } else if (Array.isArray(raw.shared)) {
    shared_trees = raw.shared.map((s) => ({
      id: s.family?.id || s.id,
      name: s.family?.name || s.name || "Shared Tree",
      owner_id: s.family?.owner_id || s.owner_id,
      owner_name: s.owner?.name || s.owner_name || "Owner",
      role: s.role || "viewer",
      people_count: s.people_count ?? 0,
    }));
  }

  // CRITICAL SANITIZATION: If any tree in shared_trees belongs to the user, MOVE IT to owned_trees!
  if (currentUserId) {
    const ownedIds = new Set(owned_trees.map((t) => t.id));
    ownedIds.add(currentUserId);

    const actualShared = [];
    for (const tree of shared_trees) {
      if (tree.owner_id === currentUserId || tree.id === currentUserId || ownedIds.has(tree.id)) {
        if (!owned_trees.some((t) => t.id === tree.id)) {
          owned_trees.push({
            ...tree,
            role: "owner",
            isOwned: true,
            owner_id: currentUserId,
          });
        }
      } else {
        actualShared.push(tree);
      }
    }
    shared_trees = actualShared;
  }

  return {
    ...raw,
    owned_trees,
    shared_trees,
  };
}

export function FamilyProvider({ children }) {
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [rootPersonId, setRootPersonIdState] = useState(null);

  // ── Tree state ──────────────────────────────────────────────────────────
  /** { owned_trees: TreeOut[], shared_trees: TreeOut[] } */
  const [treeList, setTreeList] = useState(() => {
    if (typeof window !== "undefined" && user?.id) {
      try {
        const cached = localStorage.getItem(treeListStorageKey(user.id));
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && (parsed.owned_trees?.length > 0 || parsed.shared_trees?.length > 0)) {
            return normalizeTreeList(parsed, user.id);
          }
        }
      } catch (_) {}
    }
    return { owned_trees: [], shared_trees: [] };
  });
  const [treesLoading, setTreesLoading] = useState(true);
  /** UUID string of the currently viewed tree, or null = default (own) tree */
  const [activeTreeId, setActiveTreeIdState] = useState(null);
  /** "owner" | "editor" | "viewer" for the active tree */
  const [myRole, setMyRole] = useState("owner");

  // ── Load tree list whenever the user changes ─────────────────────────
  const refreshTreeList = useCallback(async () => {
    if (!user) {
      setTreeList({ owned_trees: [], shared_trees: [] });
      setTreesLoading(false);
      return;
    }
    try {
      // Hydrate from localStorage cache immediately if state is empty
      if (typeof window !== "undefined") {
        try {
          const cached = localStorage.getItem(treeListStorageKey(user.id));
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && (parsed.owned_trees?.length > 0 || parsed.shared_trees?.length > 0)) {
              setTreeList(normalizeTreeList(parsed, user.id));
              setTreesLoading(false);
            }
          }
        } catch (_) {}
      }

      const data = await api.listTrees();
      const normalized = normalizeTreeList(data, user.id);
      setTreeList(normalized);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(treeListStorageKey(user.id), JSON.stringify(normalized));
        } catch (_) {}
      }
      return normalized;
    } catch (_) {
      // Non-fatal — keep whatever we had
    } finally {
      setTreesLoading(false);
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
    if (!activeTreeId || activeTreeId === user?.id) {
      setMyRole("owner");
      return;
    }
    const ownedTrees = treeList?.owned_trees || [];
    const sharedTrees = treeList?.shared_trees || [];

    const owned = ownedTrees.find((t) => t.id === activeTreeId || t.owner_id === user?.id);
    if (owned) {
      setMyRole("owner");
      return;
    }
    const shared = sharedTrees.find(
      (t) => t.id === activeTreeId && t.owner_id !== user?.id && t.id !== user?.id
    );
    if (shared) {
      setMyRole(shared.role || "viewer");
      return;
    }
    // If tree list is still loading, don't drop to viewer prematurely
    if (treesLoading) {
      return;
    }
    // Default safe fallback for user's created/active tree is owner
    setMyRole("owner");
  }, [activeTreeId, treeList, user?.id, treesLoading]);

  /** Convenience flags derived from the current role. */
  const canEdit = myRole === "owner" || myRole === "editor";
  const canManage = myRole === "owner";

  // ── Active tree record ─────────────────────────────────────────────────
  const activeTree = useMemo(() => {
    const ownedTrees = treeList?.owned_trees || [];
    const sharedTrees = treeList?.shared_trees || [];
    if (!activeTreeId) {
      return (
        ownedTrees[0] || {
          id: user?.id || "default",
          name: `${user?.name || "My"}'s Family Tree`,
          owner_id: user?.id,
          role: "owner",
          isOwned: true,
          people_count: people?.length || 0,
        }
      );
    }
    const found =
      ownedTrees.find((t) => t.id === activeTreeId) ||
      sharedTrees.find((t) => t.id === activeTreeId);
    if (found) {
      const isOwned = found.isOwned ?? (found.owner_id === user?.id || found.id === user?.id || myRole === "owner");
      return {
        ...found,
        isOwned,
        role: isOwned ? "owner" : (found.role || myRole || "viewer"),
      };
    }

    // Resilient fallback: activeTreeId is selected
    const isOwned = myRole === "owner" || activeTreeId === user?.id;
    return {
      id: activeTreeId,
      name: `${user?.name || "My"}'s Family Tree`,
      owner_id: user?.id,
      role: isOwned ? "owner" : (myRole || "viewer"),
      isOwned,
      people_count: people?.length || 0,
    };
  }, [activeTreeId, treeList, myRole, user?.id, user?.name, people?.length]);

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

  // Load the saved root person for this account and tree once loaded.
  useEffect(() => {
    if (!user?.id) {
      setRootPersonIdState(null);
      return;
    }
    const treeKey = rootStorageKey(user.id, activeTreeId);
    const globalKey = rootStorageKey(user.id);
    const saved = localStorage.getItem(treeKey) || localStorage.getItem(globalKey);
    setRootPersonIdState(saved || null);
  }, [user?.id, activeTreeId]);

  const setRootPersonId = useCallback(
    (id) => {
      setRootPersonIdState(id);
      if (user?.id) {
        const treeKey = rootStorageKey(user.id, activeTreeId);
        const globalKey = rootStorageKey(user.id);
        if (id) {
          localStorage.setItem(treeKey, id);
          localStorage.setItem(globalKey, id);
        } else {
          localStorage.removeItem(treeKey);
          localStorage.removeItem(globalKey);
        }
      }
    },
    [user?.id, activeTreeId]
  );

  // Effective root:
  // 1. Explicitly chosen person if they still exist in the tree.
  // 2. Who started the tree: person matching the user who created/started the tree.
  // 3. Fallback to earliest-added person.
  const effectiveRootPersonId = useCallback(() => {
    if (rootPersonId && people.some((p) => p.id === rootPersonId)) return rootPersonId;

    if (user && people.length > 0) {
      const cleanUserName = (user?.name || "").trim().toLowerCase();
      if (cleanUserName) {
        // Exact match first
        const exact = people.find((p) => (p?.name || "").trim().toLowerCase() === cleanUserName);
        if (exact) return exact.id;

        // Substring / first name match (e.g. user "Varun Shetty" matching person "Varun")
        const userParts = cleanUserName.split(/\s+/).filter(Boolean);
        const matchPart = people.find((p) => {
          const pName = (p?.name || "").trim().toLowerCase();
          const pParts = pName.split(/\s+/).filter(Boolean);
          return (
            (userParts[0] && pParts[0] === userParts[0]) ||
            cleanUserName.includes(pName) ||
            pName.includes(userParts[0] || "")
          );
        });
        if (matchPart) return matchPart.id;
      }

      // Check if notes/bio mention "You" or "Self"
      const selfPerson = people.find((p) => {
        const notes = (p?.notes || p?.bio || "").toLowerCase();
        return notes.includes("you") || notes.includes("self");
      });
      if (selfPerson) return selfPerson.id;
    }

    return people[0]?.id || null;
  }, [rootPersonId, people, user]);

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
      if (people.length === 0 && created?.id) {
        setRootPersonId(created.id);
      }
      // A relation can change other people's parent/spouse lists too
      // (e.g. a new spouse links back to the existing partner), so
      // refresh the whole list rather than patching just the new node.
      await refresh();
      return created.id;
    },
    [refresh, activeTreeId, people.length, setRootPersonId]
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

  const createTree = useCallback(
    async (name, firstPersonData) => {
      const treeName = typeof name === "string" ? name.trim() : (name?.name ? name.name.trim() : `${user?.name || "My"}'s Family`);
      const starterName = firstPersonData?.name?.trim() || user?.name || "Tree Starter";
      const starterGender =
        firstPersonData?.gender && firstPersonData.gender !== "unspecified"
          ? firstPersonData.gender
          : (user?.gender && user.gender !== "unspecified" ? user.gender : undefined);
      const starterDob = firstPersonData?.dob || firstPersonData?.date_of_birth || user?.dob || undefined;
      const starterBio = firstPersonData?.bio || "Tree Starter (Owner)";

      const newFamily = await api.createTree({
        name: treeName,
        first_person_name: starterName,
        first_person_gender: starterGender,
        first_person_dob: starterDob,
        first_person_bio: starterBio,
      });

      // Immediately register as owned in active state
      setActiveTreeId(newFamily.id);
      setMyRole("owner");

      const createdPerson = newFamily.first_person || null;
      if (createdPerson?.id) {
        setRootPersonId(createdPerson.id);
      }

      await refreshTreeList();
      await refresh();
      return { family: newFamily, person: createdPerson };
    },
    [user, refreshTreeList, setActiveTreeId, setRootPersonId, refresh]
  );

  const renameTree = useCallback(
    async (treeId, name) => {
      const updated = await api.updateTree(treeId, { name });
      await refreshTreeList();
      return updated;
    },
    [refreshTreeList]
  );

  const deleteTree = useCallback(
    async (treeId) => {
      await api.deleteTree(treeId);
      const updatedList = await refreshTreeList();
      if (activeTreeId === treeId) {
        const nextTree =
          updatedList?.owned_trees?.find((t) => t.id !== treeId) || updatedList?.owned_trees?.[0];
        setActiveTreeId(nextTree ? nextTree.id : null);
      }
    },
    [activeTreeId, refreshTreeList, setActiveTreeId]
  );

  const leaveSharedTree = useCallback(
    async (treeId) => {
      await api.leaveSharedTree(treeId);
      const updatedList = await refreshTreeList();
      if (activeTreeId === treeId) {
        const nextTree = updatedList?.owned_trees?.[0];
        setActiveTreeId(nextTree ? nextTree.id : null);
      }
    },
    [activeTreeId, refreshTreeList, setActiveTreeId]
  );

  // ── Unified Tree List guaranteed to include activeTree if loaded ────────
  const unifiedTreeList = useMemo(() => {
    const owned = [...(treeList?.owned_trees || [])];
    const shared = [...(treeList?.shared_trees || [])];

    if (activeTree) {
      const isOwned =
        activeTree.isOwned ??
        (activeTree.owner_id === user?.id || activeTree.id === user?.id || myRole === "owner");
      if (isOwned) {
        if (!owned.some((t) => t.id === activeTree.id)) {
          owned.push({
            id: activeTree.id,
            name: activeTree.name || `${user?.name || "My"}'s Family Tree`,
            role: "owner",
            isOwned: true,
            owner_id: user?.id,
            people_count: activeTree.people_count ?? people?.length ?? 0,
            created_at: activeTree.created_at || new Date().toISOString(),
          });
        }
      } else if (
        activeTree.owner_id !== user?.id &&
        activeTree.id !== user?.id &&
        !shared.some((t) => t.id === activeTree.id)
      ) {
        shared.push({
          id: activeTree.id,
          name: activeTree.name || "Family Tree",
          owner_id: activeTree.owner_id,
          owner_name: activeTree.owner_name || "Tree Owner",
          owner_email: activeTree.owner_email || "",
          role: myRole || activeTree.role || "viewer",
          isOwned: false,
          people_count: activeTree.people_count ?? people?.length ?? 0,
          created_at: activeTree.created_at || new Date().toISOString(),
        });
      }
    }

    const ownedIds = new Set(owned.map((t) => t.id));
    if (user?.id) ownedIds.add(user.id);

    return {
      ...treeList,
      owned_trees: owned,
      shared_trees: shared.filter(
        (s) =>
          s &&
          s.owner_id !== user?.id &&
          s.id !== user?.id &&
          !ownedIds.has(s.id)
      ),
    };
  }, [treeList, activeTree, myRole, user?.id, user?.name, people?.length]);

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
        treeList: unifiedTreeList,
        treesLoading,
        refreshTreeList,
        refresh,
        createTree,
        renameTree,
        deleteTree,
        leaveSharedTree,
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
