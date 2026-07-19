import {
  FIREWORK_PATTERN_LABELS,
  type FireworkDesign,
  type FireworkLibraryImportPreview,
} from "../../data";
import { escapeHTML } from "../craft/viewUtils";

export type ShelfSortOrder = "updated" | "name";

export interface ShelfThumbnailModel {
  accent: string;
  kind: "pattern" | "section";
  rings: readonly string[];
}

export function isBuiltInShelfPreset(design: FireworkDesign): boolean {
  return design.id.startsWith("preset-");
}

export function formatShelfUpdatedAt(
  updatedAt: string,
  locale?: Intl.LocalesArgument,
  timeZone?: string,
): string {
  const date = new Date(updatedAt);
  if (!Number.isFinite(date.getTime())) return "更新日時不明";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

export interface FireworkShelfLibraryState {
  readonly designs: readonly FireworkDesign[];
  readonly message: string;
  readonly updatedAtById: Readonly<Record<string, string>>;
}

export interface FireworkShelfScreenCallbacks {
  onBack: () => void;
  onClear: () => FireworkShelfLibraryState;
  onCreate: () => void;
  onDelete: (designId: string) => boolean;
  onEdit: (designId: string) => void;
  onExport: () => string;
  onImport: (
    raw: string,
    replaceConflicts: boolean,
  ) => FireworkShelfLibraryState;
  onNotice: (message: string) => void;
  onPreviewImport: (raw: string) => FireworkLibraryImportPreview;
}

export function renderShelfImportConflictDialog(conflictCount: number): string {
  const count = Math.max(0, Math.trunc(conflictCount));
  return `<div class="shelf-dialog-backdrop">
    <section class="shelf-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="import-dialog-title" aria-describedby="import-dialog-detail">
      <p class="renewal-kicker">IMPORT CONFLICT</p>
      <h2 id="import-dialog-title">${count}件の花火玉が重複しています。置き換えますか？</h2>
      <p id="import-dialog-detail">同じIDのローカル作品があります。「置き換える」を選ぶとJSON側の内容と更新日時を採用します。「重複をスキップ」では新しいIDの作品だけを取り込みます。</p>
      <div>
        <button type="button" data-action="cancel-dialog" autofocus>取り消し</button>
        <button type="button" data-action="confirm-import-skip">重複をスキップ</button>
        <button class="danger-action" type="button" data-action="confirm-import-replace">置き換える</button>
      </div>
    </section>
  </div>`;
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
  return FIREWORK_PATTERN_LABELS[design.pattern];
}

export class FireworkShelfScreen {
  readonly element = document.createElement("section");
  readonly #callbacks: FireworkShelfScreenCallbacks;
  #designs: FireworkDesign[];
  #pendingClear = false;
  #pendingDeleteId?: string;
  #pendingImportConflicts = 0;
  #pendingImportRaw?: string;
  #query = "";
  #selectedDesignId?: string;
  #sortOrder: ShelfSortOrder = "updated";
  #updatedAtById: Record<string, string>;

  constructor(
    designs: readonly FireworkDesign[],
    selectedDesignId: string | undefined,
    callbacks: FireworkShelfScreenCallbacks,
    updatedAtById: Readonly<Record<string, string>> = {},
  ) {
    this.#callbacks = callbacks;
    this.#designs = structuredClone([...designs]);
    this.#selectedDesignId = selectedDesignId;
    this.#updatedAtById = { ...updatedAtById };
    this.element.className = "renewal-screen firework-shelf-screen";
    this.element.setAttribute("aria-labelledby", "firework-shelf-heading");
    this.element.innerHTML = `
      <header class="renewal-brand renewal-brand--toolbar">
        <button class="renewal-back" type="button" data-action="back">← モード選択</button>
        <div class="screen-context-title">
          <p>FIREWORK SHELF</p>
          <h1>花火棚</h1>
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
            <div class="shelf-file-actions" aria-label="花火玉のJSONファイル操作">
              <input class="shelf-import-input" name="shelf-import" type="file" accept="application/json,.json" tabindex="-1" aria-hidden="true" hidden />
              <button type="button" data-action="import">インポート</button>
              <button type="button" data-action="export">エクスポート</button>
              <button class="shelf-clear-action" type="button" data-action="clear-library">ローカル作品を全消去</button>
            </div>
          </div>
          <div class="shelf-results" role="list" data-shelf-results></div>
          <div class="shelf-drawers" aria-hidden="true"><i></i><i></i><i></i></div>
        </section>
      </main>
      <div data-shelf-dialog-host></div>`;
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
    else if (action === "import") {
      const input = this.element.querySelector<HTMLInputElement>(
        "[name='shelf-import']",
      );
      if (input) {
        input.value = "";
        input.click();
      }
    } else if (action === "export") {
      this.#downloadExport();
    } else if (action === "clear-library" && this.#savedDesignCount() > 0) {
      this.#pendingClear = true;
      this.#renderDialog();
    } else if (action === "select" && designId) {
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
      this.#renderDialog();
    } else if (action === "cancel-dialog") {
      this.#closeDialog();
    } else if (
      action === "confirm-import-skip" &&
      this.#pendingImportRaw !== undefined
    ) {
      this.#finishImport(false);
    } else if (
      action === "confirm-import-replace" &&
      this.#pendingImportRaw !== undefined
    ) {
      this.#finishImport(true);
    } else if (action === "confirm-delete" && this.#pendingDeleteId) {
      const deletedId = this.#pendingDeleteId;
      if (this.#callbacks.onDelete(deletedId)) {
        this.#designs = this.#designs.filter(
          (design) => design.id !== deletedId,
        );
        if (this.#selectedDesignId === deletedId) {
          this.#selectedDesignId = undefined;
        }
        delete this.#updatedAtById[deletedId];
        this.#pendingDeleteId = undefined;
        this.#renderResults();
        this.#renderDialog();
        queueMicrotask(() =>
          this.element
            .querySelector<HTMLButtonElement>("[data-action='create']")
            ?.focus(),
        );
      }
    } else if (action === "confirm-clear" && this.#pendingClear) {
      const state = this.#callbacks.onClear();
      this.#pendingClear = false;
      this.#applyLibraryState(state);
      this.#renderDialog();
      this.#callbacks.onNotice(state.message);
      queueMicrotask(() =>
        this.element
          .querySelector<HTMLButtonElement>("[data-action='create']")
          ?.focus(),
      );
    }
  };

  readonly #handleInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    if (input.name !== "shelf-search") return;
    this.#query = input.value;
    this.#renderResults();
  };

  readonly #handleChange = (event: Event): void => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.name === "shelf-import") {
      void this.#importFile(target as HTMLInputElement);
      return;
    }
    if (target.name !== "shelf-sort") return;
    this.#sortOrder = target.value === "name" ? "name" : "updated";
    this.#renderResults();
  };

  readonly #handleKeyDown = (event: KeyboardEvent): void => {
    if (
      !this.#pendingDeleteId &&
      !this.#pendingClear &&
      this.#pendingImportRaw === undefined
    )
      return;
    if (event.key === "Escape") {
      event.preventDefault();
      this.#closeDialog();
      return;
    }
    if (event.key !== "Tab") return;
    const dialog = this.element.querySelector<HTMLElement>(
      ".shelf-delete-dialog",
    );
    const focusable = dialog?.querySelectorAll<HTMLButtonElement>(
      "button:not([disabled])",
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  #applyLibraryState(state: FireworkShelfLibraryState): void {
    this.#designs = structuredClone([...state.designs]);
    this.#updatedAtById = { ...state.updatedAtById };
    if (
      this.#selectedDesignId &&
      !this.#designs.some((design) => design.id === this.#selectedDesignId)
    ) {
      this.#selectedDesignId = undefined;
    }
    this.#renderResults();
  }

  #downloadExport(): void {
    if (this.#savedDesignCount() === 0) return;
    try {
      const blob = new Blob([this.#callbacks.onExport()], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.download = `codex-starmine-fireworks-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.href = url;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      queueMicrotask(() => URL.revokeObjectURL(url));
      this.#callbacks.onNotice(
        `保存作品 ${this.#savedDesignCount()} 件をJSONへ書き出しました。`,
      );
    } catch {
      this.#callbacks.onNotice("JSONファイルを書き出せませんでした。");
    }
  }

  async #importFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("10MBを超えるJSONファイルは読み込めません。");
      }
      const raw = await file.text();
      const preview = this.#callbacks.onPreviewImport(raw);
      if (preview.conflicts > 0) {
        this.#pendingImportRaw = raw;
        this.#pendingImportConflicts = preview.conflicts;
        this.#renderDialog();
        return;
      }
      const state = this.#callbacks.onImport(raw, false);
      this.#applyLibraryState(state);
      this.#callbacks.onNotice(state.message);
    } catch (error) {
      this.#callbacks.onNotice(
        error instanceof Error
          ? error.message
          : "JSONファイルを読み込めませんでした。",
      );
    } finally {
      input.value = "";
    }
  }

  #savedDesignCount(): number {
    return this.#designs.filter((design) => !isBuiltInShelfPreset(design))
      .length;
  }

  #finishImport(replaceConflicts: boolean): void {
    const raw = this.#pendingImportRaw;
    if (raw === undefined) return;
    this.#pendingImportRaw = undefined;
    this.#pendingImportConflicts = 0;
    try {
      const state = this.#callbacks.onImport(raw, replaceConflicts);
      this.#applyLibraryState(state);
      this.#callbacks.onNotice(state.message);
    } catch (error) {
      this.#callbacks.onNotice(
        error instanceof Error
          ? error.message
          : "JSONファイルを読み込めませんでした。",
      );
    }
    this.#renderDialog();
    queueMicrotask(() =>
      this.element
        .querySelector<HTMLButtonElement>("[data-action='import']")
        ?.focus(),
    );
  }

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
    const hasSavedDesigns = this.#savedDesignCount() > 0;
    for (const action of ["export", "clear-library"]) {
      const button = this.element.querySelector<HTMLButtonElement>(
        `[data-action='${action}']`,
      );
      if (button) button.disabled = !hasSavedDesigns;
    }
  }

  #renderDesignCard(design: FireworkDesign): string {
    const selected = design.id === this.#selectedDesignId;
    const isPreset = isBuiltInShelfPreset(design);
    const updatedAt = this.#updatedAtById[design.id];
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
          <small>${isPreset ? "内蔵見本 · " : ""}${sizeLabel} · ${patternLabel(design)}</small>
          <strong>${escapeHTML(design.name)}</strong>
          <i>${escapeHTML(design.description || "仮想星の配置を保存した作品")}</i>
          ${!isPreset && updatedAt ? `<time datetime="${escapeHTML(updatedAt)}">更新日: ${escapeHTML(formatShelfUpdatedAt(updatedAt))}</time>` : ""}
        </span>
      </button>
      <div class="shelf-design-card__actions">
        <button class="primary-action" type="button" data-action="edit" data-design-id="${escapeHTML(design.id)}" aria-label="${escapeHTML(design.name)}を編集">${isPreset ? "見本から編集" : "編集"}</button>
        ${isPreset ? "" : `<button class="shelf-delete-action" type="button" data-action="delete" data-design-id="${escapeHTML(design.id)}" aria-label="${escapeHTML(design.name)}を削除">削除</button>`}
      </div>
    </article>`;
  }

  #renderDialog(): void {
    const host = this.element.querySelector<HTMLElement>(
      "[data-shelf-dialog-host]",
    );
    if (!host) return;
    const background = this.element.querySelectorAll<HTMLElement>(
      ":scope > header, :scope > main",
    );
    const design = this.#designs.find(
      (candidate) => candidate.id === this.#pendingDeleteId,
    );
    if (
      !design &&
      !this.#pendingClear &&
      this.#pendingImportRaw === undefined
    ) {
      host.replaceChildren();
      background.forEach((element) => {
        element.inert = false;
        element.removeAttribute("aria-hidden");
      });
      return;
    }
    background.forEach((element) => {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    });
    if (this.#pendingImportRaw !== undefined) {
      host.innerHTML = renderShelfImportConflictDialog(
        this.#pendingImportConflicts,
      );
      queueMicrotask(() =>
        host.querySelector<HTMLButtonElement>("[autofocus]")?.focus(),
      );
      return;
    }
    if (this.#pendingClear) {
      host.innerHTML = `<div class="shelf-dialog-backdrop">
        <section class="shelf-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="clear-dialog-title" aria-describedby="clear-dialog-detail">
          <p class="renewal-kicker">CLEAR LOCAL LIBRARY</p>
          <h2 id="clear-dialog-title">ローカル保存作品をすべて消去しますか</h2>
          <p id="clear-dialog-detail">localStorageに保存された ${this.#savedDesignCount()} 件の花火玉と旧形式の保存データを消去します。内蔵見本と書き出し済みJSONには影響しません。この操作は元に戻せません。</p>
          <div>
            <button type="button" data-action="cancel-dialog" autofocus>取消</button>
            <button class="danger-action" type="button" data-action="confirm-clear">すべて消去</button>
          </div>
        </section>
      </div>`;
      queueMicrotask(() =>
        host.querySelector<HTMLButtonElement>("[autofocus]")?.focus(),
      );
      return;
    }
    if (!design) return;
    host.innerHTML = `<div class="shelf-dialog-backdrop">
      <section class="shelf-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-detail">
        <p class="renewal-kicker">REMOVE FROM SHELF</p>
        <h2 id="delete-dialog-title">「${escapeHTML(design.name)}」を削除しますか</h2>
        <p id="delete-dialog-detail">この作品だけを花火棚から削除します。ほかの保存作品には影響しません。</p>
        <div>
          <button type="button" data-action="cancel-dialog" autofocus>取消</button>
          <button class="danger-action" type="button" data-action="confirm-delete">削除する</button>
        </div>
      </section>
    </div>`;
    queueMicrotask(() =>
      host.querySelector<HTMLButtonElement>("[autofocus]")?.focus(),
    );
  }

  #closeDialog(): void {
    const previousId = this.#pendingDeleteId;
    const wasClearing = this.#pendingClear;
    const wasImporting = this.#pendingImportRaw !== undefined;
    this.#pendingDeleteId = undefined;
    this.#pendingClear = false;
    this.#pendingImportRaw = undefined;
    this.#pendingImportConflicts = 0;
    this.#renderDialog();
    if (previousId) {
      this.element
        .querySelector<HTMLButtonElement>(
          `button[data-action="delete"][data-design-id="${CSS.escape(previousId)}"]`,
        )
        ?.focus();
    } else if (wasClearing) {
      this.element
        .querySelector<HTMLButtonElement>("[data-action='clear-library']")
        ?.focus();
    } else if (wasImporting) {
      this.element
        .querySelector<HTMLButtonElement>("[data-action='import']")
        ?.focus();
    }
  }
}
