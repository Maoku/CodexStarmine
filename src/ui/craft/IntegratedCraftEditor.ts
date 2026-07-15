import {
  type FireworkDesign,
  type FireworkDesignV4,
  type LayerIntentV4,
  type PresetLayerIntent,
  type PresetLayerParameters,
  type SectionPlane,
  type SectionRatio,
  type SectionRef,
} from "../../data";
import type { CraftController, CraftDocumentSnapshot } from "../../modes/craft";
import {
  buildApproximateSpreadModel,
  type ApproximateSpreadModel,
} from "../../render/preview/ApproximateSpreadRenderer";
import { renderInlineDiagnosticPreview } from "./InlineDiagnosticPreview";
import {
  canvasPointOnSection,
  createPlacementTemplatePoints,
  projectSectionPoint,
  renderIntegratedPlacementWorkbench,
  type PlacementTemplate,
} from "./IntegratedPlacementWorkbench";
import { renderLayerPanel } from "./LayerPanel";
import { renderStarLibraryPanel } from "./StarLibraryPanel";
import {
  STAR_LONG_PRESS_DELAY_MS,
  StarLongPressGesture,
} from "./StarLongPressGesture";
import { pointFromSection, type Point3D } from "./SectionGeometry";
import { escapeHTML, layerAuthoringLabel } from "./viewUtils";

export interface IntegratedCraftEditorCallbacks {
  onCheck: (design: FireworkDesign) => void;
  onDesignLibraryChange: (designs: FireworkDesign[]) => void;
  onSaveToLibrary: (design: FireworkDesign) => void;
  onToast: (message: string) => void;
}

interface PointDrag {
  index: number;
  layerId: string;
  moved: boolean;
  position: Point3D;
  pointerId: number;
  startX: number;
  startY: number;
  target: SVGCircleElement;
}

type MobileDrawer = "layers" | "inspector";

export class IntegratedCraftEditor {
  readonly element = document.createElement("section");
  readonly #callbacks: IntegratedCraftEditorCallbacks;
  readonly #controller: CraftController;
  readonly #mobileQuery: MediaQueryList;
  readonly #starLongPress = new StarLongPressGesture();
  #drawer?: MobileDrawer;
  #section: SectionRef = { plane: "xy", ratio: 0.5 };
  #placementTemplate: PlacementTemplate = "manual";
  #pointDrag?: PointDrag;
  #previewModel?: ApproximateSpreadModel;
  #previewRevision = 0;
  #previewRunning = true;
  #previewSignature = "";
  #previewTimer = 0;
  #selectedPointIndex?: number;
  #snapshot?: CraftDocumentSnapshot;
  #starPressTimer = 0;
  #starPreviewId?: string;
  #suppressStarClickId?: string;
  #unsubscribe: () => void;

