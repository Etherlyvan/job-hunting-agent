import { parse } from "csv-parse/sync";
import { z } from "zod";
import { statusSchema } from "./schemas";
export function parseTracker(text: string) {
  const rows = z
    .array(z.record(z.string()))
    .max(1000)
    .parse(
      parse(text, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        relax_column_count: true,
      }),
    );
  return rows.map((row) => ({
    company: z.string().min(1).parse(row.company),
    title: z.string().min(1).parse(row.role),
    status: statusSchema.parse(
      (row.status ?? "drafted").toLowerCase().replace(/ /g, "_"),
    ),
    notes: (row.notes ?? "").slice(0, 10000),
    date:
      row.date &&
      /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
      !Number.isNaN(Date.parse(row.date))
        ? new Date(row.date)
        : null,
    source: row.source || undefined,
  }));
}
