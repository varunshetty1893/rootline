/**
 * ShareModal.jsx
 *
 * Google Drive-style sharing dialog.
 * – Owner can invite users by email as Viewer or Editor with optional personal message.
 * – Tracks "Who sent Whom" with full invitation lifecycle (Pending, Accepted, Declined, Expired).
 * – Provides 1-click Invitation Link copying for sharing directly via WhatsApp, email, or chat.
 * – Viewers/Editors see a read-only list.
 */
import { useState, useEffect, useCallback } from "react";
import {
  X,
  UserPlus,
  Shield,
  Eye,
  Pencil,
  Trash2,
  Loader2,
  Check,
  Copy,
  Mail,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useFamily } from "./FamilyContext.jsx";

const PERMISSION_LABELS = {
  viewer: "Viewer",
  editor: "Editor",
};

const PERMISSION_DESCRIPTIONS = {
  viewer: "Can view the tree but cannot make changes.",
  editor: "Can add, edit, and remove people.",
};

function PermissionBadge({ role }) {
  const isOwner = role === "owner";
  const base = "inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5";
  if (isOwner)
    return (
      <span className={`${base} bg-[#1C4B3C]/10 text-[#1C4B3C]`}>
        <Shield className="w-3 h-3" /> Owner
      </span>
    );
  if (role === "editor")
    return (
      <span className={`${base} bg-blue-50 text-blue-700`}>
        <Pencil className="w-3 h-3" /> Editor
      </span>
    );
  return (
    <span className={`${base} bg-amber-50 text-amber-700`}>
      <Eye className="w-3 h-3" /> Viewer
    </span>
  );
}

function InvitationStatusBadge({ status, isExpired }) {
  if (isExpired || status === "expired") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="w-2.5 h-2.5" /> Expired
      </span>
    );
  }
  if (status === "accepted") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-2.5 h-2.5" /> Accepted
      </span>
    );
  }
  if (status === "declined") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-gray-50 text-gray-600 border border-gray-200">
        Declined
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200">
      <Clock className="w-2.5 h-2.5" /> Pending
    </span>
  );
}