  constructor(
    controller: CraftController,
    callbacks: IntegratedCraftEditorCallbacks,
  ) {
    this.#controller = controller;
    this.#callbacks = callbacks;
    this.#mobileQuery = window.matchMedia("(max-width: 900px)");
    this.element.className = "craft-workspace integrated-craft-editor";
    this.element.addEventListener("click", this.#handleClick);
    this.element.addEventListener("change", this.#handleChange);
    this.element.addEventListener("dragstart", this.#handleDragStart);
    this.element.addEventListener("dragover", this.#handleDragOver);
    this.element.addEventListener("drop", this.#handleDrop);
    this.element.addEventListener("pointerdown", this.#handlePointerDown);
    window.addEventListener("pointermove", this.#handlePointerMove);
    window.addEventListener("pointerup", this.#handlePointerEnd);
    window.addEventListener("pointercancel", this.#handlePointerEnd);
    window.addEventListener("keydown", this.#handleKeyDown);
    this.#mobileQuery.addEventListener("change", this.#handleMobileQueryChange);
    this.#unsubscribe = this.#controller.document.subscribe((snapshot) => {
      this.#snapshot = snapshot;
      this.#schedulePreview(snapshot.draft);
      this.#render();
    });
  }

  destroy(): void {
    window.clearTimeout(this.#previewTimer);
    this.#cancelStarPress();
    this.#unsubscribe();
    this.element.removeEventListener("click", this.#handleClick);
    this.element.removeEventListener("change", this.#handleChange);
    this.element.removeEventListener("dragstart", this.#handleDragStart);
    this.element.removeEventListener("dragover", this.#handleDragOver);
    this.element.removeEventListener("drop", this.#handleDrop);
    this.element.removeEventListener("pointerdown", this.#handlePointerDown);
    window.removeEventListener("pointermove", this.#handlePointerMove);
    window.removeEventListener("pointerup", this.#handlePointerEnd);
    window.removeEventListener("pointercancel", this.#handlePointerEnd);
    window.removeEventListener("keydown", this.#handleKeyDown);
    this.#mobileQuery.removeEventListener(
      "change",
      this.#handleMobileQueryChange,
    );
    this.element.remove();
  }

  #render(): void {
    const snapshot = this.#snapshot;
    if (!snapshot) return;
    const design = snapshot.draft;
    const intentDesign = snapshot.intentDraft;
    const selectedLayer = design.layers.find(
      (layer) => layer.id === snapshot.selection.layerId,
    );
    const selectedIntent = intentDesign.layers.find(
      (layer) => layer.id === snapshot.selection.layerId,
    );
    const pointEditingAllowed = selectedIntent?.authoringMode === "manual";
    const selectedStarId =
      snapshot.selection.starDefinitionId ?? selectedLayer?.defaultStarId;
    const diagnostic = snapshot.diagnostic;
    const warningClass =
      diagnostic.estimatedCost.maximumParticles > 6_000
        ? "is-overload"
        : diagnostic.estimatedCost.maximumParticles > 2_000
          ? "is-warning"
          : "is-good";
    const preview =
      this.#previewModel ?? buildApproximateSpreadModel(snapshot.draft);
    this.element.dataset.mobileDrawer = this.#drawer ?? "closed";
    this.element.innerHTML = `
      <nav class="editor-mobile-toolbar" aria-label="編集パネル">
        <button type="button" data-action="toggle-drawer" data-drawer="layers" aria-expanded="${this.#drawer === "layers"}">レイヤーと星</button>
        <strong>${escapeHTML(selectedLayer?.name ?? "未選択")}</strong>
        <button type="button" data-action="toggle-drawer" data-drawer="inspector" aria-expanded="${this.#drawer === "inspector"}">設定と確認</button>
      </nav>
      <button class="editor-drawer-backdrop" type="button" data-action="close-drawer" aria-label="パネルを閉じる"></button>

      <aside class="craft-rail craft-rail--left" aria-label="レイヤーと仮想星">
        <button class="drawer-close" type="button" data-action="close-drawer">閉じる</button>
        ${renderLayerPanel(intentDesign, snapshot.selection.layerId)}
        ${renderStarLibraryPanel(design, selectedStarId, this.#starPreviewId)}
      </aside>

      <main class="craft-bench integrated-craft-bench">
        ${renderIntegratedPlacementWorkbench(
          design,
          intentDesign,
          selectedLayer,
          selectedIntent,
          this.#section,
          this.#placementTemplate,
          pointEditingAllowed ? this.#selectedPointIndex : undefined,
        )}
      </main>

      <aside class="craft-rail craft-rail--right" aria-label="作品と配置の設定">
        <button class="drawer-close" type="button" data-action="close-drawer">閉じる</button>
        <section class="craft-card performance-card ${warningClass}">
          <header><span>描画負荷</span><strong>${warningClass === "is-good" ? "● 良好" : warningClass === "is-warning" ? "▲ 注意" : "× 超過"}</strong></header>
          <p><span>最大粒子</span><b>${diagnostic.estimatedCost.maximumParticles.toLocaleString()} / 6,000</b></p>
          <meter min="0" max="6000" low="2000" high="5500" optimum="1200" value="${diagnostic.estimatedCost.maximumParticles}" aria-label="描画負荷: 最大粒子 ${diagnostic.estimatedCost.maximumParticles.toLocaleString()} / 6,000"></meter>
          ${warningClass === "is-good" ? "" : `<button type="button" data-action="simplify">自動簡略化</button>`}
        </section>
        <section class="craft-card inspector-card">
          <header><span>選択レイヤー</span><strong>${selectedIntent ? layerAuthoringLabel(selectedIntent) : "未選択"}</strong></header>
          ${this.#renderInspector(intentDesign, selectedIntent)}
        </section>
        ${renderInlineDiagnosticPreview(
          preview,
          this.#previewRunning,
          this.#previewRevision,
        )}
      </aside>

      <footer class="craft-transport integrated-transport">
        <div class="history-actions">
          <button type="button" data-action="undo" ${snapshot.canUndo ? "" : "disabled"}>Undo</button>
          <button type="button" data-action="redo" ${snapshot.canRedo ? "" : "disabled"}>Redo</button>
        </div>
        <span class="editor-save-state" role="status" aria-live="polite">${snapshot.dirty ? "未保存の変更あり" : "保存済み"}</span>
        <button type="button" data-action="save" class="secondary-save">保存して棚へ</button>
        <button type="button" data-action="check" class="confirm-craft">湖面で確認</button>
      </footer>`;
    this.#syncMobileDrawerAccessibility();
  }

  #renderInspector(
    design: FireworkDesignV4,
    selectedLayer: LayerIntentV4 | undefined,
  ): string {
    const optionsFor = (selectedId: string) =>
      Object.values(design.starDefinitions)
        .map(
          (star) =>
            `<option value="${star.id}" ${star.id === selectedId ? "selected" : ""}>${escapeHTML(star.displayName)}</option>`,
        )
        .join("");
    let layerFields = `<p class="inspector-empty">左の一覧からレイヤーを選んでください。</p>`;
    if (selectedLayer) {
      let specific = "";
      if (selectedLayer.authoringMode === "preset") {
        const parameters = selectedLayer.parameters;
        if (selectedLayer.presetKind === "branch") {
          specific = `<label><span>枝数 <output>${parameters.branchCount}</output></span><input name="branch-count" type="range" min="5" max="20" value="${parameters.branchCount}" aria-label="枝数" aria-valuetext="${parameters.branchCount}本" /></label>`;
        } else if (selectedLayer.presetKind === "child") {
          specific = `<label><span>子花数 <output>${parameters.count}</output></span><input name="child-count" type="range" min="4" max="48" value="${parameters.count}" aria-label="子花数" aria-valuetext="${parameters.count}個" /></label>`;
        } else {
          specific = `<label><span>既定配置</span><select name="preset-kind"><option value="outer" ${selectedLayer.presetKind === "outer" ? "selected" : ""}>外周</option><option value="core" ${selectedLayer.presetKind === "core" ? "selected" : ""}>芯</option></select></label>
            <label><span>仮想星数 <output>${parameters.count}</output></span><input name="layer-count" type="range" min="12" max="900" value="${parameters.count}" aria-label="仮想星数" aria-valuetext="${parameters.count}個" /></label>
            <label><span>玉内の半径 <output>${Math.round(parameters.radius * 100)}%</output></span><input name="layer-radius" type="range" min="20" max="100" value="${Math.round(parameters.radius * 100)}" aria-label="玉内の半径" aria-valuetext="${Math.round(parameters.radius * 100)}パーセント" /></label>`;
        }
      } else if (selectedLayer.authoringMode === "pattern") {
        specific = `<p class="inspector-note">型物の生成点は個別編集できません。形状、サイズ、密度、回転はワークベンチで調整します。</p>`;
      } else {
        specific = `<p class="inspector-note">手動レイヤーでは、表示中の断面上にある仮想星を1点ずつ編集できます。</p>`;
      }
      layerFields = `<div class="inspector-fields">
        <label><span>レイヤー名</span><input name="layer-name" type="text" maxlength="24" value="${escapeHTML(selectedLayer.name)}" /></label>
        <label><span>既定の仮想星</span><select name="layer-star">${optionsFor(selectedLayer.defaultStarId)}</select></label>
        ${specific}
      </div>`;
    }
    return layerFields;
  }

  readonly #handleClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>("button[data-action]");
    if (button) {
      this.#runAction(button.dataset.action ?? "", button);
      return;
    }
    const point = target.closest<SVGCircleElement>("[data-point-index]");
    if (point && this.#selectedIntentLayer()?.authoringMode === "manual") {
      const layerId = point.dataset.layerId;
      if (layerId && layerId !== this.#snapshot?.selection.layerId) {
        this.#controller.document.selectLayer(layerId);
      }
      this.#selectedPointIndex = Number(point.dataset.pointIndex);
      this.#render();
      return;
    }
    const canvas = target.closest<SVGSVGElement>("[data-workbench-canvas]");
    if (canvas && this.#placementTemplate === "manual") {
      this.#addManualPoint(event as MouseEvent, canvas);
      return;
    }
    if (this.#starPreviewId) {
      this.#starPreviewId = undefined;
      this.#render();
    }
  };

  #runAction(action: string, button: HTMLButtonElement): void {
    const snapshot = this.#snapshot;
    if (!snapshot) return;
    const layerId =
      button.closest<HTMLElement>("[data-layer-id]")?.dataset.layerId ??
      snapshot.selection.layerId;
    if (action === "toggle-drawer") {
      const drawer = button.dataset.drawer as MobileDrawer;
      this.#drawer = this.#drawer === drawer ? undefined : drawer;
      this.#render();
      this.#focusAfterRender(
        this.#drawer
          ? `.craft-rail--${this.#drawer === "layers" ? "left" : "right"} .drawer-close`
          : `[data-action="toggle-drawer"][data-drawer="${drawer}"]`,
      );
    } else if (action === "close-drawer") {
      const drawer = this.#drawer;
      this.#drawer = undefined;
      this.#render();
      if (drawer) {
        this.#focusAfterRender(
          `[data-action="toggle-drawer"][data-drawer="${drawer}"]`,
        );
      }
    } else if (action === "select-layer" && layerId) {
      this.#selectedPointIndex = undefined;
      const intent = snapshot.intentDraft.layers.find(
        (candidate) => candidate.id === layerId,
      );
      if (intent?.authoringMode === "pattern") {
        this.#section = { ...intent.pattern.section };
      } else if (intent?.authoringMode === "manual" && intent.points[0]) {
        this.#section = { ...intent.points[0].section };
      }
      this.#controller.document.selectLayer(layerId);
      this.#drawer = undefined;
    } else if (action === "toggle-layer" && layerId) {
      this.#updateIntentLayer(layerId, "レイヤー表示を変更", (layer) => {
        layer.visible = !layer.visible;
      });
    } else if (action === "toggle-lock" && layerId) {
      this.#controller.document.updateIntent(
        "レイヤーのロックを変更",
        (draft) => {
          const layer = draft.layers.find(
            (candidate) => candidate.id === layerId,
          );
          if (layer) layer.locked = !layer.locked;
        },
      );
    } else if (action === "move-layer-up" && layerId) {
      this.#moveLayer(layerId, -1);
    } else if (action === "move-layer-down" && layerId) {
      this.#moveLayer(layerId, 1);
    } else if (action === "add-preset") {
      this.#addPreset(
        (button.dataset.presetKind ?? "outer") as
          "outer" | "core" | "child" | "branch",
      );
    } else if (action === "add-pattern") {
      this.#addPattern();
    } else if (action === "add-manual") {
      this.#addManual();
    } else if (action === "duplicate-layer" && layerId) {
      this.#duplicateLayer(layerId);
    } else if (action === "delete-layer" && layerId) {
      this.#deleteLayer(layerId);
    } else if (action === "assign-star") {
      const starId = button.dataset.starId;
      if (!starId) return;
      if (this.#suppressStarClickId === starId) {
        this.#suppressStarClickId = undefined;
        return;
      }
      this.#assignStar(starId);
    } else if (action === "preview-star") {
      this.#openStarPreview(button.dataset.starId);
    } else if (action === "select-section-plane") {
      this.#setSection({
        plane: button.dataset.plane as SectionPlane,
        ratio: this.#section.ratio,
      });
    } else if (action === "select-section-ratio") {
      this.#setSection({
        plane: this.#section.plane,
        ratio: Number(button.dataset.ratio) as SectionRatio,
      });
    } else if (action === "placement-template") {
      const template = button.dataset.template as PlacementTemplate;
      this.#placementTemplate = template;
      this.#selectedPointIndex = undefined;
      if (template === "circle" || template === "heart") {
        this.#applyPlacementTemplate(template);
      } else {
        this.#render();
      }
    } else if (action === "delete-point") {
      this.#deleteSelectedPoint();
    } else if (action === "undo") {
      this.#selectedPointIndex = undefined;
      this.#controller.document.undo();
    } else if (action === "redo") {
      this.#selectedPointIndex = undefined;
      this.#controller.document.redo();
    } else if (action === "simplify") {
      this.#simplify();
    } else if (action === "toggle-preview") {
      this.#previewRunning = !this.#previewRunning;
      this.#render();
    } else if (action === "reset-preview") {
      this.#previewRunning = true;
      this.#previewRevision += 1;
      this.#render();
    } else if (action === "save") {
      this.#save(true);
    } else if (action === "check") {
      this.#callbacks.onCheck(snapshot.draft);
    }
  }

  readonly #handleChange = (event: Event): void => {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    if (!this.#snapshot) return;
    if (input.name) {
      this.#changeSelectedLayer(input.name, input.value);
    }
  };

  readonly #handleDragStart = (event: DragEvent): void => {
    const button = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-action='assign-star']",
    );
    if (!button?.dataset.starId || !event.dataTransfer) return;
    this.#cancelStarPress();
    event.dataTransfer.setData("text/x-codex-star", button.dataset.starId);
    event.dataTransfer.effectAllowed = "copy";
  };

