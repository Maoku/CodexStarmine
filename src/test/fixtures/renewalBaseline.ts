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
      "03e0b0d2fe2c3a51cfd2389bc1d58278627ee3ccce28d5ecf8f9ae21fac9e584",
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
      "87b4ee6c3d2b3c8962de9605778aa1157c03fa630c9b08b24206042ed435b95e",
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
      "7fff91b090728cef79bea7f6ad200b09e2ee08866b47f390786c791d77fd934e",
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
      "a982999e42b3c3cacb9eb684543313a9fcd486da82e0a1dea1803fd1c831fbd7",
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
      "77de1a2ea9f00bb5b021986b5f04cfda591ab7192d44245658ce10f9a8b98638",
    starCount: 18,
  },
  {
    assemblySeed: 1_259_746_756,
    boundsRadius: 40.068548,
    childBurstCount: 0,
    designHash:
      "d399bf1b5cc23654a161064c88d39f343d0158163075e10ac350317231b91e9b",
    id: "preset-heart",
    maximumParticles: 150,
    planHash:
      "1bead8e797e5917878ca5c956a7c6814f3c3082b958abcd95a40f27545e608ea",
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
  "f8ff1de4bceb114caa66d09766aafd0f61922da9527ee80a9b37c5432e92cfaf";
export const FREE_SHOW_BASELINE_HASH =
  "3edcfbb7b77a0eefce6c099eab621241ef68322f05229b0ca66b3070fd47b21a";
