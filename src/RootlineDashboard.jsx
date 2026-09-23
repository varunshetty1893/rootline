import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Users,
  GitBranch as TreeIcon,
  Share2,
  Eye,
  Pencil,
  Sparkles,
  Search,
  ChevronRight,
  Shield,
  UserCheck,
  UserPlus,
  Calendar,
  Layers,
  Heart,
  ArrowRight,
  CheckCircle2,
  Clock,
  Settings2,
} from "lucide-react";
import AppHeader from "./family/AppHeader.jsx";
import { useFamily } from "./family/FamilyContext.jsx";
import { useAuth } from "./AuthContext.jsx";
import ShareModal from "./family/ShareModal.jsx";
import RelationshipChat from "./family/RelationshipChat.jsx";

export default function RootlineDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [searchQuery, setSearchQuery] = useState("");

  const sharedTrees = treeList?.shared_trees || [];
  const ownedTrees = useMemo(() => {
    return (treeList?.owned_trees || []).filter((t) => {
      if (!t || !t.id) return false;
      if (t.role === "viewer" || t.role === "editor" || t.isOwned === false) return false;
      if (t.owner_id && user?.id && t.owner_id !== user.id) return false;
      return Boolean(user?.id && (t.owner_id === user.id || (t.id === user.id && (!t.owner_id || t.owner_id === user.id))));
    });
  }, [treeList?.owned_trees, user?.id]);

  const allSharedTrees = useMemo(() => {
    const fromShared = treeList?.shared_trees || [];
    const misplaced = (treeList?.owned_trees || []).filter(
      (t) => t && (t.role === "viewer" || t.role === "editor" || t.isOwned === false || (t.owner_id && user?.id && t.owner_id !== user.id))
    );
    const combined = [...fromShared, ...misplaced];
    const seen = new Set();
    return combined.filter((t) => {
      if (!t || !t.id || seen.has(t.id)) return false;
      seen.add(t.id);
      return !user?.id || t.owner_id !== user.id;
    });
  }, [treeList, user?.id]);

  // Unified list of all trees available to this user
  const allTrees = useMemo(() => {
    const list = [
      ...ownedTrees.map((t) => ({ ...t, role: "owner", isOwned: true, owner_id: user?.id || t.owner_id })),
      ...allSharedTrees.map((t) => ({
        ...t,
        isOwned: false,
        role: t.role && t.role !== "owner" ? t.role : "viewer",
      })),
    ];
    if (activeTree && !list.some((t) => t.id === activeTree.id)) {
      const isExplicitCollaborator = activeTree.role === "viewer" || activeTree.role === "editor" || activeTree.isOwned === false;
      const hasDifferentOwner = Boolean(activeTree.owner_id && user?.id && activeTree.owner_id !== user.id);
      const isOwned = !isExplicitCollaborator && !hasDifferentOwner && Boolean(user?.id && (activeTree.id === user.id || activeTree.owner_id === user.id));

      list.push({
        id: activeTree.id,
        name: activeTree.name || (isOwned ? `${user?.name || "My"}'s Family Tree` : "Family Tree"),
        owner_id: isOwned ? user?.id : activeTree.owner_id,
        owner_name: isOwned ? (user?.name || "You") : (activeTree.owner_name || "Tree Owner"),
        role: isOwned ? "owner" : (activeTree.role || myRole || "viewer"),
        isOwned,
        people_count: activeTree.people_count ?? people?.length ?? 0,
      });
    }
    return list;
  }, [ownedTrees, allSharedTrees, activeTree, myRole, user?.id, user?.name, people?.length]);

  // Calculate generational hierarchy safely
  const generationsCount = useMemo(() => {
    if (people.length === 0) return 0;
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
    return new Set(Object.values(genMap)).size;
  }, [people]);

  // Statistics
  const malesCount = useMemo(() => people.filter((p) => p.gender === "male").length, [people]);
  const femalesCount = useMemo(() => people.filter((p) => p.gender === "female").length, [people]);
  const couplesCount = useMemo(
    () => Math.floor(people.filter((p) => (p.spouseIds || []).length > 0).length / 2),
    [people]
  );
  const withDatesCount = useMemo(() => people.filter((p) => Boolean(p.dob)).length, [people]);

  // Quick filter for relative search
  const filteredPeople = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return people.filter((p) => {
      const nameMatch = (p.name || "").toLowerCase().includes(q);
      const placeMatch = (p.place_of_birth || "").toLowerCase().includes(q);
      const occMatch = (p.occupation || "").toLowerCase().includes(q);
      return nameMatch || placeMatch || occMatch;
    });
  }, [people, searchQuery]);

  return (
    <div className="min-h-screen w-full bg-[#F7F5F0] flex flex-col text-[#1C1F1D]">
      <AppHeader />

      <main className="flex-1 px-4 sm:px-8 lg:px-12 py-8 max-w-6xl mx-auto w-full space-y-8">
        {/* ── Top Hero Card ── */}
        <section className="bg-white border border-[#E7E2D6] rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1C4B3C] bg-[#1C4B3C]/10 px-2.5 py-0.5 rounded-full">
                  Genealogy Overview
                </span>
                {activeTree && (
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1 ${
                      myRole === "owner"
                        ? "bg-[#1C4B3C]/10 text-[#1C4B3C]"
                        : myRole === "editor"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {myRole === "owner" ? (
                      <Shield className="w-3 h-3" />
                    ) : myRole === "editor" ? (
                      <Pencil className="w-3 h-3" />
                    ) : (
                      <Eye className="w-3 h-3" />
                    )}
                    <span className="capitalize">{myRole} Access</span>
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-[#1C1F1D] tracking-tight">
                Welcome{user?.name ? `, ${user.name}` : ""}.
              </h1>
              <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
                {user?.email}
                {activeTree && (
                  <>
                    {" · "}
                    <span className="font-semibold text-[#1C1F1D]">{activeTree.name}</span>
                    {activeTree.owner_name && myRole !== "owner" && (
                      <span className="text-[#9CA3AF]"> (shared by {activeTree.owner_name})</span>
                    )}
                  </>
                )}
              </p>
            </div>

            {/* Quick Action Buttons in Hero */}
            <div className="flex items-center gap-3 flex-wrap">
              <Link
                to="/tree"
                className="inline-flex items-center gap-2 bg-[#1C4B3C] hover:bg-[#163C30] text-white text-xs sm:text-sm font-semibold rounded-xl px-4 py-2.5 shadow-2xs transition-all hover:shadow-sm"
              >
                <TreeIcon className="w-4 h-4" />
                <span>Explore Tree</span>
              </Link>

              {canEdit && (
                <Link
                  to="/people/new"
                  className="inline-flex items-center gap-1.5 bg-[#FAF8F4] hover:bg-[#F0EBE1] text-[#1C1F1D] border border-[#E7E2D6] text-xs sm:text-sm font-medium rounded-xl px-3.5 py-2.5 transition-colors"
                >
                  <Plus className="w-4 h-4 text-[#1C4B3C]" />
                  <span>Add Person</span>
                </Link>
              )}

              {canManage && activeTree && (
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="inline-flex items-center gap-1.5 bg-[#FAF8F4] hover:bg-[#F0EBE1] text-[#1C4B3C] border border-[#1C4B3C]/30 text-xs sm:text-sm font-medium rounded-xl px-3.5 py-2.5 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share Tree</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Tree Switcher Pill Bar (if multiple trees exist) */}
          {allTrees.length > 1 && (
            <div className="mt-6 pt-5 border-t border-[#E7E2D6] flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-[#6B7280] font-medium shrink-0 flex items-center gap-1 mr-1">
                <Settings2 className="w-3.5 h-3.5 text-[#1C4B3C]" />
                <span>Switch tree:</span>
              </span>
              {allTrees.map((t) => {
                const isSelected = (activeTreeId || activeTree?.id) === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTreeId(t.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 ${
                      isSelected
                        ? "bg-[#1C4B3C] text-white shadow-2xs font-semibold"
                        : "bg-[#F7F5F0] text-[#4B5563] hover:text-[#1C1F1D] hover:bg-[#EAE6DD]"
                    }`}
                  >
                    <TreeIcon className="w-3 h-3 opacity-80" />
                    <span className="truncate max-w-[150px]">{t.name}</span>
                    <span className="text-[10px] opacity-75">
                      ({t.people_count || 0})
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Viewer notice banner */}
          {myRole === "viewer" && (
            <div className="mt-6 p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  You have <strong>Viewer</strong> access to this tree. You can inspect lineages, search relatives, and ask the AI guide. Modifications are reserved for the owner and editors.
                </span>
              </div>
              <Link
                to="/shared-trees"
                className="text-amber-800 hover:text-amber-950 font-semibold underline shrink-0"
              >
                Tree Details
              </Link>
            </div>
          )}
        </section>

        {/* ── Empty Tree Starter Prompt Banner ── */}
        {people.length === 0 && (
          <section className="bg-white border-2 border-dashed border-[#1C4B3C]/30 rounded-3xl p-6 sm:p-8 text-center shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-[#E7F1EB] text-[#1C4B3C] flex items-center justify-center mx-auto mb-3">
              <UserPlus className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-serif font-bold text-[#1C1F1D] mb-1">
              Start Your Family Tree
            </h2>
            <p className="text-xs sm:text-sm text-[#6B7280] max-w-md mx-auto mb-5 leading-relaxed">
              Nothing to see in this tree yet! Add yourself as the first person (Tree Starter) or create a new family branch to begin mapping your lineage.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/people/new"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#1C4B3C] hover:bg-[#163C30] text-white text-xs sm:text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add First Person ({user?.name || "You"})</span>
              </Link>
              <Link
                to="/shared-trees"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-[#FAF8F4] border border-[#D9D3C3] text-[#1C1F1D] text-xs sm:text-sm font-semibold rounded-xl px-4 py-2.5 transition-all"
              >
                <Plus className="w-4 h-4 text-[#1C4B3C]" />
                <span>Create New Tree</span>
              </Link>
            </div>
          </section>
        )}

        {/* ── 4 Key Statistics Cards ── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E7E2D6] rounded-2xl p-5 shadow-2xs">
            <div className="flex items-center justify-between text-[#1C4B3C] mb-2">
              <span className="text-xs font-semibold text-[#6B7280]">Total Family</span>
              <Users className="w-4 h-4" />
            </div>
            <p className="text-3xl font-serif font-bold text-[#1C1F1D]">{people.length}</p>
            <p className="text-xs text-[#9CA3AF] mt-1">
              {people.length === 1 ? "person added" : "people added"}
              {people.length > 0 && ` (${malesCount}M · ${femalesCount}F)`}
            </p>
          </div>

          <div className="bg-white border border-[#E7E2D6] rounded-2xl p-5 shadow-2xs">
            <div className="flex items-center justify-between text-[#1C4B3C] mb-2">
              <span className="text-xs font-semibold text-[#6B7280]">Generations</span>
              <Layers className="w-4 h-4" />
            </div>
            <p className="text-3xl font-serif font-bold text-[#1C1F1D]">{generationsCount || "—"}</p>
            <p className="text-xs text-[#9CA3AF] mt-1">generations mapped</p>
          </div>

          <div className="bg-white border border-[#E7E2D6] rounded-2xl p-5 shadow-2xs">
            <div className="flex items-center justify-between text-[#1C4B3C] mb-2">
              <span className="text-xs font-semibold text-[#6B7280]">Partnerships</span>
              <Heart className="w-4 h-4" />
            </div>
            <p className="text-3xl font-serif font-bold text-[#1C1F1D]">{couplesCount}</p>
            <p className="text-xs text-[#9CA3AF] mt-1">couples linked</p>
          </div>

          <div className="bg-white border border-[#E7E2D6] rounded-2xl p-5 shadow-2xs">
            <div className="flex items-center justify-between text-[#1C4B3C] mb-2">
              <span className="text-xs font-semibold text-[#6B7280]">Documented</span>
              <Calendar className="w-4 h-4" />
            </div>
            <p className="text-3xl font-serif font-bold text-[#1C1F1D]">{withDatesCount}</p>
            <p className="text-xs text-[#9CA3AF] mt-1">with birth dates recorded</p>
          </div>
        </section>

        {/* ── Relative Search Bar ── */}
        {people.length > 0 && (
          <section className="bg-white border border-[#E7E2D6] rounded-2xl p-4 shadow-2xs">
            <div className="relative">
              <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Quick search relatives by name, birth place, or notes..."
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-[#FAF8F4] border border-[#E7E2D6] rounded-xl focus:outline-none focus:border-[#1C4B3C] transition-all"
              />
            </div>

            {searchQuery.trim() && (
              <div className="mt-3 divide-y divide-[#E7E2D6]/60 max-h-60 overflow-y-auto">
                {filteredPeople.length === 0 ? (
                  <p className="text-xs text-[#6B7280] py-3 text-center">
                    No relatives found matching &quot;{searchQuery}&quot;.
                  </p>
                ) : (
                  filteredPeople.map((person) => (
                    <div
                      key={person.id}
                      className="py-2.5 flex items-center justify-between gap-3 hover:bg-[#FAF8F4] px-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#1C4B3C]/10 text-[#1C4B3C] font-semibold text-xs flex items-center justify-center">
                          {person.name?.[0] || "?"}
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm font-semibold text-[#1C1F1D]">{person.name}</p>
                          <p className="text-[11px] text-[#6B7280]">
                            {person.dob ? `b. ${person.dob}` : "Date unknown"}
                            {person.place_of_birth ? ` · ${person.place_of_birth}` : ""}
                          </p>
                        </div>
                      </div>
                      <Link
                        to={`/people/${person.id}`}
                        className="text-xs font-semibold text-[#1C4B3C] hover:underline flex items-center gap-1"
                      >
                        <span>Profile</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Main Navigation & Workspaces ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-serif font-bold text-[#1C1F1D]">Tree Workspaces</h2>
            <span className="text-xs text-[#6B7280]">Access primary navigation hubs</span>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Visual Tree Canvas */}
            <Link
              to="/tree"
              className="bg-white border border-[#E7E2D6] rounded-2xl p-5 hover:border-[#1C4B3C] hover:shadow-sm transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#1C4B3C]/10 text-[#1C4B3C] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <TreeIcon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-[#1C1F1D] group-hover:text-[#1C4B3C] transition-colors">
                  Interactive Visual Tree
                </h3>
                <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
                  Navigate ancestral lines and descendant branches in real-time.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#E7E2D6]/60 flex items-center justify-between text-xs font-semibold text-[#1C4B3C]">
                <span>Launch Canvas</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>

            {/* 2. Directory & Profiles */}
            <Link
              to="/people"
              className="bg-white border border-[#E7E2D6] rounded-2xl p-5 hover:border-[#1C4B3C] hover:shadow-sm transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#1C4B3C]/10 text-[#1C4B3C] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-[#1C1F1D] group-hover:text-[#1C4B3C] transition-colors">
                  {canEdit ? "Manage Relatives" : "Family Member Directory"}
                </h3>
                <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
                  {canEdit
                    ? "Add, edit, or search relatives, birth dates, and occupations."
                    : "Browse member profiles, biographies, and relations."}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#E7E2D6]/60 flex items-center justify-between text-xs font-semibold text-[#1C4B3C]">
                <span>Browse {people.length} Members</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>

            {/* 3. AI Kinship Guide */}
            <button
              type="button"
              onClick={() => setGuideOpenSignal((val) => val + 1)}
              className="bg-[#1C4B3C] text-white rounded-2xl p-5 hover:bg-[#163C30] hover:shadow-md transition-all text-left flex flex-col justify-between group"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-white/15 text-[#F4D59A] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-white">
                  Ask the Family Guide
                </h3>
                <p className="text-xs text-white/80 mt-1 leading-relaxed">
                  Calculate relationships and discover how any two people are connected.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-xs font-semibold text-[#F4D59A]">
                <span>Open Assistant</span>
                <Sparkles className="w-4 h-4" />
              </div>
            </button>

            {/* 4. Shared Trees Hub */}
            <Link
              to="/shared-trees"
              className="bg-white border border-[#E7E2D6] rounded-2xl p-5 hover:border-[#1C4B3C] hover:shadow-sm transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#1C4B3C]/10 text-[#1C4B3C] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Share2 className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-[#1C1F1D] group-hover:text-[#1C4B3C] transition-colors">
                  Shared Trees & Collab
                </h3>
                <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
                  Manage collaborators, invite family members, or switch trees.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#E7E2D6]/60 flex items-center justify-between text-xs font-semibold text-[#1C4B3C]">
                <span>
                  {sharedTrees.length} Shared · {ownedTrees.length} Personal
                </span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          </div>
        </section>

        {/* ── Family Members Spotlight Roster ── */}
        {people.length > 0 && (
          <section className="bg-white border border-[#E7E2D6] rounded-3xl p-6 sm:p-8 shadow-xs">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <div>
                <h2 className="text-base sm:text-lg font-serif font-bold text-[#1C1F1D]">
                  Members in this Tree
                </h2>
                <p className="text-xs text-[#6B7280]">
                  Recently mapped family members in {activeTree?.name || "your family tree"}
                </p>
              </div>
              <Link
                to="/manage-tree"
                className="text-xs font-semibold text-[#1C4B3C] hover:underline flex items-center gap-1"
              >
                <span>Manage Tree & People</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {people.slice(0, 6).map((person) => {
                const parentsCount = (person.parentIds || []).length;
                const spouseCount = (person.spouseIds || []).length;

                return (
                  <div
                    key={person.id}
                    className="p-4 rounded-xl border border-[#E7E2D6] bg-[#FAF8F4] hover:border-[#1C4B3C]/40 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-[#1C4B3C]/10 text-[#1C4B3C] font-semibold text-sm flex items-center justify-center shrink-0">
                        {person.name?.[0] || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-[#1C1F1D] truncate">
                          {person.name}
                        </p>
                        <p className="text-[11px] text-[#6B7280] truncate">
                          {person.gender ? `${person.gender}` : "Relative"}
                          {parentsCount > 0 && ` · ${parentsCount} parents`}
                          {spouseCount > 0 && ` · ${spouseCount} spouse`}
                        </p>
                      </div>
                    </div>

                    <Link
                      to={`/people/${person.id}`}
                      className="text-xs font-semibold text-[#1C4B3C] hover:underline shrink-0 bg-white border border-[#E7E2D6] px-2.5 py-1 rounded-lg"
                    >
                      View
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Collaborative Trees Quick Section ── */}
        {sharedTrees.length > 0 && (
          <section className="bg-white border border-[#E7E2D6] rounded-3xl p-6 sm:p-8 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-serif font-bold text-[#1C1F1D]">
                  Collaborative Family Trees
                </h2>
                <p className="text-xs text-[#6B7280]">
                  Trees shared with your account
                </p>
              </div>
              <Link
                to="/shared-trees"
                className="text-xs font-semibold text-[#1C4B3C] hover:underline flex items-center gap-1"
              >
                <span>View All Shared Trees</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sharedTrees.map((tree) => {
                const isActive = (activeTreeId || activeTree?.id) === tree.id;
                return (
                  <div
                    key={tree.id}
                    className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      isActive
                        ? "bg-[#1C4B3C]/5 border-[#1C4B3C] ring-1 ring-[#1C4B3C]/20"
                        : "bg-[#FAF8F4] border-[#E7E2D6] hover:border-[#1C4B3C]/40"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-[#1C4B3C]/10 text-[#1C4B3C] flex items-center justify-center shrink-0">
                        <TreeIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs sm:text-sm font-semibold text-[#1C1F1D] truncate">
                            {tree.name}
                          </p>
                          {isActive && (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-[#1C4B3C] text-white px-1.5 py-0.2 rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#6B7280]">
                          Owner: {tree.owner_name || "Family Member"} · {tree.people_count || 0} members
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!isActive ? (
                        <button
                          type="button"
                          onClick={() => setActiveTreeId(tree.id)}
                          className="text-xs font-semibold text-[#1C4B3C] hover:bg-[#1C4B3C]/10 border border-[#1C4B3C]/30 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Switch
                        </button>
                      ) : (
                        <span className="text-xs text-[#1C4B3C] font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Current</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
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
