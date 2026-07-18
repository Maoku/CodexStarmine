import { describe, expect, it, vi } from "vitest";

import {
  SLIMSAM_MODEL_ID,
  SlimSamPromptMaskProvider,
  type SlimSamModelLike,
  type SlimSamProcessorLike,
  type SlimSamRuntime,
  type SlimSamTensorLike,
} from "./SlimSamPromptMaskProvider";

function tensor(
  data: Float32Array,
  dims: number[],
): SlimSamTensorLike & {
  disposed: boolean;
} {
  return {
    data,
    dims,
    disposed: false,
    dispose() {
      this.disposed = true;
    },
  };
}

describe("SlimSamPromptMaskProvider", () => {
  it("encodes once and returns all three decoder candidates for repeated prompts", async () => {
    const pixelValues = tensor(new Float32Array(12), [1, 3, 2, 2]);
    const imageEmbedding = tensor(new Float32Array(4), [1, 1, 2, 2]);
    const positionalEmbedding = tensor(new Float32Array(4), [1, 1, 2, 2]);
    const transformedInputs: unknown[] = [];
    const processedMaskTensors: Array<
      SlimSamTensorLike & { disposed: boolean }
    > = [];
    const processor = Object.assign(
      vi.fn(async () => ({
        original_sizes: [[2, 2] as [number, number]],
        pixel_values: pixelValues,
        reshaped_input_sizes: [[2, 2] as [number, number]],
      })),
      {
        add_input_labels: vi.fn((labels: number[][]) =>
          tensor(Float32Array.from(labels.flat()), [
            1,
            1,
            labels[0]?.length ?? 0,
          ]),
        ),
        post_process_masks: vi.fn(async () => {
          const output = tensor(
            Float32Array.from([0, 0, 0, 0, 2, 2, 2, 2, -2, -2, -2, -2]),
            [1, 3, 2, 2],
          );
          processedMaskTensors.push(output);
          return [output];
        }),
        reshape_input_points: vi.fn((input: unknown, _a, _b, isBox) => {
          transformedInputs.push({ input, isBox });
          return tensor(
            new Float32Array(isBox ? 4 : 2),
            isBox ? [1, 1, 4] : [1, 1, 1, 2],
          );
        }),
      },
    ) as unknown as SlimSamProcessorLike;
    const encode = vi.fn(async () => ({
      image_embeddings: imageEmbedding,
      image_positional_embeddings: positionalEmbedding,
    }));
    const decode = vi.fn(async () => ({
      iou_scores: tensor(Float32Array.from([0.2, 0.8, 0.4]), [1, 1, 3]),
      pred_masks: tensor(new Float32Array(12), [1, 1, 3, 2, 2]),
    }));
    const model = Object.assign(decode, {
      dispose: vi.fn(async () => undefined),
      get_image_embeddings: encode,
    }) as unknown as SlimSamModelLike;
    const configure = vi.fn();
    const runtime: SlimSamRuntime = {
      configure,
      createRawImage: (data, width, height) => ({ data, height, width }),
      loadModel: vi.fn(async (options) => {
        expect(options).toMatchObject({
          backend: "wasm",
          modelId: SLIMSAM_MODEL_ID,
        });
        return model;
      }),
      loadProcessor: vi.fn(async () => processor),
    };
    const provider = new SlimSamPromptMaskProvider({
      backend: "wasm",
      loadRuntime: async () => runtime,
      modelBaseUrl: "https://example.test/app/models/",
      wasmBaseUrl: "https://example.test/app/wasm/",
    });

    await provider.setImage({
      imageId: "image-1",
      pixels: new Uint8ClampedArray(16).fill(255),
      sourceHeight: 2,
      sourceWidth: 2,
    });
    const input = {
      prompts: [
        { id: "subject", kind: "subject" as const, point: { x: 0.5, y: 0.5 } },
      ],
      subjectBox: { bottom: 0.9, left: 0.1, right: 0.9, top: 0.1 },
    };
    const first = await provider.decodeCandidates(input);
    const second = await provider.decodeCandidates(input);

    expect(configure).toHaveBeenCalledWith({
      modelBaseUrl: "https://example.test/app/models/",
      wasmBaseUrl: "https://example.test/app/wasm/",
    });
    expect(encode).toHaveBeenCalledTimes(1);
    expect(decode).toHaveBeenCalledTimes(2);
    expect(first).toHaveLength(3);
    expect(first.map((candidate) => candidate.predictedIoU)).toEqual([
      expect.closeTo(0.2),
      expect.closeTo(0.8),
      expect.closeTo(0.4),
    ]);
    expect(first[1].probabilityMask.data[0]).toBeGreaterThan(0.8);
    expect(second[2].probabilityMask.data[0]).toBeLessThan(0.2);
    expect(transformedInputs).toContainEqual(
      expect.objectContaining({ isBox: true }),
    );
    expect(pixelValues.disposed).toBe(true);
    expect(processedMaskTensors.every((item) => item.disposed)).toBe(true);

    provider.dispose();
    expect(imageEmbedding.disposed).toBe(true);
    expect(positionalEmbedding.disposed).toBe(true);
    expect(model.dispose).toHaveBeenCalledOnce();
  });
});
