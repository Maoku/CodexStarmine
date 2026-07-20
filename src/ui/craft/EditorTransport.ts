import { escapeHTML } from "./viewUtils";

export type EditorLoadLevel = "good" | "warning" | "overload";
export type EditorMessageKind = "status" | "tip" | "warning";

export interface EditorTransportModel {
  canRedo: boolean;
  canUndo: boolean;
  dirty: boolean;
  load: {
    level: EditorLoadLevel;
    limit: number;
    maximumParticles: number;
  };
  message: {
    kind: EditorMessageKind;
    text: string;
  };
}

const LOAD_LABELS: Readonly<Record<EditorLoadLevel, string>> = {
  good: "良好",
  warning: "注意",
  overload: "超過",
};

const MESSAGE_LABELS: Readonly<Record<EditorMessageKind, string>> = {
  status: "状態",
  tip: "TIPS",
  warning: "注意",
};

export function editorLoadLevel(
  maximumParticles: number,
  limit = 6_000,
): EditorLoadLevel {
  if (maximumParticles > limit) return "overload";
  if (maximumParticles > 2_000) return "warning";
  return "good";
}

export function renderEditorTransport(model: EditorTransportModel): string {
  const particleValue = model.load.maximumParticles.toLocaleString();
  const limitValue = model.load.limit.toLocaleString();
  const loadLabel = LOAD_LABELS[model.load.level];
  const messageLabel = MESSAGE_LABELS[model.message.kind];
  const saveState = model.dirty ? "dirty" : "saved";
  const saveLabel = model.dirty
    ? "保存して棚へ（未保存の変更あり）"
    : "保存して棚へ（保存済み）";
  return `<footer class="craft-transport integrated-transport" data-editor-transport>
    <button type="button" data-action="undo" class="history-action history-action--undo" ${model.canUndo ? "" : "disabled"}>Undo</button>
    <button type="button" data-action="redo" class="history-action history-action--redo" ${model.canRedo ? "" : "disabled"}>Redo</button>
    <span class="editor-transport-message" data-editor-message data-message-kind="${model.message.kind}" role="status" aria-live="polite" aria-atomic="true"><b>${messageLabel}</b><span>${escapeHTML(model.message.text)}</span></span>
    <div class="editor-load" data-editor-load data-load-level="${model.load.level}">
      <span>負荷</span><strong>${loadLabel} · ${particleValue} / ${limitValue}</strong>
      <meter min="0" max="${model.load.limit}" low="2000" high="5500" optimum="1200" value="${model.load.maximumParticles}" aria-label="描画負荷 ${loadLabel}: 最大粒子 ${particleValue} / ${limitValue}"></meter>
      ${model.load.level === "good" ? "" : '<button type="button" data-action="simplify">自動簡略化</button>'}
    </div>
    <button type="button" data-action="save" class="secondary-save is-${saveState}" data-save-state="${saveState}" aria-label="${saveLabel}"><span>保存して棚へ</span><small>${model.dirty ? "未保存" : "保存済み"}</small></button>
    <button type="button" data-action="check" class="confirm-craft">湖面で確認</button>
  </footer>`;
}
