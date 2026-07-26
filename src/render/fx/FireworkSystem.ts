import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  LineBasicMaterial,
  LineSegments,
  NormalBlending,
  Points,
  Scene,
  ShaderMaterial,
} from "three";

import {
  compileFireworkDesign,
  createCompiledStarParticle,
  type CompiledBurstPlan,
  type CompiledStar,
} from "../../core/burst";
import {
  advanceBurstParticle,
  BURST_PARTICLE_ENVIRONMENT,
  evaluateSecondaryEvent,
  evaluateVirtualStarAppearance,
  integrateParticle,
  type BallisticParticle,
  type EvaluatedVirtualStarAppearance,
  type SecondaryEvent,
  type Vector3Value,
} from "../../core/particle";
import { createSeededRandom, stableSeed } from "../../core/random";
import {
  resolveSizePreset,
  type FireworkDesign,
  type VirtualStarEffectProfile,
} from "../../data";
import { WATER_LEVEL } from "../scene/createNightSkyScene";

const MAX_STARS = 6_000;
const MAX_SMOKE = 1_400;
const MAX_TRAIL_VERTICES = 60_000;
const GRAVITY = 9.81;

interface Shell extends BallisticParticle {
  compiledPlan?: CompiledBurstPlan;
  design: FireworkDesign;
  seed: number;
  smokeTimer: number;
  targetHeight: number;
  trail: Vector3Value[];
}

interface SmokeParticle {
  age: number;
  baseColor: number;
  illumination: number;
  illuminationColor: number;
  lifetime: number;
  position: Vector3Value;
  size: number;
  velocity: Vector3Value;
}

interface Star extends BallisticParticle {
  appearance?: EvaluatedVirtualStarAppearance;
  brightness: number;
  colorStages: FireworkDesign["colorStages"];
  drawPosition: Vector3Value;
  effectPhase: number;
  effectProfile?: VirtualStarEffectProfile;
  effectSeed: number;
  history: Vector3Value[];
  pointScale: number;
  secondarySpawned: boolean;
  smokeAmount: number;
  smokeTimer: number;
  sparkle: number;
  terminalSparkSpawned: boolean;
  trailLength: number;
  trailWidth: number;
}

interface DelayedBurst {
  age: number;
  delay: number;
  design: FireworkDesign;
  position: Vector3Value;
  stars: CompiledStar[];
  velocity: Vector3Value;
}

export interface LaunchOptions {
  compiledPlan?: CompiledBurstPlan;
  lane?: number;
  launchAngle?: number;
  seed?: number;
  targetHeight?: number;
}

export interface LaunchKinematics {
  position: Vector3Value;
  seed: number;
  targetHeight: number;
  velocity: Vector3Value;
}

export interface EffectRenderContext {
  cameraPosition: Vector3Value;
  hardwareConcurrency: number;
  pixelRatio: number;
  viewportHeight: number;
}

export interface EffectLOD {
  secondaryScale: number;
  smokeScale: number;
  trailSampleStride: number;
}

export function deriveEffectLOD(context: EffectRenderContext): EffectLOD {
  const distance = Math.hypot(
    context.cameraPosition.x,
    context.cameraPosition.y - 95,
    context.cameraPosition.z + 112,
  );
  const distanceScale = distance > 240 ? 0.52 : distance > 160 ? 0.72 : 1;
  const deviceScale =
    context.hardwareConcurrency <= 4
      ? 0.58
      : context.hardwareConcurrency <= 8
        ? 0.82
        : 1;
  const resolutionScale =
    context.viewportHeight * context.pixelRatio > 1_600 ? 0.78 : 1;
  const quality = Math.min(distanceScale, deviceScale, resolutionScale);
  return {
    secondaryScale: Math.max(quality, 0.35),
    smokeScale: Math.max(quality * 0.82, 0.24),
    trailSampleStride: quality < 0.62 ? 3 : quality < 0.86 ? 2 : 1,
  };
}

export interface FireworkSystemCallbacks {
  onBurst?: (
    position: Vector3Value,
    design: FireworkDesign,
    plan: CompiledBurstPlan,
  ) => void;
  onLaunch?: (
    position: Vector3Value,
    design: FireworkDesign,
    plan?: CompiledBurstPlan,
  ) => void;
}

