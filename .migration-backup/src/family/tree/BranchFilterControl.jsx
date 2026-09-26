import React from "react";
import { GitFork, ChevronDown } from "lucide-react";

export const BRANCH_MODES = [
  { id: "all", label: "Full Tree", description: "Entire family tree" },
  { id: "ancestors", label: "Ancestors Only", description: "Direct lineage parents & grandparents" },
  { id: "descendants", label: "Descendants Only", description: "Offspring and grandchildren" },
  { id: "paternal", label: "Paternal Branch", description: "Father's lineage" },
  { id: "maternal", label: "Maternal Branch", description: "Mother's lineage" },
];

export default function BranchFilterControl({
  branchMode,
  setBranchMode,
  focusPersonName,
}) {
  const current = BRANCH_MODES.find((m) => m.id === branchMode) || BRANCH_MODES[0];

  return (
    <div className="relative inline-flex items-center">
      <div className="flex items-center gap-1.5 bg-white border border-[#D9D3C3] rounded-lg px-2.5 py-1.5 text-xs text-[#374151]">
        <GitFork className="w-3.5 h-3.5 text-[#1C4B3C]" />
        <span className="text-[#6B7280]">Branch:</span>
        <select
          value={branchMode}
          onChange={(e) => setBranchMode(e.target.value)}
          className="bg-transparent font-semibold text-[#1C1F1D] focus:outline-none cursor-pointer pr-1"
          title={`Filter branch around ${focusPersonName || "selected person"}`}
        >
          {BRANCH_MODES.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
