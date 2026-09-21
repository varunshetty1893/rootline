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
  Phone,
  MapPin,
  FileText,
  Camera,
  Trash2,
  Plus,
  Users,
  Loader2,
  FolderTree,
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
    createTree,
  } = useFamily();

  const [treeMenuOpen, setTreeMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Profile Edit State
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [profileDob, setProfileDob] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  // Create Tree Modal State
  const [createTreeModalOpen, setCreateTreeModalOpen] = useState(false);
  const [newTreeName, setNewTreeName] = useState("");
  const [createTreeSubmitting, setCreateTreeSubmitting] = useState(false);
  const [createTreeError, setCreateTreeError] = useState("");

  // Password reset state
  const [resetSending, setResetSending] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState("");

  const treeMenuRef = useRef(null);
  const profileMenuRef = useRef(null);
  const fileInputRef = useRef(null);

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
    setProfilePhotoUrl(user?.photo_url || "");
    setProfileDob(user?.dob ? user.dob.slice(0, 10) : "");
    setProfilePhone(user?.phone || "");
    setProfileAddress(user?.address || "");
    setProfileBio(user?.bio || "");
    setProfileError("");
    setProfileSuccess("");
    setEditingProfile(false);
    setProfileModalOpen(true);
  };

  const handlePhotoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileError("Please select a valid image file (PNG, JPG, WebP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileError("Image size must be under 2MB.");
      return;
    }
    setPhotoUploading(true);
    setProfileError("");
    const reader = new FileReader();
    reader.onload = () => {
      setProfilePhotoUrl(reader.result);
      setPhotoUploading(false);
    };
    reader.onerror = () => {
      setProfileError("Failed to read image file.");
      setPhotoUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!profileName.trim()) {
      setProfileError("Please enter your name.");
      return;
    }
    setProfileSaving(true);
    setProfileError("");
    setProfileSuccess("");
    try {
      await updateProfile({
        name: profileName.trim(),
        photo_url: profilePhotoUrl || null,
        dob: profileDob || null,
        phone: profilePhone.trim() || null,
        address: profileAddress.trim() || null,
        bio: profileBio.trim() || null,
      });
      setProfileSuccess("Profile updated successfully!");
      setEditingProfile(false);
    } catch (err) {
      setProfileError(err.message || "Could not update your profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleCreateNewTree = async (e) => {
    e.preventDefault();
    if (!newTreeName.trim()) {
      setCreateTreeError("Please enter a tree name.");
      return;
    }
    setCreateTreeSubmitting(true);
    setCreateTreeError("");
    try {
      await createTree(newTreeName.trim());
      setCreateTreeModalOpen(false);
      setNewTreeName("");
      navigate("/tree");
    } catch (err) {
      setCreateTreeError(err.message || "Failed to create tree.");
    } finally {
      setCreateTreeSubmitting(false);
    }
  };

  const ownedTrees = treeList?.owned_trees || [];
  const sharedTrees = treeList?.shared_trees || [];
  const allTrees = [
    ...ownedTrees.map((t) => ({ ...t, role: "owner" })),
    ...sharedTrees,
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
          <NavLink to="/shared-trees" className={navLinkClass}>
            <span className="flex items-center gap-1.5">
              <span>Shared Trees</span>
              {sharedTrees.length > 0 && (
                <span className="text-[10px] font-bold bg-[#1C4B3C] text-white px-1.5 py-0.5 rounded-full leading-none">
                  {sharedTrees.length}
                </span>
              )}
            </span>
          </NavLink>
        </nav>

        {/* Right — Tree Switcher + Profile Dropdown */}
        <div className="flex items-center justify-self-end gap-3">
          {/* Tree switcher */}
          <div className="relative" ref={treeMenuRef}>
            <button
              type="button"
              onClick={() => setTreeMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#374151] bg-white border border-[#E7E2D6] rounded-xl px-3 py-1.5 hover:border-[#1C4B3C]/40 transition-colors max-w-[170px] shadow-2xs"
            >
              <span className="truncate">{displayName}</span>
              {myRole !== "owner" && (
                <Eye className="w-3 h-3 text-amber-500 shrink-0" title={myRole} />
              )}
              <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
            </button>

            {treeMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-[#E7E2D6] rounded-2xl shadow-xl z-50 overflow-hidden py-1">
                {/* Owned trees */}
                {ownedTrees.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between px-3.5 pt-2.5 pb-1">
                      <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide">
                        My Trees
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setTreeMenuOpen(false);
                          setNewTreeName("");
                          setCreateTreeError("");
                          setCreateTreeModalOpen(true);
                        }}
                        className="text-[10px] font-semibold text-[#1C4B3C] hover:underline flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" /> New Tree
                      </button>
                    </div>
                    {ownedTrees.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setActiveTreeId(t.id);
                          setTreeMenuOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs hover:bg-[#F7F5F0] transition-colors flex items-center justify-between gap-2 ${
                          activeTreeId === t.id ||
                          (!activeTreeId && t.id === ownedTrees[0]?.id)
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
                {sharedTrees.length > 0 && (
                  <div className="border-t border-[#E7E2D6] mt-1 pt-1">
                    <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide px-3.5 pt-2 pb-1">
                      Shared With Me
                    </p>
                    {sharedTrees.map((t) => (
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

                {/* Manage Trees Link */}
                <div className="border-t border-[#E7E2D6] mt-1 pt-1 bg-[#FAF8F4]">
                  <Link
                    to="/shared-trees"
                    onClick={() => setTreeMenuOpen(false)}
                    className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[#1C4B3C] hover:bg-[#F0EDE3] flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-1.5">
                      <FolderTree className="w-3.5 h-3.5" />
                      <span>Manage All Trees</span>
                    </span>
                    <span className="text-[10px] bg-[#1C4B3C]/10 px-1.5 py-0.5 rounded">
                      {allTrees.length}
                    </span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* ── Profile Avatar Dropdown Menu ── */}
          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((v) => !v)}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full bg-white border border-[#E7E2D6] hover:border-[#1C4B3C]/40 transition-all shadow-2xs group"
              aria-label="User profile menu"
            >
              <div className="w-7 h-7 rounded-full bg-[#1C4B3C] text-white flex items-center justify-center text-xs font-bold shadow-xs overflow-hidden">
                {user?.photo_url ? (
                  <img
                    src={user.photo_url}
                    alt={user.name || "Profile"}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  userInitial
                )}
              </div>
              <span className="hidden md:inline text-xs font-medium text-[#1C1F1D] max-w-[120px] truncate">
                {user?.name || "Account"}
              </span>
              <ChevronDown className="w-3 h-3 text-[#9CA3AF] group-hover:text-[#1C1F1D] transition-colors" />
            </button>

            {/* Profile Dropdown */}
            {profileMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-[#E7E2D6] rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-[#E7E2D6] py-1 animate-in fade-in zoom-in-95 duration-100">
                {/* User info header */}
                <div className="px-4 py-3 bg-[#FAF8F4]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#1C4B3C] text-white flex items-center justify-center text-xs font-bold shadow-xs overflow-hidden">
                      {user?.photo_url ? (
                        <img
                          src={user.photo_url}
                          alt={user.name || "Profile"}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        userInitial
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#1C1F1D] truncate">
                        {user?.name || "Family Member"}
                      </p>
                      <p className="text-[11px] text-[#6B7280] truncate">{user?.email}</p>
                    </div>
                  </div>
                  {activeTree && (
                    <div className="mt-2 pt-2 border-t border-[#E7E2D6]/60 flex items-center justify-between text-[10px] text-[#6B7280]">
                      <span className="truncate">{activeTree.name}</span>
                      <span className="capitalize font-semibold text-[#1C4B3C] bg-[#1C4B3C]/10 px-1.5 py-0.5 rounded">
                        {myRole}
                      </span>
                    </div>
                  )}
                </div>

                {/* Menu items */}
                <div className="py-1">
                  {/* View/Edit Profile */}
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      openProfile();
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-[#374151] hover:bg-[#F7F5F0] hover:text-[#1C1F1D] flex items-center gap-2.5 transition-colors"
                  >
                    <User className="w-3.5 h-3.5 text-[#1C4B3C]" />
                    <span>View & Edit Profile</span>
                  </button>

                  {/* Shared & Family Trees */}
                  <Link
                    to="/shared-trees"
                    onClick={() => setProfileMenuOpen(false)}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-[#374151] hover:bg-[#F7F5F0] hover:text-[#1C1F1D] flex items-center justify-between transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <Users className="w-3.5 h-3.5 text-[#1C4B3C]" />
                      <span>Shared & Family Trees</span>
                    </span>
                    {sharedTrees.length > 0 && (
                      <span className="text-[10px] bg-[#1C4B3C] text-white px-1.5 py-0.2 rounded-full font-bold">
                        {sharedTrees.length}
                      </span>
                    )}
                  </Link>

                  {/* Share Tree (if owner or editor) */}
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
                      <span>Share Current Tree</span>
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
          <NavLink
            to="/shared-trees"
            onClick={() => setMobileNavOpen(false)}
            className={({ isActive }) =>
              `px-3.5 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-between ${
                isActive
                  ? "bg-[#1C4B3C]/10 text-[#1C4B3C] font-semibold"
                  : "text-[#4B5563] hover:bg-white hover:text-[#1C1F1D]"
              }`
            }
          >
            <span>Shared & Family Trees</span>
            {sharedTrees.length > 0 && (
              <span className="text-[10px] bg-[#1C4B3C] text-white px-2 py-0.5 rounded-full font-bold">
                {sharedTrees.length}
              </span>
            )}
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

      {/* ── Create Tree Modal ── */}
      {createTreeModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setCreateTreeModalOpen(false)}
        >
          <div
            className="bg-white border border-[#E7E2D6] rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-serif font-bold text-[#1C1F1D] mb-1">
              Create a New Family Tree
            </h3>
            <p className="text-xs text-[#6B7280] mb-4 leading-relaxed">
              Create a separate family tree for maternal ancestry, in-laws, or another family branch.
            </p>

            <form onSubmit={handleCreateNewTree} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                  Tree Name
                </label>
                <input
                  type="text"
                  value={newTreeName}
                  onChange={(e) => setNewTreeName(e.target.value)}
                  placeholder="e.g. Reynolds Family Tree"
                  maxLength={100}
                  autoFocus
                  className="w-full text-sm rounded-xl border border-[#D9D3C3] px-3.5 py-2.5 bg-white text-[#1C1F1D] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 focus:border-[#1C4B3C]"
                />
              </div>

              {createTreeError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createTreeError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateTreeModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-[#6B7280] hover:text-[#1C1F1D] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTreeSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1C4B3C] hover:bg-[#163C30] rounded-xl shadow-2xs disabled:opacity-60 flex items-center gap-1.5"
                >
                  {createTreeSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{createTreeSubmitting ? "Creating…" : "Create Tree"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── User Profile Modal (Expanded Editing: Photo, DOB, Phone, Address, Bio) ── */}
      {profileModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setProfileModalOpen(false)}
        >
          <div
            className="bg-white border border-[#E7E2D6] rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E7E2D6] mb-5">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-[#1C4B3C]/10 flex items-center justify-center text-[#1C4B3C]">
                  <User className="w-4 h-4" />
                </span>
                <h3 className="text-base font-serif font-bold text-[#1C1F1D]">
                  {editingProfile ? "Edit Your Profile" : "User Profile"}
                </h3>
              </div>
              <button
                onClick={() => setProfileModalOpen(false)}
                className="p-1 rounded-lg text-[#9CA3AF] hover:text-[#1C1F1D] hover:bg-[#F7F5F0] transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {profileSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{profileError}</span>
              </div>
            )}

            {/* ── Profile Editing Form ── */}
            {editingProfile ? (
              <form onSubmit={saveProfile} className="space-y-4 text-xs">
                {/* Photo Upload Section */}
                <div className="flex items-center gap-4 p-4 bg-[#FAF8F4] border border-[#E7E2D6] rounded-2xl">
                  <div className="relative w-16 h-16 rounded-full bg-[#1C4B3C] text-white flex items-center justify-center text-xl font-bold shadow-md overflow-hidden shrink-0 border-2 border-white">
                    {profilePhotoUrl ? (
                      <img
                        src={profilePhotoUrl}
                        alt="Profile preview"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      userInitial
                    )}
                    {photoUploading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 flex-1">
                    <p className="text-xs font-semibold text-[#1C1F1D]">Profile Photo</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handlePhotoFileChange}
                        accept="image/png,image/jpeg,image/webp,image/jpg"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#D9D3C3] text-xs font-medium text-[#1C1F1D] hover:bg-[#F0EDE3] shadow-2xs"
                      >
                        <Camera className="w-3.5 h-3.5 text-[#1C4B3C]" />
                        <span>Upload photo</span>
                      </button>
                      {profilePhotoUrl && (
                        <button
                          type="button"
                          onClick={() => setProfilePhotoUrl("")}
                          className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 px-2 py-1.5"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-[#9CA3AF]">
                      JPG, PNG, or WebP. Max 2MB recommended.
                    </p>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Display Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Your Full Name"
                    maxLength={120}
                    className="w-full text-xs rounded-xl border border-[#D9D3C3] bg-white px-3.5 py-2.5 text-[#1C1F1D] focus:border-[#1C4B3C] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/20"
                    required
                  />
                </div>

                {/* Email (Read-only notice) */}
                <div>
                  <label className="block text-xs font-semibold text-[#6B7280] mb-1">
                    Email Address (Account Identifier)
                  </label>
                  <div className="flex items-center gap-2 p-2.5 bg-[#FAF8F4] border border-[#E7E2D6] rounded-xl text-xs text-[#6B7280]">
                    <Mail className="w-3.5 h-3.5 text-[#9CA3AF]" />
                    <span>{user?.email}</span>
                  </div>
                </div>

                {/* Date of Birth & Phone in 2 Columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#1C4B3C]" />
                      <span>Date of Birth</span>
                    </label>
                    <input
                      type="date"
                      value={profileDob}
                      onChange={(e) => setProfileDob(e.target.value)}
                      className="w-full text-xs rounded-xl border border-[#D9D3C3] bg-white px-3.5 py-2.5 text-[#1C1F1D] focus:border-[#1C4B3C] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-[#1C4B3C]" />
                      <span>Phone Number</span>
                    </label>
                    <input
                      type="tel"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      maxLength={30}
                      className="w-full text-xs rounded-xl border border-[#D9D3C3] bg-white px-3.5 py-2.5 text-[#1C1F1D] focus:border-[#1C4B3C] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/20"
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#1C4B3C]" />
                    <span>Address / Location</span>
                  </label>
                  <input
                    type="text"
                    value={profileAddress}
                    onChange={(e) => setProfileAddress(e.target.value)}
                    placeholder="City, State, Country or full street address"
                    maxLength={200}
                    className="w-full text-xs rounded-xl border border-[#D9D3C3] bg-white px-3.5 py-2.5 text-[#1C1F1D] focus:border-[#1C4B3C] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/20"
                  />
                </div>

                {/* Bio / About */}
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-[#1C4B3C]" />
                    <span>Bio / Personal Notes</span>
                  </label>
                  <textarea
                    value={profileBio}
                    onChange={(e) => setProfileBio(e.target.value)}
                    placeholder="A brief note about yourself, your family history, or personal hobbies…"
                    rows={3}
                    maxLength={1000}
                    className="w-full text-xs rounded-xl border border-[#D9D3C3] bg-white px-3.5 py-2.5 text-[#1C1F1D] focus:border-[#1C4B3C] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/20 resize-none"
                  />
                </div>

                {/* Form Buttons */}
                <div className="mt-4 pt-3 border-t border-[#E7E2D6] flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProfile(false);
                      setProfileError("");
                    }}
                    className="rounded-xl px-4 py-2 text-xs font-medium text-[#6B7280] hover:text-[#1C1F1D]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="rounded-xl bg-[#1C4B3C] hover:bg-[#163C30] px-4 py-2 text-xs font-semibold text-white shadow-2xs disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {profileSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{profileSaving ? "Saving…" : "Save Changes"}</span>
                  </button>
                </div>
              </form>
            ) : (
              /* ── Profile View Mode ── */
              <div className="space-y-4 text-xs">
                {/* Hero Avatar + Name Card */}
                <div className="flex items-center gap-4 p-4 bg-[#FAF8F4] border border-[#E7E2D6] rounded-2xl">
                  <div className="w-16 h-16 rounded-full bg-[#1C4B3C] text-white flex items-center justify-center text-xl font-bold shadow-md overflow-hidden shrink-0 border-2 border-white">
                    {user?.photo_url ? (
                      <img
                        src={user.photo_url}
                        alt={user.name || "Profile"}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      userInitial
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base font-bold text-[#1C1F1D] truncate">
                      {user?.name || "Family Member"}
                    </h4>
                    <p className="text-xs text-[#6B7280] flex items-center gap-1 mt-0.5">
                      <Mail className="w-3.5 h-3.5 text-[#9CA3AF]" />
                      <span>{user?.email}</span>
                    </p>
                    <span className="inline-block mt-2 text-[10px] font-semibold text-[#1C4B3C] bg-[#1C4B3C]/10 border border-[#1C4B3C]/20 px-2 py-0.5 rounded-full capitalize">
                      {myRole === "owner" ? "Primary Tree Owner" : `${myRole} role`}
                    </span>
                  </div>
                </div>

                {/* Edit Profile Action Button */}
                <button
                  type="button"
                  onClick={() => {
                    setProfileName(user?.name || "");
                    setProfilePhotoUrl(user?.photo_url || "");
                    setProfileDob(user?.dob ? user.dob.slice(0, 10) : "");
                    setProfilePhone(user?.phone || "");
                    setProfileAddress(user?.address || "");
                    setProfileBio(user?.bio || "");
                    setProfileError("");
                    setEditingProfile(true);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#1C4B3C]/30 bg-[#1C4B3C]/5 px-4 py-2.5 text-xs font-semibold text-[#1C4B3C] hover:bg-[#1C4B3C]/10 transition-colors shadow-2xs"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Edit Profile Information</span>
                </button>

                {/* Profile Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 bg-white border border-[#E7E2D6] rounded-xl">
                    <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#1C4B3C]" />
                      <span>Date of Birth</span>
                    </p>
                    <p className="font-medium text-[#1C1F1D]">
                      {user?.dob
                        ? new Date(user.dob).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "Not specified"}
                    </p>
                  </div>

                  <div className="p-3 bg-white border border-[#E7E2D6] rounded-xl">
                    <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-[#1C4B3C]" />
                      <span>Phone Number</span>
                    </p>
                    <p className="font-medium text-[#1C1F1D]">
                      {user?.phone || "Not specified"}
                    </p>
                  </div>

                  <div className="p-3 bg-white border border-[#E7E2D6] rounded-xl sm:col-span-2">
                    <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#1C4B3C]" />
                      <span>Address / Location</span>
                    </p>
                    <p className="font-medium text-[#1C1F1D]">
                      {user?.address || "Not specified"}
                    </p>
                  </div>

                  {user?.bio && (
                    <div className="p-3 bg-white border border-[#E7E2D6] rounded-xl sm:col-span-2">
                      <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1 flex items-center gap-1">
                        <FileText className="w-3 h-3 text-[#1C4B3C]" />
                        <span>About / Bio</span>
                      </p>
                      <p className="font-normal text-[#374151] leading-relaxed whitespace-pre-line">
                        {user.bio}
                      </p>
                    </div>
                  )}

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
            )}
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