export function deriveLaunchKinematics(
  design: FireworkDesign,
  options: LaunchOptions = {},
): LaunchKinematics {
  const lane = Math.min(Math.max(options.lane ?? 0, -1), 1);
  const size = resolveSizePreset(design.sizeClass);
  const seed = options.seed ?? Math.floor(Math.random() * 1_000_000);
  const random = createSeededRandom(seed ^ 0x6a09_e667);
  const targetHeight =
    options.targetHeight ?? size.targetHeight * random.range(0.97, 1.03);
  const position = {
    x: lane * 42 + random.signed() * 0.9,
    y: 2.2,
    z: -112,
  };
  return {
    position,
    seed,
    targetHeight,
    velocity: {
      x: lane * -1.8 + (options.launchAngle ?? 0) * 18 + random.signed() * 0.7,
      y:
        Math.sqrt(2 * GRAVITY * Math.max(targetHeight - position.y, 1)) * 1.025,
      z: -2.6,
    },
  };
}

function createStarMaterial(reflection = false): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      reflectionOpacity: { value: reflection ? 0.22 : 1 },
    },
    vertexShader: `
      uniform float reflectionOpacity;
      attribute float alpha;
      attribute float pointSize;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vColor = color;
        vAlpha = alpha * reflectionOpacity;
        gl_PointSize = clamp(pointSize * (250.0 / max(-viewPosition.z, 1.0)), 1.0, 18.0);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float distanceToCenter = length(gl_PointCoord - vec2(0.5));
        float core = 1.0 - smoothstep(0.0, 0.18, distanceToCenter);
        float glow = 1.0 - smoothstep(0.05, 0.5, distanceToCenter);
        float alpha = (glow * 0.58 + core) * vAlpha;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(vColor * (0.72 + core * 1.6), alpha);
      }
    `,
    blending: AdditiveBlending,
    depthTest: !reflection,
    depthWrite: false,
    transparent: true,
    vertexColors: true,
  });
}

function createPointGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  const position = new BufferAttribute(new Float32Array(MAX_STARS * 3), 3);
  const color = new BufferAttribute(new Float32Array(MAX_STARS * 3), 3);
  const alpha = new BufferAttribute(new Float32Array(MAX_STARS), 1);
  const pointSize = new BufferAttribute(new Float32Array(MAX_STARS), 1);
  position.setUsage(DynamicDrawUsage);
  color.setUsage(DynamicDrawUsage);
  alpha.setUsage(DynamicDrawUsage);
  pointSize.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", position);
  geometry.setAttribute("color", color);
  geometry.setAttribute("alpha", alpha);
  geometry.setAttribute("pointSize", pointSize);
  geometry.setDrawRange(0, 0);
  return geometry;
}

function createSmokeGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  const position = new BufferAttribute(new Float32Array(MAX_SMOKE * 3), 3);
  const color = new BufferAttribute(new Float32Array(MAX_SMOKE * 3), 3);
  const alpha = new BufferAttribute(new Float32Array(MAX_SMOKE), 1);
  const pointSize = new BufferAttribute(new Float32Array(MAX_SMOKE), 1);
  for (const attribute of [position, color, alpha, pointSize]) {
    attribute.setUsage(DynamicDrawUsage);
  }
  geometry.setAttribute("position", position);
  geometry.setAttribute("color", color);
  geometry.setAttribute("alpha", alpha);
  geometry.setAttribute("pointSize", pointSize);
  geometry.setDrawRange(0, 0);
  return geometry;
}

function createSmokeMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: `
      attribute float alpha;
      attribute float pointSize;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vColor = color;
        vAlpha = alpha;
        gl_PointSize = clamp(pointSize * (260.0 / max(-viewPosition.z, 1.0)), 2.0, 54.0);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        float cloud = 1.0 - smoothstep(0.15, 0.5, d);
        cloud *= 0.72 + sin(gl_PointCoord.x * 21.0) * sin(gl_PointCoord.y * 17.0) * 0.12;
        if (cloud * vAlpha < 0.008) discard;
        gl_FragColor = vec4(vColor, cloud * vAlpha);
      }
    `,
    blending: NormalBlending,
    depthWrite: false,
    transparent: true,
    vertexColors: true,
  });
}

function clonePosition(position: Vector3Value): Vector3Value {
  return { x: position.x, y: position.y, z: position.z };
}

