import { describe, expect, it } from "vitest";

import { CHRYSANTHEMUM_PRESET } from "../../data";
import {
  buildApproximateSpreadModel,
  renderApproximateSpread,
} from "./ApproximateSpreadRenderer";

describe("ApproximateSpreadRenderer", () => {
  it("returns only aggregate spread bands without production coordinates", () => {
    const model = buildApproximateSpreadModel(CHRYSANTHEMUM_PRESET);
    const serialized = JSON.stringify(model);

    expect(model.layerCount).toBeGreaterThan(0);
    expect(model.bands.length).toBe(model.layerCount);
    expect(serialized).not.toContain("initialPosition");
    expect(serialized).not.toContain("initialVelocity");
    expect(serialized).not.toContain('"x"');
    expect(serialized).not.toContain('"y"');
    expect(serialized).not.toContain('"z"');
  });

  it("is deterministic and renders a lightweight two-dimensional SVG", () => {
    const first = buildApproximateSpreadModel(CHRYSANTHEMUM_PRESET);
    const second = buildApproximateSpreadModel(CHRYSANTHEMUM_PRESET);
    const html = renderApproximateSpread(first, true, 0);

    expect(second).toEqual(first);
    expect(html).toContain("<svg");
    expect(html).toContain("approximate-spread-band");
    expect(html).not.toContain("FireworkSystem");
    expect(html).not.toContain("canvas");
  });

  it("omits hidden layers from the inline preview", () => {
    const design = structuredClone(CHRYSANTHEMUM_PRESET);
    design.layers.forEach((layer) => {
      layer.visible = false;
    });
    expect(buildApproximateSpreadModel(design)).toEqual({
      bands: [],
      duration: 2.4,
      layerCount: 0,
    });
  });

  it("keeps preview work bounded when production particle counts grow", () => {
    const lowLoad = structuredClone(CHRYSANTHEMUM_PRESET);
    const highLoad = structuredClone(CHRYSANTHEMUM_PRESET);
    const lowLayer = lowLoad.layers.find((layer) => layer.kind === "spherical");
    const highLayer = highLoad.layers.find(
      (layer) => layer.kind === "spherical",
    );
    if (!lowLayer || lowLayer.kind !== "spherical") {
      throw new Error("Low-load spherical layer fixture is missing.");
    }
    if (!highLayer || highLayer.kind !== "spherical") {
      throw new Error("High-load spherical layer fixture is missing.");
    }
    lowLayer.count = 12;
    highLayer.count = 900_000;

    const lowModel = buildApproximateSpreadModel(lowLoad);
    const highModel = buildApproximateSpreadModel(highLoad);
    const lowMarkup = renderApproximateSpread(lowModel, true, 0);
    const highMarkup = renderApproximateSpread(highModel, true, 0);

    expect(highModel.bands).toHaveLength(lowModel.bands.length);
    expect(highMarkup.match(/<circle/g)).toHaveLength(
      lowMarkup.match(/<circle/g)?.length ?? 0,
    );
    expect(highMarkup.length - lowMarkup.length).toBeLessThan(80);
  });
});