  readonly #handleDragOver = (event: DragEvent): void => {
    if (!(event.target as HTMLElement).closest("[data-workbench-canvas]"))
      return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  };

  readonly #handleDrop = (event: DragEvent): void => {
    const canvas = (event.target as HTMLElement).closest<SVGSVGElement>(
      "[data-workbench-canvas]",
    );
    if (!canvas) return;
    event.preventDefault();
    const starId = event.dataTransfer?.getData("text/x-codex-star");
    if (!starId) return;
    this.#addManualPoint(event, canvas, starId);
  };

  readonly #handlePointerDown = (event: PointerEvent): void => {
    const target = event.target as HTMLElement;
    const starButton = target.closest<HTMLButtonElement>(
      "button[data-action='assign-star']",
    );
    if (starButton?.dataset.starId) {
      this.#cancelStarPress();
      const startedAt = performance.now();
      this.#starLongPress.begin(
        starButton.dataset.starId,
        event.pointerId,
        event.clientX,
        event.clientY,
        startedAt,
      );
      this.#starPressTimer = window.setTimeout(() => {
        const starId = this.#starLongPress.activate(
          event.pointerId,
          startedAt + STAR_LONG_PRESS_DELAY_MS,
        );
        if (!starId) return;
        this.#suppressStarClickId = starId;
        this.#starPreviewId = starId;
        this.#render();
      }, STAR_LONG_PRESS_DELAY_MS);
      return;
    }
    const point = target.closest<SVGCircleElement>(
      "[data-point-index][data-point-editable='true']",
    );
    if (!point || this.#selectedIntentLayer()?.authoringMode !== "manual")
      return;
    const canvas = point.closest<SVGSVGElement>("[data-workbench-canvas]");
    if (!canvas || !point.dataset.layerId) return;
    const local = this.#canvasLocalPoint(event.clientX, event.clientY, canvas);
    this.#pointDrag = {
      index: Number(point.dataset.pointIndex),
      layerId: point.dataset.layerId,
      moved: false,
      position: pointFromSection(this.#section, local),
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      target: point,
    };
    event.preventDefault();
  };

  readonly #handlePointerMove = (event: PointerEvent): void => {
    if (
      this.#starLongPress.move(event.pointerId, event.clientX, event.clientY)
    ) {
      window.clearTimeout(this.#starPressTimer);
      this.#starPressTimer = 0;
    }
    const drag = this.#pointDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const canvas = drag.target.closest<SVGSVGElement>(
      "[data-workbench-canvas]",
    );
    if (!canvas) return;
    const local = this.#canvasLocalPoint(event.clientX, event.clientY, canvas);
    drag.position = pointFromSection(this.#section, local);
    drag.moved ||=
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 3;
    const projected = projectSectionPoint(drag.position, this.#section);
    drag.target.setAttribute("cx", projected.x.toFixed(1));
    drag.target.setAttribute("cy", projected.y.toFixed(1));
    event.preventDefault();
  };

  readonly #handlePointerEnd = (event: PointerEvent): void => {
    const openedId = this.#starLongPress.end(event.pointerId);
    window.clearTimeout(this.#starPressTimer);
    this.#starPressTimer = 0;
    if (openedId) {
      this.#starPreviewId = undefined;
      this.#render();
    }
    const drag = this.#pointDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    this.#pointDrag = undefined;
    this.#selectedPointIndex = drag.index;
    if (!drag.moved) {
      this.#render();
      return;
    }
    this.#controller.document.updateIntent("配置点を移動", (draft) => {
      const layer = draft.layers.find(
        (candidate) => candidate.id === drag.layerId,
      );
      if (!layer || layer.locked || layer.authoringMode !== "manual") return;
      const point = layer.points[drag.index];
      if (!point) return;
      point.position = drag.position;
      point.section = { ...this.#section };
    });
  };

  readonly #handleKeyDown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement;
    const starButton = target.closest<HTMLButtonElement>(
      "button[data-action='assign-star']",
    );
    if (starButton?.dataset.starId && event.key === " ") {
      event.preventDefault();
      this.#openStarPreview(starButton.dataset.starId);
      return;
    }
    const command = event.metaKey || event.ctrlKey;
    if (command && event.key.toLowerCase() === "z") {
      event.preventDefault();
      this.#selectedPointIndex = undefined;
      if (event.shiftKey) this.#controller.document.redo();
      else this.#controller.document.undo();
    } else if (event.key === "Escape") {
      if (this.#starPreviewId) {
        const starId = this.#starPreviewId;
        this.#starPreviewId = undefined;
        this.#render();
        this.#focusAfterRender(
          `[data-action="assign-star"][data-star-id="${CSS.escape(starId)}"]`,
        );
      } else if (this.#drawer) {
        const drawer = this.#drawer;
        this.#drawer = undefined;
        this.#render();
        this.#focusAfterRender(
          `[data-action="toggle-drawer"][data-drawer="${drawer}"]`,
        );
      }
    } else if (
      event.key === "Delete" &&
      !(event.target instanceof HTMLInputElement) &&
      !(event.target instanceof HTMLSelectElement)
    ) {
      event.preventDefault();
      this.#deleteSelectedPoint();
    }
  };

  #schedulePreview(design: FireworkDesign): void {
    const signature = JSON.stringify(
      design.layers.map((layer) => [
        layer.id,
        layer.visible,
        layer.defaultStarId,
        layer.kind === "pattern"
          ? layer.points.length
          : "count" in layer
            ? layer.count
            : layer.branchCount,
      ]),
    );
    if (!this.#previewModel) {
      this.#previewModel = buildApproximateSpreadModel(design);
      this.#previewSignature = signature;
      return;
    }
    if (signature === this.#previewSignature) return;
    window.clearTimeout(this.#previewTimer);
    this.#previewTimer = window.setTimeout(() => {
      this.#previewModel = buildApproximateSpreadModel(
        this.#controller.document.draft,
      );
      this.#previewSignature = signature;
      this.#previewRevision += 1;
      this.#render();
    }, 150);
  }

  #openStarPreview(starId: string | undefined): void {
    if (!starId || !this.#snapshot?.draft.starDefinitions[starId]) return;
    this.#starPreviewId = starId;
    this.#render();
    window.setTimeout(() => {
      this.element
        .querySelector<HTMLButtonElement>(
          `[data-action="preview-star"][data-star-id="${CSS.escape(starId)}"]`,
        )
        ?.focus();
    });
  }

  readonly #handleMobileQueryChange = (): void => {
    if (!this.#mobileQuery.matches) this.#drawer = undefined;
    this.#syncMobileDrawerAccessibility();
  };

  #syncMobileDrawerAccessibility(): void {
    const mobile = this.#mobileQuery.matches;
    const rails = [
      {
        drawer: "layers" as const,
        element: this.element.querySelector<HTMLElement>(".craft-rail--left"),
      },
      {
        drawer: "inspector" as const,
        element: this.element.querySelector<HTMLElement>(".craft-rail--right"),
      },
    ];
    rails.forEach(({ drawer, element }) => {
      if (!element) return;
      const concealed = mobile && this.#drawer !== drawer;
      element.inert = concealed;
      if (concealed) element.setAttribute("aria-hidden", "true");
      else element.removeAttribute("aria-hidden");
    });
  }

  #focusAfterRender(selector: string): void {
    queueMicrotask(() =>
      this.element.querySelector<HTMLElement>(selector)?.focus(),
    );
  }

  #cancelStarPress(): void {
    window.clearTimeout(this.#starPressTimer);
    this.#starPressTimer = 0;
    this.#starLongPress.cancel();
  }

  #canvasLocalPoint(
    clientX: number,
    clientY: number,
    canvas: SVGSVGElement,
  ): { x: number; y: number } {
    const bounds = canvas.getBoundingClientRect();
    const svgX = ((clientX - bounds.left) / bounds.width) * 600;
    const svgY = ((clientY - bounds.top) / bounds.height) * 544;
    return canvasPointOnSection(svgX, svgY, this.#section);
  }

  #selectedIntentLayer(): LayerIntentV4 | undefined {
    const layerId = this.#snapshot?.selection.layerId;
    return this.#snapshot?.intentDraft.layers.find(
      (layer) => layer.id === layerId,
    );
  }

  #updateIntentLayer(
    layerId: string,
    label: string,
    recipe: (layer: LayerIntentV4) => void,
  ): void {
    this.#controller.document.updateIntent(label, (draft) => {
      const layer = draft.layers.find((candidate) => candidate.id === layerId);
      if (!layer || layer.locked) return;
      recipe(layer);
    });
  }

  #setSection(section: SectionRef): void {
    this.#section = section;
    const selected = this.#selectedIntentLayer();
    if (selected?.authoringMode === "pattern") {
      this.#updateIntentLayer(selected.id, "型物の断面を変更", (layer) => {
        if (layer.authoringMode === "pattern") {
          layer.pattern.section = { ...section };
        }
      });
    } else {
      this.#selectedPointIndex = undefined;
      this.#render();
    }
  }

  #moveLayer(layerId: string, offset: number): void {
    this.#controller.document.updateIntent("レイヤーを並べ替え", (draft) => {
      const index = draft.layers.findIndex((layer) => layer.id === layerId);
      const target = index + offset;
      if (index < 0 || target < 0 || target >= draft.layers.length) return;
      const [layer] = draft.layers.splice(index, 1);
      draft.layers.splice(target, 0, layer);
    });
  }

  #addPreset(kind: PresetLayerIntent["presetKind"]): void {
    const draft = this.#controller.document.intentDraft;
    const sameKindCount = draft.layers.filter(
      (layer) => layer.authoringMode === "preset" && layer.presetKind === kind,
    ).length;
    const number = sameKindCount + 1;
    const id = `layer-${kind}-${number}-${draft.layers.length}`;
    const names = {
      branch: "枝",
      child: "子花",
      core: "芯",
      outer: "外周",
    } as const;
    const parameters: PresetLayerParameters = {
      branchCount: 8,
      childDelay: 0.58,
      childPlacement: "sphere",
      childScale: 0.32,
      childWaveDelay: 0.018,
      coloring: { mode: "layer" },
      count: kind === "child" ? 12 : kind === "core" ? 48 : 180,
      jitter: kind === "outer" ? 0.02 : 0.01,
      missingRate: 0,
      placement: "fibonacci",
      placementSeed: draft.assemblySeed + draft.layers.length * 37,
      radius: kind === "core" ? 0.48 : 1,
      starsPerBranch: 18,
      thickness: 0.08,
      upwardBias: 0.72,
    };
    this.#controller.document.updateIntent("既定レイヤーを追加", (next) => {
      next.layers.push({
        authoringMode: "preset",
        defaultStarId:
          kind === "child"
            ? "star-child"
            : kind === "core"
              ? "star-gold"
              : "star-solid-red",
        id,
        ignitionOffset: 0,
        locked: false,
        name: `${names[kind]} ${number}`,
        parameters,
        presetKind: kind,
        radialSpeedScale: kind === "core" ? 0.48 : 1,
        visible: true,
      });
    });
    this.#controller.document.selectLayer(id);
  }

  #addPattern(): void {
    const draft = this.#controller.document.intentDraft;
    const id = `layer-pattern-${draft.layers.length + 1}`;
    this.#controller.document.updateIntent("型物レイヤーを追加", (next) => {
      next.layers.push({
        authoringMode: "pattern",
        defaultStarId: "star-solid-red",
        id,
        ignitionOffset: 0,
        locked: false,
        name: `型物 ${draft.layers.length + 1}`,
        pattern: {
          density: 48,
          rotationDegrees: 0,
          scale: 0.72,
          section: { plane: "xy", ratio: 0.5 },
          template: "circle",
        },
        radialSpeedScale: 0.88,
        visible: true,
      });
    });
    this.#controller.document.selectLayer(id);
  }

  #addManual(): void {
    const draft = this.#controller.document.intentDraft;
    const id = `layer-manual-${draft.layers.length + 1}`;
    this.#controller.document.updateIntent("手動レイヤーを追加", (next) => {
      next.layers.push({
        authoringMode: "manual",
        defaultStarId: "star-child",
        id,
        ignitionOffset: 0,
        locked: false,
        name: `手動 ${draft.layers.length + 1}`,
        points: [],
        radialSpeedScale: 1,
        visible: true,
      });
    });
    this.#controller.document.selectLayer(id);
  }

  #duplicateLayer(layerId: string): void {
    const source = this.#controller.document.intentDraft.layers.find(
      (layer) => layer.id === layerId,
    );
    if (!source) return;
    const id = `${source.id}-copy-${this.#controller.document.intentDraft.layers.length}`;
    this.#controller.document.updateIntent("レイヤーを複製", (draft) => {
      const index = draft.layers.findIndex((layer) => layer.id === layerId);
      draft.layers.splice(index + 1, 0, {
        ...structuredClone(source),
        id,
        locked: false,
        name: `${source.name} 複製`,
      });
    });
    this.#controller.document.selectLayer(id);
  }

  #deleteLayer(layerId: string): void {
    const draft = this.#controller.document.intentDraft;
    const layer = draft.layers.find((candidate) => candidate.id === layerId);
    if (!layer || layer.locked) return;
    if (draft.layers.length <= 1) {
      this.#callbacks.onToast("外周レイヤーは残してください");
      return;
    }
    this.#selectedPointIndex = undefined;
    this.#controller.document.updateIntent("レイヤーを削除", (next) => {
      next.layers = next.layers.filter((candidate) => candidate.id !== layerId);
    });
  }

  #assignStar(starId: string): void {
    const layerId = this.#snapshot?.selection.layerId;
    if (!layerId) return;
    this.#starPreviewId = undefined;
    this.#controller.document.selectStarDefinition(starId);
    let replacedPoint = false;
    this.#updateIntentLayer(layerId, "仮想星を配置", (layer) => {
      if (
        layer.authoringMode === "manual" &&
        this.#selectedPointIndex !== undefined
      ) {
        const point = layer.points[this.#selectedPointIndex];
        if (point) {
          point.starId = starId;
          replacedPoint = true;
        }
        return;
      }
      layer.defaultStarId = starId;
    });
    this.#callbacks.onToast(
      replacedPoint
        ? "選択した配置点の仮想星を変更しました"
        : "選択レイヤーの仮想星を変更しました",
    );
  }

  #applyPlacementTemplate(
    template: Exclude<PlacementTemplate, "manual">,
  ): void {
    const layerId = this.#snapshot?.selection.layerId;
    if (!layerId) return;
    const selectedStarId = this.#snapshot?.selection.starDefinitionId;
    let applied = false;
    this.#updateIntentLayer(
      layerId,
      `${template === "circle" ? "円形" : "ハート"}配置`,
      (layer) => {
        if (layer.authoringMode !== "manual") return;
        layer.points = createPlacementTemplatePoints(
          template,
          this.#section,
        ).map((position, index) => ({
          id: `${layer.id}-${template}-${index + 1}`,
          position,
          section: { ...this.#section },
          starId: selectedStarId ?? layer.defaultStarId,
        }));
        applied = true;
      },
    );
    this.#callbacks.onToast(
      applied
        ? `${this.#section.plane.toUpperCase()} ${Math.round(this.#section.ratio * 100)}%断面へ${template === "circle" ? "円形" : "ハート"}を配置しました`
        : "手動レイヤーを選んでください",
    );
  }

  #addManualPoint(
    event: MouseEvent | DragEvent,
    canvas: SVGSVGElement,
    starId?: string,
  ): void {
    const layerId = this.#snapshot?.selection.layerId;
    const selectedLayer = this.#selectedIntentLayer();
    if (
      !layerId ||
      !selectedLayer ||
      selectedLayer.locked ||
      selectedLayer.authoringMode !== "manual"
    )
      return;
    const local = this.#canvasLocalPoint(event.clientX, event.clientY, canvas);
    let addedIndex: number | undefined;
    this.#updateIntentLayer(layerId, "配置点を追加", (layer) => {
      if (layer.authoringMode !== "manual") return;
      addedIndex = layer.points.length;
      let pointNumber = layer.points.length + 1;
      while (
        layer.points.some(
          (point) => point.id === `${layer.id}-point-${pointNumber}`,
        )
      ) {
        pointNumber += 1;
      }
      layer.points.push({
        id: `${layer.id}-point-${pointNumber}`,
        position: pointFromSection(this.#section, local),
        section: { ...this.#section },
        starId: starId ?? layer.defaultStarId,
      });
    });
    if (addedIndex === undefined) {
      if (starId) this.#assignStar(starId);
      else this.#callbacks.onToast("手動レイヤーを選んでください");
      return;
    }
    this.#placementTemplate = "manual";
    this.#selectedPointIndex = addedIndex;
  }

  #deleteSelectedPoint(): void {
    const layerId = this.#snapshot?.selection.layerId;
    const index = this.#selectedPointIndex;
    if (
      !layerId ||
      index === undefined ||
      this.#selectedIntentLayer()?.authoringMode !== "manual"
    )
      return;
    this.#updateIntentLayer(layerId, "配置点を削除", (layer) => {
      if (layer.authoringMode === "manual") layer.points.splice(index, 1);
    });
    this.#selectedPointIndex = undefined;
  }

  #changeSelectedLayer(name: string, value: string): void {
    const layerId = this.#snapshot?.selection.layerId;
    if (!layerId) return;
    this.#updateIntentLayer(layerId, "配置属性を変更", (layer) => {
      if (name === "layer-name") layer.name = value;
      else if (name === "layer-star") layer.defaultStarId = value;
      else if (layer.authoringMode === "preset") {
        if (name === "layer-count") {
          layer.parameters.count = Number(value);
        } else if (name === "layer-radius") {
          layer.parameters.radius = Number(value) / 100;
          layer.radialSpeedScale = layer.parameters.radius;
        } else if (name === "preset-kind") {
          layer.presetKind = value === "core" ? "core" : "outer";
        } else if (name === "child-count") {
          layer.parameters.count = Number(value);
        } else if (name === "branch-count") {
          layer.parameters.branchCount = Number(value);
        }
      }
    });
  }

  #simplify(): void {
    this.#controller.document.updateIntent("描画負荷を自動簡略化", (draft) => {
      draft.layers.forEach((layer) => {
        if (layer.authoringMode === "preset") {
          layer.parameters.count = Math.min(layer.parameters.count, 520);
          layer.parameters.starsPerBranch = Math.min(
            layer.parameters.starsPerBranch,
            28,
          );
        } else if (layer.authoringMode === "pattern") {
          layer.pattern.density = Math.min(layer.pattern.density, 180);
        }
      });
    });
    this.#callbacks.onToast("層構成を保ったまま星数を簡略化しました");
  }

  #save(toLibrary: boolean): void {
    const snapshot = this.#snapshot;
    if (!snapshot) return;
    if (snapshot.diagnostic.estimatedCost.maximumParticles > 6_000) {
      this.#callbacks.onToast(
        "実行上限を超えています。先に自動簡略化してください",
      );
      return;
    }
    const saved = this.#controller.save();
    this.#callbacks.onDesignLibraryChange(this.#controller.savedDesigns);
    this.#callbacks.onToast(`「${saved.name}」を保存しました`);
    if (toLibrary) this.#callbacks.onSaveToLibrary(saved);
  }
}
