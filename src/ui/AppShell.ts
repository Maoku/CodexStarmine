import {
  AppFlowController,
  appScreenKind,
  type AppScreen,
} from "../app/AppFlowController";
import { RENEWAL2_BACKGROUND_RUNTIME_BY_SCREEN } from "../app/renewalContracts";
import type { BackgroundRuntime } from "../app/renewalContracts";
import type { AnyFireworkDesign, FireworkDesign } from "../data";
import type { SingleLoopCheckState } from "../modes/check";
import type { CraftController } from "../modes/craft";
import {
  HOME_FREE_VIEW_PRESET_ID,
  type FreeShowState,
  type FreeViewPresetId,
} from "../modes/viewFree";
import { IntegratedCraftEditor } from "./craft/IntegratedCraftEditor";
import { escapeHTML } from "./craft/viewUtils";
import {
  FireworkShelfScreen,
  type FireworkShelfLibraryState,
} from "./screens/FireworkShelfScreen";
import { InitialSetupScreen } from "./screens/InitialSetupScreen";
import { ModeSelectionScreen } from "./screens/ModeSelectionScreen";
import { ViewingStage, type ViewerContext } from "./viewer";
import { I18n, type Locale } from "../i18n";
import { installDOMLocalizer, localizeDOM } from "../i18n/dom";

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
  onBackgroundRuntimeChange: (
    runtime: BackgroundRuntime,
    design?: AnyFireworkDesign,
  ) => void;
}

interface MountedScreen {
  destroy: () => void;
  element: HTMLElement;
}

export function renderEditorHeader(
  name: string,
  sizeClass: FireworkDesign["sizeClass"],
  locale: Locale = "ja",
): string {
  if (locale === "en") {
    return `<header class="app-header renewal-editor-header" data-editor-header>
      <button class="renewal-back" type="button" data-shell-action="back">← Back to firework shelf</button>
      <div class="editor-work-header" aria-label="Work being edited">
        <label><span>Work name</span><input name="editor-design-name" type="text" maxlength="32" value="${escapeHTML(name)}" /></label>
        <label><span>Shell size</span><select name="editor-size"><option value="small" ${sizeClass === "small" ? "selected" : ""}>Small</option><option value="medium" ${sizeClass === "medium" ? "selected" : ""}>Medium</option><option value="large" ${sizeClass === "large" ? "selected" : ""}>Large</option></select></label>
      </div>
    </header>`;
  }
  return `<header class="app-header renewal-editor-header" data-editor-header>
    <button class="renewal-back" type="button" data-shell-action="back">← 花火棚へ戻る</button>
    <div class="editor-work-header" aria-label="編集中の作品">
      <label><span>作品名</span><input name="editor-design-name" type="text" maxlength="32" value="${escapeHTML(name)}" /></label>
      <label><span>玉の大きさ</span><select name="editor-size"><option value="small" ${sizeClass === "small" ? "selected" : ""}>小玉</option><option value="medium" ${sizeClass === "medium" ? "selected" : ""}>中玉</option><option value="large" ${sizeClass === "large" ? "selected" : ""}>大玉</option></select></label>
    </div>
  </header>`;
}

