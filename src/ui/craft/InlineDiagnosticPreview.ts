import {
  renderCompiledBurstPreview,
  type CompiledBurstPreviewModel,
} from "../../render/preview/CompiledBurstPreviewRenderer";

export function renderInlineDiagnosticPreview(
  model: CompiledBurstPreviewModel,
  running: boolean,
  revision: number,
  expanded = false,
): string {
  return `<section class="craft-card inline-diagnostic-preview${expanded ? " is-expanded" : ""}" data-preview-dock data-preview-expanded="${expanded}" aria-labelledby="inline-preview-title">
    <header><span id="inline-preview-title">打上結果プレビュー</span><strong>固定 seed</strong><button class="preview-dock-toggle" type="button" data-action="toggle-preview-dock" aria-expanded="${expanded}">${expanded ? "縮小" : "展開"}</button></header>
    <div class="inline-preview-canvas">${renderCompiledBurstPreview(model, running, revision)}</div>
    <footer>
      <button type="button" data-action="toggle-preview">${running ? "一時停止" : "再生"}</button>
      <button type="button" data-action="reset-preview">先頭へ</button>
      <span>${model.sampledStars.length} / ${model.totalStarCount} 星</span>
    </footer>
  </section>`;
}
