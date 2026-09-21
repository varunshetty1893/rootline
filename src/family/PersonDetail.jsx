import { useParams, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  GitBranch,
  Calendar,
  MapPin,
  Briefcase,
  Home,
  Phone,
  User,
  Heart,
  Users,
} from "lucide-react";
import AppHeader from "./AppHeader.jsx";
import { useFamily } from "./FamilyContext.jsx";

export default function PersonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getPerson, people, deletePerson, setRootPerson } = useFamily();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const person = getPerson(id);

  if (!person) {
    return (
      <div className="min-h-screen w-full bg-[#F7F5F0] flex flex-col">
        <AppHeader />
        <main className="flex-1 px-8 lg:px-16 py-12 max-w-3xl mx-auto w-full text-center">
          <div className="border border-dashed border-[#C9BEA8] rounded-xl px-8 py-16 bg-white">
            <h2 className="text-lg font-semibold text-[#1C1F1D] mb-2">Person Not Found</h2>
            <p className="text-sm text-[#6B7280] mb-6">
              The person you are looking for may have been removed or does not exist.
            </p>
            <Link
              to="/people"
              className="inline-flex items-center gap-2 bg-[#1C4B3C] text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-[#163C30] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to People
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const photoSrc = person.photo_url || (person.has_photo ? `/people/${person.id}/photo` : null);

  // Derive parents, spouses, children, siblings
  const parents = (person.parentIds || []).map((pId) => getPerson(pId)).filter(Boolean);
  const spouses = (person.spouseIds || []).map((sId) => getPerson(sId)).filter(Boolean);

  // Children: people who list this person as a parent
  const children = people.filter((p) => (p.parentIds || []).includes(person.id));

  // Siblings: people sharing at least one parent (excluding self)
  const parentIdSet = new Set(person.parentIds || []);
  const siblings = people.filter(
    (p) => p.id !== person.id && (p.parentIds || []).some((pId) => parentIdSet.has(pId))
  );

  const handleDelete = async () => {
    try {
      await deletePerson(person.id);
      navigate("/people");
    } catch (err) {
      console.error("Failed to delete person:", err);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F7F5F0] flex flex-col">
      <AppHeader />

      <main className="flex-1 px-4 sm:px-8 lg:px-16 py-8 max-w-3xl mx-auto w-full">
        {/* Navigation & Actions Topbar */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link
            to="/people"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B7280] hover:text-[#1C1F1D] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All People
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setRootPerson(person.id);
                navigate("/tree");
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#1C4B3C] border border-[#D9D3C3] bg-white rounded-lg px-3 py-1.5 hover:bg-[#F3F0E8] transition-colors"
              title="Center tree around this person"
            >
              <GitBranch className="w-3.5 h-3.5" />
              Focus Tree
            </button>
            <Link
              to={`/people/${person.id}/edit`}
              className="inline-flex items-center gap-1 text-xs font-medium text-white bg-[#1C4B3C] rounded-lg px-3 py-1.5 hover:bg-[#163C30] transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Link>
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-white border border-[#E7E2D6] rounded-2xl overflow-hidden shadow-sm mb-6">
          {/* Header Banner */}
          <div className="bg-[#1C4B3C]/5 border-b border-[#E7E2D6] px-6 py-6 flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-[#F0EDE3] border-2 border-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
              {photoSrc ? (
                <img src={photoSrc} alt={person.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-[#9CA3AF]" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl font-serif font-bold text-[#1C1F1D]">{person.name}</h1>
                {person.gender && person.gender !== "unspecified" && (
                  <span className="text-[11px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#E7E2D6] text-[#4B5563]">
                    {person.gender}
                  </span>
                )}
                {person.dod ? (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#6B7280]">
                    Deceased
                  </span>
                ) : (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#047857]">
                    Living
                  </span>
                )}
              </div>

              {person.occupation && (
                <p className="text-sm font-medium text-[#1C4B3C] flex items-center gap-1.5 mb-1">
                  <Briefcase className="w-3.5 h-3.5" />
                  {person.occupation}
                </p>
              )}

              <p className="text-xs text-[#6B7280]">
                {person.dob ? `Born ${person.dob}` : "Birth date unrecorded"}
                {person.dod ? ` · Died ${person.dod}` : ""}
                {person.place_of_birth ? ` in ${person.place_of_birth}` : ""}
              </p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="p-6 space-y-6">
            {/* Vital Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-[#EFECE6] rounded-xl p-3.5 bg-[#FAF9F5]">
                <span className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider block mb-1">
                  Birth Date
                </span>
                <p className="text-sm font-medium text-[#1C1F1D] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#1C4B3C]" />
                  {person.dob || "Unknown"}
                </p>
              </div>

              <div className="border border-[#EFECE6] rounded-xl p-3.5 bg-[#FAF9F5]">
                <span className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider block mb-1">
                  Death Date
                </span>
                <p className="text-sm font-medium text-[#1C1F1D] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#9CA3AF]" />
                  {person.dod || "Living / Unknown"}
                </p>
              </div>

              {person.place_of_birth && (
                <div className="border border-[#EFECE6] rounded-xl p-3.5 bg-[#FAF9F5]">
                  <span className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider block mb-1">
                    Place of Birth
                  </span>
                  <p className="text-sm font-medium text-[#1C1F1D] flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#1C4B3C]" />
                    {person.place_of_birth}
                  </p>
                </div>
              )}

              {person.occupation && (
                <div className="border border-[#EFECE6] rounded-xl p-3.5 bg-[#FAF9F5]">
                  <span className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider block mb-1">
                    Occupation
                  </span>
                  <p className="text-sm font-medium text-[#1C1F1D] flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-[#1C4B3C]" />
                    {person.occupation}
                  </p>
                </div>
              )}

              {person.address && (
                <div className="border border-[#EFECE6] rounded-xl p-3.5 bg-[#FAF9F5]">
                  <span className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider block mb-1">
                    Address
                  </span>
                  <p className="text-sm font-medium text-[#1C1F1D] flex items-center gap-1.5">
                    <Home className="w-4 h-4 text-[#1C4B3C]" />
                    {person.address}
                  </p>
                </div>
              )}

              {person.phone && (
                <div className="border border-[#EFECE6] rounded-xl p-3.5 bg-[#FAF9F5]">
                  <span className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider block mb-1">
                    Phone
                  </span>
                  <p className="text-sm font-medium text-[#1C1F1D] flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-[#1C4B3C]" />
                    {person.phone}
                  </p>
                </div>
              )}
            </div>

            {/* Notes / Bio */}
            {person.notes && (
              <div className="border-t border-[#EFECE6] pt-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-2">
                  Biography &amp; Notes
                </h3>
                <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-line bg-[#FAF9F5] p-4 rounded-xl border border-[#EFECE6]">
                  {person.notes}
                </p>
              </div>
            )}

            {/* Family Relationships Section */}
            <div className="border-t border-[#EFECE6] pt-5 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Family Connections
              </h3>

              {/* Parents */}
              <div>
                <span className="text-xs font-medium text-[#9CA3AF] block mb-2">Parents</span>
                {parents.length === 0 ? (
                  <p className="text-xs text-[#9CA3AF] italic">No parents recorded.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {parents.map((p) => (
                      <Link
                        key={p.id}
                        to={`/people/${p.id}`}
                        className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[#E7E2D6] hover:bg-[#F9F7F2] transition-colors"
                      >
                        <User className="w-4 h-4 text-[#1C4B3C]" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[#1C1F1D] truncate">{p.name}</p>
                          <p className="text-[11px] text-[#9CA3AF] truncate">
                            {p.dob ? `Born ${p.dob}` : "Parent"}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Spouses / Partners */}
              <div>
                <span className="text-xs font-medium text-[#9CA3AF] block mb-2">
                  Spouses &amp; Partners
                </span>
                {spouses.length === 0 ? (
                  <p className="text-xs text-[#9CA3AF] italic">No partners recorded.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {spouses.map((s) => (
                      <Link
                        key={s.id}
                        to={`/people/${s.id}`}
                        className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[#E7E2D6] hover:bg-[#F9F7F2] transition-colors"
                      >
                        <Heart className="w-4 h-4 text-[#B3441C]" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[#1C1F1D] truncate">{s.name}</p>
                          <p className="text-[11px] text-[#9CA3AF] truncate">
                            {s.dob ? `Born ${s.dob}` : "Partner"}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Children */}
              <div>
                <span className="text-xs font-medium text-[#9CA3AF] block mb-2">Children</span>
                {children.length === 0 ? (
                  <p className="text-xs text-[#9CA3AF] italic">No children recorded.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {children.map((c) => (
                      <Link
                        key={c.id}
                        to={`/people/${c.id}`}
                        className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[#E7E2D6] hover:bg-[#F9F7F2] transition-colors"
                      >
                        <Users className="w-4 h-4 text-[#1C4B3C]" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[#1C1F1D] truncate">{c.name}</p>
                          <p className="text-[11px] text-[#9CA3AF] truncate">
                            {c.dob ? `Born ${c.dob}` : "Child"}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Siblings */}
              {siblings.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-[#9CA3AF] block mb-2">Siblings</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {siblings.map((sib) => (
                      <Link
                        key={sib.id}
                        to={`/people/${sib.id}`}
                        className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[#E7E2D6] hover:bg-[#F9F7F2] transition-colors"
                      >
                        <User className="w-4 h-4 text-[#6B7280]" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[#1C1F1D] truncate">{sib.name}</p>
                          <p className="text-[11px] text-[#9CA3AF] truncate">
                            {sib.dob ? `Born ${sib.dob}` : "Sibling"}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Danger Zone: Delete Person */}
            <div className="border-t border-[#EFECE6] pt-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#B3441C]">Remove Person</p>
                <p className="text-[11px] text-[#9CA3AF]">
                  Deletes this person and unlinks them from family relationships.
                </p>
              </div>

              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="text-xs font-semibold text-white bg-[#B3441C] px-3 py-1.5 rounded-lg hover:bg-[#963715]"
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-[#6B7280] px-2 py-1.5 hover:text-[#1C1F1D]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B3441C] border border-[#FCA5A5] bg-[#FEF2F2] rounded-lg px-3 py-1.5 hover:bg-[#FEE2E2]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
