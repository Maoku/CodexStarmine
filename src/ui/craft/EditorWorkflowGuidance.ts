import type { LayerIntentV4 } from "../../data";

export const NO_LAYER_GUIDANCE =
  "まず、左側の「＋ 既定」「＋ 型物」「＋ 手動」からレイヤーを追加してください";

export const NEW_LAYER_GUIDANCE =
  "仮想星の部品皿から、このレイヤーで使う仮想星を選択してください";

export function selectedStarGuidance(
  authoringMode: LayerIntentV4["authoringMode"],
): string {
  if (authoringMode === "manual") {
    return "仮想星を選択しました。配置パラメータを設定し、X・Y・Zから操作面を選んでください";
  }
  if (authoringMode === "pattern") {
    return "仮想星を選択しました。形状や密度を設定し、X・Y・Zから操作面を選んでください";
  }
  return "仮想星を選択しました。右側で星数・半径などのパラメータを設定してください";
}
