import { describe, expect, it } from "vitest";

import { normalizeLocale, resolveLocale } from "./locale";

describe("locale resolution", () => {
  it("normalizes supported language and region tags", () => {
    expect(normalizeLocale("ja-JP")).toBe("ja");
    expect(normalizeLocale("en-GB")).toBe("en");
    expect(normalizeLocale("fr-FR")).toBeUndefined();
  });

  it("uses URL, stored value, then browser languages", () => {
    expect(
      resolveLocale({
        search: "?lang=en",
        storedLocale: "ja",
        languages: ["ja-JP"],
      }),
    ).toBe("en");
    expect(resolveLocale({ storedLocale: "en", languages: ["ja-JP"] })).toBe(
      "en",
    );
    expect(resolveLocale({ languages: ["fr", "en-US"] })).toBe("en");
    expect(resolveLocale({ languages: ["fr"] })).toBe("ja");
  });
});
