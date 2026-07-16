import { afterEach, describe, expect, it, vi } from "vitest";

import { clientPointToSvg } from "./SvgCoordinateTransform";

function fakeCanvas(overrides: Partial<SVGSVGElement>): SVGSVGElement {
  return {
    getBoundingClientRect: () =>
      ({ height: 800, left: 100, top: 50, width: 1_200 }) as DOMRect,
    getScreenCTM: () => null,
    viewBox: { baseVal: { height: 544, width: 600, x: 0, y: 0 } },
    ...overrides,
  } as unknown as SVGSVGElement;
}

afterEach(() => vi.unstubAllGlobals());

describe("SvgCoordinateTransform", () => {
  it("prefers DOMPoint and the inverse screen CTM", () => {
    class PointMock {
      constructor(
        readonly x: number,
        readonly y: number,
      ) {}

      matrixTransform(matrix: { transform: (point: PointMock) => PointMock }) {
        return matrix.transform(this);
      }
    }
    vi.stubGlobal("DOMPoint", PointMock);
    const inverse = {
      transform: (point: PointMock) =>
        new PointMock((point.x - 140) / 2, (point.y - 80) / 2),
    };
    const canvas = fakeCanvas({
      getScreenCTM: () => ({ inverse: () => inverse }) as unknown as DOMMatrix,
    });

    expect(clientPointToSvg(740, 624, canvas)).toEqual({ x: 300, y: 272 });
  });

  it("subtracts preserveAspectRatio letterboxing in the fallback", () => {
    const canvas = fakeCanvas({});
    expect(clientPointToSvg(700, 450, canvas).x).toBeCloseTo(300, 10);
    expect(clientPointToSvg(700, 450, canvas).y).toBeCloseTo(272, 10);
  });
});
