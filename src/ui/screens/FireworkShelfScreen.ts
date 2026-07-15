import type { FireworkDesign } from "../../data";
import { escapeHTML } from "../craft/viewUtils";

export type ShelfSortOrder = "updated" | "name";

export interface ShelfThumbnailModel {
  accent: string;
  kind: "pattern" | "section";
  rings: readonly string[];
}

export interface FireworkShelfScreenCallbacks {
  onBack: () => void;
  onCreate: () => void;
  onDelete: (designId: string) => boolean;
  onEdit: (designId: string) => void;
}

function colorToCSS(color: number): string {
  return `#${Math.max(0, Math.min(0xffffff, color)).toString(16).padStart(6, "0")}`;
}

export function buildShelfThumbnailModel(
  design: FireworkDesign,
): ShelfThumbnailModel {
  const visibleLayers = design.layers
    .filter((layer) => layer.visible && layer.kind !== "child")
    .slice(0, 3);
  const fallback = design.themeColors[0] ?? 0xc7b89f;
  const rings = visibleLayers.map((layer) => {
    const star = design.starDefinitions[layer.defaultStarId];
    return colorToCSS(
      star?.colorStages[1]?.color ?? star?.colorStages[0]?.color ?? fallback,
    );
  });
  return {
    accent: colorToCSS(design.themeColors[0] ?? fallback),
    kind: design.layers.some((layer) => layer.kind === "pattern")
      ? "pattern"
      : "section",
    rings: rings.length > 0 ? rings : [colorToCSS(fallback)],
  };
}

export function filterAndSortShelfDesigns(
  designs: readonly FireworkDesign[],
  query: string,
  sortOrder: ShelfSortOrder,
): FireworkDesign[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = designs.filter((design) => {
    if (!normalizedQuery) return true;
    return `${design.name} ${design.description}`
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });
  if (sortOrder === "name") {
    filtered.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }
  return filtered;
}

function renderThumbnail(design: FireworkDesign): string {
  const model = buildShelfThumbnailModel(design);
  return `<span class="shelf-thumbnail shelf-thumbnail--${model.kind}" style="--shelf-accent:${model.accent}" role="img" aria-label="${escapeHTML(design.name)}の抽象化した玉内配置">
    <i class="shelf-thumbnail__paper"></i>
    ${model.rings
      .map(
        (color, index) =>
          `<i class="shelf-thumbnail__ring" style="--ring-color:${color};--ring-index:${index}"></i>`,
      )
      .join("")}
    <i class="shelf-thumbnail__band"></i>
  </span>`;
}

function patternLabel(design: FireworkDesign): string {
  return (
    {
      chrysanthemum: "菊",
      crown: "冠",
      heart: "ハート",
      palm: "椰子",
      peony: "牡丹",
      senrin: "千輪",
    } as const
  )[design.pattern];
}

export class FireworkShelfScreen {
  readonly element = document.createElement("section");
  readonly #callbacks: FireworkShelfScreenCallbacks;
  #designs: FireworkDesign[];
  #pendingDeleteId?: string;
  #query = "";
  #selectedDesignId?: string;
  #sortOrder: ShelfSortOrder = "updated";

