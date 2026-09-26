import React from "react";
import { UserPlus, Loader2 } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-[#D9D3C3] bg-white px-3 py-2 text-sm text-[#1C1F1D] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 focus:border-[#1C4B3C]";

export default function TreeQuickAddModal({
  quickRelation,
  selectedPerson,
  people,
  quickName,
  setQuickName,
  quickGender,
  setQuickGender,
  quickFamilyId,
  setQuickFamilyId,
  quickFamilyRelationship,
  setQuickFamilyRelationship,
  quickParentType,
  setQuickParentType,
  quickPartnerStatus,
  setQuickPartnerStatus,
  quickPartnerMode,
  setQuickPartnerMode,
  quickPartnerId,
  setQuickPartnerId,
  quickPartnerName,
  setQuickPartnerName,
  quickPartnerSaving,
  quickSaving,
  quickError,
  quickSuccess,
  closeQuickAdd,
  submitQuickAdd,
  addPartnerBeforeChild,
  parentFamilyOptions,
  childFamilyOptions,
  familyLabel,
}) {
  if (!quickRelation || !selectedPerson) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-[#1C1F1D]/30 p-4"
      onMouseDown={closeQuickAdd}
    >
      <form
        onSubmit={submitQuickAdd}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-white shadow-xl border border-[#E7E2D6] p-5"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-[#1C4B3C]/10 flex items-center justify-center shrink-0">
            <UserPlus className="w-4 h-4 text-[#1C4B3C]" />
          </div>
          <div>
            <h2 className="text-base font-serif font-bold text-[#1C1F1D]">
              Add{" "}
              {quickRelation === "spouse"
                ? "a partner"
                : quickRelation === "parent"
                ? "a parent"
                : `a ${quickRelation}`}
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              {quickRelation === "child"
                ? `Choose which partner family ${selectedPerson.name} belongs to.`
                : quickRelation === "sibling"
                ? `This sibling will share the selected parent family.`
                : `The new person will be linked directly to ${selectedPerson.name}.`}
            </p>
          </div>
        </div>

        {quickError && (
          <p className="mb-3 rounded-lg bg-[#FBEAE1] px-3 py-2 text-xs text-[#B3441C]">
            {quickError}
          </p>
        )}
        {quickSuccess && (
          <p className="mb-3 rounded-lg bg-[#E7F3ED] px-3 py-2 text-xs text-[#1C4B3C]">
            {quickSuccess}
          </p>
        )}

        {quickRelation === "parent" && (
          <>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">
              Parent family
            </label>
            <select
              value={quickFamilyId}
              onChange={(e) => setQuickFamilyId(e.target.value)}
              className={inputClass}
            >
              {parentFamilyOptions.length > 1 && <option value="">Choose a parent family…</option>}
              {parentFamilyOptions.map((family) => (
                <option key={family.id} value={family.id}>
                  {familyLabel(family)}
                </option>
              ))}
              <option value="new-family">Create a new parent family</option>
            </select>
            <label className="block text-xs font-medium text-[#374151] mt-3 mb-1.5">Parent type</label>
            <select
              value={quickParentType}
              onChange={(e) => {
                setQuickParentType(e.target.value);
                setQuickGender(
                  e.target.value === "father"
                    ? "male"
                    : e.target.value === "mother"
                    ? "female"
                    : "unspecified"
                );
              }}
              className={inputClass}
            >
              <option value="parent">Parent</option>
              <option value="father">Father</option>
              <option value="mother">Mother</option>
            </select>
            <label className="block text-xs font-medium text-[#374151] mt-3 mb-1.5">
              Relationship to this family
            </label>
            <select
              value={quickFamilyRelationship}
              onChange={(e) => setQuickFamilyRelationship(e.target.value)}
              className={inputClass}
            >
              <option value="biological">Biological</option>
              <option value="adoptive">Adoptive</option>
              <option value="step">Step-parent</option>
              <option value="unknown">Unknown</option>
            </select>
          </>
        )}

        {quickRelation === "sibling" && (
          <>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">
              Shared parent family
            </label>
            <select
              value={quickFamilyId}
              onChange={(e) => setQuickFamilyId(e.target.value)}
              className={inputClass}
            >
              {parentFamilyOptions.length === 0 && (
                <option value="">No parent family available</option>
              )}
              {parentFamilyOptions.length > 1 && <option value="">Choose a parent family…</option>}
              {selectedPerson.parentFamilies?.map((family) => (
                <option key={family.id} value={family.id}>
                  {familyLabel(family)}
                </option>
              ))}
              <option value="new-family">Different / unknown parent family</option>
            </select>
            <label className="block text-xs font-medium text-[#374151] mt-3 mb-1.5">
              Sibling relationship
            </label>
            <select
              value={quickFamilyRelationship}
              onChange={(e) => setQuickFamilyRelationship(e.target.value)}
              className={inputClass}
            >
              <option value="biological">Biological sibling</option>
              <option value="adoptive">Adoptive sibling</option>
              <option value="step">Step-sibling</option>
              <option value="unknown">Unknown</option>
            </select>
          </>
        )}

        {quickRelation === "child" && (
          <>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">
              Partner for this child
            </label>
            <select
              value={quickFamilyId}
              onChange={(e) => setQuickFamilyId(e.target.value)}
              className={inputClass}
            >
              {childFamilyOptions.length > 1 && <option value="">Choose a partner family…</option>}
              {childFamilyOptions.map((family) => (
                <option key={family.id} value={family.id}>
                  {familyLabel(family)}
                </option>
              ))}
              <option value="no-partner">No partner / just {selectedPerson.name}</option>
              <option value="different-partner">Different partner — add partner first</option>
            </select>
            {quickFamilyId === "different-partner" && (
              <div className="mt-3 rounded-lg border border-[#DCE3E1] bg-[#F7F9F7] p-3">
                <p className="text-xs text-[#5A6980] mb-2">
                  Add or select the partner first. The child form stays open after that.
                </p>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickPartnerMode("add");
                      setQuickPartnerId("");
                    }}
                    className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium ${
                      quickPartnerMode === "add"
                        ? "bg-[#1C4B3C] text-white"
                        : "bg-white text-[#5A6980] border border-[#DCE3E1]"
                    }`}
                  >
                    Add partner
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickPartnerMode("select");
                      setQuickPartnerName("");
                    }}
                    className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium ${
                      quickPartnerMode === "select"
                        ? "bg-[#1C4B3C] text-white"
                        : "bg-white text-[#5A6980] border border-[#DCE3E1]"
                    }`}
                  >
                    Select existing
                  </button>
                </div>
                {quickPartnerMode === "add" ? (
                  <>
                    <input
                      value={quickPartnerName}
                      onChange={(e) => setQuickPartnerName(e.target.value)}
                      placeholder="Partner's full name"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={addPartnerBeforeChild}
                      disabled={quickPartnerSaving}
                      className="mt-2 w-full rounded-lg border border-[#1C4B3C]/30 py-2 text-xs font-medium text-[#1C4B3C] hover:bg-white disabled:opacity-60"
                    >
                      {quickPartnerSaving ? "Adding partner…" : "Add partner and continue"}
                    </button>
                  </>
                ) : (
                  <select
                    value={quickPartnerId}
                    onChange={(e) => setQuickPartnerId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select an existing person…</option>
                    {people
                      .filter((person) => person.id !== selectedPerson.id)
                      .map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            )}
            <label className="block text-xs font-medium text-[#374151] mt-3 mb-1.5">
              Child relationship
            </label>
            <select
              value={quickFamilyRelationship}
              onChange={(e) => setQuickFamilyRelationship(e.target.value)}
              className={inputClass}
            >
              <option value="biological">Biological child</option>
              <option value="adoptive">Adopted child</option>
              <option value="step">Stepchild</option>
              <option value="unknown">Unknown</option>
            </select>
          </>
        )}

        {quickRelation === "spouse" && (
          <div className="mb-4 rounded-lg border border-[#DCE3E1] bg-[#F7F9F7] p-3">
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  setQuickPartnerMode("add");
                  setQuickPartnerId("");
                }}
                className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium ${
                  quickPartnerMode === "add"
                    ? "bg-[#1C4B3C] text-white"
                    : "bg-white text-[#5A6980] border border-[#DCE3E1]"
                }`}
              >
                Add new
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuickPartnerMode("select");
                  setQuickName("");
                }}
                className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium ${
                  quickPartnerMode === "select"
                    ? "bg-[#1C4B3C] text-white"
                    : "bg-white text-[#5A6980] border border-[#DCE3E1]"
                }`}
              >
                Link existing
              </button>
            </div>
            {quickPartnerMode === "select" && (
              <select
                value={quickPartnerId}
                onChange={(e) => setQuickPartnerId(e.target.value)}
                className={inputClass}
              >
                <option value="">Select an existing person…</option>
                {people
                  .filter((person) => person.id !== selectedPerson.id)
                  .map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
              </select>
            )}
          </div>
        )}

        {!(quickRelation === "spouse" && quickPartnerMode === "select") && (
          <>
            <label
              className="block text-xs font-medium text-[#374151] mb-1.5"
              htmlFor="quick-relative-name"
            >
              Full name
            </label>
            <input
              id="quick-relative-name"
              autoFocus
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              placeholder="e.g. Asha Rao"
              className={inputClass}
            />

            <label
              className="block text-xs font-medium text-[#374151] mt-3 mb-1.5"
              htmlFor="quick-relative-gender"
            >
              Gender
            </label>
            <select
              id="quick-relative-gender"
              value={quickGender}
              onChange={(e) => setQuickGender(e.target.value)}
              className={inputClass}
            >
              <option value="unspecified">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </>
        )}
        {quickRelation === "spouse" && (
          <>
            <label className="block text-xs font-medium text-[#374151] mt-3 mb-1.5">
              Partner status
            </label>
            <select
              value={quickPartnerStatus}
              onChange={(e) => setQuickPartnerStatus(e.target.value)}
              className={inputClass}
            >
              <option value="partner">Partner</option>
              <option value="married">Married</option>
              <option value="separated">Separated</option>
              <option value="divorced">Divorced / remarriage history</option>
              <option value="unknown">Unknown</option>
            </select>
          </>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={closeQuickAdd}
            className="text-xs font-medium text-[#6B7280] px-3 py-2 hover:text-[#1C1F1D]"
          >
            Cancel
          </button>
          {quickRelation === "child" && quickSuccess && (
            <button
              type="button"
              onClick={closeQuickAdd}
              className="text-xs font-medium text-[#1C4B3C] px-3 py-2 hover:underline"
            >
              Done
            </button>
          )}
          <button
            type="submit"
            disabled={quickSaving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1C4B3C] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#163C30] disabled:opacity-60"
          >
            {quickSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {quickRelation === "spouse" && quickPartnerMode === "select"
              ? "Link partner"
              : quickRelation === "child" && quickSuccess
              ? "Add another child"
              : "Add to tree"}
          </button>
        </div>
      </form>
    </div>
  );
}
