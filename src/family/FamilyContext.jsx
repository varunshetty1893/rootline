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

/** Key used to cache people per tree for instant loading without empty state flicker */
function peopleStorageKey(userId, treeId) {
  return `rootline:people:${userId}:${treeId || "default"}`;
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

  // CRITICAL SANITIZATION: Strict ownership separation based on currentUserId
  const all = [...owned_trees, ...shared_trees];
  const actualOwned = [];
  const actualShared = [];
  const seenIds = new Set();

  for (const tree of all) {
    if (!tree || !tree.id || seenIds.has(tree.id)) continue;
    seenIds.add(tree.id);

    // STRICT OWNERSHIP RULE:
    // A tree is ONLY owned by the current user if:
    // 1. Its role is NOT explicitly "viewer" or "editor"
    // 2. Its isOwned flag is not false
    // 3. Its owner_id does not point to a different user
    // 4. Either tree.owner_id === currentUserId OR (tree.id === currentUserId && (!tree.owner_id || tree.owner_id === currentUserId))
    const isExplicitCollaborator = tree.role === "viewer" || tree.role === "editor" || tree.isOwned === false;
    const hasDifferentOwner = Boolean(currentUserId && tree.owner_id && tree.owner_id !== currentUserId);
    const isOwnedByUser =
      !isExplicitCollaborator &&
      !hasDifferentOwner &&
      Boolean(
        currentUserId &&
        (tree.owner_id === currentUserId || (tree.id === currentUserId && (!tree.owner_id || tree.owner_id === currentUserId)))
      );

    if (isOwnedByUser) {
      actualOwned.push({
        ...tree,
        role: "owner",
        isOwned: true,
        owner_id: currentUserId,
        people_count: tree.people_count ?? 0,
      });
    } else {
      // Must NOT belong to current user
      if (currentUserId && (tree.owner_id === currentUserId || tree.id === currentUserId)) {
        actualOwned.push({
          ...tree,
          role: "owner",
          isOwned: true,
          owner_id: currentUserId,
          people_count: tree.people_count ?? 0,
        });
      } else {
        actualShared.push({
          ...tree,
          isOwned: false,
          role: tree.role && tree.role !== "owner" ? tree.role : "viewer",
          people_count: tree.people_count ?? 0,
        });
      }
    }
  }
  owned_trees = actualOwned;
  shared_trees = actualShared;

  return {
    ...raw,
    owned_trees,
    shared_trees,
  };
}

