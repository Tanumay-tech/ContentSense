"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/format";

/** Right-side drawer (detail views). */
export function Drawer({
  open, onOpenChange, title, description, children, width = "max-w-xl",
}: { open: boolean; onOpenChange: (o: boolean) => void; title: React.ReactNode; description?: React.ReactNode; children: React.ReactNode; width?: string }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/20" />
        <Dialog.Content className={cn("fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-surface shadow-pop focus:outline-none", width)}>
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-[16px] font-semibold leading-snug text-ink">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-[12.5px] text-ink-3">{description}</Dialog.Description> : <Dialog.Description className="sr-only">Details</Dialog.Description>}
            </div>
            <Dialog.Close className="rounded-md p-1.5 text-ink-3 hover:bg-subtle hover:text-ink" aria-label="Close">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="scroll-thin flex-1 overflow-y-auto px-5 py-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Centered modal (explanations, score breakdowns). */
export function Modal({
  open, onOpenChange, title, description, children,
}: { open: boolean; onOpenChange: (o: boolean) => void; title: React.ReactNode; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[calc(100%-32px)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-pop focus:outline-none">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-[17px] font-semibold text-ink">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-[13px] text-ink-3">{description}</Dialog.Description> : <Dialog.Description className="sr-only">Details</Dialog.Description>}
            </div>
            <Dialog.Close className="rounded-md p-1.5 text-ink-3 hover:bg-subtle hover:text-ink" aria-label="Close">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
