import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AlertTriangle, Save, X, Loader2, FolderTree } from "lucide-react";
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
        root_person_id: raw.owned.family.root_person_id || null,
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
      root_person_id: s.family?.root_person_id || s.root_person_id || null,
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
  const [loadedTreeId, setLoadedTreeId] = useState(() => {
    if (typeof window !== "undefined" && user?.id) {
      return localStorage.getItem(activeTreeStorageKey(user.id)) || "default";
    }
    return null;
  });

  const navigate = useNavigate();
  const location = useLocation();

  // ── MS Word-style Unsaved Changes Prompt State ──────────────────────────
  const [unsavedModalOpen, setUnsavedModalOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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

  // Synchronously hydrate tree list from local cache as soon as user.id resolves
  useEffect(() => {
    if (!user?.id) return;
    try {
      const cached = localStorage.getItem(treeListStorageKey(user.id));
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.owned_trees?.length > 0 || parsed.shared_trees?.length > 0)) {
          setTreeList((prev) => {
            if (prev?.owned_trees?.length === 0 && prev?.shared_trees?.length === 0) {
              return normalizeTreeList(parsed, user.id);
            }
            return prev;
          });
        }
      }
    } catch (_) {}
  }, [user?.id]);

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
      setActiveTreeIdState((prevId) => {
        // When tree changes or is switched, immediately mark as loading and reset people
        // so previous tree's nodes are NEVER flashed for a few seconds
        setLoaded(false);
        setPeople([]);
        setLoadedTreeId(null);
        return treeId;
      });

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
        setLoadedTreeId(null);
        return;
      }
      const effectiveTreeId = activeTreeId || activeTree?.id || undefined;
      const targetIdStr = effectiveTreeId || "default";

      // If active tree does not match what was loaded, immediately unmark loaded
      if (!isSilent && loadedTreeId !== targetIdStr) {
        setLoaded(false);
      }

      try {
        const data = await api.listPeople(effectiveTreeId);
        const mapped = data.map(mapPerson);
        setPeople(mapped);
        setLoadedTreeId(targetIdStr);
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
    [user, activeTreeId, activeTree?.id, loadedTreeId]
  );

  useEffect(() => {
    refresh();
  }, [refresh, user?.id, activeTreeId]);

  // Live auto-sync: Poll for tree changes in the background every 5 seconds
  // and whenever the user returns to the tab or focuses the window.
  useEffect(() => {
    if (!user?.id) return;

    const syncLatest = () => {
      // Do NOT overwrite user's work with background polling if there are unsaved changes
      if (hasUnsavedChanges) return;
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
  }, [user?.id, refresh, refreshTreeList, hasUnsavedChanges]);

  // Load the saved root person for this account and tree once loaded.
  // Restore active tree root person:
  // 1. Canonical server-persisted tree root_person_id (Highest priority — single source of truth for the tree!)
  // 2. Person matching current logged-in user (so if Pachhu is logged in, she is recognized as herself)
  // 3. Saved localStorage
  // 4. Default to first person
  useEffect(() => {
    if (!user?.id) {
      setRootPersonIdState(null);
      return;
    }
    const treeKey = rootStorageKey(user.id, activeTreeId);

    // 1. Canonical server-persisted tree root_person_id
    const serverRoot = activeTree?.root_person_id;
    if (serverRoot && people.some((p) => p.id === serverRoot)) {
      setRootPersonIdState(serverRoot);
      try {
        localStorage.setItem(treeKey, serverRoot);
      } catch (_) {}
      return;
    }

    // 2. Person matching the current logged-in user
    if (user?.name && people.length > 0) {
      const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").replace(/h/g, "");
      const normUserName = normalize(user.name);
      const matchUser = people.find((p) => {
        const normP = normalize(p?.name);
        return normP && (normP === normUserName || normUserName.includes(normP) || normP.includes(normUserName));
      });
      if (matchUser) {
        setRootPersonIdState(matchUser.id);
        return;
      }
    }

    // 3. Saved localStorage
    const saved = localStorage.getItem(treeKey);
    if (saved && people.some((p) => p.id === saved)) {
      setRootPersonIdState(saved);
      return;
    }

    // 4. Fallback to first person
    if (people.length > 0) {
      setRootPersonIdState(people[0].id);
    }
  }, [user?.id, user?.name, activeTreeId, activeTree?.id, activeTree?.root_person_id, people]);

  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [lastActionNotice, setLastActionNotice] = useState(null);

  const clearActionNotice = useCallback(() => setLastActionNotice(null), []);

  useEffect(() => {
    if (!lastActionNotice) return;
    const timer = setTimeout(() => {
      setLastActionNotice(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [lastActionNotice]);

  useEffect(() => {
    setUndoStack([]);
    setRedoStack([]);
    setLastActionNotice(null);
  }, [activeTreeId]);

  const setRootPersonId = useCallback(
    (id, recordHistory = true) => {
      const prevRoot = rootPersonId;
      if (prevRoot === id) return;

      setRootPersonIdState(id);
      const effectiveTreeId = activeTreeId || activeTree?.id;
      if (user?.id) {
        const treeKey = rootStorageKey(user.id, effectiveTreeId);
        const globalKey = rootStorageKey(user.id);
        if (id) {
          localStorage.setItem(treeKey, id);
          localStorage.setItem(globalKey, id);
        } else {
          localStorage.removeItem(treeKey);
          localStorage.removeItem(globalKey);
        }
      }

      // Optimistically update activeTree in treeList so UI updates instantly
      setTreeList((prev) => {
        if (!prev) return prev;
        const updateTree = (t) => (t.id === effectiveTreeId ? { ...t, root_person_id: id } : t);
        return {
          ...prev,
          owned_trees: (prev.owned_trees || []).map(updateTree),
          shared_trees: (prev.shared_trees || []).map(updateTree),
        };
      });

      // Live persist to backend API so all collaborators & owner immediately see it
      if (effectiveTreeId && (myRole === "owner" || myRole === "editor")) {
        api.setRootPerson(effectiveTreeId, id)
          .then(() => refreshTreeList())
          .catch((err) => {
            console.warn("Failed to persist Tree Starter to server:", err);
          });
      }

      if (recordHistory && prevRoot && id) {
        const nextPerson = people.find((p) => p.id === id);
        const action = {
          type: "SET_ROOT",
          title: `Set ${nextPerson?.name || "Person"} as Tree Starter`,
          prevPeople: people,
          nextPeople: people,
          prevRootId: prevRoot,
          nextRootId: id,
          revert: async () => {
            setRootPersonIdState(prevRoot);
            if (user?.id) {
              const treeKey = rootStorageKey(user.id, effectiveTreeId);
              localStorage.setItem(treeKey, prevRoot);
            }
            if (effectiveTreeId && (myRole === "owner" || myRole === "editor")) {
              api.setRootPerson(effectiveTreeId, prevRoot).then(() => refreshTreeList()).catch(() => {});
            }
          },
          apply: async () => {
            setRootPersonIdState(id);
            if (user?.id) {
              const treeKey = rootStorageKey(user.id, effectiveTreeId);
              localStorage.setItem(treeKey, id);
            }
            if (effectiveTreeId && (myRole === "owner" || myRole === "editor")) {
              api.setRootPerson(effectiveTreeId, id).then(() => refreshTreeList()).catch(() => {});
            }
          },
        };
        setUndoStack((prev) => [...prev.slice(-30), action]);
        setRedoStack([]);
        setHasUnsavedChanges(true);
      }
    },
    [user?.id, activeTreeId, activeTree?.id, myRole, rootPersonId, people, refreshTreeList]
  );

  // Effective root:
  // 1. Explicitly chosen person if they still exist in the tree.
  // 2. Server-persisted tree root_person_id.
  // 3. Tree owner or user matching tree name / self (with fuzzy normalization).
  // 4. Fallback to earliest-added person.
  const effectiveRootPersonId = useCallback(() => {
    if (rootPersonId && people.some((p) => p.id === rootPersonId)) return rootPersonId;

    if (activeTree?.root_person_id && people.some((p) => p.id === activeTree.root_person_id)) {
      return activeTree.root_person_id;
    }

    if (people.length > 0) {
      // Check tree owner / user name (handles "pachu" vs "pachhu" fuzzy variations)
      const ownerOrUserName = (activeTree?.owner_name || user?.name || activeTree?.name || "").trim().toLowerCase();
      const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").replace(/h/g, "");

      if (ownerOrUserName) {
        const normOwner = normalize(ownerOrUserName);
        const match = people.find((p) => {
          const normP = normalize(p?.name);
          return normP && (normP === normOwner || normOwner.includes(normP) || normP.includes(normOwner));
        });
        if (match) return match.id;
      }

      // Check if notes/bio mention "You" or "Self" or "Tree Starter" or "Owner"
      const selfPerson = people.find((p) => {
        const notes = (p?.notes || p?.bio || "").toLowerCase();
        return notes.includes("you") || notes.includes("self") || notes.includes("tree starter") || notes.includes("owner");
      });
      if (selfPerson) return selfPerson.id;
    }

    return people[0]?.id || null;
  }, [rootPersonId, activeTree?.root_person_id, activeTree?.owner_name, activeTree?.name, people, user]);

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
      const effectiveTreeId = activeTreeId || activeTree?.id || undefined;
      const prevPeople = [...people];
      const prevRoot = rootPersonId;
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
      const created = await api.createPerson(payload, effectiveTreeId);
      if (people.length === 0 && created?.id) {
        setRootPersonId(created.id, false);
      }
      await refresh();
      await refreshTreeList();

      const createdMapped = mapPerson(created);
      const nextPeople = [...people, createdMapped];
      const action = {
        type: "ADD_PERSON",
        title: `Add ${details.name || "person"}`,
        prevPeople,
        nextPeople,
        prevRootId: prevRoot,
        nextRootId: people.length === 0 && created?.id ? created.id : prevRoot,
        revert: async () => {
          if (created?.id) {
            await api.deletePerson(created.id, effectiveTreeId);
          }
          await refresh();
          await refreshTreeList();
        },
        apply: async () => {
          await api.createPerson(payload, effectiveTreeId);
          await refresh();
          await refreshTreeList();
        },
      };
      setUndoStack((prev) => [...prev.slice(-30), action]);
      setRedoStack([]);
      setHasUnsavedChanges(true);

      return created.id;
    },
    [refresh, refreshTreeList, activeTreeId, activeTree?.id, people, rootPersonId, setRootPersonId]
  );

  const saveTree = useCallback(
    async (description) => {
      setIsSaving(true);
      try {
        const effectiveTreeId = activeTreeId || activeTree?.id || undefined;
        const currentRoot = effectiveRootPersonId();
        const desc = description || `Saved ${activeTree?.name || "tree"} changes`;
        const res = await api.saveTree(effectiveTreeId, desc, currentRoot);
        setLastSavedAt(new Date().toISOString());
        setHasUnsavedChanges(false);
        await refresh();
        await refreshTreeList();
        return res;
      } finally {
        setIsSaving(false);
      }
    },
    [activeTreeId, activeTree?.id, activeTree?.name, effectiveRootPersonId, refresh, refreshTreeList]
  );

  const restoreTree = useCallback(
    async (revisionId) => {
      setIsSaving(true);
      try {
        const effectiveTreeId = activeTreeId || activeTree?.id || undefined;
        const prevPeople = [...people];
        const res = await api.restoreTreeRevision(effectiveTreeId, revisionId);
        setLastSavedAt(new Date().toISOString());
        setHasUnsavedChanges(false);
        await refresh();
        await refreshTreeList();

        const action = {
          type: "RESTORE_REVISION",
          title: `Restore Version`,
          prevPeople,
          nextPeople: people,
          revert: async () => {
            // Restore previous people
            await refresh();
          },
          apply: async () => {
            await api.restoreTreeRevision(effectiveTreeId, revisionId);
            await refresh();
          },
        };
        setUndoStack((prev) => [...prev.slice(-30), action]);
        setRedoStack([]);

        return res;
      } finally {
        setIsSaving(false);
      }
    },
    [activeTreeId, activeTree?.id, people, refresh, refreshTreeList]
  );

  const updatePerson = useCallback(
    async (id, details) => {
      const prevPerson = getPerson(id);
      const prevPeople = [...people];
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
      const mapped = mapPerson(updated);
      const nextPeople = people.map((p) => (p.id === id ? mapped : p));
      setPeople(nextPeople);
      setLastSavedAt(new Date().toISOString());
      setHasUnsavedChanges(true);
      await refresh();
      await refreshTreeList();

      if (prevPerson) {
        const revertPayload = {
          name: prevPerson.name,
          gender: prevPerson.gender || null,
          date_of_birth: prevPerson.dob || null,
          date_of_death: prevPerson.dod || null,
          bio: prevPerson.notes || null,
          photo_url: prevPerson.photoUrl || null,
        };
        const action = {
          type: "UPDATE_PERSON",
          title: `Edit ${details.name || prevPerson.name}`,
          prevPeople,
          nextPeople,
          revert: async () => {
            await api.updatePerson(id, revertPayload);
            await refresh();
          },
          apply: async () => {
            await api.updatePerson(id, payload);
            await refresh();
          },
        };
        setUndoStack((prev) => [...prev.slice(-30), action]);
        setRedoStack([]);
      }

      return updated;
    },
    [getPerson, people, refresh, refreshTreeList]
  );

  const linkPeople = useCallback(
    async (firstPersonId, secondPersonId, relationshipStatus = "partner") => {
      const effectiveTreeId = activeTreeId || activeTree?.id || undefined;
      const prevPeople = [...people];
      await api.linkPeople(
        {
          first_person_id: firstPersonId,
          second_person_id: secondPersonId,
          relationship_type: "spouse",
          relationship_status: relationshipStatus,
        },
        effectiveTreeId
      );
      setHasUnsavedChanges(true);
      await refresh();
      await refreshTreeList();

      const action = {
        type: "LINK_PEOPLE",
        title: "Link Partners",
        prevPeople,
        nextPeople: people,
        revert: async () => {
          await refresh();
        },
        apply: async () => {
          await api.linkPeople(
            {
              first_person_id: firstPersonId,
              second_person_id: secondPersonId,
              relationship_type: "spouse",
              relationship_status: relationshipStatus,
            },
            effectiveTreeId
          );
          await refresh();
        },
      };
      setUndoStack((prev) => [...prev.slice(-30), action]);
      setRedoStack([]);
    },
    [refresh, refreshTreeList, activeTreeId, activeTree?.id, people]
  );

  const deletePerson = useCallback(
    async (id) => {
      const effectiveTreeId = activeTreeId || activeTree?.id || undefined;
      const targetPerson = getPerson(id);
      const prevPeople = [...people];
      await api.deletePerson(id, effectiveTreeId);
      const nextPeople = people.filter((p) => p.id !== id);
      setPeople(nextPeople);
      setHasUnsavedChanges(true);
      await refresh();
      await refreshTreeList();

      if (targetPerson) {
        const action = {
          type: "DELETE_PERSON",
          title: `Delete ${targetPerson.name}`,
          prevPeople,
          nextPeople,
          revert: async () => {
            await api.createPerson(
              {
                name: targetPerson.name,
                gender: targetPerson.gender,
                date_of_birth: targetPerson.dob,
                date_of_death: targetPerson.dod,
                bio: targetPerson.notes,
                photo_url: targetPerson.photoUrl,
              },
              effectiveTreeId
            );
            await refresh();
            await refreshTreeList();
          },
          apply: async () => {
            await api.deletePerson(id, effectiveTreeId);
            await refresh();
            await refreshTreeList();
          },
        };
        setUndoStack((prev) => [...prev.slice(-30), action]);
        setRedoStack([]);
      }
    },
    [activeTreeId, activeTree?.id, getPerson, people, refresh, refreshTreeList]
  );

  const undo = useCallback(async () => {
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, action]);

    if (action.prevPeople) {
      setPeople(action.prevPeople);
    }
    if (action.prevRootId !== undefined) {
      setRootPersonIdState(action.prevRootId);
    }
    setHasUnsavedChanges(true);
    setLastActionNotice({ type: "undo", text: `Undid: ${action.title}` });

    try {
      if (action.revert) {
        await action.revert();
      }
    } catch (err) {
      console.warn("Undo revert error:", err);
    }
  }, [undoStack]);

  const redo = useCallback(async () => {
    if (redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, action]);

    if (action.nextPeople) {
      setPeople(action.nextPeople);
    }
    if (action.nextRootId !== undefined) {
      setRootPersonIdState(action.nextRootId);
    }
    setHasUnsavedChanges(true);
    setLastActionNotice({ type: "redo", text: `Redid: ${action.title}` });

    try {
      if (action.apply) {
        await action.apply();
      }
    } catch (err) {
      console.warn("Redo apply error:", err);
    }
  }, [redoStack]);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;
  const undoActionName = undoStack.length > 0 ? undoStack[undoStack.length - 1]?.title || "" : "";
  const redoActionName = redoStack.length > 0 ? redoStack[redoStack.length - 1]?.title || "" : "";

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
      setHasUnsavedChanges(true);

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

  // ── MS Word-style Unsaved Changes Handlers & Guard ──────────────────────
  const guardNavigation = useCallback(
    (target) => {
      // If user has unsaved changes and is currently on the tree page
      if (hasUnsavedChanges && location.pathname === "/tree") {
        if (typeof target === "string" && target === "/tree") {
          return true; // Already on tree page
        }
        setPendingNavigation(typeof target === "string" ? { path: target } : { action: target });
        setUnsavedModalOpen(true);
        return false;
      }
      if (typeof target === "string") {
        navigate(target);
      } else if (typeof target === "function") {
        target();
      }
      return true;
    },
    [hasUnsavedChanges, location.pathname, navigate]
  );

  const confirmDiscardUnsavedAndProceed = useCallback(() => {
    setHasUnsavedChanges(false);
    setUnsavedModalOpen(false);
    const nav = pendingNavigation;
    setPendingNavigation(null);
    if (nav) {
      if (nav.path) {
        navigate(nav.path);
      } else if (typeof nav.action === "function") {
        nav.action();
      }
    }
  }, [pendingNavigation, navigate]);

  const saveAndProceed = useCallback(async () => {
    try {
      await saveTree();
    } catch (err) {
      console.warn("Failed to auto-save before leaving:", err);
    }
    setHasUnsavedChanges(false);
    setUnsavedModalOpen(false);
    const nav = pendingNavigation;
    setPendingNavigation(null);
    if (nav) {
      if (nav.path) {
        navigate(nav.path);
      } else if (typeof nav.action === "function") {
        nav.action();
      }
    }
  }, [pendingNavigation, saveTree, navigate]);

  const cancelUnsavedNavigation = useCallback(() => {
    setUnsavedModalOpen(false);
    setPendingNavigation(null);
  }, []);

  // Browser window/tab unload or reload guard
  useEffect(() => {
    if (!hasUnsavedChanges || location.pathname !== "/tree") return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "You have unsaved changes in your family tree. Are you sure you want to leave?";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // Guard browser back/forward buttons
    window.history.pushState({ guarded: true }, "", window.location.href);
    const handlePopState = () => {
      if (hasUnsavedChanges && location.pathname === "/tree") {
        window.history.pushState({ guarded: true }, "", window.location.href);
        setPendingNavigation({ action: () => window.history.back() });
        setUnsavedModalOpen(true);
      }
    };
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [hasUnsavedChanges, location.pathname]);

  const isTreeLoading = !loaded || treesLoading || (Boolean(activeTreeId) && loadedTreeId !== (activeTreeId || activeTree?.id));

  return (
    <FamilyContext.Provider
      value={{
        people,
        loaded,
        loadedTreeId,
        isTreeLoading,
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
        setHasUnsavedChanges,
        guardNavigation,
        unsavedModalOpen,
        setUnsavedModalOpen,
        confirmDiscardUnsavedAndProceed,
        saveAndProceed,
        cancelUnsavedNavigation,
        // ── Undo / Redo Actions ────────────────────────────────────────
        undo,
        redo,
        canUndo,
        canRedo,
        undoActionName,
        redoActionName,
        lastActionNotice,
        clearActionNotice,
      }}
    >
      {/* ── MS Word-style Save Changes Confirmation Dialog ── */}
      {unsavedModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#E7E2D6] animate-in zoom-in-95 duration-150 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0 pr-6">
                <h3 className="text-base font-serif font-bold text-[#1C1F1D]">
                  Save changes to {activeTree?.name || "family tree"}?
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  You have unsaved edits in this family tree
                </p>
              </div>
              <button
                type="button"
                onClick={cancelUnsavedNavigation}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FAF8F4] border border-[#E7E2D6] text-xs text-[#4B5563] mb-6 space-y-1.5">
              <p className="leading-relaxed">
                Do you want to save your progress before switching tabs or leaving? If you don't save, recently added members, relationships, or perspective changes will not be saved.
              </p>
              <div className="flex items-center gap-1.5 pt-1 font-medium text-[#1C4B3C]">
                <FolderTree className="w-3.5 h-3.5" />
                <span>Tree: <strong>{activeTree?.name || "Family Tree"}</strong></span>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
              <button
                type="button"
                onClick={cancelUnsavedNavigation}
                className="px-4 py-2.5 text-xs font-medium text-[#6B7280] hover:text-[#1C1F1D] hover:bg-[#F7F5F0] rounded-xl transition-colors text-center cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDiscardUnsavedAndProceed}
                className="px-4 py-2.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors text-center cursor-pointer"
              >
                Don't Save
              </button>
              <button
                type="button"
                onClick={saveAndProceed}
                disabled={isSaving}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-[#1C4B3C] hover:bg-[#163C30] rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 text-center cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{isSaving ? "Saving..." : "Save"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error("useFamily must be used within a FamilyProvider");
  return ctx;
}
