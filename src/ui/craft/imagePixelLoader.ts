import type { ImageDataLike } from "./ImagePlacementRecipe";

export const IMAGE_FILE_MAXIMUM_BYTES = 20 * 1024 * 1024;
export const IMAGE_PIXEL_MAXIMUM_EDGE = 256;
export const GUIDED_IMAGE_PIXEL_MAXIMUM_EDGE = 256;
export const SEGMENTATION_IMAGE_PIXEL_MAXIMUM_EDGE = 1024;
export const IMAGE_TOTAL_PIXEL_MAXIMUM = 24_000_000;

export type ImagePixelLoadErrorCode =
  | "canvas-unavailable"
  | "decode-failed"
  | "empty-image"
  | "file-too-large"
  | "pixel-count-too-large"
  | "unsupported-format";

export class ImagePixelLoadError extends Error {
  readonly code: ImagePixelLoadErrorCode;

  constructor(code: ImagePixelLoadErrorCode, message: string) {
    super(message);
    this.name = "ImagePixelLoadError";
    this.code = code;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    const release = () => URL.revokeObjectURL(url);
    image.onload = () => {
      release();
      resolve(image);
    };
    image.onerror = () => {
      release();
      reject(
        new ImagePixelLoadError(
          "decode-failed",
          "画像を読み込めませんでした。",
        ),
      );
    };
    image.src = url;
  });
}

async function validateFile(file: File): Promise<void> {
  if (file.size > IMAGE_FILE_MAXIMUM_BYTES) {
    throw new ImagePixelLoadError(
      "file-too-large",
      "20MB以下の画像を選んでください。",
    );
  }
  if (!file.type.startsWith("image/")) {
    throw new ImagePixelLoadError(
      "unsupported-format",
      "対応している画像ファイルを選んでください。",
    );
  }
}

async function imagePixels(
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  maximumEdge: number,
): Promise<ImageDataLike> {
  if (sourceWidth * sourceHeight > IMAGE_TOTAL_PIXEL_MAXIMUM) {
    throw new ImagePixelLoadError(
      "pixel-count-too-large",
      "総画素数が24メガピクセル以下の画像を選んでください。",
    );
  }
  const scale = Math.min(1, maximumEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new ImagePixelLoadError(
      "canvas-unavailable",
      "このブラウザでは画像を解析できません。",
    );
  }
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  return { data: imageData.data, height, width };
}

export async function loadImagePixels(file: File): Promise<ImageDataLike> {
  await validateFile(file);
  const image = await loadImage(file);
  if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    throw new ImagePixelLoadError(
      "empty-image",
      "画像の大きさを取得できませんでした。",
    );
  }
  return imagePixels(
    image,
    image.naturalWidth,
    image.naturalHeight,
    IMAGE_PIXEL_MAXIMUM_EDGE,
  );
}

export interface GuidedImagePixels {
  analysisPixels: ImageDataLike;
  bitmap?: ImageBitmap;
  pixels: ImageDataLike;
  previewUrl: string;
  sourceHeight: number;
  sourceWidth: number;
}

export async function loadGuidedImagePixels(
  file: File,
): Promise<GuidedImagePixels> {
  await validateFile(file);
  const previewUrl = URL.createObjectURL(file);
  try {
    if (typeof createImageBitmap === "function") {
      const sourceBitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      let analysisPixels: ImageDataLike;
      let pixels: ImageDataLike;
      let sourceHeight: number;
      let sourceWidth: number;
      try {
        if (sourceBitmap.width <= 0 || sourceBitmap.height <= 0) {
          throw new ImagePixelLoadError(
            "empty-image",
            "画像の大きさを取得できませんでした。",
          );
        }
        sourceWidth = sourceBitmap.width;
        sourceHeight = sourceBitmap.height;
        pixels = await imagePixels(
          sourceBitmap,
          sourceWidth,
          sourceHeight,
          GUIDED_IMAGE_PIXEL_MAXIMUM_EDGE,
        );
        analysisPixels = await imagePixels(
          sourceBitmap,
          sourceWidth,
          sourceHeight,
          SEGMENTATION_IMAGE_PIXEL_MAXIMUM_EDGE,
        );
      } finally {
        sourceBitmap.close();
      }
      const bitmap = await createImageBitmap(
        new ImageData(
          Uint8ClampedArray.from(analysisPixels.data),
          analysisPixels.width,
          analysisPixels.height,
        ),
      );
      return {
        analysisPixels,
        bitmap,
        pixels,
        previewUrl,
        sourceHeight,
        sourceWidth,
      };
    }
    const image = await loadImage(file);
    const pixels = await imagePixels(
      image,
      image.naturalWidth,
      image.naturalHeight,
      GUIDED_IMAGE_PIXEL_MAXIMUM_EDGE,
    );
    const analysisPixels = await imagePixels(
      image,
      image.naturalWidth,
      image.naturalHeight,
      SEGMENTATION_IMAGE_PIXEL_MAXIMUM_EDGE,
    );
    return {
      analysisPixels,
      pixels,
      previewUrl,
      sourceHeight: image.naturalHeight,
      sourceWidth: image.naturalWidth,
    };
  } catch (error) {
    URL.revokeObjectURL(previewUrl);
    throw error;
  }
}
