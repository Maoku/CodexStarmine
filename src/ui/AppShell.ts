import {
  AppFlowController,
  appScreenKind,
  type AppScreen,
} from "../app/AppFlowController";
import type { FireworkDesign } from "../data";
import type { CraftController } from "../modes/craft";
import {
  FREE_VIEW_PRESET_IDS,
  FREE_VIEW_PRESETS,
  HOME_FREE_VIEW_PRESET_ID,
  isFreeViewPresetId,
  type FreeViewPresetId,
} from "../modes/viewFree";
import { IntegratedCraftEditor } from "./craft/IntegratedCraftEditor";
import { FireworkShelfScreen } from "./screens/FireworkShelfScreen";
import { InitialSetupScreen } from "./screens/InitialSetupScreen";
import { ModeSelectionScreen } from "./screens/ModeSelectionScreen";

export type AppMode = "craft" | "free";

export interface AppShellCallbacks {
  onAudioPhysicality: (value: number) => void;
  onDesignLibraryChange: (designs: FireworkDesign[]) => void;
  onFreeDensityChange?: (value: number) => void;
  onFreeToggle?: () => void;
  onFreeViewPresetChange?: (presetId: FreeViewPresetId) => void;
  onFreeViewReset?: () => void;
  onLaunch: (design: FireworkDesign) => void;
  onModeChange: (mode: AppMode) => void;
}

interface MountedScreen {
  destroy: () => void;
  element: HTMLElement;
}

interface FreeViewerState {
  detail: string;
  running: boolean;
  title: string;
}

