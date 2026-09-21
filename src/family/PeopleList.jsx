import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, GitBranch, Eye, Search, ChevronLeft, ChevronRight } from "lucide-react";
import AppHeader from "./AppHeader.jsx";
import { useFamily } from "./FamilyContext.jsx";

function relationSummary(person, getPerson) {
  const parts = [];
  if (person.parentIds.length) {
    parts.push(
      `child of ${person.parentIds.map((id) => getPerson(id)?.name).filter(Boolean).join(" & ")}`
    );
  }
  if (person.spouseIds.length) {
    parts.push(
      `married to ${person.spouseIds.map((id) => getPerson(id)?.name).filter(Boolean).join(", ")}`
    );
  }
  return parts.join(" · ");
}

export default function PeopleList() {
  const { people, deletePerson, getPerson, canEdit, myRole, activeTree } = useFamily();
  const [confirmId, setConfirmId] = useState(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 8;
  const filteredPeople = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return people;
    return people.filter((person) => {
      const details = `${person.name} ${relationSummary(person, getPerson)}`.toLowerCase();
      return details.includes(term);
    });
  }, [people, query, getPerson]);
  const pageCount = Math.max(1, Math.ceil(filteredPeople.length / perPage));
  const visiblePeople = filteredPeople.slice((page - 1) * perPage, page * perPage);

  useEffect(() => setPage(1), [query, people.length]);

  return (
    <div className="min-h-screen w-full bg-[#F7F5F0] flex flex-col">
      <AppHeader />

      <main className="flex-1 px-8 lg:px-16 py-12 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-serif font-bold text-[#1C1F1D] mb-1">People</h1>
            <p className="text-sm text-[#6B7280]">
              {people.length} {people.length === 1 ? "person" : "people"} in{" "}
              {activeTree?.name || "your tree"}.
              {myRole !== "owner" && (
                <span className="ml-2 text-xs text-amber-600 inline-flex items-center gap-0.5">
                  <Eye className="w-3 h-3" />
                  {myRole === "viewer" ? "View only" : "Editor"}
                </span>
              )}
            </p>
          </div>
          {canEdit && (
            <Link
              to="/people/new"
              className="flex items-center gap-1.5 bg-[#1C4B3C] text-white text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-[#163C30] transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add person
            </Link>
          )}
        </div>

        {people.length === 0 ? (
          <div className="border border-dashed border-[#C9BEA8] rounded-xl px-8 py-16 text-center">
            <p className="text-sm text-[#6B7280] mb-1">No family members yet.</p>
            <p className="text-xs text-[#9CA3AF] mb-6">
              {canEdit
                ? "Start with yourself or your oldest known relative."
                : "The owner hasn't added anyone yet."}
            </p>
            {canEdit && (
              <Link
                to="/people/new"
                className="inline-flex items-center gap-1.5 bg-[#1C4B3C] text-white text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-[#163C30] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add the first person
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="relative block w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people or relationships" className="w-full rounded-xl border border-[#E7E2D6] bg-white py-2 pl-9 pr-3 text-sm text-[#1C1F1D] outline-none transition focus:border-[#1C4B3C]" />
              </label>
              <Link
                to="/tree"
                className="flex items-center gap-1.5 text-sm font-medium text-[#1C4B3C] hover:underline"
              >
                <GitBranch className="w-4 h-4" />
                View generated tree
              </Link>
            </div>
            {filteredPeople.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#C9BEA8] bg-white px-6 py-12 text-center">
                <p className="text-sm font-medium text-[#374151]">No people match “{query}”.</p>
                <button type="button" onClick={() => setQuery("")} className="mt-2 text-xs font-semibold text-[#1C4B3C] hover:underline">Clear search</button>
              </div>
            ) : (
              <>
            <ul className="divide-y divide-[#E7E2D6] border border-[#E7E2D6] rounded-xl overflow-hidden bg-white">
              {visiblePeople.map((p) => (
                <li key={p.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-11 h-11 rounded-full bg-[#F0EDE3] border border-[#E7E2D6] flex items-center justify-center overflow-hidden shrink-0">
                    <GitBranch className="w-5 h-5 text-[#C9BEA8]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1C1F1D] truncate">{p.name}</p>
                    <p className="text-xs text-[#9CA3AF] leading-relaxed sm:truncate">
                      {p.dob ? `Born ${p.dob}` : "Birth date unknown"}
                      {relationSummary(p, getPerson) ? ` · ${relationSummary(p, getPerson)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {canEdit && (
                      <Link
                        to={`/people/${p.id}/edit`}
                        className="text-[#6B7280] hover:text-[#1C4B3C]"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                    )}
                    {canEdit && (
                      confirmId === p.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              deletePerson(p.id);
                              setConfirmId(null);
                            }}
                            className="text-xs font-medium text-[#B3441C]"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="text-xs text-[#9CA3AF]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmId(p.id)}
                          className="text-[#6B7280] hover:text-[#B3441C]"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[#6B7280]">
              <p>Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, filteredPeople.length)} of {filteredPeople.length} people</p>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded-lg border border-[#E7E2D6] p-1.5 disabled:opacity-35"><ChevronLeft className="h-4 w-4" /></button>
                <span className="min-w-14 text-center">Page {page} / {pageCount}</span>
                <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount} className="rounded-lg border border-[#E7E2D6] p-1.5 disabled:opacity-35"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
