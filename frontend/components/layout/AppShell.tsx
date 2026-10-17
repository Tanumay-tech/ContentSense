"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen, ChartNoAxesColumn, Database, Gauge, Heart, Info, KeyRound, LayoutDashboard, Menu, Radar, Table2, TrendingUp, X,
} from "lucide-react";
import { useAppStatus } from "./StatusProvider";
import { cn, fmtInt } from "@/lib/format";

const NAV = [
  { group: "Overview", items: [{ href: "/", label: "Home", icon: LayoutDashboard }] },
  {
    group: "Content analysis",
    items: [
      { href: "/content", label: "Content Explorer", icon: Table2 },
      { href: "/topics", label: "Topic Mining", icon: ChartNoAxesColumn },
      { href: "/keywords", label: "Keyword Intelligence", icon: KeyRound },
      { href: "/engagement", label: "Engagement Insights", icon: Heart },
      { href: "/trends", label: "Content Trends", icon: TrendingUp },
    ],
  },
  { group: "Market", items: [{ href: "/market", label: "Market Trends & Opportunities", icon: Radar }] },
  {
    group: "Pipeline",
    items: [
      { href: "/data", label: "Data & Processing", icon: Database },
      { href: "/methodology", label: "Methodology", icon: BookOpen },
      { href: "/about", label: "Settings / About", icon: Info },
    ],
  },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
        <Gauge className="h-4.5 w-4.5" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold text-ink">ContentSense</span>
        <span className="block text-[11px] text-ink-3">Content & Market Intelligence</span>
      </span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV.map((g) => (
        <div key={g.group}>
          <div className="mb-1.5 px-2 text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">{g.group}</div>
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
              const Icon = it.icon;
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded-md px-2 py-2 text-[13.5px] transition-colors",
                      active ? "bg-primary-soft font-semibold text-primary-ink" : "text-ink-2 hover:bg-subtle hover:text-ink",
                    )}
                  >
                    {active && <span className="absolute -left-3 top-1.5 h-6 w-[3px] rounded-r bg-primary" aria-hidden />}
                    <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-ink-3")} aria-hidden />
                    <span className="truncate">{it.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function DatasetBadge() {
  const { status, error } = useAppStatus();
  let text = "Connecting…";
  let dot = "bg-ink-3";
  if (error) { text = "Backend unavailable"; dot = "bg-bad"; }
  else if (status?.analysis_ready) { text = `${fmtInt(status.records_analyzed)} records · ${status.n_clusters} topics`; dot = "bg-good"; }
  else if (status?.content_loaded) { text = "Data loaded · not analysed"; dot = "bg-warn"; }
  else if (status) { text = "No data loaded"; dot = "bg-warn"; }
  return (
    <Link href="/data" className="mx-3 mb-3 block rounded-lg border border-border bg-subtle/60 px-3 py-2.5 hover:bg-subtle">
      <div className="flex items-center gap-2 text-[12px] font-medium text-ink">
        <span className={cn("h-2 w-2 rounded-full", dot)} aria-hidden />
        {text}
      </div>
      <div className="mt-0.5 truncate text-[11px] text-ink-3">
        {status?.content_source ? `${status.content_source.name}${status.content_source.kind === "demo" ? " (demo)" : ""}` : "Data & Processing →"}
      </div>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-screen">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
        <div className="border-b border-border py-4"><Logo /></div>
        <NavList />
        <DatasetBadge />
      </aside>

      {/* mobile / tablet top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur lg:hidden">
        <Logo />
        <button onClick={() => setOpen(true)} className="rounded-md p-2 text-ink-2 hover:bg-subtle" aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/25" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface shadow-pop">
            <div className="flex items-center justify-between border-b border-border py-4 pr-3">
              <Logo />
              <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-ink-3 hover:bg-subtle" aria-label="Close navigation">
                <X className="h-4 w-4" />
              </button>
            </div>
            <NavList onNavigate={() => setOpen(false)} />
            <DatasetBadge />
          </aside>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({
  title, question, description, actions,
}: { title: string; question: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        <p className="text-[12px] font-medium text-primary">{question}</p>
        <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
