import {
  renderApproximateSpread,
  type ApproximateSpreadModel,
} from "../../render/preview/ApproximateSpreadRenderer";

export function renderInlineDiagnosticPreview(
  model: ApproximateSpreadModel,
  running: boolean,
  revision: number,
): string {
  return `<section class="craft-card inline-diagnostic-preview" aria-labelledby="inline-preview-title">
    <header><span id="inline-preview-title">配置全体の簡易確認</span><strong>抽象表示</strong></header>
    <div class="inline-preview-canvas">${renderApproximateSpread(model, running, revision)}</div>
    <footer>
      <button type="button" data-action="toggle-preview">${running ? "一時停止" : "再生"}</button>
      <button type="button" data-action="reset-preview">先頭へ</button>
      <span>${model.layerCount} レイヤー</span>
    </footer>
  </section>`;
}
