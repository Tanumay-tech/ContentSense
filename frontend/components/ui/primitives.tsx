"use client";

import Link from "next/link";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";
import { cn } from "@/lib/format";

/* ------------------------------------------------------------------ Card */
export function Card({ className, children, id }: { className?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className={cn("min-w-0 rounded-xl border border-border bg-surface shadow-card", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title, description, action, info,
}: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; info?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
      <div className="min-w-0">
        <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
          {title}
          {info && <InfoTip>{info}</InfoTip>}
        </h3>
        {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-5 pb-5 pt-4", className)}>{children}</div>;
}

/* ---------------------------------------------------------------- Button */
type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-ink disabled:opacity-60",
  secondary: "border border-border bg-surface text-ink hover:bg-subtle disabled:opacity-60",
  ghost: "text-ink-2 hover:bg-subtle hover:text-ink",
  danger: "border border-bad/30 bg-surface text-bad-ink hover:bg-bad-soft",
};
const sizes = { sm: "h-8 px-3 text-[13px]", md: "h-9 px-3.5 text-sm" };

export function Button({
  variant = "secondary", size = "md", className, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed",
        variants[variant], sizes[size], className,
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  href, variant = "secondary", size = "md", className, children,
}: { href: string; variant?: Variant; size?: "sm" | "md"; className?: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        variants[variant], sizes[size], className,
      )}
    >
      {children}
    </Link>
  );
}

/* ----------------------------------------------------------------- Badge */
type Tone = "neutral" | "primary" | "good" | "warn" | "bad";
const tones: Record<Tone, string> = {
  neutral: "bg-subtle text-ink-2 border-border",
  primary: "bg-primary-soft text-primary-ink border-primary/20",
  good: "bg-good-soft text-good-ink border-good/25",
  warn: "bg-warn-soft text-warn-ink border-warn/40",
  bad: "bg-bad-soft text-bad-ink border-bad/25",
};
export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11.5px] font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- InfoTip */
export function InfoTip({ children, label = "More information" }: { children: React.ReactNode; label?: string }) {
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button type="button" aria-label={label} className="inline-flex text-ink-3 hover:text-ink">
            <Info className="h-3.5 w-3.5" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            className="z-50 max-w-xs rounded-md bg-ink px-3 py-2 text-[12px] font-normal leading-relaxed text-white shadow-pop"
          >
            {children}
            <Tooltip.Arrow className="fill-ink" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/* ---------------------------------------------------------- Form controls */
export function Select({
  label, value, onChange, options, placeholder = "All", className,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: (string | { value: string; label: string })[]; placeholder?: string | null; className?: string;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-[11.5px] font-medium text-ink-3">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 min-w-0 rounded-md border border-border bg-surface px-2.5 text-[13px] text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
      >
        {placeholder !== null && <option value="">{placeholder}</option>}
        {options.map((o) =>
          typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>,
        )}
      </select>
    </label>
  );
}

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-[11.5px] font-medium text-ink-3">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "h-9 w-full min-w-0 rounded-md border border-border bg-surface px-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

/* ------------------------------------------------------ Segmented control */
export function Segmented<T extends string>({
  value, onChange, options, ariaLabel,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; ariaLabel: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-md border border-border bg-subtle p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 rounded-[6px] px-2.5 text-[12.5px] font-medium transition-colors",
            value === o.value ? "bg-surface text-ink shadow-card" : "text-ink-3 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Table */
export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("scroll-thin overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">{children}</table>
    </div>
  );
}
export function Th({ children, className, align = "left" }: { children?: React.ReactNode; className?: string; align?: "left" | "right" | "center" }) {
  return (
    <th className={cn("whitespace-nowrap border-b border-border bg-subtle/60 px-3 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-3",
      align === "right" && "text-right", align === "center" && "text-center", className)}>
      {children}
    </th>
  );
}
export function Td({ children, className, align = "left" }: { children?: React.ReactNode; className?: string; align?: "left" | "right" | "center" }) {
  return (
    <td className={cn("border-b border-border/70 px-3 py-2.5 align-middle text-ink-2",
      align === "right" && "tabular text-right", align === "center" && "text-center", className)}>
      {children}
    </td>
  );
}

/* ------------------------------------------------------------ Section title */
export function SectionTitle({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="mb-3 mt-2">
      {eyebrow && <div className="text-[11.5px] font-semibold uppercase tracking-wider text-primary">{eyebrow}</div>}
      <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
      {description && <p className="mt-0.5 max-w-3xl text-[13px] text-ink-3">{description}</p>}
    </div>
  );
}