export function FamilyProvider({ children }) {
  const { user } = useAuth();
  const [people, setPeople] = useState(() => {
    if (typeof window !== "undefined" && user?.id) {
      try {
        const savedTreeId = localStorage.getItem(activeTreeStorageKey(user.id));
        const cached = localStorage.getItem(peopleStorageKey(user.id, savedTreeId));
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch (_) {}
    }
    return [];
  });
  const [loaded, setLoaded] = useState(() => {
    if (typeof window !== "undefined" && user?.id) {
      try {
        const savedTreeId = localStorage.getItem(activeTreeStorageKey(user.id));
        const cached = localStorage.getItem(peopleStorageKey(user.id, savedTreeId));
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return true;
          }
        }
      } catch (_) {}
    }
    return false;
  });
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
    if (!user?.id) {
      setMyRole("viewer");
      return;
    }
    if (!activeTreeId || activeTreeId === user.id) {
      setMyRole("owner");
      return;
    }
    const ownedTrees = treeList?.owned_trees || [];
    const sharedTrees = treeList?.shared_trees || [];

    const owned = ownedTrees.find((t) => t.id === activeTreeId);
    if (owned) {
      setMyRole("owner");
      return;
    }
    const shared = sharedTrees.find((t) => t.id === activeTreeId);
    if (shared) {
      setMyRole(shared.role || (shared.isOwned ? "owner" : "viewer"));
      return;
    }
    // If tree list is still loading, wait
    if (treesLoading) {
      return;
    }

    // If activeTreeId was set but is NOT present in owned or shared trees (e.g. deleted or access revoked),
    // automatically reset activeTreeId to the first available tree and remove stale reference
    const all = [...ownedTrees, ...sharedTrees];
    if (all.length > 0) {
      const fallback = ownedTrees[0] || sharedTrees[0];
      const fallbackId = fallback ? fallback.id : null;
      setActiveTreeIdState(fallbackId);
      if (user?.id) {
        if (fallbackId) localStorage.setItem(activeTreeStorageKey(user.id), fallbackId);
        else localStorage.removeItem(activeTreeStorageKey(user.id));
      }
      setMyRole(fallback?.role || (fallback?.isOwned ? "owner" : "viewer"));
      return;
    }

    setMyRole("viewer");
  }, [activeTreeId, treeList, user?.id, treesLoading]);

  /** Convenience flags derived from the current role. */
  const canEdit = myRole === "owner" || myRole === "editor";
  const canManage = myRole === "owner";

  // ── Active tree record ─────────────────────────────────────────────────
  const activeTree = useMemo(() => {
    const ownedTrees = treeList?.owned_trees || [];
    const sharedTrees = treeList?.shared_trees || [];
    const allTrees = [...ownedTrees, ...sharedTrees];

    if (!activeTreeId) {
      return (
        ownedTrees[0] ||
        sharedTrees[0] || {
          id: user?.id || "default",
          name: `${user?.name || "My"}'s Family Tree`,
          owner_id: user?.id,
          role: "owner",
          isOwned: true,
          people_count: people?.length || 0,
        }
      );
    }
    const ownedFound = ownedTrees.find((t) => t.id === activeTreeId);
    if (ownedFound) {
      return {
        ...ownedFound,
        isOwned: true,
        role: "owner",
      };
    }
    const sharedFound = sharedTrees.find((t) => t.id === activeTreeId);
    if (sharedFound) {
      return {
        ...sharedFound,
        isOwned: Boolean(sharedFound.isOwned),
        role: sharedFound.role || (sharedFound.isOwned ? "owner" : myRole || "viewer"),
      };
    }

    // Never synthesize a phantom tree for deleted or nonexistent trees!
    return ownedTrees[0] || sharedTrees[0] || null;
  }, [activeTreeId, treeList, myRole, user?.id, user?.name, people?.length]);

  // ── People for the active tree ─────────────────────────────────────────
  const refresh = useCallback(
    async (isSilent = false) => {
      if (!user) {
        setPeople([]);
        setLoaded(true);
        return;
      }
      const effectiveTreeId = activeTreeId || activeTree?.id || undefined;
      try {
        // If not silent and state is empty, try instant local cache
        if (!isSilent && people.length === 0 && typeof window !== "undefined") {
          try {
            const cached = localStorage.getItem(peopleStorageKey(user.id, effectiveTreeId));
            if (cached) {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setPeople(parsed);
                setLoaded(true);
              }
            }
          } catch (_) {}
        }

        const data = await api.listPeople(effectiveTreeId);
        const mapped = data.map(mapPerson);
        setPeople(mapped);
        setError("");

        if (typeof window !== "undefined" && user?.id) {
          try {
            localStorage.setItem(peopleStorageKey(user.id, effectiveTreeId), JSON.stringify(mapped));
          } catch (_) {}
        }
      } catch (err) {
        if (!isSilent) setError(err.message);
      } finally {
        setLoaded(true);
      }
    },
    [user, activeTreeId, activeTree?.id, people.length]
  );

  useEffect(() => {
    refresh();
  }, [refresh, user?.id, activeTreeId]);

  // Live auto-sync: Poll for tree changes in the background every 5 seconds
  // and whenever the user returns to the tab or focuses the window.
  useEffect(() => {
    if (!user?.id) return;

    const syncLatest = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        refresh(true);
        refreshTreeList();
      }
    };

    const intervalId = setInterval(syncLatest, 5000);
    window.addEventListener("focus", syncLatest);
    window.addEventListener("visibilitychange", syncLatest);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", syncLatest);
      window.removeEventListener("visibilitychange", syncLatest);
    };
  }, [user?.id, refresh, refreshTreeList]);

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
      await refreshTreeList();
      return created.id;
    },
    [refresh, refreshTreeList, activeTreeId, people.length, setRootPersonId]
  );

  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const saveTree = useCallback(
    async (description) => {
      setIsSaving(true);
      try {
        const effectiveTreeId = activeTreeId || activeTree?.id || undefined;
        const desc = description || `Saved ${activeTree?.name || "tree"} changes`;
        const res = await api.saveTree(effectiveTreeId, desc);
        setLastSavedAt(new Date().toISOString());
        setHasUnsavedChanges(false);
        await refresh();
        await refreshTreeList();
        return res;
      } finally {
        setIsSaving(false);
      }
    },
    [activeTreeId, activeTree?.id, activeTree?.name, refresh, refreshTreeList]
  );

  const restoreTree = useCallback(
    async (revisionId) => {
      setIsSaving(true);
      try {
        const effectiveTreeId = activeTreeId || activeTree?.id || undefined;
        const res = await api.restoreTreeRevision(effectiveTreeId, revisionId);
        setLastSavedAt(new Date().toISOString());
        setHasUnsavedChanges(false);
        await refresh();
        await refreshTreeList();
        return res;
      } finally {
        setIsSaving(false);
      }
    },
    [activeTreeId, activeTree?.id, refresh, refreshTreeList]
  );

  const updatePerson = useCallback(
    async (id, details) => {
      const payload = {
        name: details.name,
        gender: details.gender && details.gender !== "unspecified" ? details.gender : null,
        date_of_birth: details.date_of_birth || details.dob || null,
        date_of_death: details.date_of_death || details.dod || null,
        place_of_birth: details.place_of_birth || null,
        occupation: details.occupation || null,
        bio: details.bio !== undefined ? details.bio : (details.notes || null),
        address: details.address || null,
        phone: details.phone || null,
        photo_url: details.photo_url || null,
      };
      const updated = await api.updatePerson(id, payload);
      setPeople((prev) => prev.map((p) => (p.id === id ? mapPerson(updated) : p)));
      setLastSavedAt(new Date().toISOString());
      await refresh();
      await refreshTreeList();
      return updated;
    },
    [refresh, refreshTreeList]
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
      await refreshTreeList();
    },
    [refresh, refreshTreeList, activeTreeId]
  );

  const deletePerson = useCallback(
    async (id) => {
      await api.deletePerson(id);
      await refresh();
      await refreshTreeList();
    },
    [refresh, refreshTreeList]
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
      // 1. Immediately determine next active tree if deleting the currently selected tree
      const remainingOwned = (treeList?.owned_trees || []).filter((t) => t.id !== treeId);
      const remainingShared = (treeList?.shared_trees || []).filter((t) => t.id !== treeId);
      const nextTree = remainingOwned[0] || remainingShared[0] || null;
      const nextTreeId = nextTree ? nextTree.id : null;

      if (activeTreeId === treeId) {
        setActiveTreeIdState(nextTreeId);
        if (user?.id) {
          if (nextTreeId) localStorage.setItem(activeTreeStorageKey(user.id), nextTreeId);
          else localStorage.removeItem(activeTreeStorageKey(user.id));
        }
      }

      // 2. Synchronously remove tree from state and localStorage to prevent any stale flash
      const updatedList = {
        owned_trees: remainingOwned,
        shared_trees: remainingShared,
      };
      setTreeList(updatedList);
      if (typeof window !== "undefined" && user?.id) {
        try {
          localStorage.setItem(treeListStorageKey(user.id), JSON.stringify(updatedList));
          localStorage.removeItem(`rootline_people_${treeId}`);
          localStorage.removeItem(`rootline_tree_${treeId}`);
          localStorage.removeItem(`rootline_relationships_${treeId}`);
        } catch (_) {}
      }

      // 3. Call backend API to permanently cascade-delete from DB/store
      await api.deleteTree(treeId);

      // 4. Refetch fresh list and people data
      await refreshTreeList();
      await refresh();
    },
    [activeTreeId, treeList, user?.id, refreshTreeList, refresh]
  );

  const leaveSharedTree = useCallback(
    async (treeId) => {
      const remainingOwned = (treeList?.owned_trees || []).filter((t) => t.id !== treeId);
      const remainingShared = (treeList?.shared_trees || []).filter((t) => t.id !== treeId);
      const nextTree = remainingOwned[0] || remainingShared[0] || null;
      const nextTreeId = nextTree ? nextTree.id : null;

      if (activeTreeId === treeId) {
        setActiveTreeIdState(nextTreeId);
        if (user?.id) {
          if (nextTreeId) localStorage.setItem(activeTreeStorageKey(user.id), nextTreeId);
          else localStorage.removeItem(activeTreeStorageKey(user.id));
        }
      }

      const updatedList = {
        owned_trees: remainingOwned,
        shared_trees: remainingShared,
      };
      setTreeList(updatedList);
      if (typeof window !== "undefined" && user?.id) {
        try {
          localStorage.setItem(treeListStorageKey(user.id), JSON.stringify(updatedList));
          localStorage.removeItem(`rootline_people_${treeId}`);
          localStorage.removeItem(`rootline_tree_${treeId}`);
          localStorage.removeItem(`rootline_relationships_${treeId}`);
        } catch (_) {}
      }

      await api.leaveSharedTree(treeId);
      await refreshTreeList();
      await refresh();
    },
    [activeTreeId, treeList, user?.id, refreshTreeList, refresh]
  );

  // ── Unified Tree List (strictly based on sanitized server state) ────────
  const unifiedTreeList = useMemo(() => {
    return treeList;
  }, [treeList]);

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
        activeFamilyId: activeTreeId,
        setActiveTreeId,
        activeTree,
        currentFamily: activeTree,
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
        // ── Tree Saving & Version Restore ─────────────────────────────
        saveTree,
        restoreTree,
        isSaving,
        lastSavedAt,
        hasUnsavedChanges,
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
