/**
 * ShareModal.jsx
 *
 * Google Drive-style sharing dialog.
 * – Owner can add users by email as Viewer or Editor.
 * – Owner can change an existing share's permission or revoke it.
 * – Viewers/Editors see a read-only "Who has access" list.
 */
import { useState, useEffect, useCallback } from "react";
import { X, UserPlus, Shield, Eye, Pencil, Trash2, Loader2, Check } from "lucide-react";
import { api } from "../api.js";
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

export default function ShareModal({ treeId, treeName, onClose }) {
  const { canManage, refreshTreeList } = useFamily();
  const [sharesData, setSharesData] = useState(null); // { owner, shares }
  const [loadError, setLoadError] = useState("");

  // Add-user form
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState("viewer");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");

  // Per-row state: { [shareId]: { saving, error } }
  const [rowState, setRowState] = useState({});

  const loadShares = useCallback(async () => {
    setLoadError("");
    try {
      const data = await api.listShares(treeId);
      setSharesData(data);
    } catch (err) {
      setLoadError(err.message);
    }
  }, [treeId]);

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddError("");
    setAddSuccess("");
    setAdding(true);
    try {
      await api.shareTree(treeId, email.trim().toLowerCase(), permission);
      setEmail("");
      setAddSuccess(`Shared with ${email.trim()} as ${PERMISSION_LABELS[permission]}.`);
      await loadShares();
      await refreshTreeList();
      setTimeout(() => setAddSuccess(""), 4000);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleChangePermission = async (share, newPermission) => {
    setRowState((prev) => ({
      ...prev,
      [share.id]: { saving: true, error: "" },
    }));
    try {
      await api.updateShare(treeId, share.id, newPermission);
      await loadShares();
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
      await loadShares();
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E7E2D6]">
          <div>
            <h2 className="text-base font-semibold text-[#1C1F1D]">Share "{treeName}"</h2>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              Manage who can view or edit this family tree.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-[#1C1F1D] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* ── Add user form (Owner only) ── */}
          {canManage && (
            <form onSubmit={handleAdd} className="space-y-3">
              <p className="text-xs font-medium text-[#374151] uppercase tracking-wide">
                Invite someone
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="their@email.com"
                  className="flex-1 text-sm border border-[#E7E2D6] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 bg-[#FAFAF8]"
                />
                <select
                  value={permission}
                  onChange={(e) => setPermission(e.target.value)}
                  className="text-sm border border-[#E7E2D6] rounded-lg px-2 py-2 bg-[#FAFAF8] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button
                  type="submit"
                  disabled={adding || !email}
                  className="flex items-center gap-1.5 bg-[#1C4B3C] text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-[#163C30] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {adding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  Share
                </button>
              </div>
              {/* Permission description */}
              <p className="text-xs text-[#9CA3AF]">{PERMISSION_DESCRIPTIONS[permission]}</p>
              {addError && <p className="text-xs text-red-600">{addError}</p>}
              {addSuccess && (
                <p className="text-xs text-[#1C4B3C] flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  {addSuccess}
                </p>
              )}
            </form>
          )}

          {/* ── Current access list ── */}
          <div>
            <p className="text-xs font-medium text-[#374151] uppercase tracking-wide mb-3">
              Who has access
            </p>

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
                <li className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#F7F5F0]">
                  <div className="w-8 h-8 rounded-full bg-[#1C4B3C]/15 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-[#1C4B3C]">
                      {sharesData.owner?.name?.[0]?.toUpperCase() || "?"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1C1F1D] truncate">
                      {sharesData.owner?.name || "Owner"}
                    </p>
                    <p className="text-xs text-[#9CA3AF] truncate">
                      {sharesData.owner?.email}
                    </p>
                  </div>
                  <PermissionBadge role="owner" />
                </li>

                {/* Shared users */}
                {sharesData.shares.length === 0 && (
                  <li className="text-xs text-[#9CA3AF] px-3 py-2">
                    No one else has access yet.
                  </li>
                )}
                {sharesData.shares.map((share) => {
                  const rs = rowState[share.id] || {};
                  return (
                    <li
                      key={share.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#E7E2D6]"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#E7E2D6] flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-[#6B7280]">
                          {share.user_name?.[0]?.toUpperCase() || "?"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1C1F1D] truncate">
                          {share.user_name}
                        </p>
                        <p className="text-xs text-[#9CA3AF] truncate">{share.user_email}</p>
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
                            className="text-xs border border-[#E7E2D6] rounded-md px-1.5 py-1 bg-[#FAFAF8] focus:outline-none focus:ring-1 focus:ring-[#1C4B3C]/30 disabled:opacity-50"
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                          </select>
                          <button
                            onClick={() => handleRevoke(share)}
                            disabled={rs.saving}
                            className="text-[#9CA3AF] hover:text-red-600 disabled:opacity-40 transition-colors"
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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E7E2D6] flex justify-end">
          <button
            onClick={onClose}
            className="text-sm font-medium text-[#374151] hover:text-[#1C1F1D] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
