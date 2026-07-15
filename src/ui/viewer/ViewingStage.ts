import type { SingleLoopCheckState } from "../../modes/check";
import {
  FREE_VIEW_PRESET_IDS,
  FREE_VIEW_PRESETS,
  isFreeViewPresetId,
  type FreeShowState,
  type FreeViewPresetId,
} from "../../modes/viewFree";

export type ViewerContext = "check" | "free";

export interface ViewingStageCallbacks {
  onAudioPhysicality: (value: number) => void;
  onBack: () => void;
  onCheckLoopChange: (enabled: boolean) => void;
  onCheckToggle: () => void;
  onFreeDensityChange: (value: number) => void;
  onFreeToggle: () => void;
  onFreeViewPresetChange: (presetId: FreeViewPresetId) => void;
  onFreeViewReset: () => void;
  onToast: (message: string) => void;
}

export interface ViewingStageOptions {
  callbacks: ViewingStageCallbacks;
  checkState: SingleLoopCheckState;
  context: ViewerContext;
  freeDensity: number;
  freeState: FreeShowState;
  freeViewPresetId: FreeViewPresetId;
}

function escapeHTML(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export class ViewingStage {
  readonly element = document.createElement("section");
  readonly #callbacks: ViewingStageCallbacks;
  readonly #context: ViewerContext;
  #checkState: SingleLoopCheckState;
  #freeState: FreeShowState;
  #freeViewPresetId: FreeViewPresetId;

  constructor(options: ViewingStageOptions) {
    this.#callbacks = options.callbacks;
    this.#checkState = options.checkState;
    this.#context = options.context;
    this.#freeState = options.freeState;
    this.#freeViewPresetId = options.freeViewPresetId;
    this.element.className = `renewal-viewer-screen viewing-stage viewing-stage--${this.#context}`;
    this.element.setAttribute(
      "aria-labelledby",
      `${this.#context}-view-heading-title`,
    );
    this.element.innerHTML = `
      <header class="renewal-viewer-toolbar viewing-stage__toolbar">
        <button class="renewal-back" type="button" data-viewer-action="back">← ${this.#context === "check" ? "編集に戻る" : "モード選択"}</button>
        <div class="screen-context-title">
          <p>${this.#context === "check" ? "CHECK" : "FREE VIEW"}</p>
          <h1>${this.#context === "check" ? "確認" : "フリー鑑賞"}</h1>
        </div>
        <div class="sound-control">
          <label for="viewer-sound-delay">音の距離感</label>
          <input id="viewer-sound-delay" name="viewer-sound-delay" type="range" min="0" max="100" value="100" />
          <output for="viewer-sound-delay">実距離</output>
        </div>
      </header>
      ${this.#context === "check" ? this.#renderCheckPanel() : this.#renderFreePanel(options.freeDensity)}
      ${this.#renderSceneCaption()}`;
    this.element.addEventListener("click", this.#handleClick);
    this.element.addEventListener("input", this.#handleInput);
    this.element.addEventListener("change", this.#handleChange);
    if (this.#context === "check") this.setCheckState(this.#checkState);
    else this.setFreeState(this.#freeState);
  }

  destroy(): void {
    this.element.removeEventListener("click", this.#handleClick);
    this.element.removeEventListener("input", this.#handleInput);
    this.element.removeEventListener("change", this.#handleChange);
    this.element.remove();
  }

  setCheckState(state: SingleLoopCheckState): void {
    this.#checkState = state;
    if (this.#context !== "check") return;
    const design = this.element.querySelector<HTMLElement>(
      "[data-check-design]",
    );
    if (design) design.textContent = state.designName;
    const countdown = this.element.querySelector<HTMLElement>(
      "[data-check-countdown]",
    );
    if (countdown) {
      countdown.textContent = state.running
        ? state.secondsUntilLaunch <= 0
          ? "打上中"
          : `${Math.max(Math.ceil(state.secondsUntilLaunch), 1)}秒`
        : state.loopEnabled
          ? "一時停止中"
          : "待機中";
    }
    const count = this.element.querySelector<HTMLElement>(
      "[data-check-shot-count]",
    );
    if (count) count.textContent = `${state.shotCount}発`;
    const loop = this.element.querySelector<HTMLInputElement>(
      "[name='check-loop']",
    );
    if (loop) loop.checked = state.loopEnabled;
    const toggle = this.element.querySelector<HTMLButtonElement>(
      "[data-viewer-action='check-toggle']",
    );
    if (toggle) {
      toggle.textContent = state.running
        ? "一時停止"
        : state.loopEnabled
          ? "確認を再開"
          : "もう一度発射";
    }
    const liveLabel =
      this.element.querySelector<HTMLElement>("[data-live-label]");
    if (liveLabel)
      liveLabel.textContent = state.running ? "CHECKING" : "PAUSED";
    this.element.classList.toggle("is-show-paused", !state.running);
  }

  setFreeState(state: FreeShowState): void {
    this.#freeState = state;
    if (this.#context !== "free") return;
    const toggle = this.element.querySelector<HTMLButtonElement>(
      "[data-viewer-action='free-toggle']",
    );
    if (toggle) toggle.textContent = state.running ? "一時停止" : "演目を再開";
    const title = this.element.querySelector<HTMLElement>("[data-show-title]");
    if (title) title.textContent = state.title;
    const detail = this.element.querySelector<HTMLElement>(
      "[data-show-progress]",
    );
    if (detail) detail.textContent = state.detail;
    const liveLabel =
      this.element.querySelector<HTMLElement>("[data-live-label]");
    if (liveLabel) liveLabel.textContent = state.running ? "LIVE" : "PAUSED";
    this.element.classList.toggle("is-show-paused", !state.running);
  }

  setFreeViewPreset(presetId: FreeViewPresetId): void {
    this.#freeViewPresetId = presetId;
    if (this.#context !== "free") return;
    const select = this.element.querySelector<HTMLSelectElement>(
      "[name='free-view-preset']",
    );
    if (select) select.value = presetId;
    const label = this.element.querySelector<HTMLElement>("[data-view-label]");
    if (label) label.textContent = FREE_VIEW_PRESETS[presetId].label;
  }

  #renderCheckPanel(): string {
    return `<aside class="control-panel viewing-panel viewing-panel--check" aria-label="湖面で確認パネル">
      <div class="panel-heading">
        <div><p class="panel-heading__step">VIEW / CHECK</p><h2 id="check-view-heading-title">一発を確かめる</h2></div>
        <span class="live-indicator"><i></i> <span data-live-label>CHECKING</span></span>
      </div>
      <div class="viewer-context-copy">
        <p>編集中の作品だけを、同じ条件で一発ずつ打ち上げます。湖面反射、煙、音まで含む完成表示です。</p>
      </div>
      <section class="check-design-card" aria-label="確認中の作品">
        <span>確認中の作品</span>
        <strong data-check-design>${escapeHTML(this.#checkState.designName)}</strong>
        <p>固定seedで毎回同じ開花を比較できます</p>
      </section>
      <section class="check-timing" aria-live="polite">
        <div><span>NEXT LAUNCH</span><strong data-check-countdown>打上準備</strong></div>
        <div><span>THIS SESSION</span><strong data-check-shot-count>0発</strong></div>
      </section>
      <label class="check-loop-control">
        <input name="check-loop" type="checkbox" ${this.#checkState.loopEnabled ? "checked" : ""} />
        <span><strong>単発ループ</strong><small>1周期につきこの作品を1発だけ打ち上げます</small></span>
      </label>
      <button class="primary-action viewer-primary-toggle" type="button" data-viewer-action="check-toggle">一時停止</button>
    </aside>`;
  }

  #renderFreePanel(freeDensity: number): string {
    const viewPresetOptions = FREE_VIEW_PRESET_IDS.map(
      (presetId) =>
        `<option value="${presetId}" ${presetId === this.#freeViewPresetId ? "selected" : ""}>${FREE_VIEW_PRESETS[presetId].label}</option>`,
    ).join("");
    return `<aside class="control-panel viewing-panel viewing-panel--free" aria-label="フリー鑑賞パネル">
      <div class="panel-heading">
        <div><p class="panel-heading__step">VIEW / FREE</p><h2 id="free-view-heading-title">湖畔に委ねる</h2></div>
        <span class="live-indicator"><i></i> <span data-live-label>LIVE</span></span>
      </div>
      <div class="viewer-context-copy">
        <p>小さな一発から始まり、左右へ広がり、間を置いて大玉で締める。煙と余韻を読みながら、自動で演目を紡ぎます。</p>
        <div class="show-template"><span>導入</span><i></i><span>展開</span><i></i><span>静寂</span><i></i><span>終幕</span></div>
      </div>
      <label class="field range-field density-control">
        <span>演出密度 <output data-output="free-density">${["静か", "標準", "華やか"][freeDensity] ?? "標準"}</output></span>
        <input name="free-density" type="range" min="0" max="2" step="1" value="${freeDensity}" aria-label="演出密度" />
      </label>
      <section class="free-view-control" aria-labelledby="free-view-heading">
        <div class="free-view-heading"><span id="free-view-heading">視点を動かす</span><b>FREE CAMERA</b></div>
        <div class="free-view-row">
          <label class="free-view-select"><span>プリセット視点</span><select name="free-view-preset">${viewPresetOptions}</select></label>
          <button class="secondary-action free-view-reset" type="button" data-viewer-action="free-view-reset">元の位置に戻る</button>
        </div>
        <p>ドラッグ／1本指で見回す · 右ドラッグ／2本指で移動 · ホイール／ピンチで接近</p>
        <p class="free-view-keys"><kbd>WASD / 矢印</kbd> 前後左右 · <kbd>Q / E</kbd> 上下 · <kbd>Shift</kbd> 高速</p>
      </section>
      <div class="show-now"><p>NOW PLAYING</p><strong data-show-title>${escapeHTML(this.#freeState.title)}</strong><span data-show-progress>${escapeHTML(this.#freeState.detail)}</span></div>
      <button class="primary-action viewer-primary-toggle" type="button" data-viewer-action="free-toggle">${this.#freeState.running ? "一時停止" : "演目を再開"}</button>
    </aside>`;
  }

  #renderSceneCaption(): string {
    if (this.#context === "check") {
      return `<div class="scene-caption"><span>MODE</span><strong>SINGLE LOOP</strong><i></i><span>SEED</span><strong>FIXED</strong></div>`;
    }
    return `<div class="scene-caption"><span>WIND</span><strong>東 1.3 m/s</strong><i></i><span>VIEW</span><strong data-view-label>${FREE_VIEW_PRESETS[this.#freeViewPresetId].label}</strong></div>`;
  }

  readonly #handleClick = (event: Event): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-viewer-action]",
    );
    if (!button) return;
    const action = button.dataset.viewerAction;
    if (action === "back") this.#callbacks.onBack();
    else if (action === "check-toggle") this.#callbacks.onCheckToggle();
    else if (action === "free-toggle") this.#callbacks.onFreeToggle();
    else if (action === "free-view-reset") {
      this.#callbacks.onFreeViewReset();
      this.#callbacks.onToast("視点を湖畔固定席へ戻しました");
    }
  };

  readonly #handleInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    if (input.name === "viewer-sound-delay") {
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
      this.#callbacks.onFreeDensityChange(value);
      const output = this.element.querySelector<HTMLOutputElement>(
        "[data-output='free-density']",
      );
      if (output) output.value = ["静か", "標準", "華やか"][value] ?? "標準";
    }
  };

  readonly #handleChange = (event: Event): void => {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    if (input.name === "check-loop" && input instanceof HTMLInputElement) {
      this.#callbacks.onCheckLoopChange(input.checked);
      return;
    }
    if (input.name !== "free-view-preset" || !isFreeViewPresetId(input.value)) {
      return;
    }
    this.setFreeViewPreset(input.value);
    this.#callbacks.onFreeViewPresetChange(input.value);
    this.#callbacks.onToast(
      `視点を「${FREE_VIEW_PRESETS[input.value].label}」へ移動しました`,
    );
  };
}
