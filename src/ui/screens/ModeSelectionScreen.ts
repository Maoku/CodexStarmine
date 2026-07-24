export interface ModeSelectionScreenCallbacks {
  onChooseCraft: () => void;
  onChooseFree: () => void;
}

export function renderModeSelectionScreenMarkup(locale: Locale = "ja"): string {
  if (locale === "en")
    return `<main class="mode-selection-main">
    <h1 class="visually-hidden" id="mode-selection-heading">Choose a virtual fireworks activity</h1>
    <div class="mode-choice-grid">
      <button class="mode-choice mode-choice--craft" type="button" data-choice="craft" autofocus><span class="mode-choice__number">01 / CRAFT</span><strong>Create fireworks</strong><small>Open your firework shelf to create, edit, and save individual shells.</small><i aria-hidden="true">Go to the workbench →</i></button>
      <button class="mode-choice mode-choice--free" type="button" data-choice="free"><span class="mode-choice__number">02 / VIEW</span><strong>Free viewing</strong><small>Watch an automatic program of fireworks across the lakeside nightscape.</small><i aria-hidden="true">Go to the lakeside →</i></button>
    </div>
  </main><p class="mode-safety-note"><span>Virtual fireworks</span> No real materials, formulas, or manufacturing conditions are used</p><footer class="renewal-screen-note">The title demo is silent · Adjust sound on the viewing screen</footer>`;
  return `<main class="mode-selection-main">
    <h1 class="visually-hidden" id="mode-selection-heading">仮想花火の操作を選ぶ</h1>
    <div class="mode-choice-grid">
      <button class="mode-choice mode-choice--craft" type="button" data-choice="craft" autofocus>
        <span class="mode-choice__number">01 / CRAFT</span>
        <strong>花火を作る</strong>
        <small>保存作品の棚を開き、新しい一発や編集中の作品を扱います。</small>
        <i aria-hidden="true">作業棚へ進む →</i>
      </button>
      <button class="mode-choice mode-choice--free" type="button" data-choice="free">
        <span class="mode-choice__number">02 / VIEW</span>
        <strong>フリー鑑賞</strong>
        <small>湖面の夜景で、複数の花火による自動演目を鑑賞します。</small>
        <i aria-hidden="true">湖畔へ進む →</i>
      </button>
    </div>
  </main>
  <p class="mode-safety-note"><span>仮想花火</span> 実物の材料・配合・製造条件は扱いません</p>
  <footer class="renewal-screen-note">タイトルデモは無音です · 音は鑑賞画面で調整できます</footer>`;
}

export class ModeSelectionScreen {
  readonly element = document.createElement("section");
  readonly #callbacks: ModeSelectionScreenCallbacks;

  constructor(callbacks: ModeSelectionScreenCallbacks, locale: Locale = "ja") {
    this.#callbacks = callbacks;
    this.element.className = "renewal-screen mode-selection-screen";
    this.element.setAttribute("aria-labelledby", "mode-selection-heading");
    this.element.innerHTML = renderModeSelectionScreenMarkup(locale);
    this.element.addEventListener("click", this.#handleClick);
  }

  destroy(): void {
    this.element.removeEventListener("click", this.#handleClick);
    this.element.remove();
  }

  readonly #handleClick = (event: Event): void => {
    const choice = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-choice]",
    )?.dataset.choice;
    if (choice === "craft") this.#callbacks.onChooseCraft();
    if (choice === "free") this.#callbacks.onChooseFree();
  };
}
import type { Locale } from "../../i18n";
