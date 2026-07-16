import type { BallisticParticle, Vector3Value } from "../particle";
import type { CompiledStar } from "./compiler";
import { resolveSizePreset } from "../../data/sizes";
import type { AnyFireworkDesign } from "../../data/firework";

const ZERO_VECTOR: Readonly<Vector3Value> = { x: 0, y: 0, z: 0 };

/** Builds the production ballistic state for one compiled star. */
export function createCompiledStarParticle(
  compiled: CompiledStar,
  design: AnyFireworkDesign,
  origin: Readonly<Vector3Value> = ZERO_VECTOR,
  inheritedVelocity: Readonly<Vector3Value> = ZERO_VECTOR,
): BallisticParticle {
  const size = resolveSizePreset(design.sizeClass);
  return {
    age: -compiled.timingOffset,
    drag: compiled.definition.drag,
    gravityScale: compiled.definition.gravityScale,
    lifetime: compiled.definition.burnDuration * compiled.lifetimeScale,
    position: {
      x: origin.x + compiled.initialPosition.x,
      y: origin.y + compiled.initialPosition.y,
      z: origin.z + compiled.initialPosition.z,
    },
    velocity: {
      x:
        compiled.initialVelocity.x * size.burstScale +
        inheritedVelocity.x * 0.12,
      y:
        compiled.initialVelocity.y * size.burstScale +
        inheritedVelocity.y * 0.06,
      z:
        compiled.initialVelocity.z * size.burstScale +
        inheritedVelocity.z * 0.12,
    },
    windResponse: design.burstField.windResponse,
  };
}
