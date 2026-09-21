import { useState, useMemo, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Users,
  GitBranch,
  Settings,
  Share2,
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Eye,
  UserCheck,
  Check,
  AlertTriangle,
  Mail,
  ShieldCheck,
  Loader2,
  User,
  Calendar,
  Layers,
  ArrowRight,
  RotateCcw,
  FolderTree,
  AlertCircle,
  X,
  Sparkles,
  LogOut,
  ExternalLink,
} from "lucide-react";
import AppHeader from "./AppHeader.jsx";
import { useAuth } from "../AuthContext.jsx";
import { useFamily } from "./FamilyContext.jsx";
import api from "../api.js";

function relationSummary(person, getPerson) {
  const parts = [];
  const parentIds = person?.parentIds || [];
  const spouseIds = person?.spouseIds || [];
  if (parentIds.length) {
    parts.push(
      `child of ${parentIds.map((id) => getPerson(id)?.name).filter(Boolean).join(" & ")}`
    );
  }
  if (spouseIds.length) {
    parts.push(
      `married to ${spouseIds.map((id) => getPerson(id)?.name).filter(Boolean).join(", ")}`
    );
  }
  return parts.join(" · ");
}

export default function ManageTree({ defaultTab = "people" }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const {
    activeTree,
    activeTreeId,
    setActiveTreeId,
    treeList = { owned_trees: [], shared_trees: [] },
    refreshTreeList,
    createTree,
    renameTree,
    deleteTree,
    leaveSharedTree,
    people,
    refresh,
    deletePerson,
    getPerson,
    canEdit,
    canManage,
    myRole,
    rootPersonId,
    setRootPersonId,
  } = useFamily();

  // Current tab: "people" | "settings" | "sharing" | "all-trees"
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam || defaultTab;

  const setActiveTab = (tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Multi-Tree State & Computations
  // ──────────────────────────────────────────────────────────────────────────
  const [treeCardFilter, setTreeCardFilter] = useState("all"); // 'all' | 'owned' | 'shared'
  const ownedTrees = treeList?.owned_trees || [];
  const sharedTrees = treeList?.shared_trees || [];

  const allTrees = useMemo(() => [
    ...ownedTrees.map((t) => ({ ...t, role: "owner", isOwned: true })),
    ...sharedTrees.map((t) => ({ ...t, isOwned: false })),
  ], [ownedTrees, sharedTrees]);

  const filteredTreeCards = useMemo(() => {
    if (treeCardFilter === "owned") return allTrees.filter((t) => t.isOwned);
    if (treeCardFilter === "shared") return allTrees.filter((t) => !t.isOwned);
    return allTrees;
  }, [allTrees, treeCardFilter]);

  // Create Tree Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTreeName, setNewTreeName] = useState("");
  const [firstPersonName, setFirstPersonName] = useState("");
  const [firstPersonGender, setFirstPersonGender] = useState("unspecified");
  const [firstPersonDob, setFirstPersonDob] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");

  // Rename Tree Modal State
  const [renameModalTree, setRenameModalTree] = useState(null);
  const [renameTreeName, setRenameTreeName] = useState("");
  const [renameSubmitting, setRenameSubmitting] = useState(false);
  const [renameError, setRenameError] = useState("");

  // Delete Tree Modal State
  const [deleteModalTree, setDeleteModalTree] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Leave Shared Tree Modal State
  const [leaveModalTree, setLeaveModalTree] = useState(null);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);

  // ──────────────────────────────────────────────────────────────────────────
  // Tab 1: People Management State
  // ──────────────────────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [confirmDeletePersonId, setConfirmDeletePersonId] = useState(null);
  const [confirmSetMePerson, setConfirmSetMePerson] = useState(null);

  const filteredPeople = useMemo(() => {
    let list = people;
    const term = query.trim().toLowerCase();
    if (term) {
      list = list.filter((person) => {
        const details = `${person.name} ${relationSummary(person, getPerson)} ${person.gender || ""}`.toLowerCase();
        return details.includes(term);
      });
    }
    if (genderFilter === "male") {
      list = list.filter((p) => p.gender === "male");
    } else if (genderFilter === "female") {
      list = list.filter((p) => p.gender === "female");
    } else if (genderFilter === "root") {
      list = list.filter((p) => p.id === rootPersonId);
    }
    return list;
  }, [people, query, genderFilter, getPerson, rootPersonId]);

  const pageCount = Math.max(1, Math.ceil(filteredPeople.length / perPage));
  const visiblePeople = filteredPeople.slice((page - 1) * perPage, page * perPage);

  useEffect(() => {
    setPage(1);
  }, [query, genderFilter, people.length]);

  // ──────────────────────────────────────────────────────────────────────────
  // Tab 2: Tree Settings State
  // ──────────────────────────────────────────────────────────────────────────
  const [treeNameInput, setTreeNameInput] = useState(activeTree?.name || "");
  const [savingTreeName, setSavingTreeName] = useState(false);
  const [treeNameSuccess, setTreeNameSuccess] = useState("");
  const [treeNameError, setTreeNameError] = useState("");

  useEffect(() => {
    if (activeTree?.name) {
      setTreeNameInput(activeTree.name);
    }
  }, [activeTree?.name]);

  const handleSaveTreeName = async (e) => {
    e.preventDefault();
    if (!treeNameInput.trim() || !activeTreeId) return;
    setSavingTreeName(true);
    setTreeNameSuccess("");
    setTreeNameError("");
    try {
      await renameTree(activeTreeId, treeNameInput.trim());
      setTreeNameSuccess("Tree name updated successfully.");
      setTimeout(() => setTreeNameSuccess(""), 3500);
    } catch (err) {
      setTreeNameError(err.message || "Failed to update tree name.");
    } finally {
      setSavingTreeName(false);
    }
  };

  // Changing root person in Settings
  const [rootPersonSearch, setRootPersonSearch] = useState("");
  const rootPerson = people.find((p) => p.id === rootPersonId);

  const rootCandidates = useMemo(() => {
    const term = rootPersonSearch.trim().toLowerCase();
    if (!term) return people.slice(0, 10);
    return people.filter((p) => p.name.toLowerCase().includes(term)).slice(0, 10);
  }, [people, rootPersonSearch]);

  // Tree stats calculation
  const stats = useMemo(() => {
    const total = people.length;
    let couplesCount = 0;
    const seenCouples = new Set();
    let livingCount = 0;
    let deceasedCount = 0;

    for (const p of people) {
      if (p.dod) deceasedCount++;
      else livingCount++;

      for (const spouseId of p.spouseIds || []) {
        const pair = [p.id, spouseId].sort().join("|");
        if (!seenCouples.has(pair)) {
          seenCouples.add(pair);
          couplesCount++;
        }
      }
    }

    return {
      total,
      couplesCount,
      livingCount,
      deceasedCount,
    };
  }, [people]);

  // ──────────────────────────────────────────────────────────────────────────
  // Tab 3: Collaborators & Sharing State
  // ──────────────────────────────────────────────────────────────────────────
  const [sharesData, setSharesData] = useState(null);
  const [loadingShares, setLoadingShares] = useState(false);
  const [shareError, setShareError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [rowState, setRowState] = useState({});

  const loadShares = useCallback(async () => {
    if (!activeTreeId) return;
    setLoadingShares(true);
    setShareError("");
    try {
      const data = await api.listShares(activeTreeId);
      setSharesData(data);
    } catch (err) {
      setShareError(err.message || "Could not load collaborator list.");
    } finally {
      setLoadingShares(false);
    }
  }, [activeTreeId]);

  useEffect(() => {
    if (activeTab === "sharing") {
      loadShares();
    }
  }, [activeTab, loadShares]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !activeTreeId) return;
    setInviting(true);
    setShareError("");
    setInviteSuccess("");
    try {
      await api.shareTree(activeTreeId, inviteEmail.trim().toLowerCase(), inviteRole);
      setInviteEmail("");
      setInviteSuccess(`Invitation sent to ${inviteEmail.trim()} as ${inviteRole}.`);
      await loadShares();
      await refreshTreeList();
      setTimeout(() => setInviteSuccess(""), 4000);
    } catch (err) {
      setShareError(err.message || "Failed to share tree.");
    } finally {
      setInviting(false);
    }
  };

  const handleChangePermission = async (share, newPermission) => {
    setRowState((prev) => ({ ...prev, [share.id]: { saving: true, error: "" } }));
    try {
      await api.updateShare(activeTreeId, share.id, newPermission);
      await loadShares();
    } catch (err) {
      setRowState((prev) => ({ ...prev, [share.id]: { saving: false, error: err.message } }));
      return;
    }
    setRowState((prev) => ({ ...prev, [share.id]: { saving: false, error: "" } }));
  };

  const handleRevokeShare = async (share) => {
    if (!window.confirm(`Revoke access for ${share.user_email}?`)) return;
    setRowState((prev) => ({ ...prev, [share.id]: { revoking: true, error: "" } }));
    try {
      await api.removeShare(activeTreeId, share.id);
      await loadShares();
      await refreshTreeList();
    } catch (err) {
      setRowState((prev) => ({ ...prev, [share.id]: { revoking: false, error: err.message } }));
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Handlers for Tree Management (Create, Switch, Rename, Delete, Leave)
  // ──────────────────────────────────────────────────────────────────────────
  const handleSwitchTree = (treeId) => {
    setActiveTreeId(treeId);
  };

  const handleCreateTreeSubmit = async (e) => {
    e.preventDefault();
    if (!newTreeName.trim()) {
      setCreateError("Please enter a name for your family tree.");
      return;
    }
    if (!firstPersonName.trim()) {
      setCreateError("Every family tree requires at least one starting person. Please enter their name.");
      return;
    }
    setCreateSubmitting(true);
    setCreateError("");
    try {
      const result = await createTree(newTreeName.trim(), {
        name: firstPersonName.trim(),
        gender: firstPersonGender,
        dob: firstPersonDob,
      });
      setCreateModalOpen(false);
      setNewTreeName("");
      setFirstPersonName("");
      setFirstPersonGender("unspecified");
      setFirstPersonDob("");
      if (result?.family?.id) {
        setActiveTreeId(result.family.id);
      }
      setActiveTab("people");
    } catch (err) {
      setCreateError(err.message || "Failed to create tree.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!renameModalTree?.id || !renameTreeName.trim()) return;
    setRenameSubmitting(true);
    setRenameError("");
    try {
      await renameTree(renameModalTree.id, renameTreeName.trim());
      setRenameModalTree(null);
    } catch (err) {
      setRenameError(err.message || "Failed to rename tree.");
    } finally {
      setRenameSubmitting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deleteModalTree?.id) return;
    setDeleteSubmitting(true);
    setDeleteError("");
    try {
      await deleteTree(deleteModalTree.id);
      setDeleteModalTree(null);
    } catch (err) {
      setDeleteError(err.message || "Failed to delete tree.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleLeaveSubmit = async () => {
    if (!leaveModalTree?.id) return;
    setLeaveSubmitting(true);
    try {
      await leaveSharedTree(leaveModalTree.id);
      setLeaveModalTree(null);
    } catch (err) {
      alert(err.message || "Failed to leave tree.");
    } finally {
      setLeaveSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F7F5F0] flex flex-col">
      <AppHeader />

      <main className="flex-1 px-4 sm:px-8 lg:px-16 py-8 max-w-6xl mx-auto w-full">
        {/* ── Top Header & Global Actions ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1C1F1D]">
                Manage Family Trees
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#1C4B3C]/10 text-[#1C4B3C]">
                {allTrees.length} {allTrees.length === 1 ? "Tree" : "Trees"}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
              Switch between family trees, create new trees, manage members, and collaborate with relatives.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              id="create-tree-btn"
              type="button"
              onClick={() => {
                setNewTreeName("");
                setFirstPersonName(user?.name || "");
                setFirstPersonGender(user?.gender || "unspecified");
                setFirstPersonDob(user?.dob || "");
                setCreateError("");
                setCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-[#1C4B3C] hover:bg-[#163C30] transition-colors shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Tree</span>
            </button>

            {activeTree && (
              <Link
                id="view-active-tree-canvas-btn"
                to="/tree"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#1C4B3C] bg-white border border-[#D9D3C3] hover:bg-[#F0EDE3] transition-colors shadow-2xs"
              >
                <GitBranch className="w-4 h-4" />
                <span>View in Visual Tree</span>
              </Link>
            )}
          </div>
        </div>

        {/* ── Unified Multi-Tree Command Hub (No Gaps, Attached with Thin Borders) ── */}
        <div className="bg-white border border-[#E7E2D6] rounded-2xl shadow-xs overflow-hidden mb-8">
          {/* Section A: Multi-Tree Hub / Switcher Header */}
          <div className="p-4 sm:p-5 bg-[#FAF8F4]/60 border-b border-[#E7E2D6]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E7E2D6]">
              <div>
                <h2 className="text-sm sm:text-base font-serif font-bold text-[#1C1F1D] flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-[#1C4B3C]" />
                  <span>Your Family Trees</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#1C4B3C]/10 text-[#1C4B3C]">
                    {allTrees.length}
                  </span>
                </h2>
                <p className="text-xs text-[#6B7280]">
                  Select any tree below to view its members, edit its settings, or invite relatives.
                </p>
              </div>

              {/* Tree Type Filter Pills */}
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-[#E7E2D6] self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setTreeCardFilter("all")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    treeCardFilter === "all"
                      ? "bg-[#1C4B3C] text-white shadow-2xs"
                      : "text-[#6B7280] hover:text-[#1C1F1D]"
                  }`}
                >
                  All ({allTrees.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTreeCardFilter("owned")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    treeCardFilter === "owned"
                      ? "bg-[#1C4B3C] text-white shadow-2xs"
                      : "text-[#6B7280] hover:text-[#1C1F1D]"
                  }`}
                >
                  My Trees ({ownedTrees.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTreeCardFilter("shared")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    treeCardFilter === "shared"
                      ? "bg-[#1C4B3C] text-white shadow-2xs"
                      : "text-[#6B7280] hover:text-[#1C1F1D]"
                  }`}
                >
                  Shared with Me ({sharedTrees.length})
                </button>
              </div>
            </div>

            {/* Tree Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
              {filteredTreeCards.map((t) => {
                const isCurrent =
                  activeTreeId === t.id || (!activeTreeId && t.id === ownedTrees[0]?.id);

                return (
                  <div
                    key={t.id}
                    id={`tree-card-${t.id}`}
                    onClick={() => handleSwitchTree(t.id)}
                    className={`rounded-xl p-3.5 transition-all cursor-pointer relative border ${
                      isCurrent
                        ? "border-[#1C4B3C] bg-[#F4F8F5] ring-2 ring-[#1C4B3C]/15 shadow-xs"
                        : "border-[#E7E2D6] bg-white hover:border-[#1C4B3C]/40 hover:bg-[#FAF8F4]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-serif font-bold text-sm text-[#1C1F1D] truncate block">
                            {t.name}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] font-bold bg-[#1C4B3C] text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                              <span>Active</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#6B7280] mt-0.5">
                          {t.isOwned ? (
                            "Created by you"
                          ) : (
                            <span>Owner: <strong>{t.owner_name}</strong></span>
                          )}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                          t.role === "owner"
                            ? "bg-[#1C4B3C]/10 text-[#1C4B3C]"
                            : t.role === "editor"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {t.role}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#6B7280] pt-2 border-t border-[#E7E2D6]/70 mt-2.5">
                      <span className="flex items-center gap-1 font-medium text-[#1C1F1D]">
                        <Users className="w-3.5 h-3.5 text-[#1C4B3C]" />
                        <span>
                          {t.people_count ?? (isCurrent ? people.length : 0)}{" "}
                          {(t.people_count ?? (isCurrent ? people.length : 0)) === 1 ? "member" : "members"}
                        </span>
                      </span>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {t.isOwned ? (
                          <button
                            type="button"
                            id={`delete-tree-btn-${t.id}`}
                            onClick={() => {
                              setDeleteModalTree(t);
                              setDeleteError("");
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded transition-colors"
                            title="Delete family tree"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            id={`leave-tree-btn-${t.id}`}
                            onClick={() => setLeaveModalTree(t)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded transition-colors"
                            title="Leave shared tree"
                          >
                            <LogOut className="w-3 h-3" />
                            <span>Leave</span>
                          </button>
                        )}

                        {t.isOwned && (
                          <button
                            type="button"
                            onClick={() => {
                              setRenameModalTree(t);
                              setRenameTreeName(t.name);
                              setRenameError("");
                            }}
                            className="p-1 text-[#6B7280] hover:text-[#1C1F1D] hover:bg-black/5 rounded transition-colors"
                            title="Rename tree"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Quick "+ New Tree" Card */}
              <button
                type="button"
                id="add-new-tree-card"
                onClick={() => {
                  setNewTreeName("");
                  setFirstPersonName(user?.name || "");
                  setFirstPersonGender(user?.gender || "unspecified");
                  setFirstPersonDob(user?.dob || "");
                  setCreateError("");
                  setCreateModalOpen(true);
                }}
                className="rounded-xl p-3.5 border-2 border-dashed border-[#D9D3C3] hover:border-[#1C4B3C] bg-white hover:bg-[#FAF8F4] transition-all flex flex-col items-center justify-center text-center gap-1.5 min-h-[105px] group"
              >
                <div className="w-7 h-7 rounded-full bg-[#FAF8F4] border border-[#D9D3C3] group-hover:border-[#1C4B3C] group-hover:bg-[#1C4B3C] group-hover:text-white transition-colors flex items-center justify-center text-[#1C4B3C]">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#1C1F1D] group-hover:text-[#1C4B3C] block">
                    + Create Another Tree
                  </span>
                  <span className="text-[11px] text-[#6B7280]">
                    Map another family branch
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Section B: Active Tree Detailed Command Center (Attached directly, no gap!) */}
          <div className="p-5 sm:p-6 pb-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E7E2D6]">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                    Currently Managing:
                  </span>
                  <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1F1D]">
                    {activeTree?.name || "Family Tree"}
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                      myRole === "owner"
                        ? "bg-[#1C4B3C]/10 text-[#1C4B3C]"
                        : myRole === "editor"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {myRole === "owner" && <ShieldCheck className="w-3 h-3" />}
                    {myRole === "editor" && <Pencil className="w-3 h-3" />}
                    {myRole === "viewer" && <Eye className="w-3 h-3" />}
                    <span className="capitalize">{myRole === "owner" ? "Tree Owner" : myRole}</span>
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
                  {people.length} {people.length === 1 ? "family member" : "family members"} in this tree · Tree starter perspective: <strong>{rootPerson?.name || "Not set"}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                <Link
                  to="/tree"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#1C4B3C] bg-[#E7F1EB] hover:bg-[#D7E7DF] transition-colors shadow-2xs"
                >
                  <GitBranch className="w-4 h-4" />
                  <span>Open Canvas</span>
                </Link>
                {canEdit && (
                  <Link
                    to="/people/new"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-[#1C4B3C] hover:bg-[#163C30] transition-colors shadow-2xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Person</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Navigation Tabs for Active Tree (Attached flush with thin border) */}
            <div className="flex items-center gap-2 pt-3 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab("people")}
                className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap -mb-[1px] ${
                  activeTab === "people"
                    ? "border-[#1C4B3C] text-[#1C4B3C]"
                    : "border-transparent text-[#6B7280] hover:text-[#1C1F1D]"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Family Members</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    activeTab === "people"
                      ? "bg-[#1C4B3C] text-white"
                      : "bg-[#E7E2D6] text-[#4B5563]"
                  }`}
                >
                  {people.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("settings")}
                className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap -mb-[1px] ${
                  activeTab === "settings"
                    ? "border-[#1C4B3C] text-[#1C4B3C]"
                    : "border-transparent text-[#6B7280] hover:text-[#1C1F1D]"
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Tree Settings & &quot;Me&quot;</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("sharing")}
                className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap -mb-[1px] ${
                  activeTab === "sharing"
                    ? "border-[#1C4B3C] text-[#1C4B3C]"
                    : "border-transparent text-[#6B7280] hover:text-[#1C1F1D]"
                }`}
              >
                <Share2 className="w-4 h-4" />
                <span>Collaborators</span>
                {sharesData?.shares?.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-[#E7E2D6] text-[#4B5563]">
                    {sharesData.shares.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Thin border line separating tabs from content below */}
          <div className="border-t border-[#E7E2D6]" />

          {/* ──────────────────────────────────────────────────────────────────── */}
          {/* TAB 1: PEOPLE / FAMILY MEMBERS (ATTACHED WITH THIN BORDER)           */}
          {/* ──────────────────────────────────────────────────────────────────── */}
          {activeTab === "people" && (
            <div>
              {/* Search and Filters Bar (Attached with thin border, NO GAP!) */}
              <div className="bg-[#FAF8F4]/60 border-b border-[#E7E2D6] p-4 sm:px-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`Search ${activeTree?.name || "family"} members by name or relationship…`}
                    className="w-full rounded-xl border border-[#D9D3C3] bg-white py-2 pl-9 pr-3 text-xs sm:text-sm text-[#1C1F1D] outline-none transition focus:ring-2 focus:ring-[#1C4B3C]/20 focus:border-[#1C4B3C]"
                  />
                </div>

                {/* Gender & Starter Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto shrink-0 pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setGenderFilter("all")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all whitespace-nowrap ${
                      genderFilter === "all"
                        ? "bg-[#1C4B3C] text-white font-semibold"
                        : "bg-white border border-[#D9D3C3] text-[#6B7280] hover:bg-[#F7F5F0]"
                    }`}
                  >
                    All ({people.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenderFilter("male")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all whitespace-nowrap ${
                      genderFilter === "male"
                        ? "bg-[#1C4B3C] text-white font-semibold"
                        : "bg-white border border-[#D9D3C3] text-[#6B7280] hover:bg-[#F7F5F0]"
                    }`}
                  >
                    Male
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenderFilter("female")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all whitespace-nowrap ${
                      genderFilter === "female"
                        ? "bg-[#1C4B3C] text-white font-semibold"
                        : "bg-white border border-[#D9D3C3] text-[#6B7280] hover:bg-[#F7F5F0]"
                    }`}
                  >
                    Female
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenderFilter("root")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all whitespace-nowrap ${
                      genderFilter === "root"
                        ? "bg-[#1C4B3C] text-white font-semibold"
                        : "bg-white border border-[#D9D3C3] text-[#6B7280] hover:bg-[#F7F5F0]"
                    }`}
                  >
                    Tree Starter (&quot;Me&quot;)
                  </button>
                </div>
              </div>

              {/* People List attached directly */}
              <div>
              {visiblePeople.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-[#E7F1EB] flex items-center justify-center text-[#1C4B3C] mb-3">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-serif font-bold text-[#1C1F1D] mb-1">
                    {query || genderFilter !== "all"
                      ? "No matching family members"
                      : "No family members yet"}
                  </h3>
                  <p className="text-xs text-[#6B7280] max-w-sm mx-auto mb-4">
                    {query || genderFilter !== "all"
                      ? "Try adjusting your search query or filters to find who you're looking for."
                      : `Get started by adding the first relative to "${activeTree?.name}".`}
                  </p>
                  {canEdit && (
                    <Link
                      to="/people/new"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#1C4B3C] hover:bg-[#163C30] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Family Member</span>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-[#E7E2D6]">
                  {visiblePeople.map((person) => {
                    const isRoot = person.id === rootPersonId;
                    const summary = relationSummary(person, getPerson);

                    return (
                      <div
                        key={person.id}
                        id={`person-row-${person.id}`}
                        className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF8F4] transition-colors"
                      >
                        {/* Member Identity & Details */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${
                              person.gender === "female"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : person.gender === "male"
                                ? "bg-teal-50 text-[#1C4B3C] border-teal-200"
                                : "bg-gray-100 text-gray-700 border-gray-200"
                            }`}
                          >
                            {(person.name || "U")[0].toUpperCase()}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link
                                to={`/people/${person.id}`}
                                className="text-sm font-semibold text-[#1C1F1D] hover:text-[#1C4B3C] transition-colors truncate"
                              >
                                {person.name}
                              </Link>
                              {isRoot && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1C4B3C] text-white">
                                  <UserCheck className="w-2.5 h-2.5" />
                                  <span>Tree Starter (&quot;Me&quot;)</span>
                                </span>
                              )}
                              {person.gender && person.gender !== "unspecified" && (
                                <span className="text-[10px] text-[#6B7280] bg-[#F7F5F0] px-1.5 py-0.5 rounded capitalize">
                                  {person.gender}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-xs text-[#6B7280] mt-0.5 truncate">
                              {(person.dob || person.dod) && (
                                <span>
                                  {person.dob ? person.dob.slice(0, 4) : "—"} -{" "}
                                  {person.dod ? person.dod.slice(0, 4) : "Present"}
                                </span>
                              )}
                              {(person.dob || person.dod) && summary && <span>·</span>}
                              {summary && <span className="truncate">{summary}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                          <Link
                            to={`/tree?person=${person.id}`}
                            className="px-2.5 py-1.5 text-xs font-medium text-[#1C4B3C] bg-[#E7F1EB] hover:bg-[#D7E7DF] rounded-lg transition-colors flex items-center gap-1"
                            title="Focus in visual tree"
                          >
                            <GitBranch className="w-3.5 h-3.5" />
                            <span>Tree View</span>
                          </Link>

                          {!isRoot && (
                            <button
                              type="button"
                              onClick={() => setConfirmSetMePerson(person)}
                              className="px-2.5 py-1.5 text-xs font-medium text-[#4B5563] bg-[#F7F5F0] hover:bg-[#E7E2D6] rounded-lg transition-colors flex items-center gap-1"
                              title="Set as 'Me' perspective"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Set as &quot;Me&quot;</span>
                            </button>
                          )}

                          {canEdit && (
                            <Link
                              to={`/people/${person.id}/edit`}
                              className="p-1.5 text-[#4B5563] hover:text-[#1C1F1D] hover:bg-[#F7F5F0] rounded-lg transition-colors"
                              title="Edit person"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Link>
                          )}

                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeletePersonId(person.id)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete person"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {pageCount > 1 && (
                <div className="p-4 bg-[#FAF8F4] border-t border-[#E7E2D6] flex items-center justify-between text-xs text-[#6B7280]">
                  <span>
                    Showing {(page - 1) * perPage + 1} -{" "}
                    {Math.min(page * perPage, filteredPeople.length)} of {filteredPeople.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="p-1.5 rounded-lg border border-[#E7E2D6] bg-white disabled:opacity-40 hover:bg-[#F7F5F0]"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span>
                      Page {page} of {pageCount}
                    </span>
                    <button
                      type="button"
                      disabled={page >= pageCount}
                      onClick={() => setPage((p) => p + 1)}
                      className="p-1.5 rounded-lg border border-[#E7E2D6] bg-white disabled:opacity-40 hover:bg-[#F7F5F0]"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* TAB 2: TREE SETTINGS & "ME" PERSPECTIVE (ATTACHED SEAMLESSLY)        */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        {activeTab === "settings" && (
          <div className="divide-y divide-[#E7E2D6]">
            {/* Rename Form */}
            {canManage ? (
              <div className="p-5 sm:p-6">
                <h3 className="text-base font-serif font-bold text-[#1C1F1D] mb-1">
                  Family Tree Name
                </h3>
                <p className="text-xs text-[#6B7280] mb-4">
                  Update the official title displayed across the app, tree export, and shared invitations.
                </p>

                <form onSubmit={handleSaveTreeName} className="max-w-md space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={treeNameInput}
                      onChange={(e) => setTreeNameInput(e.target.value)}
                      placeholder="e.g. Vance Family Tree"
                      maxLength={100}
                      className="flex-1 rounded-xl border border-[#D9D3C3] px-3.5 py-2 text-sm text-[#1C1F1D] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 focus:border-[#1C4B3C]"
                    />
                    <button
                      type="submit"
                      disabled={savingTreeName || !treeNameInput.trim()}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#1C4B3C] hover:bg-[#163C30] disabled:opacity-50 transition-colors shadow-2xs shrink-0"
                    >
                      {savingTreeName ? "Saving…" : "Save Name"}
                    </button>
                  </div>

                  {treeNameSuccess && (
                    <p className="text-xs text-emerald-700 font-medium">{treeNameSuccess}</p>
                  )}
                  {treeNameError && (
                    <p className="text-xs text-rose-700 font-medium">{treeNameError}</p>
                  )}
                </form>
              </div>
            ) : (
              <div className="p-5 sm:p-6">
                <h3 className="text-base font-serif font-bold text-[#1C1F1D] mb-1">
                  Family Tree Name
                </h3>
                <p className="text-sm font-semibold text-[#1C1F1D] mt-2">
                  {activeTree?.name}
                </p>
                <p className="text-xs text-[#6B7280] mt-1">
                  Only the tree owner can rename this tree.
                </p>
              </div>
            )}

            {/* Starting Person ("Me") Configuration */}
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-base font-serif font-bold text-[#1C1F1D]">
                    Starting Person (&quot;Me&quot;) Perspective
                  </h3>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    Rootline calculates all relationships (&quot;your grandmother&quot;, &quot;your second cousin&quot;) and generational heights relative to this person.
                  </p>
                </div>
                {rootPerson && (
                  <span className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#E7F1EB] text-[#1C4B3C] border border-teal-200">
                    Current: {rootPerson.name}
                  </span>
                )}
              </div>

              <div className="max-w-md space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    type="text"
                    value={rootPersonSearch}
                    onChange={(e) => setRootPersonSearch(e.target.value)}
                    placeholder="Search relative to set as starting person…"
                    className="w-full rounded-xl border border-[#D9D3C3] py-2 pl-9 pr-3 text-xs text-[#1C1F1D] outline-none focus:border-[#1C4B3C]"
                  />
                </div>

                <div className="border border-[#E7E2D6] rounded-xl divide-y divide-[#E7E2D6] max-h-48 overflow-y-auto bg-[#FAF8F4]/30">
                  {rootCandidates.map((candidate) => {
                    const isCandidateRoot = candidate.id === rootPersonId;
                    return (
                      <div
                        key={candidate.id}
                        className="px-3.5 py-2 flex items-center justify-between text-xs hover:bg-white transition-colors"
                      >
                        <span className="font-medium text-[#1C1F1D] truncate">
                          {candidate.name}
                        </span>
                        {isCandidateRoot ? (
                          <span className="text-[10px] font-bold text-[#1C4B3C] bg-[#E7F1EB] px-2 py-0.5 rounded">
                            Active Starter
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmSetMePerson(candidate)}
                            className="text-[11px] font-semibold text-[#1C4B3C] hover:underline"
                          >
                            Set as Starter
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Tree Statistics */}
            <div className="p-5 sm:p-6">
              <h3 className="text-base font-serif font-bold text-[#1C1F1D] mb-1">
                Generational & Demographic Statistics
              </h3>
              <p className="text-xs text-[#6B7280] mb-4">
                Overview of family links and records recorded in {activeTree?.name}.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#FAF8F4] border border-[#E7E2D6]">
                  <p className="text-xs text-[#6B7280]">Total Relatives</p>
                  <p className="text-xl font-bold text-[#1C1F1D] mt-1">{stats.total}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAF8F4] border border-[#E7E2D6]">
                  <p className="text-xs text-[#6B7280]">Couples / Unions</p>
                  <p className="text-xl font-bold text-[#1C1F1D] mt-1">{stats.couplesCount}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAF8F4] border border-[#E7E2D6]">
                  <p className="text-xs text-[#6B7280]">Living Relatives</p>
                  <p className="text-xl font-bold text-emerald-800 mt-1">{stats.livingCount}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAF8F4] border border-[#E7E2D6]">
                  <p className="text-xs text-[#6B7280]">Passed Ancestors</p>
                  <p className="text-xl font-bold text-[#4B5563] mt-1">{stats.deceasedCount}</p>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="p-5 sm:p-6 bg-rose-50/20">
              <h3 className="text-base font-serif font-bold text-rose-900 mb-1">
                Danger Zone
              </h3>
              {canManage ? (
                <div>
                  <p className="text-xs text-rose-700 mb-4">
                    Deleting this family tree will permanently remove all {people.length} member records, relationship links, and shared collaborator permissions. This cannot be undone.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteModalTree(activeTree);
                      setDeleteError("");
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-2xs"
                  >
                    Permanently Delete Tree
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-rose-700 mb-4">
                    Leave this shared tree. You will lose access to its branches until the owner invites you again.
                  </p>
                  <button
                    type="button"
                    onClick={() => setLeaveModalTree(activeTree)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-2xs"
                  >
                    Leave Shared Tree
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* TAB 3: COLLABORATORS & SHARING (ATTACHED SEAMLESSLY)                  */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        {activeTab === "sharing" && (
          <div className="divide-y divide-[#E7E2D6]">
            {/* Invite Collaborator Section */}
            {canManage ? (
              <div className="p-5 sm:p-6">
                <h3 className="text-base font-serif font-bold text-[#1C1F1D] mb-1">
                  Invite Relative or Collaborator
                </h3>
                <p className="text-xs text-[#6B7280] mb-4">
                  Share &quot;{activeTree?.name}&quot; with family members so they can view or edit branches.
                </p>

                <form onSubmit={handleInvite} className="max-w-xl space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative flex-1">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                      <input
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="relative@example.com"
                        className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-[#D9D3C3] bg-white text-[#1C1F1D] focus:border-[#1C4B3C] outline-none"
                      />
                    </div>

                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#D9D3C3] bg-white text-[#1C1F1D] focus:border-[#1C4B3C] outline-none shrink-0"
                    >
                      <option value="editor">Can Edit (Editor)</option>
                      <option value="viewer">Can View (Viewer)</option>
                    </select>

                    <button
                      type="submit"
                      disabled={inviting || !inviteEmail.trim()}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#1C4B3C] hover:bg-[#163C30] disabled:opacity-50 transition-colors shadow-2xs shrink-0 flex items-center justify-center gap-1.5"
                    >
                      {inviting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{inviting ? "Inviting…" : "Invite"}</span>
                    </button>
                  </div>

                  {inviteSuccess && (
                    <p className="text-xs text-emerald-700 font-medium">{inviteSuccess}</p>
                  )}
                  {shareError && (
                    <p className="text-xs text-rose-700 font-medium">{shareError}</p>
                  )}
                </form>
              </div>
            ) : (
              <div className="p-5 sm:p-6">
                <p className="text-xs text-[#6B7280]">
                  Only the tree owner can invite new collaborators or change access roles.
                </p>
              </div>
            )}

            {/* Active Collaborators List */}
            <div className="p-5 sm:p-6">
              <h3 className="text-base font-serif font-bold text-[#1C1F1D] mb-1">
                Active Tree Collaborators
              </h3>
              <p className="text-xs text-[#6B7280] mb-4">
                People who currently have access to view or modify this tree.
              </p>

              {loadingShares ? (
                <div className="py-8 flex items-center justify-center text-xs text-[#6B7280] gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#1C4B3C]" />
                  <span>Loading collaborator access list…</span>
                </div>
              ) : (
                <div className="border border-[#E7E2D6] rounded-xl divide-y divide-[#E7E2D6] overflow-hidden">
                  {/* Tree Owner Entry */}
                  <div className="p-3.5 flex items-center justify-between bg-[#FAF8F4]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#1C4B3C] text-white flex items-center justify-center text-xs font-bold">
                        O
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#1C1F1D]">
                          {sharesData?.owner?.name || "Tree Creator"} (Owner)
                        </p>
                        <p className="text-[11px] text-[#6B7280]">
                          {sharesData?.owner?.email || "Primary Owner"}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-[#1C4B3C] bg-[#E7F1EB] px-2.5 py-0.5 rounded-full">
                      Owner
                    </span>
                  </div>

                  {/* Shared Users */}
                  {(sharesData?.shares || []).map((share) => {
                    const state = rowState[share.id] || {};
                    return (
                      <div
                        key={share.id}
                        className="p-3.5 flex items-center justify-between hover:bg-[#FAF8F4] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#FAF8F4] border border-[#E7E2D6] text-[#1C4B3C] flex items-center justify-center text-xs font-bold">
                            {(share.user_name || share.user_email || "U")[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[#1C1F1D]">
                              {share.user_name || share.user_email}
                            </p>
                            {share.user_name && (
                              <p className="text-[11px] text-[#6B7280]">{share.user_email}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {canManage ? (
                            <>
                              <select
                                value={share.permission}
                                disabled={state.saving || state.revoking}
                                onChange={(e) =>
                                  handleChangePermission(share, e.target.value)
                                }
                                className="text-xs rounded-lg border border-[#D9D3C3] px-2.5 py-1 bg-white"
                              >
                                <option value="editor">Editor</option>
                                <option value="viewer">Viewer</option>
                              </select>
                              <button
                                type="button"
                                disabled={state.saving || state.revoking}
                                onClick={() => handleRevokeShare(share)}
                                className="text-xs text-rose-600 hover:text-rose-800 p-1.5 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Revoke access"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] font-medium text-[#4B5563] capitalize bg-gray-100 px-2 py-0.5 rounded-full">
                              {share.permission}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {(!sharesData?.shares || sharesData.shares.length === 0) && (
                    <div className="p-4 text-center text-xs text-[#9CA3AF]">
                      No additional collaborators have been invited yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </main>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* MODALS                                                               */}
      {/* ──────────────────────────────────────────────────────────────────── */}

      {/* 1. Create Tree Modal */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setCreateModalOpen(false)}
        >
          <div
            className="bg-white border border-[#E7E2D6] rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-serif font-bold text-[#1C1F1D]">
                  Create a New Family Tree
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Set a tree name and add your first person to start mapping branches.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7280] hover:bg-[#F0EDE3]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTreeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                  Family Tree Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTreeName}
                  onChange={(e) => setNewTreeName(e.target.value)}
                  placeholder="e.g. Vance Family Tree, Maternal Roots"
                  maxLength={100}
                  autoFocus
                  required
                  className="w-full text-sm rounded-xl border border-[#D9D3C3] px-3.5 py-2.5 bg-white text-[#1C1F1D] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 focus:border-[#1C4B3C]"
                />
              </div>

              <div className="rounded-xl border border-[#DCE3E1] bg-[#F7F9F7] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <User className="w-4 h-4 text-[#1C4B3C]" />
                    <span className="text-xs font-bold text-[#1C4B3C]">
                      First Person (Tree Starter)
                    </span>
                    <span className="text-[10px] bg-[#1C4B3C] text-white px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">
                      Required
                    </span>
                  </div>
                  {user?.name && (
                    <button
                      type="button"
                      onClick={() => {
                        setFirstPersonName(user.name);
                        if (user.gender) setFirstPersonGender(user.gender);
                        if (user.dob) setFirstPersonDob(user.dob);
                      }}
                      className="text-[11px] font-semibold text-[#1C4B3C] hover:underline"
                    >
                      Use my profile info
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={firstPersonName}
                    onChange={(e) => setFirstPersonName(e.target.value)}
                    placeholder="e.g. Julian Vance"
                    required
                    maxLength={120}
                    className="w-full text-sm rounded-xl border border-[#D9D3C3] px-3.5 py-2 bg-white text-[#1C1F1D] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 focus:border-[#1C4B3C]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1">
                      Gender
                    </label>
                    <select
                      value={firstPersonGender}
                      onChange={(e) => setFirstPersonGender(e.target.value)}
                      className="w-full text-xs rounded-xl border border-[#D9D3C3] px-3 py-2 bg-white text-[#1C1F1D] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 focus:border-[#1C4B3C]"
                    >
                      <option value="unspecified">Prefer not to say</option>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1">
                      Birth Year / Date
                    </label>
                    <input
                      type="date"
                      value={firstPersonDob}
                      onChange={(e) => setFirstPersonDob(e.target.value)}
                      className="w-full text-xs rounded-xl border border-[#D9D3C3] px-3 py-2 bg-white text-[#1C1F1D] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 focus:border-[#1C4B3C]"
                    />
                  </div>
                </div>
              </div>

              {createError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E7E2D6]">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-[#6B7280] hover:text-[#1C1F1D] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting || !newTreeName.trim() || !firstPersonName.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1C4B3C] hover:bg-[#163C30] rounded-xl shadow-2xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {createSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{createSubmitting ? "Creating Tree…" : "Create Tree & Add Person"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Rename Tree Modal */}
      {renameModalTree && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setRenameModalTree(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-[#E7E2D6]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-serif font-bold text-[#1C1F1D] mb-1">
              Rename Family Tree
            </h3>
            <p className="text-xs text-[#6B7280] mb-4">
              Enter a new title for this tree.
            </p>

            <form onSubmit={handleRenameSubmit} className="space-y-3">
              <input
                type="text"
                value={renameTreeName}
                onChange={(e) => setRenameTreeName(e.target.value)}
                placeholder="e.g. Maternal Family Tree"
                maxLength={100}
                required
                autoFocus
                className="w-full text-sm rounded-xl border border-[#D9D3C3] px-3.5 py-2 bg-white text-[#1C1F1D] focus:outline-none focus:border-[#1C4B3C]"
              />

              {renameError && (
                <p className="text-xs text-red-600">{renameError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenameModalTree(null)}
                  className="px-4 py-2 text-xs font-medium text-[#6B7280] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renameSubmitting || !renameTreeName.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1C4B3C] hover:bg-[#163C30] rounded-xl"
                >
                  {renameSubmitting ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Delete Tree Confirmation */}
      {deleteModalTree && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => {
            setDeleteModalTree(null);
            setDeleteError("");
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-rose-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-serif font-bold text-rose-900 mb-2">
              Permanently Delete Tree?
            </h3>
            <p className="text-xs text-rose-700 leading-relaxed mb-4">
              This will erase <strong>{deleteModalTree.name}</strong> and all its members. This action cannot be undone.
            </p>

            {deleteError && (
              <div className="p-2.5 mb-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalTree(null);
                  setDeleteError("");
                }}
                className="px-4 py-2 text-xs font-medium text-[#6B7280] rounded-xl hover:text-[#1C1F1D]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={handleDeleteSubmit}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl disabled:opacity-50 flex items-center gap-1.5"
              >
                {deleteSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{deleteSubmitting ? "Deleting…" : "Yes, Delete Tree"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Leave Shared Tree Confirmation */}
      {leaveModalTree && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setLeaveModalTree(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-rose-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-serif font-bold text-rose-900 mb-2">
              Leave Shared Tree?
            </h3>
            <p className="text-xs text-rose-700 leading-relaxed mb-5">
              You will lose access to <strong>{leaveModalTree.name}</strong> until the owner invites you again.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setLeaveModalTree(null)}
                className="px-4 py-2 text-xs font-medium text-[#6B7280] rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={leaveSubmitting}
                onClick={handleLeaveSubmit}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl"
              >
                {leaveSubmitting ? "Leaving…" : "Yes, Leave Tree"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Delete Person Confirmation */}
      {confirmDeletePersonId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-[#E7E2D6]">
            <div className="flex items-center gap-3 text-[#B3441C] mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-[#B3441C]" />
              </div>
              <div>
                <h3 className="text-base font-serif font-bold text-[#1C1F1D]">Delete Member?</h3>
                <p className="text-xs text-[#6B7280]">Remove this person from {activeTree?.name}</p>
              </div>
            </div>

            <p className="text-xs text-[#4B5563] leading-relaxed mb-6">
              Are you sure you want to remove{" "}
              <strong>{getPerson(confirmDeletePersonId)?.name}</strong>? Their relationship links
              will be unlinked.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeletePersonId(null)}
                className="px-4 py-2 text-xs font-medium text-[#6B7280] hover:text-[#1C1F1D] rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deletePerson(confirmDeletePersonId);
                  setConfirmDeletePersonId(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#B3441C] hover:bg-[#9B3714] rounded-xl shadow-sm transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Set as Me Confirmation */}
      {confirmSetMePerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E7E2D6]">
            <div className="flex items-center gap-3 text-[#1C4B3C] mb-3">
              <div className="w-10 h-10 rounded-full bg-[#E7F1EB] flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5 text-[#1C4B3C]" />
              </div>
              <div>
                <h3 className="text-base font-serif font-bold text-[#1C1F1D]">
                  Set {confirmSetMePerson.name} as &quot;Me&quot;?
                </h3>
                <p className="text-xs text-[#6B7280]">Change tree&apos;s starting person perspective</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#374151] leading-relaxed mb-6">
              Are you sure you want to set <strong>{confirmSetMePerson.name}</strong> as{" "}
              <strong>&quot;Me&quot;</strong>? The family tree will re-orient around them, with relationship
              paths and generational levels calculated from their perspective.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmSetMePerson(null)}
                className="px-4 py-2 text-xs font-medium text-[#6B7280] hover:text-[#1C1F1D] rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setRootPersonId(confirmSetMePerson.id);
                  setConfirmSetMePerson(null);
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
    </div>
  );
}
