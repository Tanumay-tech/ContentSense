"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { FilterValues } from "@/components/FilterBar";

const KEYS: (keyof FilterValues)[] = ["q", "topic", "category", "platform", "start", "end", "min_engagement"];

/** Filters live in the URL so views are linkable (e.g. "Explore topic" links). */
export function useUrlFilters(extraKeys: string[] = []) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    [...KEYS, ...extraKeys].forEach((k) => {
      const v = sp.get(k);
      if (v) f[k] = v;
    });
    return f;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const setFilters = useCallback(
    (next: Record<string, string | undefined>) => {
      const q = new URLSearchParams();
      Object.entries(next).forEach(([k, v]) => v && q.set(k, v));
      const s = q.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  return { filters, setFilters };
}
