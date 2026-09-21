import React from "react";
import { Plus, Minus } from "lucide-react";
import TreeNode from "./TreeNode.jsx";

export const ROW_HEIGHT = 190;

export default function TreeSvgCanvas({
  scrollRef,
  containerRef,
  isPanning,
  handleCanvasMouseDown,
  handleCanvasWheel,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  layoutWidth,
  rows,
  zoom,
  size,
  lines,
  cardRefs,
  highlightId,
  pathIdSet,
  rootPersonId,
  selectedId,
  handleSelectPerson,
  collapseControls,
  toggleCollapse,
}) {
  return (
    <div
      ref={scrollRef}
      onMouseDown={handleCanvasMouseDown}
      onWheel={handleCanvasWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className={`flex-1 overflow-auto px-6 lg:px-10 py-8 bg-white touch-none ${
        isPanning ? "cursor-grabbing select-none" : "cursor-grab"
      }`}
      style={{
        backgroundImage: "radial-gradient(#DCE3E1 0.7px, transparent 0.7px)",
        backgroundSize: "16px 16px",
      }}
    >
      <div
        ref={containerRef}
        className="relative mx-auto origin-top-left"
        style={{
          minWidth: layoutWidth,
          minHeight: rows.length * ROW_HEIGHT + 32,
          transform: `scale(${zoom})`,
        }}
      >
        <svg
          className="absolute top-0 left-0 pointer-events-none overflow-visible"
          width={size.w}
          height={size.h}
          style={{ width: "100%", height: "100%" }}
        >
          {lines.map((line) =>
            line.type === "spouse" ? (
              <line
                key={line.key}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={line.onPath ? "#B8862E" : "#C9BEA8"}
                strokeWidth={line.onPath ? 3 : 2}
              />
            ) : (
              <path
                key={line.key}
                d={line.path}
                fill="none"
                stroke={line.onPath ? "#B8862E" : "#C9BEA8"}
                strokeWidth={line.onPath ? 2.5 : line.type === "family-child" ? 2 : 1.5}
              />
            )
          )}
        </svg>

        <div
          className="relative"
          style={{
            height: rows.length * ROW_HEIGHT + 32,
            minWidth: layoutWidth,
          }}
        >
          {rows.map((row, i) => (
            <div
              key={`${row.componentIndex}-${i}`}
              className="absolute left-0 right-0"
              style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
            >
              {row.people.map(({ person, x }) => (
                <div key={person.id} className="absolute top-0" style={{ left: x }}>
                  <TreeNode
                    person={person}
                    cardRef={(el) => {
                      if (cardRefs.current) cardRefs.current[person.id] = el;
                    }}
                    highlighted={highlightId === person.id}
                    onPath={pathIdSet.has(person.id)}
                    isRoot={rootPersonId === person.id}
                    isSelected={selectedId === person.id}
                    onSelect={handleSelectPerson}
                  />
                </div>
              ))}
            </div>
          ))}
          {collapseControls.map((control) => (
            <button
              key={control.key}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse(control.key);
              }}
              title={control.collapsed ? "Show this family's children" : "Hide this family's children"}
              aria-label={control.collapsed ? "Show this family's children" : "Hide this family's children"}
              className="absolute z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[#174F61] text-white shadow-md hover:bg-[#1C4B3C] focus:outline-none focus:ring-2 focus:ring-[#174F61]/40"
              style={{ left: control.x, top: control.y }}
            >
              {control.collapsed ? <Plus className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
