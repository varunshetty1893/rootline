import React, { useState, useEffect } from "react";
import {
  X,
  History,
  UserPlus,
  Edit2,
  Trash2,
  Link as LinkIcon,
  Filter,
  UserCheck,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
} from "lucide-react";
import { api } from "../api.js";
import { useFamily } from "./FamilyContext.jsx";

function getActionIcon(action) {
  switch (action) {
    case "PERSON_CREATED":
    case "PERSON_ADDED":
      return <UserPlus className="w-3.5 h-3.5 text-emerald-600" />;
    case "PERSON_UPDATED":
      return <Edit2 className="w-3.5 h-3.5 text-blue-600" />;
    case "PERSON_DELETED":
      return <Trash2 className="w-3.5 h-3.5 text-red-600" />;
    case "RELATIONSHIP_ADDED":
      return <LinkIcon className="w-3.5 h-3.5 text-amber-600" />;
    case "MEMBER_JOINED":
      return <UserCheck className="w-3.5 h-3.5 text-purple-600" />;
    case "TREE_SAVED":
      return <Save className="w-3.5 h-3.5 text-teal-600" />;
    case "TREE_RESTORED":
      return <RotateCcw className="w-3.5 h-3.5 text-orange-600" />;
    default:
      return <History className="w-3.5 h-3.5 text-gray-500" />;
  }
}

