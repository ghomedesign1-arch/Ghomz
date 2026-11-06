"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-[#3a2a18] px-4 py-2 text-sm font-medium text-white shadow hover:bg-[#2e2010]"
    >
      طباعة / حفظ PDF
    </button>
  );
}
