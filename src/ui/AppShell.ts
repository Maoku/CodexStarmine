import type { FireworkDesign } from "../data";
import type { CraftController } from "../modes/craft";
import {
  FREE_VIEW_PRESET_IDS,
  FREE_VIEW_PRESETS,
  HOME_FREE_VIEW_PRESET_ID,
  isFreeViewPresetId,
  type FreeViewPresetId,
} from "../modes/viewFree";
import { CraftWorkspace } from "./craft/CraftWorkspace";

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

export class AppShell {
  readonly element = document.createElement("div");
  readonly #callbacks: AppShellCallbacks;
  readonly #workspace: CraftWorkspace;
  #mode: AppMode = "craft";
  #toastTimer = 0;

  constructor(controller: CraftController, callbacks: AppShellCallbacks) {
    this.#callbacks = callbacks;
    this.element.className = "app-shell app-shell--editor";
    const viewPresetOptions = FREE_VIEW_PRESET_IDS.map(
      (presetId) =>
        `<option value="${presetId}">${FREE_VIEW_PRESETS[presetId].label}</option>`,
    ).join("");
    this.element.innerHTML = `
      <header class="app-header">
        <div class="brand-block">
          <p class="brand-block__eyebrow">VIRTUAL FIREWORK ATELIER</p>
          <h1>星見<span>煙火店</span></h1>
        </div>
        <nav class="mode-tabs" aria-label="モード切替">
          <button class="mode-tab is-active" type="button" data-mode="craft" aria-selected="true"><span>01</span> 製作</button>
          <button class="mode-tab" type="button" data-mode="free" aria-selected="false"><span>02</span> フリー鑑賞</button>
        </nav>
        <div class="header-status">
          <div class="sound-control">
            <label for="sound-delay">音の距離感</label>
            <input id="sound-delay" name="sound-delay" type="range" min="0" max="100" value="100" />
            <output for="sound-delay">実距離</output>
          </div>
          <p><span>仮想花火</span> 実物の材料・配合・製造条件は扱いません</p>
        </div>
      </header>
      <div class="craft-host" data-panel="craft"></div>
      <aside class="control-panel free-panel" data-panel="free" aria-label="フリー鑑賞パネル" hidden>
        <div class="panel-heading">
          <div><p class="panel-heading__step">VIEW / 02</p><h2>湖畔に委ねる</h2></div>
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
        <div class="show-now"><p>NOW PLAYING</p><strong data-show-title>湖畔の序章</strong><span data-show-progress>演目を準備しています</span></div>
        <button class="primary-action free-toggle" type="button" data-action="free-toggle">一時停止</button>
      </aside>
      <div class="scene-caption" aria-live="polite"><span>WIND</span><strong>東 1.3 m/s</strong><i></i><span>VIEW</span><strong data-view-label>湖畔固定席</strong></div>
      <div class="toast" role="status" aria-live="polite" data-toast></div>`;

    const craftHost = this.#query<HTMLElement>("[data-panel='craft']");
    this.#workspace = new CraftWorkspace(controller, {
      onDesignLibraryChange: callbacks.onDesignLibraryChange,
      onLaunch: callbacks.onLaunch,
      onToast: (message) => this.showToast(message),
    });
    craftHost.append(this.#workspace.element);
    this.element.addEventListener("click", this.#handleClick);
    this.element.addEventListener("input", this.#handleInput);
    this.element.addEventListener("change", this.#handleChange);
    if (controller.migrationWarning) {
      window.setTimeout(() =>
        this.showToast(controller.migrationWarning ?? ""),
      );
    }
  }

  get mode(): AppMode {
    return this.#mode;
  }

  setFreeState(running: boolean, title: string, detail: string): void {
    const button = this.#query<HTMLButtonElement>(
      "[data-action='free-toggle']",
    );
    button.textContent = running ? "一時停止" : "演目を再開";
    this.#query<HTMLElement>("[data-show-title]").textContent = title;
    this.#query<HTMLElement>("[data-show-progress]").textContent = detail;
    this.element.classList.toggle("is-show-paused", !running);
  }

  setFreeViewPreset(presetId: FreeViewPresetId): void {
    this.#query<HTMLSelectElement>("[name='free-view-preset']").value =
      presetId;
    this.#query<HTMLElement>("[data-view-label]").textContent =
      FREE_VIEW_PRESETS[presetId].label;
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
    this.#workspace.destroy();
    this.element.removeEventListener("click", this.#handleClick);
    this.element.removeEventListener("input", this.#handleInput);
    this.element.removeEventListener("change", this.#handleChange);
    this.element.remove();
  }

  readonly #handleClick = (event: Event): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-mode], button[data-action='free-toggle'], button[data-action='free-view-reset']",
    );
    if (!button) return;
    if (button.dataset.mode) {
      this.#setMode(button.dataset.mode as AppMode);
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
      this.#query<HTMLOutputElement>("[for='sound-delay']").value =
        value > 0.8 ? "実距離" : value > 0.25 ? "演出寄り" : "即時";
    } else if (input.name === "free-density") {
      const value = Number(input.value);
      this.#callbacks.onFreeDensityChange?.(value);
      this.#query<HTMLOutputElement>("[data-output='free-density']").value =
        ["静か", "標準", "華やか"][value] ?? "標準";
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

  #setMode(mode: AppMode): void {
    this.#mode = mode;
    for (const tab of this.element.querySelectorAll<HTMLButtonElement>(
      "[data-mode]",
    )) {
      const active = tab.dataset.mode === mode;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    }
    for (const panel of this.element.querySelectorAll<HTMLElement>(
      "[data-panel]",
    )) {
      panel.hidden = panel.dataset.panel !== mode;
    }
    this.element.classList.toggle("app-shell--editor", mode === "craft");
    this.#callbacks.onModeChange(mode);
  }

  #query<T extends Element>(selector: string): T {
    const element = this.element.querySelector<T>(selector);
    if (!element) throw new Error(`UI element not found: ${selector}`);
    return element;
  }
}