export class AppShell {
  readonly element = document.createElement("div");
  readonly #callbacks: AppShellCallbacks;
  readonly #controller: CraftController;
  readonly #flow: AppFlowController;
  readonly #i18n: I18n;
  readonly #unsubscribeDocument: () => void;
  readonly #unsubscribeFlow: () => void;
  readonly #stopDOMLocalizer: () => void;
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
    currentFireworkName: undefined,
    detail: "演目を準備しています",
    running: true,
    title: "湖畔の序章",
  };
  #freeViewPresetId = HOME_FREE_VIEW_PRESET_ID;
  #screenMount?: MountedScreen;
  #toastTimer = 0;
  #viewingStage?: ViewingStage;

  constructor(
    controller: CraftController,
    callbacks: AppShellCallbacks,
    locale: Locale = "ja",
  ) {
    this.#callbacks = callbacks;
    this.#controller = controller;
    this.#i18n = new I18n(locale);
    this.#i18n.setLocale(locale);
    this.#flow = new AppFlowController({
      confirmDiscard: () =>
        window.confirm(
          locale === "en"
            ? "You have unsaved changes. Return to the firework shelf?"
            : "保存していない変更があります。花火棚へ戻りますか？",
        ),
    });
    this.element.className = "app-shell renewal-app-shell";
    this.element.innerHTML = `
      <div class="app-language-switcher" role="group" aria-label="Language" data-i18n-skip>
        <button type="button" data-locale="ja" aria-pressed="${locale === "ja"}">日本語</button>
        <button type="button" data-locale="en" aria-pressed="${locale === "en"}">English</button>
      </div>
      <div class="renewal-screen-host" data-screen-host></div>
      <div class="toast" role="status" aria-live="polite" data-toast></div>`;
    this.element.addEventListener("click", this.#handleClick);
    this.element.addEventListener("input", this.#handleInput);
    window.addEventListener("beforeunload", this.#handleBeforeUnload);
    this.#unsubscribeDocument = controller.document.subscribe((snapshot) => {
      this.#flow.setEditorDirty(snapshot.dirty);
      this.#syncEditorHeader(snapshot.draft.name, snapshot.draft.sizeClass);
    });
    this.#unsubscribeFlow = this.#flow.subscribe(this.#renderScreen);
    this.#stopDOMLocalizer = installDOMLocalizer(
      document.body,
      () => this.#i18n.locale,
    );

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
    this.#stopDOMLocalizer();
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
    this.#activeViewerContext = viewerContext;
    this.#callbacks.onBackgroundRuntimeChange(
      RENEWAL2_BACKGROUND_RUNTIME_BY_SCREEN[appScreenKind(screen)],
      viewerContext === "check" ? this.#controller.intentDraft : undefined,
    );

    window.setTimeout(() => {
      mount.element
        .querySelector<HTMLElement>("[autofocus], button, input, select")
        ?.focus();
    });
  };

  #createScreen(screen: AppScreen): MountedScreen {
    if (screen.kind === "mode-select") {
      return new ModeSelectionScreen(
        {
          onChooseCraft: () => this.#flow.navigate("choose-craft"),
          onChooseFree: () => this.#flow.navigate("choose-free"),
        },
        this.#i18n.locale,
      );
    }
    if (screen.kind === "library") {
      const library = this.#controller.shelfLibrary;
      const libraryState = (message: string): FireworkShelfLibraryState => {
        const next = this.#controller.shelfLibrary;
        return { ...next, message };
      };
      return new FireworkShelfScreen(
        library.designs,
        screen.selectedDesignId,
        {
          onBack: () => this.#flow.back(),
          onClear: () => {
            const cleared = this.#controller.clearSavedDesigns();
            this.#callbacks.onDesignLibraryChange(
              this.#controller.savedDesigns,
            );
            return libraryState(
              this.#i18n.locale === "en"
                ? `Cleared ${cleared} local work${cleared === 1 ? "" : "s"}.`
                : `ローカル保存作品 ${cleared} 件を消去しました。`,
            );
          },
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
          onExport: () => this.#controller.exportLibraryJSON(),
          onImport: (raw, replaceConflicts) => {
            const result = this.#controller.importLibraryJSON(
              raw,
              replaceConflicts,
            );
            this.#callbacks.onDesignLibraryChange(
              this.#controller.savedDesigns,
            );
            return libraryState(
              this.#i18n.locale === "en"
                ? `Imported JSON. Added ${result.added}, replaced ${result.replaced}, skipped ${result.skipped} duplicates.`
                : `JSONを読み込みました。新規 ${result.added} 件、置換 ${result.replaced} 件、重複スキップ ${result.skipped} 件。`,
            );
          },
          onPreviewImport: (raw) =>
            this.#controller.previewLibraryImportJSON(raw),
          onNotice: (message) => this.showToast(message),
        },
        library.updatedAtById,
        this.#i18n.locale,
      );
    }
    if (screen.kind === "initial-setup") {
      return new InitialSetupScreen(
        screen,
        {
          onBack: () => this.#flow.back(),
          onBegin: (draft) => {
            this.#controller.startNewDraft(
              draft.sizeClass,
              draft.template,
              this.#i18n.locale,
            );
            this.#flow.navigate("begin-editing", {
              designId: this.#controller.draft.id,
              origin: "new",
            });
          },
        },
        this.#i18n.locale,
      );
    }
    if (screen.kind === "editor") return this.#createEditorScreen(screen);
    return this.#createViewerScreen(screen.context);
  }

  #createEditorScreen(
    screen: Extract<AppScreen, { kind: "editor" }>,
  ): MountedScreen {
    if (screen.designId !== this.#controller.draft.id) {
      this.#controller.load(screen.designId);
    }
    const element = document.createElement("section");
    element.className = "renewal-editor-screen";
    element.innerHTML = `
      ${renderEditorHeader(
        this.#controller.draft.name,
        this.#controller.draft.sizeClass,
        this.#i18n.locale,
      )}
      <div class="craft-host" data-editor-host></div>`;
    const workspace = new IntegratedCraftEditor(this.#controller, {
      onCheck: () => this.#flow.navigate("check-on-lake"),
      onDesignLibraryChange: this.#callbacks.onDesignLibraryChange,
      onSaveToLibrary: (design) => {
        this.#flow.navigate("save-to-library", { designId: design.id });
        this.showToast(
          this.#i18n.locale === "en"
            ? `Saved “${design.name}”.`
            : `「${design.name}」を保存しました`,
        );
      },
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
      locale: this.#i18n.locale,
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
    const localeButton = (
      event.target as HTMLElement
    ).closest<HTMLButtonElement>("button[data-locale]");
    if (
      localeButton?.dataset.locale === "ja" ||
      localeButton?.dataset.locale === "en"
    ) {
      this.#i18n.setLocale(localeButton.dataset.locale);
      this.element
        .querySelectorAll<HTMLButtonElement>("button[data-locale]")
        .forEach((button) => {
          button.ariaPressed = String(
            button.dataset.locale === this.#i18n.locale,
          );
        });
      this.#renderScreen(this.#flow.screen);
      localizeDOM(document.body, this.#i18n.locale);
      return;
    }
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
    } else if (input.name === "editor-design-name") {
      this.#controller.updateName(input.value);
    } else if (input.name === "editor-size") {
      this.#controller.updateSize(input.value as FireworkDesign["sizeClass"]);
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

  #syncEditorHeader(
    name: string,
    sizeClass: FireworkDesign["sizeClass"],
  ): void {
    const nameInput = this.element.querySelector<HTMLInputElement>(
      "[name='editor-design-name']",
    );
    if (nameInput && document.activeElement !== nameInput)
      nameInput.value = name;
    const sizeSelect = this.element.querySelector<HTMLSelectElement>(
      "[name='editor-size']",
    );
    if (sizeSelect) sizeSelect.value = sizeClass;
  }
}
