export type RenewalScreenKind =
  | "mode-select"
  | "library"
  | "initial-setup"
  | "editor"
  | "viewer-check"
  | "viewer-free";

/** Five mounted screen components; the viewer has check and free contexts. */
export const RENEWAL_SCREEN_COMPONENTS = [
  "mode-select",
  "library",
  "initial-setup",
  "editor",
  "viewer",
] as const;

export type RenewalNavigationAction =
  | "choose-craft"
  | "choose-free"
  | "create-design"
  | "edit-design"
  | "cancel-setup"
  | "begin-editing"
  | "check-on-lake"
  | "back-to-editor"
  | "back-to-library"
  | "save-to-library"
  | "back-to-mode-select";

export interface RenewalScreenTransition {
  readonly action: RenewalNavigationAction;
  readonly dirtyGuard: boolean;
  readonly from: RenewalScreenKind;
  readonly to: RenewalScreenKind;
}

/**
 * Navigation acceptance matrix fixed before the renewal UI is introduced.
 * Phase 1's flow controller must implement these routes without adding hidden
 * cross-screen shortcuts.
 */
export const RENEWAL_SCREEN_TRANSITIONS = [
  {
    action: "choose-craft",
    dirtyGuard: false,
    from: "mode-select",
    to: "library",
  },
  {
    action: "choose-free",
    dirtyGuard: false,
    from: "mode-select",
    to: "viewer-free",
  },
  {
    action: "create-design",
    dirtyGuard: false,
    from: "library",
    to: "initial-setup",
  },
  {
    action: "edit-design",
    dirtyGuard: false,
    from: "library",
    to: "editor",
  },
  {
    action: "cancel-setup",
    dirtyGuard: false,
    from: "initial-setup",
    to: "library",
  },
  {
    action: "begin-editing",
    dirtyGuard: false,
    from: "initial-setup",
    to: "editor",
  },
  {
    action: "check-on-lake",
    dirtyGuard: false,
    from: "editor",
    to: "viewer-check",
  },
  {
    action: "back-to-editor",
    dirtyGuard: false,
    from: "viewer-check",
    to: "editor",
  },
  {
    action: "back-to-library",
    dirtyGuard: true,
    from: "editor",
    to: "library",
  },
  {
    action: "save-to-library",
    dirtyGuard: false,
    from: "editor",
    to: "library",
  },
  {
    action: "back-to-mode-select",
    dirtyGuard: false,
    from: "library",
    to: "mode-select",
  },
  {
    action: "back-to-mode-select",
    dirtyGuard: false,
    from: "viewer-free",
    to: "mode-select",
  },
] as const satisfies readonly RenewalScreenTransition[];

export type RenewalPreviewKind =
  "virtual-star-balloon" | "inline-diagnostic" | "lake-check" | "free-show";

export interface RenewalPreviewResponsibility {
  readonly input:
    "single-star" | "draft-aggregate" | "single-design" | "show-plan";
  readonly kind: RenewalPreviewKind;
  readonly renderer: "abstract-2d" | "firework-system";
  readonly result: "abstract" | "production";
}

/** Rendering ownership matrix used by Phase 4 and Phase 5 regression tests. */
export const RENEWAL_PREVIEW_RESPONSIBILITIES = [
  {
    input: "single-star",
    kind: "virtual-star-balloon",
    renderer: "abstract-2d",
    result: "abstract",
  },
  {
    input: "draft-aggregate",
    kind: "inline-diagnostic",
    renderer: "abstract-2d",
    result: "abstract",
  },
  {
    input: "single-design",
    kind: "lake-check",
    renderer: "firework-system",
    result: "production",
  },
  {
    input: "show-plan",
    kind: "free-show",
    renderer: "firework-system",
    result: "production",
  },
] as const satisfies readonly RenewalPreviewResponsibility[];

export type Renewal2AcceptanceId =
  | "R2-01"
  | "R2-02"
  | "R2-03"
  | "R2-04"
  | "R2-05"
  | "R2-06"
  | "R2-07"
  | "R2-08"
  | "R2-09"
  | "R2-10"
  | "R2-11"
  | "R2-12"
  | "R2-13"
  | "R2-14"
  | "R2-15"
  | "R2-16";

