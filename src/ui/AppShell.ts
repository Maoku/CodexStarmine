import type { FireworkDesign, FireworkPattern, SizeClass } from "../data";
import type { CraftController } from "../modes/craft";

export type AppMode = "craft" | "free";

export interface AppShellCallbacks {
  onAudioPhysicality: (value: number) => void;
  onDesignLibraryChange: (designs: FireworkDesign[]) => void;
  onFreeDensityChange?: (value: number) => void;
  onFreeToggle?: () => void;
  onModeChange: (mode: AppMode) => void;
  onPreview: (design: FireworkDesign) => void;
}

const PATTERN_LABELS: Record<FireworkPattern, string> = {
  chrysanthemum: "菊",
  peony: "牡丹",
  crown: "冠",
  palm: "椰子",
  senrin: "千輪",
  heart: "型物・ハート",
};

function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function cssToColor(value: string): number {
  return Number.parseInt(value.replace("#", ""), 16);
}

export class AppShell {
  readonly element: HTMLElement;
  readonly #callbacks: AppShellCallbacks;
  readonly #controller: CraftController;
  #mode: AppMode = "craft";
  #toastTimer = 0;

  constructor(controller: CraftController, callbacks: AppShellCallbacks) {
    this.#controller = controller;
    this.#callbacks = callbacks;
    this.element = document.createElement("div");
    this.element.className = "app-shell";
    this.element.innerHTML = `
      <header class="app-header">
        <div class="brand-block">
          <p class="brand-block__eyebrow">VIRTUAL FIREWORK ATELIER</p>
          <h1>星見<span>煙火店</span></h1>
        </div>
        <nav class="mode-tabs" aria-label="モード切替">
          <button class="mode-tab is-active" type="button" data-mode="craft" aria-selected="true">
            <span>01</span> 製作
          </button>
          <button class="mode-tab" type="button" data-mode="free" aria-selected="false">
            <span>02</span> フリー鑑賞
          </button>
        </nav>
        <div class="sound-control">
          <label for="sound-delay">音の距離感</label>
          <input id="sound-delay" name="sound-delay" type="range" min="0" max="100" value="100" />
          <output for="sound-delay">実距離</output>
        </div>
      </header>

      <aside class="control-panel" data-panel="craft" aria-label="花火製作パネル">
        <div class="panel-heading">
          <div>
            <p class="panel-heading__step">CRAFT / 01</p>
            <h2>花火を仕立てる</h2>
          </div>
          <button class="text-button" type="button" data-action="new">一から作る</button>
        </div>

        <div class="craft-scroll">
          <label class="field field--wide">
            <span>作品名</span>
            <input name="design-name" type="text" maxlength="32" autocomplete="off" />
          </label>

          <div class="field-grid">
            <label class="field">
              <span><b>1</b> 種類</span>
              <select name="pattern">
                <option value="chrysanthemum">菊</option>
                <option value="peony">牡丹</option>
                <option value="crown">冠</option>
                <option value="palm">椰子</option>
                <option value="senrin">千輪</option>
                <option value="heart">型物・ハート</option>
              </select>
            </label>
            <fieldset class="field size-field">
              <legend><b>2</b> 大きさ</legend>
              <div class="compact-segments">
                <label><input name="size" type="radio" value="small" /><span>3号</span></label>
                <label><input name="size" type="radio" value="medium" /><span>5号</span></label>
                <label><input name="size" type="radio" value="large" /><span>10号</span></label>
              </div>
            </fieldset>
          </div>

          <div class="field-grid">
            <label class="field">
              <span><b>3</b> 芯</span>
              <select name="core-count">
                <option value="0">芯なし</option>
                <option value="1">一重芯</option>
                <option value="2">二重芯</option>
              </select>
            </label>
            <div class="field color-field">
              <span><b>4</b> 色変化</span>
              <div class="color-pair">
                <label>開花<input name="primary-color" type="color" /></label>
                <i aria-hidden="true">→</i>
                <label>余韻<input name="secondary-color" type="color" /></label>
              </div>
            </div>
          </div>

          <label class="field range-field">
            <span><b>5</b> 尾の長さ <output data-output="trail-length"></output></span>
            <input name="trail-length" type="range" min="0" max="100" step="1" />
          </label>
          <label class="field range-field">
            <span>花弁の太さ <output data-output="trail-width"></output></span>
            <input name="trail-width" type="range" min="60" max="180" step="1" />
          </label>

          <div class="field-grid">
            <label class="field">
              <span><b>6</b> 子花</span>
              <select name="child-count">
                <option value="0">なし</option>
                <option value="8">8輪</option>
                <option value="12">12輪</option>
                <option value="16">16輪</option>
              </select>
            </label>
            <label class="field">
              <span>昇曲</span>
              <select name="ascent-effect">
                <option value="none">なし</option>
                <option value="gold">金の尾</option>
                <option value="silver">銀の尾</option>
              </select>
            </label>
          </div>

          <section class="library-section" aria-labelledby="library-title">
            <div class="library-heading">
              <div>
                <p>MY FIREWORKS</p>
                <h3 id="library-title">保存した花火</h3>
              </div>
              <span data-library-count>0作品</span>
            </div>
            <div class="design-library" data-library></div>
          </section>
        </div>

        <div class="craft-actions">
          <div class="draft-summary">
            <span data-draft-pattern>菊</span>
            <strong data-draft-name>変化菊</strong>
          </div>
          <button class="secondary-action" type="button" data-action="save">保存</button>
          <button class="primary-action" type="button" data-action="preview">
            <span aria-hidden="true">↗</span> 単発プレビュー
          </button>
        </div>
      </aside>

      <aside class="control-panel free-panel" data-panel="free" aria-label="フリー鑑賞パネル" hidden>
        <div class="panel-heading">
          <div>
            <p class="panel-heading__step">VIEW / 02</p>
            <h2>湖畔に委ねる</h2>
          </div>
          <span class="live-indicator"><i></i> LIVE</span>
        </div>
        <div class="free-copy">
          <p>小さな一発から始まり、左右へ広がり、間を置いて大玉で締める。煙と余韻を読みながら、自動で演目を紡ぎます。</p>
          <div class="show-template">
            <span>導入</span><i></i><span>展開</span><i></i><span>静寂</span><i></i><span>終幕</span>
          </div>
        </div>
        <label class="field range-field density-control">
          <span>演出密度 <output data-output="free-density">標準</output></span>
          <input name="free-density" type="range" min="0" max="2" step="1" value="1" />
        </label>
        <div class="show-now">
          <p>NOW PLAYING</p>
          <strong data-show-title>湖畔の序章</strong>
          <span data-show-progress>演目を準備しています</span>
        </div>
        <button class="primary-action free-toggle" type="button" data-action="free-toggle">一時停止</button>
      </aside>

      <div class="scene-caption" aria-live="polite">
        <span>WIND</span><strong>東 1.3 m/s</strong><i></i><span>VIEW</span><strong>湖畔固定席</strong>
      </div>
      <div class="toast" role="status" aria-live="polite" data-toast></div>
    `;

    this.element.addEventListener("click", this.#handleClick);
    this.element.addEventListener("input", this.#handleInput);
    this.element.addEventListener("change", this.#handleChange);
    this.#syncDraftForm();
    this.#renderLibrary();
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

  showToast(message: string): void {
    const toast = this.#query<HTMLElement>("[data-toast]");
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(this.#toastTimer);
    this.#toastTimer = window.setTimeout(
      () => toast.classList.remove("is-visible"),
      2_200,
    );
  }

  destroy(): void {
    window.clearTimeout(this.#toastTimer);
    this.element.removeEventListener("click", this.#handleClick);
    this.element.removeEventListener("input", this.#handleInput);
    this.element.removeEventListener("change", this.#handleChange);
    this.element.remove();
  }

  readonly #handleClick = (event: Event): void => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "button[data-mode], button[data-action]",
    );
    if (!target) return;
    const mode = target.dataset.mode as AppMode | undefined;
    if (mode) {
      this.#setMode(mode);
      return;
    }

    const action = target.dataset.action;
    const id =
      target.closest<HTMLElement>("[data-design-id]")?.dataset.designId;
    if (action === "new") {
      this.#controller.startBlank();
      this.#syncDraftForm();
      this.showToast("新しい花火の設計を始めました");
    } else if (action === "preview") {
      this.#callbacks.onPreview(this.#controller.draft);
      this.showToast("単発プレビューを打ち上げます");
    } else if (action === "save") {
      const saved = this.#controller.save();
      this.#syncDraftForm();
      this.#renderLibrary();
      this.#callbacks.onDesignLibraryChange(this.#controller.savedDesigns);
      this.showToast(`「${saved.name}」を保存しました`);
    } else if (action === "load" && id) {
      if (this.#controller.load(id)) {
        this.#syncDraftForm();
        this.showToast("保存作品を編集画面へ読み込みました");
      }
    } else if (action === "duplicate" && id) {
      this.#controller.duplicate(id);
      this.#renderLibrary();
      this.#callbacks.onDesignLibraryChange(this.#controller.savedDesigns);
      this.showToast("作品を複製しました");
    } else if (action === "delete" && id) {
      this.#controller.remove(id);
      this.#syncDraftForm();
      this.#renderLibrary();
      this.#callbacks.onDesignLibraryChange(this.#controller.savedDesigns);
      this.showToast("保存作品を削除しました");
    } else if (action === "free-toggle") {
      this.#callbacks.onFreeToggle?.();
    }
  };

  readonly #handleInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    if (input.name === "design-name") {
      this.#controller.updateName(input.value);
    } else if (input.name === "trail-length" || input.name === "trail-width") {
      const length = Number(
        this.#query<HTMLInputElement>("[name='trail-length']").value,
      );
      const width = Number(
        this.#query<HTMLInputElement>("[name='trail-width']").value,
      );
      this.#controller.updateTrail(length / 100, width / 100);
      this.#updateRangeOutputs();
    } else if (
      input.name === "primary-color" ||
      input.name === "secondary-color"
    ) {
      this.#controller.updateColors(
        cssToColor(
          this.#query<HTMLInputElement>("[name='primary-color']").value,
        ),
        cssToColor(
          this.#query<HTMLInputElement>("[name='secondary-color']").value,
        ),
      );
    } else if (input.name === "sound-delay") {
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
    this.#updateDraftSummary();
  };

  readonly #handleChange = (event: Event): void => {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    if (input.name === "pattern") {
      this.#controller.selectPattern(input.value as FireworkPattern);
      this.#syncDraftForm();
    } else if (input.name === "size") {
      this.#controller.updateSize(input.value as SizeClass);
    } else if (input.name === "core-count") {
      this.#controller.updateCoreCount(Number(input.value));
    } else if (input.name === "child-count") {
      this.#controller.updateChildCount(Number(input.value));
    } else if (input.name === "ascent-effect") {
      this.#controller.updateAscentEffect(
        input.value as FireworkDesign["ascentEffect"],
      );
    }
    this.#updateDraftSummary();
  };

  #setMode(mode: AppMode): void {
    this.#mode = mode;
    for (const tab of this.element.querySelectorAll<HTMLButtonElement>(
      "[data-mode]",
    )) {
      const isActive = tab.dataset.mode === mode;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    }
    for (const panel of this.element.querySelectorAll<HTMLElement>(
      "[data-panel]",
    )) {
      panel.hidden = panel.dataset.panel !== mode;
    }
    this.#callbacks.onModeChange(mode);
  }

