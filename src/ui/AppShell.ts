import {
  AppFlowController,
  appScreenKind,
  type AppScreen,
} from "../app/AppFlowController";
import type { FireworkDesign } from "../data";
import type { SingleLoopCheckState } from "../modes/check";
import type { CraftController } from "../modes/craft";
import {
  HOME_FREE_VIEW_PRESET_ID,
  type FreeShowState,
  type FreeViewPresetId,
} from "../modes/viewFree";
import { IntegratedCraftEditor } from "./craft/IntegratedCraftEditor";
import { FireworkShelfScreen } from "./screens/FireworkShelfScreen";
import { InitialSetupScreen } from "./screens/InitialSetupScreen";
import { ModeSelectionScreen } from "./screens/ModeSelectionScreen";
import { ViewingStage, type ViewerContext } from "./viewer";

export type AppMode = "craft" | "free";

export interface AppShellCallbacks {
  onAudioPhysicality: (value: number) => void;
  onCheckLoopChange?: (enabled: boolean) => void;
  onCheckToggle?: () => void;
  onDesignLibraryChange: (designs: FireworkDesign[]) => void;
  onFreeDensityChange?: (value: number) => void;
  onFreeToggle?: () => void;
  onFreeViewPresetChange?: (presetId: FreeViewPresetId) => void;
  onFreeViewReset?: () => void;
  onViewerContextChange: (
    context: ViewerContext | undefined,
    design?: FireworkDesign,
  ) => void;
}

interface MountedScreen {
  destroy: () => void;
  element: HTMLElement;
}

