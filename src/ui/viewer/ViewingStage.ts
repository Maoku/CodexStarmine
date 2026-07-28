import type { SingleLoopCheckState } from "../../modes/check";
import type { Locale } from "../../i18n";
import { viewLabel } from "../../i18n/catalog";
import {
  FREE_VIEW_PRESET_IDS,
  FREE_VIEW_PRESETS,
  isFreeViewPresetId,
  type FreeShowState,
  type FreeViewPresetId,
} from "../../modes/viewFree";

export type ViewerContext = "check" | "free";
export type ViewerCameraMode = "drone" | "manual";

export interface ViewingStageCallbacks {
  onAudioPhysicality: (value: number) => void;
  onAudioVolume: (value: number) => void;
  onBack: () => void;
  onCheckLoopChange: (enabled: boolean) => void;
  onCheckToggle: () => void;
  onFreeDensityChange: (value: number) => void;
  onFreeToggle: () => void;
  onFreeViewPresetChange: (presetId: FreeViewPresetId) => void;
  onFreeViewReset: () => void;
  onToast: (message: string) => void;
  onViewerCameraModeChange: (mode: ViewerCameraMode) => void;
}

export interface ViewingStageOptions {
  audioVolume: number;
  callbacks: ViewingStageCallbacks;
  checkState: SingleLoopCheckState;
  context: ViewerContext;
  freeDensity: number;
  freeState: FreeShowState;
  freeViewPresetId: FreeViewPresetId;
  locale?: Locale;
  viewerCameraMode: ViewerCameraMode;
}

interface ViewerPanelTogglePresentation {
  ariaLabel: string;
  text: string;
}

export function getViewerPanelTogglePresentation(
  context: ViewerContext,
  expanded: boolean,
  locale: Locale = "ja",
): ViewerPanelTogglePresentation {
  if (locale === "en") {
    const panelName = context === "check" ? "check" : "free viewing";
    return {
      ariaLabel: `${expanded ? "Collapse" : "Open"} ${panelName} panel`,
      text: expanded ? "Collapse" : "Open panel",
    };
  }
  const panelName = context === "check" ? "確認" : "フリー鑑賞";
  return {
    ariaLabel: `${panelName}パネルを${expanded ? "折りたたむ" : "開く"}`,
    text: expanded ? "折りたたむ" : "パネルを開く",
  };
}

