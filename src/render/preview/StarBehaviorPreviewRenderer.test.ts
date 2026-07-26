import { afterEach, describe, expect, it, vi } from "vitest";

import { BUILTIN_STAR_PRESETS } from "../../data";
import { StarBehaviorPreviewRenderer } from "./StarBehaviorPreviewRenderer";

interface FakeCanvas {
  addEventListener: (type: string, callback: (event: Event) => void) => void;
  className: string;
  parentElement?: FakeHost;
  remove: () => void;
  removeEventListener: (type: string) => void;
  setAttribute: (name: string, value: string) => void;
}

interface FakeHost {
  append: (canvas: FakeCanvas) => void;
  dataset: Record<string, string>;
  getBoundingClientRect: () => DOMRect;
}

function fakeCanvas(): FakeCanvas {
  const listeners = new Map<string, (event: Event) => void>();
  return {
    addEventListener: (type, callback) => listeners.set(type, callback),
    className: "",
    remove() {
      this.parentElement = undefined;
    },
    removeEventListener: (type) => void listeners.delete(type),
    setAttribute: vi.fn(),
  };
}

function fakeHost(): FakeHost {
  const host: FakeHost = {
    append: (canvas) => {
      canvas.parentElement = host;
    },
    dataset: {},
    getBoundingClientRect: () =>
      ({
        height: 116,
        width: 216,
      }) as DOMRect,
  };
  return host;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StarBehaviorPreviewRenderer", () => {
  it("reuses one canvas across hosts and disposes every owned resource", () => {
    vi.stubGlobal("document", {
      addEventListener: vi.fn(),
      hidden: false,
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("window", { devicePixelRatio: 2 });
    const canvas = fakeCanvas();
    const render = vi.fn();
    const dispose = vi.fn();
    const forceContextLoss = vi.fn();
    const createRenderer = vi.fn(() => ({
      dispose,
      domElement: canvas as unknown as HTMLCanvasElement,
      forceContextLoss,
      render,
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
    }));
    const cancelAnimationFrame = vi.fn();
    const firstHost = fakeHost();
    const secondHost = fakeHost();
    const renderer = new StarBehaviorPreviewRenderer({
      cancelAnimationFrame,
      createRenderer,
      now: () => 1_000,
      reducedMotion: () => false,
      requestAnimationFrame: () => 7,
    });

    for (let index = 0; index < 50; index += 1) {
      renderer.attach(
        firstHost as unknown as HTMLElement,
        BUILTIN_STAR_PRESETS[8],
      );
      renderer.detach();
    }
    renderer.attach(
      secondHost as unknown as HTMLElement,
      BUILTIN_STAR_PRESETS[9],
    );

    expect(createRenderer).toHaveBeenCalledTimes(1);
    expect(firstHost.dataset.previewState).toBe("webgl");
    expect(secondHost.dataset.previewState).toBe("webgl");
    expect(canvas.parentElement).toBe(secondHost);
    expect(render).toHaveBeenCalled();

    renderer.destroy();
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(forceContextLoss).toHaveBeenCalledTimes(1);
  });

  it("exposes the static fallback when WebGL creation fails", () => {
    vi.stubGlobal("document", {
      addEventListener: vi.fn(),
      hidden: false,
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    const host = fakeHost();
    const renderer = new StarBehaviorPreviewRenderer({
      cancelAnimationFrame: vi.fn(),
      createRenderer: () => {
        throw new Error("WebGL unavailable");
      },
      now: () => 0,
      reducedMotion: () => false,
      requestAnimationFrame: () => 0,
    });

    renderer.attach(host as unknown as HTMLElement, BUILTIN_STAR_PRESETS[8]);
    expect(renderer.isFallback).toBe(true);
    expect(host.dataset.previewState).toBe("fallback");
    renderer.destroy();
  });

  it("renders a representative still without scheduling autoplay for reduced motion", () => {
    vi.stubGlobal("document", {
      addEventListener: vi.fn(),
      hidden: false,
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    const canvas = fakeCanvas();
    const requestAnimationFrame = vi.fn(() => 3);
    const render = vi.fn();
    const renderer = new StarBehaviorPreviewRenderer({
      cancelAnimationFrame: vi.fn(),
      createRenderer: () => ({
        dispose: vi.fn(),
        domElement: canvas as unknown as HTMLCanvasElement,
        render,
        setPixelRatio: vi.fn(),
        setSize: vi.fn(),
      }),
      now: () => 0,
      reducedMotion: () => true,
      requestAnimationFrame,
    });

    renderer.attach(
      fakeHost() as unknown as HTMLElement,
      BUILTIN_STAR_PRESETS[8],
    );
    expect(renderer.isRunning).toBe(false);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalled();
    renderer.destroy();
  });
});
