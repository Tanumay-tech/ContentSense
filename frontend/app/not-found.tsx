import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="text-[12px] font-medium text-primary">404</p>
      <h1 className="mt-1 text-[22px] font-semibold text-ink">Page not found</h1>
      <p className="mt-1 text-[13.5px] text-ink-3">This page doesn&apos;t exist in ContentSense.</p>
      <Link href="/" className="mt-4 text-[13.5px] font-medium text-primary hover:underline">Back to overview</Link>
    </div>
  );
}
