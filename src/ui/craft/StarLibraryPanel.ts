import type { FireworkDesign, VirtualStarPreset } from "../../data";
import { colorToCSS, escapeHTML } from "./viewUtils";

function emissionLabel(star: VirtualStarPreset): string {
  if (star.emissionKind === "point") return "点光";
  if (star.emissionKind === "child") return "子花";
  if (star.emissionKind === "flicker") return "点滅";
  return "尾あり";
}

function renderSpreadBalloon(star: VirtualStarPreset): string {
  const colors = star.colorStages
    .slice(0, 4)
    .map((stage) => colorToCSS(stage.color));
  const tail = star.emissionKind.includes("Tail");
  const rays = Array.from({ length: tail ? 12 : 18 }, (_, index) => {
    const angle = (index / (tail ? 12 : 18)) * Math.PI * 2;
    const inner = 18;
    const outer = tail ? 58 : 46;
    return `<line x1="${80 + Math.cos(angle) * inner}" y1="${58 + Math.sin(angle) * inner}" x2="${80 + Math.cos(angle) * outer}" y2="${58 + Math.sin(angle) * outer}" style="--ray:${colors[index % colors.length]}" />`;
  }).join("");
  return `<aside class="star-spread-balloon" role="dialog" aria-label="${escapeHTML(star.displayName)}の抽象プレビュー">
    <strong>${escapeHTML(star.displayName)}</strong>
    <svg viewBox="0 0 160 116" aria-hidden="true"><g>${rays}</g><circle cx="80" cy="58" r="8" style="--star:${colors[0]}" /></svg>
    <div>${colors.map((color, index) => `<i style="--stage:${color}"><span>${index + 1}</span></i>`).join("")}</div>
    <p>${emissionLabel(star)} · ${tail ? "尾を引く" : "粒で広がる"}</p>
  </aside>`;
}

export function renderStarLibraryPanel(
  design: FireworkDesign,
  selectedStarId: string | undefined,
  previewStarId: string | undefined,
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
              <span>${escapeHTML(star.displayName)}</span><small>${emissionLabel(star)}</small>
            </button>
            <button type="button" data-action="preview-star" data-star-id="${star.id}" aria-label="${escapeHTML(star.displayName)}の広がりを見る">広がりを見る</button>
            ${previewStarId === star.id ? renderSpreadBalloon(star) : ""}
          </article>`,
        )
        .join("")}
    </div>
  </section>`;
}