export class FireworkSystem {
  readonly #callbacks: FireworkSystemCallbacks;
  readonly #reflectionGeometry = createPointGeometry();
  readonly #reflectionPoints = new Points(
    this.#reflectionGeometry,
    createStarMaterial(true),
  );
  readonly #starGeometry = createPointGeometry();
  readonly #starPoints = new Points(this.#starGeometry, createStarMaterial());
  readonly #smokeGeometry = createSmokeGeometry();
  readonly #smokePoints = new Points(
    this.#smokeGeometry,
    createSmokeMaterial(),
  );
  readonly #trailGeometry = new BufferGeometry();
  readonly #trails: LineSegments;
  #delayedBursts: DelayedBurst[] = [];
  #shells: Shell[] = [];
  #smoke: SmokeParticle[] = [];
  #stars: Star[] = [];
  #effectLOD: EffectLOD = {
    secondaryScale: 1,
    smokeScale: 1,
    trailSampleStride: 1,
  };

  constructor(scene: Scene, callbacks: FireworkSystemCallbacks = {}) {
    this.#callbacks = callbacks;
    const trailPositions = new BufferAttribute(
      new Float32Array(MAX_TRAIL_VERTICES * 3),
      3,
    );
    const trailColors = new BufferAttribute(
      new Float32Array(MAX_TRAIL_VERTICES * 3),
      3,
    );
    trailPositions.setUsage(DynamicDrawUsage);
    trailColors.setUsage(DynamicDrawUsage);
    this.#trailGeometry.setAttribute("position", trailPositions);
    this.#trailGeometry.setAttribute("color", trailColors);
    this.#trailGeometry.setDrawRange(0, 0);
    this.#trails = new LineSegments(
      this.#trailGeometry,
      new LineBasicMaterial({
        blending: AdditiveBlending,
        depthWrite: false,
        opacity: 0.74,
        transparent: true,
        vertexColors: true,
      }),
    );
    // Dynamic buffer bounds start at the origin and otherwise cause valid
    // airborne particles to be rejected by the camera frustum.
    this.#smokePoints.frustumCulled = false;
    this.#trails.frustumCulled = false;
    this.#starPoints.frustumCulled = false;
    this.#reflectionPoints.frustumCulled = false;
    this.#reflectionPoints.renderOrder = 4;
    this.#smokePoints.renderOrder = 1;
    scene.add(
      this.#smokePoints,
      this.#trails,
      this.#starPoints,
      this.#reflectionPoints,
    );
  }

  get activeCount(): number {
    return (
      this.#shells.length + this.#stars.length + this.#delayedBursts.length
    );
  }

  launch(design: FireworkDesign, options: LaunchOptions = {}): void {
    const { position, seed, targetHeight, velocity } = deriveLaunchKinematics(
      design,
      options,
    );
    this.#shells.push({
      age: 0,
      compiledPlan: options.compiledPlan,
      design,
      drag: 0.035,
      gravityScale: 1,
      lifetime: 4.2,
      position,
      seed,
      smokeTimer: 0,
      targetHeight,
      trail: [clonePosition(position)],
      velocity,
      windResponse: 0.12,
    });
    this.#callbacks.onLaunch?.(position, design, options.compiledPlan);
  }

  clear(): void {
    this.#delayedBursts = [];
    this.#shells = [];
    this.#smoke = [];
    this.#stars = [];
    this.#writePointBuffers();
    this.#writeTrailBuffers();
    this.#writeSmokeBuffers();
  }

  setRenderContext(context: EffectRenderContext): void {
    this.#effectLOD = deriveEffectLOD(context);
  }

  update(deltaSeconds: number): void {
    const delta = Math.min(Math.max(deltaSeconds, 0), 0.05);
    this.#updateShells(delta);
    this.#updateDelayedBursts(delta);
    this.#updateStars(delta);
    this.#updateSmoke(delta);
    this.#writePointBuffers();
    this.#writeTrailBuffers();
    this.#writeSmokeBuffers();
  }

  dispose(): void {
    this.#starGeometry.dispose();
    this.#reflectionGeometry.dispose();
    this.#smokeGeometry.dispose();
    this.#trailGeometry.dispose();
    (this.#starPoints.material as ShaderMaterial).dispose();
    (this.#reflectionPoints.material as ShaderMaterial).dispose();
    (this.#smokePoints.material as ShaderMaterial).dispose();
    (this.#trails.material as LineBasicMaterial).dispose();
  }

  #appendCompiledStars(
    position: Vector3Value,
    inheritedVelocity: Vector3Value,
    design: FireworkDesign,
    compiledStars: CompiledStar[],
  ): void {
    const size = resolveSizePreset(design.sizeClass);
    for (const compiled of compiledStars) {
      const definition = compiled.definition;
      const particle = createCompiledStarParticle(
        compiled,
        design,
        position,
        inheritedVelocity,
      );
      this.#stars.push({
        ...particle,
        brightness: (0.72 + size.pointScale * 0.28) * compiled.intensityScale,
        colorStages: definition.colorStages,
        drawPosition: clonePosition(particle.position),
        effectPhase: compiled.effectPhase ?? 0,
        effectProfile: definition.effectProfile,
        effectSeed:
          compiled.effectSeed ??
          stableSeed(
            `${design.assemblySeed}:${compiled.layerID}:${compiled.id}`,
          ),
        history: [clonePosition(particle.position)],
        pointScale: size.pointScale * Math.max(definition.trailWidth, 0.72),
        secondarySpawned: false,
        smokeAmount: definition.smokeAmount,
        smokeTimer: 0,
        sparkle: definition.flicker,
        terminalSparkSpawned: false,
        trailLength: definition.trailLifetime,
        trailWidth: definition.trailWidth,
      });
    }
  }

  #emitBurst(
    position: Vector3Value,
    inheritedVelocity: Vector3Value,
    design: FireworkDesign,
    seed: number,
    includeChildren = true,
    compiledPlan?: CompiledBurstPlan,
  ): void {
    const plan = compiledPlan ?? compileFireworkDesign(design, seed);
    this.#appendCompiledStars(position, inheritedVelocity, design, plan.stars);

    if (includeChildren) {
      for (const child of plan.childBursts) {
        this.#delayedBursts.push({
          age: 0,
          delay: child.delay,
          design,
          position: clonePosition(position),
          stars: child.stars,
          velocity: child.initialVelocity,
        });
      }
    }

    if (this.#stars.length > MAX_STARS - 10) {
      this.#stars.splice(0, this.#stars.length - (MAX_STARS - 10));
    }
  }

  #burst(shell: Shell): void {
    const plan =
      shell.compiledPlan ?? compileFireworkDesign(shell.design, shell.seed);
    this.#emitBurst(
      shell.position,
      shell.velocity,
      shell.design,
      shell.seed,
      true,
      plan,
    );
    this.#spawnBurstSmoke(shell.position, shell.design);
    this.#illuminateSmoke(
      shell.position,
      shell.design.colorStages[1]?.color ??
        shell.design.colorStages[0]?.color ??
        0xffffff,
      resolveSizePreset(shell.design.sizeClass).burstScale,
    );
    this.#callbacks.onBurst?.(
      clonePosition(shell.position),
      shell.design,
      plan,
    );
  }

  #updateDelayedBursts(delta: number): void {
    const active: DelayedBurst[] = [];
    for (const delayed of this.#delayedBursts) {
      delayed.age += delta;
      delayed.velocity.y -= GRAVITY * 0.34 * delta;
      delayed.position.x += delayed.velocity.x * delta;
      delayed.position.y += delayed.velocity.y * delta;
      delayed.position.z += delayed.velocity.z * delta;
      delayed.velocity.x *= Math.exp(-0.9 * delta);
      delayed.velocity.y *= Math.exp(-0.9 * delta);
      delayed.velocity.z *= Math.exp(-0.9 * delta);
      if (delayed.age >= delayed.delay) {
        this.#appendCompiledStars(
          delayed.position,
          delayed.velocity,
          delayed.design,
          delayed.stars,
        );
      } else {
        active.push(delayed);
      }
    }
    this.#delayedBursts = active;
  }

  #updateShells(delta: number): void {
    const active: Shell[] = [];
    for (const shell of this.#shells) {
      integrateParticle(shell, delta, BURST_PARTICLE_ENVIRONMENT);
      shell.smokeTimer += delta;
      if (shell.smokeTimer >= 0.085) {
        shell.smokeTimer = 0;
        this.#smoke.push({
          age: 0,
          baseColor: 0x536170,
          illumination: 0,
          illuminationColor: 0xffffff,
          lifetime: shell.design.smokeProfile.lifetime * 0.58,
          position: clonePosition(shell.position),
          size: 2.4 + shell.design.smokeProfile.amount * 2.1,
          velocity: {
            x:
              BURST_PARTICLE_ENVIRONMENT.wind.x * 0.32 +
              (Math.random() - 0.5) * 0.25,
            y: -0.45 + Math.random() * 0.5,
            z: BURST_PARTICLE_ENVIRONMENT.wind.z * 0.3,
          },
        });
      }
      shell.trail.push(clonePosition(shell.position));
      if (shell.trail.length > 18) {
        shell.trail.shift();
      }
      if (
        shell.position.y >= shell.targetHeight ||
        shell.velocity.y <= 4 ||
        shell.age >= shell.lifetime
      ) {
        this.#burst(shell);
      } else {
        active.push(shell);
      }
    }
    this.#shells = active;
  }

  #spawnBurstSmoke(position: Vector3Value, design: FireworkDesign): void {
    const size = resolveSizePreset(design.sizeClass);
    const count = Math.round(
      14 * design.smokeProfile.amount * Math.sqrt(size.particleScale),
    );
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const vertical = Math.random() * 2 - 1;
      const radial = Math.sqrt(Math.max(1 - vertical * vertical, 0));
      this.#smoke.push({
        age: 0,
        baseColor: 0x4c5664,
        illumination: 0.82,
        illuminationColor:
          design.colorStages[1]?.color ??
          design.colorStages[0]?.color ??
          0xffffff,
        lifetime: design.smokeProfile.lifetime * (0.82 + Math.random() * 0.35),
        position: {
          x: position.x + Math.cos(angle) * radial * Math.random() * 3,
          y: position.y + vertical * Math.random() * 3,
          z: position.z + Math.sin(angle) * radial * Math.random() * 3,
        },
        size: (4.8 + Math.random() * 4.2) * size.pointScale,
        velocity: {
          x: Math.cos(angle) * radial * (1.2 + Math.random() * 2.4),
          y: vertical * (1 + Math.random() * 1.8),
          z: Math.sin(angle) * radial * (1.2 + Math.random() * 2.4),
        },
      });
    }
    if (this.#smoke.length > MAX_SMOKE) {
      this.#smoke.splice(0, this.#smoke.length - MAX_SMOKE);
    }
  }

  #illuminateSmoke(
    position: Vector3Value,
    color: number,
    sizeScale: number,
  ): void {
    const range = 92 * sizeScale;
    for (const smoke of this.#smoke) {
      const distance = Math.hypot(
        smoke.position.x - position.x,
        smoke.position.y - position.y,
        smoke.position.z - position.z,
      );
      if (distance < range) {
        smoke.illumination = Math.max(
          smoke.illumination,
          (1 - distance / range) * 0.92,
        );
        smoke.illuminationColor = color;
      }
    }
  }

  #updateSmoke(delta: number): void {
    const active: SmokeParticle[] = [];
    for (const smoke of this.#smoke) {
      smoke.age += delta;
      smoke.velocity.x += BURST_PARTICLE_ENVIRONMENT.wind.x * 0.12 * delta;
      smoke.velocity.y += 0.13 * delta;
      smoke.velocity.z += BURST_PARTICLE_ENVIRONMENT.wind.z * 0.12 * delta;
      smoke.position.x += smoke.velocity.x * delta;
      smoke.position.y += smoke.velocity.y * delta;
      smoke.position.z += smoke.velocity.z * delta;
      smoke.velocity.x *= Math.exp(-0.34 * delta);
      smoke.velocity.y *= Math.exp(-0.34 * delta);
      smoke.velocity.z *= Math.exp(-0.34 * delta);
      smoke.size += delta * 1.9;
      smoke.illumination *= Math.exp(-delta * 2.8);
      if (smoke.age < smoke.lifetime) active.push(smoke);
    }
    this.#smoke = active;
  }

  #updateStars(delta: number): void {
    const active: Star[] = [];
    const spawned: Star[] = [];
    for (const star of this.#stars) {
      const previousNormalizedAge =
        star.lifetime > 0 ? star.age / star.lifetime : 1;
      if (!advanceBurstParticle(star, delta, BURST_PARTICLE_ENVIRONMENT)) {
        active.push(star);
        continue;
      }
      star.appearance = evaluateVirtualStarAppearance({
        ageSeconds: star.age,
        colorStages: star.colorStages,
        effectPhase: star.effectPhase,
        effectProfile: star.effectProfile,
        effectSeed: star.effectSeed,
        legacyFlicker: star.sparkle,
        lifetimeSeconds: star.lifetime,
        previousNormalizedAge,
      });
      star.drawPosition = {
        x: star.position.x + star.appearance.motionOffset.x,
        y: star.position.y + star.appearance.motionOffset.y,
        z: star.position.z + star.appearance.motionOffset.z,
      };
      if (star.appearance.secondaryEvent && !star.secondarySpawned) {
        star.secondarySpawned = true;
        spawned.push(
          ...this.#createSecondaryStars(star, star.appearance.secondaryEvent),
        );
      }
      star.smokeTimer += delta;
      const smokeInterval =
        0.52 / Math.max(star.smokeAmount * this.#effectLOD.smokeScale, 0.000_1);
      if (
        star.smokeAmount > 0.04 &&
        star.smokeTimer >= smokeInterval &&
        star.age > star.lifetime * 0.12 &&
        star.age < star.lifetime * 0.88
      ) {
        star.smokeTimer = 0;
        this.#spawnStarSmoke(star);
      }
      const terminal = star.effectProfile?.light?.terminal;
      if (
        star.appearance.terminalState !== "none" &&
        !star.terminalSparkSpawned &&
        terminal &&
        terminal.mode !== "none" &&
        (terminal.sparkleCount ?? 0) > 0
      ) {
        star.terminalSparkSpawned = true;
        const triggerTime = Math.max(1 - terminal.duration, 0.35);
        const event = evaluateSecondaryEvent(
          {
            secondary: {
              count: terminal.sparkleCount,
              mode: "spark",
              speedScale: terminal.mode === "teka" ? 0.72 : 0.46,
              triggerTime,
            },
          },
          triggerTime - 0.000_001,
          triggerTime,
          star.effectSeed ^ 0x71c3_9a5d,
        );
        if (event) spawned.push(...this.#createSecondaryStars(star, event));
      }
      if (star.trailLength > 0.14 && star.age < star.lifetime * 0.92) {
        star.history.push(clonePosition(star.drawPosition));
        const maxHistory = Math.max(Math.round(3 + star.trailLength * 9), 2);
        if (star.history.length > maxHistory) {
          star.history.shift();
        }
      }
      if (star.age < star.lifetime && star.position.y > -15) {
        active.push(star);
      }
    }
    this.#stars = [...active, ...spawned].slice(-MAX_STARS);
  }

  #createSecondaryStars(parent: Star, event: SecondaryEvent): Star[] {
    const lifetime = event.mode === "microBurst" ? 0.72 : 0.42;
    const speed = event.mode === "microBurst" ? 7.2 : 4.8;
    const particleCount = Math.max(
      Math.min(
        Math.ceil(event.particles.length * this.#effectLOD.secondaryScale),
        event.particles.length,
      ),
      event.particles.length > 0 ? 1 : 0,
    );
    return event.particles.slice(0, particleCount).map((particle, index) => {
      const position = clonePosition(parent.drawPosition);
      return {
        age: 0,
        brightness:
          parent.brightness * (event.mode === "microBurst" ? 0.88 : 0.7),
        colorStages: parent.colorStages,
        drag: Math.max(parent.drag * 0.48, 0.12),
        drawPosition: clonePosition(position),
        effectPhase: 0,
        effectSeed: stableSeed(
          `${parent.effectSeed}:${event.mode}:${index}:secondary`,
        ),
        gravityScale: parent.gravityScale * 0.72,
        history: [clonePosition(position)],
        lifetime,
        pointScale:
          parent.pointScale * (event.mode === "microBurst" ? 0.72 : 0.54),
        position,
        secondarySpawned: true,
        smokeAmount: 0,
        smokeTimer: 0,
        sparkle: 0.08,
        terminalSparkSpawned: true,
        trailLength: event.mode === "microBurst" ? 0.12 : 0,
        trailWidth: Math.max(parent.trailWidth * 0.55, 0.42),
        velocity: {
          x:
            parent.velocity.x * 0.12 +
            particle.direction.x * particle.speedScale * speed,
          y:
            parent.velocity.y * 0.12 +
            particle.direction.y * particle.speedScale * speed,
          z:
            parent.velocity.z * 0.12 +
            particle.direction.z * particle.speedScale * speed,
        },
        windResponse: parent.windResponse * 0.72,
      };
    });
  }

  #spawnStarSmoke(star: Star): void {
    const random = createSeededRandom(
      star.effectSeed ^ Math.round(star.age * 1_000),
    );
    const color = star.appearance?.color ?? 0xffffff;
    this.#smoke.push({
      age: 0,
      baseColor: 0x4a5260,
      illumination: 0.18,
      illuminationColor: color,
      lifetime: 1.6 + star.smokeAmount * 2.4,
      position: clonePosition(star.drawPosition),
      size: 0.72 + star.smokeAmount * 1.4,
      velocity: {
        x: BURST_PARTICLE_ENVIRONMENT.wind.x * 0.12 + random.signed() * 0.18,
        y: 0.08 + random.next() * 0.22,
        z: BURST_PARTICLE_ENVIRONMENT.wind.z * 0.12 + random.signed() * 0.18,
      },
    });
    if (this.#smoke.length > MAX_SMOKE) {
      this.#smoke.splice(0, this.#smoke.length - MAX_SMOKE);
    }
  }

  #writePointBuffers(): void {
    const visible = [
      ...this.#shells,
      ...this.#stars.filter((star) => star.age >= 0),
    ].slice(0, MAX_STARS);
    const position = this.#starGeometry.getAttribute(
      "position",
    ) as BufferAttribute;
    const color = this.#starGeometry.getAttribute("color") as BufferAttribute;
    const alpha = this.#starGeometry.getAttribute("alpha") as BufferAttribute;
    const pointSize = this.#starGeometry.getAttribute(
      "pointSize",
    ) as BufferAttribute;
    const reflectionPosition = this.#reflectionGeometry.getAttribute(
      "position",
    ) as BufferAttribute;
    const reflectionColor = this.#reflectionGeometry.getAttribute(
      "color",
    ) as BufferAttribute;
    const reflectionAlpha = this.#reflectionGeometry.getAttribute(
      "alpha",
    ) as BufferAttribute;
    const reflectionSize = this.#reflectionGeometry.getAttribute(
      "pointSize",
    ) as BufferAttribute;
    const tempColor = new Color();

    visible.forEach((item, index) => {
      const isShell = "design" in item;
      const evaluated = isShell
        ? {
            color: 0xffc66e,
            intensity: 1.3,
            lightMultiplier: 1,
          }
        : (item.appearance ??
          evaluateVirtualStarAppearance({
            ageSeconds: item.age,
            colorStages: item.colorStages,
            effectPhase: item.effectPhase,
            effectProfile: item.effectProfile,
            effectSeed: item.effectSeed,
            legacyFlicker: item.sparkle,
            lifetimeSeconds: item.lifetime,
          }));
      const opacity = Math.max(
        evaluated.intensity * evaluated.lightMultiplier,
        0,
      );
      const drawPosition = isShell ? item.position : item.drawPosition;
      tempColor.setHex(evaluated.color);
      position.setXYZ(index, drawPosition.x, drawPosition.y, drawPosition.z);
      color.setXYZ(index, tempColor.r, tempColor.g, tempColor.b);
      alpha.setX(index, opacity * (isShell ? 1 : item.brightness));
      pointSize.setX(
        index,
        isShell
          ? 7.2 * resolveSizePreset(item.design.sizeClass).pointScale
          : 4.2 * item.pointScale,
      );

      reflectionPosition.setXYZ(
        index,
        drawPosition.x * 1.03,
        WATER_LEVEL + 0.34,
        -70 - Math.max(drawPosition.y, 0) * 1.72 + (drawPosition.z + 112) * 0.2,
      );
      reflectionColor.setXYZ(
        index,
        tempColor.r * 0.8,
        tempColor.g * 0.9,
        tempColor.b,
      );
      reflectionAlpha.setX(index, opacity);
      reflectionSize.setX(
        index,
        isShell
          ? 3.5 * resolveSizePreset(item.design.sizeClass).pointScale
          : 2.8 * item.pointScale,
      );
    });

    for (const attribute of [
      position,
      color,
      alpha,
      pointSize,
      reflectionPosition,
      reflectionColor,
      reflectionAlpha,
      reflectionSize,
    ]) {
      attribute.needsUpdate = true;
    }
    this.#starGeometry.setDrawRange(0, visible.length);
    this.#reflectionGeometry.setDrawRange(0, visible.length);
  }

  #writeTrailBuffers(): void {
    const position = this.#trailGeometry.getAttribute(
      "position",
    ) as BufferAttribute;
    const color = this.#trailGeometry.getAttribute("color") as BufferAttribute;
    const tempColor = new Color();
    let vertex = 0;

    const writeHistory = (
      history: Vector3Value[],
      colorHex: number,
      intensity = 1,
      width = 1,
      grainSpacing = 1,
    ): void => {
      tempColor.setHex(colorHex);
      const stride =
        Math.max(Math.round(grainSpacing), 1) *
        this.#effectLOD.trailSampleStride;
      const passes = Math.min(Math.max(Math.round(width * 1.35), 1), 3);
      for (
        let index = 1;
        index < history.length && vertex + passes * 2 <= MAX_TRAIL_VERTICES;
        index += 1
      ) {
        if ((index - 1) % stride !== 0) continue;
        const previous = history[index - 1];
        const current = history[index];
        const fade = (index / history.length) * intensity;
        for (let pass = 0; pass < passes; pass += 1) {
          const offset =
            passes === 1
              ? 0
              : (pass - (passes - 1) / 2) * Math.max(width - 0.6, 0.2) * 0.035;
          position.setXYZ(
            vertex,
            previous.x + offset,
            previous.y - offset * 0.4,
            previous.z,
          );
          color.setXYZ(
            vertex,
            tempColor.r * fade * 0.35,
            tempColor.g * fade * 0.35,
            tempColor.b * fade * 0.35,
          );
          vertex += 1;
          position.setXYZ(
            vertex,
            current.x + offset,
            current.y - offset * 0.4,
            current.z,
          );
          color.setXYZ(
            vertex,
            tempColor.r * fade,
            tempColor.g * fade,
            tempColor.b * fade,
          );
          vertex += 1;
        }
      }
    };

    for (const shell of this.#shells) {
      const ascentColor =
        shell.design.ascentEffect === "silver"
          ? 0xe9f4ff
          : shell.design.ascentEffect === "gold"
            ? 0xffa84f
            : 0x65707d;
      writeHistory(
        shell.trail,
        ascentColor,
        shell.design.ascentEffect === "none" ? 0.22 : 1.1,
      );
    }
    for (const star of this.#stars) {
      if (star.history.length < 2) continue;
      const evaluated =
        star.appearance ??
        evaluateVirtualStarAppearance({
          ageSeconds: star.age,
          colorStages: star.colorStages,
          effectPhase: star.effectPhase,
          effectProfile: star.effectProfile,
          effectSeed: star.effectSeed,
          legacyFlicker: star.sparkle,
          lifetimeSeconds: star.lifetime,
        });
      writeHistory(
        star.history,
        evaluated.trailColor,
        evaluated.intensity * evaluated.trailLightMultiplier,
        star.trailWidth,
        star.effectProfile?.trail?.mode === "granular"
          ? (star.effectProfile.trail.grainSpacing ?? 2)
          : 1,
      );
    }

    position.needsUpdate = true;
    color.needsUpdate = true;
    this.#trailGeometry.setDrawRange(0, vertex);
  }

  #writeSmokeBuffers(): void {
    const position = this.#smokeGeometry.getAttribute(
      "position",
    ) as BufferAttribute;
    const color = this.#smokeGeometry.getAttribute("color") as BufferAttribute;
    const alpha = this.#smokeGeometry.getAttribute("alpha") as BufferAttribute;
    const pointSize = this.#smokeGeometry.getAttribute(
      "pointSize",
    ) as BufferAttribute;
    const base = new Color();
    const lit = new Color();

    this.#smoke.slice(0, MAX_SMOKE).forEach((smoke, index) => {
      const life = smoke.age / smoke.lifetime;
      const fadeIn = Math.min(smoke.age / 0.6, 1);
      const fadeOut = Math.pow(1 - life, 1.45);
      base.setHex(smoke.baseColor);
      lit.setHex(smoke.illuminationColor);
      base.lerp(lit, smoke.illumination * 0.72);
      position.setXYZ(
        index,
        smoke.position.x,
        smoke.position.y,
        smoke.position.z,
      );
      color.setXYZ(index, base.r, base.g, base.b);
      alpha.setX(index, fadeIn * fadeOut * (0.12 + smoke.illumination * 0.2));
      pointSize.setX(index, smoke.size);
    });

    for (const attribute of [position, color, alpha, pointSize]) {
      attribute.needsUpdate = true;
    }
    this.#smokeGeometry.setDrawRange(
      0,
      Math.min(this.#smoke.length, MAX_SMOKE),
    );
  }
}
