import { useState } from "react";
import { Link } from "react-router-dom";
import {
  HelpCircle,
  Send,
  CheckCircle2,
  AlertCircle,
  Mail,
  ArrowLeft,
  LifeBuoy,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "./AuthContext.jsx";
import { api } from "./api.js";
import AppHeader from "./family/AppHeader.jsx";

const FAQ_ITEMS = [
  {
    q: "How do I share my family tree with relatives?",
    a: "You can share your tree using the 'Share Tree' button on your Overview dashboard or from your profile dropdown in the top navigation. Enter your relative's email and assign them either Viewer or Editor permissions.",
  },
  {
    q: "What is the difference between an Editor and a Viewer?",
    a: "Editors can add relatives, connect relationships, and update biographies. Viewers have read-only access — ideal for extended family members who want to explore and cherish records without making modifications.",
  },
  {
    q: "Is my family data kept private?",
    a: "Yes. Every family tree is maintained in its own dedicated, isolated vault. Your data is never commingled with other accounts and is never sold to third parties.",
  },
];

export default function RootlineSupport() {
  const { user } = useAuth();

  const [category, setCategory] = useState("General Inquiry");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!subject.trim()) {
      setError("Please enter a subject for your query.");
      return;
    }
    if (!message.trim() || message.trim().length < 10) {
      setError("Please provide a message with at least 10 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await api.sendSupportQuery({
        email: user.email,
        name: user.name,
        category,
        subject: `[${category}] ${subject.trim()}`,
        message: message.trim(),
      });
      setSubmitted(true);
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(err.message || "Failed to submit query. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F7F5F0] flex flex-col font-sans">
      <AppHeader />

      <main className="flex-1 px-6 sm:px-10 lg:px-16 py-10 lg:py-14 max-w-6xl mx-auto w-full">
        {/* Back breadcrumb */}
        <div className="mb-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B7280] hover:text-[#1C1F1D] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Overview
          </Link>
        </div>

        {/* Page Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-8 h-8 rounded-lg bg-[#1C4B3C]/10 flex items-center justify-center text-[#1C4B3C]">
              <LifeBuoy className="w-4 h-4" />
            </span>
            <p className="text-[11px] tracking-[0.2em] font-semibold text-[#C9A468] uppercase">
              Help & Support
            </p>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1C1F1D] mb-2">
            How can we help you?
          </h1>
          <p className="text-sm text-[#6B7280] max-w-xl leading-relaxed">
            Have a question, feedback, or need assistance with your family tree? Send a message directly to the site owner and team. We'll reply to your registered email.
          </p>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.8fr)] gap-8 items-start">
          {/* Form Column (Left 2 cols) */}
          <div>
            <div className="bg-white border border-[#E7E2D6] rounded-2xl p-7 shadow-xs">
              {submitted ? (
                <div className="text-center py-8 px-4">
                  <div className="w-14 h-14 rounded-full bg-[#1C4B3C]/10 border border-[#1C4B3C]/20 flex items-center justify-center mx-auto mb-4 text-[#1C4B3C]">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h2 className="text-xl font-serif font-bold text-[#1C1F1D] mb-2">
                    Query Submitted Successfully
                  </h2>
                  <p className="text-sm text-[#6B7280] max-w-md mx-auto mb-6 leading-relaxed">
                    Thank you, <strong className="text-[#1C1F1D]">{user?.name}</strong>. Your query has been forwarded to the site owner. We will get back to you at <strong className="text-[#1C1F1D]">{user?.email}</strong>.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="text-xs font-semibold text-[#1C4B3C] hover:underline"
                  >
                    Submit another question or query →
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Sender summary card */}
                  <div className="flex items-center gap-3 p-3 bg-[#F7F5F0] border border-[#E7E2D6] rounded-xl text-xs text-[#6B7280]">
                    <Mail className="w-4 h-4 text-[#1C4B3C] shrink-0" />
                    <div className="truncate">
                      <span>Submitting as </span>
                      <strong className="text-[#1C1F1D] font-medium">{user?.name}</strong> (
                      <span className="text-[#374151]">{user?.email}</span>)
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">
                      Inquiry Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-[#FAF8F4] border border-[#E7E2D6] rounded-xl px-3.5 py-2.5 text-sm text-[#1C1F1D] focus:outline-none focus:border-[#1C4B3C] focus:bg-white transition-colors"
                    >
                      <option value="General Inquiry">General Inquiry</option>
                      <option value="Family Tree & Kinship">Family Tree & Kinship Questions</option>
                      <option value="Sharing & Permissions">Sharing & Access Issues</option>
                      <option value="Account & Security">Account & Password Questions</option>
                      <option value="Bug or Issue Report">Report a Bug or Feedback</option>
                    </select>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Brief summary of your question or issue"
                      required
                      maxLength={150}
                      className="w-full bg-[#FAF8F4] border border-[#E7E2D6] rounded-xl px-3.5 py-2.5 text-sm text-[#1C1F1D] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#1C4B3C] focus:bg-white transition-colors"
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">
                      Message / Query
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={5}
                      placeholder="Please describe your query, question, or issue in detail..."
                      required
                      maxLength={5000}
                      className="w-full bg-[#FAF8F4] border border-[#E7E2D6] rounded-xl px-3.5 py-2.5 text-sm text-[#1C1F1D] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#1C4B3C] focus:bg-white transition-colors resize-y"
                    />
                    <p className="text-[11px] text-[#9CA3AF] mt-1 text-right">
                      {message.length}/5000 characters
                    </p>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2 flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#1C4B3C] hover:bg-[#163D31] active:scale-[0.99] disabled:opacity-60 transition-all rounded-xl shadow-xs"
                    >
                      {submitting ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" /> Submit Query
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Right Column: Support Info & FAQs */}
          <div className="space-y-6">
            <div className="bg-white border border-[#E7E2D6] rounded-2xl p-5 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1C1F1D] uppercase tracking-wide mb-3">
                <ShieldCheck className="w-4 h-4 text-[#1C4B3C]" /> Direct Owner Notice
              </div>
              <p className="text-xs text-[#6B7280] leading-relaxed mb-3">
                Because Rootline does not use third-party ticketing queues, submitting this form sends a notification directly to the site owner.
              </p>
              <p className="text-xs text-[#9CA3AF]">
                Replies are delivered straight to your registered account email.
              </p>
            </div>

            <div className="bg-white border border-[#E7E2D6] rounded-2xl p-5 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1C1F1D] uppercase tracking-wide mb-4">
                <HelpCircle className="w-4 h-4 text-[#C9A468]" /> Common Questions
              </div>
              <div className="space-y-4">
                {FAQ_ITEMS.map(({ q, a }) => (
                  <div key={q} className="border-b border-[#E7E2D6]/70 pb-3 last:border-0 last:pb-0">
                    <p className="text-xs font-semibold text-[#1C1F1D] mb-1">{q}</p>
                    <p className="text-[11px] text-[#6B7280] leading-relaxed">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
