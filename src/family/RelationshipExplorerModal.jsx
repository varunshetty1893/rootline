import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Sparkles,
  ArrowRight,
  ArrowLeftRight,
  User,
  HelpCircle,
  MessageSquare,
  Send,
  AlertCircle,
  Search,
  ChevronDown,
  Calendar,
  Users,
  ShieldCheck,
  Check,
} from "lucide-react";
import { api } from "../api.js";
import { useFamily } from "./FamilyContext.jsx";

// Helper to provide comprehensive disambiguation for any family member
export function getPersonDisambiguation(person, allPeople = []) {
  if (!person) return { label: "", dates: "", context: "", subtitle: "", isDuplicateName: false };

  const name = person.name || "Unknown";
  const sameNameCount = allPeople.filter(
    (p) => p.id !== person.id && p.name?.trim().toLowerCase() === name.trim().toLowerCase()
  ).length;
  const isDuplicateName = sameNameCount > 0;

  // Extract birth/death dates
  const birth = person.date_of_birth
    ? person.date_of_birth.length >= 4
      ? person.date_of_birth.slice(0, 4)
      : person.date_of_birth
    : null;
  const death = person.date_of_death
    ? person.date_of_death.length >= 4
      ? person.date_of_death.slice(0, 4)
      : person.date_of_death
    : null;

  let dates = "";
  if (birth && death) {
    dates = `${birth}–${death}`;
  } else if (birth) {
    dates = `b. ${birth}`;
  } else if (death) {
    dates = `d. ${death}`;
  }

  // Extract parent or spouse context
  let context = "";
  const byId = new Map(allPeople.map((p) => [p.id, p]));

  if (person.parent_ids && person.parent_ids.length > 0) {
    const parentNames = person.parent_ids
      .map((id) => byId.get(id)?.name)
      .filter(Boolean);
    if (parentNames.length > 0) {
      context = `Child of ${parentNames.join(" & ")}`;
    }
  }

  if (!context && person.spouse_ids && person.spouse_ids.length > 0) {
    const spouseNames = person.spouse_ids
      .map((id) => byId.get(id)?.name)
      .filter(Boolean);
    if (spouseNames.length > 0) {
      context = `Partner of ${spouseNames.join(", ")}`;
    }
  }

  if (!context && person.place_of_birth) {
    context = person.place_of_birth;
  }

  const parts = [];
  if (dates) parts.push(dates);
  if (context) parts.push(context);
  const subtitle = parts.join(" · ") || (person.gender ? `${person.gender}` : "");

  return {
    label: subtitle ? `${name} (${subtitle})` : name,
    dates,
    context,
    subtitle,
    isDuplicateName,
  };
}

