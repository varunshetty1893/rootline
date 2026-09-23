import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  GitBranch,
  GitBranch as TreeIcon,
  Users,
  Eye,
  Edit3,
  Calendar,
  Mail,
  UserCheck,
  LogOut,
  Plus,
  Share2,
  Trash2,
  Pencil,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Loader2,
  Sparkles,
  User,
  X,
  Clock,
  Check,
} from "lucide-react";
import AppHeader from "./AppHeader.jsx";
import { useAuth } from "../AuthContext.jsx";
import { useFamily } from "./FamilyContext.jsx";
import ShareModal from "./ShareModal.jsx";
import { api } from "../api.js";

export default function SharedTrees() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    people,
    activeTreeId,
    setActiveTreeId,
    activeTree,
    myRole,
    treeList = { owned_trees: [], shared_trees: [] },
    refreshTreeList,
    createTree,
    renameTree,
    deleteTree,
    leaveSharedTree,
  } = useFamily();

  const [activeTab, setActiveTab] = useState("shared"); // 'shared' | 'owned'
  const [shareModalTree, setShareModalTree] = useState(null);

  // Pending invitations state
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [inviteActionId, setInviteActionId] = useState(null);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState("");
  const [inviteErrorMsg, setInviteErrorMsg] = useState("");

  const loadPendingInvites = useCallback(async () => {
    setLoadingInvites(true);
    try {
      const res = await api.getMyPendingInvitations();
      setPendingInvites(res.invitations || []);
    } catch {
      // silent ignore if unauthenticated or error
    } finally {
      setLoadingInvites(false);
    }
  }, []);

  useEffect(() => {
    loadPendingInvites();
    refreshTreeList();
  }, [loadPendingInvites, refreshTreeList]);

  const handleAcceptInvite = async (inv) => {
    setInviteActionId(inv.id);
    setInviteSuccessMsg("");
    setInviteErrorMsg("");
    try {
      const res = await api.acceptInvitation(inv.token);
      setInviteSuccessMsg(res.message || `Accepted invitation to ${inv.family_name}!`);
      setPendingInvites((prev) => prev.filter((item) => item.id !== inv.id && item.token !== inv.token));
      await refreshTreeList();
      await loadPendingInvites();
      setTimeout(() => setInviteSuccessMsg(""), 5000);
    } catch (err) {
      setInviteErrorMsg(err.message || "Failed to accept invitation.");
    } finally {
      setInviteActionId(null);
    }
  };

  const handleDeclineInvite = async (inv) => {
    setInviteActionId(inv.id);
    setInviteSuccessMsg("");
    setInviteErrorMsg("");
    try {
      await api.declineInvitation(inv.token);
      setInviteSuccessMsg(`Declined invitation to ${inv.family_name}.`);
      setPendingInvites((prev) => prev.filter((item) => item.id !== inv.id && item.token !== inv.token));
      await loadPendingInvites();
      setTimeout(() => setInviteSuccessMsg(""), 5000);
    } catch (err) {
      setInviteErrorMsg(err.message || "Failed to decline invitation.");
    } finally {
      setInviteActionId(null);
    }
  };

  // Create tree modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTreeName, setNewTreeName] = useState("");
  const [firstPersonName, setFirstPersonName] = useState("");
  const [firstPersonGender, setFirstPersonGender] = useState("unspecified");
  const [firstPersonDob, setFirstPersonDob] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");

  // Rename modal state
  const [renameModalTree, setRenameModalTree] = useState(null);
  const [renameName, setRenameName] = useState("");
  const [renameSubmitting, setRenameSubmitting] = useState(false);
  const [renameError, setRenameError] = useState("");

  // Delete modal state
  const [deleteModalTree, setDeleteModalTree] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Leave shared tree state
  const [leaveModalTree, setLeaveModalTree] = useState(null);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveError, setLeaveError] = useState("");

  const sharedTrees = useMemo(() => {
    const list = [...(treeList?.shared_trees || [])];
    const ownedIds = new Set((treeList?.owned_trees || []).map((t) => t.id));
    if (user?.id) ownedIds.add(user.id);

    if (
      activeTree &&
      activeTree.owner_id !== user?.id &&
      activeTree.id !== user?.id &&
      !ownedIds.has(activeTree.id) &&
      !activeTree.isOwned &&
      myRole !== "owner" &&
      !list.some((t) => t.id === activeTree.id)
    ) {
      list.push({
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

    // Strict filter: Exclude any tree owned by the current user
    return list.filter(
      (t) =>
        t &&
        t.owner_id !== user?.id &&
        t.id !== user?.id &&
        !ownedIds.has(t.id)
    );
  }, [treeList?.shared_trees, treeList?.owned_trees, activeTree, myRole, user?.id, people?.length]);

  const ownedTrees = useMemo(() => {
    const list = [...(treeList?.owned_trees || [])];
    if (
      activeTree &&
      (activeTree.isOwned || myRole === "owner") &&
      !list.some((t) => t.id === activeTree.id)
    ) {
      list.push({
        id: activeTree.id,
        name: activeTree.name || "My Family Tree",
        owner_id: user?.id,
        role: "owner",
        isOwned: true,
        people_count: activeTree.people_count ?? people?.length ?? 0,
        created_at: activeTree.created_at || new Date().toISOString(),
      });
    }
    return list;
  }, [treeList?.owned_trees, activeTree, myRole, user?.id, people?.length]);

  const handleOpenTree = (treeId, destination = "/tree") => {
    setActiveTreeId(treeId);
    navigate(destination);
  };

  const handleCreateTreeSubmit = async (e) => {
    e.preventDefault();
    if (!newTreeName.trim()) {
      setCreateError("Please provide a name for your family tree.");
      return;
    }
    if (!firstPersonName.trim()) {
      setCreateError("Every family tree requires at least one starting person. Please enter their name.");
      return;
    }
    setCreateSubmitting(true);
    setCreateError("");
    try {
      await createTree(newTreeName.trim(), {
        name: firstPersonName.trim(),
        gender: firstPersonGender,
        dob: firstPersonDob,
      });
      setCreateModalOpen(false);
      setNewTreeName("");
      setFirstPersonName("");
      setFirstPersonGender("unspecified");
      setFirstPersonDob("");
      navigate("/tree");
    } catch (err) {
      setCreateError(err.message || "Failed to create family tree.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!renameName.trim() || !renameModalTree) {
      setRenameError("Please enter a tree name.");
      return;
    }
    setRenameSubmitting(true);
    setRenameError("");
    try {
      await renameTree(renameModalTree.id, renameName.trim());
      setRenameModalTree(null);
    } catch (err) {
      setRenameError(err.message || "Failed to rename family tree.");
    } finally {
      setRenameSubmitting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deleteModalTree) return;
    setDeleteSubmitting(true);
    setDeleteError("");
    try {
      await deleteTree(deleteModalTree.id);
      setDeleteModalTree(null);
    } catch (err) {
      setDeleteError(err.message || "Failed to delete family tree.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleLeaveSubmit = async () => {
    if (!leaveModalTree) return;
    setLeaveSubmitting(true);
    setLeaveError("");
    try {
      await leaveSharedTree(leaveModalTree.id);
      setLeaveModalTree(null);
    } catch (err) {
      setLeaveError(err.message || "Failed to leave shared tree.");
    } finally {
      setLeaveSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] flex flex-col font-sans text-[#1C1F1D]">
      <AppHeader />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Top Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-8 border-b border-[#E7E2D6]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-[#1C4B3C]/10 text-[#1C4B3C]">
                <Users className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold tracking-wider uppercase text-[#1C4B3C]">
                Tree Management & Collaboration
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1C1F1D]">
              Shared & Family Trees
            </h1>
            <p className="text-sm text-[#6B7280] mt-1 max-w-2xl">
              Access trees shared with you by other relatives, manage collaboration permissions, or
              organize separate branches with multiple trees.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setNewTreeName(`${user?.name || "My"}'s Family Tree`);
                setFirstPersonName(user?.name || "");
                setFirstPersonGender(user?.gender && user.gender !== "unspecified" ? user.gender : "unspecified");
                setFirstPersonDob(user?.dob || "");
                setCreateError("");
                setCreateModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1C4B3C] text-white text-xs font-semibold hover:bg-[#163C30] shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Tree</span>
            </button>

            {activeTree && (
              <button
                type="button"
                onClick={() => setShareModalTree(activeTree)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-[#E7E2D6] text-[#1C1F1D] text-xs font-semibold hover:bg-[#FAF8F4] shadow-2xs transition-colors"
              >
                <Share2 className="w-4 h-4 text-[#1C4B3C]" />
                <span>Share Current Tree</span>
              </button>
            )}
          </div>
        </div>

        {/* Pending Invitations Banner / Card List */}
        {inviteSuccessMsg && (
          <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{inviteSuccessMsg}</span>
          </div>
        )}
        {inviteErrorMsg && (
          <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{inviteErrorMsg}</span>
          </div>
        )}

        {pendingInvites.length > 0 && (
          <div className="mt-6 p-5 rounded-2xl bg-amber-50/60 border border-amber-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                  <Mail className="w-4 h-4" />
                </span>
                <h2 className="text-sm font-bold text-amber-900">
                  Pending Invitations for You ({pendingInvites.length})
                </h2>
              </div>
              <span className="text-[11px] text-amber-700">
                Action required to join
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {pendingInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="p-4 rounded-xl bg-white border border-amber-200/90 shadow-2xs space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-[#1C1F1D] truncate">
                        {inv.family_name}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1C4B3C]/10 text-[#1C4B3C] border border-[#1C4B3C]/20 capitalize">
                        {inv.permission}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280] mt-1">
                      Invited by: <strong>{inv.inviter_name}</strong> ({inv.inviter_email})
                    </p>
                    {inv.message && (
                      <p className="text-xs italic text-[#4B5563] mt-2 bg-[#F7F5F0] p-2 rounded border border-[#E7E2D6]">
                        "{inv.message}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[#E7E2D6]">
                    <button
                      type="button"
                      disabled={inviteActionId === inv.id}
                      onClick={() => handleAcceptInvite(inv)}
                      className="flex-1 py-1.5 px-3 bg-[#1C4B3C] hover:bg-[#163C30] disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
                    >
                      {inviteActionId === inv.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      Accept Invitation
                    </button>
                    <button
                      type="button"
                      disabled={inviteActionId === inv.id}
                      onClick={() => handleDeclineInvite(inv)}
                      className="py-1.5 px-3 border border-[#E7E2D6] hover:bg-red-50 hover:text-red-700 text-[#6B7280] rounded-lg text-xs font-semibold transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation Tabs: Shared With Me vs My Family Trees */}
        <div className="flex items-center gap-2 mt-8 mb-6 border-b border-[#E7E2D6] pb-px">
          <button
            type="button"
            onClick={() => setActiveTab("shared")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "shared"
                ? "border-[#1C4B3C] text-[#1C4B3C]"
                : "border-transparent text-[#6B7280] hover:text-[#1C1F1D]"
            }`}
          >
            <span>Shared With Me</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === "shared"
                  ? "bg-[#1C4B3C] text-white"
                  : "bg-[#E7E2D6] text-[#4B5563]"
              }`}
            >
              {sharedTrees.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("owned")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "owned"
                ? "border-[#1C4B3C] text-[#1C4B3C]"
                : "border-transparent text-[#6B7280] hover:text-[#1C1F1D]"
            }`}
          >
            <span>My Family Trees</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === "owned"
                  ? "bg-[#1C4B3C] text-white"
                  : "bg-[#E7E2D6] text-[#4B5563]"
              }`}
            >
              {ownedTrees.length}
            </span>
          </button>
        </div>

        {/* Tab 1: Trees Shared with Me */}
        {activeTab === "shared" && (
          <div>
            {sharedTrees.length === 0 ? (
              <div className="bg-white border border-[#E7E2D6] rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-[#1C4B3C]/10 text-[#1C4B3C] flex items-center justify-center mx-auto mb-4">
                  <Users className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-serif font-bold text-[#1C1F1D] mb-2">
                  No trees shared with you yet
                </h3>
                <p className="text-xs sm:text-sm text-[#6B7280] leading-relaxed mb-6 max-w-md mx-auto">
                  When a family member or relative invites your email (
                  <strong className="text-[#1C1F1D]">{user?.email}</strong>) to collaborate on
                  their tree, it will appear right here with full access. Your own family trees remain safe under your personal ownership.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setNewTreeName(`${user?.name || "My"}'s Family Tree`);
                      setFirstPersonName(user?.name || "");
                      setFirstPersonGender(user?.gender && user.gender !== "unspecified" ? user.gender : "unspecified");
                      setFirstPersonDob(user?.dob || "");
                      setCreateError("");
                      setCreateModalOpen(true);
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#1C4B3C] hover:bg-[#163C30] text-white text-xs font-semibold rounded-xl px-4 py-2.5 shadow-sm transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create New Family Tree</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("owned")}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-[#FAF8F4] border border-[#E7E2D6] text-[#1C1F1D] text-xs font-semibold rounded-xl px-4 py-2.5 transition-colors"
                  >
                    <FolderTree className="w-4 h-4 text-[#1C4B3C]" />
                    <span>View My Trees ({ownedTrees.length})</span>
                  </button>
                </div>

                <div className="bg-[#FAF8F4] border border-[#E7E2D6] rounded-xl p-4 text-left text-xs space-y-2.5 max-w-md mx-auto">
                  <p className="font-semibold text-[#1C1F1D] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#C9A468]" />
                    How tree sharing works:
                  </p>
                  <ul className="list-disc list-inside text-[#6B7280] space-y-1">
                    <li>
                      Tree owners can invite you as an <strong className="text-[#1C1F1D]">Editor</strong>{" "}
                      (to add people and photos) or <strong className="text-[#1C1F1D]">Viewer</strong>{" "}
                      (read-only).
                    </li>
                    <li>You can seamlessly switch between your own tree and any shared trees.</li>
                    <li>
                      Collaborators cannot delete your personal tree or remove you as the owner.
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {sharedTrees.map((tree) => {
                  const isActive = activeTreeId === tree.id;
                  const isEditor = tree.role === "editor";
                  const ownerInitial = (tree.owner_name?.[0] || tree.owner_email?.[0] || "O").toUpperCase();

                  return (
                    <div
                      key={tree.id}
                      className={`bg-white border rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between transition-all ${
                        isActive
                          ? "border-[#1C4B3C] ring-2 ring-[#1C4B3C]/10 shadow-md"
                          : "border-[#E7E2D6] hover:border-[#1C4B3C]/40"
                      }`}
                    >
                      <div>
                        {/* Header: Title + Role Badge */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base sm:text-lg font-serif font-bold text-[#1C1F1D]">
                                {tree.name}
                              </h3>
                              {isActive && (
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#1C4B3C] text-white px-2 py-0.5 rounded-full">
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#6B7280] mt-0.5">
                              {tree.people_count}{" "}
                              {tree.people_count === 1 ? "family member" : "family members"}
                            </p>
                          </div>

                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1.5 shrink-0 ${
                              isEditor
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-amber-50 text-amber-800 border border-amber-200"
                            }`}
                          >
                            {isEditor ? (
                              <>
                                <Edit3 className="w-3 h-3" />
                                <span>Editor Access</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3 h-3" />
                                <span>Viewer (Read-only)</span>
                              </>
                            )}
                          </span>
                        </div>

                        {/* Shared by info */}
                        <div className="flex items-center gap-3 p-3 bg-[#FAF8F4] border border-[#E7E2D6] rounded-xl mb-4">
                          <div className="w-9 h-9 rounded-full bg-[#1C4B3C] text-white flex items-center justify-center text-xs font-bold shadow-2xs shrink-0">
                            {ownerInitial}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                              Shared by owner
                            </p>
                            <p className="text-xs font-semibold text-[#1C1F1D] truncate">
                              {tree.owner_name}
                            </p>
                            <p className="text-[11px] text-[#6B7280] truncate flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-[#9CA3AF] shrink-0" />
                              {tree.owner_email}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="pt-3 border-t border-[#E7E2D6] flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setLeaveModalTree(tree);
                            setLeaveError("");
                          }}
                          className="text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Leave Tree</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenTree(tree.id, "/people")}
                            className="text-xs font-medium text-[#374151] hover:text-[#1C1F1D] bg-[#F7F5F0] hover:bg-[#EAE6DD] px-3 py-1.5 rounded-lg transition-colors"
                          >
                            View People
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenTree(tree.id, "/tree")}
                            className="text-xs font-semibold text-white bg-[#1C4B3C] hover:bg-[#163C30] px-3.5 py-1.5 rounded-lg shadow-2xs flex items-center gap-1 transition-colors"
                          >
                            <span>Open Tree</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: My Family Trees */}
        {activeTab === "owned" && (
          <div>
            {ownedTrees.length === 0 ? (
              <div className="bg-white border border-[#E7E2D6] rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-[#1C4B3C]/10 text-[#1C4B3C] flex items-center justify-center mx-auto mb-4">
                  <TreeIcon className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-serif font-bold text-[#1C1F1D] mb-2">
                  No personal family trees created yet
                </h3>
                <p className="text-xs sm:text-sm text-[#6B7280] leading-relaxed mb-6 max-w-md mx-auto">
                  {sharedTrees.length > 0
                    ? `You are currently collaborating on ${sharedTrees.length} shared tree${sharedTrees.length === 1 ? "" : "s"}. You can also create and build your own independent family tree anytime.`
                    : "Create your own family tree to start mapping your ancestors, parents, and relatives."}
                </p>

                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setNewTreeName("");
                      setCreateError("");
                      setCreateModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1C4B3C] hover:bg-[#163C30] text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Your Family Tree</span>
                  </button>

                  {sharedTrees.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("shared")}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FAF8F4] hover:bg-[#F0EBE1] text-[#1C1F1D] border border-[#E7E2D6] text-xs font-semibold shadow-2xs transition-colors"
                    >
                      <Users className="w-4 h-4 text-[#1C4B3C]" />
                      <span>View Shared Trees ({sharedTrees.length})</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {ownedTrees.map((tree) => {
                  const isActive = activeTreeId === tree.id;
                  const canDelete = ownedTrees.length > 1;

                  return (
                    <div
                      key={tree.id}
                      className={`bg-white border rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between transition-all ${
                        isActive
                          ? "border-[#1C4B3C] ring-2 ring-[#1C4B3C]/10 shadow-md"
                          : "border-[#E7E2D6] hover:border-[#1C4B3C]/40"
                      }`}
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base sm:text-lg font-serif font-bold text-[#1C1F1D]">
                                {tree.name}
                              </h3>
                              {isActive && (
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#1C4B3C] text-white px-2 py-0.5 rounded-full">
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#6B7280] mt-0.5">
                              {tree.people_count}{" "}
                              {tree.people_count === 1 ? "family member" : "family members"}
                            </p>
                          </div>

                          <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-[#1C4B3C]/10 text-[#1C4B3C] border border-[#1C4B3C]/20 flex items-center gap-1">
                            <UserCheck className="w-3 h-3" />
                            <span>Owner</span>
                          </span>
                        </div>

                        {/* Info snippet */}
                        <div className="p-3 bg-[#FAF8F4] border border-[#E7E2D6] rounded-xl mb-4 text-xs text-[#6B7280] flex items-center justify-between">
                          <span>Created by you</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setRenameModalTree(tree);
                                setRenameName(tree.name);
                                setRenameError("");
                              }}
                              className="text-[#1C4B3C] hover:underline font-semibold flex items-center gap-1 p-1"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Rename</span>
                            </button>
                            <span className="text-[#D9D3C3]">·</span>
                            <button
                              type="button"
                              onClick={() => setShareModalTree(tree)}
                              className="text-[#1C4B3C] hover:underline font-semibold flex items-center gap-1 p-1"
                            >
                              <Share2 className="w-3 h-3" />
                              <span>Share</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="pt-3 border-t border-[#E7E2D6] flex items-center justify-between gap-2">
                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteModalTree(tree);
                              setDeleteError("");
                            }}
                            className="text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#9CA3AF]">Primary family tree</span>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenTree(tree.id, "/people")}
                            className="text-xs font-medium text-[#374151] hover:text-[#1C1F1D] bg-[#F7F5F0] hover:bg-[#EAE6DD] px-3 py-1.5 rounded-lg transition-colors"
                          >
                            View People
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenTree(tree.id, "/tree")}
                            className="text-xs font-semibold text-white bg-[#1C4B3C] hover:bg-[#163C30] px-3.5 py-1.5 rounded-lg shadow-2xs flex items-center gap-1 transition-colors"
                          >
                            <span>Open Tree</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Create Tree Modal (Forces Adding First Person) ── */}
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
                  placeholder="e.g. Miller Family Tree, Maternal Ancestry"
                  maxLength={100}
                  autoFocus
                  required
                  className="w-full text-sm rounded-xl border border-[#D9D3C3] px-3.5 py-2.5 bg-white text-[#1C1F1D] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 focus:border-[#1C4B3C]"
                />
              </div>

              {/* Mandatory First Person Section */}
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

      {/* ── Rename Tree Modal ── */}
      {renameModalTree && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setRenameModalTree(null)}
        >
          <div
            className="bg-white border border-[#E7E2D6] rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-serif font-bold text-[#1C1F1D] mb-1">
              Rename Family Tree
            </h3>
            <p className="text-xs text-[#6B7280] mb-4">
              Update the display name of this family tree.
            </p>

            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                  Tree Name
                </label>
                <input
                  type="text"
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  maxLength={100}
                  autoFocus
                  className="w-full text-sm rounded-xl border border-[#D9D3C3] px-3.5 py-2.5 bg-white text-[#1C1F1D] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 focus:border-[#1C4B3C]"
                />
              </div>

              {renameError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{renameError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenameModalTree(null)}
                  className="px-4 py-2 text-xs font-medium text-[#6B7280] hover:text-[#1C1F1D] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renameSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1C4B3C] hover:bg-[#163C30] rounded-xl shadow-2xs disabled:opacity-60 flex items-center gap-1.5"
                >
                  {renameSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{renameSubmitting ? "Saving…" : "Save Name"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Tree Modal ── */}
      {deleteModalTree && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setDeleteModalTree(null)}
        >
          <div
            className="bg-white border border-red-200 rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-3">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-base font-serif font-bold text-[#1C1F1D] mb-1">
              Delete "{deleteModalTree.name}"?
            </h3>
            <p className="text-xs text-[#6B7280] mb-4 leading-relaxed">
              Are you sure you want to delete this family tree? All relatives and relations recorded
              in this specific tree will be permanently removed.
            </p>

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E7E2D6]">
              <button
                type="button"
                onClick={() => setDeleteModalTree(null)}
                className="px-4 py-2 text-xs font-medium text-[#6B7280] hover:text-[#1C1F1D] rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={deleteSubmitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-2xs disabled:opacity-60 flex items-center gap-1.5"
              >
                {deleteSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{deleteSubmitting ? "Deleting…" : "Delete Tree"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Leave Shared Tree Modal ── */}
      {leaveModalTree && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setLeaveModalTree(null)}
        >
          <div
            className="bg-white border border-[#E7E2D6] rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
              <LogOut className="w-5 h-5" />
            </div>
            <h3 className="text-base font-serif font-bold text-[#1C1F1D] mb-1">
              Leave "{leaveModalTree.name}"?
            </h3>
            <p className="text-xs text-[#6B7280] mb-4 leading-relaxed">
              You will lose access to view or edit this tree until the tree owner invites you again.
            </p>

            {leaveError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{leaveError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E7E2D6]">
              <button
                type="button"
                onClick={() => setLeaveModalTree(null)}
                className="px-4 py-2 text-xs font-medium text-[#6B7280] hover:text-[#1C1F1D] rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLeaveSubmit}
                disabled={leaveSubmitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-2xs disabled:opacity-60 flex items-center gap-1.5"
              >
                {leaveSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{leaveSubmitting ? "Leaving…" : "Leave Tree"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Share Modal for a specific tree ── */}
      {shareModalTree && (
        <ShareModal
          treeId={shareModalTree.id}
          treeName={shareModalTree.name}
          onClose={() => setShareModalTree(null)}
        />
      )}
    </div>
  );
}
