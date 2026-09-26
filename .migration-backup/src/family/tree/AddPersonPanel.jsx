import React, { useState } from "react";
import { User, Calendar } from "lucide-react";
import { useFamily } from "../FamilyContext.jsx";

const inputClass =
  "w-full rounded-lg border border-[#D9D3C3] bg-white px-3 py-2 text-sm text-[#1C1F1D] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 focus:border-[#1C4B3C]";
const inputWithIconClass = `${inputClass} pl-9`;

function Field({ label, icon: Icon, children }) {
  return (
    <label className="block mb-4">
      <span className="block text-xs font-medium text-[#374151] mb-1.5">{label}</span>
      <div className="relative">
        {Icon && <Icon className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />}
        {children}
      </div>
    </label>
  );
}

export const RELATION_OPTIONS = [
  { value: "father", label: "is their father" },
  { value: "mother", label: "is their mother" },
  { value: "parent", label: "is their parent" },
  { value: "spouse", label: "is their spouse / partner" },
  { value: "child", label: "is their child" },
  { value: "sibling", label: "is their sibling" },
];

const emptyForm = { name: "", dob: "", dod: "", gender: "unspecified", notes: "" };

export default function AddPersonPanel() {
  const { people, addPerson } = useFamily();

  const [form, setForm] = useState(emptyForm);
  const [relationType, setRelationType] = useState("father");
  const [relatedToId, setRelatedToId] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const relatedPerson = people.find((person) => person.id === relatedToId);
  const addingParent = ["father", "mother", "parent"].includes(relationType);
  const parentFamilies = relatedPerson?.parentFamilies || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (people.length > 0 && !relatedToId) {
      setError("Choose who this person is related to.");
      return;
    }
    if (addingParent && parentFamilies.length > 1 && !familyId) {
      setError("Choose which parent family this person belongs to.");
      return;
    }

    setSaving(true);
    try {
      const relation =
        people.length === 0
          ? null
          : { type: relationType, toId: relatedToId, familyId: familyId || null };
      await addPerson(form, relation);
      setForm(emptyForm);
      setRelatedToId("");
      setFamilyId("");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="w-full lg:w-[340px] shrink-0 border-b lg:border-b-0 lg:border-r border-[#E7E2D6] bg-[#FBFAF6]">
      <div className="lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto px-6 py-8">
        <h2 className="text-lg font-serif font-bold text-[#1C1F1D] mb-1">Add a family member</h2>
        <p className="text-xs text-[#6B7280] mb-6">
          Fill this in — the tree on the right updates as soon as you save.
        </p>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 text-sm text-[#B3441C] bg-[#FBEAE1] border border-[#F0C7B3] rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <Field label="Full name" icon={User}>
            <input
              type="text"
              value={form.name}
              onChange={update("name")}
              placeholder="e.g. Meera Rao"
              className={inputWithIconClass}
            />
          </Field>

          <label className="block mb-4">
            <span className="block text-xs font-medium text-[#374151] mb-1.5">Gender</span>
            <select value={form.gender} onChange={update("gender")} className={inputClass}>
              <option value="unspecified">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date of birth" icon={Calendar}>
              <input type="date" value={form.dob} onChange={update("dob")} className={inputWithIconClass} />
            </Field>
            <Field label="Date of death" icon={Calendar}>
              <input type="date" value={form.dod} onChange={update("dod")} className={inputWithIconClass} />
            </Field>
          </div>

          {people.length > 0 ? (
            <div className="border-t border-[#E7E2D6] pt-4 mt-1 mb-2">
              <span className="block text-xs font-medium text-[#374151] mb-2">Relationship</span>
              <select
                value={relationType}
                onChange={(e) => setRelationType(e.target.value)}
                className={`${inputClass} mb-2`}
              >
                {RELATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {form.name || "This person"} {opt.label}
                  </option>
                ))}
              </select>
              <span className="block text-xs font-medium text-[#374151] mb-1.5">Related to</span>
              <select
                value={relatedToId}
                onChange={(e) => {
                  setRelatedToId(e.target.value);
                  setFamilyId("");
                }}
                className={inputClass}
              >
                <option value="">Select a person…</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {addingParent && parentFamilies.length > 1 && (
                <>
                  <span className="block text-xs font-medium text-[#374151] mt-3 mb-1.5">
                    Parent family
                  </span>
                  <select
                    value={familyId}
                    onChange={(e) => setFamilyId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Choose a parent family…</option>
                    {parentFamilies.map((family) => {
                      const names = family.partner_ids
                        .map((id) => people.find((person) => person.id === id)?.name)
                        .filter(Boolean);
                      return (
                        <option key={family.id} value={family.id}>
                          {names.length ? names.join(" & ") : "Unknown parent family"}
                        </option>
                      );
                    })}
                  </select>
                </>
              )}
            </div>
          ) : (
            <p className="text-xs text-[#9CA3AF] mb-2">
              This is the first person in your tree — no relationship needed yet.
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full mt-5 bg-[#1C4B3C] text-white text-sm font-medium rounded-lg py-2.5 hover:bg-[#163C30] transition-colors disabled:opacity-60"
          >
            {saving ? "Adding…" : "Add to tree"}
          </button>
        </form>
      </div>
    </aside>
  );
}
