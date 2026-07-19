import {
  FIREWORK_PATTERN_LABELS,
  createHeartPoints,
  type ChildBurstLayer,
  type FireworkDesign,
  type FireworkLayer,
  type PatternPoint,
  type SphericalStarLayer,
} from "../../data";
import {
  compareDiagnostics,
  type CraftController,
  type CraftDocumentSnapshot,
} from "../../modes/craft";
import { ShellAssemblyRenderer } from "../../render/editor/ShellAssemblyRenderer";
import { renderDiagnosticView } from "./DiagnosticView";
import { renderPatternView } from "./PatternView";
import { renderSectionView } from "./SectionView";
import {
  colorToCSS,
  escapeHTML,
  layerColor,
  layerKindLabel,
} from "./viewUtils";

export interface CraftWorkspaceCallbacks {
  onDesignLibraryChange: (designs: FireworkDesign[]) => void;
  onLaunch: (design: FireworkDesign) => void;
  onToast: (message: string) => void;
}

type CraftView = "assembly" | "section" | "pattern" | "diagnostic";

const PATTERN_LABELS = FIREWORK_PATTERN_LABELS;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function circlePoints(count = 72): PatternPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return {
      groupId: "outline",
      x: Math.cos(angle) * 0.88,
      y: Math.sin(angle) * 0.88,
    };
  });
}

function smilePoints(): PatternPoint[] {
  const outline = circlePoints(56);
  const eyes: PatternPoint[] = [
    { groupId: "eyes", x: -0.34, y: 0.3 },
    { groupId: "eyes", x: 0.34, y: 0.3 },
  ];
  const mouth = Array.from({ length: 28 }, (_, index) => {
    const angle = Math.PI * 0.14 + (index / 27) * Math.PI * 0.72;
    return {
      groupId: "mouth",
      x: Math.cos(angle) * 0.5,
      y: -Math.sin(angle) * 0.5 + 0.08,
    };
  });
  return [...outline, ...eyes, ...mouth];
}

function defaultGroups(template: "heart" | "circle" | "smile" | "custom") {
  if (template === "heart") {
    return [
      { id: "left", name: "左輪郭", starId: "star-solid-red" },
      { id: "right", name: "右輪郭", starId: "star-change-blue" },
    ];
  }
  if (template === "smile") {
    return [
      { id: "outline", name: "輪郭", starId: "star-gold" },
      { id: "eyes", name: "目", starId: "star-change-blue" },
      { id: "mouth", name: "口", starId: "star-solid-red" },
    ];
  }
  return [{ id: "outline", name: "輪郭", starId: "star-solid-red" }];
}

export class CraftWorkspace {
  readonly element = document.createElement("section");
  readonly #assemblyRenderer = new ShellAssemblyRenderer();
  readonly #callbacks: CraftWorkspaceCallbacks;
  readonly #controller: CraftController;
  #hemisphere: "left" | "right" = "left";
  #launchReady?: FireworkDesign;
  #launched = false;
  #patternTool = "select";
  #snapshot?: CraftDocumentSnapshot;
  #unsubscribe: () => void;
  #view: CraftView = "assembly";

