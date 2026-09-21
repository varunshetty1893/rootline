import { useState, useRef, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  GitBranch,
  LogOut,
  ChevronDown,
  Share2,
  Eye,
  User,
  Pencil,
  KeyRound,
  LifeBuoy,
  X,
  Menu,
  Calendar,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../AuthContext.jsx";
import { useFamily } from "./FamilyContext.jsx";
import { api } from "../api.js";
import ShareModal from "./ShareModal.jsx";

const navLinkClass = ({ isActive }) =>
  `text-sm font-medium transition-colors ${
    isActive ? "text-[#1C4B3C]" : "text-[#6B7280] hover:text-[#1C1F1D]"
  }`;

export default function AppHeader() {
  const { user, logout, updateProfile } = useAuth();
  const navigate = useNavigate();
  const {
    activeTree,
    activeTreeId,
    setActiveTreeId,
    treeList = { owned_trees: [], shared_trees: [] },
    myRole,
    canManage,
  } = useFamily();

  const [treeMenuOpen, setTreeMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Password reset state
  const [resetSending, setResetSending] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState("");

  const treeMenuRef = useRef(null);
  const profileMenuRef = useRef(null);

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    await logout();
    navigate("/login");
  };

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (treeMenuRef.current && !treeMenuRef.current.contains(e.target)) {
        setTreeMenuOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTriggerPasswordReset = async () => {
    if (!user?.email) return;
    setResetSending(true);
    setResetError("");
    setResetSuccess(false);
    try {
      await api.forgotPassword(user.email);
      setResetSuccess(true);
    } catch (err) {
      setResetError(err.message || "Failed to initiate password reset.");
    } finally {
      setResetSending(false);
    }
  };

  const openProfile = () => {
    setProfileName(user?.name || "");
    setProfileError("");
    setEditingProfile(false);
    setProfileModalOpen(true);
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!profileName.trim()) {
      setProfileError("Please enter your name.");
      return;
    }
    setProfileSaving(true);
    setProfileError("");
    try {
      await updateProfile({ name: profileName.trim() });
      setEditingProfile(false);
    } catch (err) {
      setProfileError(err.message || "Could not update your profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const allTrees = [
    ...treeList.owned_trees.map((t) => ({ ...t, role: "owner" })),
    ...treeList.shared_trees,
  ];

  const displayName = activeTree?.name || "My Family Tree";
  const userInitial = (user?.name?.[0] || user?.email?.[0] || "U").toUpperCase();

  const formattedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Active Member";

  return (
    <>
      <header className="grid grid-cols-[1fr_auto_1fr] items-center px-6 sm:px-8 lg:px-16 py-5 border-b border-[#E7E2D6] bg-[#F7F5F0]">
        {/* Left — Logo */}
        <div className="flex items-center">
          <Link to="/dashboard" className="flex items-center gap-1.5 hover:opacity-85 transition-opacity">
            <GitBranch className="w-4 h-4 text-[#1C4B3C]" strokeWidth={2.5} />
            <span className="text-[13px] tracking-[0.2em] font-semibold text-[#1C4B3C]">
              ROOTLINE
            </span>
          </Link>
        </div>

        {/* Centre — Main Navigation */}
        <nav className="hidden sm:flex items-center justify-self-center gap-7">
          <NavLink to="/dashboard" className={navLinkClass} end>
            Overview
          </NavLink>
          <NavLink to="/people" className={navLinkClass}>
            People
          </NavLink>
          <NavLink to="/tree" className={navLinkClass}>
            Tree
          </NavLink>
        </nav>

        {/* Right — Tree Switcher + Profile Dropdown */}
        <div className="flex items-center justify-self-end gap-3">
          {/* Tree switcher (visible when user has multiple trees) */}
          {allTrees.length > 1 && (
            <div className="relative" ref={treeMenuRef}>
              <button
                type="button"
                onClick={() => setTreeMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-[#374151] bg-white border border-[#E7E2D6] rounded-xl px-3 py-1.5 hover:border-[#1C4B3C]/40 transition-colors max-w-[160px] shadow-2xs"
              >
                <span className="truncate">{displayName}</span>
                {myRole !== "owner" && (
                  <Eye className="w-3 h-3 text-amber-500 shrink-0" title={myRole} />
                )}
                <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
              </button>

              {treeMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-white border border-[#E7E2D6] rounded-2xl shadow-xl z-50 overflow-hidden py-1">
                  {/* Owned trees */}
                  {treeList.owned_trees.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide px-3.5 pt-2.5 pb-1">
                        My Trees
                      </p>
                      {treeList.owned_trees.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setActiveTreeId(t.id);
                            setTreeMenuOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs hover:bg-[#F7F5F0] transition-colors flex items-center justify-between gap-2 ${
                            activeTreeId === t.id ||
                            (!activeTreeId && t.id === treeList.owned_trees[0]?.id)
                              ? "text-[#1C4B3C] font-semibold bg-[#1C4B3C]/5"
                              : "text-[#374151]"
                          }`}
                        >
                          <span className="truncate">{t.name}</span>
                          <span className="text-[10px] text-[#9CA3AF] shrink-0">
                            {t.people_count} {t.people_count === 1 ? "person" : "people"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Shared trees */}
                  {treeList.shared_trees.length > 0 && (
                    <div className="border-t border-[#E7E2D6] mt-1 pt-1">
                      <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide px-3.5 pt-2 pb-1">
                        Shared With Me
                      </p>
                      {treeList.shared_trees.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setActiveTreeId(t.id);
                            setTreeMenuOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs hover:bg-[#F7F5F0] transition-colors flex items-center justify-between gap-2 ${
                            activeTreeId === t.id
                              ? "text-[#1C4B3C] font-semibold bg-[#1C4B3C]/5"
                              : "text-[#374151]"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{t.name}</p>
                            <p className="text-[10px] text-[#9CA3AF]">{t.owner_name}</p>
                          </div>
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded capitalize">
                            {t.role}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Profile Avatar Dropdown Menu ── */}
          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((v) => !v)}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full bg-white border border-[#E7E2D6] hover:border-[#1C4B3C]/40 transition-all shadow-2xs group"
              aria-label="User profile menu"
            >
              <div className="w-7 h-7 rounded-full bg-[#1C4B3C] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                {userInitial}
              </div>
              <span className="hidden md:inline text-xs font-medium text-[#1C1F1D] max-w-[120px] truncate">
                {user?.name || user?.email?.split("@")[0]}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF] group-hover:text-[#1C1F1D] transition-colors" />
            </button>

            {profileMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-[#E7E2D6] rounded-2xl shadow-xl z-50 overflow-hidden py-1 divide-y divide-[#E7E2D6]/70 animate-in fade-in zoom-in-95 duration-100">
                {/* User Summary Header */}
                <div className="px-4 py-3 bg-[#FAF8F4]">
                  <p className="text-xs font-bold text-[#1C1F1D] truncate leading-tight">
                    {user?.name}
                  </p>
                  <p className="text-[11px] text-[#6B7280] truncate mt-0.5">{user?.email}</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-medium text-emerald-700">Signed In</span>
                  </div>
                </div>

                {/* Main Menu Options */}
                <div className="py-1">
                  {/* User Profile */}
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      openProfile();
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-[#374151] hover:bg-[#F7F5F0] hover:text-[#1C1F1D] flex items-center gap-2.5 transition-colors"
                  >
                    <User className="w-3.5 h-3.5 text-[#1C4B3C]" />
                    <span>User Profile</span>
                  </button>

                  {/* Share Tree (Available from dropdown) */}
                  {canManage && activeTree && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setShareOpen(true);
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-[#374151] hover:bg-[#F7F5F0] hover:text-[#1C1F1D] flex items-center gap-2.5 transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5 text-[#1C4B3C]" />
                      <span>Share Tree</span>
                    </button>
                  )}

                  {/* Password Reset */}
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setResetSuccess(false);
                      setResetError("");
                      setResetModalOpen(true);
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-[#374151] hover:bg-[#F7F5F0] hover:text-[#1C1F1D] flex items-center gap-2.5 transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-[#C9A468]" />
                    <span>Reset Password</span>
                  </button>

                  {/* Help & Support */}
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      navigate("/support");
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-[#374151] hover:bg-[#F7F5F0] hover:text-[#1C1F1D] flex items-center gap-2.5 transition-colors"
                  >
                    <LifeBuoy className="w-3.5 h-3.5 text-[#1C4B3C]" />
                    <span>Help & Support</span>
                  </button>
                </div>

                {/* Logout Option */}
                <div className="py-1">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-500" />
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile hamburger menu button */}
          <button
            type="button"
            aria-label="Toggle navigation menu"
            onClick={() => setMobileNavOpen((v) => !v)}
            className="sm:hidden p-2 rounded-xl border border-[#E7E2D6] bg-white text-[#374151] hover:text-[#1C4B3C] hover:border-[#1C4B3C]/40 transition-colors shadow-2xs flex items-center justify-center"
          >
            {mobileNavOpen ? (
              <X className="w-4 h-4 text-[#1C4B3C]" />
            ) : (
              <Menu className="w-4 h-4 text-[#374151]" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <div className="sm:hidden border-b border-[#E7E2D6] bg-[#F7F5F0] px-6 py-3 flex flex-col gap-1.5 shadow-sm">
          <NavLink
            to="/dashboard"
            onClick={() => setMobileNavOpen(false)}
            className={({ isActive }) =>
              `px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#1C4B3C]/10 text-[#1C4B3C] font-semibold"
                  : "text-[#4B5563] hover:bg-white hover:text-[#1C1F1D]"
              }`
            }
            end
          >
            Overview
          </NavLink>
          <NavLink
            to="/people"
            onClick={() => setMobileNavOpen(false)}
            className={({ isActive }) =>
              `px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#1C4B3C]/10 text-[#1C4B3C] font-semibold"
                  : "text-[#4B5563] hover:bg-white hover:text-[#1C1F1D]"
              }`
            }
          >
            People
          </NavLink>
          <NavLink
            to="/tree"
            onClick={() => setMobileNavOpen(false)}
            className={({ isActive }) =>
              `px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#1C4B3C]/10 text-[#1C4B3C] font-semibold"
                  : "text-[#4B5563] hover:bg-white hover:text-[#1C1F1D]"
              }`
            }
          >
            Tree
          </NavLink>
        </div>
      )}

      {/* ── Share Modal ── */}
      {shareOpen && activeTree && (
        <ShareModal
          treeId={activeTree.id}
          treeName={activeTree.name}
          onClose={() => setShareOpen(false)}
        />
      )}

      {/* ── User Profile Modal ── */}
      {profileModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setProfileModalOpen(false)}
        >
          <div
            className="bg-white border border-[#E7E2D6] rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#E7E2D6] mb-5">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-[#1C4B3C]/10 flex items-center justify-center text-[#1C4B3C]">
                  <User className="w-4 h-4" />
                </span>
                <h3 className="text-base font-serif font-bold text-[#1C1F1D]">User Profile</h3>
              </div>
              <button
                onClick={() => setProfileModalOpen(false)}
                className="p-1 rounded-lg text-[#9CA3AF] hover:text-[#1C1F1D] hover:bg-[#F7F5F0] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Avatar + Name card */}
              <div className="flex items-center gap-3.5 p-3.5 bg-[#FAF8F4] border border-[#E7E2D6] rounded-xl">
                <div className="w-12 h-12 rounded-full bg-[#1C4B3C] text-white flex items-center justify-center text-lg font-bold shadow-xs">
                  {userInitial}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#1C1F1D]">{user?.name}</p>
                  <p className="text-xs text-[#6B7280]">{user?.email}</p>
                </div>
              </div>

              {editingProfile ? (
                <form onSubmit={saveProfile} className="rounded-xl border border-[#E7E2D6] bg-[#FAF8F4] p-3.5">
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">Display name</label>
                  <input value={profileName} onChange={(e) => setProfileName(e.target.value)} maxLength={120} autoFocus className="mt-1.5 w-full rounded-lg border border-[#D9D3C3] bg-white px-3 py-2 text-sm text-[#1C1F1D] focus:border-[#1C4B3C] focus:outline-none" />
                  <p className="mt-1.5 text-[11px] text-[#9CA3AF]">Your email address is used for sign-in and cannot be changed here.</p>
                  {profileError && <p className="mt-2 text-xs text-red-600">{profileError}</p>}
                  <div className="mt-3 flex justify-end gap-2">
                    <button type="button" onClick={() => setEditingProfile(false)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#6B7280]">Cancel</button>
                    <button type="submit" disabled={profileSaving} className="rounded-lg bg-[#1C4B3C] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{profileSaving ? "Saving…" : "Save changes"}</button>
                  </div>
                </form>
              ) : (
                <button type="button" onClick={() => setEditingProfile(true)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#1C4B3C]/25 bg-[#1C4B3C]/5 px-3 py-2 text-xs font-semibold text-[#1C4B3C] hover:bg-[#1C4B3C]/10"><Pencil className="h-3.5 w-3.5" /> Edit profile</button>
              )}

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-white border border-[#E7E2D6] rounded-xl">
                  <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">
                    Member Since
                  </p>
                  <p className="font-medium text-[#1C1F1D]">{formattedDate}</p>
                </div>
                <div className="p-3 bg-white border border-[#E7E2D6] rounded-xl">
                  <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">
                    Current Tree
                  </p>
                  <p className="font-medium text-[#1C1F1D] truncate">{displayName}</p>
                </div>
              </div>

              <div className="p-3 bg-white border border-[#E7E2D6] rounded-xl">
                <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">
                  Access Level
                </p>
                <p className="font-medium text-[#1C4B3C] capitalize">
                  {myRole === "owner" ? "Tree Owner (Full Access)" : `${myRole} role`}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#E7E2D6] flex justify-end">
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#374151] hover:text-[#1C1F1D] bg-[#F7F5F0] hover:bg-[#EDE8DE] rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Password Reset Confirmation Modal ── */}
      {resetModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setResetModalOpen(false)}
        >
          <div
            className="bg-white border border-[#E7E2D6] rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#E7E2D6] mb-5">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-[#C9A468]/15 flex items-center justify-center text-[#C9A468]">
                  <KeyRound className="w-4 h-4" />
                </span>
                <h3 className="text-base font-serif font-bold text-[#1C1F1D]">Reset Password</h3>
              </div>
              <button
                onClick={() => setResetModalOpen(false)}
                className="p-1 rounded-lg text-[#9CA3AF] hover:text-[#1C1F1D] hover:bg-[#F7F5F0] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {resetSuccess ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-3 text-emerald-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-[#1C1F1D] mb-1">Reset Link Dispatched</h4>
                <p className="text-xs text-[#6B7280] leading-relaxed mb-6">
                  We've sent password reset instructions to{" "}
                  <strong className="text-[#1C1F1D]">{user?.email}</strong>. Please check your inbox or spam folder.
                </p>
                <button
                  type="button"
                  onClick={() => setResetModalOpen(false)}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#1C4B3C] hover:bg-[#163D31] rounded-xl transition-colors shadow-2xs"
                >
                  Got it
                </button>
              </div>
            ) : (
              <div>
                <p className="text-xs text-[#6B7280] leading-relaxed mb-4">
                  Would you like to send a secure password reset link to your registered email address?
                </p>
                <div className="p-3 bg-[#FAF8F4] border border-[#E7E2D6] rounded-xl text-xs text-[#374151] mb-5 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#1C4B3C] shrink-0" />
                  <span className="truncate font-medium">{user?.email}</span>
                </div>

                {resetError && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 mb-4">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{resetError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-[#6B7280] hover:text-[#1C1F1D] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={resetSending}
                    onClick={handleTriggerPasswordReset}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1C4B3C] hover:bg-[#163D31] disabled:opacity-60 rounded-xl transition-colors shadow-2xs"
                  >
                    {resetSending ? "Sending..." : "Send Reset Link"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
