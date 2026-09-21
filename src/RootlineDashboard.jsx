import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Users, GitBranch as TreeIcon, Share2, Eye, Pencil, Sparkles } from "lucide-react";
import AppHeader from "./family/AppHeader.jsx";
import { useFamily } from "./family/FamilyContext.jsx";
import { useAuth } from "./AuthContext.jsx";
import ShareModal from "./family/ShareModal.jsx";
import RelationshipChat from "./family/RelationshipChat.jsx";

export default function RootlineDashboard() {
  const { user } = useAuth();
  const {
    people,
    rootPersonId,
    activeTree,
    activeTreeId,
    setActiveTreeId,
    treeList = { owned_trees: [], shared_trees: [] },
    myRole,
    canEdit,
    canManage,
  } = useFamily();

  const [shareOpen, setShareOpen] = useState(false);
  const [guideOpenSignal, setGuideOpenSignal] = useState(0);

  const generationsCount =
    people.length === 0
      ? 0
      : new Set(
          (() => {
            // Issue #33: Pre-index children by parent to avoid O(N^2) array scans
            const childrenByParent = new Map();
            for (const p of people) {
              for (const parentId of p.parentIds || []) {
                if (!childrenByParent.has(parentId)) {
                  childrenByParent.set(parentId, []);
                }
                childrenByParent.get(parentId).push(p.id);
              }
            }

            const genMap = {};
            const roots = people.filter((p) => (p.parentIds || []).length === 0);
            const queue = roots.map((r) => ({ id: r.id, gen: 0 }));
            const visited = new Set();
            while (queue.length) {
              const { id, gen } = queue.shift();
              if (visited.has(id)) continue;
              visited.add(id);
              genMap[id] = gen;
              const kids = childrenByParent.get(id) || [];
              for (const kidId of kids) {
                queue.push({ id: kidId, gen: gen + 1 });
              }
            }
            return Object.values(genMap);
          })()
        ).size;

  const sharedTrees = treeList.shared_trees || [];

  return (
    <div className="min-h-screen w-full bg-[#F7F5F0] flex flex-col">
      <AppHeader />

      <main className="flex-1 px-8 lg:px-16 py-16 max-w-4xl mx-auto w-full">
        {/* Greeting */}
        <div className="flex items-start justify-between mb-2 gap-4 flex-wrap">
          <h1 className="text-3xl font-serif font-bold text-[#1C1F1D]">
            Welcome{user?.name ? `, ${user.name}` : ""}.
          </h1>
          {canManage && activeTree && (
            <button
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-[#1C4B3C] border border-[#1C4B3C]/30 rounded-lg px-3 py-1.5 hover:bg-[#1C4B3C]/5 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Share tree
            </button>
          )}
        </div>

        {/* Active tree context */}
        <p className="text-sm text-[#6B7280] mb-1">
          {user?.email}
          {activeTree && (
            <>
              {" · "}
              <span className="font-medium text-[#374151]">{activeTree.name}</span>
            </>
          )}
        </p>
        {myRole !== "owner" && (
          <p className="text-xs text-amber-600 mb-1 flex items-center gap-1">
            {myRole === "viewer" ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <Pencil className="w-3.5 h-3.5" />
            )}
            You have <span className="font-medium capitalize">{myRole}</span> access to this tree.
            {myRole === "viewer" && " Changes are disabled."}
          </p>
        )}
        <p className="text-xs text-[#9CA3AF] mb-10">your family tree starts here.</p>

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-white border border-[#E7E2D6] rounded-xl px-5 py-5">
            <p className="text-2xl font-serif font-bold text-[#1C1F1D]">{people.length}</p>
            <p className="text-xs text-[#9CA3AF] mt-1">
              {people.length === 1 ? "person" : "people"} added
            </p>
          </div>
          <div className="bg-white border border-[#E7E2D6] rounded-xl px-5 py-5">
            <p className="text-2xl font-serif font-bold text-[#1C1F1D]">{generationsCount || "—"}</p>
            <p className="text-xs text-[#9CA3AF] mt-1">generations mapped</p>
          </div>
          <div className="bg-white border border-[#E7E2D6] rounded-xl px-5 py-5">
            <p className="text-2xl font-serif font-bold text-[#1C1F1D]">
              {Math.floor(people.filter((p) => p.spouseIds.length > 0).length / 2)}
            </p>
            <p className="text-xs text-[#9CA3AF] mt-1">couples linked</p>
          </div>
        </div>

        {/* Quick actions */}
        {people.length === 0 ? (
          <div className="border border-dashed border-[#C9BEA8] rounded-xl px-8 py-14 text-center">
            <p className="text-sm text-[#6B7280] mb-1">No family members added yet.</p>
            <p className="text-xs text-[#9CA3AF] mb-6">
              {canEdit
                ? "Add your first person to start building the tree."
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              to="/people"
              className="flex items-center gap-4 bg-white border border-[#E7E2D6] rounded-xl px-6 py-6 hover:border-[#1C4B3C]/40 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-[#1C4B3C]/10 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-[#1C4B3C]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#1C1F1D]">
                  {canEdit ? "Manage people" : "View people"}
                </p>
                <p className="text-xs text-[#9CA3AF]">
                  {canEdit ? "View, edit, or add family members" : "Browse family members"}
                </p>
              </div>
            </Link>
            <Link
              to="/tree"
              className="flex items-center gap-4 bg-white border border-[#E7E2D6] rounded-xl px-6 py-6 hover:border-[#1C4B3C]/40 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-[#1C4B3C]/10 flex items-center justify-center shrink-0">
                <TreeIcon className="w-5 h-5 text-[#1C4B3C]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#1C1F1D]">View the tree</p>
                <p className="text-xs text-[#9CA3AF]">See the generated family tree</p>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => setGuideOpenSignal((value) => value + 1)}
              className="flex items-center gap-4 bg-[#1C4B3C] border border-[#1C4B3C] rounded-xl px-6 py-6 text-white hover:bg-[#163C30] transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-[#F4D59A]" />
              </div>
              <div>
                <p className="text-sm font-medium">Ask the family guide</p>
                <p className="text-xs text-white/70">Understand relationships in your tree</p>
              </div>
            </button>
          </div>
        )}

        {/* ── Shared Trees Section ── */}
        {sharedTrees.length > 0 && (
          <div className="mt-12">
            <h2 className="text-sm font-semibold text-[#374151] mb-3 uppercase tracking-wide">
              Shared with me
            </h2>
            <ul className="space-y-2">
              {sharedTrees.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => setActiveTreeId(t.id)}
                    className={`w-full text-left flex items-center gap-4 bg-white border rounded-xl px-5 py-4 transition-colors hover:border-[#1C4B3C]/40 ${
                      activeTreeId === t.id
                        ? "border-[#1C4B3C]/50"
                        : "border-[#E7E2D6]"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-[#E7E2D6] flex items-center justify-center shrink-0">
                      <TreeIcon className="w-4 h-4 text-[#9CA3AF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1C1F1D] truncate">{t.name}</p>
                      <p className="text-xs text-[#9CA3AF]">
                        by {t.owner_name} · {t.people_count}{" "}
                        {t.people_count === 1 ? "person" : "people"}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] font-medium rounded-full px-2 py-0.5 shrink-0 ${
                        t.role === "editor"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {t.role === "editor" ? "Editor" : "Viewer"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>

      {/* Share Modal */}
      {shareOpen && activeTree && (
        <ShareModal
          treeId={activeTree.id}
          treeName={activeTree.name}
          onClose={() => setShareOpen(false)}
        />
      )}
      <RelationshipChat people={people} rootPersonId={rootPersonId} openSignal={guideOpenSignal} />
    </div>
  );
}
