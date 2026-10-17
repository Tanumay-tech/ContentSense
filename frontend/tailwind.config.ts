import type { Config } from "tailwindcss";

// Theme tokens live in app/globals.css as CSS variables; change them there to re-theme.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "var(--page)",
        surface: "var(--surface)",
        subtle: "var(--subtle)",
        border: "var(--border)",
        ink: { DEFAULT: "var(--ink)", 2: "var(--ink-2)", 3: "var(--ink-3)" },
        primary: { DEFAULT: "var(--primary)", soft: "var(--primary-soft)", ink: "var(--primary-ink)" },
        good: { DEFAULT: "var(--good)", soft: "var(--good-soft)", ink: "var(--good-ink)" },
        warn: { DEFAULT: "var(--warn)", soft: "var(--warn-soft)", ink: "var(--warn-ink)" },
        bad: { DEFAULT: "var(--bad)", soft: "var(--bad-soft)", ink: "var(--bad-ink)" },
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"] },
      borderRadius: { xl: "12px", lg: "10px", md: "8px" },
      boxShadow: { card: "0 1px 2px rgba(16,24,40,0.04)", pop: "0 8px 24px rgba(16,24,40,0.12)" },
    },
  },
  plugins: [],
};
export default config;
