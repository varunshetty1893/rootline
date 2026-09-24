import React, { useState, useEffect } from "react";
import { X, Check, User, Calendar, MapPin, Briefcase, FileText, Image } from "lucide-react";
import { useFamily } from "../FamilyContext.jsx";

export default function TreeQuickEditModal({ isOpen, onClose, person }) {
  const { updatePerson } = useFamily();
  const [form, setForm] = useState({
    name: "",
    gender: "unspecified",
    dob: "",
    dod: "",
    place_of_birth: "",
    occupation: "",
    notes: "",
    photo_url: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (person) {
      setForm({
        name: person.name || "",
        gender: person.gender || "unspecified",
        dob: person.dob || person.date_of_birth || "",
        dod: person.dod || person.date_of_death || "",
        place_of_birth: person.place_of_birth || "",
        occupation: person.occupation || "",
        notes: person.notes || person.bio || "",
        photo_url: person.photo_url || "",
      });
      setError("");
    }
  }, [person, isOpen]);

  if (!isOpen || !person) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      await updatePerson(person.id, {
        name: form.name.trim(),
        gender: form.gender,
        dob: form.dob || null,
        dod: form.dod || null,
        place_of_birth: form.place_of_birth || null,
        occupation: form.occupation || null,
        notes: form.notes || null,
        photo_url: form.photo_url || null,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to update person");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-[#E7E2D6] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E7E2D6] flex items-center justify-between bg-[#FAF9F5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1C4B3C]/10 flex items-center justify-center text-[#1C4B3C]">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-serif font-bold text-[#1C1F1D]">Edit Person</h2>
              <p className="text-[11px] text-[#6B7280]">Update details directly in the tree</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#6B7280] hover:text-[#1C1F1D] hover:bg-[#EBE7DF] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-[#1C1F1D] mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D9D3C3] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/20 focus:border-[#1C4B3C]"
              placeholder="e.g. Ramesh Shetty"
              required
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block text-xs font-semibold text-[#1C1F1D] mb-1">Gender</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "male", label: "Male" },
                { id: "female", label: "Female" },
                { id: "other", label: "Other" },
                { id: "unspecified", label: "Unknown" },
              ].map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setForm({ ...form, gender: g.id })}
                  className={`text-xs py-1.5 rounded-lg border font-medium transition-colors ${
                    form.gender === g.id
                      ? "bg-[#1C4B3C] text-white border-[#1C4B3C]"
                      : "bg-white border-[#D9D3C3] text-[#374151] hover:bg-[#FAF9F5]"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1C1F1D] mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#9CA3AF]" />
                Date / Year of Birth
              </label>
              <input
                type="text"
                value={form.dob}
                onChange={(e) => setForm({ ...form, dob: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D9D3C3] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/20 focus:border-[#1C4B3C]"
                placeholder="YYYY or YYYY-MM-DD"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1C1F1D] mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#9CA3AF]" />
                Date / Year of Death
              </label>
              <input
                type="text"
                value={form.dod}
                onChange={(e) => setForm({ ...form, dod: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D9D3C3] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/20 focus:border-[#1C4B3C]"
                placeholder="YYYY (or leave blank)"
              />
            </div>
          </div>

          {/* Place & Occupation */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1C1F1D] mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#9CA3AF]" />
                Place of Birth
              </label>
              <input
                type="text"
                value={form.place_of_birth}
                onChange={(e) => setForm({ ...form, place_of_birth: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D9D3C3] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/20 focus:border-[#1C4B3C]"
                placeholder="e.g. Mangalore"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1C1F1D] mb-1 flex items-center gap-1">
                <Briefcase className="w-3 h-3 text-[#9CA3AF]" />
                Occupation
              </label>
              <input
                type="text"
                value={form.occupation}
                onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D9D3C3] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/20 focus:border-[#1C4B3C]"
                placeholder="e.g. Engineer"
              />
            </div>
          </div>

          {/* Photo URL */}
          <div>
            <label className="block text-xs font-semibold text-[#1C1F1D] mb-1 flex items-center gap-1">
              <Image className="w-3 h-3 text-[#9CA3AF]" />
              Photo URL
            </label>
            <input
              type="text"
              value={form.photo_url}
              onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D9D3C3] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/20 focus:border-[#1C4B3C]"
              placeholder="https://..."
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#1C1F1D] mb-1 flex items-center gap-1">
              <FileText className="w-3 h-3 text-[#9CA3AF]" />
              Bio / Notes
            </label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D9D3C3] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/20 focus:border-[#1C4B3C]"
              placeholder="Add family anecdotes, memories, or notes…"
            />
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E7E2D6]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#1C1F1D] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1C4B3C] hover:bg-[#163C30] text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
