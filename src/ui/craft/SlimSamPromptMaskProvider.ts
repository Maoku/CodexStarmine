import type {
  ImageEmbeddingInfo,
  ModelMaskCandidate,
  ModelPromptInput,
  PromptMaskProvider,
  SegmentationExecutionBackend,
  SegmentationImageSource,
} from "./GuidedImagePlacementTypes";

export const SLIMSAM_MODEL_REVISION =
  "5850ab45f587c112167512ffef949107115e26a0";
export const SLIMSAM_MODEL_ID = `slimsam-77-uniform/${SLIMSAM_MODEL_REVISION}`;
export const SLIMSAM_TRANSFORMERS_VERSION = "3.8.1";

type SlimSamNumericData =
  BigInt64Array | Float32Array | Uint8Array | Uint8ClampedArray;

export interface SlimSamTensorLike {
  data: SlimSamNumericData;
  dims: number[];
  dispose?(): void;
}

interface SlimSamProcessedImage {
  original_sizes: [number, number][];
  pixel_values: SlimSamTensorLike;
  reshaped_input_sizes: [number, number][];
}

export interface SlimSamProcessorLike {
  (image: unknown): Promise<SlimSamProcessedImage>;
  add_input_labels(
    labels: number[][],
    points: SlimSamTensorLike,
  ): SlimSamTensorLike;
  post_process_masks(
    masks: SlimSamTensorLike,
    originalSizes: [number, number][],
    reshapedInputSizes: [number, number][],
    options: { binarize: boolean },
  ): Promise<SlimSamTensorLike[]>;
  reshape_input_points(
    input: number[][][] | number[][][][],
    originalSizes: [number, number][],
    reshapedInputSizes: [number, number][],
    isBoundingBox?: boolean,
  ): SlimSamTensorLike;
}

interface SlimSamEmbeddings {
  image_embeddings: SlimSamTensorLike;
  image_positional_embeddings: SlimSamTensorLike;
}

export interface SlimSamModelLike {
  (input: {
    image_embeddings: SlimSamTensorLike;
    image_positional_embeddings: SlimSamTensorLike;
    input_boxes?: SlimSamTensorLike;
    input_labels?: SlimSamTensorLike;
    input_points?: SlimSamTensorLike;
  }): Promise<{
    iou_scores: SlimSamTensorLike;
    pred_masks: SlimSamTensorLike;
  }>;
  dispose(): Promise<unknown>;
  get_image_embeddings(input: {
    pixel_values: SlimSamTensorLike;
  }): Promise<SlimSamEmbeddings>;
}

export interface SlimSamRuntime {
  configure(options: { modelBaseUrl: string; wasmBaseUrl: string }): void;
  createRawImage(
    data: Uint8ClampedArray,
    width: number,
    height: number,
  ): unknown;
  loadModel(options: {
    backend: "webgpu" | "wasm";
    modelId: string;
    onProgress?: (progress?: number) => void;
  }): Promise<SlimSamModelLike>;
  loadProcessor(modelId: string): Promise<SlimSamProcessorLike>;
}

export interface SlimSamPromptMaskProviderOptions {
  backend: "webgpu" | "wasm";
  loadRuntime?: () => Promise<SlimSamRuntime>;
  modelBaseUrl: string;
  onProgress?: (stage: string, progress?: number) => void;
  wasmBaseUrl: string;
}

interface StoredImage {
  height: number;
  imageId: string;
  originalSizes: [number, number][];
  reshapedInputSizes: [number, number][];
  width: number;
}

function normalizedProgress(value: unknown): number | undefined {
  if (!value || typeof value !== "object") return undefined;
  const progress = value as Record<string, unknown>;
  if (typeof progress.progress === "number") return progress.progress / 100;
  if (
    typeof progress.loaded === "number" &&
    typeof progress.total === "number" &&
    progress.total > 0
  ) {
    return progress.loaded / progress.total;
  }
  return undefined;
}

