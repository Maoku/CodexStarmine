# Image to virtual-star placement

[日本語版](IMAGE_TO_STARMINE.md)

The image-placement tool is available only for an unlocked manual layer. It converts a selected subject into editable manual points on the current shell slice.

## User-facing contract

- Images are processed locally in the browser and are not uploaded.
- The image data and filename are not stored in a firework design.
- Files are limited to 20 MB and decoded images to 24 megapixels.
- Subject prompts, placement range, point count, and color settings can be adjusted before applying.
- The result is deterministic for the same image and settings, and is applied as one Undo operation.
- The output remains schema v4 and can be moved, deleted, assigned virtual stars, undone, and redone like any other manual point.

## Processing

Transparent images use alpha first. Opaque images prefer SlimSAM with WebGPU fp16, then SlimSAM WASM q8, then a lightweight local fallback. The model and ONNX Runtime assets are served from this app's origin; remote model loading is disabled.

Use `?segmentation=fast` to force the lightweight fallback for regression comparisons. Detailed implementation history and all fixed asset hashes are in the [Japanese specification](IMAGE_TO_STARMINE.md).