export interface Renewal2AcceptanceContract {
  readonly evidence: readonly (
    "unit" | "dom" | "browser" | "screenshot" | "migration"
  )[];
  readonly id: Renewal2AcceptanceId;
  readonly requirement: string;
  readonly phase: 1 | 2 | 3 | 4 | 5 | 6;
}

/** RENEWAL_PLAN2.md requirements tracked before Renewal2 implementation. */
export const RENEWAL2_ACCEPTANCE_CONTRACTS = [
  {
    id: "R2-01",
    requirement: "店名削除",
    phase: 1,
    evidence: ["dom", "browser"],
  },
  { id: "R2-02", requirement: "タイトル文言削除", phase: 1, evidence: ["dom"] },
  {
    id: "R2-03",
    requirement: "アドバタイズデモ",
    phase: 1,
    evidence: ["unit", "browser"],
  },
  {
    id: "R2-04",
    requirement: "バルーン欠け",
    phase: 6,
    evidence: ["browser", "screenshot"],
  },
  {
    id: "R2-05",
    requirement: "作品情報を上部へ",
    phase: 3,
    evidence: ["dom", "screenshot"],
  },
  { id: "R2-06", requirement: "不要説明削除", phase: 3, evidence: ["dom"] },
  {
    id: "R2-07",
    requirement: "レイヤー操作集約",
    phase: 3,
    evidence: ["dom", "browser"],
  },
  {
    id: "R2-08",
    requirement: "3編集方式を複数設定",
    phase: 3,
    evidence: ["unit", "browser"],
  },
  {
    id: "R2-09",
    requirement: "生成点を個別操作不可",
    phase: 5,
    evidence: ["unit", "browser"],
  },
  {
    id: "R2-10",
    requirement: "型物形状はワークベンチ",
    phase: 5,
    evidence: ["dom"],
  },
  {
    id: "R2-11",
    requirement: "XY/XZ断面",
    phase: 4,
    evidence: ["unit", "browser"],
  },
  {
    id: "R2-12",
    requirement: "ハート修正",
    phase: 5,
    evidence: ["unit", "screenshot"],
  },
  {
    id: "R2-13",
    requirement: "型物サイズ変更",
    phase: 5,
    evidence: ["unit", "browser"],
  },
  {
    id: "R2-14",
    requirement: "手動便利配置",
    phase: 5,
    evidence: ["unit", "browser"],
  },
  {
    id: "R2-15",
    requirement: "簡易確認を常時表示",
    phase: 6,
    evidence: ["browser", "screenshot"],
  },
  { id: "R2-16", requirement: "非破壊保存", phase: 2, evidence: ["migration"] },
] as const satisfies readonly Renewal2AcceptanceContract[];

export type LayerAuthoringModeContract = "preset" | "pattern" | "manual";

export interface LayerEditingPermissionContract {
  readonly canDeletePoint: boolean;
  readonly canMovePoint: boolean;
  readonly canReplacePointStar: boolean;
  readonly mode: LayerAuthoringModeContract;
  readonly parameterEditing: boolean;
}

/** Generated layers expose parameters; only manual layers own editable points. */
export const RENEWAL2_LAYER_EDITING_PERMISSIONS = [
  {
    mode: "preset",
    parameterEditing: true,
    canMovePoint: false,
    canDeletePoint: false,
    canReplacePointStar: false,
  },
  {
    mode: "pattern",
    parameterEditing: true,
    canMovePoint: false,
    canDeletePoint: false,
    canReplacePointStar: false,
  },
  {
    mode: "manual",
    parameterEditing: true,
    canMovePoint: true,
    canDeletePoint: true,
    canReplacePointStar: true,
  },
] as const satisfies readonly LayerEditingPermissionContract[];

export type BackgroundRuntime = "advertise" | "check" | "free" | "none";

/** One screen owns at most one cue-producing background runtime. */
export const RENEWAL2_BACKGROUND_RUNTIME_BY_SCREEN = {
  editor: "none",
  "initial-setup": "none",
  library: "none",
  "mode-select": "advertise",
  "viewer-check": "check",
  "viewer-free": "free",
} as const satisfies Record<RenewalScreenKind, BackgroundRuntime>;
