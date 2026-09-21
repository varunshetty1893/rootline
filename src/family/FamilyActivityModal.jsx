import React, { useState, useEffect } from "react";
import {
  X,
  History,
  UserPlus,
  Edit2,
  Trash2,
  Link as LinkIcon,
  Heart,
  Calendar,
  Filter,
  UserCheck,
} from "lucide-react";
import { api } from "../api.js";
import { useFamily } from "./FamilyContext.jsx";

function getActionIcon(action) {
  switch (action) {
    case "PERSON_CREATED":
      return <UserPlus className="w-3.5 h-3.5 text-emerald-600" />;
    case "PERSON_UPDATED":
      return <Edit2 className="w-3.5 h-3.5 text-blue-600" />;
    case "PERSON_DELETED":
      return <Trash2 className="w-3.5 h-3.5 text-red-600" />;
    case "RELATIONSHIP_ADDED":
      return <LinkIcon className="w-3.5 h-3.5 text-amber-600" />;
    case "MEMBER_JOINED":
      return <UserCheck className="w-3.5 h-3.5 text-purple-600" />;
    default:
      return <History className="w-3.5 h-3.5 text-gray-500" />;
  }
}

function timeAgo(dateString) {
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
  const { activeFamilyId, currentFamily } = useFamily();
  const [logs, setLogs] = useState([]);
  const [category, setCategory] = useState("all"); // "all" | "people" | "relationships" | "members"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = async () => {
    if (!isOpen) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.getFamilyHistory(activeFamilyId, { category, limit: 50 });
      setLogs(res.logs || []);
    } catch (err) {
      setError(err.message || "Failed to load activity logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, activeFamilyId, category]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl border border-[#E7E2D6] overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E7E2D6] flex items-center justify-between bg-[#FAF9F5]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1C4B3C]/10 flex items-center justify-center text-[#1C4B3C]">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-[#1C1F1D]">Family History & Activity</h2>
              <p className="text-xs text-[#6B7280]">
                {currentFamily?.name || "Family Tree"} · Recent changes and audit trail
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

        {/* Filter Bar */}
        <div className="px-6 py-3 bg-[#FAF9F5] border-b border-[#E7E2D6] flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-[#9CA3AF]" />
          <span className="text-xs font-medium text-[#6B7280] mr-2">Filter:</span>
          {["all", "people", "relationships", "members"].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`text-xs px-3 py-1 rounded-full capitalize font-medium transition-colors ${
                category === cat
                  ? "bg-[#1C4B3C] text-white"
                  : "bg-white border border-[#D9D3C3] text-[#374151] hover:bg-[#F0EDE3]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Activity List */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-10 text-xs text-[#9CA3AF]">Loading history…</div>
          ) : error ? (
            <div className="text-center py-10 text-xs text-red-600">{error}</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-[#D9D3C3] rounded-xl text-xs text-[#9CA3AF]">
              No activity logs recorded yet.
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E7E2D6]">
              {logs.map((log) => (
                <div key={log.id} className="relative group">
                  <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-white border-2 border-[#1C4B3C] flex items-center justify-center ring-4 ring-white">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1C4B3C]" />
                  </div>
                  <div className="bg-[#FAF9F5] border border-[#E7E2D6] rounded-xl p-3.5 hover:border-[#1C4B3C]/30 transition-all">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="p-1 rounded-md bg-white border border-[#E7E2D6]">
                          {getActionIcon(log.action)}
                        </span>
                        <span className="text-xs font-semibold text-[#1C1F1D]">{log.actor_name}</span>
                      </div>
                      <span className="text-[11px] text-[#9CA3AF]" title={new Date(log.created_at).toLocaleString()}>
                        {timeAgo(log.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-[#4B5563] pl-6">{log.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#FAF9F5] border-t border-[#E7E2D6] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[#374151] hover:text-[#1C1F1D] bg-white border border-[#D9D3C3] rounded-lg hover:bg-[#F0EDE3] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
