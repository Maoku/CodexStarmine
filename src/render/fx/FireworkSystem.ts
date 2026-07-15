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

import { compileFireworkDesign, type CompiledStar } from "../../core/burst";
import {
  evaluateColorStages,
  integrateParticle,
  type BallisticParticle,
  type Vector3Value,
} from "../../core/particle";
import { resolveSizePreset, type FireworkDesign } from "../../data";
import { WATER_LEVEL } from "../scene/createNightSkyScene";

const MAX_STARS = 6_000;
const MAX_SMOKE = 1_400;
const MAX_TRAIL_VERTICES = 60_000;
const GRAVITY = 9.81;

interface Shell extends BallisticParticle {
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
  brightness: number;
  colorStages: FireworkDesign["colorStages"];
  history: Vector3Value[];
  pointScale: number;
  sparkle: number;
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
  lane?: number;
  launchAngle?: number;
  seed?: number;
  targetHeight?: number;
}

export interface FireworkSystemCallbacks {
  onBurst?: (position: Vector3Value, design: FireworkDesign) => void;
  onLaunch?: (design: FireworkDesign) => void;
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
  readonly #wind = { x: 1.25, y: 0, z: 0.18 };
  #delayedBursts: DelayedBurst[] = [];
  #shells: Shell[] = [];
  #smoke: SmokeParticle[] = [];
  #stars: Star[] = [];

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
    const lane = Math.min(Math.max(options.lane ?? 0, -1), 1);
    const size = resolveSizePreset(design.sizeClass);
    const targetHeight =
      options.targetHeight ?? size.targetHeight * (0.97 + Math.random() * 0.06);
    const seed = options.seed ?? Math.floor(Math.random() * 1_000_000);
    const position = {
      x: lane * 42 + (Math.random() - 0.5) * 1.8,
      y: 2.2,
      z: -112,
    };
    this.#shells.push({
      age: 0,
      design,
      drag: 0.035,
      gravityScale: 1,
      lifetime: 4.2,
      position,
      seed,
      smokeTimer: 0,
      targetHeight,
      trail: [clonePosition(position)],
      velocity: {
        x:
          lane * -1.8 +
          (options.launchAngle ?? 0) * 18 +
          (Math.random() - 0.5) * 1.4,
        y:
          Math.sqrt(2 * GRAVITY * Math.max(targetHeight - position.y, 1)) *
          1.025,
        z: -2.6,
      },
      windResponse: 0.12,
    });
    this.#callbacks.onLaunch?.(design);
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
      const lifetime = definition.burnDuration * compiled.lifetimeScale;
      this.#stars.push({
        age: -compiled.timingOffset,
        brightness: (0.72 + size.pointScale * 0.28) * compiled.intensityScale,
        colorStages: definition.colorStages,
        drag: definition.drag,
        gravityScale: definition.gravityScale,
        history: [clonePosition(position)],
        lifetime,
        pointScale: size.pointScale * Math.max(definition.trailWidth, 0.72),
        position: {
          x: position.x + compiled.initialPosition.x,
          y: position.y + compiled.initialPosition.y,
          z: position.z + compiled.initialPosition.z,
        },
        sparkle: definition.flicker,
        trailLength: definition.trailLifetime,
        trailWidth: definition.trailWidth,
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
      });
    }
  }

  #emitBurst(
    position: Vector3Value,
    inheritedVelocity: Vector3Value,
    design: FireworkDesign,
    seed: number,
    includeChildren = true,
  ): void {
    const plan = compileFireworkDesign(design, seed);
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
    this.#emitBurst(shell.position, shell.velocity, shell.design, shell.seed);
    this.#spawnBurstSmoke(shell.position, shell.design);
    this.#illuminateSmoke(
      shell.position,
      shell.design.colorStages[1]?.color ??
        shell.design.colorStages[0]?.color ??
        0xffffff,
      resolveSizePreset(shell.design.sizeClass).burstScale,
    );
    this.#callbacks.onBurst?.(clonePosition(shell.position), shell.design);
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
      integrateParticle(shell, delta, { gravity: GRAVITY, wind: this.#wind });
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
            x: this.#wind.x * 0.32 + (Math.random() - 0.5) * 0.25,
            y: -0.45 + Math.random() * 0.5,
            z: this.#wind.z * 0.3,
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
      smoke.velocity.x += this.#wind.x * 0.12 * delta;
      smoke.velocity.y += 0.13 * delta;
      smoke.velocity.z += this.#wind.z * 0.12 * delta;
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
    for (const star of this.#stars) {
      if (star.age < 0) {
        star.age += delta;
        active.push(star);
        continue;
      }
      integrateParticle(star, delta, { gravity: GRAVITY, wind: this.#wind });
      if (star.trailLength > 0.14 && star.age < star.lifetime * 0.92) {
        star.history.push(clonePosition(star.position));
        const maxHistory = Math.max(Math.round(3 + star.trailLength * 9), 2);
        if (star.history.length > maxHistory) {
          star.history.shift();
        }
      }
      if (star.age < star.lifetime && star.position.y > -15) {
        active.push(star);
      }
    }
    this.#stars = active;
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
        ? { color: 0xffc66e, intensity: 1.3 }
        : evaluateColorStages(item.colorStages, item.age / item.lifetime);
      const flicker =
        !isShell && item.sparkle > 0
          ? 1 - item.sparkle * 0.25 + Math.random() * item.sparkle * 0.35
          : 1;
      const opacity = Math.max(evaluated.intensity * flicker, 0);
      tempColor.setHex(evaluated.color);
      position.setXYZ(index, item.position.x, item.position.y, item.position.z);
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
        item.position.x * 1.03,
        WATER_LEVEL + 0.34,
        -70 -
          Math.max(item.position.y, 0) * 1.72 +
          (item.position.z + 112) * 0.2,
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
    ): void => {
      tempColor.setHex(colorHex);
      for (
        let index = 1;
        index < history.length && vertex + 2 <= MAX_TRAIL_VERTICES;
        index += 1
      ) {
        const previous = history[index - 1];
        const current = history[index];
        const fade = (index / history.length) * intensity;
        position.setXYZ(vertex, previous.x, previous.y, previous.z);
        color.setXYZ(
          vertex,
          tempColor.r * fade * 0.35,
          tempColor.g * fade * 0.35,
          tempColor.b * fade * 0.35,
        );
        vertex += 1;
        position.setXYZ(vertex, current.x, current.y, current.z);
        color.setXYZ(
          vertex,
          tempColor.r * fade,
          tempColor.g * fade,
          tempColor.b * fade,
        );
        vertex += 1;
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
      const evaluated = evaluateColorStages(
        star.colorStages,
        star.age / star.lifetime,
      );
      writeHistory(star.history, evaluated.trailColor, evaluated.intensity);
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
