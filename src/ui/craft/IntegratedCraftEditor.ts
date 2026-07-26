import {
  type FireworkDesign,
  type FireworkDesignV4,
  type LayerIntentV4,
  type PatternTemplate,
  type PresetLayerIntent,
  type PresetLayerParameters,
  type SectionRef,
} from "../../data";
import type { CraftController, CraftDocumentSnapshot } from "../../modes/craft";
import {
  buildCompiledBurstPreviewModel,
  type CompiledBurstPreviewModel,
} from "../../render/preview/CompiledBurstPreviewRenderer";
import { StarBehaviorPreviewRenderer } from "../../render/preview/StarBehaviorPreviewRenderer";
import { renderInlineDiagnosticPreview } from "./InlineDiagnosticPreview";
import {
  canvasPointOnSection,
  projectSectionPoint,
  renderIntegratedPlacementWorkbench,
  type PlacementTemplate,
  type TemplateApplyMode,
} from "./IntegratedPlacementWorkbench";
import {
  applyImagePlacementToDraft,
  type ApplyImagePlacementResult,
} from "./ImagePlacementApplication";
import {
  openGuidedImagePlacementDialog,
  type GuidedImagePlacementDialogResult,
} from "./GuidedImagePlacementDialog";
import { DEFAULT_GUIDED_IMAGE_PLACEMENT_SETTINGS } from "./GuidedImagePlacementRecipe";
import {
  IMAGE_PLACEMENT_MAXIMUM_POINTS,
  IMAGE_PLACEMENT_MINIMUM_POINTS,
} from "./ImagePlacementRecipe";
import { renderLayerPanel } from "./LayerPanel";
import {
  createManualPlacementPoints,
  DEFAULT_MANUAL_PLACEMENT_SETTINGS,
  type ManualPlacementSettings,
} from "./ManualPlacementRecipe";
import {
  effectivePatternScale,
  PATTERN_TEMPLATES,
  patternScaleLimit,
} from "./PatternRecipe";
import {
  computeStarPreviewPosition,
  renderStarLibraryPanel,
  renderStarPreviewOverlay,
  type StarPreviewPosition,
} from "./StarLibraryPanel";
import {
  STAR_LONG_PRESS_DELAY_MS,
  StarLongPressGesture,
} from "./StarLongPressGesture";
import {
  pointFromSection,
  sectionPlaneForAxis,
  sectionRatioAt,
  type Point3D,
  type SectionAxis,
} from "./SliceGeometry";
import { clientPointToSvg } from "./SvgCoordinateTransform";
import { escapeHTML } from "./viewUtils";
import {
  editorLoadLevel,
  renderEditorTransport,
  type EditorMessageKind,
} from "./EditorTransport";
import {
  NEW_LAYER_GUIDANCE,
  NO_LAYER_GUIDANCE,
  selectedStarGuidance,
} from "./EditorWorkflowGuidance";
import { synchronizeEditorSection } from "./EditorSectionState";
import { renderSelectedLayerInspector } from "./SelectedLayerInspector";
import {
  DEFAULT_WORKBENCH_VIEW_STATE,
  normalizeWorkbenchViewState,
  type WorkbenchViewState,
} from "./WorkbenchViewGeometry";

export interface IntegratedCraftEditorCallbacks {
  onCheck: (design: FireworkDesign) => void;
  onDesignLibraryChange: (designs: FireworkDesign[]) => void;
  onSaveToLibrary: (design: FireworkDesign) => void;
}

