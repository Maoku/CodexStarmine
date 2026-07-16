import { CHRYSANTHEMUM_PRESET, type FireworkDesignV2 } from "../../data";

export const RENEWAL_BASELINE_SEED = 424_242;
export const RENEWAL_FREE_SHOW_SEED = 20_260;

export interface PresetBaseline {
  readonly assemblySeed: number;
  readonly boundsRadius: number;
  readonly childBurstCount: number;
  readonly designHash: string;
  readonly id: string;
  readonly maximumParticles: number;
  readonly planHash: string;
  readonly starCount: number;
}

export const PRESET_BASELINES: readonly PresetBaseline[] = [
  {
    assemblySeed: 4_133_474_340,
    boundsRadius: 35.864298,
    childBurstCount: 0,
    designHash:
      "599d9c59f0d7186fb4167bfdea3ecbe2d5d06f9447d9c04bb1621bdf7db19d45",
    id: "preset-chrysanthemum",
    maximumParticles: 180,
    planHash:
      "bf18d059c4675968e2c7cc2658ca335ad6a6a9084aba7d9b9e2e393b22f3ecac",
    starCount: 180,
  },
  {
    assemblySeed: 3_885_076_909,
    boundsRadius: 38.984162,
    childBurstCount: 0,
    designHash:
      "f9f20096d9fc2b05f93e0136217bd33859b10e7bb0a65848cf08b2e973fab9dc",
    id: "preset-peony",
    maximumParticles: 210,
    planHash:
      "e9c53ee4faff22efc533599a80cfd83f0620799791936dd58b347fdc0e198f32",
    starCount: 210,
  },
  {
    assemblySeed: 2_458_712_418,
    boundsRadius: 30.57786,
    childBurstCount: 0,
    designHash:
      "e00a5a66dcbd748848c1cc682d236a38738f559907e18227402729a82028ba0d",
    id: "preset-crown",
    maximumParticles: 273,
    planHash:
      "3f9d235ad82ac05d7dfab5eb809595eaef0b9309b801fd5a4a06923e454aa006",
    starCount: 273,
  },
  {
    assemblySeed: 2_379_726_799,
    boundsRadius: 39.87782,
    childBurstCount: 0,
    designHash:
      "25f5d6a49295539254891b18c23c81691dd18f075558066ff451f6e0e57388c5",
    id: "preset-palm",
    maximumParticles: 101,
    planHash:
      "fc040df1b6669a2995c519f6d5c6eb1f8b61a6731ee3276c278bc0e80f322783",
    starCount: 101,
  },
  {
    assemblySeed: 1_284_819_268,
    boundsRadius: 6.83063,
    childBurstCount: 12,
    designHash:
      "8a2be6d99bde4c9ba477aa9997b03f2378b4aa3ed848f0f2c43a51666598bff8",
    id: "preset-senrin",
    maximumParticles: 306,
    planHash:
      "3b98e92505e637e33f9a36de65a078d78a960fed0d873b97352f476b52653707",
    starCount: 18,
  },
  {
    assemblySeed: 1_259_746_756,
    boundsRadius: 40.068548,
    childBurstCount: 0,
    designHash:
      "f84086d0979a4bf81a0184e73ffcce576dd964dd1b627bc55ded2af3ad78c39a",
    id: "preset-heart",
    maximumParticles: 150,
    planHash:
      "4c264769afe748f5e9ecdcecbcb85eb22a89cb6bcb947374e754bc40d953901e",
    starCount: 150,
  },
];

/** A persisted custom work used to prove schema v2 round trips unchanged. */
export const SAVED_DESIGN_V2_FIXTURE: FireworkDesignV2 = {
  ...structuredClone(CHRYSANTHEMUM_PRESET),
  assemblySeed: 20_260_715,
  description: "Renewal Phase 0 保存作品fixture",
  id: "custom-renewal-baseline",
  name: "湖畔の変化菊 基準作品",
  sizeClass: "large",
};

export const SAVED_DESIGN_V2_HASH =
  "193a90b3b96d93a42155b3df0adc6b5e5ebadeadbae852b93337dcf413b76c07";
export const SAVED_DESIGN_V2_PLAN_HASH =
  "f7c3545c2fe524c7255d2a175a673015460955567da58dfbfd4bea38e75064d9";
export const FREE_SHOW_BASELINE_HASH =
  "3edcfbb7b77a0eefce6c099eab621241ef68322f05229b0ca66b3070fd47b21a";