// Searchable Person Selector with disambiguation badges
function DisambiguatedPersonSelect({
  label,
  selectedPersonId,
  onSelect,
  people,
  excludePersonId,
  rootPersonId,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  const selectedPerson = useMemo(
    () => people.find((p) => p.id === selectedPersonId),
    [people, selectedPersonId]
  );

  const selectedInfo = useMemo(
    () => (selectedPerson ? getPersonDisambiguation(selectedPerson, people) : null),
    [selectedPerson, people]
  );

  // Filter people for the search menu
  const filteredPeople = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return people
      .filter((p) => p.id !== excludePersonId)
      .filter((p) => {
        if (!term) return true;
        const info = getPersonDisambiguation(p, people);
        return (
          p.name?.toLowerCase().includes(term) ||
          info.dates.toLowerCase().includes(term) ||
          info.context.toLowerCase().includes(term) ||
          (p.place_of_birth && p.place_of_birth.toLowerCase().includes(term))
        );
      });
  }, [people, excludePersonId, searchTerm]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-xs font-semibold text-[#374151] mb-1.5 flex items-center justify-between">
        <span>{label}</span>
        {selectedInfo?.isDuplicateName && (
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-200">
            Duplicate Name Resolved
          </span>
        )}
      </label>

      {/* Trigger Button showing selected person's full identity */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full text-left rounded-xl border p-2.5 transition-all bg-white flex items-center justify-between gap-2 shadow-2xs hover:border-[#1C4B3C]/50 ${
          isOpen ? "ring-2 ring-[#1C4B3C]/20 border-[#1C4B3C]" : "border-[#D9D3C3]"
        }`}
      >
        {selectedPerson ? (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-full bg-[#1C4B3C]/10 text-[#1C4B3C] font-serif font-bold text-xs flex items-center justify-center shrink-0 border border-[#1C4B3C]/20">
              {selectedPerson.photo_url ? (
                <img
                  src={selectedPerson.photo_url}
                  alt={selectedPerson.name}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                selectedPerson.name?.charAt(0).toUpperCase() || "?"
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#1C1F1D] truncate">
                  {selectedPerson.name}
                </span>
                {selectedPerson.id === rootPersonId && (
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold shrink-0">
                    You / Root
                  </span>
                )}
              </div>
              {selectedInfo?.subtitle ? (
                <p className="text-[11px] text-[#6B7280] truncate mt-0.5">
                  {selectedInfo.subtitle}
                </p>
              ) : (
                <p className="text-[11px] text-[#9CA3AF] italic">No dates or parent info recorded</p>
              )}
            </div>
          </div>
        ) : (
          <span className="text-xs text-[#9CA3AF] px-1">Select person…</span>
        )}
        <ChevronDown className={`w-4 h-4 text-[#9CA3AF] transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Interactive Dropdown with Live Search */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-[#D9D3C3] rounded-xl shadow-xl overflow-hidden animate-fade-in max-h-72 flex flex-col">
          {/* Search Header */}
          <div className="p-2 border-b border-[#E7E2D6] bg-[#FAF9F5] flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0 ml-1" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, birth year, or parents…"
              className="w-full text-xs bg-transparent border-none outline-none text-[#1C1F1D] placeholder-[#9CA3AF]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="text-[#9CA3AF] hover:text-[#1C1F1D] text-xs p-1"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* List of Persons */}
          <div className="overflow-y-auto flex-1 divide-y divide-[#F3F0E6]">
            {filteredPeople.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#9CA3AF]">
                No matching family members found.
              </div>
            ) : (
              filteredPeople.map((person) => {
                const info = getPersonDisambiguation(person, people);
                const isSelected = person.id === selectedPersonId;
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => {
                      onSelect(person.id);
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                    className={`w-full text-left p-2.5 flex items-center justify-between gap-2 transition-colors ${
                      isSelected
                        ? "bg-[#E7F1EB] text-[#1C4B3C]"
                        : "hover:bg-[#FAF9F5] text-[#1C1F1D]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-full bg-[#1C4B3C]/10 text-[#1C4B3C] font-serif font-bold text-xs flex items-center justify-center shrink-0 border border-[#1C4B3C]/20">
                        {person.photo_url ? (
                          <img
                            src={person.photo_url}
                            alt={person.name}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          person.name?.charAt(0).toUpperCase() || "?"
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold truncate">
                            {person.name}
                          </span>
                          {person.id === rootPersonId && (
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-medium shrink-0">
                              Root
                            </span>
                          )}
                          {info.isDuplicateName && (
                            <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-300 px-1 py-0.2 rounded font-semibold shrink-0">
                              {info.dates || "Same Name"}
                            </span>
                          )}
                        </div>
                        {info.subtitle && (
                          <p className="text-[11px] text-[#6B7280] truncate">
                            {info.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#1C4B3C] shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RelationshipExplorerModal({
  isOpen,
  onClose,
  initialPersonAId = null,
  initialPersonBId = null,
}) {
  const { people, rootPersonId, activeFamilyId } = useFamily();

  const [personAId, setPersonAId] = useState("");
  const [personBId, setPersonBId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // AI follow-up question
  const [customQuestion, setCustomQuestion] = useState("");
  const [questionLoading, setQuestionLoading] = useState(false);
  const [answerHistory, setAnswerHistory] = useState([]);

  // Initialize selected people
  useEffect(() => {
    if (isOpen) {
      const pA = initialPersonAId || rootPersonId || (people[0]?.id ?? "");
      let pB = initialPersonBId || "";
      if (!pB && people.length > 1) {
        pB = people.find((p) => p.id !== pA)?.id || "";
      }
      setPersonAId(pA);
      setPersonBId(pB);
      setResult(null);
      setError("");
      setAnswerHistory([]);
      setCustomQuestion("");
    }
  }, [isOpen, initialPersonAId, initialPersonBId, rootPersonId, people]);

  const personA = useMemo(() => people.find((p) => p.id === personAId), [people, personAId]);
  const personB = useMemo(() => people.find((p) => p.id === personBId), [people, personBId]);

  const personAInfo = useMemo(
    () => (personA ? getPersonDisambiguation(personA, people) : null),
    [personA, people]
  );
  const personBInfo = useMemo(
    () => (personB ? getPersonDisambiguation(personB, people) : null),
    [personB, people]
  );

  const hasDuplicateAmbiguity = useMemo(() => {
    return (
      (personAInfo?.isDuplicateName || personBInfo?.isDuplicateName) ||
      (personA && personB && personA.name.trim().toLowerCase() === personB.name.trim().toLowerCase())
    );
  }, [personAInfo, personBInfo, personA, personB]);

  if (!isOpen) return null;

  const handleSwap = () => {
    const temp = personAId;
    setPersonAId(personBId);
    setPersonBId(temp);
    setResult(null);
    setAnswerHistory([]);
  };

  const handleCalculate = async () => {
    if (!personAId || !personBId) return;
    setLoading(true);
    setError("");
    setResult(null);
    setAnswerHistory([]);

    try {
      const res = await api.explainRelationship({
        person1_id: personAId,
        person2_id: personBId,
        person_a_id: personAId,
        person_b_id: personBId,
        family_id: activeFamilyId,
      });
      setResult(res);
    } catch (err) {
      setError(err.message || "Could not calculate relationship.");
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!customQuestion.trim() || !personAId || !personBId) return;

    setQuestionLoading(true);
    const q = customQuestion.trim();
    setCustomQuestion("");

    try {
      const res = await api.explainRelationship({
        person1_id: personAId,
        person2_id: personBId,
        person_a_id: personAId,
        person_b_id: personBId,
        question: q,
        family_id: activeFamilyId,
      });

      setAnswerHistory((prev) => [
        ...prev,
        {
          question: q,
          explanation: res.explanation,
        },
      ]);
    } catch (err) {
      setError(err.message || "Failed to answer question.");
    } finally {
      setQuestionLoading(false);
    }
  };

  // Safe accessor for kinship properties
  const kinship = result ? result.kinship || result : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-[#E7E2D6] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E7E2D6] flex items-center justify-between bg-[#FAF9F5]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1C4B3C]/10 flex items-center justify-center text-[#1C4B3C]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-[#1C1F1D]">How Are We Related?</h2>
              <p className="text-xs text-[#6B7280]">
                Kinship pathfinding with clear identification of relatives sharing names
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#6B7280] hover:text-[#1C1F1D] hover:bg-[#EBE7DF] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Person Selection Bar with Disambiguation */}
          <div className="p-4 bg-[#FAF9F5] border border-[#E7E2D6] rounded-xl space-y-4">
            <div className="relative grid sm:grid-cols-2 gap-4 items-start">
              {/* Person A Selector */}
              <DisambiguatedPersonSelect
                label="First Person (Reference)"
                selectedPersonId={personAId}
                onSelect={(id) => {
                  setPersonAId(id);
                  setResult(null);
                }}
                people={people}
                excludePersonId={personBId}
                rootPersonId={rootPersonId}
              />

              {/* Swap Button */}
              <div className="hidden sm:flex absolute left-1/2 -translate-x-1/2 top-9 z-10">
                <button
                  type="button"
                  onClick={handleSwap}
                  title="Swap positions"
                  className="w-8 h-8 rounded-full bg-white border border-[#D9D3C3] shadow-sm flex items-center justify-center text-[#1C4B3C] hover:bg-[#E7F1EB] transition-colors"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Person B Selector */}
              <DisambiguatedPersonSelect
                label="Second Person (Relative)"
                selectedPersonId={personBId}
                onSelect={(id) => {
                  setPersonBId(id);
                  setResult(null);
                }}
                people={people}
                excludePersonId={personAId}
                rootPersonId={rootPersonId}
              />
            </div>

            {/* Same name advisory notice */}
            {hasDuplicateAmbiguity && (
              <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Name Disambiguation Active:</strong> Relatives sharing identical names are distinguished by birth/death years and parentage.
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={handleCalculate}
              disabled={loading || !personAId || !personBId || personAId === personBId}
              className="w-full py-2.5 bg-[#1C4B3C] text-white rounded-lg text-xs font-semibold hover:bg-[#163C30] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              {loading ? "Finding Kinship Connection…" : "Calculate Relationship"}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Result Presentation */}
          {result && kinship && (
            <div className="space-y-4 animate-fade-in">
              {/* Primary Kinship Badge */}
              <div className="p-5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-center space-y-3">
                <p className="text-xs uppercase tracking-wider text-emerald-800 font-semibold">
                  Genealogical Relationship
                </p>

                {/* Clear Headline with Explicit Identification */}
                <div className="space-y-1">
                  <p className="text-xl font-serif font-bold text-[#1C4B3C]">
                    {personB?.name} is {personA?.name}'s {kinship.title}
                  </p>

                  {/* Disambiguation subtitle underneath so no one is confused */}
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-emerald-900/80 font-medium">
                    <span>
                      <strong>{personB?.name}</strong> ({personBInfo?.subtitle || "Selected"})
                    </span>
                    <span>→</span>
                    <span>
                      <strong>{personA?.name}</strong> ({personAInfo?.subtitle || "Reference"})
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {kinship.generationDiff === 0
                      ? "Same Generation"
                      : kinship.generationDiff < 0
                      ? `${Math.abs(kinship.generationDiff)} Gen. Older`
                      : `${kinship.generationDiff} Gen. Younger`}
                  </span>
                  {kinship.commonAncestors?.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white text-gray-700 border border-emerald-300">
                      Shared Ancestor: {kinship.commonAncestors.map((a) => (typeof a === "object" ? a.name : a)).join(", ")}
                    </span>
                  )}
                </div>
              </div>

              {/* Breadcrumb Path with Rich Node Identification */}
              {kinship.path && kinship.path.length > 0 && (
                <div className="p-4 bg-[#FAF9F5] border border-[#E7E2D6] rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                      Lineage Connection Path
                    </h4>
                    <span className="text-[11px] text-[#9CA3AF]">
                      {kinship.path.length} steps in connection
                    </span>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-thin">
                    {kinship.path.map((node, i) => {
                      const nodeId = typeof node === "object" ? node.id : node;
                      const matchedPerson = people.find((p) => p.id === nodeId);
                      const nodeInfo = matchedPerson ? getPersonDisambiguation(matchedPerson, people) : null;
                      const displayName = (typeof node === "object" ? node.name : null) || matchedPerson?.name || nodeId;
                      const dateTag = nodeInfo?.dates || (typeof node === "object" && (node.date_of_birth || node.date_of_death)
                        ? [node.date_of_birth ? `b. ${node.date_of_birth}` : "", node.date_of_death ? `d. ${node.date_of_death}` : ""].filter(Boolean).join("–")
                        : null);

                      return (
                        <React.Fragment key={nodeId || i}>
                          <div className="shrink-0 px-3 py-2 bg-white border border-[#D9D3C3] rounded-lg text-xs font-medium text-[#1C1F1D] flex items-center gap-2 shadow-2xs">
                            <div className="w-5 h-5 rounded-full bg-[#1C4B3C]/10 text-[#1C4B3C] font-bold text-[10px] flex items-center justify-center shrink-0">
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-xs text-[#1C1F1D] flex items-center gap-1">
                                <span>{displayName}</span>
                                {nodeId === rootPersonId && (
                                  <span className="text-[8px] bg-emerald-100 text-emerald-800 px-1 rounded">Root</span>
                                )}
                              </div>
                              {dateTag && (
                                <p className="text-[10px] text-[#6B7280]">{dateTag}</p>
                              )}
                            </div>
                          </div>
                          {i < kinship.path.length - 1 && (
                            <ArrowRight className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Natural Language Explanation */}
              <div className="p-4 bg-white border border-[#E7E2D6] rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#1C1F1D]">
                  <Sparkles className="w-3.5 h-3.5 text-[#1C4B3C]" />
                  <span>Genealogical Story & Explanation</span>
                </div>
                <p className="text-xs text-[#374151] leading-relaxed">
                  {result.explanation}
                </p>
              </div>

              {/* Interactive Q&A with AI */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7280]">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Ask a Question About This Connection</span>
                </div>

                {answerHistory.map((item, idx) => (
                  <div key={idx} className="p-3 bg-[#FAF9F5] border border-[#E7E2D6] rounded-xl space-y-1.5 text-xs">
                    <p className="font-semibold text-[#1C1F1D] flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-[#1C4B3C]" />
                      {item.question}
                    </p>
                    <p className="text-[#4B5563] pl-5">{item.explanation}</p>
                  </div>
                ))}

                <form onSubmit={handleAskQuestion} className="flex gap-2">
                  <input
                    type="text"
                    value={customQuestion}
                    onChange={(e) => setCustomQuestion(e.target.value)}
                    placeholder="e.g. Which ancestor links them together?"
                    className="flex-1 text-xs rounded-lg border border-[#D9D3C3] bg-white px-3 py-2 text-[#1C1F1D] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30"
                  />
                  <button
                    type="submit"
                    disabled={questionLoading || !customQuestion.trim()}
                    className="px-3.5 py-2 bg-[#1C4B3C] text-white rounded-lg text-xs font-medium hover:bg-[#163C30] transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {questionLoading ? "Asking..." : "Ask"}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#FAF9F5] border-t border-[#E7E2D6] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[#374151] hover:text-[#1C1F1D] bg-white border border-[#D9D3C3] rounded-lg hover:bg-[#F0EDE3] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
