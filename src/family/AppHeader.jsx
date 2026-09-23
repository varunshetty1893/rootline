import { useState, useRef, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  GitBranch,
  LogOut,
  ChevronDown,
  Share2,
  Eye,
  EyeOff,
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
  AlertTriangle,
  Phone,
  MapPin,
  FileText,
  Camera,
  Trash2,
  Plus,
  Users,
  Loader2,
  FolderTree,
  Clock,
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
  const { user, logout, updateProfile, deleteAccount } = useAuth();
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

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Delete Account State
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState("");

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

  // Password reset OTP state
  const [resetStep, setResetStep] = useState(1); // 1 = Send Code, 2 = Verify Code & Set Password, 3 = Success
  const [resetOtp, setResetOtp] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState("");

  const profileMenuRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    await logout();
    navigate("/login");
  };

  const handleConfirmDeleteAccount = async () => {
    if (deleteConfirmationText.trim().toUpperCase() !== "DELETE") {
      setDeleteAccountError("Please type DELETE to confirm.");
      return;
    }
    setDeletingAccount(true);
    setDeleteAccountError("");
    try {
      await deleteAccount();
      setDeleteAccountModalOpen(false);
      navigate("/login", {
        replace: true,
        state: {
          cooldown: true,
          message:
            "Your Rootline account and all associated data have been permanently deleted. For account protection, you cannot recreate or sign in with this email for 24 hours. After 24 hours, you can create a fresh new account.",
        },
      });
    } catch (err) {
      setDeleteAccountError(err?.message || "Failed to delete account. Please try again.");
      setDeletingAccount(false);
    }
  };

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
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
    try {
      await api.forgotPassword(user.email);
      setResetStep(2);
    } catch (err) {
      setResetError(err.message || "Failed to send verification code.");
    } finally {
      setResetSending(false);
    }
  };

  const handleVerifyOtpAndChangePassword = async (e) => {
    if (e) e.preventDefault();
    const cleanOtp = resetOtp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setResetError("Please enter the 6-digit verification code sent to your email.");
      return;
    }
    if (!resetNewPassword || resetNewPassword.length < 8) {
      setResetError("New password must be at least 8 characters.");
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError("Passwords do not match.");
      return;
    }

    setResetSending(true);
    setResetError("");
    try {
      const verifyRes = await api.verifyOtp(user.email, cleanOtp);
      const token = verifyRes?.token || verifyRes?.reset_token;
      if (token) {
        await api.resetPassword(token, resetNewPassword);
      } else {
        await api.resetPasswordWithOtp(user.email, cleanOtp, resetNewPassword);
      }
      setResetStep(3);
      setResetSuccess(true);
    } catch (err) {
      setResetError(err.message || "Failed to reset password. Please check your verification code.");
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
      <header className="flex items-center justify-between px-3.5 sm:px-8 lg:px-16 py-3 sm:py-5 border-b border-[#E7E2D6] bg-[#F7F5F0]">
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
        <nav className="hidden md:flex items-center gap-7">
          <NavLink to="/dashboard" className={navLinkClass} end>
            Overview
          </NavLink>
          <NavLink to="/tree" className={navLinkClass}>
            Tree
          </NavLink>
          <NavLink to="/manage-tree" className={navLinkClass}>
            Manage Tree
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

        {/* Right — Profile Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3">
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
                    <Link
                      to="/tree"
                      onClick={() => setProfileMenuOpen(false)}
                      className="mt-2 pt-2 border-t border-[#E7E2D6]/60 flex items-center justify-between text-xs text-[#374151] hover:text-[#1C4B3C] hover:bg-[#F7F5F0]/70 p-1.5 rounded-lg group transition-colors"
                      title="Open Active Family Tree"
                    >
                      <span className="truncate font-semibold flex items-center gap-1.5">
                        <GitBranch className="w-3.5 h-3.5 text-[#1C4B3C] group-hover:scale-110 transition-transform" />
                        <span className="truncate">{activeTree.name}</span>
                      </span>
                      <span className="capitalize text-[10px] font-semibold text-[#1C4B3C] bg-[#1C4B3C]/10 px-1.5 py-0.5 rounded group-hover:bg-[#1C4B3C] group-hover:text-white transition-colors">
                        {myRole}
                      </span>
                    </Link>
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
                      setResetStep(1);
                      setResetOtp("");
                      setResetNewPassword("");
                      setResetConfirmPassword("");
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

                {/* Account Actions: Delete & Logout */}
                <div className="py-1 border-t border-[#E7E2D6]">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setDeleteConfirmationText("");
                      setDeleteAccountError("");
                      setDeleteAccountModalOpen(true);
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    <span>Delete Account</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-[#4B5563] hover:bg-[#F7F5F0] hover:text-[#1C1F1D] flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-[#6B7280]" />
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
            className="md:hidden p-2 rounded-xl border border-[#E7E2D6] bg-white text-[#374151] hover:text-[#1C4B3C] hover:border-[#1C4B3C]/40 transition-colors shadow-2xs flex items-center justify-center"
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
        <div className="md:hidden border-b border-[#E7E2D6] bg-[#F7F5F0] px-4 sm:px-6 py-3 flex flex-col gap-1.5 shadow-sm animate-in slide-in-from-top duration-200">
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
            to="/manage-tree"
            onClick={() => setMobileNavOpen(false)}
            className={({ isActive }) =>
              `px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#1C4B3C]/10 text-[#1C4B3C] font-semibold"
                  : "text-[#4B5563] hover:bg-white hover:text-[#1C1F1D]"
              }`
            }
          >
            Manage Tree
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
            <span>Shared Trees</span>
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

                {/* Danger Zone: Delete Account */}
                <div className="mt-6 pt-5 border-t border-red-100">
                  <div className="p-4 bg-red-50/80 border border-red-200 rounded-2xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h5 className="text-xs font-bold text-red-900 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          <span>Danger Zone: Delete Account</span>
                        </h5>
                        <p className="text-[11px] text-red-700 mt-1 leading-relaxed">
                          Permanently delete your account and all created family trees, people records, and collaboration shares.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileModalOpen(false);
                          setDeleteConfirmationText("");
                          setDeleteAccountError("");
                          setDeleteAccountModalOpen(true);
                        }}
                        className="shrink-0 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Account</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E7E2D6] flex justify-end">
                  <button
                    type="button"
                    onClick={() => setProfileModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-[#374151] hover:text-[#1C1F1D] bg-[#F7F5F0] hover:bg-[#EDE8DE] rounded-xl transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Delete Account Confirmation Modal ── */}
      {deleteAccountModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => {
            if (!deletingAccount) setDeleteAccountModalOpen(false);
          }}
        >
          <div
            className="bg-white border border-red-200 rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-red-100 mb-4">
              <div className="flex items-center gap-2 text-red-600">
                <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </span>
                <h3 className="text-base font-serif font-bold text-red-950">
                  Delete Account & All Data
                </h3>
              </div>
              <button
                type="button"
                disabled={deletingAccount}
                onClick={() => setDeleteAccountModalOpen(false)}
                className="p-1 rounded-lg text-[#9CA3AF] hover:text-[#1C1F1D] hover:bg-[#F7F5F0] transition-colors disabled:opacity-40 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Warning Details */}
            <div className="space-y-3 text-xs text-[#374151]">
              <p className="font-semibold text-red-900 bg-red-50 p-3 rounded-xl border border-red-100 leading-relaxed">
                This action is permanent and cannot be undone. Once confirmed, all your data will be immediately and irreversibly erased.
              </p>

              <div className="space-y-1.5 pl-1">
                <p className="font-semibold text-[#1C1F1D]">The following will be completely deleted:</p>
                <ul className="list-disc list-inside space-y-1 text-[#6B7280]">
                  <li>All family trees created and owned by you</li>
                  <li>All people, relationships, notes, and photos</li>
                  <li>All active tree shares and pending invitations</li>
                  <li>Your user credentials and profile information</li>
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
                <Clock className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <span className="font-semibold text-amber-950">24-Hour Cooling-Off Rule:</span> Once you delete your account, you will <strong className="font-semibold text-amber-950">not be able to create a new account or log in with this email for 24 hours</strong>. After 24 hours have passed, you can register a fresh new account.
                </div>
              </div>

              {deleteAccountError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{deleteAccountError}</span>
                </div>
              )}

              {/* Confirmation Input */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                  To confirm, type <span className="font-mono font-bold text-red-600">DELETE</span> below:
                </label>
                <input
                  type="text"
                  value={deleteConfirmationText}
                  onChange={(e) => {
                    setDeleteConfirmationText(e.target.value);
                    if (deleteAccountError) setDeleteAccountError("");
                  }}
                  disabled={deletingAccount}
                  placeholder="DELETE"
                  className="w-full text-xs font-mono rounded-xl border border-[#D9D3C3] bg-white px-3.5 py-2.5 text-[#1C1F1D] focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:bg-gray-50"
                  autoFocus
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 pt-3 border-t border-[#E7E2D6] flex justify-end gap-2">
              <button
                type="button"
                disabled={deletingAccount}
                onClick={() => setDeleteAccountModalOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#1C1F1D] hover:bg-[#F7F5F0] transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmationText.trim().toUpperCase() !== "DELETE" || deletingAccount}
                onClick={handleConfirmDeleteAccount}
                className="rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2 text-xs font-semibold text-white shadow-2xs disabled:opacity-40 disabled:hover:bg-red-600 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {deletingAccount ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting Account…</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently Delete</span>
                  </>
                )}
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

            {resetStep === 3 || resetSuccess ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-3 text-emerald-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-[#1C1F1D] mb-1">Password Changed Successfully</h4>
                <p className="text-xs text-[#6B7280] leading-relaxed mb-6">
                  Your password has been updated. You can now use your new password next time you sign in.
                </p>
                <button
                  type="button"
                  onClick={() => setResetModalOpen(false)}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#1C4B3C] hover:bg-[#163D31] rounded-xl transition-colors shadow-2xs"
                >
                  Done
                </button>
              </div>
            ) : resetStep === 2 ? (
              <form onSubmit={handleVerifyOtpAndChangePassword} className="space-y-3.5">
                <div>
                  <p className="text-xs text-[#374151] leading-relaxed mb-2">
                    Enter the <strong>6-digit verification code</strong> sent to{" "}
                    <span className="text-[#1C4B3C] font-semibold">{user?.email}</span>:
                  </p>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit code (e.g. 123456)"
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-3.5 py-2 text-center tracking-widest text-lg font-mono rounded-xl border border-[#E7E2D6] focus:border-[#1C4B3C] focus:ring-1 focus:ring-[#1C4B3C] outline-none"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showResetNewPassword ? "text" : "password"}
                      placeholder="At least 8 characters"
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-[#E7E2D6] focus:border-[#1C4B3C] focus:ring-1 focus:ring-[#1C4B3C] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetNewPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] transition-colors p-1"
                      aria-label={showResetNewPassword ? "Hide password" : "Show password"}
                    >
                      {showResetNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showResetConfirmPassword ? "text" : "password"}
                      placeholder="Re-type new password"
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-[#E7E2D6] focus:border-[#1C4B3C] focus:ring-1 focus:ring-[#1C4B3C] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetConfirmPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] transition-colors p-1"
                      aria-label={showResetConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showResetConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {resetError && (
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{resetError}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    disabled={resetSending}
                    onClick={handleTriggerPasswordReset}
                    className="text-xs text-[#1C4B3C] hover:underline font-medium disabled:opacity-50"
                  >
                    Resend Code
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setResetModalOpen(false)}
                      className="px-3.5 py-1.5 text-xs font-medium text-[#6B7280] hover:text-[#1C1F1D]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resetSending}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#1C4B3C] hover:bg-[#163D31] disabled:opacity-60 rounded-xl transition-colors shadow-2xs"
                    >
                      {resetSending ? "Verifying..." : "Update Password"}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div>
                <p className="text-xs text-[#6B7280] leading-relaxed mb-4">
                  Rootline verifies password changes using a 6-digit code (OTP) sent to your registered email address:
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
                    {resetSending ? "Sending Code..." : "Send Verification Code (OTP)"}
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
