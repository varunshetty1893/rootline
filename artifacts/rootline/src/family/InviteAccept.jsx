import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  Users,
  Shield,
  Eye,
  Edit3,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  ArrowRight,
  LogIn,
  UserPlus,
  Mail,
  Send,
} from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useFamily } from "./FamilyContext.jsx";

export default function InviteAccept() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refresh, setActiveTreeId, refreshTreeList } = useFamily();

  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("No invitation token provided in the link.");
      setLoading(false);
      return;
    }

    const loadInvitation = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api.verifyInvitation(token);
        setInvitation(data);
      } catch (err) {
        setError(err.message || "Invalid or expired invitation link.");
      } finally {
        setLoading(false);
      }
    };

    loadInvitation();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setSubmitting(true);
    setActionError("");
    try {
      const res = await api.acceptInvitation(token);
      setActionSuccess(res.message || "Invitation accepted!");
      setInvitation((prev) => (prev ? { ...prev, status: "accepted" } : null));

      const targetTreeId = res.family?.id || invitation?.family_id;
      if (targetTreeId && typeof setActiveTreeId === "function") {
        setActiveTreeId(targetTreeId);
      }
      if (typeof refreshTreeList === "function") {
        await refreshTreeList();
      }
      if (typeof refresh === "function") {
        await refresh();
      }
      setTimeout(() => {
        navigate("/tree");
      }, 1000);
    } catch (err) {
      setActionError(err.message || "Failed to accept invitation.");
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    setSubmitting(true);
    setActionError("");
    try {
      await api.declineInvitation(token);
      setActionSuccess("You have declined the invitation.");
      setInvitation((prev) => (prev ? { ...prev, status: "declined" } : null));
      if (typeof refresh === "function") {
        await refresh();
      }
    } catch (err) {
      setActionError(err.message || "Failed to decline invitation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#1C4B3C] text-white flex items-center justify-center font-bold text-lg shadow-sm">
            R
          </div>
          <span className="font-bold text-2xl tracking-wider text-[#1C4B3C]">
            ROOTLINE
          </span>
        </Link>
        <h2 className="text-xl font-semibold text-[#1C1F1D] mt-2">
          Family Tree Collaboration Invitation
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xl border border-[#E7E2D6] sm:rounded-2xl sm:px-10">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 text-[#1C4B3C] animate-spin mb-4" />
              <p className="text-sm text-[#4B5563]">Verifying your invitation details...</p>
            </div>
          ) : error ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-[#111827] mb-2">
                Invitation Not Found
              </h3>
              <p className="text-sm text-[#6B7280] mb-6">{error}</p>
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-[#1C4B3C] hover:bg-[#163C30] transition-colors"
              >
                Go to Dashboard
              </Link>
            </div>
          ) : invitation ? (
            <div className="space-y-6">
              {/* Status Banner */}
              {invitation.status === "accepted" ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">This invitation has already been accepted.</p>
                    <p className="text-xs text-emerald-700 mt-1">
                      You are a collaborator on this family tree.
                    </p>
                  </div>
                </div>
              ) : invitation.isExpired || invitation.status === "expired" ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">This invitation has expired.</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Please contact {invitation.inviter_name} to send you a new invitation link.
                    </p>
                  </div>
                </div>
              ) : invitation.status === "declined" ? (
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 text-sm flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">This invitation was declined.</p>
                  </div>
                </div>
              ) : null}

              {actionSuccess && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              {actionError && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Tree Details Card */}
              <div className="p-5 rounded-xl bg-[#F7F5F0] border border-[#E7E2D6] space-y-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                    Family Tree
                  </span>
                  <h3 className="text-lg font-bold text-[#1C1F1D] mt-0.5">
                    {invitation.family_name}
                  </h3>
                </div>

                {/* Who Sent Whom Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#E7E2D6]/80 text-xs">
                  <div>
                    <span className="text-[#6B7280] font-medium block">Sent By:</span>
                    <span className="font-semibold text-[#1C1F1D] block mt-0.5">
                      {invitation.inviter_name}
                    </span>
                    <span className="text-[#4B5563] truncate block">
                      {invitation.inviter_email}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6B7280] font-medium block">Sent To:</span>
                    <span className="font-semibold text-[#1C1F1D] block mt-0.5">
                      {invitation.invitee_email}
                    </span>
                    <span className="text-[#1C4B3C] font-medium inline-flex items-center gap-1 mt-0.5">
                      {invitation.permission === "editor" ? (
                        <>
                          <Edit3 className="w-3 h-3" /> Editor Access
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3" /> Viewer Access
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Personal Message if any */}
                {invitation.message && (
                  <div className="pt-3 border-t border-[#E7E2D6]/80">
                    <span className="text-xs font-semibold text-[#6B7280] block mb-1">
                      Personal Message:
                    </span>
                    <p className="text-sm italic text-[#374151] bg-white p-3 rounded-lg border border-[#E7E2D6]">
                      "{invitation.message}"
                    </p>
                  </div>
                )}

                <div className="pt-2 text-[11px] text-[#9CA3AF] flex items-center justify-between">
                  <span>
                    Expires: {new Date(invitation.expires_at).toLocaleDateString()}
                  </span>
                  <span className="capitalize px-2 py-0.5 rounded-full bg-white border border-[#E7E2D6] font-medium text-[#4B5563]">
                    Status: {invitation.status}
                  </span>
                </div>
              </div>

              {/* Action Buttons based on Auth State and Invitation Status */}
              {invitation.status === "pending" && !invitation.isExpired && (
                <div className="space-y-4 pt-2">
                  {user ? (
                    <div className="space-y-3">
                      <p className="text-xs text-center text-[#6B7280]">
                        Logged in as <strong>{user.email}</strong>. Accepting will add this tree to your account.
                      </p>
                      <button
                        onClick={handleAccept}
                        disabled={submitting}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-[#1C4B3C] hover:bg-[#163C30] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1C4B3C] disabled:opacity-50 transition-colors"
                      >
                        {submitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        Accept Invitation & Open Tree
                      </button>
                      <button
                        onClick={handleDecline}
                        disabled={submitting}
                        className="w-full text-center text-xs text-[#9CA3AF] hover:text-red-600 transition-colors py-1"
                      >
                        Decline this invitation
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-center text-[#6B7280]">
                        To accept this invitation, please log in or create a free account.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <Link
                          to={`/login?redirect=${encodeURIComponent(`/invite/accept?token=${token}`)}`}
                          className="flex items-center justify-center gap-1.5 py-2.5 px-3 border border-[#E7E2D6] rounded-xl text-sm font-medium text-[#1C1F1D] bg-white hover:bg-[#F7F5F0] transition-colors"
                        >
                          <LogIn className="w-4 h-4 text-[#1C4B3C]" />
                          Log In
                        </Link>
                        <Link
                          to={`/register?email=${encodeURIComponent(invitation.invitee_email)}&redirect=${encodeURIComponent(`/invite/accept?token=${token}`)}`}
                          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-sm font-medium text-white bg-[#1C4B3C] hover:bg-[#163C30] transition-colors shadow-sm"
                        >
                          <UserPlus className="w-4 h-4" />
                          Sign Up
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {invitation.status === "accepted" && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (invitation.family_id && typeof setActiveTreeId === "function") {
                        setActiveTreeId(invitation.family_id);
                      }
                      navigate("/tree");
                    }}
                    className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-[#1C4B3C] hover:bg-[#163C30] transition-colors shadow-sm cursor-pointer"
                  >
                    Open Family Tree
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