function timeAgo(dateString) {
  if (!dateString) return "";
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function FamilyActivityModal({ isOpen, onClose }) {
  const { activeTreeId, activeTree, canEdit, restoreTree } = useFamily();
  const [activeTab, setActiveTab] = useState("revisions"); // "revisions" | "activity"
  const [revisions, setRevisions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [confirmRevision, setConfirmRevision] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = async () => {
    if (!isOpen || !activeTreeId) return;
    setLoading(true);
    setError("");
    try {
      const [revRes, logRes] = await Promise.all([
        api.getTreeRevisions(activeTreeId).catch(() => ({ revisions: [] })),
        api.getFamilyHistory(activeTreeId, { category, limit: 50 }).catch(() => ({ logs: [] })),
      ]);
      setRevisions(revRes.revisions || []);
      setLogs(logRes.logs || logRes.items || []);
    } catch (err) {
      setError(err.message || "Failed to load history data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSuccessMessage("");
      setConfirmRevision(null);
      loadData();
    }
  }, [isOpen, activeTreeId, category]);

  const handleConfirmRestore = async () => {
    if (!confirmRevision) return;
    setRestoringId(confirmRevision.id);
    setError("");
    try {
      const res = await restoreTree(confirmRevision.id);
      setSuccessMessage(res?.message || `Successfully restored tree to version v${confirmRevision.version}!`);
      setConfirmRevision(null);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to restore tree revision");
    } finally {
      setRestoringId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-[#E7E2D6] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E7E2D6] flex items-center justify-between bg-[#FAF9F5]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1C4B3C]/10 flex items-center justify-center text-[#1C4B3C]">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-serif font-bold text-[#1C1F1D]">Tree History & Restore</h2>
                <span className="text-[11px] font-medium bg-[#1C4B3C]/10 text-[#1C4B3C] px-2 py-0.5 rounded-full">
                  {activeTree?.name || "Family Tree"}
                </span>
              </div>
              <p className="text-xs text-[#6B7280]">
                See changes made by collaborators and restore prior revisions anytime.
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

        {/* Tab Switcher */}
        <div className="px-6 pt-3 pb-0 bg-[#FAF9F5] border-b border-[#E7E2D6] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("revisions")}
              className={`text-xs font-semibold px-4 py-2 border-b-2 transition-all flex items-center gap-2 ${
                activeTab === "revisions"
                  ? "border-[#1C4B3C] text-[#1C4B3C]"
                  : "border-transparent text-[#6B7280] hover:text-[#1C1F1D]"
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Revisions & Restore ({revisions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("activity")}
              className={`text-xs font-semibold px-4 py-2 border-b-2 transition-all flex items-center gap-2 ${
                activeTab === "activity"
                  ? "border-[#1C4B3C] text-[#1C4B3C]"
                  : "border-transparent text-[#6B7280] hover:text-[#1C1F1D]"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Activity Log ({logs.length})
            </button>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="text-xs text-[#6B7280] hover:text-[#1C4B3C] transition-colors pb-1 flex items-center gap-1"
          >
            <RotateCcw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Alerts */}
        {successMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="flex-1 font-medium">{successMessage}</span>
            <button
              type="button"
              onClick={() => setSuccessMessage("")}
              className="text-emerald-700 hover:text-emerald-900"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-800">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="flex-1 font-medium">{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              className="text-red-700 hover:text-red-900"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Restore Confirmation Dialog Prompt */}
        {confirmRevision && (
          <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-900">
                  Restore tree to Version v{confirmRevision.version}?
                </h3>
                <p className="text-xs text-amber-800 mt-1">
                  This will undo changes made after this point by collaborators, resetting the tree to have{" "}
                  <strong>{confirmRevision.people_count} people</strong> as saved on{" "}
                  <strong>{new Date(confirmRevision.created_at).toLocaleString()}</strong> by{" "}
                  <strong>{confirmRevision.actor_name}</strong>.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmRestore}
                    disabled={Boolean(restoringId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                  >
                    {restoringId ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                        Restoring…
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        Confirm & Restore v{confirmRevision.version}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRevision(null)}
                    disabled={Boolean(restoringId)}
                    className="px-3 py-1.5 bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 rounded-lg text-xs font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Revisions & Restore */}
        {activeTab === "revisions" && (
          <div className="p-6 overflow-y-auto flex-1">
            <div className="mb-4 flex items-center justify-between text-xs text-[#6B7280]">
              <span>Snapshots are created automatically upon edits and when you click Save Tree.</span>
              <span className="font-semibold text-[#1C1F1D]">{revisions.length} revision(s) recorded</span>
            </div>

            {loading && revisions.length === 0 ? (
              <div className="text-center py-12 text-xs text-[#9CA3AF]">Loading revisions…</div>
            ) : revisions.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-[#D9D3C3] rounded-xl text-xs text-[#9CA3AF]">
                No snapshots recorded yet. Click "Save Tree" to create your first baseline snapshot.
              </div>
            ) : (
              <div className="space-y-3">
                {revisions.map((rev) => {
                  const isCurrent = rev.is_current;
                  return (
                    <div
                      key={rev.id}
                      className={`border rounded-xl p-4 transition-all ${
                        isCurrent
                          ? "bg-emerald-50/50 border-emerald-300 shadow-sm"
                          : "bg-white border-[#E7E2D6] hover:border-[#1C4B3C]/30 hover:bg-[#FAF9F5]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                                isCurrent
                                  ? "bg-emerald-600 text-white"
                                  : "bg-[#1C4B3C]/10 text-[#1C4B3C]"
                              }`}
                            >
                              v{rev.version}
                            </span>
                            {isCurrent && (
                              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                Current Active State
                              </span>
                            )}
                            <span className="text-xs font-semibold text-[#1C1F1D]">
                              {rev.actor_name}
                            </span>
                            <span className="text-[11px] text-[#9CA3AF] flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {timeAgo(rev.created_at)}
                            </span>
                          </div>

                          <p className="text-xs text-[#4B5563] mt-1.5 font-medium">
                            {rev.description || "Tree revision"}
                          </p>

                          <div className="mt-2 flex items-center gap-3 text-[11px] text-[#6B7280]">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3 text-[#1C4B3C]" />
                              {rev.people_count} {rev.people_count === 1 ? "person" : "people"}
                            </span>
                            <span>·</span>
                            <span>{new Date(rev.created_at).toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="shrink-0 pt-0.5">
                          {isCurrent ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-lg">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Active
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmRevision(rev)}
                              disabled={!canEdit || Boolean(restoringId)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1C4B3C] hover:text-white bg-white hover:bg-[#1C4B3C] border border-[#1C4B3C]/30 hover:border-[#1C4B3C] px-3 py-1.5 rounded-lg shadow-sm transition-all disabled:opacity-50"
                              title="Revert tree to this exact historical version"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Restore this version
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Activity Log */}
        {activeTab === "activity" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Filter Bar */}
            <div className="px-6 py-2.5 bg-[#FAF9F5] border-b border-[#E7E2D6] flex items-center gap-2 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-[#9CA3AF]" />
              <span className="text-xs font-medium text-[#6B7280] mr-2">Filter:</span>
              {["all", "people", "relationships", "members"].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`text-xs px-3 py-0.5 rounded-full capitalize font-medium transition-colors ${
                    category === cat
                      ? "bg-[#1C4B3C] text-white"
                      : "bg-white border border-[#D9D3C3] text-[#374151] hover:bg-[#F0EDE3]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {loading && logs.length === 0 ? (
                <div className="text-center py-10 text-xs text-[#9CA3AF]">Loading history…</div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-[#D9D3C3] rounded-xl text-xs text-[#9CA3AF]">
                  No activity logs recorded yet.
                </div>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E7E2D6]">
                  {logs.map((log) => (
                    <div key={log.id} className="relative group">
                      <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-white border-2 border-[#1C4B3C] flex items-center justify-center ring-4 ring-white">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1C4B3C]" />
                      </div>
                      <div className="bg-[#FAF9F5] border border-[#E7E2D6] rounded-xl p-3 hover:border-[#1C4B3C]/30 transition-all">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="p-1 rounded-md bg-white border border-[#E7E2D6]">
                              {getActionIcon(log.action)}
                            </span>
                            <span className="text-xs font-semibold text-[#1C1F1D]">
                              {log.actor_name}
                            </span>
                          </div>
                          <span
                            className="text-[11px] text-[#9CA3AF]"
                            title={new Date(log.created_at).toLocaleString()}
                          >
                            {timeAgo(log.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-[#4B5563] pl-6 font-medium">{log.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 bg-[#FAF9F5] border-t border-[#E7E2D6] flex items-center justify-between">
          <p className="text-xs text-[#6B7280]">
            Owner and editors have full revision access to inspect and restore previous states.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-[#D9D3C3] text-xs font-semibold text-[#374151] rounded-xl hover:bg-[#F0EDE3] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
