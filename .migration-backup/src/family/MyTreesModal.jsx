import React, { useState, useEffect } from "react";
import {
  X,
  GitBranch,
  Crown,
  Eye,
  Edit3,
  Share2,
  Check,
  ArrowRight,
  User,
  Users,
} from "lucide-react";
import { api } from "../api.js";
import { useFamily } from "./FamilyContext.jsx";
import { useAuth } from "../AuthContext.jsx";

export default function MyTreesModal({ isOpen, onClose, onOpenShare }) {
  const { activeFamilyId, switchFamily, refresh } = useFamily();
  const { user } = useAuth();

  const [treesData, setTreesData] = useState({ owned: null, shared: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadTrees = async () => {
    if (!isOpen) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.getMyTrees();
      setTreesData(data);
    } catch (err) {
      setError(err.message || "Failed to load trees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTrees();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectTree = (familyId) => {
    switchFamily(familyId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-[#E7E2D6] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E7E2D6] flex items-center justify-between bg-[#FAF9F5]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1C4B3C]/10 flex items-center justify-center text-[#1C4B3C]">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-[#1C1F1D]">My Trees</h2>
              <p className="text-xs text-[#6B7280]">
                Switch between your personal tree and trees shared with you
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Owned Tree */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1C4B3C] flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-600" />
                Personal Family Tree
              </h3>
            </div>

            {treesData.owned ? (
              <div
                className={`p-4 rounded-xl border transition-all ${
                  activeFamilyId === treesData.owned.family.id || !activeFamilyId
                    ? "border-[#1C4B3C] bg-[#1C4B3C]/5 shadow-2xs"
                    : "border-[#E7E2D6] bg-white hover:border-[#1C4B3C]/40"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-serif font-bold text-[#1C1F1D] truncate">
                        {treesData.owned.family.name}
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                        <Crown className="w-2.5 h-2.5" />
                        Owner
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      Created by you ({user?.name || user?.email})
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {onOpenShare && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenShare();
                        }}
                        className="p-1.5 text-[#1C4B3C] hover:bg-[#E7F1EB] rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                        title="Manage tree sharing"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Share</span>
                      </button>
                    )}

                    {activeFamilyId === treesData.owned.family.id || !activeFamilyId ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1C4B3C] bg-white border border-[#1C4B3C]/30 px-2.5 py-1 rounded-lg">
                        <Check className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectTree(treesData.owned.family.id)}
                        className="text-xs font-semibold bg-[#1C4B3C] text-white px-3 py-1.5 rounded-lg hover:bg-[#163C30] transition-colors"
                      >
                        Switch
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-[#9CA3AF]">
                Loading your personal tree...
              </div>
            )}
          </div>

          {/* Shared With Me */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#4B5563] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Shared With Me ({treesData.shared?.length || 0})
              </h3>
            </div>

            {loading ? (
              <div className="py-6 text-center text-xs text-[#9CA3AF]">
                Loading shared trees...
              </div>
            ) : treesData.shared?.length === 0 ? (
              <div className="border border-dashed border-[#D9D3C3] rounded-xl p-5 text-center bg-[#FAF9F5]">
                <p className="text-xs text-[#6B7280]">
                  No family trees have been shared with you yet.
                </p>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                  When someone shares their family tree with your email ({user?.email}), it will appear here.
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {treesData.shared.map((item) => {
                  const isActive = activeFamilyId === item.family.id;
                  const isEditor = item.role === "editor";

                  return (
                    <li
                      key={item.family.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isActive
                          ? "border-[#1C4B3C] bg-[#1C4B3C]/5 shadow-2xs"
                          : "border-[#E7E2D6] bg-white hover:border-[#1C4B3C]/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-serif font-bold text-[#1C1F1D] truncate">
                              {item.family.name}
                            </p>
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                isEditor
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {isEditor ? <Edit3 className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                              {isEditor ? "Editor" : "Viewer"}
                            </span>
                          </div>
                          <p className="text-xs text-[#6B7280] mt-0.5">
                            Shared by {item.owner?.name || "Owner"} ({item.owner?.email || ""})
                          </p>
                        </div>

                        <div className="shrink-0">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1C4B3C] bg-white border border-[#1C4B3C]/30 px-2.5 py-1 rounded-lg">
                              <Check className="w-3.5 h-3.5" />
                              Active
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSelectTree(item.family.id)}
                              className="text-xs font-semibold bg-[#1C4B3C] text-white px-3 py-1.5 rounded-lg hover:bg-[#163C30] transition-colors"
                            >
                              Switch
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
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
