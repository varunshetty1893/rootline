import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Share2,
  UserPlus,
  Trash2,
  Shield,
  Eye,
  Edit3,
  AlertCircle,
  CheckCircle2,
  User,
  Crown,
  Mail,
  Send,
  Copy,
  Check,
  Clock,
} from "lucide-react";
import { api } from "../api.js";
import { useFamily } from "./FamilyContext.jsx";
import { useAuth } from "../AuthContext.jsx";

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

export default function FamilyShareModal({ isOpen, onClose }) {
  const { activeFamilyId, currentFamily, familyRole, refresh } = useFamily();
  const { user } = useAuth();

  const [sharesData, setSharesData] = useState({ shares: [], is_owner: false, owner: null });
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [permissionInput, setPermissionInput] = useState("viewer");
  const [messageInput, setMessageInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [latestInviteUrl, setLatestInviteUrl] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const isOwner = familyRole === "owner" || (user && currentFamily?.owner_id === user.id);

  const loadData = useCallback(async () => {
    if (!isOpen || !activeFamilyId) return;
    setLoading(true);
    setError("");
    try {
      const [shares, invRes] = await Promise.all([
        api.getTreeShares(activeFamilyId),
        api.listInvitations(activeFamilyId).catch(() => ({ invitations: [] })),
      ]);
      setSharesData(shares);
      setInvitations(invRes.invitations || []);
    } catch (err) {
      setError(err.message || "Failed to load sharing settings");
    } finally {
      setLoading(false);
    }
  }, [isOpen, activeFamilyId]);

  useEffect(() => {
    if (isOpen) {
      setError("");
      setSuccess("");
      setEmailInput("");
      setMessageInput("");
      setPermissionInput("viewer");
      setLatestInviteUrl("");
      loadData();
    }
  }, [isOpen, activeFamilyId, loadData]);

  if (!isOpen) return null;

  const handleAddShare = async (e) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setSubmitting(true);
    setError("");
    setSuccess("");
    setLatestInviteUrl("");

    try {
      const res = await api.sendInvitation(activeFamilyId, {
        email: emailInput.trim().toLowerCase(),
        permission: permissionInput,
        message: messageInput.trim() || undefined,
      });

      setSuccess(
        res.emailDelivered
          ? `Invitation email sent to ${emailInput.trim()}!`
          : `Invitation created for ${emailInput.trim()}. You can copy the link below.`
      );

      if (res.inviteUrl) {
        setLatestInviteUrl(res.inviteUrl);
      }

      setEmailInput("");
      setMessageInput("");
      await loadData();
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to share tree");
    } finally {
      setSubmitting(false);
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
    if (!window.confirm("Are you sure you want to cancel this invitation?")) return;
    try {
      await api.cancelInvitation(activeFamilyId, invitationId);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to cancel invitation");
    }
  };

  const handleUpdatePermission = async (shareId, newPermission) => {
    setUpdatingId(shareId);
    setError("");
    setSuccess("");
    try {
      const res = await api.updateTreeShare(activeFamilyId, shareId, {
        permission: newPermission,
      });
      setSuccess(res.message || "Permission updated successfully.");
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to update permission");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteShare = async (shareId) => {
    if (!window.confirm("Are you sure you want to revoke this user's access to your family tree?")) {
      return;
    }

    setDeletingId(shareId);
    setError("");
    setSuccess("");
    try {
      const res = await api.deleteTreeShare(activeFamilyId, shareId);
      setSuccess(res.message || "Access revoked successfully.");
      await loadData();
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to revoke access");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-[#E7E2D6] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E7E2D6] flex items-center justify-between bg-[#FAF9F5]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1C4B3C]/10 flex items-center justify-center text-[#1C4B3C]">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-[#1C1F1D]">Share Family Tree</h2>
              <p className="text-xs text-[#6B7280]">
                {currentFamily?.name || "Family Tree"} · Collaboration & Invitations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#6B7280] hover:text-[#1C1F1D] hover:bg-[#EBE7DF] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
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

          {/* Non-owner notice */}
          {!isOwner && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-3">
              <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">
                  You are viewing a shared tree ({familyRole === "editor" ? "Editor" : "Viewer"}).
                </p>
                <p className="text-amber-800/90 leading-relaxed">
                  Only the tree owner ({sharesData?.owner?.name || "the owner"}) can invite collaborators or change permissions.
                </p>
              </div>
            </div>
          )}

          {/* Share Form (Owners Only) */}
          {isOwner && (
            <div className="bg-[#FAF9F5] border border-[#E7E2D6] rounded-xl p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1C4B3C] mb-3 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4" />
                Invite collaborator by email
              </h3>

              <form onSubmit={handleAddShare} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#4B5563] mb-1">
                    Collaborator Email Address
                  </label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="friend@example.com"
                    required
                    className="w-full text-xs bg-white border border-[#D9D3C3] rounded-lg px-3 py-2 text-[#1C1F1D] focus:outline-none focus:ring-1 focus:ring-[#1C4B3C]"
                  />
                  <p className="text-[11px] text-[#9CA3AF] mt-1">
                    An email invitation and direct acceptance link will be generated.
                  </p>
                </div>

                <div>
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Optional message to include in the invitation..."
                    className="w-full text-xs bg-white border border-[#D9D3C3] rounded-lg px-3 py-1.5 text-[#1C1F1D] focus:outline-none focus:ring-1 focus:ring-[#1C4B3C]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPermissionInput("viewer")}
                    className={`flex items-start gap-2 p-2.5 rounded-lg border text-left transition-all ${
                      permissionInput === "viewer"
                        ? "border-[#1C4B3C] bg-white ring-1 ring-[#1C4B3C]"
                        : "border-[#E7E2D6] bg-[#F7F5F0] hover:bg-white"
                    }`}
                  >
                    <Eye className="w-4 h-4 text-[#1C4B3C] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-[#1C1F1D]">Viewer</p>
                      <p className="text-[11px] text-[#6B7280]">Read-only access</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPermissionInput("editor")}
                    className={`flex items-start gap-2 p-2.5 rounded-lg border text-left transition-all ${
                      permissionInput === "editor"
                        ? "border-[#1C4B3C] bg-white ring-1 ring-[#1C4B3C]"
                        : "border-[#E7E2D6] bg-[#F7F5F0] hover:bg-white"
                    }`}
                  >
                    <Edit3 className="w-4 h-4 text-[#1C4B3C] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-[#1C1F1D]">Editor</p>
                      <p className="text-[11px] text-[#6B7280]">Can add & edit</p>
                    </div>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !emailInput.trim()}
                  className="w-full py-2 px-3 bg-[#1C4B3C] hover:bg-[#163C30] disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? "Sending..." : "Send Invitation"}
                </button>
              </form>
            </div>
          )}

          {/* Active Collaborators / Shares List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-[#1C1F1D]">
                Shared Users ({sharesData?.shares?.length || 0})
              </h3>
              <span className="text-[11px] text-[#6B7280]">
                {isOwner ? "Owner controls" : "Read-only list"}
              </span>
            </div>

            {loading ? (
              <div className="py-6 text-center text-xs text-[#9CA3AF]">
                Loading shared access list...
              </div>
            ) : sharesData?.shares?.length === 0 ? (
              <div className="border border-dashed border-[#D9D3C3] rounded-xl p-5 text-center bg-[#FAF9F5]">
                <p className="text-xs text-[#6B7280]">
                  This family tree is currently private to you.
                </p>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                  Invite collaborators above via their email address.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#E7E2D6] border border-[#E7E2D6] rounded-xl overflow-hidden bg-white">
                {sharesData?.shares?.map((share) => (
                  <li
                    key={share.id}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-[#FAF9F5] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#EBE7DF] flex items-center justify-center text-[#1C1F1D] text-xs font-bold shrink-0">
                        {share.user_name ? share.user_name[0].toUpperCase() : <User className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#1C1F1D] truncate">
                          {share.user_name}
                        </p>
                        <p className="text-[11px] text-[#6B7280] truncate">{share.user_email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isOwner ? (
                        <>
                          <select
                            value={share.permission}
                            disabled={updatingId === share.id}
                            onChange={(e) => handleUpdatePermission(share.id, e.target.value)}
                            className="text-xs font-semibold bg-white border border-[#D9D3C3] rounded-md px-2 py-1 text-[#1C1F1D] focus:outline-none focus:ring-1 focus:ring-[#1C4B3C]"
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => handleDeleteShare(share.id)}
                            disabled={deletingId === share.id}
                            title="Revoke access"
                            className="p-1 text-[#9CA3AF] hover:text-red-600 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#E7E2D6] text-[#4B5563]">
                          {share.permission === "editor" ? "Editor" : "Viewer"}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Invitations & Tracking ("Who Sent Whom") */}
          {invitations.length > 0 && (
            <div className="pt-2 border-t border-[#E7E2D6]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-[#1C1F1D] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#1C4B3C]" />
                  Invitations & Tracking ({invitations.length})
                </h3>
                <span className="text-[11px] text-[#6B7280]">
                  Who invited whom
                </span>
              </div>

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
                          {inv.permission}
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

                      {isOwner && inv.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => handleCancelInvite(inv.id)}
                          className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-[11px] font-medium transition-colors"
                          title="Cancel invitation"
                        >
                          Cancel
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
        <div className="px-6 py-3 border-t border-[#E7E2D6] bg-[#FAF9F5] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-white border border-[#D9D3C3] text-[#1C1F1D] hover:bg-[#EBE7DF] rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
