import type { FireworkPattern, SizeClass } from "../data";
import type { FreeViewPresetId } from "../modes/viewFree";
import type { Locale } from "./locale";

const patterns: Record<Locale, Record<FireworkPattern, string>> = {
  ja: {
    chrysanthemum: "菊",
    peony: "牡丹",
    crown: "冠",
    palm: "椰子",
    senrin: "千輪",
    heart: "型物・ハート",
    willow: "柳",
    bee: "蜂",
    hiyusei: "飛遊星",
    hanarai: "花雷",
    kaleidoscope: "万華鏡",
    saturn: "型物・土星",
    butterfly: "型物・蝶々",
    kowari: "小割",
  },
  en: {
    chrysanthemum: "Chrysanthemum",
    peony: "Peony",
    crown: "Crown",
    palm: "Palm",
    senrin: "Thousand Rings",
    heart: "Pattern · Heart",
    willow: "Willow",
    bee: "Bee",
    hiyusei: "Flying Stars",
    hanarai: "Flower Thunder",
    kaleidoscope: "Kaleidoscope",
    saturn: "Pattern · Saturn",
    butterfly: "Pattern · Butterfly",
    kowari: "Small Break",
  },
};
const sizes: Record<Locale, Record<SizeClass, string>> = {
  ja: { small: "小玉", medium: "中玉", large: "大玉" },
  en: { small: "Small", medium: "Medium", large: "Large" },
};
const views: Record<Locale, Record<FreeViewPresetId, string>> = {
  ja: {
    audience: "湖畔固定席",
    wide: "湖畔ワイド",
    "launch-site": "打上島そば",
    "inside-burst": "花火の内側",
  },
  en: {
    audience: "Lakeside seat",
    wide: "Lakeside wide",
    "launch-site": "Near launch island",
    "inside-burst": "Inside the burst",
  },
};
export const patternLabel = (locale: Locale, id: FireworkPattern) =>
  patterns[locale][id];
export const sizeLabel = (locale: Locale, id: SizeClass) => sizes[locale][id];
export const viewLabel = (locale: Locale, id: FreeViewPresetId) =>
  views[locale][id];