export class AppShell {
  readonly element = document.createElement("div");
  readonly #callbacks: AppShellCallbacks;
  readonly #controller: CraftController;
  readonly #flow: AppFlowController;
  readonly #unsubscribeDocument: () => void;
  readonly #unsubscribeFlow: () => void;
  #activeViewerContext?: ViewerContext;
  #checkState: SingleLoopCheckState = {
    active: false,
    designName: "編集中の花火",
    loopEnabled: true,
    running: true,
    secondsUntilLaunch: 0,
    shotCount: 0,
  };
  #freeDensity = 1;
  #freeState: FreeShowState = {
    detail: "演目を準備しています",
    running: true,
    title: "湖畔の序章",
  };
  #freeViewPresetId = HOME_FREE_VIEW_PRESET_ID;
  #screenMount?: MountedScreen;
  #toastTimer = 0;
  #viewingStage?: ViewingStage;

  constructor(controller: CraftController, callbacks: AppShellCallbacks) {
    this.#callbacks = callbacks;
    this.#controller = controller;
    this.#flow = new AppFlowController({
      confirmDiscard: () =>
        window.confirm("保存していない変更があります。花火棚へ戻りますか？"),
    });
    this.element.className = "app-shell renewal-app-shell";
    this.element.innerHTML = `
      <div class="renewal-screen-host" data-screen-host></div>
      <div class="toast" role="status" aria-live="polite" data-toast></div>`;
    this.element.addEventListener("click", this.#handleClick);
    this.element.addEventListener("input", this.#handleInput);
    window.addEventListener("beforeunload", this.#handleBeforeUnload);
    this.#unsubscribeDocument = controller.document.subscribe((snapshot) => {
      this.#flow.setEditorDirty(snapshot.dirty);
    });
    this.#unsubscribeFlow = this.#flow.subscribe(this.#renderScreen);

    if (controller.migrationWarning) {
      window.setTimeout(() =>
        this.showToast(controller.migrationWarning ?? ""),
      );
    }
  }

  get mode(): AppMode {
    return this.#activeViewerContext === "free" ? "free" : "craft";
  }

  setCheckState(state: SingleLoopCheckState): void {
    this.#checkState = state;
    this.#viewingStage?.setCheckState(state);
  }

  setFreeState(state: FreeShowState): void {
    this.#freeState = state;
    this.#viewingStage?.setFreeState(state);
  }

  setFreeViewPreset(presetId: FreeViewPresetId): void {
    this.#freeViewPresetId = presetId;
    this.#viewingStage?.setFreeViewPreset(presetId);
  }

  showToast(message: string): void {
    if (!message) return;
    const toast = this.#query<HTMLElement>("[data-toast]");
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(this.#toastTimer);
    this.#toastTimer = window.setTimeout(
      () => toast.classList.remove("is-visible"),
      2_600,
    );
  }

  destroy(): void {
    window.clearTimeout(this.#toastTimer);
    window.removeEventListener("beforeunload", this.#handleBeforeUnload);
    this.#unsubscribeFlow();
    this.#unsubscribeDocument();
    this.#screenMount?.destroy();
    this.element.removeEventListener("click", this.#handleClick);
    this.element.removeEventListener("input", this.#handleInput);
    this.element.remove();
  }

  readonly #renderScreen = (screen: AppScreen): void => {
    this.#screenMount?.destroy();
    this.#screenMount = undefined;

    const mount = this.#createScreen(screen);
    this.#query<HTMLElement>("[data-screen-host]").replaceChildren(
      mount.element,
    );
    this.#screenMount = mount;
    this.element.dataset.screen = appScreenKind(screen);

    const viewerContext = screen.kind === "viewer" ? screen.context : undefined;
    if (viewerContext !== this.#activeViewerContext) {
      this.#activeViewerContext = viewerContext;
      this.#callbacks.onViewerContextChange(
        viewerContext,
        viewerContext === "check" ? this.#controller.draft : undefined,
      );
    }

    window.setTimeout(() => {
      mount.element
        .querySelector<HTMLElement>("[autofocus], button, input, select")
        ?.focus();
    });
  };

  #createScreen(screen: AppScreen): MountedScreen {
    if (screen.kind === "mode-select") {
      return new ModeSelectionScreen({
        onChooseCraft: () => this.#flow.navigate("choose-craft"),
        onChooseFree: () => this.#flow.navigate("choose-free"),
      });
    }
    if (screen.kind === "library") {
      return new FireworkShelfScreen(
        this.#controller.savedDesigns,
        screen.selectedDesignId,
        {
          onBack: () => this.#flow.back(),
          onCreate: () => this.#flow.navigate("create-design"),
          onDelete: (designId) => {
            const removed = this.#controller.remove(designId);
            if (removed) {
              this.#callbacks.onDesignLibraryChange(
                this.#controller.savedDesigns,
              );
              this.showToast("作品を花火棚から削除しました");
            }
            return removed;
          },
          onEdit: (designId) =>
            this.#flow.navigate("edit-design", {
              designId,
              origin: "saved",
            }),
        },
      );
    }
    if (screen.kind === "initial-setup") {
      return new InitialSetupScreen(screen, {
        onBack: () => this.#flow.back(),
        onBegin: (draft) => {
          this.#controller.startNewDraft(draft.sizeClass, draft.template);
          this.#flow.navigate("begin-editing", {
            designId: this.#controller.draft.id,
            origin: "new",
          });
        },
      });
    }
    if (screen.kind === "editor") return this.#createEditorScreen(screen);
    return this.#createViewerScreen(screen.context);
  }

  #createEditorScreen(
    screen: Extract<AppScreen, { kind: "editor" }>,
  ): MountedScreen {
    if (
      screen.designId !== this.#controller.draft.id &&
      screen.designId.startsWith("custom-")
    ) {
      this.#controller.load(screen.designId);
    }
    const element = document.createElement("section");
    element.className = "renewal-editor-screen";
    element.innerHTML = `
      <header class="app-header renewal-editor-header">
        <div class="brand-block">
          <p class="brand-block__eyebrow">VIRTUAL FIREWORK ATELIER</p>
          <h1>星見<span>煙火店</span></h1>
        </div>
        <button class="renewal-back renewal-back--center" type="button" data-shell-action="back">← 花火棚へ戻る</button>
        <div class="header-status">
          <div class="sound-control">
            <label for="sound-delay">音の距離感</label>
            <input id="sound-delay" name="sound-delay" type="range" min="0" max="100" value="100" />
            <output for="sound-delay">実距離</output>
          </div>
          <p><span>仮想花火</span> 実物の材料・配合・製造条件は扱いません</p>
        </div>
      </header>
      <div class="craft-host" data-editor-host></div>`;
    const workspace = new IntegratedCraftEditor(this.#controller, {
      onCheck: () => this.#flow.navigate("check-on-lake"),
      onDesignLibraryChange: this.#callbacks.onDesignLibraryChange,
      onSaveToLibrary: (design) =>
        this.#flow.navigate("save-to-library", { designId: design.id }),
      onToast: (message) => this.showToast(message),
    });
    const host = element.querySelector<HTMLElement>("[data-editor-host]");
    if (!host) throw new Error("Editor host was not found.");
    host.append(workspace.element);
    return {
      element,
      destroy: () => {
        workspace.destroy();
        element.remove();
      },
    };
  }

  #createViewerScreen(context: ViewerContext): MountedScreen {
    const stage = new ViewingStage({
      callbacks: {
        onAudioPhysicality: this.#callbacks.onAudioPhysicality,
        onBack: () => this.#flow.back(),
        onCheckLoopChange: (enabled) =>
          this.#callbacks.onCheckLoopChange?.(enabled),
        onCheckToggle: () => this.#callbacks.onCheckToggle?.(),
        onFreeDensityChange: (value) => {
          this.#freeDensity = value;
          this.#callbacks.onFreeDensityChange?.(value);
        },
        onFreeToggle: () => this.#callbacks.onFreeToggle?.(),
        onFreeViewPresetChange: (presetId) => {
          this.#freeViewPresetId = presetId;
          this.#callbacks.onFreeViewPresetChange?.(presetId);
        },
        onFreeViewReset: () => {
          this.setFreeViewPreset(HOME_FREE_VIEW_PRESET_ID);
          this.#callbacks.onFreeViewReset?.();
        },
        onToast: (message) => this.showToast(message),
      },
      checkState:
        context === "check"
          ? { ...this.#checkState, designName: this.#controller.draft.name }
          : this.#checkState,
      context,
      freeDensity: this.#freeDensity,
      freeState: this.#freeState,
      freeViewPresetId: this.#freeViewPresetId,
    });
    this.#viewingStage = stage;
    return {
      element: stage.element,
      destroy: () => {
        if (this.#viewingStage === stage) this.#viewingStage = undefined;
        stage.destroy();
      },
    };
  }

  readonly #handleClick = (event: Event): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-shell-action]",
    );
    if (!button) return;
    if (button.dataset.shellAction === "back") this.#flow.back();
  };

  readonly #handleInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    if (input.name === "sound-delay") {
      const value = Number(input.value) / 100;
      this.#callbacks.onAudioPhysicality(value);
      const output = input
        .closest<HTMLElement>(".sound-control")
        ?.querySelector<HTMLOutputElement>("output");
      if (output) {
        output.value =
          value > 0.8 ? "実距離" : value > 0.25 ? "演出寄り" : "即時";
      }
    }
  };

  readonly #handleBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (!this.#flow.hasUnsavedEditorChanges) return;
    event.preventDefault();
    event.returnValue = "";
  };

  #query<T extends Element>(selector: string): T {
    const element = this.element.querySelector<T>(selector);
    if (!element) throw new Error(`UI element not found: ${selector}`);
    return element;
  }
}
