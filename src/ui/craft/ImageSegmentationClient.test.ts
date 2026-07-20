import { describe, expect, it, vi } from "vitest";

import type {
  ImageWorkerRequest,
  ImageWorkerResponse,
} from "./GuidedImagePlacementTypes";
import {
  ImageSegmentationClient,
  isIOSPlatform,
} from "./ImageSegmentationClient";
import type { ImageDataLike } from "./ImagePlacementRecipe";

class FakeWorker {
  readonly messages: ImageWorkerRequest[] = [];
  terminated = false;
  #errorListeners: EventListener[] = [];
  #messageListeners: Array<(event: MessageEvent<ImageWorkerResponse>) => void> =
    [];

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void {
    const callback = listener as (
      event: MessageEvent<ImageWorkerResponse>,
    ) => void;
    if (type === "message") this.#messageListeners.push(callback);
    if (type === "error") this.#errorListeners.push(listener as EventListener);
  }

  postMessage(message: ImageWorkerRequest): void {
    this.messages.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  respond(response: ImageWorkerResponse): void {
    this.#messageListeners.forEach((listener) =>
      listener({ data: response } as MessageEvent<ImageWorkerResponse>),
    );
  }
}

function pixels(): ImageDataLike {
  const data = new Uint8ClampedArray(4 * 4 * 4);
  for (let index = 0; index < 16; index += 1) {
    data.set(
      index === 5 ? [200, 50, 40, 255] : [255, 255, 255, 255],
      index * 4,
    );
  }
  return { data, height: 4, width: 4 };
}

describe("ImageSegmentationClient", () => {
  it("recognizes iOS and touch-based iPadOS desktop user agents", () => {
    expect(
      isIOSPlatform({
        maxTouchPoints: 5,
        platform: "iPhone",
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      }),
    ).toBe(true);
    expect(
      isIOSPlatform({
        maxTouchPoints: 5,
        platform: "MacIntel",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
      }),
    ).toBe(true);
    expect(
      isIOSPlatform({
        maxTouchPoints: 0,
        platform: "MacIntel",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
      }),
    ).toBe(false);
  });

  it("passes an explicit WASM model preference to the worker", () => {
    const worker = new FakeWorker();
    const client = new ImageSegmentationClient({
      modelBackend: "wasm",
      workerFactory: () => worker as unknown as Worker,
    });
    client.setImage(
      { close: () => undefined, height: 4, width: 4 } as ImageBitmap,
      pixels(),
    );

    expect(worker.messages[0]).toMatchObject({
      mode: "auto",
      modelBackend: "wasm",
      type: "initialize",
    });
    client.dispose();
  });

  it("defaults the model backend to WASM on iOS", () => {
    vi.stubGlobal("navigator", {
      maxTouchPoints: 5,
      platform: "iPhone",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    });
    const worker = new FakeWorker();
    const client = new ImageSegmentationClient({
      workerFactory: () => worker as unknown as Worker,
    });
    try {
      client.setImage(
        { close: () => undefined, height: 4, width: 4 } as ImageBitmap,
        pixels(),
      );

      expect(worker.messages[0]).toMatchObject({
        mode: "auto",
        modelBackend: "wasm",
        type: "initialize",
      });
    } finally {
      client.dispose();
      vi.unstubAllGlobals();
    }
  });

  it("reports model and classic interaction profiles as providers settle", () => {
    const worker = new FakeWorker();
    const profiles: string[] = [];
    const client = new ImageSegmentationClient({
      onProviderChange: (profile, provider) =>
        profiles.push(`${profile}:${provider ?? "pending"}`),
      workerFactory: () => worker as unknown as Worker,
    });
    client.setImage(
      { close: () => undefined, height: 4, width: 4 } as ImageBitmap,
      pixels(),
    );
    worker.respond({
      backend: "wasm",
      provider: "slimsam",
      requestId: 1,
      type: "initialized",
    });

    expect(profiles).toEqual(["model:pending", "model:slimsam"]);
    client.dispose();
  });

  it("uses the classic interaction profile when fast mode is requested", () => {
    const profiles: string[] = [];
    const client = new ImageSegmentationClient({
      mode: "fast",
      onProviderChange: (profile) => profiles.push(profile),
    });

    expect(profiles).toEqual(["classic"]);
    client.dispose();
  });

  it("falls back without a worker and returns the requested revision", async () => {
    const client = new ImageSegmentationClient();
    client.setImage(undefined, pixels());
    const result = await client.segment(
      [{ id: "subject", kind: "subject", point: { x: 0.3, y: 0.3 } }],
      4,
    );

    expect(result.revision).toBe(4);
    expect(result.mask.width).toBe(4);
    client.dispose();
  });

  it("discards stale worker revisions and resolves only the latest", async () => {
    const worker = new FakeWorker();
    const client = new ImageSegmentationClient({
      workerFactory: () => worker as unknown as Worker,
    });
    client.setImage(
      { close: () => undefined, height: 4, width: 4 } as ImageBitmap,
      pixels(),
    );
    expect(worker.messages[0]).toMatchObject({
      mode: "auto",
      modelBackend: "auto",
      modelBaseUrl: "http://localhost/models/",
      type: "initialize",
      wasmBaseUrl: "http://localhost/wasm/",
    });
    const prompts = [
      { id: "subject", kind: "subject" as const, point: { x: 0.3, y: 0.3 } },
    ];
    const first = client.segment(prompts, 1);
    const firstRejected = expect(first).rejects.toMatchObject({
      name: "AbortError",
    });
    const second = client.segment(prompts, 2);
    const segmentRequests = worker.messages.filter(
      (message): message is Extract<ImageWorkerRequest, { type: "segment" }> =>
        message.type === "segment",
    );
    worker.respond({
      constraintsSatisfied: true,
      diagnostics: {
        backend: "cpu",
        candidateScores: [],
        constraintRepairApplied: false,
        inputEdge: 4,
        localRefinementCount: 0,
        provider: "fast",
        selectedCandidate: 0,
        selectedThreshold: 0.5,
      },
      imageId: "image-1",
      mask: { data: new Uint8Array(16), height: 4, width: 4 },
      maskId: "mask-1",
      probabilityMask: {
        data: new Float32Array(16),
        height: 4,
        width: 4,
      },
      requestId: segmentRequests[0].requestId,
      revision: 1,
      type: "segmentation",
    });
    worker.respond({
      constraintsSatisfied: true,
      diagnostics: {
        backend: "cpu",
        candidateScores: [],
        constraintRepairApplied: false,
        inputEdge: 4,
        localRefinementCount: 0,
        provider: "fast",
        selectedCandidate: 0,
        selectedThreshold: 0.5,
      },
      imageId: "image-1",
      mask: { data: new Uint8Array(16).fill(255), height: 4, width: 4 },
      maskId: "mask-2",
      probabilityMask: {
        data: new Float32Array(16).fill(1),
        height: 4,
        width: 4,
      },
      requestId: segmentRequests[1].requestId,
      revision: 2,
      type: "segmentation",
    });

    await firstRejected;
    await expect(second).resolves.toMatchObject({ revision: 2 });
    client.dispose();
    expect(worker.terminated).toBe(true);
  });
});
