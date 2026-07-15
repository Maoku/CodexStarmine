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
});
