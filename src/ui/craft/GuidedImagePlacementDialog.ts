import type { VirtualStarPreset } from "../../data";
import {
  createGuidedImagePlacement,
  DEFAULT_GUIDED_IMAGE_PLACEMENT_SETTINGS,
} from "./GuidedImagePlacementRecipe";
import type {
  GuidedImagePlacementResult,
  GuidedImagePlacementSettings,
  GuidedOutlineStar,
  GuidedPlacementMode,
  ImageInputMode,
  ImagePromptKind,
  NormalizedImagePoint,
  NormalizedImageRect,
  ProbabilityMask,
  PlacementWorkerRequest,
  PlacementWorkerResponse,
  SegmentationDiagnostics,
  SegmentationInteractionProfile,
  SegmentationProvider,
  SubjectMask,
} from "./GuidedImagePlacementTypes";
import {
  addImagePrompt,
  clearImagePromptSession,
  clearSubjectBox,
  createImagePromptSession,
  IMAGE_PROMPT_LIMITS,
  moveImagePrompt,
  normalizeImageRect,
  removeImagePrompt,
  setSubjectBox,
  undoImagePrompt,
  type ImagePromptSessionState,
} from "./ImagePromptSession";
import {
  ImageSegmentationClient,
  type ImageSegmentationClientOptions,
} from "./ImageSegmentationClient";
import {
  DEFAULT_IMAGE_DERIVED_STAR_KIND,
  IMAGE_PLACEMENT_MAXIMUM_POINTS,
  IMAGE_PLACEMENT_MINIMUM_POINTS,
  virtualStarRepresentativeColor,
  type ImageDerivedStarKind,
  type ImagePlacementResult,
} from "./ImagePlacementRecipe";
import {
  ImagePixelLoadError,
  loadGuidedImagePixels,
  type GuidedImagePixels,
} from "./imagePixelLoader";
import { createFastPromptMask } from "./PromptMaskProvider";
import { colorToCSS, escapeHTML } from "./viewUtils";

export interface GuidedImagePlacementColorOptions {
  enhanceDarkColors?: boolean;
  imageStarKind?: ImageDerivedStarKind;
  outlineStarId?: string;
  starDefinitions?: Record<string, VirtualStarPreset>;
}

export interface GuidedImagePlacementDialogResult {
  placement: ImagePlacementResult;
  settings: {
    applyMode: "append" | "replace";
    enhanceDarkColors: boolean;
    imageStarKind: ImageDerivedStarKind;
    outlineStarId: string;
    placementMode: GuidedPlacementMode;
    targetCount: number;
  };
}

export interface GuidedImagePlacementDialogOptions extends GuidedImagePlacementColorOptions {
  applyMode: "append" | "replace";
  createSegmentationClient?: (
    options: ImageSegmentationClientOptions,
  ) => ImageSegmentationClient;
  createPlacementWorker?: () => Worker;
  loadImage?: typeof loadGuidedImagePixels;
  placementMode?: GuidedPlacementMode;
  restoreFocus?: HTMLElement;
  targetCount: number;
}

type DialogStatus =
  | "awaiting-subject"
  | "decoding"
  | "encoding"
  | "error"
  | "loading-model"
  | "placing-stars"
  | "quantizing-colors"
  | "ready"
  | "segmenting"
  | "tracing-boundaries";

const PROMPT_LABELS: Record<ImagePromptKind, string> = {
  background: "背景",
  feature: "特徴",
  subject: "被写体",
};

const PROMPT_SYMBOLS: Record<ImagePromptKind, string> = {
  background: "−",
  feature: "★",
  subject: "+",
};

