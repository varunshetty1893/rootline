import { useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, RotateCcw, Send, Sparkles, UserRound, X } from "lucide-react";
import { api } from "../api.js";
import { findRelationship } from "./relationship.js";
import { useFamily } from "./FamilyContext.jsx";

const welcome = {
  role: "assistant",
  text: "Hello! I’m your Family Guide. Ask how anyone in this tree relates to you, compare two relatives, or ask about anyone’s parents, spouse, and children.",
  provider: "Rootline Guide",
};

function cleanDisplayMessage(raw) {
  if (!raw || typeof raw !== "string") return "";
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/^\s*[*_-]{3,}\s*$/gm, "")
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, "$1")
    .replace(/\*{2,}/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[\*\-]\s+/gm, "• ")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatProviderLabel(provider) {
  if (!provider) return "Rootline Guide";
  const lower = String(provider).toLowerCase();
  if (lower === "gemini") return "Gemini AI";
  if (lower === "groq") return "Groq AI";
  if (lower === "rule_based_fallback" || lower.includes("rootline")) return "Rootline Kinship Guide";
  return provider;
}

function personDescription(person, people) {
  const spouse = (person.spouseIds || []).map((id) => people.find((candidate) => candidate.id === id)?.name).filter(Boolean)[0];
  const parent = (person.parentIds || []).map((id) => people.find((candidate) => candidate.id === id)?.name).filter(Boolean)[0];
  const clues = [spouse && `spouse of ${spouse}`, parent && `child of ${parent}`, person.address && `from ${person.address}`].filter(Boolean);
  return clues.length ? `${person.name} — ${clues.join(" · ")}` : `${person.name} — no extra details recorded`;
}

