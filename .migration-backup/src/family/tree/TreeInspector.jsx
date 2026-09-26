import React from "react";
import { Link } from "react-router-dom";
import { User, Pencil, Focus, Check, Trash2, Bot } from "lucide-react";

export default function TreeInspector({
  selectedPerson,
  rootPersonId,
  setRootPersonId,
  openQuickAdd,
  onDeleteSelected,
  onOpenChatbot,
  inspectorTab = "personal",
  setInspectorTab,
}) {
  return (
    <aside className="w-full lg:w-[330px] shrink-0 border-b lg:border-b-0 lg:border-r border-[#DCE3E1] bg-white shadow-sm z-10">
      <div className="lg:sticky lg:top-0 lg:h-[calc(100vh-69px)] lg:overflow-y-auto">
        <div className="flex border-b border-[#DCE3E1] px-5 gap-6">
          {[["personal", "Personal"]].map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setInspectorTab?.(tab)}
              className={`py-4 text-xs font-semibold uppercase tracking-wide border-b-2 -mb-px ${
                inspectorTab === tab
                  ? "border-[#1C4B3C] text-[#1C4B3C]"
                  : "border-transparent text-[#7B8794] hover:text-[#1C4B3C]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {selectedPerson ? (
          <div className="p-5">
            {inspectorTab === "personal" && (
              <>
                <div className="border border-[#DCE3E1] rounded-lg overflow-hidden mb-5">
                  {[
                    ["Person’s name", selectedPerson.name],
                    [
                      "Gender",
                      selectedPerson.gender
                        ? selectedPerson.gender[0].toUpperCase() + selectedPerson.gender.slice(1)
                        : "Not recorded",
                    ],
                    ["Date of birth", selectedPerson.dob || "Not recorded"],
                    ["Date of death", selectedPerson.dod || "—"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex justify-between gap-3 px-3 py-2.5 border-b last:border-b-0 border-[#DCE3E1] text-sm"
                    >
                      <span className="text-[#374151]">{label}</span>
                      <span className="text-[#5A6980] text-right truncate">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/people/${selectedPerson.id}`}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-[#DCE3E1] bg-white text-[#1C4B3C] text-sm font-medium py-2 shadow-sm hover:bg-[#F3F0E8]"
                  >
                    <User className="w-4 h-4" /> Profile
                  </Link>
                  <Link
                    to={`/people/${selectedPerson.id}/edit`}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-[#1C4B3C] text-white text-sm font-medium py-2 shadow-sm hover:bg-[#163C30]"
                  >
                    <Pencil className="w-4 h-4" /> Edit
                  </Link>
                </div>

                <div className="mt-3">
                  {selectedPerson.id === rootPersonId ? (
                    <div className="flex items-center justify-center gap-1.5 w-full rounded-md bg-[#174F61]/10 text-[#174F61] text-xs font-semibold py-2 px-3">
                      <Check className="w-3.5 h-3.5" /> Set as &quot;You&quot; (Tree Root)
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRootPersonId(selectedPerson.id)}
                      className="flex items-center justify-center gap-1.5 w-full rounded-md border border-[#174F61]/30 bg-white text-[#174F61] hover:bg-[#174F61]/5 text-xs font-semibold py-2 px-3 transition-colors shadow-sm"
                      title="Set this person as &quot;You&quot; to calculate all tree relationships from their perspective"
                    >
                      <Focus className="w-3.5 h-3.5" /> Set as &quot;You&quot; (Tree Root)
                    </button>
                  )}
                </div>

                {onOpenChatbot && (
                  <button
                    type="button"
                    onClick={onOpenChatbot}
                    className="mt-2.5 flex items-center justify-center gap-1.5 w-full rounded-md bg-[#FAF9F5] border border-[#D9D3C3] text-[#1C4B3C] hover:bg-[#E7F1EB] text-xs font-semibold py-2 px-3 transition-colors shadow-2xs"
                    title="Ask Kinship AI to explain how this person is related to anyone in the family"
                  >
                    <Bot className="w-3.5 h-3.5 text-[#1C4B3C]" /> Ask Kinship AI
                  </button>
                )}
              </>
            )}

            <div className="border-t border-[#DCE3E1] mt-5 pt-5 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7B8794] mb-3">
                Build this branch
              </p>
              <button
                type="button"
                onClick={() => openQuickAdd("parent")}
                className="w-full rounded-md bg-[#D7E7DF] text-[#1C4B3C] text-sm font-medium py-2.5 hover:bg-[#C5DDD2]"
              >
                Add parent
              </button>
              <button
                type="button"
                onClick={() => openQuickAdd("sibling")}
                className="w-full rounded-md bg-[#1C4B3C] text-white text-sm font-medium py-2.5 hover:bg-[#163C30]"
              >
                Add sibling
              </button>
              <button
                type="button"
                onClick={() => openQuickAdd("spouse")}
                className="w-full rounded-md bg-[#1C4B3C] text-white text-sm font-medium py-2.5 hover:bg-[#163C30]"
              >
                Add partner
              </button>
              <button
                type="button"
                onClick={() => openQuickAdd("child")}
                className="w-full rounded-md bg-[#1C4B3C] text-white text-sm font-medium py-2.5 hover:bg-[#163C30]"
              >
                Add child
              </button>
            </div>

            <div className="border-t border-[#DCE3E1] mt-5 pt-4">
              <button
                type="button"
                onClick={onDeleteSelected}
                className="flex items-center justify-center gap-1.5 w-full text-xs font-medium text-[#A65035] border border-[#E7C4B8] rounded-md py-2 hover:bg-[#FBEAE1]"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete person
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <User className="w-8 h-8 text-[#C9BEA8] mx-auto mb-3" />
            <p className="text-sm text-[#5A6980]">
              Select someone in the tree to view and build their family branch.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
