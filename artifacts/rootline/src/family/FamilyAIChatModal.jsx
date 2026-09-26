import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Sparkles,
  Send,
  Trash2,
  Users,
  Bot,
  User,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Zap,
  ChevronDown,
  RotateCcw,
  Check,
  Search,
  MessageSquare,
  BookOpen,
} from "lucide-react";
import { api } from "../api.js";
import { useFamily } from "./FamilyContext.jsx";
import { getPersonDisambiguation } from "./RelationshipExplorerModal.jsx";

// Quick suggested prompts
const SUGGESTED_PROMPTS = [
  "How are members related in our family?",
  "What does 'first cousin once removed' mean?",
  "Who is the oldest ancestor in this tree?",
  "What is the difference between consanguinity and affinity?",
  "What questions should I ask elders for oral family history?",
  "Explain double first cousins vs regular cousins",
];

export default function FamilyAIChatModal({
  isOpen,
  onClose,
  initialPersonAId = null,
  initialPersonBId = null,
}) {
  const { people, rootPersonId, activeFamilyId, activeFamily } = useFamily();

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [providerPreference, setProviderPreference] = useState("auto"); // "auto" | "gemini" | "groq"
  const [showPairSelector, setShowPairSelector] = useState(false);

  // Quick Pair Selection for direct relationship question
  const [pairAId, setPairAId] = useState("");
  const [pairBId, setPairBId] = useState("");

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load chat history for the active isolated family
  useEffect(() => {
    if (!isOpen) return;

    // Initialize pair selector defaults
    const defaultA = initialPersonAId || rootPersonId || (people[0]?.id ?? "");
    let defaultB = initialPersonBId || "";
    if (!defaultB && people.length > 1) {
      defaultB = people.find((p) => p.id !== defaultA)?.id || "";
    }
    setPairAId(defaultA);
    setPairBId(defaultB);

    // If initial pair was provided, automatically open pair selector or prefill
    if (initialPersonBId && initialPersonBId !== initialPersonAId) {
      const pA = people.find((p) => p.id === defaultA);
      const pB = people.find((p) => p.id === defaultB);
      if (pA && pB) {
        setInputText(`How is ${pB.name} related to ${pA.name}?`);
      }
    }

    // Fetch persistent history isolated to this family
    const loadHistory = async () => {
      try {
        const res = await api.getAIChatHistory(activeFamilyId);
        if (res?.messages && res.messages.length > 0) {
          setMessages(res.messages);
        } else {
          // Default initial friendly greeting
          setMessages([
            {
              id: "welcome-init",
              role: "assistant",
              content: `Hello! I am your **Rootline Kinship & Family AI Assistant** for the **${
                activeFamily?.name || "Active"
              }** family tree.\n\nI can help you:\n• **Understand Relationships**: Ask how any two relatives are connected.\n• **Trace Lineage Paths**: Discover parents, children, and generational steps.\n• **General Kinship Knowledge**: Learn about cousins, granduncles, consanguinity, or oral history tips.\n\nEverything in our chat is strictly isolated to this family tree. What would you like to explore?`,
              provider: "rule_based_fallback",
              model: "local-kinship-engine",
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      }
    };

    loadHistory();
    setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen, activeFamilyId, initialPersonAId, initialPersonBId, rootPersonId, people, activeFamily]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend = null, explicitP1 = null, explicitP2 = null) => {
    const text = (textToSend || inputText).trim();
    if (!text || loading) return;

    setInputText("");
    setError("");
    setLoading(true);

    // Optimistic user message update
    const userMsg = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const payload = {
        message: text,
        family_id: activeFamilyId,
        preferred_provider: providerPreference,
        person1_id: explicitP1 || (showPairSelector ? pairAId : null),
        person2_id: explicitP2 || (showPairSelector ? pairBId : null),
      };

      const res = await api.sendAIChatMessage(payload);

      if (res?.message) {
        setMessages((prev) => [...prev, res.message]);
      }
    } catch (err) {
      setError(err.message || "Failed to get response from Family AI");
      // Add error assistant message
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `I ran into an issue processing that query: ${err.message || "Unknown error"}. Please check your connection or try another question.`,
          isError: true,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Are you sure you want to clear this family's chat history?")) {
      return;
    }
    try {
      await api.clearAIChatHistory(activeFamilyId);
      setMessages([
        {
          id: `welcome-${Date.now()}`,
          role: "assistant",
          content: `Chat history cleared. How can I help you explore relationships in the **${
            activeFamily?.name || "Active"
          }** family tree?`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setError(err.message || "Failed to clear chat history");
    }
  };

  const handleCalculatePair = () => {
    if (!pairAId || !pairBId || pairAId === pairBId) return;
    const pA = people.find((p) => p.id === pairAId);
    const pB = people.find((p) => p.id === pairBId);
    if (!pA || !pB) return;

    const query = `How is ${pB.name} related to ${pA.name}? Please explain their genealogical relationship step by step.`;
    setShowPairSelector(false);
    handleSendMessage(query, pairAId, pairBId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl border border-[#E7E2D6] overflow-hidden flex flex-col h-[90vh] max-h-[780px]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E7E2D6] bg-[#FAF9F5] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#1C4B3C] text-white flex items-center justify-center shadow-xs shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-serif font-bold text-[#1C1F1D] truncate">
                  Family & Kinship AI
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Isolated Tree
                </span>
              </div>
              <p className="text-xs text-[#6B7280] truncate">
                {activeFamily?.name || "Family"} tree · {people.length} members · Dual Gemini & Groq AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Engine Selector */}
            <div className="hidden md:flex items-center gap-1 text-[11px] bg-white border border-[#D9D3C3] rounded-lg px-2 py-1 shadow-2xs">
              <Zap className="w-3 h-3 text-amber-500 shrink-0" />
              <select
                value={providerPreference}
                onChange={(e) => setProviderPreference(e.target.value)}
                className="bg-transparent text-xs text-[#374151] font-medium outline-none cursor-pointer pr-1"
                title="AI Engine Preference with Automatic Failover"
              >
                <option value="auto">Auto Failover (Gemini + Groq)</option>
                <option value="gemini">Prefer Gemini 3.8 Flash</option>
                <option value="groq">Prefer Groq Llama 3.3</option>
              </select>
            </div>

            {/* Clear history button */}
            <button
              type="button"
              onClick={handleClearHistory}
              title="Clear chat history for this family"
              className="p-2 text-[#6B7280] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-[#6B7280] hover:text-[#1C1F1D] hover:bg-[#EBE7DF] rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-toolbar / Quick Pair Finder toggle */}
        <div className="px-5 py-2 bg-[#F3F0E6]/60 border-b border-[#E7E2D6] flex items-center justify-between text-xs text-[#6B7280] shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#1C4B3C]" />
            <span>Ask anything about family relationships or genealogy general knowledge.</span>
          </div>
          <button
            type="button"
            onClick={() => setShowPairSelector((prev) => !prev)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              showPairSelector
                ? "bg-[#1C4B3C] text-white"
                : "bg-white text-[#1C4B3C] border border-[#D9D3C3] hover:bg-[#E7F1EB]"
            }`}
          >
            <Users className="w-3 h-3" />
            <span>{showPairSelector ? "Hide Pair Selector" : "Compare Two Relatives"}</span>
          </button>
        </div>

        {/* Collapsible Pair Selector for precise relationship inquiry */}
        {showPairSelector && (
          <div className="px-5 py-3.5 bg-[#FAF9F5] border-b border-[#E7E2D6] space-y-3 shrink-0 animate-fade-in">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                  First Person (Reference)
                </label>
                <select
                  value={pairAId}
                  onChange={(e) => setPairAId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-[#D9D3C3] bg-white p-2 text-[#1C1F1D] focus:ring-2 focus:ring-[#1C4B3C]/20"
                >
                  {people.map((p) => {
                    const info = getPersonDisambiguation(p, people);
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} {info.subtitle ? `(${info.subtitle})` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                  Second Person (Relative)
                </label>
                <select
                  value={pairBId}
                  onChange={(e) => setPairBId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-[#D9D3C3] bg-white p-2 text-[#1C1F1D] focus:ring-2 focus:ring-[#1C4B3C]/20"
                >
                  {people.map((p) => {
                    const info = getPersonDisambiguation(p, people);
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} {info.subtitle ? `(${info.subtitle})` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPairSelector(false)}
                className="px-3 py-1.5 text-xs text-[#6B7280] hover:text-[#1C1F1D]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCalculatePair}
                disabled={!pairAId || !pairBId || pairAId === pairBId}
                className="px-3.5 py-1.5 bg-[#1C4B3C] text-white rounded-lg text-xs font-medium hover:bg-[#163C30] transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ask AI About This Pair</span>
              </button>
            </div>
          </div>
        )}

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-white">
          {messages.map((msg, index) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id || index}
                className={`flex gap-3 items-start ${isUser ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-2xs ${
                    isUser
                      ? "bg-[#1C1F1D] text-white"
                      : "bg-[#1C4B3C] text-white"
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[82%] rounded-2xl p-4 text-xs leading-relaxed ${
                    isUser
                      ? "bg-[#1C4B3C] text-white rounded-tr-xs"
                      : msg.isError
                      ? "bg-red-50 text-red-800 border border-red-200 rounded-tl-xs"
                      : "bg-[#FAF9F5] text-[#1C1F1D] border border-[#E7E2D6] rounded-tl-xs shadow-2xs"
                  }`}
                >
                  {/* Rich Formatted Content */}
                  <div className="space-y-2 whitespace-pre-wrap break-words">
                    {msg.content}
                  </div>

                  {/* Provider / Failover Meta Footer for Assistant */}
                  {!isUser && (msg.provider || msg.model) && (
                    <div className="mt-2.5 pt-2 border-t border-[#E7E2D6]/60 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#9CA3AF]">
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-600" />
                        <span>
                          {msg.provider === "gemini"
                            ? `Gemini (${msg.model || "3.8 Flash"})`
                            : msg.provider === "groq"
                            ? `Groq (${msg.model || "Llama 3.3"})`
                            : "Offline Kinship Engine"}
                        </span>
                      </span>
                      {msg.failoverOccurred && (
                        <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium">
                          Auto-Failover Active
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading bubble */}
          {loading && (
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-[#1C4B3C] text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Bot className="w-4 h-4 animate-pulse" />
              </div>
              <div className="bg-[#FAF9F5] border border-[#E7E2D6] rounded-2xl rounded-tl-xs p-4 text-xs text-[#6B7280] shadow-2xs flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-[#1C4B3C] animate-bounce" />
                <span className="inline-block w-2 h-2 rounded-full bg-[#1C4B3C] animate-bounce [animation-delay:0.2s]" />
                <span className="inline-block w-2 h-2 rounded-full bg-[#1C4B3C] animate-bounce [animation-delay:0.4s]" />
                <span className="ml-1 font-medium">Consulting family records & kinship pathways…</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-5 py-2.5 bg-[#FAF9F5] border-t border-[#E7E2D6] overflow-x-auto flex items-center gap-2 scrollbar-thin shrink-0">
          <span className="text-[11px] font-semibold text-[#9CA3AF] shrink-0 flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            Try:
          </span>
          {SUGGESTED_PROMPTS.map((promptText, idx) => (
            <button
              key={idx}
              type="button"
              disabled={loading}
              onClick={() => handleSendMessage(promptText)}
              className="shrink-0 px-2.5 py-1 text-[11px] bg-white border border-[#D9D3C3] rounded-full text-[#374151] hover:text-[#1C4B3C] hover:border-[#1C4B3C] hover:bg-[#E7F1EB] transition-colors whitespace-nowrap shadow-2xs disabled:opacity-50"
            >
              {promptText}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white border-t border-[#E7E2D6] shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Ask about relationships, relatives, or genealogy in ${activeFamily?.name || "family"}…`}
              disabled={loading}
              className="flex-1 text-xs rounded-xl border border-[#D9D3C3] bg-[#FAF9F5] px-4 py-3 text-[#1C1F1D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 transition-all placeholder-[#9CA3AF]"
            />
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="px-4 py-3 bg-[#1C4B3C] text-white rounded-xl text-xs font-semibold hover:bg-[#163C30] transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-sm shrink-0"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
