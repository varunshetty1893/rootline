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
  ChevronDown,
  ChevronUp,
  ShieldCheck,
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
    case "INVITATION_ACCEPTED":
      return <UserCheck className="w-3.5 h-3.5 text-purple-600" />;
    case "TREE_SAVED":
      return <Save className="w-3.5 h-3.5 text-teal-600" />;
    case "TREE_RESTORED":
      return <RotateCcw className="w-3.5 h-3.5 text-orange-600" />;
    default:
      return <History className="w-3.5 h-3.5 text-gray-500" />;
  }
}

function getActionBadge(action) {
  switch (action) {
    case "PERSON_ADDED":
    case "PERSON_CREATED":
      return { label: "Member Added", className: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    case "PERSON_UPDATED":
      return { label: "Details Edited", className: "bg-blue-100 text-blue-800 border-blue-200" };
    case "PERSON_DELETED":
      return { label: "Member Removed", className: "bg-red-100 text-red-800 border-red-200" };
    case "RELATIONSHIP_ADDED":
      return { label: "Partners Linked", className: "bg-amber-100 text-amber-800 border-amber-200" };
    case "TREE_SAVED":
      return { label: "Saved Checkpoint", className: "bg-teal-100 text-teal-800 border-teal-200" };
    case "TREE_RESTORED":
      return { label: "Restored Version", className: "bg-orange-100 text-orange-800 border-orange-200" };
    case "BASELINE":
      return { label: "Initial Baseline", className: "bg-gray-100 text-gray-700 border-gray-200" };
    default:
      return { label: "Tree Update", className: "bg-gray-100 text-gray-700 border-gray-200" };
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
  const { activeTreeId, activeTree, myRole, restoreTree } = useFamily();
  const [activeTab, setActiveTab] = useState("revisions"); // "revisions" | "activity"
  const [revisions, setRevisions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [confirmRevision, setConfirmRevision] = useState(null);
  const [expandedRevId, setExpandedRevId] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");

  const isOwner = myRole === "owner";

  const loadData = async () => {
    const currentTreeId = activeTreeId || activeTree?.id;
    if (!isOpen || !currentTreeId || !isOwner) return;
    setLoading(true);
    setError("");
    try {
      const [revRes, logRes] = await Promise.all([
        api.getTreeRevisions(currentTreeId).catch((err) => {
          console.warn("Failed to get revisions:", err);
          return { revisions: [] };
        }),
        api.getFamilyHistory(currentTreeId, { category, limit: 80 }).catch((err) => {
          console.warn("Failed to get history:", err);
          return { logs: [] };
        }),
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
    if (isOpen && isOwner) {
      setSuccessMessage("");
      setConfirmRevision(null);
      loadData();
    }
  }, [isOpen, isOwner, activeTreeId, activeTree?.id, category]);

  const handleConfirmRestore = async () => {
    if (!confirmRevision || !isOwner) return;
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

  if (!isOpen || !isOwner) return null;

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
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-serif font-bold text-[#1C1F1D]">Tree History & Restore</h2>
                <span className="text-[11px] font-medium bg-[#1C4B3C]/10 text-[#1C4B3C] px-2 py-0.5 rounded-full">
                  {activeTree?.name || "Family Tree"}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                  <ShieldCheck className="w-3 h-3" />
                  Owner Only
                </span>
              </div>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Every addition, edit, deletion, and checkpoint is automatically recorded. Restore any earlier version with one click.
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
              Version Snapshots ({revisions.length})
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
              Detailed Activity Log ({logs.length})
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
                  This will revert the family tree to <strong>Version v{confirmRevision.version}</strong> ({confirmRevision.people_count}{" "}
                  {confirmRevision.people_count === 1 ? "person" : "people"}), recorded on{" "}
                  <strong>{new Date(confirmRevision.created_at).toLocaleString()}</strong> by{" "}
                  <strong>{confirmRevision.actor_name}</strong>.
                </p>
                {(confirmRevision.will_restore_names?.length > 0 || confirmRevision.will_remove_names?.length > 0) && (
                  <div className="mt-2 p-2.5 bg-white/80 rounded-lg border border-amber-200 text-[11px] space-y-1">
                    {confirmRevision.will_restore_names?.length > 0 && (
                      <p className="text-emerald-800">
                        <strong>Will bring back:</strong> {confirmRevision.will_restore_names.join(", ")}
                      </p>
                    )}
                    {confirmRevision.will_remove_names?.length > 0 && (
                      <p className="text-red-800">
                        <strong>Will remove people added after v{confirmRevision.version}:</strong>{" "}
                        {confirmRevision.will_remove_names.join(", ")}
                      </p>
                    )}
                  </div>
                )}
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
            <div className="mb-4 p-3 rounded-xl bg-[#FAF8F4] border border-[#E7E2D6] flex items-center justify-between gap-2 text-xs text-[#4B5563]">
              <span>
                Snapshots are saved automatically whenever anyone adds, edits, links, or removes a person, and when you click <strong>Save</strong>.
              </span>
              <span className="font-semibold text-[#1C4B3C] shrink-0">{revisions.length} version(s)</span>
            </div>

            {loading && revisions.length === 0 ? (
              <div className="text-center py-12 text-xs text-[#9CA3AF]">Loading version snapshots…</div>
            ) : revisions.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-[#D9D3C3] rounded-xl text-xs text-[#9CA3AF]">
                No snapshots recorded yet. Click "Save" in the toolbar to create a checkpoint.
              </div>
            ) : (
              <div className="space-y-3">
                {revisions.map((rev) => {
                  const isCurrent = rev.is_current;
                  const badge = getActionBadge(rev.action);
                  const isExpanded = expandedRevId === rev.id;
                  const peopleNames = Array.isArray(rev.people_names) ? rev.people_names : [];
                  const addedNames = Array.isArray(rev.added_names) ? rev.added_names : [];
                  const removedNames = Array.isArray(rev.removed_names) ? rev.removed_names : [];
                  const willRestore = Array.isArray(rev.will_restore_names) ? rev.will_restore_names : [];
                  const willRemove = Array.isArray(rev.will_remove_names) ? rev.will_remove_names : [];

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
                        <div className="flex-1 min-w-0">
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
                                Current Active Tree
                              </span>
                            )}
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.className}`}>
                              {badge.label}
                            </span>
                            <span className="text-xs font-semibold text-[#1C1F1D]">
                              by {rev.actor_name}
                            </span>
                            <span className="text-[11px] text-[#9CA3AF] flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {timeAgo(rev.created_at)}
                            </span>
                          </div>

                          <p className="text-xs text-[#1C1F1D] mt-1.5 font-medium">
                            {rev.description || "Tree revision"}
                          </p>

                          {/* What changed in this version */}
                          {(addedNames.length > 0 || removedNames.length > 0) && (
                            <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                              {addedNames.length > 0 && (
                                <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-medium">
                                  + Added: {addedNames.join(", ")}
                                </span>
                              )}
                              {removedNames.length > 0 && (
                                <span className="text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md font-medium">
                                  − Removed: {removedNames.join(", ")}
                                </span>
                              )}
                            </div>
                          )}

                          {/* What restoring this version will do compared to current tree */}
                          {!isCurrent && (willRestore.length > 0 || willRemove.length > 0) && (
                            <div className="mt-2 p-2 rounded-lg bg-[#FAF8F4] border border-[#E7E2D6] text-[11px] text-[#4B5563] space-y-0.5">
                              {willRestore.length > 0 && (
                                <div>
                                  <span className="font-semibold text-emerald-700">Restoring brings back:</span>{" "}
                                  {willRestore.join(", ")}
                                </div>
                              )}
                              {willRemove.length > 0 && (
                                <div>
                                  <span className="font-semibold text-amber-700">Restoring removes later additions:</span>{" "}
                                  {willRemove.join(", ")}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="mt-2 flex items-center gap-3 flex-wrap text-[11px] text-[#6B7280]">
                            <span className="flex items-center gap-1 font-medium text-[#374151]">
                              <Users className="w-3 h-3 text-[#1C4B3C]" />
                              {rev.people_count} {rev.people_count === 1 ? "person" : "people"}
                            </span>
                            <span>·</span>
                            <span>{new Date(rev.created_at).toLocaleString()}</span>
                            {peopleNames.length > 0 && (
                              <>
                                <span>·</span>
                                <button
                                  type="button"
                                  onClick={() => setExpandedRevId(isExpanded ? null : rev.id)}
                                  className="text-[#1C4B3C] font-semibold hover:underline inline-flex items-center gap-0.5"
                                >
                                  <span>{isExpanded ? "Hide members" : "View members"}</span>
                                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                              </>
                            )}
                          </div>

                          {isExpanded && peopleNames.length > 0 && (
                            <div className="mt-2.5 pt-2.5 border-t border-[#E7E2D6] flex flex-wrap gap-1.5">
                              {peopleNames.map((name, i) => (
                                <span
                                  key={`${rev.id}-p-${i}`}
                                  className="text-[11px] px-2 py-0.5 rounded-md bg-[#F7F5F0] border border-[#E7E2D6] text-[#374151]"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          )}
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
                              disabled={!isOwner || Boolean(restoringId)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1C4B3C] hover:text-white bg-white hover:bg-[#1C4B3C] border border-[#1C4B3C]/30 hover:border-[#1C4B3C] px-3 py-1.5 rounded-lg shadow-sm transition-all disabled:opacity-50"
                              title="Revert tree to this exact historical version"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Restore v{rev.version}
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
                  No activity logs recorded for this filter yet.
                </div>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E7E2D6]">
                  {logs.map((log) => {
                    const badge = getActionBadge(log.action);
                    const detailEntries =
                      log.details && typeof log.details === "object" ? Object.entries(log.details) : [];
                    return (
                      <div key={log.id} className="relative group">
                        <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-white border-2 border-[#1C4B3C] flex items-center justify-center ring-4 ring-white">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1C4B3C]" />
                        </div>
                        <div className="bg-[#FAF9F5] border border-[#E7E2D6] rounded-xl p-3 hover:border-[#1C4B3C]/30 transition-all">
                          <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <span className="p-1 rounded-md bg-white border border-[#E7E2D6]">
                                {getActionIcon(log.action)}
                              </span>
                              <span className="text-xs font-semibold text-[#1C1F1D]">
                                {log.actor_name}
                              </span>
                              <span className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border ${badge.className}`}>
                                {badge.label}
                              </span>
                            </div>
                            <span
                              className="text-[11px] text-[#9CA3AF]"
                              title={new Date(log.created_at).toLocaleString()}
                            >
                              {timeAgo(log.created_at)} · {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-xs text-[#4B5563] pl-6 font-medium">{log.description}</p>
                          {detailEntries.length > 0 && (
                            <div className="mt-2 ml-6 p-2 bg-white rounded-lg border border-[#E7E2D6] space-y-1 text-[11px] text-[#4B5563]">
                              {detailEntries.map(([field, diff]) => (
                                <div key={field} className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold capitalize text-[#1C1F1D]">
                                    {field.replace(/_/g, " ")}:
                                  </span>
                                  <span className="line-through text-red-600/80">
                                    {diff?.before || "empty"}
                                  </span>
                                  <span>→</span>
                                  <span className="text-emerald-700 font-medium">
                                    {diff?.after || "empty"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 bg-[#FAF9F5] border-t border-[#E7E2D6] flex items-center justify-between">
          <p className="text-xs text-[#6B7280]">
            Only the tree owner can view revision history and restore previous versions.
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

