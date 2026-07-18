import {
  createGuidedImagePlacement,
  DEFAULT_GUIDED_IMAGE_PLACEMENT_SETTINGS,
} from "./GuidedImagePlacementRecipe";
import type {
  GuidedImagePlacementResult,
  ImageInputMode,
  ImagePromptKind,
  NormalizedImagePoint,
  NormalizedImageRect,
  ProbabilityMask,
  SegmentationDiagnostics,
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
import type { ImagePlacementResult } from "./ImagePlacementRecipe";
import {
  ImagePixelLoadError,
  loadGuidedImagePixels,
  type GuidedImagePixels,
} from "./imagePixelLoader";
import { createFastPromptMask } from "./PromptMaskProvider";
import { escapeHTML } from "./viewUtils";

export interface GuidedImagePlacementDialogResult {
  placement: ImagePlacementResult;
  settings: {
    applyMode: "append" | "replace";
    targetCount: number;
  };
}

export interface GuidedImagePlacementDialogOptions {
  applyMode: "append" | "replace";
  createSegmentationClient?: (
    options: ImageSegmentationClientOptions,
  ) => ImageSegmentationClient;
  loadImage?: typeof loadGuidedImagePixels;
  restoreFocus?: HTMLElement;
  targetCount: number;
}

type DialogStatus =
  | "awaiting-subject"
  | "decoding"
  | "encoding"
  | "error"
  | "loading-model"
  | "ready"
  | "segmenting";

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

export function renderGuidedImagePlacementDialogShell(
  fileName: string,
  targetCount: number,
  applyMode: "append" | "replace",
): string {
  return `<section class="guided-image-dialog" role="dialog" aria-modal="true" aria-labelledby="guided-image-dialog-title" aria-describedby="guided-image-dialog-help">
    <header class="guided-image-dialog-header">
      <div><p>POINT-GUIDED IMAGE</p><h2 id="guided-image-dialog-title">画像から仮想星を作る</h2></div>
      <span class="guided-image-status" role="status" aria-live="polite" data-guided-status>画像を読み込み中…</span>
      <button type="button" data-guided-action="close" aria-label="画像から仮想星を作る画面を閉じる">×</button>
    </header>
    <div class="guided-image-dialog-body">
      <section class="guided-image-preview-panel" aria-label="画像と生成プレビュー">
        <div class="guided-image-mode-row" role="group" aria-label="入力方法">
          <button type="button" data-input-mode="box" class="is-active" aria-pressed="true"><b>□</b> 被写体を囲む</button>
          <button type="button" data-input-mode="subject" data-prompt-kind="subject" aria-pressed="false"><b>＋</b> 被写体</button>
          <button type="button" data-input-mode="feature" data-prompt-kind="feature" aria-pressed="false"><b>★</b> 特徴</button>
          <button type="button" data-input-mode="background" data-prompt-kind="background" aria-pressed="false"><b>−</b> 背景を除外</button>
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
        <p id="guided-image-dialog-help">最初に被写体をドラッグで囲むか、残したい部分へ＋点を置いてください。特徴点は指定した位置へそのまま仮想星1点になります。</p>
        <p class="guided-image-live" aria-live="polite" data-guided-live></p>
        <div class="guided-image-setting-grid">
          <label><span>目標点数</span><input name="guided-target-count" type="number" min="8" max="240" value="${targetCount}" /></label>
          <label><span>生成方法</span><select name="guided-apply-mode"><option value="replace" ${applyMode === "replace" ? "selected" : ""}>置換</option><option value="append" ${applyMode === "append" ? "selected" : ""}>追加</option></select></label>
        </div>
        <section class="guided-image-prompt-list" aria-labelledby="guided-prompt-list-title">
          <header><h3 id="guided-prompt-list-title">指定内容</h3><span data-guided-point-summary>指定なし</span></header>
          <ol data-guided-prompt-list><li class="is-empty">被写体を囲むか、画像上へ点を追加します。</li></ol>
        </section>
        <div class="guided-image-diagnostics" data-guided-diagnostics>被写体点を待っています。</div>
      </aside>
    </div>
    <footer class="guided-image-dialog-footer">
      <button type="button" data-guided-action="cancel">取消</button>
      <button type="button" class="guided-image-apply" data-guided-action="apply" disabled>配置</button>
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
  #segmentationDiagnostics?: SegmentationDiagnostics;
  #constraintsSatisfied = false;
  #keyboardBoxStart?: NormalizedImagePoint;
  #nextPromptId = 1;
  #pan = { x: 0, y: 0 };
  #panGesture?: PanGesture;
  #placement?: GuidedImagePlacementResult;
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
    this.#targetCount = Math.round(
      Math.min(Math.max(options.targetCount, 8), 240),
    );
    this.#result = new Promise((resolve) => (this.#resolve = resolve));
    this.#backdrop.className = "guided-image-dialog-backdrop";
    this.#backdrop.innerHTML = renderGuidedImagePlacementDialogShell(
      file.name,
      this.#targetCount,
      this.#applyMode,
    );
    this.#backdrop.addEventListener("click", this.#handleClick);
    this.#backdrop.addEventListener("change", this.#handleChange);
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
        loaded.bitmap?.close();
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
        onProgress: (stage, progress) => {
          if (this.#closed) return;
          if (stage === "loading-model") {
            const percent =
              progress === undefined ? "" : ` ${Math.round(progress * 100)}%`;
            this.#setStatus("loading-model", `高精度モデルを準備中…${percent}`);
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
      this.#client.setImage(loaded.bitmap, loaded.analysisPixels);
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
          points: this.#placement.points.map((point) => ({ ...point })),
        },
        settings: {
          applyMode: this.#applyMode,
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
        this.#targetCount = Math.round(Math.min(Math.max(value, 8), 240));
      }
      input.value = String(this.#targetCount);
      this.#rebuildPlacement();
    } else if (input.name === "guided-apply-mode") {
      this.#applyMode = input.value === "append" ? "append" : "replace";
    }
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
    const revision = this.#session.revision;
    const prompts = structuredClone(this.#session.prompts);
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
      this.#rebuildPlacement();
      this.#setStatus(
        result.constraintsSatisfied ? "ready" : "awaiting-subject",
        result.constraintsSatisfied
          ? `${this.#placement?.points.length ?? 0}点を生成しました`
          : "指定が競合しています。点または範囲を修正してください",
      );
      this.#renderState();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (this.#closed || generation !== this.#generation) return;
      this.#maskProvider = "fast";
      this.#constraintsSatisfied = provisional.constraintsSatisfied;
      this.#segmentationDiagnostics = {
        ...provisional.diagnostics,
        fallbackReason: "segmentation-client-failed",
      };
      this.#rebuildPlacement();
      this.#setStatus("ready", "軽量方式でプレビューしています");
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
    this.#placement = hasSubjectInput
      ? createGuidedImagePlacement(
          this.#mask.width === this.#loaded.analysisPixels.width &&
            this.#mask.height === this.#loaded.analysisPixels.height
            ? this.#loaded.analysisPixels
            : this.#loaded.pixels,
          this.#mask,
          this.#session.prompts,
          {
            ...DEFAULT_GUIDED_IMAGE_PLACEMENT_SETTINGS,
            targetCount: this.#targetCount,
          },
          this.#maskProvider,
          this.#maskRevision,
          this.#segmentationDiagnostics,
        )
      : undefined;
    this.#renderState();
  }

  #renderState(): void {
    if (this.#closed) return;
    this.#backdrop
      .querySelectorAll<HTMLElement>("[data-input-mode]")
      .forEach((button) => {
        const active = button.dataset.inputMode === this.#activeMode;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
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
      this.#session.prompts
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
    const pointList = this.#session.prompts
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
      `${this.#session.subjectBox ? "範囲 + " : ""}${this.#session.prompts.length}点`;
    this.#query<HTMLButtonElement>("[data-guided-action='undo']").disabled =
      this.#session.history.length === 0;
    this.#query<HTMLButtonElement>("[data-guided-action='clear']").disabled =
      this.#session.prompts.length === 0 && !this.#session.subjectBox;
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
      const backend = this.#segmentationDiagnostics?.backend;
      diagnostics.textContent = `外形 ${this.#placement.diagnostics.outlinePointCount}点 / 特徴 ${featureCount}点 / ${this.#providerLabel(this.#maskProvider, backend)}`;
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

  #providerLabel(
    provider: SegmentationProvider,
    backend: SegmentationDiagnostics["backend"] | undefined,
  ): string {
    if (provider === "alpha") return "アルファマスク";
    if (provider === "slimsam" && backend === "webgpu") return "高精度・GPU";
    if (provider === "slimsam") return "高精度・互換";
    if (provider === "grabcut") return "軽量補正";
    return "高速プレビュー";
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
    context.fillStyle = "rgba(255, 224, 150, 0.95)";
    this.#placement.points.forEach((point) => {
      const x = centerX + point.x / scale;
      const y = centerY - point.y / scale;
      context.beginPath();
      context.arc(x, y, Math.max(1.1, mask.width / 300), 0, Math.PI * 2);
      context.fill();
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

  #setStatus(status: DialogStatus, message: string): void {
    this.#status = status;
    this.#query<HTMLElement>("[data-guided-status]").textContent = message;
    this.#backdrop.dataset.status = status;
  }

  #announce(message: string): void {
    this.#query<HTMLElement>("[data-guided-live]").textContent = message;
  }

  #maskPromptSignature(
    state: Pick<ImagePromptSessionState, "prompts" | "subjectBox">,
  ): string {
    const prompts = state.prompts
      .filter((prompt) => prompt.kind !== "feature")
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

  #close(result?: GuidedImagePlacementDialogResult): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#generation += 1;
    this.#client?.dispose();
    this.#loaded?.bitmap?.close();
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
