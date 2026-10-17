export const fmtInt = (v?: number | null) => (v == null ? "–" : Math.round(v).toLocaleString("en-US"));

export const fmtNum = (v?: number | null, d = 1) =>
  v == null || Number.isNaN(v) ? "–" : v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtCompact = (v?: number | null) =>
  v == null ? "–" : Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);

export const fmtPct = (v?: number | null, d = 0, sign = false) => {
  if (v == null || Number.isNaN(v)) return "–";
  const s = v.toFixed(d);
  return `${sign && v > 0 ? "+" : ""}${s}%`;
};

/** Engagement value with its unit ("3.42%" for rates, "312" for weighted interactions). */
export const fmtEng = (v?: number | null, unit = "%") =>
  v == null ? "–" : unit === "%" ? `${v.toFixed(2)}%` : fmtInt(v);

export const fmtDate = (iso?: string | null, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) => {
  if (!iso) return "–";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", opts);
};

export const fmtMonth = (iso: string) => fmtDate(iso, { month: "short", year: "2-digit" });

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
