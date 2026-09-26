import React from "react";
import { Check, GitBranch } from "lucide-react";

export const CARD_W = 144;

export default function TreeNode({
  person,
  cardRef,
  highlighted,
  onPath,
  isRoot,
  isSelected,
  onSelect,
}) {
  const borderClass = highlighted || onPath ? "border-[#D2A338]" : "border-[#1C4B3C]";
  const selectionRingClass = isSelected ? "ring-4 ring-[#174F61] ring-offset-2 ring-offset-white" : "";

  return (
    <div className="flex flex-col items-center text-center" style={{ width: CARD_W }}>
      <div
        ref={cardRef}
        data-person-id={person.id}
        onClick={() => onSelect?.(person.id)}
        className={`relative flex flex-col items-center w-[122px] min-h-[138px] mx-auto rounded-md border-[3px] bg-[#1C4B3C] px-2 py-2 text-white shadow-sm cursor-pointer transition-transform hover:-translate-y-0.5 ${borderClass} ${selectionRingClass}`}
        title="Select this person"
      >
        {isSelected && (
          <span
            title="Selected"
            className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-[#174F61] text-white flex items-center justify-center shadow ring-2 ring-white z-10"
          >
            <Check className="w-3 h-3" strokeWidth={3} />
          </span>
        )}
        <div className="relative mb-1">
          <div
            className="w-12 h-12 rounded-full bg-[#EDF4F3] border-2 border-white/70 shadow-sm flex items-center justify-center overflow-hidden"
          >
            <GitBranch className="w-5 h-5 text-[#C9BEA8]" strokeWidth={2.5} />
          </div>
          {isRoot && (
            <span
              title="This is you"
              className="absolute -bottom-1 -right-2 text-[9px] font-semibold bg-[#174F61] text-white rounded-full px-1.5 py-0.5 leading-none shadow-sm"
            >
              You
            </span>
          )}
        </div>
        <p className="text-[11px] font-semibold leading-tight truncate w-full">{person.name}</p>
        <p className="text-[9px] text-white/85 h-3.5 mt-0.5">
          {person.dob ? person.dob.slice(0, 4) : "Birth unknown"}
          {person.dod ? ` – ${person.dod.slice(0, 4)}` : ""}
        </p>
        <p className="text-[8px] text-white/75 leading-tight line-clamp-2 mt-1">{person.notes || "Family member"}</p>
      </div>

      <div className="h-6" />
    </div>
  );
}
