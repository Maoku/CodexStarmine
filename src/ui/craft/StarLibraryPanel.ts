import type { FireworkDesign, VirtualStarPreset } from "../../data";
import { evaluateVirtualStarAppearance } from "../../core/particle";
import { colorToCSS, escapeHTML } from "./viewUtils";

function emissionLabel(star: VirtualStarPreset): string {
  if (star.emissionKind === "point") return "点光";
  if (star.emissionKind === "child") return "子花";
  if (star.emissionKind === "flicker") return "点滅";
  return "尾あり";
}

export function virtualStarEffectTags(star: VirtualStarPreset): string[] {
  const tags: string[] = [];
  const color = star.effectProfile?.color;
  const light = star.effectProfile?.light;
  const motion = star.effectProfile?.motion;
  const secondary = star.effectProfile?.secondary;
  if (color?.mode === "step") tags.push("段階変色");
  if (color?.playback === "loop") tags.push("反復変色");
  if (color?.playback === "pingPong") tags.push("往復変色");
  if (light?.mode === "strobe") {
    tags.push(`${light.frequencyHz ?? 6}Hz点滅`);
  }
  if (light?.terminal?.mode === "kouro") tags.push("光露");
  if (light?.terminal?.mode === "teka") tags.push("輝");
  if (motion?.mode === "fallingLeaf") tags.push("葉落");
  if (motion?.mode === "wander") tags.push("遊泳");
  if (motion?.mode === "spiral") tags.push("旋回");
  if (secondary?.mode === "spark") tags.push("終端火花");
  if (secondary?.mode === "microBurst") tags.push("小分裂");
  if (star.trailLifetime > 0.24) tags.push("尾あり");
  return tags.length > 0 ? tags : [emissionLabel(star)];
}

function representativeAppearance(star: VirtualStarPreset) {
  const samples = [0.58, 0.12, 0.32, 0.72];
  return samples
    .map((normalizedAge) =>
      evaluateVirtualStarAppearance({
        ageSeconds: star.burnDuration * normalizedAge,
        colorStages: star.colorStages,
        effectPhase: 0,
        effectProfile: star.effectProfile,
        effectSeed: 1,
        legacyFlicker: star.flicker,
        lifetimeSeconds: star.burnDuration,
      }),
    )
    .reduce((best, appearance) =>
      appearance.lightMultiplier * appearance.intensity >
      best.lightMultiplier * best.intensity
        ? appearance
        : best,
    );
}

export interface PreviewAnchorRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface StarPreviewPosition {
  placement: "above" | "below";
  x: number;
  y: number;
}

export function computeStarPreviewPosition(
  anchor: PreviewAnchorRect,
  viewport: { height: number; width: number },
  preview = { height: 390, width: 260 },
): StarPreviewPosition {
  const gap = 10;
  const inset = 8;
  const placement =
    anchor.top >= preview.height + gap ||
    viewport.height - anchor.bottom < preview.height + gap
      ? "above"
      : "below";
  const preferredX = anchor.right - preview.width;
  return {
    placement,
    x: Math.min(
      Math.max(preferredX, inset),
      Math.max(viewport.width - preview.width - inset, inset),
    ),
    y: Math.min(
      Math.max(
        placement === "above"
          ? anchor.top - preview.height - gap
          : anchor.bottom + gap,
        inset,
      ),
      Math.max(viewport.height - preview.height - inset, inset),
    ),
  };
}

function renderSpreadBalloon(
  star: VirtualStarPreset,
  position: StarPreviewPosition,
): string {
  const colors = star.colorStages
    .slice(0, 4)
    .map((stage) => colorToCSS(stage.color));
  const tags = virtualStarEffectTags(star);
  const appearance = representativeAppearance(star);
  const fallbackColor = colorToCSS(appearance.color);
  const rays = Array.from({ length: 16 }, (_, index) => {
    const angle = (index / 16) * Math.PI * 2;
    const inner = 14;
    const outer = star.trailLifetime > 0.24 ? 53 : 43;
    return `<line x1="${80 + Math.cos(angle) * inner}" y1="${58 + Math.sin(angle) * inner}" x2="${80 + Math.cos(angle) * outer}" y2="${58 + Math.sin(angle) * outer}" style="--ray:${colors[index % colors.length]}" />`;
  }).join("");
  return `<div class="star-preview-overlay" data-preview-placement="${position.placement}" style="--preview-x:${position.x}px;--preview-y:${position.y}px">
    <button class="star-preview-scrim" type="button" data-action="close-star-preview" aria-label="仮想星プレビューを閉じる" tabindex="-1"></button>
    <aside class="star-spread-balloon" role="dialog" aria-modal="true" aria-label="${escapeHTML(star.displayName)}の挙動サンプル" tabindex="-1">
    <header><strong>${escapeHTML(star.displayName)}</strong><button type="button" data-action="close-star-preview" aria-label="閉じる">×</button></header>
    <div class="star-behavior-preview" data-star-behavior-preview role="img" aria-label="${escapeHTML(star.displayName)}。${escapeHTML(tags.join("、"))}の挙動サンプル">
      <div class="star-behavior-preview-host" data-star-behavior-preview-host></div>
      <div class="star-behavior-preview-fallback" data-star-behavior-preview-fallback>
        <svg viewBox="0 0 160 116" aria-hidden="true"><g>${rays}</g><circle cx="80" cy="58" r="8" style="--star:${fallbackColor}" /></svg>
        <span>簡易表示</span>
      </div>
    </div>
    <div class="star-effect-tags">${tags.map((tag) => `<span>${escapeHTML(tag)}</span>`).join("")}</div>
    <div class="star-color-stages" aria-label="色段階">${colors.map((color, index) => `<i style="--stage:${color}"><span>${index + 1}</span></i>`).join("")}</div>
    <p>挙動サンプル。完成形は打上結果プレビューで確認</p>
    <div class="star-preview-controls" aria-label="プレビュー操作">
      <button type="button" data-action="toggle-star-behavior-preview">一時停止</button>
      <button type="button" data-action="restart-star-behavior-preview">最初から</button>
    </div>
  </aside></div>`;
}

export function renderStarPreviewOverlay(
  design: FireworkDesign,
  previewStarId: string | undefined,
  position: StarPreviewPosition | undefined,
): string {
  if (!previewStarId || !position) return "";
  const star = design.starDefinitions[previewStarId];
  return star ? renderSpreadBalloon(star, position) : "";
}

export function renderStarLibraryPanel(
  design: FireworkDesign,
  selectedStarId: string | undefined,
): string {
  return `<section class="craft-card star-tray-card integrated-star-library">
    <header><span>仮想星の部品皿</span><strong>長押しで確認</strong></header>
    <div class="star-tray">
      ${Object.values(design.starDefinitions)
        .map(
          (
            star,
          ) => `<article class="star-part ${star.id === selectedStarId ? "is-selected" : ""}" data-star-part="${star.id}">
            <button type="button" draggable="true" data-action="assign-star" data-star-id="${star.id}" aria-label="${escapeHTML(star.displayName)}を配置" aria-pressed="${star.id === selectedStarId}">
              <i style="--star:${colorToCSS(star.colorStages[1]?.color ?? star.colorStages[0]?.color ?? 0xffffff)}"></i>
              <span>${escapeHTML(star.displayName)}</span><small>${escapeHTML(virtualStarEffectTags(star)[0])}</small>
            </button>
            <button type="button" data-action="preview-star" data-star-id="${star.id}" aria-label="${escapeHTML(star.displayName)}の広がりを見る">広がりを見る</button>
          </article>`,
        )
        .join("")}
    </div>
  </section>`;
}