export default function RelationshipChat({
  people = [],
  rootPersonId,
  selectedPerson,
  selectedRelationship,
  defaultOpen = false,
  openSignal = 0,
  isMobileSheetOpen = false,
  isMobileSheetMinimized = false,
}) {
  const familyCtx = useFamily();
  const activeFamilyId = familyCtx?.activeFamilyId || null;
  const activeFamilyName = familyCtx?.activeFamily?.name || "Family Tree";

  const safePeople = Array.isArray(people) ? people : [];
  const [open, setOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState([welcome]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const rootPerson = safePeople.find((person) => person.id === rootPersonId);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, sending]);

  useEffect(() => {
    if (openSignal) setOpen(true);
  }, [openSignal]);

  const sendQuestion = async (question, subject = selectedPerson) => {
    const cleanQ = question.trim();
    if (!cleanQ || sending) return;

    const subjectRelationship = subject?.id === selectedPerson?.id
      ? selectedRelationship
      : subject && rootPerson ? findRelationship(rootPerson.id, subject.id, safePeople) : null;

    setMessages((items) => [...items, { role: "user", text: cleanQ }]);
    setSending(true);
    try {
      const response = await api.askRelationshipAssistant({
        message: cleanQ,
        family_id: activeFamilyId,
        root_person_id: rootPerson?.id || rootPersonId || null,
        selected_person_id: subject?.id || null,
        root_person_name: rootPerson?.name || null,
        selected_person_name: subject?.name || null,
        selected_relationship: subjectRelationship?.label || null,
        people: safePeople.slice(0, 120).map((person) => ({
          id: person.id,
          name: person.name,
          gender: person.gender || null,
          address: person.address || null,
          parents: (person.parentIds || []).map((id) => safePeople.find((candidate) => candidate.id === id)?.name).filter(Boolean),
          spouses: (person.spouseIds || []).map((id) => safePeople.find((candidate) => candidate.id === id)?.name).filter(Boolean),
        })),
      });
      setMessages((items) => [
        ...items,
        {
          role: "assistant",
          text: cleanDisplayMessage(response.answer),
          provider: formatProviderLabel(response.provider),
        },
      ]);
    } catch (error) {
      setMessages((items) => [
        ...items,
        {
          role: "assistant",
          text: error.message || "I couldn’t answer that just now. Please try again.",
          provider: "Unavailable",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const question = message.trim();
    if (!question || sending) return;
    setMessage("");
    const lowerQuestion = question.toLowerCase();
    const duplicateName = [...new Set(safePeople.filter((person) => lowerQuestion.includes(person.name.toLowerCase())).map((person) => person.name.toLowerCase()))]
      .find((name) => safePeople.filter((person) => person.name.toLowerCase() === name).length > 1);
    if (duplicateName) {
      const candidates = safePeople.filter((person) => person.name.toLowerCase() === duplicateName);
      const describedCandidate = candidates.find((person) => {
        const clues = [person.address, ...(person.spouseIds || []).map((id) => safePeople.find((candidate) => candidate.id === id)?.name), ...(person.parentIds || []).map((id) => safePeople.find((candidate) => candidate.id === id)?.name)].filter(Boolean);
        return clues.some((clue) => lowerQuestion.includes(clue.toLowerCase()));
      });
      if (!describedCandidate) {
        setMessages((items) => [...items, {
          role: "assistant",
          text: `I found ${candidates.length} people named ${candidates[0].name}. Which one do you mean?`,
          provider: "Rootline Guide",
          options: candidates.map((person) => ({ id: person.id, label: personDescription(person, safePeople), question })),
        }]);
        return;
      }
      await sendQuestion(question, describedCandidate);
      return;
    }
    await sendQuestion(question);
  };

  const quickPrompts = [];
  if (selectedPerson && rootPerson && selectedPerson.id !== rootPerson.id) {
    quickPrompts.push(`How is ${selectedPerson.name} related to ${rootPerson.name}?`);
    quickPrompts.push(`Tell me about ${selectedPerson.name}`);
  } else if (selectedPerson) {
    quickPrompts.push(`Tell me about ${selectedPerson.name}`);
  }
  quickPrompts.push("Who is in this family tree?");
  quickPrompts.push("Who is the oldest ancestor?");

  const floatingPosClass = isMobileSheetOpen
    ? isMobileSheetMinimized
      ? "bottom-20 right-4 sm:bottom-7 sm:right-7"
      : "bottom-[calc(52dvh+14px)] right-4 sm:bottom-7 sm:right-7"
    : "bottom-5 right-5 sm:bottom-7 sm:right-7";

  return (
    <div className={`fixed z-40 transition-all duration-200 ${floatingPosClass}`}>
      {open && (
        <section className="mb-3 flex h-[min(600px,calc(100dvh-140px))] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-3xl border border-[#1C4B3C]/15 bg-[#FFFEFB] shadow-2xl">
          <div className="flex items-start justify-between bg-gradient-to-br from-[#174F61] to-[#1C4B3C] px-5 py-3.5 text-white">
            <div className="flex gap-3 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold truncate">Family Guide</h2>
                <p className="mt-0.5 text-[11px] text-white/80 truncate">
                  {activeFamilyName} · {safePeople.length} {safePeople.length === 1 ? "member" : "members"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setMessages([welcome])}
                title="Reset conversation"
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="Reset conversation"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 hover:bg-white/10"
                aria-label="Close family guide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {selectedPerson && (
            <div className="bg-[#E7F1EB] border-b border-[#1C4B3C]/10 px-4 py-1.5 flex items-center justify-between text-[11px] text-[#1C4B3C]">
              <span className="truncate font-medium">
                Focused on: <strong>{selectedPerson.name}</strong>
                {selectedRelationship?.label ? ` (${selectedRelationship.label})` : ""}
              </span>
            </div>
          )}

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-[#F7F5F0]/70 p-4">
            {messages.map((item, index) => {
              const cleanedText = cleanDisplayMessage(item.text);
              return (
                <div key={`${item.role}-${index}`} className={`flex gap-2 ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                  {item.role === "assistant" && (
                    <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1C4B3C]/10 text-[#1C4B3C]">
                      <Bot className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <div
                    className={`max-w-[84%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      item.role === "user"
                        ? "rounded-br-md bg-[#1C4B3C] text-white"
                        : "rounded-bl-md border border-[#E7E2D6] bg-white text-[#374151] shadow-2xs"
                    }`}
                  >
                    <div className="space-y-1.5 whitespace-pre-wrap break-words">{cleanedText}</div>
                    {item.options && (
                      <div className="mt-2 space-y-1.5">
                        {item.options.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            disabled={sending}
                            onClick={() => sendQuestion(option.question, safePeople.find((person) => person.id === option.id))}
                            className="block w-full rounded-lg border border-[#1C4B3C]/20 bg-[#F7F5F0] px-2.5 py-2 text-left text-[11px] font-medium text-[#1C4B3C] hover:bg-[#E7F1EB] disabled:opacity-50"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {item.provider && (
                      <p className="mt-1.5 text-[9px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                        {formatProviderLabel(item.provider)}
                      </p>
                    )}
                  </div>
                  {item.role === "user" && (
                    <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1C4B3C] text-white">
                      <UserRound className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              );
            })}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-[#6B7280] pl-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-[#1C4B3C]" />
                <span>Checking your family tree…</span>
              </div>
            )}
          </div>

          {/* Quick Suggested Questions */}
          {quickPrompts.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto border-t border-[#E7E2D6] bg-[#FAF8F4] px-3 py-2 scrollbar-none">
              {quickPrompts.slice(0, 3).map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={sending}
                  onClick={() => sendQuestion(q)}
                  className="shrink-0 rounded-full border border-[#D9D3C3] bg-white px-2.5 py-1 text-[10px] font-medium text-[#1C4B3C] hover:bg-[#E7F1EB] hover:border-[#1C4B3C]/30 disabled:opacity-40 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="border-t border-[#E7E2D6] bg-white p-3">
            <div className="flex items-center gap-2 rounded-2xl border border-[#D9D3C3] bg-[#FAF8F4] px-3 py-1 focus-within:border-[#1C4B3C]">
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={2000}
                placeholder={selectedPerson ? `Ask about ${selectedPerson.name}…` : "Ask about your family…"}
                className="min-w-0 flex-1 bg-transparent py-2 text-xs text-[#1C1F1D] outline-none placeholder:text-[#9CA3AF]"
              />
              <button
                type="submit"
                disabled={!message.trim() || sending}
                className="rounded-xl bg-[#1C4B3C] p-2 text-white disabled:opacity-40 hover:bg-[#163C30] transition-colors"
                aria-label="Send question"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </section>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="group flex items-center gap-2 rounded-full bg-[#1C4B3C] px-3.5 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold text-white shadow-xl transition-all duration-200 hover:bg-[#163C30] active:scale-95"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        <span className={isMobileSheetOpen && !isMobileSheetMinimized ? "hidden xs:inline" : ""}>Family guide</span>
      </button>
    </div>
  );
}