  constructor(
    designs: readonly FireworkDesign[],
    selectedDesignId: string | undefined,
    callbacks: FireworkShelfScreenCallbacks,
  ) {
    this.#callbacks = callbacks;
    this.#designs = structuredClone([...designs]);
    this.#selectedDesignId = selectedDesignId;
    this.element.className = "renewal-screen firework-shelf-screen";
    this.element.setAttribute("aria-labelledby", "firework-shelf-heading");
    this.element.innerHTML = `
      <header class="renewal-brand renewal-brand--toolbar">
        <button class="renewal-back" type="button" data-action="back">← モード選択</button>
        <div class="brand-block">
          <p class="brand-block__eyebrow">VIRTUAL FIREWORK ATELIER</p>
          <h1>星見<span>煙火店</span></h1>
        </div>
        <p><span data-shelf-count>${this.#designs.length}</span> 作品を保管中</p>
      </header>
      <main class="shelf-main">
        <div class="shelf-heading">
          <div>
            <p class="renewal-kicker">FIREWORK SHELF</p>
            <h2 id="firework-shelf-heading">花火棚</h2>
          </div>
          <p>新しい一発の仕立てと、保存作品の編集・整理を行う作業棚です。</p>
        </div>
        <section class="shelf-cabinet" aria-label="保存した花火の作業棚">
          <div class="shelf-tools">
            <label class="shelf-search">
              <span>作品を探す</span>
              <input name="shelf-search" type="search" placeholder="作品名で検索" autocomplete="off" />
            </label>
            <label class="shelf-sort">
              <span>並び順</span>
              <select name="shelf-sort">
                <option value="updated">更新順</option>
                <option value="name">名前順</option>
              </select>
            </label>
          </div>
          <div class="shelf-results" role="list" data-shelf-results></div>
          <div class="shelf-drawers" aria-hidden="true"><i></i><i></i><i></i></div>
        </section>
      </main>
      <div data-delete-dialog-host></div>`;
    this.element.addEventListener("click", this.#handleClick);
    this.element.addEventListener("input", this.#handleInput);
    this.element.addEventListener("change", this.#handleChange);
    this.element.addEventListener("keydown", this.#handleKeyDown);
    this.#renderResults();
  }

  destroy(): void {
    this.element.removeEventListener("click", this.#handleClick);
    this.element.removeEventListener("input", this.#handleInput);
    this.element.removeEventListener("change", this.#handleChange);
    this.element.removeEventListener("keydown", this.#handleKeyDown);
    this.element.remove();
  }

  readonly #handleClick = (event: Event): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-action]",
    );
    if (!button) return;
    const action = button.dataset.action;
    const designId = button.dataset.designId;
    if (action === "back") this.#callbacks.onBack();
    else if (action === "create") this.#callbacks.onCreate();
    else if (action === "select" && designId) {
      this.#selectedDesignId = designId;
      this.#renderResults();
      this.element
        .querySelector<HTMLButtonElement>(
          `button[data-action="edit"][data-design-id="${CSS.escape(designId)}"]`,
        )
        ?.focus();
    } else if (action === "edit" && designId) {
      this.#callbacks.onEdit(designId);
    } else if (action === "delete" && designId) {
      this.#pendingDeleteId = designId;
      this.#renderDeleteDialog();
    } else if (action === "cancel-delete") {
      this.#closeDeleteDialog();
    } else if (action === "confirm-delete" && this.#pendingDeleteId) {
      const deletedId = this.#pendingDeleteId;
      if (this.#callbacks.onDelete(deletedId)) {
        this.#designs = this.#designs.filter(
          (design) => design.id !== deletedId,
        );
        if (this.#selectedDesignId === deletedId) {
          this.#selectedDesignId = undefined;
        }
        this.#pendingDeleteId = undefined;
        this.#renderResults();
        this.#renderDeleteDialog();
      }
    }
  };

  readonly #handleInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    if (input.name !== "shelf-search") return;
    this.#query = input.value;
    this.#renderResults();
  };

  readonly #handleChange = (event: Event): void => {
    const select = event.target as HTMLSelectElement;
    if (select.name !== "shelf-sort") return;
    this.#sortOrder = select.value === "name" ? "name" : "updated";
    this.#renderResults();
  };

  readonly #handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && this.#pendingDeleteId) {
      event.preventDefault();
      this.#closeDeleteDialog();
    }
  };

  #renderResults(): void {
    const host = this.element.querySelector<HTMLElement>(
      "[data-shelf-results]",
    );
    if (!host) return;
    const visibleDesigns = filterAndSortShelfDesigns(
      this.#designs,
      this.#query,
      this.#sortOrder,
    );
    const stateCard =
      this.#designs.length === 0
        ? `<div class="shelf-empty" role="listitem"><strong>棚は空です</strong><p>「新しい花火」から最初の一発を仕立てられます。</p></div>`
        : visibleDesigns.length === 0
          ? `<div class="shelf-empty" role="listitem"><strong>該当する作品がありません</strong><p>検索語を変えると、保存作品はそのまま表示できます。</p></div>`
          : "";
    host.innerHTML = `
      <article class="shelf-design-card shelf-design-card--new" role="listitem">
        <button type="button" data-action="create">
          <span class="shelf-new-shell" aria-hidden="true">＋</span>
          <span><small>NEW WORK</small><strong>新しい花火</strong><i>大きさと型を選んで仕立てる</i></span>
        </button>
      </article>
      ${visibleDesigns.map((design) => this.#renderDesignCard(design)).join("")}
      ${stateCard}`;
    const count = this.element.querySelector<HTMLElement>("[data-shelf-count]");
    if (count) count.textContent = String(this.#designs.length);
  }

  #renderDesignCard(design: FireworkDesign): string {
    const selected = design.id === this.#selectedDesignId;
    const sizeLabel =
      design.sizeClass === "small"
        ? "小玉"
        : design.sizeClass === "large"
          ? "大玉"
          : "中玉";
    return `<article class="shelf-design-card ${selected ? "is-selected" : ""}" role="listitem" data-design-id="${escapeHTML(design.id)}">
      <button class="shelf-design-card__body" type="button" data-action="select" data-design-id="${escapeHTML(design.id)}" aria-pressed="${selected}">
        ${renderThumbnail(design)}
        <span class="shelf-design-card__copy">
          <small>${sizeLabel} · ${patternLabel(design)}</small>
          <strong>${escapeHTML(design.name)}</strong>
          <i>${escapeHTML(design.description || "仮想星の配置を保存した作品")}</i>
        </span>
      </button>
      <div class="shelf-design-card__actions">
        <button class="primary-action" type="button" data-action="edit" data-design-id="${escapeHTML(design.id)}">編集</button>
        <button class="shelf-delete-action" type="button" data-action="delete" data-design-id="${escapeHTML(design.id)}">削除</button>
      </div>
    </article>`;
  }

  #renderDeleteDialog(): void {
    const host = this.element.querySelector<HTMLElement>(
      "[data-delete-dialog-host]",
    );
    if (!host) return;
    const design = this.#designs.find(
      (candidate) => candidate.id === this.#pendingDeleteId,
    );
    if (!design) {
      host.replaceChildren();
      return;
    }
    host.innerHTML = `<div class="shelf-dialog-backdrop">
      <section class="shelf-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-detail">
        <p class="renewal-kicker">REMOVE FROM SHELF</p>
        <h2 id="delete-dialog-title">「${escapeHTML(design.name)}」を削除しますか</h2>
        <p id="delete-dialog-detail">この作品だけを花火棚から削除します。ほかの保存作品には影響しません。</p>
        <div>
          <button type="button" data-action="cancel-delete" autofocus>取消</button>
          <button class="danger-action" type="button" data-action="confirm-delete">削除する</button>
        </div>
      </section>
    </div>`;
    queueMicrotask(() =>
      host.querySelector<HTMLButtonElement>("[autofocus]")?.focus(),
    );
  }

  #closeDeleteDialog(): void {
    const previousId = this.#pendingDeleteId;
    this.#pendingDeleteId = undefined;
    this.#renderDeleteDialog();
    if (previousId) {
      this.element
        .querySelector<HTMLButtonElement>(
          `button[data-action="delete"][data-design-id="${CSS.escape(previousId)}"]`,
        )
        ?.focus();
    }
  }
}
