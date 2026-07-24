import { LOCALE_STORAGE_KEY, resolveLocale, type Locale } from "./locale";

export {
  LOCALE_STORAGE_KEY,
  normalizeLocale,
  resolveLocale,
  type Locale,
} from "./locale";

const copy = {
  ja: {
    description:
      "自分でデザインした打ち上げ花火を湖畔で鑑賞するブラウザシミュレーション",
    languageName: "日本語",
    loading: "夜空を準備しています…",
    sceneLabel: "湖畔の夜空と花火のシミュレーション",
    webglHeading: "夜空を表示できませんでした",
    webglDetail: "WebGL 2 が利用できるブラウザで、もう一度お試しください。",
  },
  en: {
    description:
      "A browser simulation for designing and viewing launch fireworks over a lakeside at night.",
    languageName: "English",
    loading: "Preparing the night sky…",
    sceneLabel: "Lakeside night sky and fireworks simulation",
    webglHeading: "The night sky could not be displayed",
    webglDetail: "Please try again in a browser that supports WebGL 2.",
  },
} as const;

export type CopyKey = keyof (typeof copy)["ja"];

export function text(locale: Locale, key: CopyKey): string {
  return copy[locale][key];
}

export function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatCount(
  locale: Locale,
  value: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return locale === "en"
    ? `${formatNumber(locale, value)} ${value === 1 ? singular : plural}`
    : `${formatNumber(locale, value)}件`;
}

export class I18n {
  #locale: Locale;

  constructor(locale = initialLocale()) {
    this.#locale = locale;
  }

  get locale(): Locale {
    return this.#locale;
  }
  t(key: CopyKey): string {
    return text(this.#locale, key);
  }

  setLocale(locale: Locale): void {
    this.#locale = locale;
    document.documentElement.lang = locale;
    document.title = "Codex Starmine";
    document
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute("content", this.t("description"));
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      /* storage is optional */
    }
    const url = new URL(window.location.href);
    url.searchParams.set("lang", locale);
    window.history.replaceState(null, "", url);
  }
}

export function initialLocale(): Locale {
  let storedLocale: string | null = null;
  try {
    storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    /* storage is optional */
  }
  return resolveLocale({
    search: window.location.search,
    storedLocale,
    languages: navigator.languages,
  });
}
