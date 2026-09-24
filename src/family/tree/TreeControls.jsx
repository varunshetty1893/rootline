import React from "react";
import {
  Search,
  LocateFixed,
  Focus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Printer,
  ChevronsDownUp,
  ChevronsUpDown,
  Sparkles,
  Share2,
  Save,
  History,
  CheckCircle2,
  Users,
} from "lucide-react";
import BranchFilterControl from "./BranchFilterControl.jsx";

function formatSavedTime(dateString) {
  if (!dateString) return null;
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export default function TreeControls({
  query,
  setQuery,
  onSearch,
  rootPersonId,
  selectedId,
  selectedPersonName,
  onGoToRoot,
  focusedView,
  setFocusedView,
  branchMode,
  setBranchMode,
  zoom,
  zoomIn,
  zoomOut,
  fitToScreen,
  centerPerson,
  toggleFullscreen,
  expandAll,
  collapseAll,
  onOpenKinship,
  onOpenShare,
  onSaveTree,
  isSaving,
  lastSavedAt,
  hasUnsavedChanges,
  onOpenHistory,
  treeName,
  isShared,
  ownerName,
  canEdit = true,
}) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap px-6 lg:px-10 py-3.5 border-b border-[#E7E2D6] bg-white shadow-xs">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-serif font-bold text-[#1C1F1D]">
            {treeName || "Your family tree"}
          </h1>
          {isShared && (
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Users className="w-3 h-3" />
              Shared by {ownerName || "Collaborator"}
            </span>
          )}
        </div>
        <p className="text-xs text-[#6B7280]">
          Interactive family tree with collaborative edits, manual save checkpoints, and revision restore.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Save Tree Button */}
        {onSaveTree && (
          <div className="flex items-center gap-1.5 mr-1">
            <button
              type="button"
              onClick={onSaveTree}
              disabled={isSaving || !canEdit}
              className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3.5 py-1.5 transition-all shadow-sm ${
                isSaving
                  ? "bg-[#1C4B3C]/70 text-white cursor-wait"
                  : hasUnsavedChanges
                  ? "bg-amber-600 hover:bg-amber-700 text-white ring-2 ring-amber-300"
                  : "bg-[#1C4B3C] hover:bg-[#163C30] text-white"
              } disabled:opacity-50`}
              title="Save tree snapshot and commit revisions"
            >
              {isSaving ? (
                <>
                  <Save className="w-3.5 h-3.5 animate-spin" />
                  Saving…
                </>
              ) : hasUnsavedChanges ? (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Tree
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Tree
                </>
              )}
            </button>
            {lastSavedAt && (
              <span
                className="hidden md:inline-flex items-center gap-1 text-[11px] text-[#6B7280]"
                title={`Last saved: ${new Date(lastSavedAt).toLocaleTimeString()}`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Saved {formatSavedTime(lastSavedAt)}
              </span>
            )}
          </div>
        )}

        {/* History & Restore Button */}
        {onOpenHistory && (
          <button
            type="button"
            onClick={onOpenHistory}
            title="Inspect edit history and restore previous versions"
            className="flex items-center gap-1.5 text-xs font-semibold text-[#1C4B3C] border border-[#1C4B3C]/30 bg-emerald-50/40 hover:bg-emerald-100/60 rounded-lg px-3 py-1.5 transition-colors shadow-xs"
          >
            <History className="w-3.5 h-3.5 text-[#1C4B3C]" />
            <span>History & Restore</span>
          </button>
        )}

        <span className="w-px h-5 bg-[#D9D3C3]" />

        <form onSubmit={onSearch} className="relative">
          <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search person…"
            className="text-xs rounded-lg border border-[#D9D3C3] bg-white pl-8 pr-2.5 py-1.5 w-36 focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 focus:border-[#1C4B3C]"
          />
        </form>

        {/* Branch Mode Filter */}
        <BranchFilterControl
          branchMode={branchMode}
          setBranchMode={setBranchMode}
          focusPersonName={selectedPersonName}
        />

        {rootPersonId && selectedId !== rootPersonId && (
          <>
            <button
              type="button"
              onClick={onGoToRoot}
              title="Go back to my family"
              className="flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 bg-[#1C4B3C] text-white hover:bg-[#163C30] shadow-sm"
            >
              <LocateFixed className="w-3.5 h-3.5" />
              My family
            </button>
            <span className="w-px h-5 bg-[#D9D3C3]" />
          </>
        )}

        <button
          type="button"
          onClick={() => setFocusedView((v) => !v)}
          title={focusedView ? "Show the complete tree" : "Show the selected person's nearby family"}
          className={`flex items-center gap-1 text-xs border rounded-lg px-2.5 py-1.5 ${
            focusedView
              ? "border-[#1C4B3C] bg-[#E7F1EB] text-[#1C4B3C]"
              : "border-[#D9D3C3] bg-white text-[#374151] hover:bg-[#F0EDE3]"
          }`}
        >
          <Focus className="w-3.5 h-3.5" />
          {focusedView ? "Nearby family" : "Full tree"}
        </button>

        {/* Kinship / AI Explorer */}
        {onOpenKinship && (
          <button
            type="button"
            onClick={onOpenKinship}
            title="How Are We Related? (Kinship pathfinder & AI explanation)"
            className="flex items-center gap-1 text-xs text-[#1C4B3C] border border-[#1C4B3C]/30 rounded-lg px-2.5 py-1.5 bg-emerald-50/50 hover:bg-emerald-100/50 transition-colors font-medium"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Related?</span>
          </button>
        )}

        {/* Share Button */}
        {onOpenShare && (
          <button
            type="button"
            onClick={onOpenShare}
            title="Share Family Tree Link"
            className="flex items-center gap-1 text-xs text-[#374151] border border-[#D9D3C3] rounded-lg px-2.5 py-1.5 bg-white hover:bg-[#F0EDE3] transition-colors"
          >
            <Share2 className="w-3.5 h-3.5 text-[#1C4B3C]" />
            <span className="hidden sm:inline">Share</span>
          </button>
        )}

        <div className="flex items-center border border-[#D9D3C3] rounded-lg overflow-hidden bg-white">
          <button
            type="button"
            onClick={zoomOut}
            title="Zoom out"
            className="p-1.5 hover:bg-[#F0EDE3] text-[#374151]"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-[#6B7280] w-9 text-center select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={zoomIn}
            title="Zoom in"
            className="p-1.5 hover:bg-[#F0EDE3] text-[#374151]"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={fitToScreen}
          title="Fit to screen"
          className="flex items-center gap-1 text-xs text-[#374151] border border-[#D9D3C3] rounded-lg px-2.5 py-1.5 bg-white hover:bg-[#F0EDE3]"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          Fit
        </button>

        <button
          type="button"
          onClick={() => centerPerson(selectedId || rootPersonId)}
          title="Centre selected person"
          className="p-1.5 text-[#374151] border border-[#D9D3C3] rounded-lg bg-white hover:bg-[#F0EDE3]"
        >
          <LocateFixed className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          title="Fullscreen canvas"
          className="p-1.5 text-[#374151] border border-[#D9D3C3] rounded-lg bg-white hover:bg-[#F0EDE3]"
        >
          <Focus className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          title="Print this family tree"
          className="flex items-center gap-1 text-xs text-[#374151] border border-[#D9D3C3] rounded-lg px-2.5 py-1.5 bg-white hover:bg-[#F0EDE3]"
        >
          <Printer className="w-3.5 h-3.5" />
          Print
        </button>

        <div className="flex items-center border border-[#D9D3C3] rounded-lg overflow-hidden bg-white">
          <button
            type="button"
            onClick={expandAll}
            title="Expand all branches"
            className="flex items-center gap-1 text-xs text-[#374151] px-2 py-1.5 hover:bg-[#F0EDE3] border-r border-[#D9D3C3]"
          >
            <ChevronsUpDown className="w-3 h-3" />
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            title="Collapse branches with children"
            className="flex items-center gap-1 text-xs text-[#374151] px-2 py-1.5 hover:bg-[#F0EDE3]"
          >
            <ChevronsDownUp className="w-3 h-3" />
            Collapse
          </button>
        </div>
      </div>
    </div>
  );
}
