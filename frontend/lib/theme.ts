export type ThemePreference = "dark" | "light" | "system";

export const THEME_STORAGE_KEY = "evalops_theme";

export function resolveTheme(pref: ThemePreference): "dark" | "light" {
  if (pref === "dark" || pref === "light") return pref;
  const dark = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)").matches : true;
  return dark ? "dark" : "light";
}

/** Applies the resolved theme to <html data-theme> and persists the preference. */
export function applyTheme(pref: ThemePreference): void {
  if (typeof document === "undefined") return;
  const theme = resolveTheme(pref);
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // storage unavailable (private mode) — theme still applies for this tab
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", theme === "dark" ? "#0F0F0F" : "#f6f4f0");
}

/** Reads the persisted preference. Defaults to "dark" (the brand default). */
export function getStoredTheme(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "dark" || v === "light" || v === "system") return v;
  } catch {
    // storage unavailable
  }
  return "dark";
}