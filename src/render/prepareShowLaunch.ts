import { compileFireworkDesign, type CompiledBurstPlan } from "../core/burst";
import {
  resolveCurrentIntent,
  type AnyFireworkDesign,
  type FireworkDesign,
  type SizeClass,
} from "../data";

export interface PreparedShowLaunch {
  compiledPlan: CompiledBurstPlan;
  design: FireworkDesign;
}

/**
 * Compiles the authoring document before converting it to the renderer's
 * runtime shape. This preserves manual and image-derived point magnitudes.
 */
export function prepareShowLaunch(
  source: AnyFireworkDesign,
  sizeClass: SizeClass,
  seed: number,
): PreparedShowLaunch {
  const sizedDesign: AnyFireworkDesign = { ...source, sizeClass };
  return {
    compiledPlan: compileFireworkDesign(sizedDesign, seed),
    design:
      sizedDesign.schemaVersion === 4
        ? resolveCurrentIntent(sizedDesign)
        : sizedDesign,
  };
}
