import {
  createGuidedImagePlacement,
  DEFAULT_GUIDED_IMAGE_PLACEMENT_SETTINGS,
} from "./GuidedImagePlacementRecipe";
import type {
  GuidedImagePlacementResult,
  ImagePrompt,
  ImagePromptKind,
  NormalizedImagePoint,
  SubjectMask,
} from "./GuidedImagePlacementTypes";
import {
  addImagePrompt,
  clearImagePrompts,
  createImagePromptSession,
  IMAGE_PROMPT_LIMITS,
  removeImagePrompt,
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
  "awaiting-subject" | "decoding" | "error" | "ready" | "segmenting";

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
        <div class="guided-image-mode-row" role="group" aria-label="点の種類">
          <button type="button" data-prompt-kind="subject" class="is-active" aria-pressed="true"><b>＋</b> 被写体</button>
          <button type="button" data-prompt-kind="feature" aria-pressed="false"><b>★</b> 特徴</button>
          <button type="button" data-prompt-kind="background" aria-pressed="false"><b>−</b> 背景を除外</button>
        </div>
        <div class="guided-image-viewport" data-guided-viewport>
          <div class="guided-image-stage" data-guided-stage tabindex="0" role="application" aria-label="画像上の点指定。矢印キーで照準を動かし、EnterまたはSpaceで点を追加できます">
            <img alt="${escapeHTML(fileName)}" data-guided-image />
            <canvas data-guided-overlay aria-hidden="true"></canvas>
            <div class="guided-image-prompt-layer" data-guided-prompts></div>
            <span class="guided-image-crosshair" data-guided-crosshair aria-hidden="true"></span>
          </div>
        </div>
        <div class="guided-image-view-actions" aria-label="プレビュー操作">
          <button type="button" data-guided-action="undo" disabled>1つ戻す</button>
          <button type="button" data-guided-action="delete-selected" disabled>選択点を削除</button>
          <button type="button" data-guided-action="clear" disabled>点をすべて消す</button>
          <button type="button" data-guided-action="zoom-out" aria-label="縮小">−</button>
          <button type="button" data-guided-action="zoom-in" aria-label="拡大">＋</button>
          <button type="button" data-guided-action="fit">全体表示</button>
        </div>
      </section>
      <aside class="guided-image-settings">
        <p id="guided-image-dialog-help">残したい被写体の内側を最低1点指定してください。特徴点は輪郭とは別に優先配点されます。</p>
        <p class="guided-image-live" aria-live="polite" data-guided-live></p>
        <div class="guided-image-setting-grid">
          <label><span>目標点数</span><input name="guided-target-count" type="number" min="8" max="240" value="${targetCount}" /></label>
          <label><span>生成方法</span><select name="guided-apply-mode"><option value="replace" ${applyMode === "replace" ? "selected" : ""}>置換</option><option value="append" ${applyMode === "append" ? "selected" : ""}>追加</option></select></label>
        </div>
        <section class="guided-image-prompt-list" aria-labelledby="guided-prompt-list-title">
          <header><h3 id="guided-prompt-list-title">指定した点</h3><span data-guided-point-summary>0点</span></header>
          <ol data-guided-prompt-list><li class="is-empty">画像上を押して点を追加します。</li></ol>
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

class GuidedImagePlacementDialog {
  readonly #backdrop = document.createElement("div");
  readonly #file: File;
  readonly #options: GuidedImagePlacementDialogOptions;
  readonly #result: Promise<GuidedImagePlacementDialogResult | undefined>;
  #activeKind: ImagePromptKind = "subject";
  #applyMode: "append" | "replace";
  #client?: ImageSegmentationClient;
  #closed = false;
  #crosshair: NormalizedImagePoint = { x: 0.5, y: 0.5 };
  #generation = 0;
  #inertSiblings: Array<{
    ariaHidden: string | null;
    element: HTMLElement;
    inert: boolean;
  }> = [];
  #loaded?: GuidedImagePixels;
  #mask?: SubjectMask;
  #maskProvider: "alpha" | "fast" | "fallback" | "slimsam" = "fast";
  #maskRevision = 0;
  #nextPromptId = 1;
  #pan = { x: 0, y: 0 };
  #panGesture?: PanGesture;
  #placement?: GuidedImagePlacementResult;
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
        onProgress: (stage) => {
          if (stage === "segmenting" && !this.#closed) {
            this.#setStatus("segmenting", "被写体マスクを更新中…");
          }
        },
      });
      this.#client.setImage(loaded.bitmap, loaded.pixels);
      const provisional = createFastPromptMask(loaded.pixels, []);
      this.#mask = provisional.mask;
      this.#maskProvider = provisional.provider;
      this.#setStatus("awaiting-subject", "被写体点を指定してください");
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
    const kind = target.closest<HTMLElement>("[data-prompt-kind]")?.dataset
      .promptKind as ImagePromptKind | undefined;
    if (kind) {
      this.#activeKind = kind;
      this.#renderState();
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
      this.#mutatePrompts(clearImagePrompts(this.#session), "点を消しました。");
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
        this.#renderCrosshair();
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.#addPrompt(this.#crosshair);
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
    if (this.#panGesture?.pointerId !== event.pointerId) return;
    this.#suppressStageClick = this.#panGesture.moved;
    this.#panGesture = undefined;
  };

  #addPrompt(point: NormalizedImagePoint): void {
    if (!this.#loaded || this.#status === "error") return;
    const result = addImagePrompt(this.#session, {
      id: `image-prompt-${this.#nextPromptId++}`,
      kind: this.#activeKind,
      point,
    });
    if (!result.changed) {
      this.#announce(
        `${PROMPT_LABELS[this.#activeKind]}点は${IMAGE_PROMPT_LIMITS[this.#activeKind]}点までです。`,
      );
      return;
    }
    this.#session = result.state;
    this.#selectedPromptId = this.#session.prompts.at(-1)?.id;
    if (this.#activeKind === "feature") {
      const featureCount = this.#session.prompts.filter(
        (prompt) => prompt.kind === "feature",
      ).length;
      const minimumTarget = Math.ceil(featureCount / 0.4);
      if (this.#targetCount < minimumTarget) {
        this.#targetCount = minimumTarget;
        this.#query<HTMLInputElement>("[name='guided-target-count']").value =
          String(this.#targetCount);
        this.#announce(
          `すべての特徴を残すため、目標点数を${minimumTarget}へ変更しました。`,
        );
      }
    }
    this.#refreshForPromptChange(this.#activeKind !== "feature");
  }

  #mutatePrompts(next: ImagePromptSessionState, announcement: string): void {
    if (next === this.#session) return;
    const beforeMaskSignature = this.#maskPromptSignature(
      this.#session.prompts,
    );
    this.#session = next;
    if (
      this.#selectedPromptId &&
      !next.prompts.some((prompt) => prompt.id === this.#selectedPromptId)
    ) {
      this.#selectedPromptId = next.prompts.at(-1)?.id;
    }
    this.#announce(announcement);
    this.#refreshForPromptChange(
      beforeMaskSignature !== this.#maskPromptSignature(next.prompts),
    );
  }

  #refreshForPromptChange(maskChanged: boolean): void {
    if (maskChanged) this.#generation += 1;
    const subjectCount = this.#session.prompts.filter(
      (prompt) => prompt.kind === "subject",
    ).length;
    if (subjectCount === 0) {
      this.#generation += 1;
      this.#client?.cancel();
      if (this.#loaded) {
        const provisional = createFastPromptMask(this.#loaded.pixels, []);
        this.#mask = provisional.mask;
        this.#maskProvider = provisional.provider;
      }
      this.#placement = undefined;
      this.#setStatus("awaiting-subject", "被写体点を指定してください");
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
    const maskSignature = this.#maskPromptSignature(prompts);
    const provisional = createFastPromptMask(this.#loaded.pixels, prompts);
    this.#mask = provisional.mask;
    this.#maskProvider = provisional.provider;
    this.#maskRevision = revision;
    this.#rebuildPlacement();
    this.#setStatus("segmenting", "被写体マスクを更新中…");
    this.#renderState();
    try {
      const result = await this.#client.segment(prompts, revision);
      if (
        this.#closed ||
        generation !== this.#generation ||
        maskSignature !== this.#maskPromptSignature(this.#session.prompts)
      ) {
        return;
      }
      this.#mask = result.mask;
      this.#maskProvider = result.provider;
      this.#maskRevision = result.revision;
      this.#rebuildPlacement();
      this.#setStatus(
        "ready",
        `${this.#placement?.points.length ?? 0}点を生成しました`,
      );
      this.#renderState();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (this.#closed || generation !== this.#generation) return;
      this.#maskProvider = "fallback";
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
    const hasSubject = this.#session.prompts.some(
      (prompt) => prompt.kind === "subject",
    );
    this.#placement = hasSubject
      ? createGuidedImagePlacement(
          this.#loaded.pixels,
          this.#mask,
          this.#session.prompts,
          {
            ...DEFAULT_GUIDED_IMAGE_PLACEMENT_SETTINGS,
            targetCount: this.#targetCount,
          },
          this.#maskProvider,
          this.#maskRevision,
        )
      : undefined;
    this.#renderState();
  }

  #renderState(): void {
    if (this.#closed) return;
    this.#backdrop
      .querySelectorAll<HTMLElement>("[data-prompt-kind]")
      .forEach((button) => {
        const active = button.dataset.promptKind === this.#activeKind;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    const markers = this.#query<HTMLElement>("[data-guided-prompts]");
    const kindCounts: Record<ImagePromptKind, number> = {
      background: 0,
      feature: 0,
      subject: 0,
    };
    markers.innerHTML = this.#session.prompts
      .map((prompt) => {
        kindCounts[prompt.kind] += 1;
        const number = kindCounts[prompt.kind];
        return `<button type="button" class="guided-image-prompt is-${prompt.kind}${prompt.id === this.#selectedPromptId ? " is-selected" : ""}" style="left:${(prompt.point.x * 100).toFixed(3)}%;top:${(prompt.point.y * 100).toFixed(3)}%" data-prompt-id="${prompt.id}" aria-label="${PROMPT_LABELS[prompt.kind]}点 ${number}"><b>${PROMPT_SYMBOLS[prompt.kind]}</b><span>${number}</span></button>`;
      })
      .join("");
    const listCounts: Record<ImagePromptKind, number> = {
      background: 0,
      feature: 0,
      subject: 0,
    };
    this.#query<HTMLOListElement>("[data-guided-prompt-list]").innerHTML =
      this.#session.prompts.length === 0
        ? '<li class="is-empty">画像上を押して点を追加します。</li>'
        : this.#session.prompts
            .map((prompt) => {
              listCounts[prompt.kind] += 1;
              const number = listCounts[prompt.kind];
              return `<li class="${prompt.id === this.#selectedPromptId ? "is-selected" : ""}" data-prompt-id="${prompt.id}"><button type="button" data-prompt-id="${prompt.id}"><b>${PROMPT_SYMBOLS[prompt.kind]}</b> ${PROMPT_LABELS[prompt.kind]} ${number}</button><span>${Math.round(prompt.point.x * 100)}%, ${Math.round(prompt.point.y * 100)}%</span><button type="button" data-guided-action="remove-prompt" data-prompt-id="${prompt.id}" aria-label="${PROMPT_LABELS[prompt.kind]}点 ${number}を削除">削除</button></li>`;
            })
            .join("");
    this.#query<HTMLElement>("[data-guided-point-summary]").textContent =
      `${this.#session.prompts.length}点`;
    this.#query<HTMLButtonElement>("[data-guided-action='undo']").disabled =
      this.#session.history.length === 0;
    this.#query<HTMLButtonElement>("[data-guided-action='clear']").disabled =
      this.#session.prompts.length === 0;
    this.#query<HTMLButtonElement>(
      "[data-guided-action='delete-selected']",
    ).disabled = !this.#selectedPromptId;
    const canApply =
      this.#status === "ready" &&
      this.#session.prompts.some((prompt) => prompt.kind === "subject") &&
      (this.#placement?.points.length ?? 0) >= 8;
    this.#query<HTMLButtonElement>("[data-guided-action='apply']").disabled =
      !canApply;
    const diagnostics = this.#query<HTMLElement>("[data-guided-diagnostics]");
    if (this.#placement) {
      const featureCount = Object.values(
        this.#placement.diagnostics.featurePointCounts,
      ).reduce((sum, count) => sum + count, 0);
      diagnostics.textContent = `外形 ${this.#placement.diagnostics.outlinePointCount}点 / 特徴 ${featureCount}点 / ${this.#maskProvider === "alpha" ? "アルファ" : "軽量"}マスク`;
      diagnostics.classList.toggle(
        "has-warning",
        this.#placement.warnings.length > 0,
      );
      if (this.#placement.warnings.length > 0) {
        diagnostics.textContent += ` — ${this.#placement.warnings.join(" ")}`;
      }
    } else {
      diagnostics.textContent =
        this.#status === "error"
          ? "画像を解析できません。取消して別の画像を選んでください。"
          : "被写体点を待っています。";
    }
    this.#drawOverlay();
    this.#renderCrosshair();
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
      if (!value) return;
      const offset = index * 4;
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

  #maskPromptSignature(prompts: ImagePrompt[]): string {
    return prompts
      .filter((prompt) => prompt.kind !== "feature")
      .map(
        (prompt) =>
          `${prompt.id}:${prompt.kind}:${prompt.point.x}:${prompt.point.y}`,
      )
      .join("|");
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
