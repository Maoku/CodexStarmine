import type { ImageDataLike } from "./ImagePlacementRecipe";

export const IMAGE_FILE_MAXIMUM_BYTES = 20 * 1024 * 1024;
export const IMAGE_PIXEL_MAXIMUM_EDGE = 256;

export type ImagePixelLoadErrorCode =
  | "canvas-unavailable"
  | "decode-failed"
  | "empty-image"
  | "file-too-large"
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

export async function loadImagePixels(file: File): Promise<ImageDataLike> {
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
  const image = await loadImage(file);
  if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    throw new ImagePixelLoadError(
      "empty-image",
      "画像の大きさを取得できませんでした。",
    );
  }
  const scale = Math.min(
    1,
    IMAGE_PIXEL_MAXIMUM_EDGE /
      Math.max(image.naturalWidth, image.naturalHeight),
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
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
