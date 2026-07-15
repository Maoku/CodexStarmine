import type { EditorDiagnostic } from "../../modes/craft";
import { colorToCSS, escapeHTML } from "./viewUtils";

export function renderDiagnosticView(
  diagnostic: EditorDiagnostic,
  compareRows: { label: string; a: string; b: string }[] = [],
): string {
  const maxTime = Math.max(
    ...diagnostic.timings.map((item) => item.start + item.duration),
    1,
  );
  const colors = diagnostic.colors
    .slice(0, 24)
    .map(
      (item) =>
        `<span class="diagnostic-color" style="--chip:${colorToCSS(item.color)}" title="${escapeHTML(item.label)}・${item.time.toFixed(2)}秒"></span>`,
    )
    .join("");
  const directions = diagnostic.directions
    .map(
      (item) =>
        `<div><span>${escapeHTML(item.label)}</span><strong>${item.value}</strong><i style="--amount:${Math.min(item.value / Math.max(diagnostic.estimatedCost.starCount, 1), 1)}"></i></div>`,
    )
    .join("");
  const timings = diagnostic.timings
    .map(
      (item) =>
        `<span style="--start:${item.start / maxTime};--duration:${item.duration / maxTime};--timing-color:${colorToCSS(item.color)}"><b>${escapeHTML(item.label)}</b></span>`,
    )
    .join("");
  const warnings = diagnostic.warnings.length
    ? `<ul class="diagnostic-warnings">${diagnostic.warnings.map((warning) => `<li>${escapeHTML(warning)}</li>`).join("")}</ul>`
    : `<p class="diagnostic-ok">色・方向・発火時刻の整合性に問題はありません。</p>`;
  const comparison = compareRows.length
    ? `<table class="ab-table"><thead><tr><th>構成差</th><th>A</th><th>B</th></tr></thead><tbody>${compareRows.map((row) => `<tr><th>${escapeHTML(row.label)}</th><td>${escapeHTML(row.a)}</td><td>${escapeHTML(row.b)}</td></tr>`).join("")}</tbody></table>`
    : `<p class="ab-empty">下部の A / B ボタンで現在の簡易検査を固定すると、構成差だけを比較できます。</p>`;
  return `
    <div class="diagnostic-view">
      <section><header><span>COLOR ORDER</span><strong>色列</strong></header><div class="diagnostic-colors">${colors}</div></section>
      <section><header><span>DIRECTION BINS</span><strong>方向</strong></header><div class="diagnostic-directions">${directions}</div></section>
      <section><header><span>IGNITION ONLY</span><strong>発火タイムライン</strong></header><div class="diagnostic-timeline">${timings}</div></section>
      <section><header><span>LOAD</span><strong>${diagnostic.estimatedCost.maximumParticles.toLocaleString()} / 6,000 星</strong></header>${warnings}</section>
      <section><header><span>A / B</span><strong>構成比較</strong></header>${comparison}</section>
      <footer>位置・軌跡・落下・煙・音・完成輪郭は簡易確認に含まれません。</footer>
    </div>`;
}
