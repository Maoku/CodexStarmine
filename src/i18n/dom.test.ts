import { describe, expect, it } from "vitest";

import { translateText } from "./dom";

describe("English DOM localization", () => {
  it("translates editor, viewer, and image-placement labels", () => {
    expect(translateText("既定")).toBe("Preset");
    expect(translateText("画像から仮想星を作る")).toBe(
      "Create virtual stars from an image",
    );
    expect(translateText("演目を準備しています")).toBe("Preparing the show");
  });

  it("formats dynamic, accessible editor values in English", () => {
    expect(translateText("128点")).toBe("128 points");
    expect(translateText("Z軸に直交するXY面")).toBe(
      "Z axis normal to XY plane",
    );
    expect(translateText("仮想星数")).toBe("Virtual stars");
  });
});
