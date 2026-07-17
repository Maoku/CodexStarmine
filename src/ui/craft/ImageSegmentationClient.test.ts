import { describe, expect, it } from "vitest";

import type {
  ImageWorkerRequest,
  ImageWorkerResponse,
} from "./GuidedImagePlacementTypes";
import { ImageSegmentationClient } from "./ImageSegmentationClient";
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
      mask: { data: new Uint8Array(16), height: 4, width: 4 },
      provider: "fast",
      requestId: segmentRequests[0].requestId,
      revision: 1,
      type: "mask",
    });
    worker.respond({
      mask: { data: new Uint8Array(16).fill(255), height: 4, width: 4 },
      provider: "fast",
      requestId: segmentRequests[1].requestId,
      revision: 2,
      type: "mask",
    });

    await firstRejected;
    await expect(second).resolves.toMatchObject({ revision: 2 });
    client.dispose();
    expect(worker.terminated).toBe(true);
  });
});