  constructor(controller: CraftController, callbacks: CraftWorkspaceCallbacks) {
    this.#controller = controller;
    this.#callbacks = callbacks;
    this.element.className = "craft-workspace";
    this.element.addEventListener("click", this.#handleClick);
    this.element.addEventListener("change", this.#handleChange);
    this.element.addEventListener("dragstart", this.#handleDragStart);
    this.element.addEventListener("dragover", this.#handleDragOver);
    this.element.addEventListener("drop", this.#handleDrop);
    window.addEventListener("keydown", this.#handleKeyDown);
    this.#unsubscribe = this.#controller.document.subscribe((snapshot) => {
      this.#snapshot = snapshot;
      this.#render();
    });
  }

  destroy(): void {
    this.#unsubscribe();
    window.removeEventListener("keydown", this.#handleKeyDown);
    this.element.removeEventListener("click", this.#handleClick);
    this.element.removeEventListener("change", this.#handleChange);
    this.element.removeEventListener("dragstart", this.#handleDragStart);
    this.element.removeEventListener("dragover", this.#handleDragOver);
    this.element.removeEventListener("drop", this.#handleDrop);
    this.element.remove();
  }

  returnToEditor(): void {
    this.#launchReady = undefined;
    this.#launched = false;
    this.#render();
  }

  #render(): void {
    const snapshot = this.#snapshot;
    if (!snapshot) return;
    if (this.#launchReady) {
      this.#renderLaunchStage(this.#launchReady);
      return;
    }
    const design = snapshot.draft;
    const selectedLayer = design.layers.find(
      (layer) => layer.id === snapshot.selection.layerId,
    );
    const selectedStarId =
      snapshot.selection.starDefinitionId ?? selectedLayer?.defaultStarId;
    const selectedStar = selectedStarId
      ? design.starDefinitions[selectedStarId]
      : undefined;
    const diagnostic = snapshot.diagnostic;
    const snapshots = this.#controller.document.snapshots;
    const compareRows =
      snapshots.a && snapshots.b
        ? compareDiagnostics(snapshots.a, snapshots.b)
        : [];
    const warningClass =
      diagnostic.estimatedCost.maximumParticles > 6_000
        ? "is-overload"
        : diagnostic.estimatedCost.maximumParticles > 2_000
          ? "is-warning"
          : "is-good";

    this.element.innerHTML = `
      <aside class="craft-rail craft-rail--left">
        <section class="craft-card process-card">
          <header><span>制作工程</span><strong>${snapshot.dirty ? "編集中" : "保存済み"}</strong></header>
          <ol>
            <li><b>1</b><span>作品</span></li>
            <li><b>2</b><span>仮想星</span></li>
            <li class="is-active"><b>3</b><span>玉へ仕込む</span></li>
            <li><b>4</b><span>開き方</span></li>
            <li><b>5</b><span>簡易検査</span></li>
            <li><b>6</b><span>制作確定</span></li>
          </ol>
        </section>

        <section class="craft-card layer-card">
          <header><span>レイヤー</span><button type="button" data-action="auto-arrange">自動整列</button></header>
          <div class="layer-list">
            ${design.layers.map((layer, index) => this.#renderLayerRow(design, layer, index, snapshot.selection.layerId)).join("")}
          </div>
          <div class="layer-adders">
            <button type="button" data-action="add-core">＋ 芯</button>
            <button type="button" data-action="add-pattern">＋ 型物</button>
            <button type="button" data-action="add-child">＋ 子花</button>
          </div>
        </section>

        <section class="craft-card star-tray-card">
          <header><span>仮想星の部品皿</span><strong>ドラッグ可</strong></header>
          <div class="star-tray">
            ${Object.values(design.starDefinitions)
              .map(
                (
                  star,
                ) => `<button type="button" draggable="true" data-action="assign-star" data-star-id="${star.id}" class="${star.id === selectedStarId ? "is-selected" : ""}" title="${escapeHTML(star.displayName)}">
              <i style="--star:${colorToCSS(star.colorStages[1]?.color ?? star.colorStages[0]?.color ?? 0xffffff)}"></i>
              <span>${escapeHTML(star.displayName)}</span>
              <small>${star.emissionKind === "point" ? "点光" : star.emissionKind === "child" ? "子花" : "尾あり"}</small>
            </button>`,
              )
              .join("")}
          </div>
        </section>
      </aside>

      <main class="craft-bench">
        <div class="bench-tabs" role="tablist" aria-label="内部配置の表示">
          ${(["assembly", "section", "pattern", "diagnostic"] as CraftView[]).map((view) => `<button type="button" data-action="set-view" data-view="${view}" class="${this.#view === view ? "is-active" : ""}" aria-selected="${this.#view === view}">${({ assembly: "半球組立", section: "断面", pattern: "型物配置", diagnostic: "簡易確認" } as Record<CraftView, string>)[view]}</button>`).join("")}
        </div>
        <div class="bench-stage" data-current-view="${this.#view}">
          ${this.#renderView(design, selectedLayer, diagnostic, compareRows)}
        </div>
        <div class="hemisphere-switch" aria-label="半球切替">
          <button type="button" data-action="hemisphere" data-hemisphere="left" class="${this.#hemisphere === "left" ? "is-active" : ""}">左半球</button>
          <button type="button" data-action="hemisphere" data-hemisphere="right" class="${this.#hemisphere === "right" ? "is-active" : ""}">右半球</button>
        </div>
      </main>

      <aside class="craft-rail craft-rail--right">
        <section class="craft-card performance-card ${warningClass}">
          <header><span>パフォーマンス</span><strong>${warningClass === "is-good" ? "● 良好" : warningClass === "is-warning" ? "▲ 注意" : "× 超過"}</strong></header>
          <p><span>仮想星数</span><b>${diagnostic.estimatedCost.maximumParticles.toLocaleString()} / 6,000</b></p>
          <meter min="0" max="6000" low="2000" high="5500" optimum="1200" value="${diagnostic.estimatedCost.maximumParticles}"></meter>
          ${warningClass !== "is-good" ? `<button type="button" data-action="simplify">自動簡略化</button>` : ""}
        </section>
        <section class="craft-card inspector-card">
          <header><span>作品と配置</span><strong>${selectedLayer ? layerKindLabel(selectedLayer) : "未選択"}</strong></header>
          ${this.#renderDesignInspector(design)}
          ${selectedLayer ? this.#renderLayerInspector(design, selectedLayer) : ""}
        </section>
        <section class="craft-card star-inspector-card">
          <header><span>仮想星の時間配色</span><strong>${selectedStar ? escapeHTML(selectedStar.displayName) : "未選択"}</strong></header>
          ${selectedStar && selectedStarId ? this.#renderStarInspector(selectedStarId, selectedStar) : `<p>部品皿から仮想星を選んでください。</p>`}
        </section>
        <section class="craft-card mini-diagnostic">
          <header><span>簡易確認</span><button type="button" data-action="set-view" data-view="diagnostic">詳しく見る</button></header>
          <div><b>色</b>${diagnostic.colors
            .slice(0, 12)
            .map((item) => `<i style="--chip:${colorToCSS(item.color)}"></i>`)
            .join("")}</div>
          <p><b>方向</b><span>← ${diagnostic.directions[0]?.value ?? 0}</span><span>↑ ${diagnostic.directions[1]?.value ?? 0}</span><span>→ ${diagnostic.directions[3]?.value ?? 0}</span></p>
        </section>
      </aside>

      <footer class="craft-transport">
        <div class="history-actions">
          <button type="button" data-action="undo" ${snapshot.canUndo ? "" : "disabled"}>Undo</button>
          <button type="button" data-action="redo" ${snapshot.canRedo ? "" : "disabled"}>Redo</button>
        </div>
        <div class="transport-controls">
          <button type="button" data-action="hemisphere" data-hemisphere="left" class="${this.#hemisphere === "left" ? "is-active" : ""}">左半球</button>
          <button type="button" data-action="hemisphere" data-hemisphere="right" class="${this.#hemisphere === "right" ? "is-active" : ""}">右半球</button>
          <button type="button" data-action="auto-arrange">列へ詰める</button>
        </div>
        <div class="ab-actions"><span>構成 A / B</span><button type="button" data-action="snapshot-a" class="${snapshots.a ? "has-snapshot" : ""}">A</button><button type="button" data-action="snapshot-b" class="${snapshots.b ? "has-snapshot" : ""}">B</button></div>
        <p class="surprise-note">完成形は、次に湖畔で打ち上げるまで表示されません</p>
        <button class="confirm-craft" type="button" data-action="confirm">制作を確定</button>
      </footer>`;
  }

  #renderLaunchStage(design: FireworkDesign): void {
    this.element.innerHTML = `
      <section class="launch-stage ${this.#launched ? "has-launched" : ""}">
        <div class="launch-stage__shell" aria-hidden="true">
          ${renderSectionView(design, design.layers[0]?.id)}
        </div>
        <div class="launch-stage__card">
          <p>CRAFT CONFIRMED</p>
          <h2>「${escapeHTML(design.name)}」を仕立てました</h2>
          <span>玉の内部配置と仮想星を保存しました。完成した開花はまだ表示していません。</span>
          ${this.#launched ? `<strong>湖畔で打ち上げ中です</strong><button type="button" data-action="return-editor">内部配置へ戻る</button>` : `<button type="button" data-action="launch">湖畔で打ち上げる</button><button type="button" data-action="return-editor">内部配置を調整する</button>`}
        </div>
      </section>`;
  }

  #renderLayerRow(
    design: FireworkDesign,
    layer: FireworkLayer,
    index: number,
    selectedLayerId?: string,
  ): string {
    return `<article class="layer-row ${layer.id === selectedLayerId ? "is-selected" : ""}" data-layer-id="${layer.id}">
      <button type="button" data-action="toggle-layer" aria-label="${layer.visible ? "非表示" : "表示"}">${layer.visible ? "◉" : "○"}</button>
      <button type="button" data-action="select-layer"><i style="--layer:${layerColor(design, layer)}"></i><span>${escapeHTML(layer.name)}</span><small>${layerKindLabel(layer)}</small></button>
      <button type="button" data-action="toggle-lock" aria-label="ロック切替">${layer.locked ? "▣" : "□"}</button>
      <div class="layer-row__move"><button type="button" data-action="move-layer-up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-action="move-layer-down" ${index === design.layers.length - 1 ? "disabled" : ""}>↓</button></div>
    </article>`;
  }

  #renderView(
    design: FireworkDesign,
    selectedLayer: FireworkLayer | undefined,
    diagnostic: CraftDocumentSnapshot["diagnostic"],
    compareRows: { label: string; a: string; b: string }[],
  ): string {
    if (this.#view === "section") {
      return renderSectionView(design, selectedLayer?.id);
    }
    if (this.#view === "pattern") {
      return renderPatternView(
        design,
        selectedLayer?.kind === "pattern" ? selectedLayer : undefined,
        this.#patternTool,
      );
    }
    if (this.#view === "diagnostic") {
      return renderDiagnosticView(diagnostic, compareRows);
    }
    return this.#assemblyRenderer.render(
      design,
      selectedLayer?.id,
      this.#hemisphere,
    );
  }

  #renderDesignInspector(design: FireworkDesign): string {
    return `<div class="inspector-fields">
      <label><span>作品名</span><input name="design-name" type="text" maxlength="32" value="${escapeHTML(design.name)}" /></label>
      <div class="inspector-pair">
        <label><span>系統</span><select name="pattern">${Object.entries(
          PATTERN_LABELS,
        )
          .map(
            ([value, label]) =>
              `<option value="${value}" ${design.pattern === value ? "selected" : ""}>${label}</option>`,
          )
          .join("")}</select></label>
        <label><span>号数</span><select name="size"><option value="small" ${design.sizeClass === "small" ? "selected" : ""}>3号</option><option value="medium" ${design.sizeClass === "medium" ? "selected" : ""}>5号</option><option value="large" ${design.sizeClass === "large" ? "selected" : ""}>10号</option></select></label>
      </div>
      <p class="inspector-note">広がり、発火順、速度、重力、減速は、星種と玉内配置から自動調整されます。</p>
    </div>`;
  }

  #renderLayerInspector(design: FireworkDesign, layer: FireworkLayer): string {
    const optionsFor = (selectedId: string) =>
      Object.values(design.starDefinitions)
        .map(
          (star) =>
            `<option value="${star.id}" ${star.id === selectedId ? "selected" : ""}>${escapeHTML(star.displayName)}</option>`,
        )
        .join("");
    const starOptions = optionsFor(layer.defaultStarId);
    let specific = "";
    if (layer.kind === "spherical") {
      specific = `
        <label><span>仮想星数 <output>${layer.count}</output></span><input name="layer-count" type="range" min="12" max="900" step="1" value="${layer.count}" /></label>
        <label><span>層の半径 <output>${Math.round(layer.radius * 100)}%</output></span><input name="layer-radius" type="range" min="20" max="100" value="${Math.round(layer.radius * 100)}" /></label>
        <label><span>空間配色</span><select name="spatial-color"><option value="layer" ${layer.coloring.mode === "layer" ? "selected" : ""}>レイヤー一括</option><option value="alternating" ${layer.coloring.mode === "alternating" ? "selected" : ""}>交互色</option><option value="latitude" ${layer.coloring.mode === "latitude" ? "selected" : ""}>緯度帯</option><option value="longitude" ${layer.coloring.mode === "longitude" ? "selected" : ""}>経度セクター</option></select></label>`;
    } else if (layer.kind === "pattern") {
      specific = `
        <label><span>奥行き <output>${Math.round(layer.depth * 100)}%</output></span><input name="pattern-depth" type="range" min="0" max="25" value="${Math.round(layer.depth * 100)}" /></label>
        <label><span>向き方針</span><select name="pattern-facing"><option value="audience" ${layer.facingPolicy === "audience" ? "selected" : ""}>観客正面を優先</option><option value="venue" ${layer.facingPolicy === "venue" ? "selected" : ""}>会場正面に固定</option><option value="random" ${layer.facingPolicy === "random" ? "selected" : ""}>ランダム</option></select></label>
        <div class="pattern-group-editors">${layer.groups.map((group) => `<label><span>${escapeHTML(group.name)}の色</span><select name="pattern-group-star" data-group="${group.id}">${optionsFor(group.starId)}</select></label>`).join("")}</div>`;
    } else if (layer.kind === "child") {
      specific = `
        <label><span>子花数 <output>${layer.count}</output></span><input name="child-count" type="range" min="4" max="48" value="${layer.count}" /></label>`;
    } else {
      specific = `<label><span>枝数 <output>${layer.branchCount}</output></span><input name="branch-count" type="range" min="5" max="20" value="${layer.branchCount}" /></label>`;
    }
    return `<div class="inspector-divider"></div><div class="inspector-fields">
      <label><span>レイヤー名</span><input name="layer-name" type="text" maxlength="24" value="${escapeHTML(layer.name)}" /></label>
      <label><span>既定の仮想星</span><select name="layer-star">${starOptions}</select></label>
      ${specific}
      <div class="inspector-actions"><button type="button" data-action="duplicate-layer">複製</button><button type="button" data-action="delete-layer">削除</button></div>
    </div>`;
  }

  #renderStarInspector(
    id: string,
    star: FireworkDesign["starDefinitions"][string],
  ): string {
    return `<div class="inspector-fields" data-star-editor="${id}">
      <label><span>名称</span><input name="star-name" type="text" maxlength="28" value="${escapeHTML(star.displayName)}" /></label>
      <p class="inspector-note">星の広がり方と寿命は種類ごとの特性として自動調整されます。ここでは時間配色だけを編集できます。</p>
      <div class="star-stage-list">
        ${star.colorStages.map((stage, index) => `<div><b>${index + 1}</b><input aria-label="段階${index + 1}の色" name="star-stage-color" data-stage="${index}" type="color" value="${colorToCSS(stage.color)}" /><input aria-label="段階${index + 1}の時刻" name="star-stage-time" data-stage="${index}" type="range" min="0" max="100" value="${Math.round(stage.normalizedTime * 100)}" />${star.colorStages.length > 1 ? `<button type="button" data-action="remove-star-stage" data-stage="${index}">×</button>` : ""}</div>`).join("")}
      </div>
      <div class="inspector-actions"><button type="button" data-action="add-star-stage" ${star.colorStages.length >= 4 ? "disabled" : ""}>＋ 色段階</button><button type="button" data-action="duplicate-star">仮想星を複製</button></div>
    </div>`;
  }

  readonly #handleClick = (event: Event): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-action]",
    );
    if (button) {
      const action = button.dataset.action;
      this.#runAction(action ?? "", button);
      return;
    }
    const layerElement = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-layer-id]",
    );
    if (layerElement?.dataset.layerId) {
      this.#controller.document.selectLayer(layerElement.dataset.layerId);
      return;
    }
    const canvas = (event.target as HTMLElement).closest<SVGSVGElement>(
      "[data-pattern-canvas]",
    );
    if (canvas && this.#patternTool !== "select") {
      this.#addPatternPoints(event as MouseEvent, canvas);
    }
  };

  #runAction(action: string, button: HTMLButtonElement): void {
    const snapshot = this.#snapshot;
    if (!snapshot) return;
    const layerId =
      button.closest<HTMLElement>("[data-layer-id]")?.dataset.layerId ??
      snapshot.selection.layerId;
    if (action === "set-view") {
      this.#view = button.dataset.view as CraftView;
      this.#render();
    } else if (action === "hemisphere") {
      this.#hemisphere = button.dataset.hemisphere as "left" | "right";
      this.#render();
    } else if (action === "select-layer" && layerId) {
      this.#controller.document.selectLayer(layerId);
    } else if (action === "toggle-layer" && layerId) {
      this.#updateLayer(layerId, "レイヤー表示を変更", (layer) => {
        layer.visible = !layer.visible;
      });
    } else if (action === "toggle-lock" && layerId) {
      this.#updateLayer(layerId, "レイヤーのロックを変更", (layer) => {
        layer.locked = !layer.locked;
      });
    } else if (action === "move-layer-up" && layerId) {
      this.#moveLayer(layerId, -1);
    } else if (action === "move-layer-down" && layerId) {
      this.#moveLayer(layerId, 1);
    } else if (action === "add-core") {
      this.#addCore();
    } else if (action === "add-pattern") {
      this.#addPattern();
    } else if (action === "add-child") {
      this.#addChild();
    } else if (action === "duplicate-layer" && layerId) {
      this.#duplicateLayer(layerId);
    } else if (action === "delete-layer" && layerId) {
      this.#deleteLayer(layerId);
    } else if (action === "assign-star") {
      const starId = button.dataset.starId;
      if (starId) this.#assignStar(starId);
    } else if (action === "auto-arrange") {
      this.#autoArrange();
    } else if (action === "undo") {
      this.#controller.document.undo();
    } else if (action === "redo") {
      this.#controller.document.redo();
    } else if (action === "snapshot-a") {
      this.#controller.document.captureSnapshot("a");
      this.#callbacks.onToast("現在の簡易検査を構成Aへ固定しました");
    } else if (action === "snapshot-b") {
      this.#controller.document.captureSnapshot("b");
      this.#callbacks.onToast("現在の簡易検査を構成Bへ固定しました");
    } else if (action === "simplify") {
      this.#simplify();
    } else if (action === "confirm") {
      this.#confirm();
    } else if (action === "launch") {
      if (!this.#launchReady) return;
      this.#launched = true;
      this.#callbacks.onLaunch(this.#launchReady);
      this.#render();
    } else if (action === "return-editor") {
      this.returnToEditor();
    } else if (action === "pattern-tool") {
      this.#patternTool = button.dataset.tool ?? "select";
      this.#render();
    } else if (action === "pattern-template") {
      this.#applyPatternTemplate(button.dataset.template ?? "heart");
    } else if (action === "add-star-stage") {
      this.#addStarStage();
    } else if (action === "remove-star-stage") {
      this.#removeStarStage(Number(button.dataset.stage));
    } else if (action === "duplicate-star") {
      this.#duplicateStar();
    }
  }

  readonly #handleChange = (event: Event): void => {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    const name = input.name;
    if (!name || !this.#snapshot) return;
    const value = input.value;
    if (name === "design-name") {
      this.#controller.updateName(value);
    } else if (name === "pattern") {
      this.#controller.selectPattern(value as FireworkDesign["pattern"]);
    } else if (name === "size") {
      this.#controller.updateSize(value as FireworkDesign["sizeClass"]);
    } else if (
      name.startsWith("layer-") ||
      name.startsWith("pattern-") ||
      name.startsWith("child-") ||
      name === "branch-count" ||
      name === "spatial-color"
    ) {
      this.#changeSelectedLayer(name, value, input.dataset.group);
    } else if (name.startsWith("star-")) {
      this.#changeSelectedStar(name, value, input.dataset.stage);
    }
  };

  readonly #handleDragStart = (event: DragEvent): void => {
    const button = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-star-id]",
    );
    if (!button?.dataset.starId || !event.dataTransfer) return;
    event.dataTransfer.setData("text/x-codex-star", button.dataset.starId);
    event.dataTransfer.effectAllowed = "copy";
  };

  readonly #handleDragOver = (event: DragEvent): void => {
    if ((event.target as HTMLElement).closest("[data-drop-zone='assembly']")) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    }
  };

  readonly #handleDrop = (event: DragEvent): void => {
    if (!(event.target as HTMLElement).closest("[data-drop-zone='assembly']")) {
      return;
    }
    event.preventDefault();
    const starId = event.dataTransfer?.getData("text/x-codex-star");
    if (starId) this.#assignStar(starId);
  };

  readonly #handleKeyDown = (event: KeyboardEvent): void => {
    const command = event.metaKey || event.ctrlKey;
    if (command && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) this.#controller.document.redo();
      else this.#controller.document.undo();
    } else if (event.key === "Escape") {
      this.#patternTool = "select";
      this.#render();
    } else if (
      event.key === "Delete" &&
      !(event.target instanceof HTMLInputElement) &&
      !(event.target instanceof HTMLSelectElement)
    ) {
      const layerId = this.#snapshot?.selection.layerId;
      if (layerId) this.#deleteLayer(layerId);
    }
  };

  #updateLayer(
    layerId: string,
    label: string,
    recipe: (layer: FireworkLayer) => void,
  ): void {
    this.#controller.document.update(label, (draft) => {
      const layer = draft.layers.find((candidate) => candidate.id === layerId);
      if (!layer || layer.locked) return;
      recipe(layer);
    });
  }

  #moveLayer(layerId: string, offset: number): void {
    this.#controller.document.update("レイヤーを並べ替え", (draft) => {
      const index = draft.layers.findIndex((layer) => layer.id === layerId);
      const target = index + offset;
      if (index < 0 || target < 0 || target >= draft.layers.length) return;
      const [layer] = draft.layers.splice(index, 1);
      draft.layers.splice(target, 0, layer);
    });
  }

  #addCore(): void {
    const draft = this.#controller.document.draft;
    const coreCount = draft.layers.filter(
      (layer) => layer.kind === "spherical" && layer.name.startsWith("芯"),
    ).length;
    if (coreCount >= 2) {
      this.#callbacks.onToast("Phase 6.5では芯は2層までです");
      return;
    }
    const id = `layer-core-${coreCount + 1}-${draft.assemblySeed}`;
    this.#controller.document.update("芯レイヤーを追加", (next) => {
      const layer: SphericalStarLayer = {
        coloring: { mode: "layer" },
        count: 42 + coreCount * 18,
        defaultStarId: coreCount === 0 ? "star-gold" : "star-change-blue",
        id,
        ignitionOffset: 0,
        jitter: 0.01,
        kind: "spherical",
        locked: false,
        missingRate: 0,
        name: `芯 ${coreCount + 1}`,
        overrides: [],
        placement: "fibonacci",
        placementSeed: next.assemblySeed + 400 + coreCount,
        radialSpeedScale: coreCount === 0 ? 0.38 : 0.66,
        radius: coreCount === 0 ? 0.38 : 0.66,
        visible: true,
      };
      next.layers.splice(Math.min(coreCount + 1, next.layers.length), 0, layer);
    });
    this.#controller.document.selectLayer(id);
  }

  #addPattern(): void {
    const draft = this.#controller.document.draft;
    const id = `layer-pattern-${draft.layers.length + 1}`;
    this.#view = "pattern";
    this.#controller.document.update("型物レイヤーを追加", (next) => {
      next.layers.push({
        allowedAngle: 35,
        defaultStarId: "star-solid-red",
        depth: 0.04,
        facingPolicy: "audience",
        groups: defaultGroups("heart"),
        id,
        ignitionOffset: 0,
        kind: "pattern",
        locked: false,
        name: "2色のハート型物",
        orientationDegrees: 0,
        points: createHeartPoints(72),
        radialSpeedScale: 0.88,
        rotationJitter: 8,
        template: "heart",
        visible: true,
      });
    });
    this.#controller.document.selectLayer(id);
    this.#render();
  }

  #addChild(): void {
    const draft = this.#controller.document.draft;
    const childCount = draft.layers.filter(
      (layer) => layer.kind === "child",
    ).length;
    const id = `layer-child-${childCount + 1}`;
    this.#controller.document.update("子花レイヤーを追加", (next) => {
      const layer: ChildBurstLayer = {
        count: 12,
        defaultStarId: "star-child",
        delay: 0.58,
        id,
        ignitionOffset: 0,
        kind: "child",
        locked: false,
        name: "時間差を持つ千輪",
        placement: "sphere",
        radialSpeedScale: 1,
        scale: 0.32,
        visible: true,
        waveDelay: 0.018,
      };
      next.layers.push(layer);
    });
    this.#controller.document.selectLayer(id);
  }

  #duplicateLayer(layerId: string): void {
    const source = this.#controller.document.draft.layers.find(
      (layer) => layer.id === layerId,
    );
    if (!source) return;
    const id = `${source.id}-copy-${this.#controller.document.draft.layers.length}`;
    this.#controller.document.update("レイヤーを複製", (draft) => {
      const index = draft.layers.findIndex((layer) => layer.id === layerId);
      draft.layers.splice(index + 1, 0, {
        ...structuredClone(source),
        id,
        locked: false,
        name: `${source.name} 複製`,
      });
    });
    this.#controller.document.selectLayer(id);
  }

  #deleteLayer(layerId: string): void {
    const draft = this.#controller.document.draft;
    const layer = draft.layers.find((candidate) => candidate.id === layerId);
    if (!layer || layer.locked) return;
    if (draft.layers.length <= 1) {
      this.#callbacks.onToast("外周レイヤーは残してください");
      return;
    }
    this.#controller.document.update("レイヤーを削除", (next) => {
      next.layers = next.layers.filter((candidate) => candidate.id !== layerId);
    });
  }

  #assignStar(starId: string): void {
    const layerId = this.#snapshot?.selection.layerId;
    if (!layerId) return;
    this.#controller.document.selectStarDefinition(starId);
    this.#updateLayer(layerId, "仮想星を配置", (layer) => {
      layer.defaultStarId = starId;
      if (layer.kind === "spherical" && layer.coloring.mode !== "layer") {
        layer.coloring.alternateStarId = starId;
      }
    });
    this.#callbacks.onToast("選択レイヤーへ仮想星を列詰めしました");
  }

  #autoArrange(): void {
    const layerId = this.#snapshot?.selection.layerId;
    if (!layerId) return;
    this.#updateLayer(layerId, "均等球面へ自動整列", (layer) => {
      if (layer.kind === "spherical") {
        layer.placement = "fibonacci";
        layer.overrides = [];
        layer.jitter = Math.min(layer.jitter, 0.03);
      }
    });
    this.#callbacks.onToast("固定seedで均等球面へ整列しました");
  }

  #simplify(): void {
    this.#controller.document.update("描画負荷を自動簡略化", (draft) => {
      const childLayers = draft.layers.filter(
        (layer): layer is ChildBurstLayer => layer.kind === "child",
      );
      childLayers.forEach((layer) => {
        layer.count = Math.min(layer.count, 24);
      });
      draft.layers.forEach((layer) => {
        if (layer.kind === "spherical")
          layer.count = Math.min(layer.count, 520);
        if (layer.kind === "branch")
          layer.starsPerBranch = Math.min(layer.starsPerBranch, 28);
      });
    });
    this.#callbacks.onToast("層構成を保ったまま星数を簡略化しました");
  }

  #confirm(): void {
    const snapshot = this.#snapshot;
    if (!snapshot) return;
    if (snapshot.diagnostic.estimatedCost.maximumParticles > 6_000) {
      this.#view = "diagnostic";
      this.#render();
      this.#callbacks.onToast(
        "実行上限を超えています。自動簡略化を実行してください",
      );
      return;
    }
    const visibleName = this.element.querySelector<HTMLInputElement>(
      "input[name='design-name']",
    )?.value;
    if (visibleName !== undefined && visibleName !== snapshot.draft.name) {
      this.#controller.updateName(visibleName);
    }
    const saved = this.#controller.save();
    this.#launchReady = saved;
    this.#callbacks.onDesignLibraryChange(this.#controller.savedDesigns);
    this.#callbacks.onToast(`「${saved.name}」の制作を確定しました`);
    this.#render();
  }

  #changeSelectedLayer(name: string, value: string, groupId?: string): void {
    const layerId = this.#snapshot?.selection.layerId;
    if (!layerId) return;
    this.#updateLayer(layerId, "配置属性を変更", (layer) => {
      if (name === "layer-name") layer.name = value;
      else if (name === "layer-star") layer.defaultStarId = value;
      else if (layer.kind === "spherical") {
        if (name === "layer-count") layer.count = Number(value);
        else if (name === "layer-radius") {
          layer.radius = Number(value) / 100;
          layer.radialSpeedScale = layer.radius;
        } else if (name === "spatial-color")
          layer.coloring.mode = value as SphericalStarLayer["coloring"]["mode"];
      } else if (layer.kind === "pattern") {
        if (name === "pattern-depth") layer.depth = Number(value) / 100;
        else if (name === "pattern-facing")
          layer.facingPolicy = value as typeof layer.facingPolicy;
        else if (name === "pattern-group-star" && groupId) {
          const group = layer.groups.find(
            (candidate) => candidate.id === groupId,
          );
          if (group) group.starId = value;
        }
      } else if (layer.kind === "child") {
        if (name === "child-count") layer.count = Number(value);
      } else if (name === "branch-count") layer.branchCount = Number(value);
    });
  }

  #changeSelectedStar(name: string, value: string, stageValue?: string): void {
    const starId =
      this.#snapshot?.selection.starDefinitionId ??
      this.#controller.document.selectedLayer?.defaultStarId;
    if (!starId) return;
    this.#controller.document.update("仮想星の発光を変更", (draft) => {
      const star = draft.starDefinitions[starId];
      if (!star) return;
      if (name === "star-name") star.displayName = value;
      else if (name === "star-stage-color" && stageValue !== undefined) {
        const color = Number.parseInt(value.slice(1), 16);
        const stage = star.colorStages[Number(stageValue)];
        if (stage) {
          stage.color = color;
          stage.trailColor = color;
        }
      } else if (name === "star-stage-time" && stageValue !== undefined) {
        const stage = star.colorStages[Number(stageValue)];
        if (stage) stage.normalizedTime = Number(value) / 100;
        star.colorStages.sort((a, b) => a.normalizedTime - b.normalizedTime);
      }
    });
  }

  #addStarStage(): void {
    const starId =
      this.#snapshot?.selection.starDefinitionId ??
      this.#controller.document.selectedLayer?.defaultStarId;
    if (!starId) return;
    this.#controller.document.update("色段階を追加", (draft) => {
      const star = draft.starDefinitions[starId];
      if (!star || star.colorStages.length >= 4) return;
      const last = star.colorStages.at(-1);
      star.colorStages.push({
        color: last?.color ?? 0xffffff,
        intensity: 0.5,
        normalizedTime: clamp((last?.normalizedTime ?? 0.5) * 0.75, 0.1, 0.95),
        trailColor: last?.trailColor ?? 0xffffff,
      });
      star.colorStages.sort((a, b) => a.normalizedTime - b.normalizedTime);
    });
  }

  #duplicateStar(): void {
    const sourceId =
      this.#snapshot?.selection.starDefinitionId ??
      this.#controller.document.selectedLayer?.defaultStarId;
    if (!sourceId) return;
    const id = `${sourceId}-copy-${Object.keys(this.#controller.document.draft.starDefinitions).length}`;
    this.#controller.document.update("仮想星を複製", (draft) => {
      const source = draft.starDefinitions[sourceId];
      if (!source) return;
      draft.starDefinitions[id] = {
        ...structuredClone(source),
        displayName: `${source.displayName} 複製`,
        id,
      };
    });
    this.#controller.document.selectStarDefinition(id);
    this.#callbacks.onToast("仮想星を作品内へ複製しました");
  }

  #removeStarStage(index: number): void {
    const starId =
      this.#snapshot?.selection.starDefinitionId ??
      this.#controller.document.selectedLayer?.defaultStarId;
    if (!starId) return;
    this.#controller.document.update("色段階を削除", (draft) => {
      const stages = draft.starDefinitions[starId]?.colorStages;
      if (stages && stages.length > 1) stages.splice(index, 1);
    });
  }

  #applyPatternTemplate(templateName: string): void {
    const layerId = this.#snapshot?.selection.layerId;
    if (!layerId) return;
    const template = ["heart", "circle", "smile"].includes(templateName)
      ? (templateName as "heart" | "circle" | "smile")
      : "heart";
    this.#updateLayer(layerId, "型物テンプレートを変更", (layer) => {
      if (layer.kind !== "pattern") return;
      layer.template = template;
      layer.points =
        template === "heart"
          ? createHeartPoints(72)
          : template === "smile"
            ? smilePoints()
            : circlePoints();
      layer.groups = defaultGroups(template);
      layer.defaultStarId = layer.groups[0]?.starId ?? layer.defaultStarId;
    });
  }

  #addPatternPoints(event: MouseEvent, canvas: SVGSVGElement): void {
    const layerId = this.#snapshot?.selection.layerId;
    if (!layerId) return;
    const bounds = canvas.getBoundingClientRect();
    const x = clamp(
      ((event.clientX - bounds.left) / bounds.width - 0.5) * 2.5,
      -1,
      1,
    );
    const y = clamp(
      (0.5 - (event.clientY - bounds.top) / bounds.height) * 2.5,
      -1,
      1,
    );
    this.#updateLayer(layerId, `${this.#patternTool}で型物を編集`, (layer) => {
      if (layer.kind !== "pattern") return;
      layer.template = "custom";
      if (!layer.groups.some((group) => group.id === "custom")) {
        layer.groups.push({
          id: "custom",
          name: "手描き",
          starId: layer.defaultStarId,
        });
      }
      if (this.#patternTool === "pen") {
        layer.points.push({ groupId: "custom", x, y });
      } else if (this.#patternTool === "line") {
        for (let index = 0; index < 16; index += 1) {
          const progress = index / 15;
          layer.points.push({
            groupId: "custom",
            x: x * progress,
            y: y * progress,
          });
        }
      } else if (this.#patternTool === "circle") {
        for (let index = 0; index < 32; index += 1) {
          const angle = (index / 32) * Math.PI * 2;
          layer.points.push({
            groupId: "custom",
            x: clamp(x + Math.cos(angle) * 0.22, -1, 1),
            y: clamp(y + Math.sin(angle) * 0.22, -1, 1),
          });
        }
      } else if (this.#patternTool === "bezier") {
        for (let index = 0; index < 24; index += 1) {
          const t = index / 23;
          const inverse = 1 - t;
          layer.points.push({
            groupId: "custom",
            x:
              inverse ** 3 * -0.8 +
              3 * inverse ** 2 * t * -0.2 +
              3 * inverse * t ** 2 * 0.5 +
              t ** 3 * x,
            y:
              inverse ** 3 * -0.5 +
              3 * inverse ** 2 * t * 0.8 +
              3 * inverse * t ** 2 * -0.8 +
              t ** 3 * y,
          });
        }
      }
      if (layer.points.length > 600) layer.points = layer.points.slice(-600);
    });
  }
}