async function loadTransformersRuntime(): Promise<SlimSamRuntime> {
  const transformers = await import("@huggingface/transformers");
  return {
    configure: ({ modelBaseUrl, wasmBaseUrl }) => {
      transformers.env.allowLocalModels = true;
      transformers.env.allowRemoteModels = false;
      transformers.env.localModelPath = modelBaseUrl;
      transformers.env.useBrowserCache = true;
      const onnxEnvironment = transformers.env.backends.onnx as {
        wasm?: { wasmPaths?: string };
      };
      onnxEnvironment.wasm ??= {};
      onnxEnvironment.wasm.wasmPaths = wasmBaseUrl;
    },
    createRawImage: (data, width, height) =>
      new transformers.RawImage(data, width, height, 4),
    loadModel: async ({ backend, modelId, onProgress }) =>
      (await transformers.SamModel.from_pretrained(modelId, {
        device: backend,
        dtype: backend === "webgpu" ? "fp16" : "q8",
        local_files_only: true,
        progress_callback: (value) => onProgress?.(normalizedProgress(value)),
      })) as unknown as SlimSamModelLike,
    loadProcessor: async (modelId) =>
      (await transformers.AutoProcessor.from_pretrained(modelId, {
        local_files_only: true,
      })) as unknown as SlimSamProcessorLike,
  };
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function disposeTensor(tensor: SlimSamTensorLike | undefined): void {
  tensor?.dispose?.();
}

export class SlimSamPromptMaskProvider implements PromptMaskProvider {
  readonly backend: SegmentationExecutionBackend;
  readonly provider = "slimsam" as const;
  readonly #options: SlimSamPromptMaskProviderOptions;
  #embeddings?: SlimSamEmbeddings;
  #image?: StoredImage;
  #imageGeneration = 0;
  #lifecycleGeneration = 0;
  #model?: SlimSamModelLike;
  #processor?: SlimSamProcessorLike;
  #runtime?: SlimSamRuntime;

  constructor(options: SlimSamPromptMaskProviderOptions) {
    this.#options = options;
    this.backend = options.backend;
  }

  async initialize(): Promise<void> {
    if (this.#model && this.#processor) return;
    const generation = this.#lifecycleGeneration;
    const runtime = await (
      this.#options.loadRuntime ?? loadTransformersRuntime
    )();
    runtime.configure({
      modelBaseUrl: this.#options.modelBaseUrl,
      wasmBaseUrl: this.#options.wasmBaseUrl,
    });
    const processor = await runtime.loadProcessor(SLIMSAM_MODEL_ID);
    const model = await runtime.loadModel({
      backend: this.#options.backend,
      modelId: SLIMSAM_MODEL_ID,
      onProgress: (progress) =>
        this.#options.onProgress?.("loading-model", progress),
    });
    if (generation !== this.#lifecycleGeneration) {
      void model.dispose();
      throw new Error("slimsam-disposed-during-initialization");
    }
    this.#runtime = runtime;
    this.#processor = processor;
    this.#model = model;
  }

  async setImage(image: SegmentationImageSource): Promise<ImageEmbeddingInfo> {
    await this.initialize();
    this.disposeImage();
    const generation = this.#imageGeneration;
    const runtime = this.#runtime;
    const processor = this.#processor;
    const model = this.#model;
    if (!runtime || !processor || !model) throw new Error("slimsam-not-ready");
    this.#options.onProgress?.("encoding", 0);
    const rawImage = runtime.createRawImage(
      image.pixels,
      image.sourceWidth,
      image.sourceHeight,
    );
    const processed = await processor(rawImage);
    try {
      const embeddings = await model.get_image_embeddings({
        pixel_values: processed.pixel_values,
      });
      if (generation !== this.#imageGeneration) {
        disposeTensor(embeddings.image_embeddings);
        disposeTensor(embeddings.image_positional_embeddings);
        throw new Error("slimsam-image-encoding-cancelled");
      }
      this.#embeddings = embeddings;
      this.#image = {
        height: image.sourceHeight,
        imageId: image.imageId,
        originalSizes: processed.original_sizes,
        reshapedInputSizes: processed.reshaped_input_sizes,
        width: image.sourceWidth,
      };
    } finally {
      disposeTensor(processed.pixel_values);
    }
    this.#options.onProgress?.("encoding", 1);
    return {
      height: image.sourceHeight,
      imageId: image.imageId,
      inputEdge: Math.max(image.sourceWidth, image.sourceHeight),
      width: image.sourceWidth,
    };
  }

  async decodeCandidates(
    input: ModelPromptInput,
  ): Promise<ModelMaskCandidate[]> {
    const processor = this.#processor;
    const model = this.#model;
    const embeddings = this.#embeddings;
    const image = this.#image;
    if (!processor || !model || !embeddings || !image) {
      throw new Error("slimsam-image-not-set");
    }
    const semanticPrompts = input.prompts.filter(
      (prompt) => prompt.kind !== "feature",
    );
    if (semanticPrompts.length === 0 && !input.subjectBox) {
      throw new Error("slimsam-prompt-required");
    }
    const pointCoordinates = semanticPrompts.map((prompt) => [
      prompt.point.x * image.width,
      prompt.point.y * image.height,
    ]);
    const pointLabels = semanticPrompts.map((prompt) =>
      prompt.kind === "subject" ? 1 : 0,
    );
    if (pointCoordinates.length === 0 && input.subjectBox) {
      pointCoordinates.push([
        ((input.subjectBox.left + input.subjectBox.right) / 2) * image.width,
        ((input.subjectBox.top + input.subjectBox.bottom) / 2) * image.height,
      ]);
      pointLabels.push(1);
    }

    let inputPoints: SlimSamTensorLike | undefined;
    let inputLabels: SlimSamTensorLike | undefined;
    let inputBoxes: SlimSamTensorLike | undefined;
    let outputMasks: SlimSamTensorLike | undefined;
    let outputScores: SlimSamTensorLike | undefined;
    let processedMasks: SlimSamTensorLike[] = [];
    try {
      inputPoints = processor.reshape_input_points(
        [pointCoordinates],
        image.originalSizes,
        image.reshapedInputSizes,
      );
      inputLabels = processor.add_input_labels([pointLabels], inputPoints);
      if (input.subjectBox) {
        inputBoxes = processor.reshape_input_points(
          [
            [
              [
                input.subjectBox.left * image.width,
                input.subjectBox.top * image.height,
                input.subjectBox.right * image.width,
                input.subjectBox.bottom * image.height,
              ],
            ],
          ],
          image.originalSizes,
          image.reshapedInputSizes,
          true,
        );
      }
      const output = await model({
        ...embeddings,
        input_boxes: inputBoxes,
        input_labels: inputLabels,
        input_points: inputPoints,
      });
      outputMasks = output.pred_masks;
      outputScores = output.iou_scores;
      processedMasks = await processor.post_process_masks(
        output.pred_masks,
        image.originalSizes,
        image.reshapedInputSizes,
        { binarize: false },
      );
      const processed = processedMasks[0];
      if (!processed) throw new Error("slimsam-empty-output");
      const height = processed.dims.at(-2) ?? 0;
      const width = processed.dims.at(-1) ?? 0;
      const area = width * height;
      const candidateCount = area > 0 ? processed.data.length / area : 0;
      if (!Number.isInteger(candidateCount) || candidateCount <= 0) {
        throw new Error("slimsam-invalid-output-shape");
      }
      return Array.from({ length: candidateCount }, (_, index) => {
        const data = new Float32Array(area);
        const offset = index * area;
        for (let pixel = 0; pixel < area; pixel += 1) {
          data[pixel] = sigmoid(Number(processed.data[offset + pixel] ?? 0));
        }
        return {
          index,
          predictedIoU: Number(output.iou_scores.data[index] ?? 0),
          probabilityMask: { data, height, width },
        };
      });
    } finally {
      disposeTensor(inputPoints);
      disposeTensor(inputLabels);
      disposeTensor(inputBoxes);
      disposeTensor(outputMasks);
      disposeTensor(outputScores);
      processedMasks.forEach(disposeTensor);
    }
  }

  disposeImage(): void {
    this.#imageGeneration += 1;
    disposeTensor(this.#embeddings?.image_embeddings);
    disposeTensor(this.#embeddings?.image_positional_embeddings);
    this.#embeddings = undefined;
    this.#image = undefined;
  }

  dispose(): void {
    this.#lifecycleGeneration += 1;
    this.disposeImage();
    void this.#model?.dispose();
    this.#model = undefined;
    this.#processor = undefined;
    this.#runtime = undefined;
  }
}
