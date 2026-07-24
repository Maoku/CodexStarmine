import type { InitialSetupDraft, AppScreen } from "../../app/AppFlowController";
import type { Locale } from "../../i18n";

export interface InitialSetupScreenCallbacks {
  onBack: () => void;
  onBegin: (draft: InitialSetupDraft) => void;
}

type InitialSetupScreenState = Extract<AppScreen, { kind: "initial-setup" }>;

const SIZE_OPTIONS = [
  {
    description: "軽やかでまとまりのよい広がり",
    label: "小玉",
    value: "small",
  },
  {
    description: "配置と広がりの基準になる大きさ",
    label: "中玉",
    value: "medium",
  },
  {
    description: "層を広く使えるゆったりした広がり",
    label: "大玉",
    value: "large",
  },
] as const;

const TEMPLATE_OPTIONS = [
  {
    description: "尾を引く星が球状に整う構成",
    label: "菊",
    value: "chrysanthemum",
  },
  {
    description: "色点が端正に広がる構成",
    label: "牡丹",
    value: "peony",
  },
  {
    description: "最小限の外周だけから始める構成",
    label: "白紙から",
    value: "blank",
  },
] as const;

export class InitialSetupScreen {
  readonly element = document.createElement("section");
  readonly #callbacks: InitialSetupScreenCallbacks;
  #draft: InitialSetupDraft;

  constructor(
    screen: InitialSetupScreenState,
    callbacks: InitialSetupScreenCallbacks,
    locale: Locale = "ja",
  ) {
    this.#callbacks = callbacks;
    this.#draft = structuredClone(screen.draft);
    this.element.className = "renewal-screen initial-setup-screen";
    this.element.setAttribute("aria-labelledby", "initial-setup-heading");
    this.element.innerHTML =
      locale === "en"
        ? `
      <header class="renewal-brand renewal-brand--toolbar"><button class="renewal-back" type="button" data-action="back">← Back to firework shelf</button><div class="screen-context-title"><p>NEW FIREWORK</p><h1>New firework</h1></div><p><span>New</span> Choose only the starting conditions</p></header>
      <main class="setup-main"><div class="setup-heading"><p class="renewal-kicker">NEW FIREWORK</p><h2 id="initial-setup-heading">Build a new firework</h2><p>Choose a size and a starting pattern. Fine placement can be edited in the next workshop.</p></div>
      <form class="setup-form"><fieldset><legend><span>1</span> Shell size</legend><div class="setup-option-grid setup-option-grid--sizes">${[
        {
          value: "small",
          label: "Small",
          description: "A light, compact spread",
        },
        {
          value: "medium",
          label: "Medium",
          description: "A balanced size for placement and spread",
        },
        {
          value: "large",
          label: "Large",
          description: "A generous spread with room for layers",
        },
      ]
        .map(
          (option) =>
            `<label class="setup-option setup-size-option"><input type="radio" name="setup-size" value="${option.value}" ${this.#draft.sizeClass === option.value ? "checked" : ""} /><i class="setup-size-shell setup-size-shell--${option.value}" aria-hidden="true"></i><strong>${option.label}</strong><small>${option.description}</small></label>`,
        )
        .join("")}</div></fieldset>
      <fieldset><legend><span>2</span> Starting pattern</legend><div class="setup-option-grid setup-option-grid--templates">${[
        {
          value: "chrysanthemum",
          label: "Chrysanthemum",
          description: "Trailing stars arranged into a sphere",
        },
        {
          value: "peony",
          label: "Peony",
          description: "Color points spread in a clean shape",
        },
        {
          value: "blank",
          label: "Start blank",
          description: "Begin with only a minimal outer ring",
        },
      ]
        .map(
          (option) =>
            `<label class="setup-option setup-template-option"><input type="radio" name="setup-template" value="${option.value}" ${this.#draft.template === option.value ? "checked" : ""} /><i class="setup-template-mark setup-template-mark--${option.value}" aria-hidden="true"></i><strong>${option.label}</strong><small>${option.description}</small></label>`,
        )
        .join(
          "",
        )}</div></fieldset><div class="setup-actions"><button type="button" data-action="back">Back to firework shelf</button><button class="primary-action" type="submit">Start creating →</button></div></form></main>`
        : `
      <header class="renewal-brand renewal-brand--toolbar">
        <button class="renewal-back" type="button" data-action="back">← 花火棚へ戻る</button>
        <div class="screen-context-title">
          <p>NEW FIREWORK</p>
          <h1>新しい花火</h1>
        </div>
        <p><span>新規</span> 開始条件だけを選択</p>
      </header>
      <main class="setup-main">
        <div class="setup-heading">
          <p class="renewal-kicker">NEW FIREWORK</p>
          <h2 id="initial-setup-heading">新しい花火を仕立てる</h2>
          <p>大きさと開始する型を選んでください。細かな配置は次の工房で編集できます。</p>
        </div>
        <form class="setup-form">
          <fieldset>
            <legend><span>1</span> 玉の大きさ</legend>
            <div class="setup-option-grid setup-option-grid--sizes">
              ${SIZE_OPTIONS.map(
                (option) => `<label class="setup-option setup-size-option">
                  <input type="radio" name="setup-size" value="${option.value}" ${this.#draft.sizeClass === option.value ? "checked" : ""} />
                  <i class="setup-size-shell setup-size-shell--${option.value}" aria-hidden="true"></i>
                  <strong>${option.label}</strong>
                  <small>${option.description}</small>
                </label>`,
              ).join("")}
            </div>
          </fieldset>
          <fieldset>
            <legend><span>2</span> 開始する型</legend>
            <div class="setup-option-grid setup-option-grid--templates">
              ${TEMPLATE_OPTIONS.map(
                (option) => `<label class="setup-option setup-template-option">
                  <input type="radio" name="setup-template" value="${option.value}" ${this.#draft.template === option.value ? "checked" : ""} />
                  <i class="setup-template-mark setup-template-mark--${option.value}" aria-hidden="true"></i>
                  <strong>${option.label}</strong>
                  <small>${option.description}</small>
                </label>`,
              ).join("")}
            </div>
          </fieldset>
          <div class="setup-actions">
            <button type="button" data-action="back">花火棚へ戻る</button>
            <button class="primary-action" type="submit">作り始める →</button>
          </div>
        </form>
      </main>`;
    this.element.addEventListener("click", this.#handleClick);
    this.element.addEventListener("change", this.#handleChange);
    this.element.addEventListener("submit", this.#handleSubmit);
  }

  destroy(): void {
    this.element.removeEventListener("click", this.#handleClick);
    this.element.removeEventListener("change", this.#handleChange);
    this.element.removeEventListener("submit", this.#handleSubmit);
    this.element.remove();
  }

  readonly #handleClick = (event: Event): void => {
    const action = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-action]",
    )?.dataset.action;
    if (action === "back") this.#callbacks.onBack();
  };

  readonly #handleChange = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    if (!input.checked) return;
    if (input.name === "setup-size") {
      this.#draft.sizeClass = input.value as InitialSetupDraft["sizeClass"];
    } else if (input.name === "setup-template") {
      this.#draft.template = input.value as InitialSetupDraft["template"];
    }
  };

  readonly #handleSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    this.#callbacks.onBegin(structuredClone(this.#draft));
  };
}