export class AppShell {
  readonly element = document.createElement("div");
  readonly #callbacks: AppShellCallbacks;
  readonly #controller: CraftController;
  readonly #flow: AppFlowController;
  readonly #unsubscribeDocument: () => void;
  readonly #unsubscribeFlow: () => void;
  #freeState: FreeViewerState = {
    detail: "演目を準備しています",
    running: true,
    title: "湖畔の序章",
  };
  #freeViewPresetId = HOME_FREE_VIEW_PRESET_ID;
  #screenMount?: MountedScreen;
  #toastTimer = 0;
  #viewerFreeActive = false;

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
    this.element.addEventListener("change", this.#handleChange);
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
    return this.#viewerFreeActive ? "free" : "craft";
  }

  setFreeState(running: boolean, title: string, detail: string): void {
    this.#freeState = { detail, running, title };
    const button = this.#queryOptional<HTMLButtonElement>(
      "[data-action='free-toggle']",
    );
    if (button) button.textContent = running ? "一時停止" : "演目を再開";
    const titleElement = this.#queryOptional<HTMLElement>("[data-show-title]");
    if (titleElement) titleElement.textContent = title;
    const detailElement = this.#queryOptional<HTMLElement>(
      "[data-show-progress]",
    );
    if (detailElement) detailElement.textContent = detail;
    this.element.classList.toggle("is-show-paused", !running);
  }

  setFreeViewPreset(presetId: FreeViewPresetId): void {
    this.#freeViewPresetId = presetId;
    const select = this.#queryOptional<HTMLSelectElement>(
      "[name='free-view-preset']",
    );
    if (select) select.value = presetId;
    const label = this.#queryOptional<HTMLElement>("[data-view-label]");
    if (label) label.textContent = FREE_VIEW_PRESETS[presetId].label;
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
    this.element.removeEventListener("change", this.#handleChange);
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

    const viewerFreeActive =
      screen.kind === "viewer" && screen.context === "free";
    if (viewerFreeActive !== this.#viewerFreeActive) {
      this.#viewerFreeActive = viewerFreeActive;
      this.#callbacks.onModeChange(viewerFreeActive ? "free" : "craft");
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
    if (screen.context === "free") return this.#createFreeViewerScreen();
    return this.#createPendingScreen(
      "湖面で確認",
      "編集中の一発だけを繰り返し確認する湖面画面を準備しています。",
    );
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

  #createFreeViewerScreen(): MountedScreen {
    const element = document.createElement("section");
    const viewPresetOptions = FREE_VIEW_PRESET_IDS.map(
      (presetId) =>
        `<option value="${presetId}">${FREE_VIEW_PRESETS[presetId].label}</option>`,
    ).join("");
    element.className = "renewal-viewer-screen";
    element.setAttribute("aria-labelledby", "free-view-heading-title");
    element.innerHTML = `
      <header class="renewal-viewer-toolbar">
        <button class="renewal-back" type="button" data-shell-action="back">← モード選択</button>
        <div class="brand-block">
          <p class="brand-block__eyebrow">VIRTUAL FIREWORK ATELIER</p>
          <h1>星見<span>煙火店</span></h1>
        </div>
        <div class="sound-control">
          <label for="viewer-sound-delay">音の距離感</label>
          <input id="viewer-sound-delay" name="sound-delay" type="range" min="0" max="100" value="100" />
          <output for="viewer-sound-delay">実距離</output>
        </div>
      </header>
      <aside class="control-panel free-panel" aria-label="フリー鑑賞パネル">
        <div class="panel-heading">
          <div><p class="panel-heading__step">VIEW / FREE</p><h2 id="free-view-heading-title">湖畔に委ねる</h2></div>
          <span class="live-indicator"><i></i> LIVE</span>
        </div>
        <div class="free-copy">
          <p>小さな一発から始まり、左右へ広がり、間を置いて大玉で締める。煙と余韻を読みながら、自動で演目を紡ぎます。</p>
          <div class="show-template"><span>導入</span><i></i><span>展開</span><i></i><span>静寂</span><i></i><span>終幕</span></div>
        </div>
        <label class="field range-field density-control">
          <span>演出密度 <output data-output="free-density">標準</output></span>
          <input name="free-density" type="range" min="0" max="2" step="1" value="1" />
        </label>
        <section class="free-view-control" aria-labelledby="free-view-heading">
          <div class="free-view-heading"><span id="free-view-heading">視点を動かす</span><b>FREE CAMERA</b></div>
          <div class="free-view-row">
            <label class="free-view-select">
              <span>プリセット視点</span>
              <select name="free-view-preset">${viewPresetOptions}</select>
            </label>
            <button class="secondary-action free-view-reset" type="button" data-action="free-view-reset">元の位置に戻る</button>
          </div>
          <p>ドラッグ／1本指で見回す · 右ドラッグ／2本指で移動 · ホイール／ピンチで接近</p>
          <p class="free-view-keys"><kbd>WASD / 矢印</kbd> 前後左右 · <kbd>Q / E</kbd> 上下 · <kbd>Shift</kbd> 高速</p>
        </section>
        <div class="show-now"><p>NOW PLAYING</p><strong data-show-title>${this.#freeState.title}</strong><span data-show-progress>${this.#freeState.detail}</span></div>
        <button class="primary-action free-toggle" type="button" data-action="free-toggle">${this.#freeState.running ? "一時停止" : "演目を再開"}</button>
      </aside>
      <div class="scene-caption" aria-live="polite"><span>WIND</span><strong>東 1.3 m/s</strong><i></i><span>VIEW</span><strong data-view-label>${FREE_VIEW_PRESETS[this.#freeViewPresetId].label}</strong></div>`;
    const select = element.querySelector<HTMLSelectElement>(
      "[name='free-view-preset']",
    );
    if (select) select.value = this.#freeViewPresetId;
    return {
      element,
      destroy: () => element.remove(),
    };
  }

  #createPendingScreen(title: string, detail: string): MountedScreen {
    const element = document.createElement("section");
    element.className = "renewal-screen renewal-pending-screen";
    element.innerHTML = `
      <header class="renewal-brand renewal-brand--toolbar">
        <button class="renewal-back" type="button" data-shell-action="back">← 戻る</button>
        <div class="brand-block"><p class="brand-block__eyebrow">VIRTUAL FIREWORK ATELIER</p><h1>星見<span>煙火店</span></h1></div>
        <span></span>
      </header>
      <main><p class="renewal-kicker">WORK IN PROGRESS</p><h2>${title}</h2><p>${detail}</p><button class="primary-action" type="button" data-shell-action="back">前の画面へ戻る</button></main>`;
    return {
      element,
      destroy: () => element.remove(),
    };
  }

  readonly #handleClick = (event: Event): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-shell-action], button[data-action='free-toggle'], button[data-action='free-view-reset']",
    );
    if (!button) return;
    if (button.dataset.shellAction === "back") {
      this.#flow.back();
    } else if (button.dataset.action === "free-toggle") {
      this.#callbacks.onFreeToggle?.();
    } else if (button.dataset.action === "free-view-reset") {
      this.setFreeViewPreset(HOME_FREE_VIEW_PRESET_ID);
      this.#callbacks.onFreeViewReset?.();
      this.showToast("視点を湖畔固定席へ戻しました");
    }
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
    } else if (input.name === "free-density") {
      const value = Number(input.value);
      this.#callbacks.onFreeDensityChange?.(value);
      const output = this.#queryOptional<HTMLOutputElement>(
        "[data-output='free-density']",
      );
      if (output) output.value = ["静か", "標準", "華やか"][value] ?? "標準";
    }
  };

  readonly #handleChange = (event: Event): void => {
    const select = event.target as HTMLSelectElement;
    if (
      select.name !== "free-view-preset" ||
      !isFreeViewPresetId(select.value)
    ) {
      return;
    }
    this.setFreeViewPreset(select.value);
    this.#callbacks.onFreeViewPresetChange?.(select.value);
    this.showToast(
      `視点を「${FREE_VIEW_PRESETS[select.value].label}」へ移動しました`,
    );
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

  #queryOptional<T extends Element>(selector: string): T | null {
    return this.element.querySelector<T>(selector);
  }
}
