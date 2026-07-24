export const SUPPORTED_LOCALES = ["ja", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_STORAGE_KEY = "codex-starmine.locale.v1";

export function normalizeLocale(
  value: string | undefined | null,
): Locale | undefined {
  if (!value) return undefined;
  const language = value.toLowerCase().split("-")[0];
  return language === "ja" || language === "en" ? language : undefined;
}

export function resolveLocale(
  options: {
    languages?: readonly string[];
    search?: string;
    storedLocale?: string | null;
  } = {},
): Locale {
  const query = new URLSearchParams(options.search ?? "").get("lang");
  return (
    normalizeLocale(query) ??
    normalizeLocale(options.storedLocale) ??
    options.languages
      ?.map(normalizeLocale)
      .find((locale): locale is Locale => Boolean(locale)) ??
    "ja"
  );
}