export default function ShareModal({ treeId, treeName, onClose }) {
  const { user } = useAuth();
  const { treeList, canManage: contextCanManage, refreshTreeList } = useFamily();
  const [sharesData, setSharesData] = useState(null); // { owner, shares }
  const [invitations, setInvitations] = useState([]);
  const [loadError, setLoadError] = useState("");

  // Determine permissions accurately for this specific tree
  const isOwnerOfThisTree =
    (sharesData?.owner && user?.id && sharesData.owner.id === user.id) ||
    treeList?.owned_trees?.some((t) => t.id === treeId);
  const mySharedRole = treeList?.shared_trees?.find((t) => t.id === treeId)?.role;
  const canManage = isOwnerOfThisTree || mySharedRole === "editor" || contextCanManage;

  // Invitation action states
  const [invitationActionId, setInvitationActionId] = useState(null);
  const [invitationFeedback, setInvitationFeedback] = useState("");
  const [invitationError, setInvitationError] = useState("");

  // Add-user form
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState("viewer");
  const [message, setMessage] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [latestInviteUrl, setLatestInviteUrl] = useState("");

  // Copied link feedback
  const [copiedId, setCopiedId] = useState(null);

  // Per-row state: { [shareId]: { saving, error } }
  const [rowState, setRowState] = useState({});

  const loadData = useCallback(async () => {
    setLoadError("");
    try {
      const [shares, invRes] = await Promise.all([
        api.listShares(treeId),
        api.listInvitations(treeId).catch(() => ({ invitations: [] })),
      ]);
      setSharesData(shares);
      setInvitations(invRes.invitations || []);
    } catch (err) {
      setLoadError(err.message);
    }
  }, [treeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddError("");
    setAddSuccess("");
    setLatestInviteUrl("");
    setAdding(true);
    try {
      const res = await api.sendInvitation(treeId, {
        email: email.trim().toLowerCase(),
        permission,
        message: message.trim() || undefined,
      });

      setEmail("");
      setMessage("");
      setAddSuccess(
        res.emailDelivered
          ? `Invitation email sent to ${email.trim()} as ${PERMISSION_LABELS[permission]}!`
          : `Invitation created for ${email.trim()} as ${PERMISSION_LABELS[permission]}.`
      );

      if (res.inviteUrl) {
        setLatestInviteUrl(res.inviteUrl);
      }

      await loadData();
      await refreshTreeList();
    } catch (err) {
      setAddError(err.message || "Failed to invite user");
    } finally {
      setAdding(false);
    }
  };

  const handleCopyLink = (urlOrToken, invId) => {
    const fullUrl = urlOrToken.startsWith("http")
      ? urlOrToken
      : `${window.location.origin}/invite/accept?token=${urlOrToken}`;

    navigator.clipboard.writeText(fullUrl);
    setCopiedId(invId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCancelInvite = async (invitationId) => {
    setInvitationActionId(invitationId);
    setInvitationFeedback("");
    setInvitationError("");
    try {
      await api.cancelInvitation(treeId, invitationId);
      setInvitations((prev) =>
        prev.map((inv) => (inv.id === invitationId ? { ...inv, status: "cancelled" } : inv))
      );
      setInvitationFeedback("Invitation cancelled successfully.");
      setTimeout(() => setInvitationFeedback(""), 4000);
      await loadData();
    } catch (err) {
      setInvitationError(err.message || "Failed to cancel invitation.");
    } finally {
      setInvitationActionId(null);
    }
  };

  const handleDeleteInvite = async (invitationId) => {
    setInvitationActionId(invitationId);
    setInvitationFeedback("");
    setInvitationError("");
    try {
      await api.deleteInvitation(treeId, invitationId);
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
      setInvitationFeedback("Invitation removed.");
      setTimeout(() => setInvitationFeedback(""), 4000);
      await loadData();
    } catch (err) {
      setInvitationError(err.message || "Failed to remove invitation.");
    } finally {
      setInvitationActionId(null);
    }
  };

  const handleChangePermission = async (share, newPermission) => {
    setRowState((prev) => ({
      ...prev,
      [share.id]: { saving: true, error: "" },
    }));
    try {
      await api.updateShare(treeId, share.id, newPermission);
      await loadData();
    } catch (err) {
      setRowState((prev) => ({
        ...prev,
        [share.id]: { saving: false, error: err.message },
      }));
      return;
    }
    setRowState((prev) => ({ ...prev, [share.id]: { saving: false, error: "" } }));
  };

  const handleRevoke = async (share) => {
    setRowState((prev) => ({
      ...prev,
      [share.id]: { saving: true, error: "" },
    }));
    try {
      await api.removeShare(treeId, share.id);
      await loadData();
      await refreshTreeList();
    } catch (err) {
      setRowState((prev) => ({
        ...prev,
        [share.id]: { saving: false, error: err.message },
      }));
      return;
    }
    setRowState((prev) => ({ ...prev, [share.id]: { saving: false, error: "" } }));
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E7E2D6] bg-[#FAF9F5]">
          <div>
            <h2 className="text-base font-semibold text-[#1C1F1D]">Share "{treeName}"</h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Invite collaborators, track who invited whom, and manage permissions.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-[#1C1F1D] transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6 overflow-y-auto flex-1">
          {/* ── Add user form (Owner only) ── */}
          {canManage && (
            <form onSubmit={handleAdd} className="space-y-3 bg-[#FAF9F5] p-4 rounded-xl border border-[#E7E2D6]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#1C4B3C] uppercase tracking-wide flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" />
                  Invite Collaborator by Email
                </p>
                <span className="text-[11px] text-[#6B7280]">
                  Recipient receives invitation email & link
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="collaborator@example.com"
                  className="flex-1 text-sm border border-[#E7E2D6] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 bg-white"
                />
                <select
                  value={permission}
                  onChange={(e) => setPermission(e.target.value)}
                  className="text-sm border border-[#E7E2D6] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button
                  type="submit"
                  disabled={adding || !email}
                  className="flex items-center justify-center gap-1.5 bg-[#1C4B3C] text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-[#163C30] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 shadow-2xs"
                >
                  {adding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Send Invite
                </button>
              </div>

              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Optional personal message (e.g. 'Hey, check out our family records!')"
                className="w-full text-xs border border-[#E7E2D6] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 bg-white"
              />

              {/* Permission description */}
              <p className="text-[11px] text-[#6B7280]">
                {PERMISSION_DESCRIPTIONS[permission]}
              </p>

              {addError && <p className="text-xs text-red-600">{addError}</p>}
              {addSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
                  <p className="text-xs text-[#1C4B3C] font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    {addSuccess}
                  </p>
                  {latestInviteUrl && (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        readOnly
                        value={latestInviteUrl}
                        className="text-[11px] bg-white border border-emerald-200 rounded px-2 py-1 flex-1 text-[#374151]"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyLink(latestInviteUrl, "latest")}
                        className="px-2.5 py-1 bg-[#1C4B3C] text-white text-[11px] font-medium rounded flex items-center gap-1 hover:bg-[#163C30] shrink-0"
                      >
                        {copiedId === "latest" ? (
                          <>
                            <Check className="w-3 h-3" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy Link
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </form>
          )}

          {/* ── Active Members with Access ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide">
                Collaborators with Access
              </p>
              <span className="text-[11px] text-[#6B7280]">
                {sharesData?.shares ? `${sharesData.shares.length + 1} member(s)` : ""}
              </span>
            </div>

            {loadError && (
              <p className="text-xs text-red-600 mb-2">{loadError}</p>
            )}

            {!sharesData ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-[#9CA3AF]" />
              </div>
            ) : (
              <ul className="space-y-2">
                {/* Owner row */}
                <li className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-[#F7F5F0] border border-[#E7E2D6]">
                  <div className="w-8 h-8 rounded-full bg-[#1C4B3C]/15 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-[#1C4B3C]">
                      {sharesData.owner?.name?.[0]?.toUpperCase() || "?"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1C1F1D] truncate">
                      {sharesData.owner?.name || "Owner"}
                    </p>
                    <p className="text-xs text-[#6B7280] truncate">
                      {sharesData.owner?.email}
                    </p>
                  </div>
                  <PermissionBadge role="owner" />
                </li>

                {/* Shared users */}
                {sharesData.shares.length === 0 && (
                  <li className="text-xs text-[#6B7280] px-3.5 py-2 italic">
                    No other users have joined this tree yet.
                  </li>
                )}
                {sharesData.shares.map((share) => {
                  const rs = rowState[share.id] || {};
                  const displayName =
                    share.user_name ||
                    share.name ||
                    (share.user_email || share.email
                      ? (share.user_email || share.email).split("@")[0]
                      : "Collaborator");
                  const displayEmail = share.user_email || share.email || "";
                  const initial = (
                    displayName && displayName !== "Collaborator"
                      ? displayName[0]
                      : displayEmail
                      ? displayEmail[0]
                      : "?"
                  ).toUpperCase();

                  return (
                    <li
                      key={share.id}
                      className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-[#E7E2D6] bg-white hover:bg-[#FAF9F5] transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#E7E2D6] flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-[#6B7280]">
                          {initial}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1C1F1D] truncate">
                          {displayName}
                        </p>
                        {displayEmail && (
                          <p className="text-xs text-[#6B7280] truncate">{displayEmail}</p>
                        )}
                        {rs.error && (
                          <p className="text-xs text-red-600 mt-0.5">{rs.error}</p>
                        )}
                      </div>

                      {canManage ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={share.permission}
                            disabled={rs.saving}
                            onChange={(e) => handleChangePermission(share, e.target.value)}
                            className="text-xs border border-[#E7E2D6] rounded-md px-2 py-1 bg-[#FAFAF8] focus:outline-none focus:ring-1 focus:ring-[#1C4B3C]/30 disabled:opacity-50"
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                          </select>
                          <button
                            onClick={() => handleRevoke(share)}
                            disabled={rs.saving}
                            className="p-1 text-[#9CA3AF] hover:text-red-600 disabled:opacity-40 transition-colors"
                            title="Remove access"
                          >
                            {rs.saving ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <PermissionBadge role={share.permission} />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ── Invitations & Tracking ("Who Sent Whom") ── */}
          {invitations.length > 0 && (
            <div className="pt-2 border-t border-[#E7E2D6]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#1C4B3C]" />
                  Invitations & Tracking ({invitations.length})
                </p>
                <span className="text-[11px] text-[#6B7280]">
                  Records who invited whom
                </span>
              </div>

              {invitationFeedback && (
                <div className="mb-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{invitationFeedback}</span>
                </div>
              )}

              {invitationError && (
                <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>{invitationError}</span>
                </div>
              )}

              <div className="border border-[#E7E2D6] rounded-xl overflow-hidden divide-y divide-[#E7E2D6] bg-white">
                {invitations.map((inv) => (
                  <div key={inv.id} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#FAF9F5]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[#1C1F1D]">
                          To: {inv.invitee_email}
                        </span>
                        <InvitationStatusBadge
                          status={inv.status}
                          isExpired={new Date(inv.expires_at) < new Date()}
                        />
                        <span className="text-[10px] text-[#6B7280] font-medium capitalize">
                          Role: {inv.permission}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6B7280] mt-0.5">
                        Sent by: <strong>{inv.inviter_name}</strong> ({inv.inviter_email}) · {new Date(inv.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleCopyLink(inv.token, inv.id)}
                        className="px-2 py-1 border border-[#E7E2D6] bg-[#FAFAF8] hover:bg-white text-[#374151] rounded text-[11px] flex items-center gap-1 font-medium transition-colors"
                        title="Copy invitation link"
                      >
                        {copiedId === inv.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy Link
                          </>
                        )}
                      </button>

                      {canManage && inv.status === "pending" && (
                        <button
                          type="button"
                          disabled={invitationActionId === inv.id}
                          onClick={() => handleCancelInvite(inv.id)}
                          className="px-2.5 py-1 text-red-600 hover:bg-red-50 border border-red-200/60 rounded text-[11px] font-semibold transition-colors flex items-center gap-1 disabled:opacity-50"
                          title="Cancel this pending invitation"
                        >
                          {invitationActionId === inv.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : null}
                          Cancel Invitation
                        </button>
                      )}

                      {canManage && (inv.status === "cancelled" || inv.status === "declined" || inv.status === "expired") && (
                        <button
                          type="button"
                          disabled={invitationActionId === inv.id}
                          onClick={() => handleDeleteInvite(inv.id)}
                          className="px-2 py-1 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded text-[11px] transition-colors flex items-center gap-1 disabled:opacity-50"
                          title="Remove this invitation record"
                        >
                          {invitationActionId === inv.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E7E2D6] bg-[#FAF9F5] flex justify-end">
          <button
            onClick={onClose}
            className="text-sm font-semibold text-[#374151] hover:text-[#1C1F1D] px-4 py-2 border border-[#E7E2D6] rounded-xl bg-white hover:bg-[#F7F5F0] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