function clampDialogValue(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function availableOutlineStars(
  definitions: Record<string, VirtualStarPreset> = {},
): VirtualStarPreset[] {
  return Object.values(definitions).filter(
    (star) => !star.id.startsWith("star-image-"),
  );
}

function normalizedOutlineStarId(
  requested: string | undefined,
  stars: VirtualStarPreset[],
): string {
  const validIds = new Set(stars.map((star) => star.id));
  if (requested && validIds.has(requested)) return requested;
  return stars[0]?.id ?? "";
}

export function normalizedImagePoint(
  clientX: number,
  clientY: number,
  bounds: Pick<DOMRect, "height" | "left" | "top" | "width">,
): NormalizedImagePoint {
  return {
    x: Math.min(Math.max((clientX - bounds.left) / bounds.width, 0), 1),
    y: Math.min(Math.max((clientY - bounds.top) / bounds.height, 0), 1),
  };
}

export function moveImageCrosshair(
  point: NormalizedImagePoint,
  key: string,
  step = 0.01,
): NormalizedImagePoint {
  const offset = {
    ArrowDown: { x: 0, y: step },
    ArrowLeft: { x: -step, y: 0 },
    ArrowRight: { x: step, y: 0 },
    ArrowUp: { x: 0, y: -step },
  }[key];
  if (!offset) return point;
  return {
    x: Math.min(Math.max(point.x + offset.x, 0), 1),
    y: Math.min(Math.max(point.y + offset.y, 0), 1),
  };
}

export function imageSegmentationRuntimeLabel(
  provider: SegmentationProvider,
  backend: SegmentationDiagnostics["backend"] | undefined,
): string {
  if (provider === "alpha") return "画像解析: アルファ / モデル不使用";
  if (provider === "slimsam" && backend === "webgpu") {
    return "画像解析: SlimSAM / WebGPU (fp16)";
  }
  if (provider === "slimsam" && backend === "wasm") {
    return "画像解析: SlimSAM / WASM (q8)";
  }
  if (provider === "slimsam" && backend === "cpu") {
    return "画像解析: SlimSAM / CPU";
  }
  if (provider === "slimsam") return "画像解析: SlimSAM / 準備中";
  if (provider === "grabcut") return "画像解析: GrabCut / CPU";
  return "画像解析: 高速方式 / CPU";
}

export function renderGuidedImagePlacementDialogShell(
  fileName: string,
  targetCount: number,
  applyMode: "append" | "replace",
  placementMode = DEFAULT_GUIDED_IMAGE_PLACEMENT_SETTINGS.placementMode,
  colorOptions: GuidedImagePlacementColorOptions = {},
): string {
  const stars = availableOutlineStars(colorOptions.starDefinitions);
  const outlineStarId = normalizedOutlineStarId(
    colorOptions.outlineStarId,
    stars,
  );
  const outlineStar = stars.find((star) => star.id === outlineStarId);
  const enhanceDarkColors =
    colorOptions.enhanceDarkColors ??
    DEFAULT_GUIDED_IMAGE_PLACEMENT_SETTINGS.enhanceDarkColors;
  const imageStarKind =
    colorOptions.imageStarKind ?? DEFAULT_IMAGE_DERIVED_STAR_KIND;
  const starOptions = stars
    .map(
      (star) =>
        `<option value="${escapeHTML(star.id)}" ${star.id === outlineStarId ? "selected" : ""}>${escapeHTML(star.displayName)}</option>`,
    )
    .join("");
  return `<section class="guided-image-dialog" role="dialog" aria-modal="true" aria-labelledby="guided-image-dialog-title" aria-describedby="guided-image-dialog-help">
    <header class="guided-image-dialog-header">
      <div><p>POINT-GUIDED IMAGE</p><div class="guided-image-title-row"><h2 id="guided-image-dialog-title">画像から仮想星を作る</h2><span class="guided-image-runtime" data-guided-runtime data-backend="none" role="status" aria-live="polite">画像解析: 準備中</span></div></div>
      <button type="button" data-guided-action="close" aria-label="画像から仮想星を作る画面を閉じる">×</button>
    </header>
    <div class="guided-image-dialog-body">
      <section class="guided-image-preview-panel" aria-label="画像と生成プレビュー">
        <div class="guided-image-mode-row" role="group" aria-label="入力方法">
          <button type="button" data-input-mode="box" class="is-active" aria-pressed="true"><b>□</b> 被写体を囲む</button>
          <button type="button" data-input-mode="subject" data-prompt-kind="subject" aria-pressed="false"><b>＋</b> 被写体</button>
          <button type="button" data-input-mode="feature" data-prompt-kind="feature" aria-pressed="false" hidden><b>★</b> 特徴</button>
          <button type="button" data-input-mode="background" data-prompt-kind="background" aria-pressed="false" hidden><b>−</b> 背景を除外</button>
        </div>
        <div class="guided-image-viewport" data-guided-viewport>
          <div class="guided-image-stage" data-guided-stage tabindex="0" role="application" aria-label="画像上の被写体範囲と点指定。矢印キーで照準を動かし、EnterまたはSpaceで入力できます">
            <img alt="${escapeHTML(fileName)}" data-guided-image />
            <canvas data-guided-overlay aria-hidden="true"></canvas>
            <div class="guided-image-prompt-layer" data-guided-prompts></div>
            <span class="guided-image-crosshair" data-guided-crosshair aria-hidden="true"></span>
          </div>
        </div>
        <div class="guided-image-view-actions" aria-label="プレビュー操作">
          <button type="button" data-guided-action="undo" disabled>1つ戻す</button>
          <button type="button" data-guided-action="delete-selected" disabled>選択点を削除</button>
          <button type="button" data-guided-action="clear" disabled>指定をすべて消す</button>
          <button type="button" data-guided-action="zoom-out" aria-label="縮小">−</button>
          <button type="button" data-guided-action="zoom-in" aria-label="拡大">＋</button>
          <button type="button" data-guided-action="fit">全体表示</button>
        </div>
      </section>
      <aside class="guided-image-settings">
        <p id="guided-image-dialog-help" data-guided-help>最初に被写体をドラッグで囲むか、残したい部分へ＋点を置いてください。</p>
        <p class="guided-image-live" aria-live="polite" data-guided-live></p>
        <div class="guided-image-setting-grid">
          <label><span>配置範囲</span><select name="guided-placement-mode"><option value="outline" ${placementMode === "outline" ? "selected" : ""}>輪郭のみ</option><option value="outline-internal-boundary" ${placementMode === "outline-internal-boundary" ? "selected" : ""}>輪郭＋内部境界</option><option value="outline-internal-boundary-filled" ${placementMode === "outline-internal-boundary-filled" ? "selected" : ""}>輪郭＋内部境界＋内部</option></select></label>
          <label class="guided-target-count-setting"><span>目標点数 <output data-guided-target-output>${targetCount}点</output></span><input name="guided-target-count-range" type="range" min="${IMAGE_PLACEMENT_MINIMUM_POINTS}" max="${IMAGE_PLACEMENT_MAXIMUM_POINTS}" step="8" value="${targetCount}" aria-label="目標点数" aria-valuetext="${targetCount}点" /><input name="guided-target-count" type="number" min="${IMAGE_PLACEMENT_MINIMUM_POINTS}" max="${IMAGE_PLACEMENT_MAXIMUM_POINTS}" value="${targetCount}" aria-label="目標点数の数値入力" /></label>
          <label><span>生成方法</span><select name="guided-apply-mode"><option value="replace" ${applyMode === "replace" ? "selected" : ""}>置換</option><option value="append" ${applyMode === "append" ? "selected" : ""}>追加</option></select></label>
        </div>
        <div class="guided-placement-legend" data-guided-point-legend aria-label="仮配置点の凡例">
          <span data-point-kind="outline"><i></i>外形</span>
          <span data-point-kind="internal-boundary"><i></i>内部境界</span>
          <span data-point-kind="interior"><i></i>内部</span>
          <span data-point-kind="feature"><i></i>特徴</span>
        </div>
        <fieldset class="guided-image-color-settings">
          <legend>配色</legend>
          <p class="guided-image-palette-summary"><b>画像の代表色</b><span>内部・特徴を8色以内にまとめます</span></p>
          <label class="guided-image-star-kind-option"><span>内部・特徴の仮想星</span><select name="guided-image-star-kind"><option value="solid" ${imageStarKind === "solid" ? "selected" : ""}>単色星</option><option value="changing" ${imageStarKind === "changing" ? "selected" : ""}>変化星</option><option value="trail" ${imageStarKind === "trail" ? "selected" : ""}>引星</option></select></label>
          <div class="guided-image-setting-grid guided-image-color-option-grid">
            <label class="guided-image-check-setting" data-guided-dark-color-option><input name="guided-enhance-dark-colors" type="checkbox" ${enhanceDarkColors ? "checked" : ""} /><span>画像由来の黒・灰色・暗い色を花火向けに明るく補正</span></label>
          </div>
          <label class="guided-outline-star-option"><span>輪郭の仮想星色</span><span class="guided-outline-star-control"><i data-guided-outline-star-swatch style="--star:${colorToCSS(outlineStar ? virtualStarRepresentativeColor(outlineStar) : 0xffffff)}"></i><select name="guided-outline-star" ${stars.length === 0 ? "disabled" : ""}>${starOptions}</select></span></label>
          <p class="guided-image-color-help">輪郭は画像の代表8色と分け、ここで選んだ仮想星を使用します。</p>
        </fieldset>
        <section class="guided-image-prompt-list" aria-labelledby="guided-prompt-list-title">
          <header><h3 id="guided-prompt-list-title">指定内容</h3><span data-guided-point-summary>指定なし</span></header>
          <ol data-guided-prompt-list><li class="is-empty">被写体を囲むか、画像上へ点を追加します。</li></ol>
        </section>
        <div class="guided-image-diagnostics" data-guided-diagnostics>被写体点を待っています。</div>
      </aside>
    </div>
    <footer class="guided-image-dialog-footer">
      <div class="guided-image-processing" role="status" aria-live="polite">
        <span class="guided-image-spinner" aria-hidden="true"></span>
        <span data-guided-status>画像を読み込み中…</span>
        <progress data-guided-progress></progress>
      </div>
      <div class="guided-image-footer-actions">
        <button type="button" data-guided-action="cancel">取消</button>
        <button type="button" class="guided-image-apply" data-guided-action="apply" disabled>配置</button>
      </div>
    </footer>
  </section>`;
}

interface PanGesture {
  originX: number;
  originY: number;
  panX: number;
  panY: number;
  pointerId: number;
  moved: boolean;
}

type BoxHandle =
  | "new"
  | "move"
  | "north"
  | "north-east"
  | "east"
  | "south-east"
  | "south"
  | "south-west"
  | "west"
  | "north-west";

interface BoxGesture {
  handle: BoxHandle;
  moved: boolean;
  pointerId: number;
  startBox?: NormalizedImageRect;
  startPoint: NormalizedImagePoint;
}

interface PromptDragGesture {
  id: string;
  moved: boolean;
  originPoint: NormalizedImagePoint;
  pointerId: number;
  startPoint: NormalizedImagePoint;
}

class GuidedImagePlacementDialog {
  readonly #backdrop = document.createElement("div");
  readonly #file: File;
  readonly #options: GuidedImagePlacementDialogOptions;
  readonly #result: Promise<GuidedImagePlacementDialogResult | undefined>;
  #activeMode: ImageInputMode = "box";
  #applyMode: "append" | "replace";
  #boxGesture?: BoxGesture;
  #client?: ImageSegmentationClient;
  #closed = false;
  #crosshair: NormalizedImagePoint = { x: 0.5, y: 0.5 };
  #generation = 0;
  #draftBox?: NormalizedImageRect;
  #draftPromptPoint?: NormalizedImagePoint;
  #enhanceDarkColors: boolean;
  #imageStarKind: ImageDerivedStarKind;
  #interactionProfile: SegmentationInteractionProfile = "model";
  #inertSiblings: Array<{
    ariaHidden: string | null;
    element: HTMLElement;
    inert: boolean;
  }> = [];
  #loaded?: GuidedImagePixels;
  #mask?: SubjectMask;
  #maskProvider: SegmentationProvider = "fast";
  #maskRevision = 0;
  #probabilityMask?: ProbabilityMask;
  #runtimeBackend?: SegmentationDiagnostics["backend"];
  #runtimeProvider?: SegmentationProvider;
  #segmentationDiagnostics?: SegmentationDiagnostics;
  #segmentationPending = false;
  #constraintsSatisfied = false;
  #keyboardBoxStart?: NormalizedImagePoint;
  #nextPromptId = 1;
  #outlineStarId: string;
  readonly #outlineStars: VirtualStarPreset[];
  #pan = { x: 0, y: 0 };
  #panGesture?: PanGesture;
  #placement?: GuidedImagePlacementResult;
  #placementDebounceTimer = 0;
  #placementRequestId = 0;
  #placementWorker?: Worker;
  #placementWorkerFailed = false;
  #placementMode: GuidedPlacementMode;
  #promptDrag?: PromptDragGesture;
  #resolve!: (value: GuidedImagePlacementDialogResult | undefined) => void;
  #selectedPromptId?: string;
  #session: ImagePromptSessionState = createImagePromptSession();
  #status: DialogStatus = "decoding";
  #suppressStageClick = false;
  #targetCount: number;
  #zoom = 1;

  constructor(file: File, options: GuidedImagePlacementDialogOptions) {
    this.#file = file;
    this.#options = options;
    this.#applyMode = options.applyMode;
    this.#enhanceDarkColors =
      options.enhanceDarkColors ??
      DEFAULT_GUIDED_IMAGE_PLACEMENT_SETTINGS.enhanceDarkColors;
    this.#placementMode =
      options.placementMode ??
      DEFAULT_GUIDED_IMAGE_PLACEMENT_SETTINGS.placementMode;
    this.#imageStarKind =
      options.imageStarKind ??
      DEFAULT_GUIDED_IMAGE_PLACEMENT_SETTINGS.imageStarKind;
    this.#outlineStars = availableOutlineStars(options.starDefinitions);
    this.#outlineStarId = normalizedOutlineStarId(
      options.outlineStarId,
      this.#outlineStars,
    );
    this.#targetCount = Math.round(
      Math.min(
        Math.max(options.targetCount, IMAGE_PLACEMENT_MINIMUM_POINTS),
        IMAGE_PLACEMENT_MAXIMUM_POINTS,
      ),
    );
    this.#result = new Promise((resolve) => (this.#resolve = resolve));
    this.#backdrop.className = "guided-image-dialog-backdrop";
    this.#backdrop.innerHTML = renderGuidedImagePlacementDialogShell(
      file.name,
      this.#targetCount,
      this.#applyMode,
      this.#placementMode,
      {
        enhanceDarkColors: this.#enhanceDarkColors,
        imageStarKind: this.#imageStarKind,
        outlineStarId: this.#outlineStarId,
        starDefinitions: options.starDefinitions,
      },
    );
    this.#backdrop.addEventListener("click", this.#handleClick);
    this.#backdrop.addEventListener("change", this.#handleChange);
    this.#backdrop.addEventListener("input", this.#handleInput);
    this.#backdrop.addEventListener("keydown", this.#handleKeyDown);
    const viewport = this.#query<HTMLElement>("[data-guided-viewport]");
    viewport.addEventListener("pointerdown", this.#handlePointerDown);
    viewport.addEventListener("pointermove", this.#handlePointerMove);
    viewport.addEventListener("pointerup", this.#handlePointerEnd);
    viewport.addEventListener("pointercancel", this.#handlePointerEnd);
  }

  open(): Promise<GuidedImagePlacementDialogResult | undefined> {
    this.#inertSiblings = Array.from(document.body.children)
      .filter(
        (element): element is HTMLElement => element instanceof HTMLElement,
      )
      .map((element) => ({
        ariaHidden: element.getAttribute("aria-hidden"),
        element,
        inert: element.inert,
      }));
    document.body.append(this.#backdrop);
    this.#inertSiblings.forEach(({ element }) => {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    });
    document.body.classList.add("has-guided-image-dialog");
    this.#query<HTMLButtonElement>("[data-guided-action='close']").focus();
    void this.#initialize();
    return this.#result;
  }

  async #initialize(): Promise<void> {
    try {
      const loadImage = this.#options.loadImage ?? loadGuidedImagePixels;
      const loaded = await loadImage(this.#file);
      if (this.#closed) {
        URL.revokeObjectURL(loaded.previewUrl);
        return;
      }
      this.#loaded = loaded;
      const image = this.#query<HTMLImageElement>("[data-guided-image]");
      image.src = loaded.previewUrl;
      const stage = this.#query<HTMLElement>("[data-guided-stage]");
      stage.style.aspectRatio = `${loaded.sourceWidth} / ${loaded.sourceHeight}`;
      this.#client = (
        this.#options.createSegmentationClient ??
        ((options) => new ImageSegmentationClient(options))
      )({
        onProviderChange: (profile, provider, fallbackReason, backend) => {
          if (this.#closed) return;
          if (provider) {
            this.#runtimeProvider = provider;
            this.#runtimeBackend = backend;
          }
          if (profile !== this.#interactionProfile) {
            this.#interactionProfile = profile;
            if (
              profile === "model" &&
              (this.#activeMode === "feature" ||
                this.#activeMode === "background")
            ) {
              this.#activeMode = "box";
            }
            if (profile === "classic" && fallbackReason) {
              this.#announce(
                "軽量方式へ切り替えました。必要なら特徴・背景を追加できます。",
              );
            }
          }
          this.#renderState();
        },
        onProgress: (stage, progress) => {
          if (this.#closed) return;
          if (stage === "loading-model") {
            const percent =
              progress === undefined ? "" : ` ${Math.round(progress * 100)}%`;
            this.#setStatus(
              "loading-model",
              `高精度モデルを準備中…${percent}`,
              progress,
            );
          } else if (stage === "encoding") {
            this.#setStatus(
              progress === 1 ? "awaiting-subject" : "encoding",
              progress === 1
                ? "被写体を囲むか点を指定してください"
                : "画像を高精度解析中…",
            );
          } else if (stage === "embedding-ready") {
            this.#setStatus(
              "awaiting-subject",
              "被写体を囲むか点を指定してください",
            );
          } else if (stage === "segmenting") {
            this.#setStatus("segmenting", "被写体マスクを更新中…");
          }
        },
      });
      this.#client.setImage(loaded.analysisPixels);
      const provisional = createFastPromptMask(loaded.pixels, []);
      this.#mask = provisional.mask;
      this.#maskProvider = provisional.provider;
      this.#probabilityMask = provisional.probabilityMask;
      this.#segmentationDiagnostics = provisional.diagnostics;
      this.#constraintsSatisfied = provisional.constraintsSatisfied;
      this.#setStatus("awaiting-subject", "被写体を囲むか点を指定してください");
      this.#renderState();
    } catch (error) {
      if (this.#closed) return;
      this.#setStatus(
        "error",
        error instanceof ImagePixelLoadError
          ? error.message
          : "画像を読み込めませんでした。",
      );
      this.#renderState();
    }
  }

  readonly #handleClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLElement>("[data-guided-action]")?.dataset
      .guidedAction;
    if (action === "close" || action === "cancel") {
      this.#close();
      return;
    }
    if (action === "apply") {
      if (!this.#placement || this.#placement.points.length < 8) return;
      this.#close({
        placement: {
          colors: [...this.#placement.colors],
          enhanceDarkColors: this.#placement.enhanceDarkColors,
          imageStarKind: this.#placement.imageStarKind,
          points: this.#placement.points.map((point) => ({ ...point })),
          preserveColorAssignments: this.#placement.preserveColorAssignments,
          starIds: this.#placement.starIds
            ? [...this.#placement.starIds]
            : undefined,
        },
        settings: {
          applyMode: this.#applyMode,
          enhanceDarkColors: this.#enhanceDarkColors,
          imageStarKind: this.#imageStarKind,
          outlineStarId: this.#outlineStarId,
          placementMode: this.#placementMode,
          targetCount: this.#targetCount,
        },
      });
      return;
    }
    const inputMode = target.closest<HTMLElement>("[data-input-mode]")?.dataset
      .inputMode as ImageInputMode | undefined;
    if (inputMode) {
      this.#activeMode = inputMode;
      this.#keyboardBoxStart = undefined;
      this.#renderState();
      return;
    }
    if (action === "remove-box") {
      this.#mutatePrompts(
        clearSubjectBox(this.#session),
        "被写体の範囲を削除しました。",
      );
      return;
    }
    const promptId =
      target.closest<HTMLElement>("[data-prompt-id]")?.dataset.promptId;
    if (promptId) {
      if (action === "remove-prompt") {
        this.#mutatePrompts(
          removeImagePrompt(this.#session, promptId),
          `点を削除しました。`,
        );
      } else {
        this.#selectedPromptId = promptId;
        this.#renderState();
      }
      return;
    }
    if (action === "undo") {
      this.#mutatePrompts(undoImagePrompt(this.#session), "1つ戻しました。");
      return;
    }
    if (action === "delete-selected" && this.#selectedPromptId) {
      this.#mutatePrompts(
        removeImagePrompt(this.#session, this.#selectedPromptId),
        "選択点を削除しました。",
      );
      return;
    }
    if (action === "clear") {
      this.#mutatePrompts(
        clearImagePromptSession(this.#session),
        "すべての指定を消しました。",
      );
      return;
    }
    if (action === "zoom-in") {
      this.#zoom = Math.min(3, this.#zoom + 0.25);
      this.#applyTransform();
      return;
    }
    if (action === "zoom-out") {
      this.#zoom = Math.max(1, this.#zoom - 0.25);
      if (this.#zoom === 1) this.#pan = { x: 0, y: 0 };
      this.#applyTransform();
      return;
    }
    if (action === "fit") {
      this.#zoom = 1;
      this.#pan = { x: 0, y: 0 };
      this.#applyTransform();
      return;
    }
    if (target.closest("[data-guided-stage]")) {
      if (this.#suppressStageClick) {
        this.#suppressStageClick = false;
        return;
      }
      if (this.#activeMode === "box") return;
      const stage = this.#query<HTMLElement>("[data-guided-stage]");
      const mouse = event as MouseEvent;
      this.#addPrompt(
        normalizedImagePoint(
          mouse.clientX,
          mouse.clientY,
          stage.getBoundingClientRect(),
        ),
      );
    }
  };

  readonly #handleChange = (event: Event): void => {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    if (input.name === "guided-target-count") {
      const value = Number(input.value);
      if (Number.isFinite(value)) {
        this.#targetCount = Math.round(
          Math.min(
            Math.max(value, IMAGE_PLACEMENT_MINIMUM_POINTS),
            IMAGE_PLACEMENT_MAXIMUM_POINTS,
          ),
        );
      }
      this.#renderTargetCountInputs();
      this.#rebuildPlacement();
    } else if (input.name === "guided-placement-mode") {
      if (
        input.value === "outline" ||
        input.value === "outline-internal-boundary" ||
        input.value === "outline-internal-boundary-filled"
      ) {
        this.#placementMode = input.value;
      }
      this.#rebuildPlacement();
    } else if (input.name === "guided-enhance-dark-colors") {
      this.#enhanceDarkColors = (input as HTMLInputElement).checked;
      this.#updatePlacementAppearance();
    } else if (input.name === "guided-image-star-kind") {
      if (
        input.value === "solid" ||
        input.value === "changing" ||
        input.value === "trail"
      ) {
        this.#imageStarKind = input.value;
        this.#updatePlacementAppearance();
      }
    } else if (input.name === "guided-outline-star") {
      if (this.#outlineStars.some((star) => star.id === input.value)) {
        this.#outlineStarId = input.value;
        this.#updatePlacementAppearance();
      }
    } else if (input.name === "guided-apply-mode") {
      this.#applyMode = input.value === "append" ? "append" : "replace";
    }
  };

  readonly #handleInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    if (!Number.isFinite(value) || input.value === "") return;
    if (input.name === "guided-target-count-range") {
      this.#targetCount = Math.round(
        clampDialogValue(
          value,
          IMAGE_PLACEMENT_MINIMUM_POINTS,
          IMAGE_PLACEMENT_MAXIMUM_POINTS,
        ),
      );
      this.#renderTargetCountInputs();
    } else if (
      input.name === "guided-target-count" &&
      value >= IMAGE_PLACEMENT_MINIMUM_POINTS &&
      value <= IMAGE_PLACEMENT_MAXIMUM_POINTS
    ) {
      this.#targetCount = Math.round(value);
      this.#renderTargetCountRange();
    } else {
      return;
    }
    window.clearTimeout(this.#placementDebounceTimer);
    this.#placementDebounceTimer = window.setTimeout(
      () => this.#rebuildPlacement(),
      100,
    );
  };

  readonly #handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (this.#keyboardBoxStart) {
        this.#keyboardBoxStart = undefined;
        this.#draftBox = undefined;
        this.#announce("矩形の入力を取り消しました。");
        this.#renderState();
        return;
      }
      this.#close();
      return;
    }
    const target = event.target as HTMLElement;
    if (
      target instanceof HTMLInputElement &&
      target.name === "guided-target-count-range" &&
      (event.key === "PageUp" || event.key === "PageDown")
    ) {
      event.preventDefault();
      this.#targetCount = Math.round(
        clampDialogValue(
          this.#targetCount + (event.key === "PageUp" ? 128 : -128),
          IMAGE_PLACEMENT_MINIMUM_POINTS,
          IMAGE_PLACEMENT_MAXIMUM_POINTS,
        ),
      );
      this.#renderTargetCountInputs();
      this.#rebuildPlacement();
      return;
    }
    if (target.closest("[data-guided-stage]")) {
      if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        this.#crosshair = moveImageCrosshair(
          this.#crosshair,
          event.key,
          event.shiftKey ? 0.05 : 0.01,
        );
        if (this.#keyboardBoxStart) {
          this.#draftBox = normalizeImageRect(
            this.#keyboardBoxStart,
            this.#crosshair,
          );
          this.#renderState();
        }
        this.#renderCrosshair();
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (this.#activeMode === "box") {
          if (!this.#keyboardBoxStart) {
            this.#keyboardBoxStart = { ...this.#crosshair };
            this.#draftBox = normalizeImageRect(
              this.#crosshair,
              this.#crosshair,
            );
            this.#announce(
              "矩形の始点を指定しました。照準を終点へ動かして確定してください。",
            );
            this.#renderState();
          } else {
            this.#commitSubjectBox(
              normalizeImageRect(this.#keyboardBoxStart, this.#crosshair),
            );
            this.#keyboardBoxStart = undefined;
            this.#draftBox = undefined;
          }
        } else {
          this.#addPrompt(this.#crosshair);
        }
        return;
      }
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      this.#backdrop.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex='0']",
      ),
    ).filter((element) => element.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  readonly #handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.button !== 1) return;
    const target = event.target as HTMLElement;
    const stage = this.#query<HTMLElement>("[data-guided-stage]");
    const point = normalizedImagePoint(
      event.clientX,
      event.clientY,
      stage.getBoundingClientRect(),
    );
    const promptId = target.closest<HTMLElement>(".guided-image-prompt")
      ?.dataset.promptId;
    if (promptId && event.button === 0) {
      const prompt = this.#session.prompts.find((item) => item.id === promptId);
      if (!prompt) return;
      this.#selectedPromptId = promptId;
      this.#promptDrag = {
        id: promptId,
        moved: false,
        originPoint: { ...prompt.point },
        pointerId: event.pointerId,
        startPoint: point,
      };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      return;
    }
    const boxHandle = target.closest<HTMLElement>("[data-box-handle]")?.dataset
      .boxHandle as BoxHandle | undefined;
    if (boxHandle && this.#session.subjectBox && event.button === 0) {
      this.#boxGesture = {
        handle: boxHandle,
        moved: false,
        pointerId: event.pointerId,
        startBox: { ...this.#session.subjectBox },
        startPoint: point,
      };
      this.#draftBox = { ...this.#session.subjectBox };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      return;
    }
    if (
      this.#activeMode === "box" &&
      event.button === 0 &&
      target.closest("[data-guided-stage]")
    ) {
      this.#boxGesture = {
        handle: "new",
        moved: false,
        pointerId: event.pointerId,
        startPoint: point,
      };
      this.#draftBox = normalizeImageRect(point, point);
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    if (this.#zoom <= 1) return;
    this.#panGesture = {
      moved: false,
      originX: event.clientX,
      originY: event.clientY,
      panX: this.#pan.x,
      panY: this.#pan.y,
      pointerId: event.pointerId,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  readonly #handlePointerMove = (event: PointerEvent): void => {
    const stage = this.#query<HTMLElement>("[data-guided-stage]");
    const point = normalizedImagePoint(
      event.clientX,
      event.clientY,
      stage.getBoundingClientRect(),
    );
    const promptDrag = this.#promptDrag;
    if (promptDrag?.pointerId === event.pointerId) {
      promptDrag.moved ||=
        Math.hypot(
          point.x - promptDrag.startPoint.x,
          point.y - promptDrag.startPoint.y,
        ) > 0.004;
      if (promptDrag.moved) {
        this.#draftPromptPoint = {
          x: Math.min(
            1,
            Math.max(
              0,
              promptDrag.originPoint.x + point.x - promptDrag.startPoint.x,
            ),
          ),
          y: Math.min(
            1,
            Math.max(
              0,
              promptDrag.originPoint.y + point.y - promptDrag.startPoint.y,
            ),
          ),
        };
        this.#renderState();
      }
      event.preventDefault();
      return;
    }
    const boxGesture = this.#boxGesture;
    if (boxGesture?.pointerId === event.pointerId) {
      boxGesture.moved ||=
        Math.hypot(
          point.x - boxGesture.startPoint.x,
          point.y - boxGesture.startPoint.y,
        ) > 0.004;
      this.#draftBox = this.#boxForGesture(boxGesture, point);
      this.#renderState();
      event.preventDefault();
      return;
    }
    const gesture = this.#panGesture;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - gesture.originX;
    const deltaY = event.clientY - gesture.originY;
    gesture.moved ||= Math.hypot(deltaX, deltaY) > 4;
    if (!gesture.moved) return;
    this.#pan = { x: gesture.panX + deltaX, y: gesture.panY + deltaY };
    this.#applyTransform();
    event.preventDefault();
  };

  readonly #handlePointerEnd = (event: PointerEvent): void => {
    if (this.#promptDrag?.pointerId === event.pointerId) {
      const gesture = this.#promptDrag;
      this.#promptDrag = undefined;
      this.#suppressStageClick = gesture.moved;
      const point = this.#draftPromptPoint;
      this.#draftPromptPoint = undefined;
      if (gesture.moved && point) {
        this.#mutatePrompts(
          moveImagePrompt(this.#session, gesture.id, point),
          "点を移動しました。",
        );
      } else {
        this.#renderState();
      }
      return;
    }
    if (this.#boxGesture?.pointerId === event.pointerId) {
      const gesture = this.#boxGesture;
      const rect = this.#draftBox;
      this.#boxGesture = undefined;
      this.#draftBox = undefined;
      this.#suppressStageClick = true;
      if (rect && (gesture.moved || gesture.handle !== "new")) {
        this.#commitSubjectBox(rect);
      } else {
        this.#announce("矩形はドラッグして指定してください。");
        this.#renderState();
      }
      return;
    }
    if (this.#panGesture?.pointerId === event.pointerId) {
      this.#suppressStageClick = this.#panGesture.moved;
      this.#panGesture = undefined;
    }
  };

  #boxForGesture(
    gesture: BoxGesture,
    point: NormalizedImagePoint,
  ): NormalizedImageRect {
    if (gesture.handle === "new" || !gesture.startBox) {
      return normalizeImageRect(gesture.startPoint, point);
    }
    const box = { ...gesture.startBox };
    if (gesture.handle === "move") {
      const width = box.right - box.left;
      const height = box.bottom - box.top;
      const left = Math.min(
        1 - width,
        Math.max(0, box.left + point.x - gesture.startPoint.x),
      );
      const top = Math.min(
        1 - height,
        Math.max(0, box.top + point.y - gesture.startPoint.y),
      );
      return { bottom: top + height, left, right: left + width, top };
    }
    if (gesture.handle.includes("west")) box.left = point.x;
    if (gesture.handle.includes("east")) box.right = point.x;
    if (gesture.handle.includes("north")) box.top = point.y;
    if (gesture.handle.includes("south")) box.bottom = point.y;
    return normalizeImageRect(
      { x: box.left, y: box.top },
      { x: box.right, y: box.bottom },
    );
  }

  #commitSubjectBox(rect: NormalizedImageRect): void {
    const stage = this.#query<HTMLElement>("[data-guided-stage]");
    const bounds = stage.getBoundingClientRect();
    if (
      (rect.right - rect.left) * bounds.width < 8 ||
      (rect.bottom - rect.top) * bounds.height < 8
    ) {
      this.#announce("被写体の範囲は8px以上の大きさで指定してください。");
      this.#renderState();
      return;
    }
    this.#mutatePrompts(
      setSubjectBox(this.#session, rect),
      "被写体の範囲を更新しました。",
    );
  }

  #addPrompt(point: NormalizedImagePoint): void {
    if (!this.#loaded || this.#status === "error") return;
    if (this.#activeMode === "box") return;
    if (
      this.#interactionProfile === "model" &&
      (this.#activeMode === "feature" || this.#activeMode === "background")
    ) {
      return;
    }
    const result = addImagePrompt(this.#session, {
      id: `image-prompt-${this.#nextPromptId++}`,
      kind: this.#activeMode,
      point,
    });
    if (!result.changed) {
      this.#announce(
        `${PROMPT_LABELS[this.#activeMode]}点は${IMAGE_PROMPT_LIMITS[this.#activeMode]}点までです。`,
      );
      return;
    }
    this.#session = result.state;
    this.#selectedPromptId = this.#session.prompts.at(-1)?.id;
    this.#refreshForPromptChange(this.#activeMode !== "feature");
  }

  #mutatePrompts(next: ImagePromptSessionState, announcement: string): void {
    if (next === this.#session) return;
    const beforeMaskSignature = this.#maskPromptSignature(this.#session);
    this.#session = next;
    if (
      this.#selectedPromptId &&
      !next.prompts.some((prompt) => prompt.id === this.#selectedPromptId)
    ) {
      this.#selectedPromptId = next.prompts.at(-1)?.id;
    }
    this.#announce(announcement);
    this.#refreshForPromptChange(
      beforeMaskSignature !== this.#maskPromptSignature(next),
    );
  }

  #refreshForPromptChange(maskChanged: boolean): void {
    if (maskChanged) this.#generation += 1;
    const hasSubjectInput =
      Boolean(this.#session.subjectBox) ||
      this.#session.prompts.some((prompt) => prompt.kind === "subject");
    if (!hasSubjectInput) {
      this.#generation += 1;
      this.#placementRequestId += 1;
      this.#client?.cancel();
      if (this.#loaded) {
        const provisional = createFastPromptMask(this.#loaded.pixels, []);
        this.#mask = provisional.mask;
        this.#maskProvider = provisional.provider;
        this.#probabilityMask = provisional.probabilityMask;
        this.#segmentationDiagnostics = provisional.diagnostics;
        this.#constraintsSatisfied = false;
      }
      this.#placement = undefined;
      this.#setStatus("awaiting-subject", "被写体を囲むか点を指定してください");
      this.#renderState();
      return;
    }
    if (!maskChanged && this.#mask) {
      this.#rebuildPlacement();
      return;
    }
    void this.#segmentLatest(this.#generation);
    this.#renderState();
  }

  async #segmentLatest(generation: number): Promise<void> {
    if (!this.#loaded || !this.#client) return;
    this.#segmentationPending = true;
    const revision = this.#session.revision;
    const prompts = structuredClone(this.#effectivePrompts());
    const subjectBox = this.#session.subjectBox
      ? { ...this.#session.subjectBox }
      : undefined;
    const maskSignature = this.#maskPromptSignature({ prompts, subjectBox });
    const provisional = createFastPromptMask(
      this.#loaded.pixels,
      prompts,
      subjectBox,
    );
    this.#mask = provisional.mask;
    this.#maskProvider = provisional.provider;
    this.#probabilityMask = provisional.probabilityMask;
    this.#segmentationDiagnostics = provisional.diagnostics;
    this.#constraintsSatisfied = provisional.constraintsSatisfied;
    this.#maskRevision = revision;
    this.#rebuildPlacement();
    this.#setStatus("segmenting", "被写体マスクを更新中…");
    this.#renderState();
    try {
      const result = await this.#client.segment(prompts, revision, subjectBox);
      if (
        this.#closed ||
        generation !== this.#generation ||
        maskSignature !== this.#maskPromptSignature(this.#session)
      ) {
        return;
      }
      this.#mask = result.mask;
      this.#maskProvider = result.provider;
      this.#probabilityMask = result.probabilityMask;
      this.#segmentationDiagnostics = result.diagnostics;
      this.#constraintsSatisfied = result.constraintsSatisfied;
      this.#maskRevision = result.revision;
      this.#segmentationPending = false;
      this.#rebuildPlacement();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        if (generation === this.#generation) this.#segmentationPending = false;
        return;
      }
      if (this.#closed || generation !== this.#generation) return;
      this.#segmentationPending = false;
      this.#maskProvider = "fast";
      this.#constraintsSatisfied = provisional.constraintsSatisfied;
      this.#segmentationDiagnostics = {
        ...provisional.diagnostics,
        fallbackReason: "segmentation-client-failed",
      };
      this.#rebuildPlacement();
      this.#announce(
        "高精度処理を利用できないため、軽量方式へ切り替えました。",
      );
      this.#renderState();
    }
  }

  #rebuildPlacement(): void {
    if (!this.#loaded || !this.#mask) return;
    const hasSubjectInput =
      Boolean(this.#session.subjectBox) ||
      this.#session.prompts.some((prompt) => prompt.kind === "subject");
    if (!hasSubjectInput) {
      this.#placement = undefined;
      this.#renderState();
      return;
    }
    const requestId = ++this.#placementRequestId;
    this.#placement = undefined;
    if (!this.#segmentationPending) {
      this.#setStatus("quantizing-colors", "画像を8色へ整理中…");
    }
    const request: PlacementWorkerRequest = {
      image: this.#placementImage(),
      mask: this.#mask,
      maskProvider: this.#maskProvider,
      prompts: structuredClone(this.#effectivePrompts()),
      requestId,
      revision: this.#maskRevision,
      segmentation: this.#segmentationDiagnostics,
      settings: this.#placementSettings(),
      type: "build-placement",
    };
    const worker = this.#ensurePlacementWorker();
    if (worker) {
      worker.postMessage(request);
    } else {
      this.#buildPlacementFallback(request);
    }
    this.#renderState();
  }

  #placementImage(): GuidedImagePixels["pixels"] {
    if (!this.#loaded || !this.#mask) {
      throw new Error("Guided placement image is not ready.");
    }
    return this.#mask.width === this.#loaded.analysisPixels.width &&
      this.#mask.height === this.#loaded.analysisPixels.height
      ? this.#loaded.analysisPixels
      : this.#loaded.pixels;
  }

  #placementSettings(): GuidedImagePlacementSettings {
    return {
      ...DEFAULT_GUIDED_IMAGE_PLACEMENT_SETTINGS,
      enhanceDarkColors: this.#enhanceDarkColors,
      imageStarKind: this.#imageStarKind,
      outlineStar: this.#selectedOutlineStar(),
      placementMode: this.#placementMode,
      targetCount: this.#targetCount,
    };
  }

  #updatePlacementAppearance(): void {
    if (!this.#placement) {
      this.#rebuildPlacement();
      return;
    }
    this.#placement.enhanceDarkColors = this.#enhanceDarkColors;
    this.#placement.imageStarKind = this.#imageStarKind;
    const outlineStar = this.#selectedOutlineStar();
    if (outlineStar) {
      this.#placement.pointKinds.forEach((kind, index) => {
        if (kind !== "outline") return;
        this.#placement!.colors[index] = outlineStar.color;
        this.#placement!.starIds ??= Array.from(
          { length: this.#placement!.points.length },
          () => undefined,
        );
        this.#placement!.starIds[index] = outlineStar.starId;
      });
    }
    this.#renderState();
  }

  #ensurePlacementWorker(): Worker | undefined {
    if (this.#placementWorkerFailed) return undefined;
    if (this.#placementWorker) return this.#placementWorker;
    if (!this.#options.createPlacementWorker && typeof Worker === "undefined") {
      return undefined;
    }
    try {
      this.#placementWorker = this.#options.createPlacementWorker
        ? this.#options.createPlacementWorker()
        : new Worker(new URL("./GuidedPlacementWorker.ts", import.meta.url), {
            type: "module",
          });
      this.#placementWorker.addEventListener(
        "message",
        this.#handlePlacementWorkerMessage,
      );
      this.#placementWorker.addEventListener(
        "error",
        this.#handlePlacementWorkerError,
      );
      return this.#placementWorker;
    } catch {
      this.#placementWorkerFailed = true;
      this.#placementWorker = undefined;
      return undefined;
    }
  }

  readonly #handlePlacementWorkerMessage = (
    event: MessageEvent<PlacementWorkerResponse>,
  ): void => {
    const response = event.data;
    if (this.#closed || response.requestId !== this.#placementRequestId) return;
    if (response.type === "progress") {
      if (this.#segmentationPending) return;
      if (response.stage === "quantizing-colors") {
        this.#setStatus(
          "quantizing-colors",
          "画像を8色へ整理中…",
          response.progress,
        );
      } else if (response.stage === "tracing-boundaries") {
        this.#setStatus(
          "tracing-boundaries",
          "内部境界を検出中…",
          response.progress,
        );
      } else {
        this.#setStatus("placing-stars", "仮想星を配置中…", response.progress);
      }
      this.#renderState();
      return;
    }
    if (response.type === "error") {
      this.#placementWorkerFailed = true;
      this.#placementWorker?.terminate();
      this.#placementWorker = undefined;
      this.#buildPlacementFallback({
        image: this.#placementImage(),
        mask: this.#mask!,
        maskProvider: this.#maskProvider,
        prompts: structuredClone(this.#effectivePrompts()),
        requestId: response.requestId,
        revision: this.#maskRevision,
        segmentation: this.#segmentationDiagnostics,
        settings: this.#placementSettings(),
        type: "build-placement",
      });
      return;
    }
    if (response.revision !== this.#maskRevision) return;
    this.#acceptPlacement(response.placement);
  };

  readonly #handlePlacementWorkerError = (): void => {
    if (this.#closed) return;
    this.#placementWorkerFailed = true;
    this.#placementWorker?.terminate();
    this.#placementWorker = undefined;
    const requestId = this.#placementRequestId;
    this.#buildPlacementFallback({
      image: this.#placementImage(),
      mask: this.#mask!,
      maskProvider: this.#maskProvider,
      prompts: structuredClone(this.#effectivePrompts()),
      requestId,
      revision: this.#maskRevision,
      segmentation: this.#segmentationDiagnostics,
      settings: this.#placementSettings(),
      type: "build-placement",
    });
  };

  #buildPlacementFallback(request: PlacementWorkerRequest): void {
    const run = (): void => {
      if (this.#closed || request.requestId !== this.#placementRequestId)
        return;
      this.#setStatus("placing-stars", "仮想星を配置中…");
      const placement = createGuidedImagePlacement(
        request.image,
        request.mask,
        request.prompts,
        request.settings,
        request.maskProvider,
        request.revision,
        request.segmentation,
      );
      if (request.requestId === this.#placementRequestId) {
        this.#acceptPlacement(placement);
      }
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
    else setTimeout(run, 0);
  }

  #acceptPlacement(placement: GuidedImagePlacementResult): void {
    this.#placement = placement;
    if (this.#segmentationPending) {
      this.#setStatus("segmenting", "被写体マスクを更新中…");
    } else if (!this.#constraintsSatisfied) {
      this.#setStatus(
        "awaiting-subject",
        "指定が競合しています。点または範囲を修正してください",
      );
    } else {
      this.#setStatus("ready", `${placement.points.length}点を生成しました`);
    }
    this.#renderState();
  }

  #renderState(): void {
    if (this.#closed) return;
    this.#renderOutlineStarState();
    this.#renderTargetCountInputs();
    const runtime = this.#query<HTMLElement>("[data-guided-runtime]");
    runtime.textContent = this.#runtimeProvider
      ? imageSegmentationRuntimeLabel(
          this.#runtimeProvider,
          this.#runtimeBackend,
        )
      : "画像解析: 準備中";
    runtime.dataset.backend = this.#runtimeBackend ?? "none";
    this.#backdrop.setAttribute(
      "aria-busy",
      String(
        this.#status === "decoding" ||
          this.#status === "loading-model" ||
          this.#status === "encoding" ||
          this.#status === "segmenting" ||
          this.#status === "quantizing-colors" ||
          this.#status === "tracing-boundaries" ||
          this.#status === "placing-stars",
      ),
    );
    this.#backdrop
      .querySelectorAll<HTMLElement>("[data-input-mode]")
      .forEach((button) => {
        const mode = button.dataset.inputMode as ImageInputMode;
        const hidden =
          this.#interactionProfile === "model" &&
          (mode === "feature" || mode === "background");
        button.hidden = hidden;
        const active = button.dataset.inputMode === this.#activeMode;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    this.#query<HTMLElement>("[data-guided-help]").textContent =
      this.#interactionProfile === "model"
        ? "最初に被写体をドラッグで囲むか、残したい部分へ＋点を置いてください。内部の主要な色境界は自動で検出します。"
        : "被写体を囲むか＋点を置き、必要なら特徴点と背景除外点を追加してください。特徴点は指定位置へ仮想星1点を残します。";
    this.#backdrop
      .querySelectorAll<HTMLElement>(
        "[data-guided-point-legend] [data-point-kind]",
      )
      .forEach((item) => {
        const kind = item.dataset.pointKind;
        item.hidden =
          (kind === "internal-boundary" && this.#placementMode === "outline") ||
          (kind === "interior" &&
            this.#placementMode !== "outline-internal-boundary-filled") ||
          (kind === "feature" && this.#interactionProfile === "model");
      });
    const markers = this.#query<HTMLElement>("[data-guided-prompts]");
    const subjectBox = this.#draftBox ?? this.#session.subjectBox;
    const boxMarkup = subjectBox
      ? `<div class="guided-image-subject-box${this.#draftBox ? " is-editing" : ""}" style="left:${(subjectBox.left * 100).toFixed(3)}%;top:${(subjectBox.top * 100).toFixed(3)}%;width:${((subjectBox.right - subjectBox.left) * 100).toFixed(3)}%;height:${((subjectBox.bottom - subjectBox.top) * 100).toFixed(3)}%" aria-hidden="true">
          <span class="guided-image-box-label" data-box-handle="move">被写体</span>
          ${["north-west", "north", "north-east", "east", "south-east", "south", "south-west", "west"].map((handle) => `<span class="guided-image-box-handle is-${handle}" data-box-handle="${handle}"></span>`).join("")}
        </div>`
      : "";
    const kindCounts: Record<ImagePromptKind, number> = {
      background: 0,
      feature: 0,
      subject: 0,
    };
    markers.innerHTML =
      boxMarkup +
      this.#visiblePrompts()
        .map((prompt) => {
          kindCounts[prompt.kind] += 1;
          const number = kindCounts[prompt.kind];
          const point =
            this.#promptDrag?.id === prompt.id && this.#draftPromptPoint
              ? this.#draftPromptPoint
              : prompt.point;
          return `<button type="button" class="guided-image-prompt is-${prompt.kind}${prompt.id === this.#selectedPromptId ? " is-selected" : ""}" style="left:${(point.x * 100).toFixed(3)}%;top:${(point.y * 100).toFixed(3)}%" data-prompt-id="${prompt.id}" aria-label="${PROMPT_LABELS[prompt.kind]}点 ${number}"><b>${PROMPT_SYMBOLS[prompt.kind]}</b><span>${number}</span></button>`;
        })
        .join("");
    const listCounts: Record<ImagePromptKind, number> = {
      background: 0,
      feature: 0,
      subject: 0,
    };
    const visiblePrompts = this.#visiblePrompts();
    const pointList = visiblePrompts
      .map((prompt) => {
        listCounts[prompt.kind] += 1;
        const number = listCounts[prompt.kind];
        return `<li class="${prompt.id === this.#selectedPromptId ? "is-selected" : ""}" data-prompt-id="${prompt.id}"><button type="button" data-prompt-id="${prompt.id}"><b>${PROMPT_SYMBOLS[prompt.kind]}</b> ${PROMPT_LABELS[prompt.kind]} ${number}</button><span>${Math.round(prompt.point.x * 100)}%, ${Math.round(prompt.point.y * 100)}%</span><button type="button" data-guided-action="remove-prompt" data-prompt-id="${prompt.id}" aria-label="${PROMPT_LABELS[prompt.kind]}点 ${number}を削除">削除</button></li>`;
      })
      .join("");
    const boxList = this.#session.subjectBox
      ? `<li><b>□ 被写体の範囲</b><span>${Math.round((this.#session.subjectBox.right - this.#session.subjectBox.left) * 100)}% × ${Math.round((this.#session.subjectBox.bottom - this.#session.subjectBox.top) * 100)}%</span><button type="button" data-guided-action="remove-box" aria-label="被写体の範囲を削除">削除</button></li>`
      : "";
    this.#query<HTMLOListElement>("[data-guided-prompt-list]").innerHTML =
      boxList || pointList
        ? boxList + pointList
        : '<li class="is-empty">被写体を囲むか、画像上へ点を追加します。</li>';
    this.#query<HTMLElement>("[data-guided-point-summary]").textContent =
      `${this.#session.subjectBox ? "範囲 + " : ""}${visiblePrompts.length}点`;
    this.#query<HTMLButtonElement>("[data-guided-action='undo']").disabled =
      this.#session.history.length === 0;
    this.#query<HTMLButtonElement>("[data-guided-action='clear']").disabled =
      visiblePrompts.length === 0 && !this.#session.subjectBox;
    this.#query<HTMLButtonElement>(
      "[data-guided-action='delete-selected']",
    ).disabled = !this.#selectedPromptId;
    const canApply =
      this.#status === "ready" &&
      this.#constraintsSatisfied &&
      (Boolean(this.#session.subjectBox) ||
        this.#session.prompts.some((prompt) => prompt.kind === "subject")) &&
      (this.#placement?.points.length ?? 0) >= 8;
    this.#query<HTMLButtonElement>("[data-guided-action='apply']").disabled =
      !canApply;
    const diagnostics = this.#query<HTMLElement>("[data-guided-diagnostics]");
    if (this.#placement) {
      const featureCount = Object.values(
        this.#placement.diagnostics.featurePointCounts,
      ).reduce((sum, count) => sum + count, 0);
      diagnostics.textContent = `外形 ${this.#placement.diagnostics.outlinePointCount}点 / 内部境界 ${this.#placement.diagnostics.internalBoundaryPointCount}点（${this.#placement.diagnostics.internalBoundaryCount}本） / 内部 ${this.#placement.diagnostics.interiorPointCount}点 / 特徴 ${featureCount}点 / 代表色 ${this.#placement.diagnostics.paletteColorCount}色`;
      diagnostics.classList.toggle(
        "has-warning",
        this.#placement.warnings.length > 0 || !this.#constraintsSatisfied,
      );
      if (this.#placement.warnings.length > 0) {
        diagnostics.textContent += ` — ${this.#placement.warnings.join(" ")}`;
      }
      if (!this.#constraintsSatisfied) {
        diagnostics.textContent += " — 正点と負点の指定を同時に満たせません。";
      }
    } else {
      diagnostics.textContent =
        this.#status === "error"
          ? "画像を解析できません。取消して別の画像を選んでください。"
          : "被写体の範囲または正点を待っています。";
    }
    this.#drawOverlay();
    this.#renderCrosshair();
  }

  #renderOutlineStarState(): void {
    const enhance = this.#query<HTMLInputElement>(
      "[name='guided-enhance-dark-colors']",
    );
    enhance.checked = this.#enhanceDarkColors;
    this.#query<HTMLSelectElement>("[name='guided-image-star-kind']").value =
      this.#imageStarKind;
    this.#query<HTMLSelectElement>("[name='guided-outline-star']").value =
      this.#outlineStarId;
    const star = this.#outlineStars.find(
      (candidate) => candidate.id === this.#outlineStarId,
    );
    this.#query<HTMLElement>(
      "[data-guided-outline-star-swatch]",
    ).style.setProperty(
      "--star",
      colorToCSS(star ? virtualStarRepresentativeColor(star) : 0xffffff),
    );
  }

  #renderTargetCountInputs(): void {
    this.#renderTargetCountRange();
    this.#query<HTMLInputElement>("[name='guided-target-count']").value =
      String(this.#targetCount);
  }

  #renderTargetCountRange(): void {
    const range = this.#query<HTMLInputElement>(
      "[name='guided-target-count-range']",
    );
    range.value = String(this.#targetCount);
    range.setAttribute("aria-valuetext", `${this.#targetCount}点`);
    this.#query<HTMLOutputElement>("[data-guided-target-output]").value =
      `${this.#targetCount}点`;
  }

  #selectedOutlineStar(): GuidedOutlineStar | undefined {
    const star = this.#outlineStars.find(
      (candidate) => candidate.id === this.#outlineStarId,
    );
    return star
      ? { color: virtualStarRepresentativeColor(star), starId: star.id }
      : undefined;
  }

  #drawOverlay(): void {
    const canvas = this.#query<HTMLCanvasElement>("[data-guided-overlay]");
    const mask = this.#placement?.mask ?? this.#mask;
    if (!mask || mask.width <= 0 || mask.height <= 0) return;
    canvas.width = mask.width;
    canvas.height = mask.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, mask.width, mask.height);
    const overlay = context.createImageData(mask.width, mask.height);
    mask.data.forEach((value, index) => {
      const offset = index * 4;
      const probability = this.#probabilityMask?.data[index];
      if (
        probability !== undefined &&
        probability >= 0.4 &&
        probability <= 0.6
      ) {
        const x = index % mask.width;
        const y = Math.floor(index / mask.width);
        overlay.data[offset] = 235;
        overlay.data[offset + 1] = 174;
        overlay.data[offset + 2] = 82;
        overlay.data[offset + 3] = (x + y) % 4 < 2 ? 72 : 24;
        return;
      }
      if (!value) return;
      overlay.data[offset] = 70;
      overlay.data[offset + 1] = 205;
      overlay.data[offset + 2] = 198;
      overlay.data[offset + 3] = 52;
    });
    context.putImageData(overlay, 0, 0);
    if (!this.#placement) return;
    const bounds = this.#maskBounds(mask);
    if (!bounds) return;
    const centerX = (bounds.minimumX + bounds.maximumX) / 2;
    const centerY = (bounds.minimumY + bounds.maximumY) / 2;
    const maximumRadius = Math.max(
      Math.hypot(bounds.minimumX - centerX, bounds.minimumY - centerY),
      Math.hypot(bounds.maximumX - centerX, bounds.minimumY - centerY),
      Math.hypot(bounds.minimumX - centerX, bounds.maximumY - centerY),
      Math.hypot(bounds.maximumX - centerX, bounds.maximumY - centerY),
      1,
    );
    const scale = 0.94 / maximumRadius;
    const previewColors: Record<string, string> = {
      feature: "#8CFF72",
      interior: "#FFD84D",
      "internal-boundary": "#FF5CC8",
      outline: "#57D9FF",
    };
    const radius = clampDialogValue(mask.width / 300, 1.5, 4);
    this.#placement.points.forEach((point, index) => {
      const x = centerX + point.x / scale;
      const y = centerY - point.y / scale;
      context.shadowBlur = radius * 2.8;
      context.shadowColor = previewColors[this.#placement!.pointKinds[index]];
      context.fillStyle = previewColors[this.#placement!.pointKinds[index]];
      context.strokeStyle = "rgba(4, 9, 13, 0.88)";
      context.lineWidth = 1;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.stroke();
    });
  }

  #maskBounds(mask: SubjectMask):
    | {
        maximumX: number;
        maximumY: number;
        minimumX: number;
        minimumY: number;
      }
    | undefined {
    let maximumX = -1;
    let maximumY = -1;
    let minimumX = mask.width;
    let minimumY = mask.height;
    mask.data.forEach((value, index) => {
      if (!value) return;
      const x = index % mask.width;
      const y = Math.floor(index / mask.width);
      minimumX = Math.min(minimumX, x);
      maximumX = Math.max(maximumX, x + 1);
      minimumY = Math.min(minimumY, y);
      maximumY = Math.max(maximumY, y + 1);
    });
    return maximumX < minimumX
      ? undefined
      : { maximumX, maximumY, minimumX, minimumY };
  }

  #renderCrosshair(): void {
    const crosshair = this.#query<HTMLElement>("[data-guided-crosshair]");
    crosshair.style.left = `${this.#crosshair.x * 100}%`;
    crosshair.style.top = `${this.#crosshair.y * 100}%`;
  }

  #applyTransform(): void {
    const stage = this.#query<HTMLElement>("[data-guided-stage]");
    stage.style.transform = `translate(${this.#pan.x}px, ${this.#pan.y}px) scale(${this.#zoom})`;
    stage.classList.toggle("is-zoomed", this.#zoom > 1);
  }

  #setStatus(status: DialogStatus, message: string, progress?: number): void {
    this.#status = status;
    const statusElement = this.#query<HTMLElement>("[data-guided-status]");
    if (statusElement.textContent !== message)
      statusElement.textContent = message;
    const progressElement = this.#query<HTMLProgressElement>(
      "[data-guided-progress]",
    );
    const processing =
      status === "decoding" ||
      status === "loading-model" ||
      status === "encoding" ||
      status === "segmenting" ||
      status === "quantizing-colors" ||
      status === "tracing-boundaries" ||
      status === "placing-stars";
    progressElement.hidden = !processing;
    if (progress === undefined) progressElement.removeAttribute("value");
    else progressElement.value = clampDialogValue(progress, 0, 1);
    this.#backdrop.dataset.status = status;
    this.#backdrop.setAttribute("aria-busy", String(processing));
  }

  #announce(message: string): void {
    this.#query<HTMLElement>("[data-guided-live]").textContent = message;
  }

  #maskPromptSignature(
    state: Pick<ImagePromptSessionState, "prompts" | "subjectBox">,
  ): string {
    const prompts = state.prompts
      .filter(
        (prompt) =>
          prompt.kind !== "feature" &&
          (this.#interactionProfile === "classic" ||
            prompt.kind !== "background"),
      )
      .map(
        (prompt) =>
          `${prompt.id}:${prompt.kind}:${prompt.point.x}:${prompt.point.y}`,
      )
      .join("|");
    const box = state.subjectBox;
    return box
      ? `${prompts}#box:${box.left}:${box.top}:${box.right}:${box.bottom}`
      : prompts;
  }

  #effectivePrompts(): ImagePromptSessionState["prompts"] {
    return this.#interactionProfile === "model"
      ? this.#session.prompts.filter((prompt) => prompt.kind === "subject")
      : this.#session.prompts;
  }

  #visiblePrompts(): ImagePromptSessionState["prompts"] {
    return this.#interactionProfile === "model"
      ? this.#session.prompts.filter((prompt) => prompt.kind === "subject")
      : this.#session.prompts;
  }

  #close(result?: GuidedImagePlacementDialogResult): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#generation += 1;
    window.clearTimeout(this.#placementDebounceTimer);
    this.#client?.dispose();
    this.#placementRequestId += 1;
    this.#placementWorker?.terminate();
    this.#placementWorker = undefined;
    if (this.#loaded) URL.revokeObjectURL(this.#loaded.previewUrl);
    this.#backdrop.remove();
    this.#inertSiblings.forEach(({ ariaHidden, element, inert }) => {
      element.inert = inert;
      if (ariaHidden === null) element.removeAttribute("aria-hidden");
      else element.setAttribute("aria-hidden", ariaHidden);
    });
    document.body.classList.remove("has-guided-image-dialog");
    this.#options.restoreFocus?.focus();
    this.#resolve(result);
  }

  #query<T extends Element>(selector: string): T {
    const element = this.#backdrop.querySelector<T>(selector);
    if (!element)
      throw new Error(`Guided image dialog element missing: ${selector}`);
    return element;
  }
}

export function openGuidedImagePlacementDialog(
  file: File,
  options: GuidedImagePlacementDialogOptions,
): Promise<GuidedImagePlacementDialogResult | undefined> {
  return new GuidedImagePlacementDialog(file, options).open();
}
