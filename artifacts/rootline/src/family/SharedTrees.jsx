import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
  FolderTree,
  Copy,
  ShieldCheck,
  Ban,
  RotateCcw,
  MessageSquare,
  Send,
  Info,
  ChevronDown,
  UserMinus,
  CheckCircle,
} from "lucide-react";
import AppHeader from "./AppHeader.jsx";
import { useAuth } from "../AuthContext.jsx";
import { useFamily } from "./FamilyContext.jsx";
import { api } from "../api.js";

const PERMISSION_LABELS = {
  viewer: "Viewer",
  editor: "Editor",
};

function StatusBadge({ status, isExpired }) {
  if (isExpired || status === "expired") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="w-3 h-3 text-amber-600" />
        <span>Expired</span>
      </span>
    );
  }
  if (status === "accepted") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
        <span>Active / Joined</span>
      </span>
    );
  }
  if (status === "left") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-0.5 bg-stone-100 text-stone-700 border border-stone-300">
        <LogOut className="w-3 h-3 text-stone-500" />
        <span>Left Tree</span>
      </span>
    );
  }
  if (status === "declined") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-0.5 bg-gray-100 text-gray-700 border border-gray-200">
        <Ban className="w-3 h-3 text-gray-500" />
        <span>Declined</span>
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200">
        <Ban className="w-3 h-3 text-rose-500" />
        <span>Cancelled</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-0.5 bg-sky-50 text-sky-800 border border-sky-200">
      <Clock className="w-3 h-3 text-sky-600" />
      <span>Pending Response</span>
    </span>
  );
}