export interface IntegratedCraftEditorDependencies {
  createStarBehaviorPreviewRenderer: () => StarBehaviorPreviewRenderer;
  openGuidedImagePlacementDialog: typeof openGuidedImagePlacementDialog;
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
  readonly #createStarBehaviorPreviewRenderer: () => StarBehaviorPreviewRenderer;
  readonly #openGuidedImagePlacementDialog: typeof openGuidedImagePlacementDialog;
  readonly #mobileQuery: MediaQueryList;
  readonly #starLongPress = new StarLongPressGesture();
  #drawer?: MobileDrawer;
  #editorMessage?: { kind: EditorMessageKind; text: string };
  #imageEnhanceDarkColors =
    DEFAULT_GUIDED_IMAGE_PLACEMENT_SETTINGS.enhanceDarkColors;
  #imagePlacementMode = DEFAULT_GUIDED_IMAGE_PLACEMENT_SETTINGS.placementMode;
  #imageImporting = false;
  #imageOutlineStarId?: string;
  #imageStarKind = DEFAULT_GUIDED_IMAGE_PLACEMENT_SETTINGS.imageStarKind;
  #imageTargetCount = DEFAULT_GUIDED_IMAGE_PLACEMENT_SETTINGS.targetCount;
  #section: SectionRef = { plane: "xy", ratio: 0.5 };
  #placementTemplate: PlacementTemplate = "manual";
  #manualPlacementSettings: ManualPlacementSettings = {
    ...DEFAULT_MANUAL_PLACEMENT_SETTINGS,
  };
  #messageTimer = 0;
  #leftRailScrollTop = 0;
  #templateApplyMode: TemplateApplyMode = "replace";
  #pointDrag?: PointDrag;
  #previewModel?: CompiledBurstPreviewModel;
  #previewDockExpanded = true;
  #previewRevision = 0;
  #previewRunning = true;
  #previewSignature = "";
  #previewTimer = 0;
  #selectedPointIndex?: number;
  #sliceAnnouncement = "";
  #snapshot?: CraftDocumentSnapshot;
  #starPressTimer = 0;
  #starTrayScrollTop = 0;
  #starBehaviorPreviewPlaying = true;
  #starBehaviorPreviewRenderer?: StarBehaviorPreviewRenderer;
  #starPreviewId?: string;
  #starPreviewPosition?: StarPreviewPosition;
  #suppressStarClickId?: string;
  #unsubscribe: () => void;
  #viewRenderFrame = 0;
  #viewState: WorkbenchViewState = { ...DEFAULT_WORKBENCH_VIEW_STATE };

  constructor(
    controller: CraftController,
    callbacks: IntegratedCraftEditorCallbacks,
    dependencies: Partial<IntegratedCraftEditorDependencies> = {},
  ) {
    this.#controller = controller;
    this.#callbacks = callbacks;
    this.#openGuidedImagePlacementDialog =
      dependencies.openGuidedImagePlacementDialog ??
      openGuidedImagePlacementDialog;
    this.#createStarBehaviorPreviewRenderer =
      dependencies.createStarBehaviorPreviewRenderer ??
      (() => new StarBehaviorPreviewRenderer());
    this.#mobileQuery = window.matchMedia("(max-width: 900px)");
    this.element.className = "craft-workspace integrated-craft-editor";
    this.element.addEventListener("click", this.#handleClick);
    this.element.addEventListener("change", this.#handleChange);
    this.element.addEventListener("input", this.#handleInput);
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
      const selectedIntent = snapshot.intentDraft.layers.find(
        (layer) => layer.id === snapshot.selection.layerId,
      );
      this.#section = synchronizeEditorSection(this.#section, selectedIntent);
      this.#schedulePreview(snapshot.intentDraft);
      this.#render();
    });
  }

  destroy(): void {
    window.cancelAnimationFrame(this.#viewRenderFrame);
    window.clearTimeout(this.#messageTimer);
    window.clearTimeout(this.#previewTimer);
    this.#cancelStarPress();
    this.#starBehaviorPreviewRenderer?.destroy();
    this.#unsubscribe();
    this.element.removeEventListener("click", this.#handleClick);
    this.element.removeEventListener("change", this.#handleChange);
    this.element.removeEventListener("input", this.#handleInput);
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
    this.#rememberScrollPositions();
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
    const preview =
      this.#previewModel ??
      buildCompiledBurstPreviewModel(snapshot.intentDraft);
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
        ${renderStarLibraryPanel(design, selectedStarId)}
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
          this.#templateApplyMode,
          this.#sliceAnnouncement,
          this.#manualPlacementSettings,
          this.#imageTargetCount,
          this.#imageImporting,
          this.#viewState,
        )}
      </main>

      <aside class="craft-rail craft-rail--right" aria-label="作品と配置の設定">
        <button class="drawer-close" type="button" data-action="close-drawer">閉じる</button>
        ${renderSelectedLayerInspector(
          intentDesign,
          selectedIntent,
          this.#selectedPointIndex,
        )}
        ${renderInlineDiagnosticPreview(
          preview,
          this.#previewRunning,
          this.#previewRevision,
          this.#previewDockExpanded,
        )}
      </aside>

      ${renderEditorTransport({
        canRedo: snapshot.canRedo,
        canUndo: snapshot.canUndo,
        dirty: snapshot.dirty,
        load: {
          level: editorLoadLevel(
            diagnostic.estimatedCost.maximumParticles,
            6_000,
          ),
          limit: 6_000,
          maximumParticles: diagnostic.estimatedCost.maximumParticles,
        },
        message: this.#transportMessage(snapshot, selectedIntent),
      })}
      ${renderStarPreviewOverlay(
        design,
        this.#starPreviewId,
        this.#starPreviewPosition,
      )}
      <input name="image-placement-file" type="file" accept="image/*" hidden />`;
    this.#restoreScrollPositions();
    this.#syncMobileDrawerAccessibility();
    this.#syncStarBehaviorPreview();
  }

  #rememberScrollPositions(): void {
    const leftRail =
      this.element.querySelector<HTMLElement>(".craft-rail--left");
    const starTray = this.element.querySelector<HTMLElement>(
      ".integrated-star-library .star-tray",
    );
    if (leftRail) this.#leftRailScrollTop = leftRail.scrollTop;
    if (starTray) this.#starTrayScrollTop = starTray.scrollTop;
  }

  #restoreScrollPositions(): void {
    const leftRail =
      this.element.querySelector<HTMLElement>(".craft-rail--left");
    const starTray = this.element.querySelector<HTMLElement>(
      ".integrated-star-library .star-tray",
    );
    if (leftRail) leftRail.scrollTop = this.#leftRailScrollTop;
    if (starTray) starTray.scrollTop = this.#starTrayScrollTop;
  }

  #transportMessage(
    snapshot: CraftDocumentSnapshot,
    selectedLayer: LayerIntentV4 | undefined,
  ): { kind: EditorMessageKind; text: string } {
    if (this.#editorMessage?.kind === "warning") return this.#editorMessage;
    if (snapshot.diagnostic.estimatedCost.maximumParticles > 6_000) {
      return {
        kind: "warning",
        text: "実行上限を超えています。自動簡略化してください",
      };
    }
    if (snapshot.intentDraft.layers.length === 0) {
      return { kind: "tip", text: NO_LAYER_GUIDANCE };
    }
    if (this.#editorMessage) return this.#editorMessage;
    if (snapshot.selection.guidanceStage === "choose-star") {
      return { kind: "tip", text: NEW_LAYER_GUIDANCE };
    }
    if (
      snapshot.selection.guidanceStage === "configure-layer" &&
      selectedLayer
    ) {
      return {
        kind: "tip",
        text: selectedStarGuidance(selectedLayer.authoringMode),
      };
    }
    if (snapshot.dirty) {
      return { kind: "status", text: "未保存の変更があります" };
    }
    if (!selectedLayer) {
      return { kind: "tip", text: "レイヤーを選ぶと設定を編集できます" };
    }
    if (selectedLayer.authoringMode === "manual") {
      return {
        kind: "tip",
        text: "操作面を押して点を追加し、既存点はドラッグできます",
      };
    }
    if (selectedLayer.authoringMode === "pattern") {
      return { kind: "tip", text: "形状と操作面を選び、右側で整えます" };
    }
    return { kind: "tip", text: "右側の設定で星数と半径を整えます" };
  }

  #showEditorMessage(
    kind: EditorMessageKind,
    text: string,
    persistent = kind === "warning",
  ): void {
    window.clearTimeout(this.#messageTimer);
    this.#messageTimer = 0;
    this.#editorMessage = { kind, text };
    this.#render();
    if (persistent) return;
    this.#messageTimer = window.setTimeout(() => {
      this.#editorMessage = undefined;
      this.#messageTimer = 0;
      this.#render();
    }, 3_600);
  }

  #dismissEditorWarning(): void {
    if (this.#editorMessage?.kind !== "warning") return;
    window.clearTimeout(this.#messageTimer);
    this.#messageTimer = 0;
    this.#editorMessage = undefined;
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
  };

  #runAction(action: string, button: HTMLButtonElement): void {
    const snapshot = this.#snapshot;
    if (!snapshot) return;
    this.#dismissEditorWarning();
    const layerId =
      button.closest<HTMLElement>("[data-layer-id]")?.dataset.layerId ??
      snapshot.selection.layerId;
    if (action === "select-section-axis") {
      this.#controller.document.completeSelectionGuidance();
      const axis = button.dataset.axis as SectionAxis;
      if (!(["x", "y", "z"] as const).includes(axis)) return;
      const plane = sectionPlaneForAxis(axis);
      this.#viewState = normalizeWorkbenchViewState({
        pitchDegrees: plane === "xz" ? -60 : 0,
        yawDegrees: plane === "yz" ? 90 : 0,
        zoom: this.#viewState.zoom,
      });
      this.#setSection({ plane, ratio: this.#section.ratio });
      this.#focusAfterRender(
        `[data-action="select-section-axis"][data-axis="${axis}"]`,
      );
    } else if (action === "toggle-drawer") {
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
      this.#drawer = undefined;
      this.#controller.document.selectLayer(layerId);
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
      this.#openStarPreview(button.dataset.starId, button);
    } else if (action === "close-star-preview") {
      this.#closeStarPreview();
    } else if (action === "toggle-star-behavior-preview") {
      const renderer = this.#starBehaviorPreviewRenderer;
      if (!renderer) return;
      if (renderer.isRunning) {
        renderer.pause();
        this.#starBehaviorPreviewPlaying = false;
      } else {
        renderer.play(true);
        this.#starBehaviorPreviewPlaying = renderer.isRunning;
      }
      this.#updateStarBehaviorPreviewControl();
    } else if (action === "restart-star-behavior-preview") {
      this.#starBehaviorPreviewRenderer?.restart();
      this.#starBehaviorPreviewPlaying =
        this.#starBehaviorPreviewRenderer?.isRunning ?? false;
      this.#updateStarBehaviorPreviewControl();
    } else if (action === "duplicate-selected-star") {
      this.#duplicateSelectedStar();
    } else if (action === "select-pattern-template" && layerId) {
      this.#controller.document.completeSelectionGuidance();
      const requestedTemplate = button.dataset.template as PatternTemplate;
      const template = PATTERN_TEMPLATES.includes(requestedTemplate)
        ? requestedTemplate
        : "circle";
      this.#updateIntentLayer(layerId, "型物の形状を変更", (layer) => {
        if (layer.authoringMode === "pattern") {
          layer.pattern.template = template;
          layer.pattern.scale = effectivePatternScale(layer.pattern);
        }
      });
    } else if (action === "placement-template") {
      this.#controller.document.completeSelectionGuidance();
      const template = button.dataset.template as PlacementTemplate;
      this.#placementTemplate = template;
      this.#selectedPointIndex = undefined;
      this.#render();
    } else if (action === "import-image-placement") {
      const layer = this.#selectedIntentLayer();
      this.#placementTemplate = "image";
      this.#selectedPointIndex = undefined;
      if (layer?.authoringMode !== "manual") {
        this.#showEditorMessage("warning", "手動レイヤーを選んでください");
        return;
      }
      if (layer.locked) {
        this.#showEditorMessage(
          "warning",
          "レイヤーのロックを解除してください",
        );
        return;
      }
      if (this.#imageImporting) return;
      this.#render();
      this.element
        .querySelector<HTMLInputElement>("input[name='image-placement-file']")
        ?.click();
    } else if (action === "apply-manual-recipe") {
      this.#applyManualRecipe();
    } else if (action === "delete-point") {
      this.#deleteSelectedPoint();
    } else if (action === "undo") {
      this.#controller.document.completeSelectionGuidance();
      this.#selectedPointIndex = undefined;
      this.#controller.document.undo();
    } else if (action === "redo") {
      this.#controller.document.completeSelectionGuidance();
      this.#selectedPointIndex = undefined;
      this.#controller.document.redo();
    } else if (action === "simplify") {
      this.#simplify();
    } else if (action === "toggle-preview") {
      this.#previewRunning = !this.#previewRunning;
      this.#render();
    } else if (action === "toggle-preview-dock") {
      this.#previewDockExpanded = !this.#previewDockExpanded;
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

  readonly #handleInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    const numericValue = Number(input.value);
    if (!Number.isFinite(numericValue)) return;
    if (input.name === "workbench-zoom") {
      this.#viewState = normalizeWorkbenchViewState({
        ...this.#viewState,
        zoom: numericValue / 100,
      });
      input.setAttribute(
        "aria-valuetext",
        `${Math.round(this.#viewState.zoom * 100)}パーセント`,
      );
      const output = input
        .closest("label")
        ?.querySelector<HTMLOutputElement>("output");
      if (output) output.value = `${Math.round(this.#viewState.zoom * 100)}%`;
    } else if (input.name === "section-step") {
      this.#section = {
        plane: this.#section.plane,
        ratio: sectionRatioAt(numericValue),
      };
      const index = Number(input.value);
      const position = index < 2 ? "手前" : index === 2 ? "中央" : "奥";
      const valueText = `${this.#section.plane.toUpperCase()}面 ${position} ${index + 1} / 5`;
      input.setAttribute("aria-valuetext", valueText);
      const output = input
        .closest("label")
        ?.querySelector<HTMLOutputElement>("output");
      if (output) {
        output.value = `${this.#section.plane.toUpperCase()} · ${position} ${index + 1} / 5`;
      }
    } else {
      return;
    }
    this.#scheduleWorkbenchViewRender();
  };

  readonly #handleChange = (event: Event): void => {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    if (!this.#snapshot) return;
    this.#dismissEditorWarning();
    if (input.name === "workbench-zoom") {
      return;
    }
    if (input.name === "section-step") {
      this.#controller.document.completeSelectionGuidance();
      this.#setSection({
        plane: this.#section.plane,
        ratio: sectionRatioAt(Number(input.value)),
      });
      this.#focusAfterRender('input[name="section-step"]');
    } else if (input.name === "image-placement-file") {
      const file = (input as HTMLInputElement).files?.[0];
      (input as HTMLInputElement).value = "";
      if (file) void this.#applyImagePlacement(file);
    } else if (input.name === "image-target-count") {
      this.#controller.document.completeSelectionGuidance();
      const value = Number(input.value);
      if (Number.isFinite(value)) {
        this.#imageTargetCount = Math.round(
          Math.min(
            Math.max(value, IMAGE_PLACEMENT_MINIMUM_POINTS),
            IMAGE_PLACEMENT_MAXIMUM_POINTS,
          ),
        );
      }
      this.#render();
    } else if (input.name === "template-apply-mode") {
      this.#controller.document.completeSelectionGuidance();
      this.#templateApplyMode = input.value as TemplateApplyMode;
      this.#render();
    } else if (input.name.startsWith("manual-")) {
      this.#controller.document.completeSelectionGuidance();
      this.#changeManualPlacementSetting(input.name, input.value);
      this.#render();
    } else if (input.name) {
      this.#changeSelectedLayer(input.name, input.value, input.dataset.stage);
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
    if (target.closest("button[data-action='select-section-axis']")) return;
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
        this.#openStarPreview(starId, starButton);
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
    const visualPoint = Array.from(
      canvas.querySelectorAll<SVGCircleElement>("[data-point-visual='true']"),
    ).find(
      (candidate) =>
        candidate.dataset.layerId === point.dataset.layerId &&
        candidate.dataset.pointIndex === point.dataset.pointIndex,
    );
    this.#pointDrag = {
      index: Number(point.dataset.pointIndex),
      layerId: point.dataset.layerId,
      moved: false,
      position: pointFromSection(this.#section, local),
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      target: visualPoint ?? point,
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
    const projected = projectSectionPoint(
      drag.position,
      this.#section,
      this.#viewState,
    );
    drag.target.setAttribute("cx", projected.x.toFixed(1));
    drag.target.setAttribute("cy", projected.y.toFixed(1));
    event.preventDefault();
  };

  readonly #handlePointerEnd = (event: PointerEvent): void => {
    this.#starLongPress.end(event.pointerId);
    window.clearTimeout(this.#starPressTimer);
    this.#starPressTimer = 0;
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
    if (target.closest("button[data-action='select-section-axis']")) return;
    const starButton = target.closest<HTMLButtonElement>(
      "button[data-action='assign-star']",
    );
    if (starButton?.dataset.starId && event.key === " ") {
      event.preventDefault();
      this.#openStarPreview(starButton.dataset.starId, starButton);
      return;
    }
    if (this.#starPreviewId && event.key === "Tab") {
      event.preventDefault();
      this.element
        .querySelector<HTMLButtonElement>(
          ".star-spread-balloon [data-action='close-star-preview']",
        )
        ?.focus();
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
        this.#closeStarPreview();
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

  #scheduleWorkbenchViewRender(): void {
    if (this.#viewRenderFrame) return;
    this.#viewRenderFrame = window.requestAnimationFrame(() => {
      this.#viewRenderFrame = 0;
      this.#refreshWorkbenchView();
    });
  }

  #refreshWorkbenchView(): void {
    const snapshot = this.#snapshot;
    if (!snapshot) return;
    const selectedLayer = snapshot.draft.layers.find(
      (layer) => layer.id === snapshot.selection.layerId,
    );
    const selectedIntent = snapshot.intentDraft.layers.find(
      (layer) => layer.id === snapshot.selection.layerId,
    );
    const markup = renderIntegratedPlacementWorkbench(
      snapshot.draft,
      snapshot.intentDraft,
      selectedLayer,
      selectedIntent,
      this.#section,
      this.#placementTemplate,
      selectedIntent?.authoringMode === "manual"
        ? this.#selectedPointIndex
        : undefined,
      this.#templateApplyMode,
      this.#sliceAnnouncement,
      this.#manualPlacementSettings,
      this.#imageTargetCount,
      this.#imageImporting,
      this.#viewState,
    );
    const template = document.createElement("template");
    template.innerHTML = markup;
    const nextCanvas = template.content.querySelector<SVGSVGElement>(
      "[data-workbench-canvas]",
    );
    const currentCanvas = this.element.querySelector<SVGSVGElement>(
      "[data-workbench-canvas]",
    );
    if (nextCanvas && currentCanvas) currentCanvas.replaceWith(nextCanvas);
    const nextNavigatorSvg = template.content.querySelector<SVGSVGElement>(
      ".shell-slice-navigator > svg",
    );
    const currentNavigatorSvg = this.element.querySelector<SVGSVGElement>(
      ".shell-slice-navigator > svg",
    );
    if (nextNavigatorSvg && currentNavigatorSvg) {
      currentNavigatorSvg.replaceWith(nextNavigatorSvg);
    }
  }

  #schedulePreview(design: FireworkDesignV4): void {
    const signature = JSON.stringify({
      burstField: design.burstField,
      layers: design.layers,
      launchVariation: design.launchVariation,
      sizeClass: design.sizeClass,
      starDefinitions: design.starDefinitions,
    });
    if (!this.#previewModel) {
      this.#previewModel = buildCompiledBurstPreviewModel(design);
      this.#previewSignature = signature;
      return;
    }
    if (signature === this.#previewSignature) return;
    window.clearTimeout(this.#previewTimer);
    this.#previewTimer = window.setTimeout(() => {
      this.#previewModel = buildCompiledBurstPreviewModel(
        this.#controller.document.intentDraft,
      );
      this.#previewSignature = signature;
      this.#previewRevision += 1;
      this.#render();
    }, 150);
  }

  #openStarPreview(starId: string | undefined, anchor: HTMLElement): void {
    if (!starId || !this.#snapshot?.draft.starDefinitions[starId]) return;
    const bounds = anchor.getBoundingClientRect();
    this.#starPreviewId = starId;
    this.#starBehaviorPreviewPlaying = true;
    this.#starPreviewPosition = computeStarPreviewPosition(bounds, {
      height: window.innerHeight,
      width: window.innerWidth,
    });
    this.#render();
    queueMicrotask(() => {
      this.element.querySelector<HTMLElement>(".star-spread-balloon")?.focus();
    });
  }

  #closeStarPreview(): void {
    const starId = this.#starPreviewId;
    this.#starPreviewId = undefined;
    this.#starPreviewPosition = undefined;
    this.#starBehaviorPreviewRenderer?.detach();
    this.#render();
    if (starId) {
      this.#focusAfterRender(
        `[data-action="preview-star"][data-star-id="${CSS.escape(starId)}"]`,
      );
    }
  }

  #syncStarBehaviorPreview(): void {
    const starId = this.#starPreviewId;
    const host = this.element.querySelector<HTMLElement>(
      "[data-star-behavior-preview-host]",
    );
    const star = starId
      ? this.#snapshot?.draft.starDefinitions[starId]
      : undefined;
    if (!host || !star) {
      this.#starBehaviorPreviewRenderer?.detach();
      return;
    }
    this.#starBehaviorPreviewRenderer ??=
      this.#createStarBehaviorPreviewRenderer();
    this.#starBehaviorPreviewRenderer.attach(host, star);
    if (!this.#starBehaviorPreviewPlaying) {
      this.#starBehaviorPreviewRenderer.pause();
    } else {
      this.#starBehaviorPreviewPlaying =
        this.#starBehaviorPreviewRenderer.isRunning;
    }
    this.#updateStarBehaviorPreviewControl();
  }

  #updateStarBehaviorPreviewControl(): void {
    const button = this.element.querySelector<HTMLButtonElement>(
      "[data-action='toggle-star-behavior-preview']",
    );
    if (!button) return;
    const running = this.#starBehaviorPreviewRenderer?.isRunning ?? false;
    button.textContent = running ? "一時停止" : "再生";
    button.setAttribute("aria-pressed", String(running));
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
    const { x: svgX, y: svgY } = clientPointToSvg(clientX, clientY, canvas);
    return canvasPointOnSection(svgX, svgY, this.#section, this.#viewState);
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
    this.#sliceAnnouncement = "選択中の切断面を更新しました";
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
    this.#controller.document.selectLayer(id, "choose-star");
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
    this.#controller.document.selectLayer(id, "choose-star");
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
    this.#controller.document.selectLayer(id, "choose-star");
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
      this.#showEditorMessage("warning", "外周レイヤーは残してください");
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
    this.#starPreviewPosition = undefined;
    this.#controller.document.selectStarDefinition(starId);
    this.#updateIntentLayer(layerId, "仮想星を配置", (layer) => {
      if (
        layer.authoringMode === "manual" &&
        this.#selectedPointIndex !== undefined
      ) {
        const point = layer.points[this.#selectedPointIndex];
        if (point) {
          point.starId = starId;
        }
        return;
      }
      layer.defaultStarId = starId;
    });
  }

  #applyManualRecipe(): void {
    this.element
      .querySelectorAll<HTMLInputElement>("input[name^='manual-']")
      .forEach((input) =>
        this.#changeManualPlacementSetting(input.name, input.value),
      );
    const template = this.#placementTemplate;
    if (template === "image" || template === "manual") return;
    const layerId = this.#snapshot?.selection.layerId;
    if (!layerId) return;
    const selectedStarId = this.#snapshot?.selection.starDefinitionId;
    let applied = false;
    this.#updateIntentLayer(
      layerId,
      `${({ circle: "円周", line: "直線", arc: "円弧", grid: "格子" } as const)[template]}配置`,
      (layer) => {
        if (layer.authoringMode !== "manual") return;
        const existingCount = layer.points.length;
        const generated = createManualPlacementPoints(
          template,
          this.#manualPlacementSettings,
        ).map((point, index) => ({
          id: `${layer.id}-${template}-${existingCount + index + 1}`,
          position: pointFromSection(this.#section, point),
          section: { ...this.#section },
          starId: selectedStarId ?? layer.defaultStarId,
        }));
        layer.points =
          this.#templateApplyMode === "append"
            ? [...layer.points, ...generated]
            : generated;
        applied = true;
      },
    );
    const label = (
      { circle: "円周", line: "直線", arc: "円弧", grid: "格子" } as const
    )[template];
    if (applied) {
      this.#showEditorMessage(
        "status",
        `選択中の切断面へ${label}を${this.#templateApplyMode === "append" ? "追加" : "配置"}しました`,
      );
    } else {
      this.#showEditorMessage("warning", "手動レイヤーを選んでください");
    }
  }

  async #applyImagePlacement(file: File): Promise<void> {
    if (this.#imageImporting) return;
    const layerId = this.#snapshot?.selection.layerId;
    const layer = this.#selectedIntentLayer();
    if (!layerId || layer?.authoringMode !== "manual") {
      this.#showEditorMessage("warning", "手動レイヤーを選んでください");
      return;
    }
    if (layer.locked) {
      this.#showEditorMessage("warning", "レイヤーのロックを解除してください");
      return;
    }

    const section = { ...this.#section };
    const restoreFocus = this.element.querySelector<HTMLElement>(
      "[data-action='import-image-placement']",
    );
    this.#imageImporting = true;
    this.#render();
    try {
      const dialogResult: GuidedImagePlacementDialogResult | undefined =
        await this.#openGuidedImagePlacementDialog(file, {
          applyMode: this.#templateApplyMode,
          enhanceDarkColors: this.#imageEnhanceDarkColors,
          imageStarKind: this.#imageStarKind,
          outlineStarId: this.#imageOutlineStarId ?? layer.defaultStarId,
          placementMode: this.#imagePlacementMode,
          restoreFocus: restoreFocus ?? undefined,
          starDefinitions: this.#snapshot?.intentDraft.starDefinitions,
          targetCount: this.#imageTargetCount,
        });
      if (!dialogResult) return;
      this.#imageEnhanceDarkColors = dialogResult.settings.enhanceDarkColors;
      this.#imageStarKind = dialogResult.settings.imageStarKind;
      this.#imageOutlineStarId = dialogResult.settings.outlineStarId;
      this.#imagePlacementMode = dialogResult.settings.placementMode;
      this.#imageTargetCount = dialogResult.settings.targetCount;
      this.#templateApplyMode = dialogResult.settings.applyMode;
      if (
        dialogResult.placement.points.length < IMAGE_PLACEMENT_MINIMUM_POINTS
      ) {
        this.#showEditorMessage(
          "warning",
          "画像から被写体を検出できませんでした",
        );
        return;
      }
      let result: ApplyImagePlacementResult | undefined;
      this.#controller.document.updateIntent("画像から配置", (draft) => {
        result = applyImagePlacementToDraft(draft, dialogResult.placement, {
          applyMode: dialogResult.settings.applyMode,
          layerId,
          section,
        });
      });
      if (result?.status === "locked") {
        this.#showEditorMessage(
          "warning",
          "レイヤーのロックを解除してください",
        );
      } else if (result?.status !== "applied") {
        this.#showEditorMessage("warning", "手動レイヤーを選んでください");
      } else {
        this.#selectedPointIndex = undefined;
        this.#showEditorMessage(
          "status",
          `画像から${result.appliedPointCount}点を配置しました`,
        );
      }
    } catch {
      this.#showEditorMessage("warning", "画像の読み込みに失敗しました");
    } finally {
      this.#imageImporting = false;
      this.#render();
      window.setTimeout(() =>
        this.element
          .querySelector<HTMLElement>("[data-action='import-image-placement']")
          ?.focus(),
      );
    }
  }

  #changeManualPlacementSetting(name: string, value: string): void {
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    if (name === "manual-count") this.#manualPlacementSettings.count = number;
    else if (name === "manual-radius")
      this.#manualPlacementSettings.radius = number / 100;
    else if (name === "manual-rotation")
      this.#manualPlacementSettings.rotationDegrees = number;
    else if (name === "manual-length")
      this.#manualPlacementSettings.length = number / 100;
    else if (name === "manual-angle")
      this.#manualPlacementSettings.angleDegrees = number;
    else if (name === "manual-start-angle")
      this.#manualPlacementSettings.startAngleDegrees = number;
    else if (name === "manual-end-angle")
      this.#manualPlacementSettings.endAngleDegrees = number;
    else if (name === "manual-rows")
      this.#manualPlacementSettings.rows = number;
    else if (name === "manual-columns")
      this.#manualPlacementSettings.columns = number;
    else if (name === "manual-spacing")
      this.#manualPlacementSettings.spacing = number / 100;
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
      else this.#showEditorMessage("warning", "手動レイヤーを選んでください");
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

  #changeSelectedLayer(name: string, value: string, stageValue?: string): void {
    const layerId = this.#snapshot?.selection.layerId;
    if (!layerId) return;
    if (name.startsWith("star-effect-")) {
      this.#controller.document.completeSelectionGuidance();
      this.#changeSelectedStarEffect(layerId, name, value, stageValue);
      return;
    }
    if (name === "layer-star") {
      this.#controller.document.selectStarDefinition(value);
    } else {
      this.#controller.document.completeSelectionGuidance();
    }
    this.#updateIntentLayer(layerId, "配置属性を変更", (layer) => {
      if (name === "layer-name") layer.name = value;
      else if (name === "layer-star") layer.defaultStarId = value;
      else if (
        name === "effect-mapping" ||
        name === "effect-direction" ||
        name === "effect-spread" ||
        name === "effect-cycles"
      ) {
        const timing = (layer.effectTiming ??= {
          cycles: 1,
          direction: "forward",
          mapping: "none",
          offset: 0,
          spread: 1,
        });
        if (name === "effect-mapping") {
          timing.mapping = value as typeof timing.mapping;
        } else if (name === "effect-direction") {
          timing.direction = value === "reverse" ? "reverse" : "forward";
        } else if (name === "effect-spread") {
          timing.spread = Number(value) / 100;
        } else {
          timing.cycles = Number(value);
        }
      } else if (
        name === "point-effect-phase" &&
        layer.authoringMode === "manual" &&
        this.#selectedPointIndex !== undefined
      ) {
        const point = layer.points[this.#selectedPointIndex];
        if (point) point.effectPhase = Number(value) / 100;
      } else if (layer.authoringMode === "preset") {
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
      } else if (layer.authoringMode === "pattern") {
        if (name === "pattern-scale") {
          layer.pattern.scale = Math.min(
            Number(value) / 100,
            patternScaleLimit(layer.pattern.section, layer.pattern.template),
          );
        } else if (name === "pattern-density") {
          layer.pattern.density = Number(value);
        } else if (name === "pattern-rotation") {
          layer.pattern.rotationDegrees = Number(value);
        }
      }
    });
  }

  #duplicateSelectedStar(): void {
    const layerId = this.#snapshot?.selection.layerId;
    const intent = this.#snapshot?.intentDraft;
    const layer = intent?.layers.find((candidate) => candidate.id === layerId);
    const sourceId = layer?.defaultStarId;
    if (!layerId || !sourceId || !intent?.starDefinitions[sourceId]) return;
    const id = `${sourceId}-copy-${Object.keys(intent.starDefinitions).length}`;
    this.#controller.document.updateIntent("仮想星を作品内へ複製", (draft) => {
      const targetLayer = draft.layers.find(
        (candidate) => candidate.id === layerId,
      );
      const source = draft.starDefinitions[sourceId];
      if (!targetLayer || !source) return;
      draft.starDefinitions[id] = {
        ...structuredClone(source),
        displayName: `${source.displayName} 複製`,
        id,
      };
      targetLayer.defaultStarId = id;
    });
    this.#showEditorMessage("status", "仮想星を作品内へ複製しました");
  }

  #changeSelectedStarEffect(
    layerId: string,
    name: string,
    value: string,
    stageValue?: string,
  ): void {
    this.#controller.document.updateIntent("仮想星の効果を変更", (draft) => {
      const layer = draft.layers.find((candidate) => candidate.id === layerId);
      const star = layer
        ? draft.starDefinitions[layer.defaultStarId]
        : undefined;
      if (!star) return;
      if (name === "star-effect-name") {
        star.displayName = value;
        return;
      }
      if (name === "star-effect-stage-color" && stageValue !== undefined) {
        const stage = star.colorStages[Number(stageValue)];
        const color = Number.parseInt(value.replace("#", ""), 16);
        if (stage && Number.isFinite(color)) {
          stage.color = color;
          stage.trailColor = color;
        }
        return;
      }
      const profile = (star.effectProfile ??= {});
      if (
        name === "star-effect-color-mode" ||
        name === "star-effect-color-playback" ||
        name === "star-effect-color-repeat"
      ) {
        const color = (profile.color ??= {
          mode: "smooth",
          playback: "once",
          repeatCount: 1,
        });
        if (name === "star-effect-color-mode") {
          color.mode = value === "step" ? "step" : "smooth";
        } else if (name === "star-effect-color-playback") {
          color.playback =
            value === "loop" || value === "pingPong" ? value : "once";
        } else {
          color.repeatCount = Number(value);
        }
      } else if (
        name === "star-effect-light-mode" ||
        name === "star-effect-light-frequency" ||
        name === "star-effect-light-duty" ||
        name === "star-effect-terminal-mode"
      ) {
        const light = (profile.light ??= {
          dutyCycle: 0.5,
          edgeSoftness: 0.06,
          frequencyHz: 6,
          mode: "continuous",
        });
        if (name === "star-effect-light-mode") {
          light.mode = value === "strobe" ? "strobe" : "continuous";
        } else if (name === "star-effect-light-frequency") {
          light.frequencyHz = Number(value) / 10;
        } else if (name === "star-effect-light-duty") {
          light.dutyCycle = Number(value) / 100;
        } else {
          const mode = value === "kouro" || value === "teka" ? value : "none";
          light.terminal = {
            duration: mode === "teka" ? 0.07 : 0.14,
            mode,
            sparkleCount: mode === "none" ? 0 : mode === "teka" ? 5 : 3,
            strength: mode === "teka" ? 2.4 : 1.2,
          };
        }
      } else if (
        name === "star-effect-motion-mode" ||
        name === "star-effect-motion-amplitude"
      ) {
        const motion = (profile.motion ??= {
          amplitude: 0.35,
          frequencyHz: 1,
          mode: "ballistic",
        });
        if (name === "star-effect-motion-mode") {
          motion.mode = ["fallingLeaf", "wander", "spiral"].includes(value)
            ? (value as "fallingLeaf" | "wander" | "spiral")
            : "ballistic";
        } else {
          motion.amplitude = Number(value) / 100;
        }
      } else if (
        name === "star-effect-secondary-mode" ||
        name === "star-effect-secondary-count"
      ) {
        const secondary = (profile.secondary ??= {
          count: 0,
          mode: "none",
          speedScale: 1,
          triggerTime: 0.88,
        });
        if (name === "star-effect-secondary-mode") {
          secondary.mode =
            value === "spark" || value === "microBurst" ? value : "none";
        } else {
          secondary.count = Number(value);
        }
      } else if (
        name === "star-effect-trail-mode" ||
        name === "star-effect-trail-frequency" ||
        name === "star-effect-trail-grain"
      ) {
        const trail = (profile.trail ??= {
          dutyCycle: 0.5,
          frequencyHz: 6,
          grainSpacing: 2,
          mode: "continuous",
        });
        if (name === "star-effect-trail-mode") {
          trail.mode =
            value === "strobe" || value === "granular" ? value : "continuous";
        } else if (name === "star-effect-trail-frequency") {
          trail.frequencyHz = Number(value) / 10;
        } else {
          trail.grainSpacing = Number(value);
        }
      } else if (name === "star-effect-trail-width") {
        star.trailWidth = Number(value) / 100;
      } else if (name === "star-effect-smoke") {
        star.smokeAmount = Number(value) / 100;
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
    this.#showEditorMessage("status", "層構成を保ったまま星数を簡略化しました");
  }

  #save(toLibrary: boolean): void {
    const snapshot = this.#snapshot;
    if (!snapshot) return;
    if (snapshot.diagnostic.estimatedCost.maximumParticles > 6_000) {
      this.#showEditorMessage(
        "warning",
        "実行上限を超えています。先に自動簡略化してください",
      );
      return;
    }
    const saved = this.#controller.save();
    this.#callbacks.onDesignLibraryChange(this.#controller.savedDesigns);
    if (toLibrary) this.#callbacks.onSaveToLibrary(saved);
    else this.#showEditorMessage("status", `「${saved.name}」を保存しました`);
  }
}
