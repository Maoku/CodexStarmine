export type Renewal3AcceptanceId =
  | "R3-01"
  | "R3-02"
  | "R3-03"
  | "R3-04"
  | "R3-05"
  | "R3-06"
  | "R3-07"
  | "R3-08"
  | "R3-09"
  | "R3-10"
  | "R3-11"
  | "R3-12"
  | "R3-13"
  | "R3-14"
  | "R3-15"
  | "R3-16"
  | "R3-17";

export type Renewal3Evidence =
  | "unit"
  | "dom"
  | "browser"
  | "screenshot"
  | "migration"
  | "trajectory"
  | "video"
  | "quality-gate";

export interface Renewal3AcceptanceContract {
  readonly evidence: readonly Renewal3Evidence[];
  readonly id: Renewal3AcceptanceId;
  readonly phase: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly requirement: string;
}

/** Renewal3 requirements fixed before implementation begins. */
export const RENEWAL3_ACCEPTANCE_CONTRACTS = [
  {
    id: "R3-01",
    requirement: "タイトル背景の花火",
    phase: 7,
    evidence: ["unit", "browser", "video"],
  },
  {
    id: "R3-02",
    requirement: "3D玉とXYZギズモ",
    phase: 2,
    evidence: ["unit", "browser", "screenshot"],
  },
  {
    id: "R3-03",
    requirement: "数値式の断面設定を非表示",
    phase: 2,
    evidence: ["dom", "browser"],
  },
  {
    id: "R3-04",
    requirement: "型物を切断面内で拡縮",
    phase: 3,
    evidence: ["unit", "browser"],
  },
  {
    id: "R3-05",
    requirement: "選択面へ型物を配置",
    phase: 3,
    evidence: ["unit", "trajectory"],
  },
  {
    id: "R3-06",
    requirement: "ハートを打上結果へ保持",
    phase: 3,
    evidence: ["unit", "trajectory", "browser"],
  },
  {
    id: "R3-07",
    requirement: "玉内位置を初速度へ反映",
    phase: 1,
    evidence: ["unit", "trajectory"],
  },
  {
    id: "R3-08",
    requirement: "6種の幾何テンプレート",
    phase: 3,
    evidence: ["unit", "dom", "browser"],
  },
  {
    id: "R3-09",
    requirement: "手動配置のポインター位置一致",
    phase: 4,
    evidence: ["unit", "browser"],
  },
  {
    id: "R3-10",
    requirement: "手動配置支援",
    phase: 4,
    evidence: ["unit", "browser"],
  },
  {
    id: "R3-11",
    requirement: "previewとcheckの軌道同一性",
    phase: 5,
    evidence: ["unit", "trajectory"],
  },
  {
    id: "R3-12",
    requirement: "確認画面の自由視点",
    phase: 6,
    evidence: ["unit", "browser"],
  },
  {
    id: "R3-13",
    requirement: "月と月光表現を削除",
    phase: 6,
    evidence: ["unit", "dom", "browser"],
  },
  {
    id: "R3-14",
    requirement: "湖面の周期模様を改善",
    phase: 6,
    evidence: ["unit", "video"],
  },
  {
    id: "R3-15",
    requirement: "schema v1-v4の非破壊保存",
    phase: 7,
    evidence: ["migration", "unit"],
  },
  {
    id: "R3-16",
    requirement: "デスクトップとモバイルのレスポンシブ",
    phase: 7,
    evidence: ["browser", "screenshot"],
  },
  {
    id: "R3-17",
    requirement: "品質ゲート",
    phase: 7,
    evidence: ["quality-gate"],
  },
] as const satisfies readonly Renewal3AcceptanceContract[];

export const RENEWAL3_PREVIEW_SEED = 0x5233_5052;
export const RENEWAL3_CHECK_SEED = 0x5233_4348;