function escapeHTML(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function localizedShowText(locale: Locale, value: string): string {
  if (locale !== "en") return value;
  const english: Record<string, string> = {
    演目を準備しています: "Preparing the show",
    演目を終了しました: "The show has ended",
    湖畔の演目: "Lakeside show",
    湖畔の序章: "Lakeside prelude",
    風渡る彩霞: "Windborne color haze",
    星屑の水鏡: "Starlight on the water",
    錦秋の余韻: "Autumnal afterglow",
    "導入 · テーマ色を提示": "Opening · introducing the theme colors",
    "展開 · 左右へ広がる連続打上":
      "Development · launches spreading left and right",
    "間 · 煙と残光を鑑賞": "Interlude · smoke and afterglow",
    "終幕 · スターマイン": "Finale · starmine",
    "余韻 · 次の演目へ": "Afterglow · moving to the next show",
    余韻を残して一時停止中: "Paused with afterglow remaining",
  };
  return english[value] ?? value;
}

export function renderViewerCameraControl(
  presetId: FreeViewPresetId,
  locale: Locale = "ja",
  cameraMode: ViewerCameraMode = "manual",
): string {
  const viewPresetOptions = FREE_VIEW_PRESET_IDS.map(
    (candidate) =>
      `<option value="${candidate}" ${candidate === presetId ? "selected" : ""}>${locale === "en" ? viewLabel(locale, candidate) : FREE_VIEW_PRESETS[candidate].label}</option>`,
  ).join("");
  const droneActive = cameraMode === "drone";
  return `<section class="free-view-control" aria-labelledby="viewer-camera-heading">
    <div class="free-view-heading"><span id="viewer-camera-heading">${locale === "en" ? "Camera mode" : "カメラモード"}</span><b data-camera-mode-badge>${droneActive ? "DRONE CAMERA" : "FREE CAMERA"}</b></div>
    <div class="viewer-camera-mode" role="group" aria-label="${locale === "en" ? "Camera mode" : "カメラモード"}">
      <button type="button" data-viewer-action="camera-manual" aria-pressed="${!droneActive}">${locale === "en" ? "Manual" : "手動カメラ"}</button>
      <button type="button" data-viewer-action="camera-drone" aria-pressed="${droneActive}">${locale === "en" ? "Drone" : "ドローン"}</button>
    </div>
    <div class="free-view-row" data-manual-camera-controls aria-disabled="${droneActive}">
      <label class="free-view-select"><span>${locale === "en" ? "Camera preset" : "プリセット視点"}</span><select name="viewer-view-preset" ${droneActive ? "disabled" : ""}>${viewPresetOptions}</select></label>
      <button class="secondary-action free-view-reset" type="button" data-viewer-action="view-reset" ${droneActive ? "disabled" : ""}>${locale === "en" ? "Reset position" : "元の位置に戻る"}</button>
    </div>
    <p data-camera-mode-copy>${cameraModeCopy(cameraMode, locale)}</p>
    <p class="free-view-keys" data-camera-mode-keys>${cameraModeKeys(cameraMode, locale)}</p>
  </section>`;
}

function cameraModeCopy(mode: ViewerCameraMode, locale: Locale): string {
  if (mode === "drone") {
    return locale === "en"
      ? "The drone circles each burst, holds steady shots, and occasionally flies through the heart of the fireworks."
      : "花火を回り込み、静止撮影を挟みながら、時には開花の中を突き抜けて次のアングルへ移動します。";
  }
  return locale === "en"
    ? "Drag / one finger to look around · right-drag / two fingers to move · wheel / pinch to zoom"
    : "ドラッグ／1本指で見回す · 右ドラッグ／2本指で移動 · ホイール／ピンチで接近";
}

function cameraModeKeys(mode: ViewerCameraMode, locale: Locale): string {
  if (mode === "drone") {
    return locale === "en"
      ? "Choose Manual whenever you want to take control from the current angle."
      : "現在のアングルから操作したい時は、いつでも「手動カメラ」へ戻せます。";
  }
  return `<kbd>WASD / ${locale === "en" ? "arrow keys" : "矢印"}</kbd> ${locale === "en" ? "move" : "前後左右"} · <kbd>Q / E</kbd> ${locale === "en" ? "up/down" : "上下"} · <kbd>Shift</kbd> ${locale === "en" ? "faster" : "高速"}`;
}

export function viewerCameraViewLabel(
  mode: ViewerCameraMode,
  presetId: FreeViewPresetId,
  locale: Locale = "ja",
  manualViewIsCustom = false,
): string {
  if (mode === "drone") return locale === "en" ? "Drone" : "ドローン";
  if (manualViewIsCustom) return locale === "en" ? "Manual" : "自由操作";
  return viewLabel(locale, presetId);
}

export function renderViewerVolumeControl(
  volume: number,
  locale: Locale = "ja",
): string {
  const percent = Math.round(Math.min(Math.max(volume, 0), 1) * 100);
  return `<label class="viewer-volume-control">
    <span>
      <strong>${locale === "en" ? "Firework volume" : "花火の音量"}</strong>
      <output for="viewer-volume" data-output="viewer-volume">${percent}%</output>
    </span>
    <input id="viewer-volume" name="viewer-volume" type="range" min="0" max="100" step="1" value="${percent}" aria-label="${locale === "en" ? "Firework volume" : "花火の音量"}" />
    <small>${locale === "en" ? "Controls launch and burst sounds" : "打上音と開花音をまとめて調整"}</small>
  </label>`;
}

export class ViewingStage {
  readonly element = document.createElement("section");
  readonly #callbacks: ViewingStageCallbacks;
  readonly #context: ViewerContext;
  #checkState: SingleLoopCheckState;
  #freeState: FreeShowState;
  #freeViewPresetId: FreeViewPresetId;
  #manualViewIsCustom = false;
  #panelExpanded = true;
  readonly #locale: Locale;
  #audioVolume: number;
  #viewerCameraMode: ViewerCameraMode;

  constructor(options: ViewingStageOptions) {
    this.#callbacks = options.callbacks;
    this.#audioVolume = options.audioVolume;
    this.#checkState = options.checkState;
    this.#context = options.context;
    this.#freeState = options.freeState;
    this.#freeViewPresetId = options.freeViewPresetId;
    this.#locale = options.locale ?? "ja";
    this.#viewerCameraMode = options.viewerCameraMode;
    this.element.className = `renewal-viewer-screen viewing-stage viewing-stage--${this.#context}`;
    this.element.setAttribute(
      "aria-labelledby",
      `${this.#context}-view-heading-title`,
    );
    this.element.innerHTML = `
      <header class="renewal-viewer-toolbar viewing-stage__toolbar">
        <button class="renewal-back" type="button" data-viewer-action="back">← ${this.#context === "check" ? (this.#locale === "en" ? "Back to editor" : "編集に戻る") : this.#locale === "en" ? "Mode selection" : "モード選択"}</button>
        <div class="screen-context-title">
          <p>${this.#context === "check" ? "CHECK" : "FREE VIEW"}</p>
          <h1>${this.#context === "check" ? (this.#locale === "en" ? "Check" : "確認") : this.#locale === "en" ? "Free viewing" : "フリー鑑賞"}</h1>
        </div>
        <div class="sound-control">
          <label for="viewer-sound-delay">${this.#locale === "en" ? "Sound distance" : "音の距離感"}</label>
          <input id="viewer-sound-delay" name="viewer-sound-delay" type="range" min="0" max="100" value="100" />
          <output for="viewer-sound-delay">${this.#locale === "en" ? "Physical" : "実距離"}</output>
        </div>
      </header>
      ${this.#context === "check" ? this.#renderCheckPanel() : this.#renderFreePanel(options.freeDensity)}
      ${this.#renderSceneCaption()}`;
    this.element.addEventListener("click", this.#handleClick);
    this.element.addEventListener("input", this.#handleInput);
    this.element.addEventListener("change", this.#handleChange);
    this.setViewerCameraMode(this.#viewerCameraMode);
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
          ? this.#locale === "en"
            ? "Launching"
            : "打上中"
          : this.#locale === "en"
            ? `${Math.max(Math.ceil(state.secondsUntilLaunch), 1)} sec`
            : `${Math.max(Math.ceil(state.secondsUntilLaunch), 1)}秒`
        : state.loopEnabled
          ? this.#locale === "en"
            ? "Paused"
            : "一時停止中"
          : this.#locale === "en"
            ? "Waiting"
            : "待機中";
    }
    const count = this.element.querySelector<HTMLElement>(
      "[data-check-shot-count]",
    );
    if (count)
      count.textContent =
        this.#locale === "en"
          ? `${state.shotCount} launches`
          : `${state.shotCount}発`;
    const loop = this.element.querySelector<HTMLInputElement>(
      "[name='check-loop']",
    );
    if (loop) loop.checked = state.loopEnabled;
    const toggle = this.element.querySelector<HTMLButtonElement>(
      "[data-viewer-action='check-toggle']",
    );
    if (toggle) {
      toggle.textContent = state.running
        ? this.#locale === "en"
          ? "Pause"
          : "一時停止"
        : state.loopEnabled
          ? this.#locale === "en"
            ? "Resume check"
            : "確認を再開"
          : this.#locale === "en"
            ? "Launch again"
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
    if (toggle)
      toggle.textContent = state.running
        ? this.#locale === "en"
          ? "Pause"
          : "一時停止"
        : this.#locale === "en"
          ? "Resume show"
          : "演目を再開";
    const title = this.element.querySelector<HTMLElement>("[data-show-title]");
    if (title) title.textContent = localizedShowText(this.#locale, state.title);
    const detail = this.element.querySelector<HTMLElement>(
      "[data-show-progress]",
    );
    if (detail)
      detail.textContent = localizedShowText(this.#locale, state.detail);
    const fireworkName = this.element.querySelector<HTMLElement>(
      "[data-show-firework-name]",
    );
    if (fireworkName) {
      fireworkName.textContent =
        state.currentFireworkName ??
        (this.#locale === "en" ? "Preparing launch" : "打上準備中");
    }
    const liveLabel =
      this.element.querySelector<HTMLElement>("[data-live-label]");
    if (liveLabel) liveLabel.textContent = state.running ? "LIVE" : "PAUSED";
    this.element.classList.toggle("is-show-paused", !state.running);
  }

  setFreeViewPreset(presetId: FreeViewPresetId): void {
    this.#freeViewPresetId = presetId;
    this.#manualViewIsCustom = false;
    const select = this.element.querySelector<HTMLSelectElement>(
      "[name='viewer-view-preset']",
    );
    if (select) select.value = presetId;
    const label = this.element.querySelector<HTMLElement>("[data-view-label]");
    if (label && this.#viewerCameraMode === "manual") {
      label.textContent = viewLabel(this.#locale, presetId);
    }
  }

  setViewerCameraMode(mode: ViewerCameraMode): void {
    const returningFromDrone =
      this.#viewerCameraMode === "drone" && mode === "manual";
    this.#viewerCameraMode = mode;
    if (returningFromDrone) this.#manualViewIsCustom = true;
    const droneActive = mode === "drone";
    this.element.classList.toggle("is-drone-camera", droneActive);
    this.element
      .querySelectorAll<HTMLButtonElement>(
        "[data-viewer-action='camera-manual'], [data-viewer-action='camera-drone']",
      )
      .forEach((button) => {
        button.ariaPressed = String(
          button.dataset.viewerAction === `camera-${mode}`,
        );
      });
    const manualControls = this.element.querySelector<HTMLElement>(
      "[data-manual-camera-controls]",
    );
    if (manualControls) {
      manualControls.ariaDisabled = String(droneActive);
      manualControls
        .querySelectorAll<
          HTMLInputElement | HTMLButtonElement | HTMLSelectElement
        >("button, input, select")
        .forEach((control) => {
          control.disabled = droneActive;
        });
    }
    const badge = this.element.querySelector<HTMLElement>(
      "[data-camera-mode-badge]",
    );
    if (badge) badge.textContent = droneActive ? "DRONE CAMERA" : "FREE CAMERA";
    const copy = this.element.querySelector<HTMLElement>(
      "[data-camera-mode-copy]",
    );
    if (copy) copy.textContent = cameraModeCopy(mode, this.#locale);
    const keys = this.element.querySelector<HTMLElement>(
      "[data-camera-mode-keys]",
    );
    if (keys) keys.innerHTML = cameraModeKeys(mode, this.#locale);
    const label = this.element.querySelector<HTMLElement>("[data-view-label]");
    if (label) {
      label.textContent = viewerCameraViewLabel(
        mode,
        this.#freeViewPresetId,
        this.#locale,
        this.#manualViewIsCustom,
      );
    }
  }

  #renderCheckPanel(): string {
    return `<aside class="control-panel viewing-panel viewing-panel--check" aria-label="${this.#locale === "en" ? "Check-on-lake panel" : "湖面で確認パネル"}">
      <div class="panel-heading">
        <div><p class="panel-heading__step">VIEW / CHECK</p><h2 id="check-view-heading-title">一発を確かめる</h2></div>
        <div class="viewing-panel__heading-actions">
          <span class="live-indicator"><i></i> <span data-live-label>CHECKING</span></span>
          ${this.#renderPanelToggle()}
        </div>
      </div>
      <div class="viewing-panel__content" id="check-view-panel-content">
        ${this.#renderVolumeControl()}
        <div class="viewer-context-copy">
          <p>${this.#locale === "en" ? "Launch only the work being edited, one shell at a time under the same conditions. The final view includes lake reflections, smoke, and sound." : "編集中の作品だけを、同じ条件で一発ずつ打ち上げます。湖面反射、煙、音まで含む完成表示です。"}</p>
        </div>
        <section class="check-design-card" aria-label="${this.#locale === "en" ? "Work being checked" : "確認中の作品"}">
          <span>${this.#locale === "en" ? "Work being checked" : "確認中の作品"}</span>
          <strong data-check-design>${escapeHTML(this.#checkState.designName)}</strong>
          <p>${this.#locale === "en" ? "Compare the same burst every time with a fixed seed" : "固定seedで毎回同じ開花を比較できます"}</p>
        </section>
        <section class="check-timing" aria-live="polite">
          <div><span>NEXT LAUNCH</span><strong data-check-countdown>打上準備</strong></div>
          <div><span>THIS SESSION</span><strong data-check-shot-count>0発</strong></div>
        </section>
        ${renderViewerCameraControl(
          this.#freeViewPresetId,
          this.#locale,
          this.#viewerCameraMode,
        )}
        <label class="check-loop-control">
          <input name="check-loop" type="checkbox" ${this.#checkState.loopEnabled ? "checked" : ""} />
          <span><strong>${this.#locale === "en" ? "Single-launch loop" : "単発ループ"}</strong><small>${this.#locale === "en" ? "Launch this work once per cycle" : "1周期につきこの作品を1発だけ打ち上げます"}</small></span>
        </label>
        <button class="primary-action viewer-primary-toggle" type="button" data-viewer-action="check-toggle">一時停止</button>
      </div>
    </aside>`;
  }

  #renderFreePanel(freeDensity: number): string {
    return `<aside class="control-panel viewing-panel viewing-panel--free" aria-label="${this.#locale === "en" ? "Free-viewing panel" : "フリー鑑賞パネル"}">
      <div class="panel-heading">
        <div><p class="panel-heading__step">VIEW / FREE</p><h2 id="free-view-heading-title">湖畔に委ねる</h2></div>
        <div class="viewing-panel__heading-actions">
          <span class="live-indicator"><i></i> <span data-live-label>LIVE</span></span>
          ${this.#renderPanelToggle()}
        </div>
      </div>
      <div class="viewing-panel__content" id="free-view-panel-content">
        ${this.#renderVolumeControl()}
        <div class="viewer-context-copy">
          <p>${this.#locale === "en" ? "The show begins with small shells, spreads left and right, pauses, then closes with a large shell. It is composed automatically around smoke and afterglow." : "小さな一発から始まり、左右へ広がり、間を置いて大玉で締める。煙と余韻を読みながら、自動で演目を紡ぎます。"}</p>
          <div class="show-template"><span>${this.#locale === "en" ? "Opening" : "導入"}</span><i></i><span>${this.#locale === "en" ? "Development" : "展開"}</span><i></i><span>${this.#locale === "en" ? "Quiet" : "静寂"}</span><i></i><span>${this.#locale === "en" ? "Finale" : "終幕"}</span></div>
        </div>
        <label class="field range-field density-control">
          <span>${this.#locale === "en" ? "Show density" : "演出密度"} <output data-output="free-density">${this.#locale === "en" ? (["Quiet", "Standard", "Vibrant"][freeDensity] ?? "Standard") : (["静か", "標準", "華やか"][freeDensity] ?? "標準")}</output></span>
          <input name="free-density" type="range" min="0" max="2" step="1" value="${freeDensity}" aria-label="${this.#locale === "en" ? "Show density" : "演出密度"}" />
        </label>
        ${renderViewerCameraControl(
          this.#freeViewPresetId,
          this.#locale,
          this.#viewerCameraMode,
        )}
        <div class="show-now"><p>NOW PLAYING</p><strong data-show-title>${escapeHTML(localizedShowText(this.#locale, this.#freeState.title))}</strong><span data-show-progress>${escapeHTML(localizedShowText(this.#locale, this.#freeState.detail))}</span><span class="show-now__firework"><small>${this.#locale === "en" ? "Launching shell" : "打上中の玉"}</small><b data-show-firework-name>${escapeHTML(this.#freeState.currentFireworkName ?? (this.#locale === "en" ? "Preparing launch" : "打上準備中"))}</b></span></div>
        <button class="primary-action viewer-primary-toggle" type="button" data-viewer-action="free-toggle">${this.#freeState.running ? (this.#locale === "en" ? "Pause" : "一時停止") : this.#locale === "en" ? "Resume show" : "演目を再開"}</button>
      </div>
    </aside>`;
  }

  #renderPanelToggle(): string {
    const presentation = getViewerPanelTogglePresentation(
      this.#context,
      this.#panelExpanded,
      this.#locale,
    );
    return `<button class="viewing-panel-toggle" type="button" data-viewer-action="toggle-panel" aria-controls="${this.#context}-view-panel-content" aria-expanded="${this.#panelExpanded}" aria-label="${presentation.ariaLabel}">${presentation.text}</button>`;
  }

  #renderVolumeControl(): string {
    return renderViewerVolumeControl(this.#audioVolume, this.#locale);
  }

  #setPanelExpanded(expanded: boolean): void {
    this.#panelExpanded = expanded;
    const panel = this.element.querySelector<HTMLElement>(".viewing-panel");
    panel?.classList.toggle("is-collapsed", !expanded);

    const content = this.element.querySelector<HTMLElement>(
      ".viewing-panel__content",
    );
    if (content) content.hidden = !expanded;

    const button = this.element.querySelector<HTMLButtonElement>(
      "[data-viewer-action='toggle-panel']",
    );
    if (!button) return;
    const presentation = getViewerPanelTogglePresentation(
      this.#context,
      expanded,
      this.#locale,
    );
    button.ariaExpanded = String(expanded);
    button.ariaLabel = presentation.ariaLabel;
    button.textContent = presentation.text;
  }

  #renderSceneCaption(): string {
    if (this.#context === "check") {
      return `<div class="scene-caption"><span>SEED</span><strong>FIXED</strong><i></i><span>VIEW</span><strong data-view-label>${viewerCameraViewLabel(this.#viewerCameraMode, this.#freeViewPresetId, this.#locale)}</strong></div>`;
    }
    return `<div class="scene-caption"><span>WIND</span><strong>${this.#locale === "en" ? "East" : "東"} 1.3 m/s</strong><i></i><span>VIEW</span><strong data-view-label>${viewerCameraViewLabel(this.#viewerCameraMode, this.#freeViewPresetId, this.#locale)}</strong></div>`;
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
    else if (action === "camera-manual" || action === "camera-drone") {
      const mode = action === "camera-drone" ? "drone" : "manual";
      if (mode === this.#viewerCameraMode) return;
      this.setViewerCameraMode(mode);
      this.#callbacks.onViewerCameraModeChange(mode);
      this.#callbacks.onToast(
        mode === "drone"
          ? this.#locale === "en"
            ? "Drone camera started."
            : "ドローン撮影を開始しました"
          : this.#locale === "en"
            ? "Manual camera resumed from the current angle."
            : "現在のアングルから手動カメラへ戻りました",
      );
    } else if (action === "toggle-panel") {
      this.#setPanelExpanded(!this.#panelExpanded);
    } else if (action === "view-reset") {
      this.#callbacks.onFreeViewReset();
      this.#callbacks.onToast(
        this.#locale === "en"
          ? "Reset the view to the lakeside seat."
          : "視点を湖畔固定席へ戻しました",
      );
    }
  };

  readonly #handleInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    if (input.name === "viewer-volume") {
      const value = Math.min(Math.max(Number(input.value) / 100, 0), 1);
      this.#audioVolume = value;
      this.#callbacks.onAudioVolume(value);
      const output = this.element.querySelector<HTMLOutputElement>(
        "[data-output='viewer-volume']",
      );
      if (output) output.value = `${Math.round(value * 100)}%`;
    } else if (input.name === "viewer-sound-delay") {
      const value = Number(input.value) / 100;
      this.#callbacks.onAudioPhysicality(value);
      const output = input
        .closest<HTMLElement>(".sound-control")
        ?.querySelector<HTMLOutputElement>("output");
      if (output) {
        output.value =
          value > 0.8
            ? this.#locale === "en"
              ? "Physical"
              : "実距離"
            : value > 0.25
              ? this.#locale === "en"
                ? "Cinematic"
                : "演出寄り"
              : this.#locale === "en"
                ? "Immediate"
                : "即時";
      }
    } else if (input.name === "free-density") {
      const value = Number(input.value);
      this.#callbacks.onFreeDensityChange(value);
      const output = this.element.querySelector<HTMLOutputElement>(
        "[data-output='free-density']",
      );
      if (output)
        output.value =
          this.#locale === "en"
            ? (["Quiet", "Standard", "Vibrant"][value] ?? "Standard")
            : (["静か", "標準", "華やか"][value] ?? "標準");
    }
  };

  readonly #handleChange = (event: Event): void => {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    if (input.name === "check-loop" && input instanceof HTMLInputElement) {
      this.#callbacks.onCheckLoopChange(input.checked);
      return;
    }
    if (
      input.name !== "viewer-view-preset" ||
      !isFreeViewPresetId(input.value)
    ) {
      return;
    }
    this.setFreeViewPreset(input.value);
    this.#callbacks.onFreeViewPresetChange(input.value);
    this.#callbacks.onToast(
      this.#locale === "en"
        ? `Moved to “${viewLabel(this.#locale, input.value)}”.`
        : `視点を「${FREE_VIEW_PRESETS[input.value].label}」へ移動しました`,
    );
  };
}
