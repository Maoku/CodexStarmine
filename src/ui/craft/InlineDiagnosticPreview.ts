import {
  renderCompiledBurstPreview,
  type CompiledBurstPreviewModel,
} from "../../render/preview/CompiledBurstPreviewRenderer";

export function renderInlineDiagnosticPreview(
  model: CompiledBurstPreviewModel,
  running: boolean,
  revision: number,
): string {
  return `<section class="craft-card inline-diagnostic-preview" aria-labelledby="inline-preview-title">
    <header><span id="inline-preview-title">打上結果プレビュー</span><strong>固定 seed</strong></header>
    <div class="inline-preview-canvas">${renderCompiledBurstPreview(model, running, revision)}</div>
    <footer>
      <button type="button" data-action="toggle-preview">${running ? "一時停止" : "再生"}</button>
      <button type="button" data-action="reset-preview">先頭へ</button>
      <span>${model.sampledStars.length} / ${model.totalStarCount} 星</span>
    </footer>
  </section>`;
}