export default function SharedTrees() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const inviteFormRef = useRef(null);

  const {
    activeTreeId,
    setActiveTreeId,
    activeTree,
    treeList = { owned_trees: [], shared_trees: [] },
    refreshTreeList,
    createTree,
    renameTree,
    deleteTree,
    leaveSharedTree,
  } = useFamily();

  // Active tab: 'shared' | 'collaborators' | 'owned'
  const initialTab = searchParams.get("tab") || "shared";
  const [activeTab, setActiveTabState] = useState(
    ["shared", "collaborators", "owned"].includes(initialTab) ? initialTab : "shared"
  );

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  };

  const ownedTrees = useMemo(() => {
    return (treeList?.owned_trees || []).filter((t) => {
      if (!t || !t.id) return false;
      if (t.role === "viewer" || t.role === "editor" || t.isOwned === false) return false;
      if (t.owner_id && user?.id && t.owner_id !== user.id) return false;
      return true;
    });
  }, [treeList?.owned_trees, user?.id]);

  const sharedTrees = useMemo(() => {
    const fromShared = treeList?.shared_trees || [];
    const misplaced = (treeList?.owned_trees || []).filter(
      (t) => t && (t.role === "viewer" || t.role === "editor" || t.isOwned === false || (t.owner_id && user?.id && t.owner_id !== user.id))
    );
    const combined = [...fromShared, ...misplaced];
    const seen = new Set();
    return combined.filter((t) => {
      if (!t || !t.id || seen.has(t.id)) return false;
      seen.add(t.id);
      return !user?.id || t.owner_id !== user.id;
    });
  }, [treeList, user?.id]);

  // Selected tree for the "Collaborators & Tracking" tab
  const [selectedTreeId, setSelectedTreeId] = useState(
    searchParams.get("treeId") || activeTreeId || ownedTrees[0]?.id || ""
  );

  // Sync selected tree if search param or ownedTrees change
  useEffect(() => {
    const urlTreeId = searchParams.get("treeId");
    if (urlTreeId && ownedTrees.some((t) => t.id === urlTreeId)) {
      setSelectedTreeId(urlTreeId);
    } else if (!selectedTreeId && ownedTrees.length > 0) {
      setSelectedTreeId(activeTreeId || ownedTrees[0].id);
    }
  }, [searchParams, ownedTrees, activeTreeId, selectedTreeId]);

  const currentSelectedTree = useMemo(() => {
    return ownedTrees.find((t) => t.id === selectedTreeId) || ownedTrees[0] || null;
  }, [ownedTrees, selectedTreeId]);

  // Pending incoming invitations for the logged-in user
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

  // Collaborators & Outgoing invitations for the selected tree
  const [sharesData, setSharesData] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [loadingTreeCollab, setLoadingTreeCollab] = useState(false);
  const [collabError, setCollabError] = useState("");

  const loadTreeCollaborators = useCallback(async (treeId) => {
    if (!treeId) return;
    setLoadingTreeCollab(true);
    setCollabError("");
    try {
      const [sharesRes, invRes] = await Promise.all([
        api.listShares(treeId),
        api.listInvitations(treeId).catch(() => ({ invitations: [] })),
      ]);
      setSharesData(sharesRes);
      setInvitations(invRes.invitations || []);
    } catch (err) {
      setCollabError(err.message || "Failed to load collaborators.");
    } finally {
      setLoadingTreeCollab(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTreeId) {
      loadTreeCollaborators(selectedTreeId);
    }
  }, [selectedTreeId, loadTreeCollaborators]);

  // Add collaborator form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermission, setInvitePermission] = useState("viewer");
  const [inviteMessage, setInviteMessage] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState("");
  const [inviteFormError, setInviteFormError] = useState("");
  const [latestCreatedUrl, setLatestCreatedUrl] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedItemId, setCopiedItemId] = useState(null);

  // Tracking log filter
  const [trackingFilter, setTrackingFilter] = useState("all"); // 'all' | 'pending' | 'accepted' | 'left' | 'other'

  // Invitation item action states
  const [itemActionId, setItemActionId] = useState(null);
  const [itemActionFeedback, setItemActionFeedback] = useState("");
  const [itemActionError, setItemActionError] = useState("");

  // Role modification row state
  const [roleUpdatingId, setRoleUpdatingId] = useState(null);

  // Revoke collaborator modal
  const [revokeModalShare, setRevokeModalShare] = useState(null);
  const [revokeSubmitting, setRevokeSubmitting] = useState(false);

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

  // Leave shared tree modal state
  const [leaveModalTree, setLeaveModalTree] = useState(null);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveError, setLeaveError] = useState("");

  // Handlers for Incoming Invitations
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
      setTimeout(() => setInviteSuccessMsg(""), 6000);
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
      setTimeout(() => setInviteSuccessMsg(""), 6000);
    } catch (err) {
      setInviteErrorMsg(err.message || "Failed to decline invitation.");
    } finally {
      setInviteActionId(null);
    }
  };

  // Handlers for Outgoing Invitations
  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!currentSelectedTree) return;
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setInviteFormError("Please enter an email address.");
      return;
    }

    setSendingInvite(true);
    setInviteFormError("");
    setInviteFeedback("");
    setLatestCreatedUrl("");

    try {
      const res = await api.sendInvitation(currentSelectedTree.id, {
        email: cleanEmail,
        permission: invitePermission,
        message: inviteMessage.trim() || undefined,
      });

      setInviteFeedback(
        res.emailDelivered
          ? `Invitation email delivered to ${cleanEmail} as ${PERMISSION_LABELS[invitePermission]}!`
          : `Invitation generated for ${cleanEmail} as ${PERMISSION_LABELS[invitePermission]}. You can share the link below.`
      );

      if (res.inviteUrl) {
        setLatestCreatedUrl(res.inviteUrl);
      }

      setInviteEmail("");
      setInviteMessage("");
      await loadTreeCollaborators(currentSelectedTree.id);
      await refreshTreeList();
    } catch (err) {
      setInviteFormError(err.message || "Failed to send invitation.");
    } finally {
      setSendingInvite(false);
    }
  };

  const handleCopyLink = (urlOrToken, id) => {
    const fullUrl = urlOrToken.startsWith("http")
      ? urlOrToken
      : `${window.location.origin}/invite/accept?token=${encodeURIComponent(urlOrToken)}`;

    navigator.clipboard.writeText(fullUrl);
    if (id) {
      setCopiedItemId(id);
      setTimeout(() => setCopiedItemId(null), 2500);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleCancelInvite = async (invitationId) => {
    if (!currentSelectedTree) return;
    setItemActionId(invitationId);
    setItemActionFeedback("");
    setItemActionError("");
    try {
      await api.cancelInvitation(currentSelectedTree.id, invitationId);
      setItemActionFeedback("Invitation cancelled successfully.");
      await loadTreeCollaborators(currentSelectedTree.id);
      setTimeout(() => setItemActionFeedback(""), 4000);
    } catch (err) {
      setItemActionError(err.message || "Failed to cancel invitation.");
    } finally {
      setItemActionId(null);
    }
  };

  const handleDeleteInvite = async (invitationId) => {
    if (!currentSelectedTree) return;
    setItemActionId(invitationId);
    setItemActionFeedback("");
    setItemActionError("");
    try {
      await api.deleteInvitation(currentSelectedTree.id, invitationId);
      setItemActionFeedback("Invitation record removed from log.");
      await loadTreeCollaborators(currentSelectedTree.id);
      setTimeout(() => setItemActionFeedback(""), 4000);
    } catch (err) {
      setItemActionError(err.message || "Failed to remove invitation record.");
    } finally {
      setItemActionId(null);
    }
  };

  const handleReinvite = (inv) => {
    setInviteEmail(inv.invitee_email || "");
    setInvitePermission(inv.permission === "editor" ? "editor" : "viewer");
    setInviteMessage(inv.message || "");
    setActiveTab("collaborators");
    if (inviteFormRef.current) {
      inviteFormRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleChangeCollaboratorRole = async (share, newRole) => {
    if (!currentSelectedTree) return;
    setRoleUpdatingId(share.id);
    try {
      await api.updateShare(currentSelectedTree.id, share.id, newRole);
      await loadTreeCollaborators(currentSelectedTree.id);
    } catch (err) {
      setItemActionError(err.message || "Failed to update role.");
      setTimeout(() => setItemActionError(""), 4000);
    } finally {
      setRoleUpdatingId(null);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!currentSelectedTree || !revokeModalShare) return;
    setRevokeSubmitting(true);
    const targetKey = revokeModalShare.id || revokeModalShare.user_id || revokeModalShare.user_email;
    try {
      await api.removeShare(currentSelectedTree.id, targetKey);
      setRevokeModalShare(null);
      setItemActionFeedback(`Access revoked for ${revokeModalShare.user_name || revokeModalShare.user_email}.`);
      await loadTreeCollaborators(currentSelectedTree.id);
      setTimeout(() => setItemActionFeedback(""), 4000);
    } catch (err) {
      setItemActionError(err.message || "Failed to revoke access.");
    } finally {
      setRevokeSubmitting(false);
    }
  };

  const handleOpenTree = (treeId, destination = "/tree") => {
    setActiveTreeId(treeId);
    navigate(destination);
  };

  const handleCreateTreeSubmit = async (e) => {
    e.preventDefault();
    const trimmed = newTreeName.trim();
    if (!trimmed) {
      setCreateError("Please provide a name for your family tree.");
      return;
    }

    const allUserTrees = [...ownedTrees, ...sharedTrees];
    const duplicate = allUserTrees.some(
      (t) => t.isOwned && t.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      setCreateError(`You already have a family tree named "${trimmed}". Please choose a different name.`);
      return;
    }

    setCreateSubmitting(true);
    setCreateError("");
    try {
      const initialPersonPayload = firstPersonName.trim()
        ? {
            name: firstPersonName.trim(),
            gender: firstPersonGender,
            dob: firstPersonDob,
          }
        : undefined;

      const created = await createTree(trimmed, initialPersonPayload);
      setCreateModalOpen(false);
      setNewTreeName("");
      setFirstPersonName("");
      setFirstPersonGender("unspecified");
      setFirstPersonDob("");

      if (created?.id) {
        setSelectedTreeId(created.id);
      }

      if (initialPersonPayload) {
        setActiveTab("owned");
        navigate("/tree");
      } else {
        setActiveTab("owned");
      }
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
      await refreshTreeList();
    } catch (err) {
      setLeaveError(err.message || "Failed to leave shared tree.");
    } finally {
      setLeaveSubmitting(false);
    }
  };

  // Filtered invitations for the tracking log
  const filteredInvitations = useMemo(() => {
    if (trackingFilter === "all") return invitations;
    if (trackingFilter === "pending") {
      return invitations.filter((i) => i.status === "pending" && !(new Date(i.expires_at) < new Date()));
    }
    if (trackingFilter === "accepted") {
      return invitations.filter((i) => i.status === "accepted");
    }
    if (trackingFilter === "left") {
      return invitations.filter((i) => i.status === "left");
    }
    if (trackingFilter === "other") {
      return invitations.filter(
        (i) =>
          i.status === "cancelled" ||
          i.status === "declined" ||
          i.status === "expired" ||
          (i.status === "pending" && new Date(i.expires_at) < new Date())
      );
    }
    return invitations;
  }, [invitations, trackingFilter]);

  const activeCollaboratorsList = useMemo(() => {
    return sharesData?.shares || [];
  }, [sharesData?.shares]);

  return (
    <div className="min-h-screen bg-[#F7F5F0] flex flex-col font-sans text-[#1C1F1D]">
      <AppHeader />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Top Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-8 border-b border-[#E7E2D6]">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1.5 rounded-lg bg-[#1C4B3C]/10 text-[#1C4B3C]">
                <Users className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold tracking-wider uppercase text-[#1C4B3C]">
                Collaboration & Sharing Hub
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1C1F1D]">
              Family Tree Collaboration & Tracking
            </h1>
            <p className="text-sm text-[#6B7280] mt-1 max-w-2xl">
              Track trees shared with you by relatives, manage collaborators on your family trees, and
              monitor real-time invitation statuses and member activity.
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
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1C4B3C] text-white text-xs font-semibold hover:bg-[#163C30] shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Tree</span>
            </button>

            {ownedTrees.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("collaborators");
                  if (currentSelectedTree) {
                    setSelectedTreeId(currentSelectedTree.id);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-[#E7E2D6] text-[#1C1F1D] text-xs font-semibold hover:bg-[#FAF8F4] shadow-2xs transition-colors cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-[#1C4B3C]" />
                <span>Manage Collaborators</span>
              </button>
            )}
          </div>
        </div>

        {/* ── High-Level Metric Stat Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-6">
          <div
            onClick={() => setActiveTab("shared")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              activeTab === "shared"
                ? "bg-white border-[#1C4B3C] ring-2 ring-[#1C4B3C]/10 shadow-xs"
                : "bg-white/70 border-[#E7E2D6] hover:bg-white"
            }`}
          >
            <div className="flex items-center justify-between text-[#6B7280] mb-1">
              <span className="text-xs font-medium">Shared With Me</span>
              <Users className="w-4 h-4 text-[#1C4B3C]" />
            </div>
            <p className="text-2xl font-serif font-bold text-[#1C1F1D]">{sharedTrees.length}</p>
            <p className="text-[11px] text-[#6B7280] mt-0.5">Trees you can access</p>
          </div>

          <div
            onClick={() => setActiveTab("collaborators")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              activeTab === "collaborators"
                ? "bg-white border-[#1C4B3C] ring-2 ring-[#1C4B3C]/10 shadow-xs"
                : "bg-white/70 border-[#E7E2D6] hover:bg-white"
            }`}
          >
            <div className="flex items-center justify-between text-[#6B7280] mb-1">
              <span className="text-xs font-medium">Active Collaborators</span>
              <ShieldCheck className="w-4 h-4 text-[#1C4B3C]" />
            </div>
            <p className="text-2xl font-serif font-bold text-[#1C1F1D]">{activeCollaboratorsList.length}</p>
            <p className="text-[11px] text-[#6B7280] mt-0.5">Joined your current tree</p>
          </div>

          <div
            onClick={() => {
              setActiveTab("collaborators");
              setTrackingFilter("pending");
            }}
            className="p-4 rounded-2xl border border-[#E7E2D6] bg-white/70 hover:bg-white transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between text-[#6B7280] mb-1">
              <span className="text-xs font-medium">Pending Invites</span>
              <Clock className="w-4 h-4 text-sky-600" />
            </div>
            <p className="text-2xl font-serif font-bold text-[#1C1F1D]">
              {invitations.filter((i) => i.status === "pending" && !(new Date(i.expires_at) < new Date())).length}
            </p>
            <p className="text-[11px] text-[#6B7280] mt-0.5">Awaiting acceptance</p>
          </div>

          <div
            onClick={() => setActiveTab("owned")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              activeTab === "owned"
                ? "bg-white border-[#1C4B3C] ring-2 ring-[#1C4B3C]/10 shadow-xs"
                : "bg-white/70 border-[#E7E2D6] hover:bg-white"
            }`}
          >
            <div className="flex items-center justify-between text-[#6B7280] mb-1">
              <span className="text-xs font-medium">My Trees</span>
              <TreeIcon className="w-4 h-4 text-[#1C4B3C]" />
            </div>
            <p className="text-2xl font-serif font-bold text-[#1C1F1D]">{ownedTrees.length}</p>
            <p className="text-[11px] text-[#6B7280] mt-0.5">Under your ownership</p>
          </div>
        </div>

        {/* ── Pending Incoming Invitations Banner (if any) ── */}
        {inviteSuccessMsg && (
          <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{inviteSuccessMsg}</span>
          </div>
        )}
        {inviteErrorMsg && (
          <div className="mt-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{inviteErrorMsg}</span>
          </div>
        )}

        {pendingInvites.length > 0 && (
          <div className="mt-6 p-5 rounded-2xl bg-amber-50/70 border border-amber-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-100 text-amber-900">
                  <Mail className="w-4 h-4" />
                </span>
                <h2 className="text-sm font-bold text-amber-950">
                  Pending Tree Invitations for You ({pendingInvites.length})
                </h2>
              </div>
              <span className="text-[11px] text-amber-800 font-medium">
                Action required to collaborate
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
                      <p className="text-xs italic text-[#4B5563] mt-2 bg-[#F7F5F0] p-2.5 rounded-lg border border-[#E7E2D6]">
                        "{inv.message}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[#E7E2D6]">
                    <button
                      type="button"
                      disabled={inviteActionId === inv.id}
                      onClick={() => handleAcceptInvite(inv)}
                      className="flex-1 py-1.5 px-3 bg-[#1C4B3C] hover:bg-[#163C30] disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    >
                      {inviteActionId === inv.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Accept Invitation</span>
                    </button>
                    <button
                      type="button"
                      disabled={inviteActionId === inv.id}
                      onClick={() => handleDeclineInvite(inv)}
                      className="py-1.5 px-3 border border-[#E7E2D6] hover:bg-rose-50 hover:text-rose-700 text-[#6B7280] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Navigation Tabs ── */}
        <div className="flex items-center gap-2 sm:gap-4 mt-8 mb-6 border-b border-[#E7E2D6] pb-px overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("shared")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "shared"
                ? "border-[#1C4B3C] text-[#1C4B3C]"
                : "border-transparent text-[#6B7280] hover:text-[#1C1F1D]"
            }`}
          >
            <span>Trees Shared With Me</span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
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
            onClick={() => setActiveTab("collaborators")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "collaborators"
                ? "border-[#1C4B3C] text-[#1C4B3C]"
                : "border-transparent text-[#6B7280] hover:text-[#1C1F1D]"
            }`}
          >
            <span>Track Collaborators & Invitations</span>
            {invitations.length > 0 && (
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                  activeTab === "collaborators"
                    ? "bg-[#1C4B3C] text-white"
                    : "bg-[#E7E2D6] text-[#4B5563]"
                }`}
              >
                {invitations.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("owned")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "owned"
                ? "border-[#1C4B3C] text-[#1C4B3C]"
                : "border-transparent text-[#6B7280] hover:text-[#1C1F1D]"
            }`}
          >
            <span>My Family Trees</span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === "owned"
                  ? "bg-[#1C4B3C] text-white"
                  : "bg-[#E7E2D6] text-[#4B5563]"
              }`}
            >
              {ownedTrees.length}
            </span>
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TAB 1: TREES SHARED WITH ME
        ══════════════════════════════════════════════════════════════════ */}
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
                  their tree, it will appear right here with full access. Your own personal trees remain
                  under your ownership.
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
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#1C4B3C] hover:bg-[#163C30] text-white text-xs font-semibold rounded-xl px-4 py-2.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create New Family Tree</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("owned")}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-[#FAF8F4] border border-[#E7E2D6] text-[#1C1F1D] text-xs font-semibold rounded-xl px-4 py-2.5 transition-colors cursor-pointer"
                  >
                    <FolderTree className="w-4 h-4 text-[#1C4B3C]" />
                    <span>View My Trees ({ownedTrees.length})</span>
                  </button>
                </div>

                <div className="bg-[#FAF8F4] border border-[#E7E2D6] rounded-xl p-4 text-left text-xs space-y-2.5 max-w-md mx-auto">
                  <p className="font-semibold text-[#1C1F1D] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#C9A468]" />
                    <span>How tree collaboration works:</span>
                  </p>
                  <ul className="list-disc list-inside text-[#6B7280] space-y-1">
                    <li>
                      Tree owners can invite you as an <strong className="text-[#1C1F1D]">Editor</strong>{" "}
                      (to add people, link marriages, and edit records) or <strong className="text-[#1C1F1D]">Viewer</strong>{" "}
                      (read-only).
                    </li>
                    <li>You can leave a shared tree at any time without affecting your own trees.</li>
                    <li>
                      Collaborators cannot delete the owner&apos;s tree or alter ownership permissions.
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
                              {tree.people_count ?? 0}{" "}
                              {(tree.people_count ?? 0) === 1 ? "family member" : "family members"}
                            </p>
                          </div>

                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1.5 shrink-0 ${
                              isEditor
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-sky-50 text-sky-800 border border-sky-200"
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
                        <div className="flex items-center gap-3 p-3.5 bg-[#FAF8F4] border border-[#E7E2D6] rounded-xl mb-4">
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
                              <span>{tree.owner_email}</span>
                            </p>
                          </div>
                        </div>

                        <p className="text-xs text-[#6B7280] leading-relaxed mb-4">
                          {isEditor
                            ? "You can add new family members, link spouses and children, and edit person records."
                            : "You have view-only permissions to inspect genealogical relations and branch layouts."}
                        </p>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="pt-3 border-t border-[#E7E2D6] flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setLeaveModalTree(tree);
                            setLeaveError("");
                          }}
                          className="text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Leave Tree</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenTree(tree.id, "/people")}
                            className="text-xs font-medium text-[#374151] hover:text-[#1C1F1D] bg-[#F7F5F0] hover:bg-[#EAE6DD] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            View People
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenTree(tree.id, "/tree")}
                            className="text-xs font-semibold text-white bg-[#1C4B3C] hover:bg-[#163C30] px-3.5 py-1.5 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
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

        {/* ══════════════════════════════════════════════════════════════════
            TAB 2: TRACK COLLABORATORS & INVITATIONS (DEDICATED FULL PAGE)
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "collaborators" && (
          <div className="space-y-8">
            {ownedTrees.length === 0 ? (
              <div className="bg-white border border-[#E7E2D6] rounded-2xl p-8 text-center max-w-lg mx-auto shadow-sm">
                <TreeIcon className="w-10 h-10 text-[#1C4B3C] mx-auto mb-3" />
                <h3 className="text-base font-serif font-bold text-[#1C1F1D] mb-1">
                  Create a tree to manage collaborators
                </h3>
                <p className="text-xs text-[#6B7280] mb-4">
                  You need an owned tree to invite relatives and track permissions.
                </p>
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
                  className="px-4 py-2 bg-[#1C4B3C] hover:bg-[#163C30] text-white text-xs font-semibold rounded-xl shadow-2xs cursor-pointer"
                >
                  Create Family Tree
                </button>
              </div>
            ) : (
              <>
                {/* ── Tree Switcher Bar ── */}
                <div className="bg-white border border-[#E7E2D6] rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#1C4B3C]/10 text-[#1C4B3C] flex items-center justify-center shrink-0">
                      <TreeIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wider font-semibold text-[#6B7280]">
                          Managing Tree:
                        </span>
                        <span className="text-xs font-bold bg-[#1C4B3C]/10 text-[#1C4B3C] px-2 py-0.5 rounded-full">
                          Owner
                        </span>
                      </div>
                      <h2 className="text-lg font-serif font-bold text-[#1C1F1D]">
                        {currentSelectedTree?.name || "Your Tree"}
                      </h2>
                    </div>
                  </div>

                  {ownedTrees.length > 1 && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-[#6B7280]">Switch Tree:</label>
                      <select
                        value={selectedTreeId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedTreeId(val);
                          setSearchParams((prev) => {
                            const next = new URLSearchParams(prev);
                            next.set("treeId", val);
                            return next;
                          });
                        }}
                        className="text-xs font-semibold text-[#1C1F1D] bg-[#FAF8F4] border border-[#E7E2D6] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/20"
                      >
                        {ownedTrees.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.people_count || 0} members)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Feedback banners */}
                {itemActionFeedback && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{itemActionFeedback}</span>
                  </div>
                )}
                {itemActionError && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{itemActionError}</span>
                  </div>
                )}

                {/* ── Section A: Invite Collaborator by Email ── */}
                <div
                  ref={inviteFormRef}
                  className="bg-white border border-[#E7E2D6] rounded-2xl p-5 sm:p-7 shadow-2xs space-y-5"
                >
                  <div className="border-b border-[#E7E2D6] pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="p-1.5 rounded-lg bg-[#1C4B3C]/10 text-[#1C4B3C]">
                        <Share2 className="w-4 h-4" />
                      </span>
                      <h3 className="text-base font-serif font-bold text-[#1C1F1D]">
                        Invite Collaborators to &quot;{currentSelectedTree?.name}&quot;
                      </h3>
                    </div>
                    <p className="text-xs text-[#6B7280]">
                      Invite relatives by email. They will receive an invitation link and instructions to join as an Editor or Viewer.
                    </p>
                  </div>

                  <form onSubmit={handleSendInvite} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Email input */}
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                          Relative&apos;s Email Address <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="e.g. cousin.sarah@gmail.com"
                            required
                            className="w-full text-xs sm:text-sm rounded-xl border border-[#D9D3C3] pl-10 pr-3.5 py-2.5 bg-[#FAF8F4] text-[#1C1F1D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 focus:border-[#1C4B3C]"
                          />
                        </div>
                      </div>

                      {/* Permission selection */}
                      <div>
                        <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                          Access Permission
                        </label>
                        <select
                          value={invitePermission}
                          onChange={(e) => setInvitePermission(e.target.value)}
                          className="w-full text-xs sm:text-sm rounded-xl border border-[#D9D3C3] px-3.5 py-2.5 bg-[#FAF8F4] text-[#1C1F1D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 focus:border-[#1C4B3C]"
                        >
                          <option value="viewer">Viewer (Read-only)</option>
                          <option value="editor">Editor (Can add & edit people)</option>
                        </select>
                      </div>
                    </div>

                    {/* Optional message */}
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                        Personal Note / Message <span className="text-[#9CA3AF] font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={inviteMessage}
                        onChange={(e) => setInviteMessage(e.target.value)}
                        placeholder="e.g. Hey Uncle Jim! Check out the new ancestral branch I mapped."
                        maxLength={250}
                        className="w-full text-xs sm:text-sm rounded-xl border border-[#D9D3C3] px-3.5 py-2 bg-[#FAF8F4] text-[#1C1F1D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 focus:border-[#1C4B3C]"
                      />
                    </div>

                    {inviteFormError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{inviteFormError}</span>
                      </div>
                    )}

                    {inviteFeedback && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span>{inviteFeedback}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3 pt-2">
                      <p className="text-[11px] text-[#6B7280]">
                        The recipient will receive an invitation link valid for 7 days.
                      </p>
                      <button
                        type="submit"
                        disabled={sendingInvite || !inviteEmail.trim()}
                        className="px-5 py-2.5 rounded-xl bg-[#1C4B3C] hover:bg-[#163C30] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
                      >
                        {sendingInvite ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        <span>{sendingInvite ? "Sending Invitation…" : "Send Invitation"}</span>
                      </button>
                    </div>
                  </form>

                  {/* 1-Click Copy Link Box when invite is generated */}
                  {latestCreatedUrl && (
                    <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#1C4B3C]/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1C4B3C] flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-[#1C4B3C]" />
                          <span>Direct Invitation Link Generated</span>
                        </span>
                        <span className="text-[11px] text-[#6B7280]">
                          Share via WhatsApp, SMS, or chat
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={latestCreatedUrl}
                          className="flex-1 text-xs font-mono bg-white border border-[#D9D3C3] px-3 py-2 rounded-lg text-[#374151] select-all"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopyLink(latestCreatedUrl)}
                          className="px-3.5 py-2 bg-[#1C4B3C] hover:bg-[#163C30] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          {copiedLink ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Section B: Active Collaborators (Joined) ── */}
                <div className="bg-white border border-[#E7E2D6] rounded-2xl p-5 sm:p-7 shadow-2xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E7E2D6] pb-4">
                    <div>
                      <h3 className="text-base font-serif font-bold text-[#1C1F1D]">
                        Active Collaborators with Access
                      </h3>
                      <p className="text-xs text-[#6B7280] mt-0.5">
                        People who have accepted an invitation and can currently view or edit this tree.
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-[#1C4B3C] bg-[#1C4B3C]/10 px-3 py-1 rounded-full self-start sm:self-auto">
                      {activeCollaboratorsList.length + 1} Total Access Users
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#E7E2D6] text-[#6B7280] uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-3">User</th>
                          <th className="py-2.5 px-3">Email</th>
                          <th className="py-2.5 px-3">Role & Permissions</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E7E2D6]">
                        {/* 1. Tree Owner Row */}
                        <tr className="bg-[#FAF8F4]/70">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-[#1C4B3C] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                                {(sharesData?.owner?.name?.[0] || user?.name?.[0] || "O").toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-[#1C1F1D]">
                                  {sharesData?.owner?.name || user?.name || "You (Owner)"}
                                </p>
                                <p className="text-[10px] text-[#6B7280]">Tree Creator & Primary Owner</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-[#4B5563]">
                            {sharesData?.owner?.email || user?.email}
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold text-[11px] bg-[#1C4B3C]/10 text-[#1C4B3C] border border-[#1C4B3C]/20">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Owner</span>
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right text-[11px] text-[#9CA3AF]">
                            Full Permissions
                          </td>
                        </tr>

                        {/* 2. Collaborators Rows */}
                        {activeCollaboratorsList.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-[#6B7280]">
                              <p className="text-xs">
                                No other relatives have joined this tree yet.
                              </p>
                              <p className="text-[11px] text-[#9CA3AF] mt-1">
                                Send an invitation above or check pending tracking below.
                              </p>
                            </td>
                          </tr>
                        ) : (
                          activeCollaboratorsList.map((collab) => {
                            const initial = (
                              collab.user_name?.[0] ||
                              collab.user_email?.[0] ||
                              "C"
                            ).toUpperCase();
                            const isUpdating = roleUpdatingId === collab.id;

                            return (
                              <tr key={collab.id} className="hover:bg-[#FAF8F4]/40 transition-colors">
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full bg-stone-200 text-stone-800 flex items-center justify-center font-bold text-xs">
                                      {initial}
                                    </div>
                                    <div>
                                      <p className="font-semibold text-[#1C1F1D]">
                                        {collab.user_name || collab.name || "Collaborator"}
                                      </p>
                                      <p className="text-[10px] text-[#9CA3AF]">
                                        Joined: {collab.created_at ? new Date(collab.created_at).toLocaleDateString() : "Active"}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-[#4B5563]">
                                  {collab.user_email || collab.email}
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-2">
                                    <select
                                      value={collab.permission || "viewer"}
                                      disabled={isUpdating}
                                      onChange={(e) =>
                                        handleChangeCollaboratorRole(collab, e.target.value)
                                      }
                                      className="text-xs font-semibold rounded-lg border border-[#D9D3C3] bg-white px-2.5 py-1 text-[#1C1F1D] focus:outline-none focus:ring-1 focus:ring-[#1C4B3C]"
                                    >
                                      <option value="viewer">Viewer (Read-only)</option>
                                      <option value="editor">Editor (Can edit)</option>
                                    </select>
                                    {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1C4B3C]" />}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setRevokeModalShare(collab)}
                                    className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer"
                                  >
                                    Revoke Access
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── Section C: Invitations & Activity Tracking Log ("Who invited Whom") ── */}
                <div className="bg-white border border-[#E7E2D6] rounded-2xl p-5 sm:p-7 shadow-2xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E7E2D6] pb-4">
                    <div>
                      <h3 className="text-base font-serif font-bold text-[#1C1F1D]">
                        Invitation & Status Tracking Log
                      </h3>
                      <p className="text-xs text-[#6B7280] mt-0.5">
                        Track who invited whom, who accepted, who is pending, and who left this tree.
                      </p>
                    </div>

                    {/* Filter buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setTrackingFilter("all")}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          trackingFilter === "all"
                            ? "bg-[#1C4B3C] text-white"
                            : "bg-[#FAF8F4] text-[#6B7280] hover:text-[#1C1F1D] border border-[#E7E2D6]"
                        }`}
                      >
                        All ({invitations.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrackingFilter("pending")}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          trackingFilter === "pending"
                            ? "bg-[#1C4B3C] text-white"
                            : "bg-[#FAF8F4] text-[#6B7280] hover:text-[#1C1F1D] border border-[#E7E2D6]"
                        }`}
                      >
                        Pending ({invitations.filter((i) => i.status === "pending" && !(new Date(i.expires_at) < new Date())).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrackingFilter("accepted")}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          trackingFilter === "accepted"
                            ? "bg-[#1C4B3C] text-white"
                            : "bg-[#FAF8F4] text-[#6B7280] hover:text-[#1C1F1D] border border-[#E7E2D6]"
                        }`}
                      >
                        Joined ({invitations.filter((i) => i.status === "accepted").length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrackingFilter("left")}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          trackingFilter === "left"
                            ? "bg-[#1C4B3C] text-white"
                            : "bg-[#FAF8F4] text-[#6B7280] hover:text-[#1C1F1D] border border-[#E7E2D6]"
                        }`}
                      >
                        Left Tree ({invitations.filter((i) => i.status === "left").length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrackingFilter("other")}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          trackingFilter === "other"
                            ? "bg-[#1C4B3C] text-white"
                            : "bg-[#FAF8F4] text-[#6B7280] hover:text-[#1C1F1D] border border-[#E7E2D6]"
                        }`}
                      >
                        Cancelled / Expired ({invitations.filter((i) => ["cancelled", "declined", "expired"].includes(i.status) || (i.status === "pending" && new Date(i.expires_at) < new Date())).length})
                      </button>
                    </div>
                  </div>

                  {/* List of tracking cards */}
                  {filteredInvitations.length === 0 ? (
                    <div className="py-10 text-center text-[#6B7280]">
                      <p className="text-xs">No invitations match the selected filter.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredInvitations.map((inv) => {
                        const isExpired = new Date(inv.expires_at) < new Date();
                        const isPending = inv.status === "pending" && !isExpired;
                        const hasLeft = inv.status === "left";
                        const isActionActive = itemActionId === inv.id;

                        return (
                          <div
                            key={inv.id}
                            className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              hasLeft
                                ? "bg-stone-50/70 border-stone-200"
                                : isPending
                                ? "bg-sky-50/40 border-sky-200/80"
                                : inv.status === "accepted"
                                ? "bg-emerald-50/30 border-emerald-200/70"
                                : "bg-white border-[#E7E2D6]"
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="text-xs sm:text-sm font-bold text-[#1C1F1D]">
                                  {inv.invitee_email}
                                </span>
                                <StatusBadge status={inv.status} isExpired={isExpired} />
                                <span className="text-[11px] text-[#6B7280] font-medium capitalize">
                                  Role: {inv.permission}
                                </span>
                              </div>

                              <p className="text-xs text-[#6B7280]">
                                Sent by: <strong className="text-[#374151]">{inv.inviter_name}</strong> ({inv.inviter_email}) · {new Date(inv.created_at).toLocaleDateString()}
                              </p>

                              {hasLeft && (
                                <p className="text-[11px] text-stone-600 bg-stone-100/90 px-2.5 py-1 rounded inline-block">
                                  Collaborator chose to leave this tree. They no longer have access. You can re-invite them anytime.
                                </p>
                              )}

                              {inv.message && (
                                <p className="text-xs italic text-[#4B5563] mt-1 bg-white/80 p-2 rounded border border-[#E7E2D6]">
                                  &quot;{inv.message}&quot;
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                              {/* Copy Link button (for pending) */}
                              {isPending && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(inv.token, inv.id)}
                                  className="px-2.5 py-1.5 border border-[#E7E2D6] bg-white hover:bg-[#FAF8F4] text-[#374151] rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                                  title="Copy invitation URL"
                                >
                                  {copiedItemId === inv.id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      <span>Copy Link</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {/* Cancel pending */}
                              {isPending && (
                                <button
                                  type="button"
                                  disabled={isActionActive}
                                  onClick={() => handleCancelInvite(inv.id)}
                                  className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200/80 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                                >
                                  {isActionActive && <Loader2 className="w-3 h-3 animate-spin" />}
                                  <span>Cancel</span>
                                </button>
                              )}

                              {/* Re-invite option for left, cancelled, expired, declined */}
                              {(hasLeft || inv.status === "cancelled" || inv.status === "declined" || isExpired) && (
                                <button
                                  type="button"
                                  onClick={() => handleReinvite(inv)}
                                  className="px-2.5 py-1.5 bg-[#1C4B3C] hover:bg-[#163C30] text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                                  title="Send a fresh invitation to this email"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Re-invite</span>
                                </button>
                              )}

                              {/* Remove record from tracking */}
                              {(hasLeft || inv.status === "cancelled" || inv.status === "declined" || isExpired) && (
                                <button
                                  type="button"
                                  disabled={isActionActive}
                                  onClick={() => handleDeleteInvite(inv.id)}
                                  className="px-2 py-1.5 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                                  title="Remove this entry from the tracking log"
                                >
                                  {isActionActive ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                  <span>Remove</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 3: MY FAMILY TREES
        ══════════════════════════════════════════════════════════════════ */}
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
                    ? `You are currently collaborating on ${sharedTrees.length} shared tree${sharedTrees.length === 1 ? "" : "s"}. You can also create your own independent family tree anytime.`
                    : "Create your own family tree to start mapping your ancestors, parents, and relatives."}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setNewTreeName("");
                    setCreateError("");
                    setCreateModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1C4B3C] hover:bg-[#163C30] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Your Family Tree</span>
                </button>
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
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setRenameModalTree(tree);
                                setRenameName(tree.name);
                                setRenameError("");
                              }}
                              className="text-[#1C4B3C] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Rename</span>
                            </button>
                            <span className="text-[#D9D3C3]">·</span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTreeId(tree.id);
                                setActiveTab("collaborators");
                              }}
                              className="text-[#1C4B3C] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Share2 className="w-3 h-3" />
                              <span>Collaborators</span>
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
                            className="text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
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
                            className="text-xs font-medium text-[#374151] hover:text-[#1C1F1D] bg-[#F7F5F0] hover:bg-[#EAE6DD] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            View People
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenTree(tree.id, "/tree")}
                            className="text-xs font-semibold text-white bg-[#1C4B3C] hover:bg-[#163C30] px-3.5 py-1.5 rounded-lg shadow-2xs flex items-center gap-1 transition-colors cursor-pointer"
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

      {/* ── Revoke Collaborator Modal ── */}
      {revokeModalShare && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setRevokeModalShare(null)}
        >
          <div
            className="bg-white border border-[#E7E2D6] rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
              <UserMinus className="w-5 h-5" />
            </div>
            <h3 className="text-base font-serif font-bold text-[#1C1F1D] mb-1">
              Revoke Access for {revokeModalShare.user_name || revokeModalShare.user_email}?
            </h3>
            <p className="text-xs text-[#6B7280] mb-4 leading-relaxed">
              This user will immediately lose access to view or edit this tree. They can be invited back later if needed.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E7E2D6]">
              <button
                type="button"
                onClick={() => setRevokeModalShare(null)}
                className="px-4 py-2 text-xs font-medium text-[#6B7280] hover:text-[#1C1F1D] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                disabled={revokeSubmitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-2xs disabled:opacity-60 flex items-center gap-1.5 cursor-pointer"
              >
                {revokeSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{revokeSubmitting ? "Revoking…" : "Revoke Access"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Tree Modal ── */}
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
                className="p-1 rounded-lg text-[#6B7280] hover:bg-[#F0EDE3] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTreeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                  Family Tree Name <span className="text-rose-500">*</span>
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

              {/* Starting Person Section */}
              <div className="rounded-xl border border-[#DCE3E1] bg-[#F7F9F7] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <User className="w-4 h-4 text-[#1C4B3C]" />
                    <span className="text-xs font-bold text-[#1C4B3C]">
                      First Person (Tree Starter)
                    </span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider border border-amber-200">
                      Optional
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
                      className="text-[11px] font-semibold text-[#1C4B3C] hover:underline cursor-pointer"
                    >
                      Use my profile info
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-[#6B7280]">
                  Add yourself or an ancestor as the root individual for this branch.
                </p>

                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">
                    Full Name <span className="text-[#9CA3AF] font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={firstPersonName}
                    onChange={(e) => setFirstPersonName(e.target.value)}
                    placeholder="e.g. Julian Vance"
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
                      Birth Date
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
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E7E2D6]">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-[#6B7280] hover:text-[#1C1F1D] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting || !newTreeName.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1C4B3C] hover:bg-[#163C30] rounded-xl shadow-2xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {createSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{createSubmitting ? "Creating Tree…" : "Create Tree"}</span>
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
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{renameError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenameModalTree(null)}
                  className="px-4 py-2 text-xs font-medium text-[#6B7280] hover:text-[#1C1F1D] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renameSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1C4B3C] hover:bg-[#163C30] rounded-xl shadow-2xs disabled:opacity-60 flex items-center gap-1.5 cursor-pointer"
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
            className="bg-white border border-rose-200 rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-base font-serif font-bold text-[#1C1F1D] mb-1">
              Delete &quot;{deleteModalTree.name}&quot;?
            </h3>
            <p className="text-xs text-[#6B7280] mb-4 leading-relaxed">
              Are you sure you want to delete this family tree? All relatives and relations recorded
              in this specific tree will be permanently removed.
            </p>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E7E2D6]">
              <button
                type="button"
                onClick={() => setDeleteModalTree(null)}
                className="px-4 py-2 text-xs font-medium text-[#6B7280] hover:text-[#1C1F1D] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={deleteSubmitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-2xs disabled:opacity-60 flex items-center gap-1.5 cursor-pointer"
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
              Leave &quot;{leaveModalTree.name}&quot;?
            </h3>
            <p className="text-xs text-[#6B7280] mb-4 leading-relaxed">
              You will lose access to view or edit this family tree. The tree owner ({leaveModalTree.owner_name})
              will see that you have left, and your personal family trees will remain completely unaffected.
            </p>

            {leaveError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{leaveError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E7E2D6]">
              <button
                type="button"
                onClick={() => setLeaveModalTree(null)}
                className="px-4 py-2 text-xs font-medium text-[#6B7280] hover:text-[#1C1F1D] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLeaveSubmit}
                disabled={leaveSubmitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-2xs disabled:opacity-60 flex items-center gap-1.5 cursor-pointer"
              >
                {leaveSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{leaveSubmitting ? "Leaving…" : "Leave Tree"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