  #syncDraftForm(): void {
    const draft = this.#controller.draft;
    this.#query<HTMLInputElement>("[name='design-name']").value = draft.name;
    this.#query<HTMLSelectElement>("[name='pattern']").value = draft.pattern;
    const size = this.element.querySelector<HTMLInputElement>(
      `[name='size'][value='${draft.sizeClass}']`,
    );
    if (size) size.checked = true;
    this.#query<HTMLSelectElement>("[name='core-count']").value = String(
      draft.coreLayers.length,
    );
    this.#query<HTMLInputElement>("[name='primary-color']").value = colorToCss(
      draft.colorStages[1]?.color ?? draft.colorStages[0]?.color ?? 0xff4f70,
    );
    this.#query<HTMLInputElement>("[name='secondary-color']").value =
      colorToCss(
        draft.colorStages[2]?.color ?? draft.colorStages[1]?.color ?? 0x5ba8ff,
      );
    this.#query<HTMLInputElement>("[name='trail-length']").value = String(
      Math.round(draft.trailStyle.length * 100),
    );
    this.#query<HTMLInputElement>("[name='trail-width']").value = String(
      Math.round(draft.trailStyle.width * 100),
    );
    this.#query<HTMLSelectElement>("[name='child-count']").value = String(
      draft.childBursts[0]?.count ?? 0,
    );
    this.#query<HTMLSelectElement>("[name='ascent-effect']").value =
      draft.ascentEffect;
    this.#updateRangeOutputs();
    this.#updateDraftSummary();
  }

  #updateRangeOutputs(): void {
    const length = Number(
      this.#query<HTMLInputElement>("[name='trail-length']").value,
    );
    const width = Number(
      this.#query<HTMLInputElement>("[name='trail-width']").value,
    );
    this.#query<HTMLOutputElement>("[data-output='trail-length']").value =
      length < 25 ? "短い" : length < 70 ? "標準" : "長い";
    this.#query<HTMLOutputElement>("[data-output='trail-width']").value =
      width < 90 ? "細い" : width < 135 ? "標準" : "太い";
  }

  #updateDraftSummary(): void {
    const draft = this.#controller.draft;
    this.#query<HTMLElement>("[data-draft-pattern]").textContent =
      `${PATTERN_LABELS[draft.pattern]} · ${draft.sizeClass === "small" ? "3号" : draft.sizeClass === "medium" ? "5号" : "10号"}`;
    this.#query<HTMLElement>("[data-draft-name]").textContent =
      draft.name.trim() || "無題の花火";
  }

  #renderLibrary(): void {
    const library = this.#query<HTMLElement>("[data-library]");
    const designs = this.#controller.savedDesigns;
    library.replaceChildren();
    this.#query<HTMLElement>("[data-library-count]").textContent =
      `${designs.length}作品`;
    if (designs.length === 0) {
      const empty = document.createElement("p");
      empty.className = "library-empty";
      empty.textContent = "保存した花火はまだありません";
      library.append(empty);
      return;
    }

    for (const design of designs) {
      const item = document.createElement("article");
      item.className = "design-card";
      item.dataset.designId = design.id;
      const swatch = document.createElement("i");
      const primary = colorToCss(design.colorStages[1]?.color ?? 0xffffff);
      const secondary = colorToCss(design.colorStages[2]?.color ?? 0xffffff);
      swatch.style.background = `linear-gradient(135deg, ${primary}, ${secondary})`;
      const copy = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = design.name;
      const meta = document.createElement("span");
      meta.textContent = `${PATTERN_LABELS[design.pattern]} · ${design.sizeClass === "small" ? "3号" : design.sizeClass === "medium" ? "5号" : "10号"}`;
      copy.append(name, meta);
      const actions = document.createElement("div");
      for (const [action, label] of [
        ["load", "読込"],
        ["duplicate", "複製"],
        ["delete", "削除"],
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.action = action;
        button.textContent = label;
        actions.append(button);
      }
      item.append(swatch, copy, actions);
      library.append(item);
    }
  }

  #query<T extends Element>(selector: string): T {
    const element = this.element.querySelector<T>(selector);
    if (!element) throw new Error(`UI element not found: ${selector}`);
    return element;
  }
}
