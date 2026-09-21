import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { User, Calendar, Camera } from "lucide-react";
import AppHeader from "./AppHeader.jsx";
import { useFamily } from "./FamilyContext.jsx";

const RELATION_OPTIONS = [
  { value: "father", label: "is their father" },
  { value: "mother", label: "is their mother" },
  { value: "parent", label: "is their parent" },
  { value: "spouse", label: "is their spouse / partner" },
  { value: "child", label: "is their child" },
  { value: "sibling", label: "is their sibling" },
];

function Field({ label, icon: Icon, children }) {
  return (
    <label className="block mb-5">
      <span className="block text-xs font-medium text-[#374151] mb-1.5">{label}</span>
      <div className="relative">
        {Icon && (
          <Icon className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
        )}
        {children}
      </div>
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-[#D9D3C3] bg-white px-3 py-2.5 text-sm text-[#1C1F1D] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 focus:border-[#1C4B3C]";
const inputWithIconClass = `${inputClass} pl-9`;

export default function PersonForm() {
  const navigate = useNavigate();
  const { id } = useParams(); // present when editing
  const { people, addPerson, updatePerson, getPerson } = useFamily();
  const fileInputRef = useRef(null);

  const editing = Boolean(id);
  const existing = editing ? getPerson(id) : null;

  const [form, setForm] = useState({
    name: "",
    dob: "",
    dod: "",
    gender: "unspecified",
    place_of_birth: "",
    occupation: "",
    address: "",
    phone: "",
    notes: "",
    photo_url: "",
  });
  const [photoPreview, setPhotoPreview] = useState("");
  const [error, setError] = useState("");
  const [relationType, setRelationType] = useState("father");
  const [relatedToId, setRelatedToId] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [familyRelationship, setFamilyRelationship] = useState("unknown");
  const [partnerStatus, setPartnerStatus] = useState("partner");

  // Pre-fill form once existing person data is available (async load)
  useEffect(() => {
    if (!editing || !existing) return;
    setForm({
      name: existing.name || "",
      dob: existing.dob || "",
      dod: existing.dod || "",
      gender: existing.gender || "unspecified",
      place_of_birth: existing.place_of_birth || "",
      occupation: existing.occupation || "",
      address: existing.address || "",
      phone: existing.phone || "",
      notes: existing.notes || "",
      photo_url: existing.photo_url || "",
    });
    if (existing.photo_url) setPhotoPreview(existing.photo_url);
  }, [editing, existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Enforce type: the HTML accept attribute is only a picker hint.
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only JPG, PNG, or WebP images are allowed.");
      e.target.value = "";
      return;
    }

    // Enforce size: 5 MB raw limit (base64 encoding adds ~33%, which the
    // backend max_length accounts for). Show the error before loading the
    // potentially huge file into memory.
    const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_BYTES) {
      setError(`Photo must be smaller than 5 MB (selected file is ${(file.size / 1024 / 1024).toFixed(1)} MB).`);
      e.target.value = "";
      return;
    }

    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setForm((f) => ({ ...f, photo_url: dataUrl }));
      setPhotoPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const relatedPerson = people.find((person) => person.id === relatedToId);
  const familyLabel = (family) => {
    const partners = (family.partner_ids || [])
      .filter((partnerId) => partnerId !== relatedToId)
      .map((partnerId) => people.find((person) => person.id === partnerId)?.name)
      .filter(Boolean);
    const partnerText = partners.length ? `With ${partners.join(" & ")}` : "Without a partner";
    return family.relationship_status && family.relationship_status !== "partner"
      ? `${partnerText} · ${family.relationship_status}`
      : partnerText;
  };

  useEffect(() => {
    if (editing || !relatedPerson) return;
    const families =
      relationType === "child"
        ? relatedPerson.partnerFamilies || []
        : relationType === "sibling"
        ? relatedPerson.parentFamilies || []
        : relationType === "parent"
        ? (relatedPerson.parentFamilies || []).filter((family) => family.partner_ids.length < 2)
        : [];
    if (families.length === 1) setFamilyId(families[0].id);
    else if (relationType === "child" && families.length === 0) setFamilyId("no-partner");
    else setFamilyId("");
  }, [editing, relationType, relatedToId, people]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!editing && people.length > 0 && !relatedToId) {
      setError("Choose who this person is related to.");
      return;
    }
    if (!editing && relatedPerson) {
      const choices =
        relationType === "child"
          ? relatedPerson.partnerFamilies || []
          : relationType === "sibling"
          ? relatedPerson.parentFamilies || []
          : relationType === "parent" || relationType === "father" || relationType === "mother"
          ? (relatedPerson.parentFamilies || []).filter((family) => family.partner_ids.length < 2)
          : [];
      if (relationType === "sibling" && choices.length === 0) {
        setError("Add a parent family to this person before adding a sibling.");
        return;
      }
      if (choices.length > 1 && !familyId) {
        setError("Choose which family this relationship belongs to.");
        return;
      }
    }

    try {
      if (editing) {
        await updatePerson(id, form);
      } else {
        const relation =
          people.length === 0
            ? null
            : {
                type: relationType,
                toId: relatedToId,
                familyId: ["no-partner", "new-family"].includes(familyId) ? null : familyId || null,
                familyRelationship,
                partnerStatus,
                newFamily: familyId === "new-family",
              };
        await addPerson(form, relation);
      }
      navigate("/manage-tree");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F7F5F0] flex flex-col">
      <AppHeader />

      <main className="flex-1 px-8 lg:px-16 py-12 max-w-xl mx-auto w-full">
        <Link to="/manage-tree" className="text-xs text-[#6B7280] hover:text-[#1C1F1D] mb-4 inline-block">
          ← Back to Manage Tree
        </Link>
        <h1 className="text-2xl font-serif font-bold text-[#1C1F1D] mb-1">
          {editing ? "Edit person" : "Add a family member"}
        </h1>
        <p className="text-sm text-[#6B7280] mb-8">
          {editing
            ? "Update their details below."
            : "Enter their details, then tell us how they connect to someone already in the tree."}
        </p>

        <form onSubmit={handleSubmit} className="bg-white border border-[#E7E2D6] rounded-xl p-7">
          {error && (
            <div className="mb-5 text-sm text-[#B3441C] bg-[#FBEAE1] border border-[#F0C7B3] rounded-lg px-3 py-2">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Date of birth" icon={Calendar}>
              <input
                type="date"
                value={form.dob}
                onChange={update("dob")}
                className={inputWithIconClass}
              />
            </Field>
            <Field label="Date of death (optional)" icon={Calendar}>
              <input
                type="date"
                value={form.dod}
                onChange={update("dod")}
                className={inputWithIconClass}
              />
            </Field>
          </div>

          <label className="block mb-5">
            <span className="block text-xs font-medium text-[#374151] mb-1.5">Gender</span>
            <select value={form.gender} onChange={update("gender")} className={inputClass}>
              <option value="unspecified">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </label>

          {/* Photo upload */}
          <label className="block mb-5">
            <span className="block text-xs font-medium text-[#374151] mb-1.5">Photo (optional)</span>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full bg-[#F3F0E8] border-2 border-dashed border-[#D9D3C3] flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:border-[#1C4B3C] transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-6 h-6 text-[#9CA3AF]" />
                )}
              </div>
              <div className="flex-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm text-[#1C4B3C] font-medium hover:underline"
                >
                  {photoPreview ? "Change photo" : "Upload photo"}
                </button>
                {photoPreview && (
                  <button
                    type="button"
                    onClick={() => { setPhotoPreview(""); setForm((f) => ({ ...f, photo_url: "" })); }}
                    className="block text-xs text-[#9CA3AF] hover:text-red-500 mt-0.5"
                  >
                    Remove
                  </button>
                )}
                <p className="text-xs text-[#9CA3AF] mt-1">JPG, PNG or WebP · max 5 MB</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <label className="block">
              <span className="block text-xs font-medium text-[#374151] mb-1.5">Place of Birth (optional)</span>
              <input
                type="text"
                value={form.place_of_birth}
                onChange={update("place_of_birth")}
                placeholder="e.g. Mangalore, Karnataka"
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="block text-xs font-medium text-[#374151] mb-1.5">Occupation (optional)</span>
              <input
                type="text"
                value={form.occupation}
                onChange={update("occupation")}
                placeholder="e.g. Civil Engineer, Teacher"
                className={inputClass}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <label className="block">
              <span className="block text-xs font-medium text-[#374151] mb-1.5">Address (optional)</span>
              <input
                type="text"
                value={form.address}
                onChange={update("address")}
                placeholder="e.g. 12 MG Road, Bengaluru"
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="block text-xs font-medium text-[#374151] mb-1.5">Phone (optional)</span>
              <input
                type="tel"
                value={form.phone}
                onChange={update("phone")}
                placeholder="e.g. +91 98765 43210"
                className={inputClass}
              />
            </label>
          </div>

          <label className="block mb-6">
            <span className="block text-xs font-medium text-[#374151] mb-1.5">Biography &amp; Notes (optional)</span>
            <textarea
              value={form.notes}
              onChange={update("notes")}
              rows={3}
              placeholder="Life summary, personal anecdotes, or memories..."
              className={inputClass}
            />
          </label>

          {!editing && people.length > 0 && (
            <div className="border-t border-[#E7E2D6] pt-6 mb-2">
              <span className="block text-xs font-medium text-[#374151] mb-3">
                How are they related?
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-[#1C1F1D]">{form.name || "This person"}</span>
                <select
                  value={relationType}
                    onChange={(e) => {
                      setRelationType(e.target.value);
                      setFamilyId("");
                    }}
                  className="rounded-lg border border-[#D9D3C3] bg-white px-2.5 py-1.5 text-sm"
                >
                  {RELATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <select
                  value={relatedToId}
                  onChange={(e) => setRelatedToId(e.target.value)}
                  className="rounded-lg border border-[#D9D3C3] bg-white px-2.5 py-1.5 text-sm flex-1 min-w-[140px]"
                >
                  <option value="">Select a person…</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              {relatedPerson && relationType !== "spouse" && (
                <div className="mt-4">
                  <span className="block text-xs font-medium text-[#374151] mb-1.5">
                    {relationType === "child" ? "Partner family" : relationType === "sibling" ? "Shared parent family" : "Parent family"}
                  </span>
                  <select
                    value={familyId}
                    onChange={(e) => setFamilyId(e.target.value)}
                    className="w-full rounded-lg border border-[#D9D3C3] bg-white px-2.5 py-1.5 text-sm"
                  >
                    {relationType === "sibling" && (relatedPerson.parentFamilies || []).length > 1 && (
                      <option value="">Choose a parent family…</option>
                    )}
                    {relationType === "child" && (relatedPerson.partnerFamilies || []).length > 1 && (
                      <option value="">Choose a partner…</option>
                    )}
                    {(relationType === "child"
                      ? relatedPerson.partnerFamilies || []
                      : relationType === "sibling"
                      ? relatedPerson.parentFamilies || []
                      : (relatedPerson.parentFamilies || []).filter((family) => family.partner_ids.length < 2)
                    ).map((family) => (
                      <option key={family.id} value={family.id}>{familyLabel(family)}</option>
                    ))}
                    {relationType === "child" && <option value="no-partner">No partner / selected person only</option>}
                    {relationType === "parent" && <option value="new-family">Create a new parent family</option>}
                  </select>
                  {relationType !== "spouse" && (
                    <>
                      <label className="block text-xs font-medium text-[#374151] mt-3 mb-1.5">Relationship type</label>
                      <select value={familyRelationship} onChange={(e) => setFamilyRelationship(e.target.value)} className="w-full rounded-lg border border-[#D9D3C3] bg-white px-2.5 py-1.5 text-sm">
                        <option value="biological">Biological</option>
                        <option value="adoptive">Adoptive</option>
                        <option value="step">Step</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </>
                  )}
                  {relationType === "spouse" && (
                    <>
                      <label className="block text-xs font-medium text-[#374151] mt-3 mb-1.5">Partner status</label>
                      <select value={partnerStatus} onChange={(e) => setPartnerStatus(e.target.value)} className="w-full rounded-lg border border-[#D9D3C3] bg-white px-2.5 py-1.5 text-sm">
                        <option value="partner">Partner</option>
                        <option value="married">Married</option>
                        <option value="separated">Separated</option>
                        <option value="divorced">Divorced / remarriage history</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {!editing && people.length === 0 && (
            <p className="text-xs text-[#9CA3AF] mb-2">
              This is the first person in your tree — no relationship needed yet.
            </p>
          )}

          <button
            type="submit"
            className="w-full mt-4 bg-[#1C4B3C] text-white text-sm font-medium rounded-lg py-2.5 hover:bg-[#163C30] transition-colors"
          >
            {editing ? "Save changes" : "Add to tree"}
          </button>
        </form>
      </main>
    </div>
  );
}
