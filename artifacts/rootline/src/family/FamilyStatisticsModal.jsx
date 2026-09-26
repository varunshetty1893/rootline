import React, { useState, useEffect } from "react";
import {
  X,
  BarChart2,
  Users,
  Heart,
  GitBranch,
  Calendar,
  Sparkles,
  TrendingUp,
  Award,
} from "lucide-react";
import { api } from "../api.js";
import { useFamily } from "./FamilyContext.jsx";

export default function FamilyStatisticsModal({ isOpen, onClose }) {
  const { activeFamilyId, currentFamily } = useFamily();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadStats = async () => {
    if (!isOpen) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.getFamilyStatistics(activeFamilyId);
      setStats(data);
    } catch (err) {
      setError(err.message || "Failed to load statistics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen, activeFamilyId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-[#E7E2D6] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E7E2D6] flex items-center justify-between bg-[#FAF9F5]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1C4B3C]/10 flex items-center justify-center text-[#1C4B3C]">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-[#1C1F1D]">Family Statistics & Insights</h2>
              <p className="text-xs text-[#6B7280]">
                {currentFamily?.name || "Family Tree"} · Demographic breakdown & lineage metrics
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
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="text-center py-16 text-xs text-[#9CA3AF]">Calculating lineage metrics…</div>
          ) : error ? (
            <div className="text-center py-16 text-xs text-red-600 space-y-2">
              <p>{error}</p>
              <button
                type="button"
                onClick={loadStats}
                className="px-3 py-1 bg-[#1C4B3C] text-white rounded text-xs hover:bg-[#163C30]"
              >
                Retry
              </button>
            </div>
          ) : !stats ? (
            <div className="text-center py-16 text-xs text-[#9CA3AF]">No statistics available.</div>
          ) : (() => {
            const totalPeople = stats.total_people ?? stats.totalMembers ?? 0;
            const livingCount = stats.living_count ?? stats.livingMembers ?? 0;
            const deceasedCount = stats.deceased_count ?? stats.deceasedMembers ?? 0;
            const maxDepth = stats.max_generation_depth ?? stats.generationsCount ?? 0;
            const totalCouples = stats.total_couples ?? stats.couplesCount ?? 0;
            const avgChildren = stats.avg_children_per_family ?? (stats.couplesCount ? +(stats.childrenCount / stats.couplesCount).toFixed(1) : 0);
            const avgLifespan = stats.avg_lifespan_years ?? stats.averageAge ?? null;

            const maleCount = typeof stats.gender_distribution?.male === "number"
              ? stats.gender_distribution.male
              : stats.maleMembers ?? 0;
            const femaleCount = typeof stats.gender_distribution?.female === "number"
              ? stats.gender_distribution.female
              : stats.femaleMembers ?? 0;
            const otherCount = typeof stats.gender_distribution?.other === "number"
              ? stats.gender_distribution.other
              : stats.otherGenderMembers ?? 0;
            const unspecifiedCount = typeof stats.gender_distribution?.unspecified === "number"
              ? stats.gender_distribution.unspecified
              : 0;

            const topSurnames = Array.isArray(stats.top_surnames) ? stats.top_surnames : [];
            const oldestAncestor = stats.oldest_ancestor || stats.oldestLivingMember || null;
            const youngestPerson = stats.youngest_person || stats.youngestMember || null;

            return (
              <>
                {/* Metric Highlights Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#FAF9F5] border border-[#E7E2D6] rounded-xl p-3.5">
                    <p className="text-xs text-[#6B7280] flex items-center gap-1.5 mb-1">
                      <Users className="w-3.5 h-3.5 text-[#1C4B3C]" /> Total Members
                    </p>
                    <p className="text-2xl font-serif font-bold text-[#1C1F1D]">{totalPeople}</p>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                      {livingCount} living · {deceasedCount} resting
                    </p>
                  </div>

                  <div className="bg-[#FAF9F5] border border-[#E7E2D6] rounded-xl p-3.5">
                    <p className="text-xs text-[#6B7280] flex items-center gap-1.5 mb-1">
                      <GitBranch className="w-3.5 h-3.5 text-[#1C4B3C]" /> Max Depth
                    </p>
                    <p className="text-2xl font-serif font-bold text-[#1C1F1D]">{maxDepth}</p>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">generations recorded</p>
                  </div>

                  <div className="bg-[#FAF9F5] border border-[#E7E2D6] rounded-xl p-3.5">
                    <p className="text-xs text-[#6B7280] flex items-center gap-1.5 mb-1">
                      <Heart className="w-3.5 h-3.5 text-[#1C4B3C]" /> Couples Linked
                    </p>
                    <p className="text-2xl font-serif font-bold text-[#1C1F1D]">{totalCouples}</p>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                      ~{avgChildren} kids / couple
                    </p>
                  </div>

                  <div className="bg-[#FAF9F5] border border-[#E7E2D6] rounded-xl p-3.5">
                    <p className="text-xs text-[#6B7280] flex items-center gap-1.5 mb-1">
                      <Calendar className="w-3.5 h-3.5 text-[#1C4B3C]" /> Avg Lifespan
                    </p>
                    <p className="text-2xl font-serif font-bold text-[#1C1F1D]">
                      {avgLifespan ? `${avgLifespan} yrs` : "—"}
                    </p>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">ancestor longevity</p>
                  </div>
                </div>

                {/* Gender and Demographics */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-white border border-[#E7E2D6] rounded-xl p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-3">
                      Gender Distribution
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between text-[#374151] mb-1">
                          <span>Male</span>
                          <span className="font-semibold">{maleCount}</span>
                        </div>
                        <div className="w-full bg-[#E7E2D6] rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-[#1C4B3C] h-1.5 rounded-full transition-all"
                            style={{
                              width: `${(maleCount / (totalPeople || 1)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[#374151] mb-1">
                          <span>Female</span>
                          <span className="font-semibold">{femaleCount}</span>
                        </div>
                        <div className="w-full bg-[#E7E2D6] rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-amber-600 h-1.5 rounded-full transition-all"
                            style={{
                              width: `${(femaleCount / (totalPeople || 1)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      {(otherCount > 0 || unspecifiedCount > 0) && (
                        <div>
                          <div className="flex justify-between text-[#374151] mb-1">
                            <span>Other / Unspecified</span>
                            <span className="font-semibold">
                              {otherCount + unspecifiedCount}
                            </span>
                          </div>
                          <div className="w-full bg-[#E7E2D6] rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-gray-400 h-1.5 rounded-full transition-all"
                              style={{
                                width: `${
                                  ((otherCount + unspecifiedCount) /
                                    (totalPeople || 1)) *
                                  100
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Top Surnames */}
                  <div className="bg-white border border-[#E7E2D6] rounded-xl p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-3">
                      Top Family Surnames
                    </h3>
                    {topSurnames.length === 0 ? (
                      <p className="text-xs text-[#9CA3AF] py-4 text-center">No distinct surnames identified yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {topSurnames.map((item, idx) => (
                          <div key={item.surname} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-[#FAF9F5] border border-[#E7E2D6] flex items-center justify-center text-[10px] font-semibold text-[#6B7280]">
                                {idx + 1}
                              </span>
                              <span className="font-medium text-[#1C1F1D]">{item.surname}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-[#FAF9F5] border border-[#E7E2D6] text-[11px] font-semibold text-[#1C4B3C]">
                              {item.count} {item.count === 1 ? "person" : "people"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Notable Records */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-[#FAF9F5] border border-[#E7E2D6] rounded-xl p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                        Oldest Recorded Ancestor
                      </span>
                      <p className="text-sm font-semibold text-[#1C1F1D] mt-0.5">
                        {oldestAncestor ? oldestAncestor.name : "None specified"}
                      </p>
                      {(oldestAncestor?.date_of_birth || oldestAncestor?.dob) && (
                        <p className="text-xs text-[#6B7280]">
                          Born {oldestAncestor.date_of_birth || oldestAncestor.dob}
                          {oldestAncestor.age !== undefined && ` (${oldestAncestor.age} yrs)`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#FAF9F5] border border-[#E7E2D6] rounded-xl p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                        Youngest Recorded Member
                      </span>
                      <p className="text-sm font-semibold text-[#1C1F1D] mt-0.5">
                        {youngestPerson ? youngestPerson.name : "None specified"}
                      </p>
                      {(youngestPerson?.date_of_birth || youngestPerson?.dob) && (
                        <p className="text-xs text-[#6B7280]">
                          Born {youngestPerson.date_of_birth || youngestPerson.dob}
                          {youngestPerson.age !== undefined && ` (${youngestPerson.age} yrs old)`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
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
