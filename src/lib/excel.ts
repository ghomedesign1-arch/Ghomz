import * as XLSX from "xlsx";

/**
 * Builds a workbook buffer from one or more named sheets.
 * Each sheet is an array of plain objects — XLSX infers columns from keys.
 */
export function buildWorkbook(
  sheets: { name: string; rows: Record<string, unknown>[] }[],
): Buffer {
  const wb = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    const ws = XLSX.utils.json_to_sheet(rows);
    autoSizeColumns(ws, rows);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function autoSizeColumns(
  ws: XLSX.WorkSheet,
  rows: Record<string, unknown>[],
) {
  if (rows.length === 0) return;
  const keys = Object.keys(rows[0]);
  ws["!cols"] = keys.map((key) => {
    const maxLen = Math.max(
      key.length,
      ...rows.map((r) => String(r[key] ?? "").length),
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
}

export function xlsxResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
