"use client";

import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { PRIMARY, SERIES, colorFor, shapeFor } from "@/lib/colors";
import { fmtMonth, fmtDate } from "@/lib/format";

// legend text stays in ink colour; the swatch carries the series identity
const legendText = (v: string) => <span style={{ color: "var(--ink-2)" }}>{v}</span>;

const AXIS = { tickLine: false, axisLine: { stroke: "var(--axis)" }, tick: { fontSize: 11, fill: "var(--ink-3)" } };

/* ------------------------------------------------------------ Tooltip shell */
export function TipBox({ title, rows }: { title?: React.ReactNode; rows: { label: string; value: React.ReactNode; color?: string }[] }) {
  return (
    <div className="max-w-[280px] rounded-lg border border-border bg-surface px-3 py-2 text-[12px] shadow-pop">
      {title && <div className="mb-1 font-semibold text-ink">{title}</div>}
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-ink-3">
            {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} aria-hidden />}
            {r.label}
          </span>
          <span className="tabular font-medium text-ink">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------- Horizontal bars */
export interface BarDatum { name: string; value: number | null; [k: string]: unknown }

export function HBarChart({
  data, format = (v: number) => v.toFixed(1), colorOrder, color = PRIMARY, reference, referenceLabel, valueLabel = "Value",
  extraTip, height, onBarClick, maxLabel = 22,
}: {
  data: BarDatum[]; format?: (v: number) => string; colorOrder?: string[]; color?: string; reference?: number | null;
  referenceLabel?: string; valueLabel?: string; extraTip?: (d: BarDatum) => { label: string; value: React.ReactNode }[];
  height?: number; onBarClick?: (d: BarDatum) => void; maxLabel?: number;
}) {
  const h = height ?? Math.max(140, data.length * 34 + 30);
  const trunc = (s: string) => (s.length > maxLabel ? s.slice(0, maxLabel - 1) + "…" : s);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: reference != null ? 18 : 4, right: 48, bottom: 4, left: 4 }} barCategoryGap={8}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" {...AXIS} tickFormatter={(v) => format(Number(v))} />
        <YAxis type="category" dataKey="name" width={Math.min(170, 8 + maxLabel * 6.4)} {...AXIS} axisLine={false} tick={{ fontSize: 12, fill: "var(--ink-2)" }} tickFormatter={trunc} />
        <Tooltip
          cursor={{ fill: "rgba(22,24,29,0.04)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as BarDatum;
            return <TipBox title={d.name} rows={[{ label: valueLabel, value: d.value == null ? "–" : format(d.value) }, ...(extraTip ? extraTip(d) : [])]} />;
          }}
        />
        {reference != null && (
          <ReferenceLine x={reference} stroke="var(--ink-3)" strokeWidth={1}
            label={{ value: referenceLabel ?? "avg", position: "top", fontSize: 10, fill: "var(--ink-3)" }} />
        )}
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18} onClick={onBarClick ? (d) => onBarClick(d as unknown as BarDatum) : undefined}
          className={onBarClick ? "cursor-pointer" : undefined}
          label={{ position: "right", fontSize: 11, fill: "var(--ink-2)", formatter: (v: number) => (v == null ? "" : format(v)) }}>
          {data.map((d) => <Cell key={d.name} fill={colorOrder ? colorFor(d.name, colorOrder) : color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* -------------------------------------------------------- Time series lines */
export interface LineSeries { key: string; name: string; color?: string }

export function TimeLineChart({
  data, series, xKey = "period", format = (v: number) => v.toFixed(0), height = 260, granularity = "month", showLegend,
}: {
  data: Record<string, unknown>[]; series: LineSeries[]; xKey?: string; format?: (v: number) => string; height?: number;
  granularity?: string; showLegend?: boolean;
}) {
  const isDate = granularity === "month" || granularity === "week" || granularity === "day";
  const xf = (v: string) => (!isDate ? String(v) : granularity === "month" ? fmtMonth(v) : fmtDate(v, { month: "short", day: "numeric" }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} {...AXIS} tickFormatter={xf} minTickGap={24} />
        <YAxis {...AXIS} axisLine={false} width={44} tickFormatter={(v) => format(Number(v))} />
        <Tooltip
          cursor={{ stroke: "var(--ink-3)", strokeWidth: 1 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <TipBox
                title={!isDate ? `k = ${label}` : fmtDate(String(label), granularity === "month" ? { month: "long", year: "numeric" } : undefined)}
                rows={payload.map((p) => ({ label: String(p.name), value: p.value == null ? "–" : format(Number(p.value)), color: String(p.color) }))}
              />
            );
          }}
        />
        {(showLegend ?? series.length > 1) && <Legend formatter={legendText} iconType="plainline" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />}
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color ?? SERIES[i % SERIES.length]} strokeWidth={2}
            dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} connectNulls isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ---------------------------------------------------------------- Columns */
export function ColumnChart({
  data, xKey, yKey, format = (v: number) => v.toFixed(0), height = 240, color = PRIMARY, xLabel, yLabel = "Records",
  tickFormatter,
}: {
  data: Record<string, unknown>[]; xKey: string; yKey: string; format?: (v: number) => string; height?: number; color?: string;
  xLabel?: string; yLabel?: string; tickFormatter?: (v: string) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: xLabel ? 14 : 0, left: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} {...AXIS} tickFormatter={tickFormatter} minTickGap={16}
          label={xLabel ? { value: xLabel, position: "insideBottom", offset: -8, fontSize: 11, fill: "var(--ink-3)" } : undefined} />
        <YAxis {...AXIS} axisLine={false} width={40} tickFormatter={(v) => format(Number(v))} />
        <Tooltip
          cursor={{ fill: "rgba(22,24,29,0.04)" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? <TipBox title={tickFormatter ? tickFormatter(String(label)) : String(label)} rows={[{ label: yLabel, value: format(Number(payload[0].value)) }]} /> : null
          }
        />
        <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------------------------------------------------------- Cluster scatter */
export interface ScatterPoint { x: number; y: number; topic: string; preview: string; title: string; engagement: number | null; id: string }

export function ClusterScatter({
  points, order, unit, height = 380, highlight,
}: { points: ScatterPoint[]; order: string[]; unit: string; height?: number; highlight?: string | null }) {
  const groups = order.map((t) => ({ topic: t, pts: points.filter((p) => p.topic === t) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid />
        <XAxis type="number" dataKey="x" name="Component 1" {...AXIS} tickFormatter={(v) => Number(v).toFixed(2)} />
        <YAxis type="number" dataKey="y" name="Component 2" {...AXIS} width={44} tickFormatter={(v) => Number(v).toFixed(2)} />
        <ZAxis range={[36, 36]} />
        <Tooltip
          cursor={false}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as ScatterPoint;
            return (
              <div className="max-w-[300px] rounded-lg border border-border bg-surface px-3 py-2 text-[12px] shadow-pop">
                <div className="flex items-center gap-1.5 font-semibold text-ink">
                  <span className="h-2 w-2 rounded-full" style={{ background: colorFor(p.topic, order) }} />
                  {p.topic}
                </div>
                <div className="mt-1 font-medium text-ink-2">{p.title}</div>
                <div className="mt-0.5 text-ink-3">{p.preview}…</div>
                <div className="mt-1 text-ink-2">Engagement: <span className="font-medium text-ink">{p.engagement == null ? "–" : unit === "%" ? `${p.engagement.toFixed(2)}%` : p.engagement}</span></div>
              </div>
            );
          }}
        />
        <Legend formatter={legendText} iconSize={9} wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
        {groups.map((g) => (
          <Scatter
            key={g.topic}
            name={g.topic}
            data={g.pts}
            fill={colorFor(g.topic, order)}
            shape={shapeFor(g.topic, order)}
            fillOpacity={highlight && highlight !== g.topic ? 0.12 : 0.75}
            stroke="var(--surface)"
            strokeWidth={1}
            isAnimationActive={false}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------ Forecast chart */
export interface ForecastPoint { date: string; score?: number | null; rolling?: number | null; forecast?: number | null; band?: [number, number] | null }

export function ForecastChart({ data, height = 300, lastHistory }: { data: ForecastPoint[]; height?: number; lastHistory?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" {...AXIS} tickFormatter={fmtMonth} minTickGap={32} />
        <YAxis {...AXIS} axisLine={false} width={36} domain={[0, 100]} />
        <Tooltip
          cursor={{ stroke: "var(--ink-3)", strokeWidth: 1 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as ForecastPoint;
            const rows = [];
            if (d.score != null) rows.push({ label: "Trend score", value: d.score.toFixed(1), color: PRIMARY });
            if (d.rolling != null) rows.push({ label: "4-week average", value: d.rolling.toFixed(1), color: "#52514e" });
            if (d.forecast != null) rows.push({ label: "Forecast (estimate)", value: d.forecast.toFixed(1), color: SERIES[1] });
            if (d.band) rows.push({ label: "80% range", value: `${d.band[0].toFixed(0)}–${d.band[1].toFixed(0)}` });
            return <TipBox title={`Week of ${fmtDate(String(label))}`} rows={rows} />;
          }}
        />
        <Legend formatter={legendText} iconType="plainline" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Area dataKey="band" name="Forecast range (80%)" stroke="none" fill={SERIES[1]} fillOpacity={0.14} isAnimationActive={false} legendType="square" />
        <Line dataKey="score" name="Weekly trend score" stroke={PRIMARY} strokeWidth={1.5} strokeOpacity={0.55} dot={false} isAnimationActive={false} />
        <Line dataKey="rolling" name="4-week average" stroke="#52514e" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line dataKey="forecast" name="Projected (estimate)" stroke={SERIES[1]} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
        {lastHistory && <ReferenceLine x={lastHistory} stroke="var(--axis)" label={{ value: "today", position: "insideTopRight", fontSize: 10, fill: "var(--ink-3)" }} />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ---------------------------------------------------------------- Sparkline */
export function Sparkline({ values, color = PRIMARY, height = 32 }: { values: number[]; color?: string; height?: number }) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
        <Line dataKey="v" stroke={color} strokeWidth={1.75} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
