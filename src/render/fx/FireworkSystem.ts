import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  LineBasicMaterial,
  LineSegments,
  Points,
  Scene,
  ShaderMaterial,
} from "three";

import {
  generateHeartBurst,
  generatePalmBurst,
  generateSphereBurst,
  type BurstDirection,
} from "../../core/burst";
import {
  evaluateColorStages,
  integrateParticle,
  type BallisticParticle,
  type Vector3Value,
} from "../../core/particle";
import {
  resolveSizePreset,
  type ColorStage,
  type FireworkDesign,
} from "../../data";
import { WATER_LEVEL } from "../scene/createNightSkyScene";

const MAX_STARS = 6_000;
const MAX_TRAIL_VERTICES = 60_000;
const GRAVITY = 9.81;

interface Shell extends BallisticParticle {
  design: FireworkDesign;
  seed: number;
  targetHeight: number;
  trail: Vector3Value[];
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
  seed: number;
  velocity: Vector3Value;
}

export interface LaunchOptions {
  lane?: number;
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
  readonly #trailGeometry = new BufferGeometry();
  readonly #trails: LineSegments;
  readonly #wind = { x: 1.25, y: 0, z: 0.18 };
  #delayedBursts: DelayedBurst[] = [];
  #shells: Shell[] = [];
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
    this.#reflectionPoints.renderOrder = 4;
    scene.add(this.#trails, this.#starPoints, this.#reflectionPoints);
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
      targetHeight,
      trail: [clonePosition(position)],
      velocity: {
        x: lane * -1.8 + (Math.random() - 0.5) * 1.4,
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
    this.#writePointBuffers();
    this.#writeTrailBuffers();
  }

  dispose(): void {
    this.#starGeometry.dispose();
    this.#reflectionGeometry.dispose();
    this.#trailGeometry.dispose();
    (this.#starPoints.material as ShaderMaterial).dispose();
    (this.#reflectionPoints.material as ShaderMaterial).dispose();
    (this.#trails.material as LineBasicMaterial).dispose();
  }

  #appendStars(
    position: Vector3Value,
    inheritedVelocity: Vector3Value,
    design: FireworkDesign,
    directions: BurstDirection[],
    speedScale: number,
    colorStages = design.colorStages,
  ): void {
    const size = resolveSizePreset(design.sizeClass);
    for (const burst of directions) {
      const speed = design.burstVelocity * burst.speedFactor * speedScale;
      const lifetime = design.burnDuration * (0.88 + Math.random() * 0.2);
      this.#stars.push({
        age: 0,
        brightness: 0.72 + size.pointScale * 0.28,
        colorStages,
        drag: design.drag,
        gravityScale: design.gravityScale,
        history: [clonePosition(position)],
        lifetime,
        pointScale: size.pointScale * Math.max(design.trailStyle.width, 0.72),
        position: clonePosition(position),
        sparkle: design.trailStyle.sparkle,
        trailLength: design.trailStyle.length,
        trailWidth: design.trailStyle.width,
        velocity: {
          x: burst.direction.x * speed + inheritedVelocity.x * 0.12,
          y: burst.direction.y * speed + inheritedVelocity.y * 0.06,
          z: burst.direction.z * speed + inheritedVelocity.z * 0.12,
        },
        windResponse: design.windResponse,
      });
    }
  }

  #emitBurst(
    position: Vector3Value,
    inheritedVelocity: Vector3Value,
    design: FireworkDesign,
    seed: number,
    includeCores = true,
  ): void {
    const size = resolveSizePreset(design.sizeClass);
    const count = Math.max(
      Math.round(design.particleDensity * size.particleScale),
      12,
    );
    let directions: BurstDirection[];
    switch (design.burstShape) {
      case "heart":
        directions = generateHeartBurst(count, seed);
        break;
      case "palm":
        directions = generatePalmBurst(count, seed);
        break;
      case "children":
        directions = generateSphereBurst(
          Math.max(Math.round(count * 0.24), 18),
          design.symmetry,
          seed,
        );
        break;
      default:
        directions = generateSphereBurst(count, design.symmetry, seed);
    }

    const shapeScale = design.burstShape === "children" ? 0.36 : 1;
    this.#appendStars(
      position,
      inheritedVelocity,
      design,
      directions,
      size.burstScale * shapeScale,
    );

    if (includeCores) {
      design.coreLayers.forEach((core, index) => {
        const coreCount = Math.max(
          Math.round(count * (0.24 + core.radius * 0.12)),
          24,
        );
        const coreStages: ColorStage[] = [
          {
            normalizedTime: 0,
            color: 0xffffff,
            intensity: 1.32,
            trailColor: core.color,
          },
          {
            normalizedTime: 0.16,
            color: core.color,
            intensity: 0.94,
            trailColor: core.color,
          },
          {
            normalizedTime: 1,
            color: core.color,
            intensity: 0,
            trailColor: core.color,
          },
        ];
        this.#appendStars(
          position,
          inheritedVelocity,
          { ...design, burnDuration: design.burnDuration * 0.72 },
          generateSphereBurst(coreCount, 0.99, seed + 41 + index * 17),
          size.burstScale * core.radius,
          coreStages,
        );
      });
    }

    if (design.burstShape === "children") {
      for (const child of design.childBursts) {
        const carriers = generateSphereBurst(
          child.count,
          design.symmetry,
          seed + 503,
        );
        carriers.forEach((carrier, index) => {
          this.#delayedBursts.push({
            age: 0,
            delay: child.delay + index * 0.018 + Math.random() * 0.11,
            design: {
              ...design,
              burstShape: "sphere",
              burstVelocity: 11.5,
              burnDuration: 1.5,
              childBursts: [],
              coreLayers: [],
              particleDensity: 24,
              trailStyle: { ...design.trailStyle, length: 0.12 },
            },
            position: clonePosition(position),
            seed: seed + 701 + index * 23,
            velocity: {
              x: carrier.direction.x * child.radius,
              y: carrier.direction.y * child.radius,
              z: carrier.direction.z * child.radius,
            },
          });
        });
      }
    }

    if (this.#stars.length > MAX_STARS - 10) {
      this.#stars.splice(0, this.#stars.length - (MAX_STARS - 10));
    }
  }

  #burst(shell: Shell): void {
    this.#emitBurst(shell.position, shell.velocity, shell.design, shell.seed);
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
        this.#emitBurst(
          delayed.position,
          delayed.velocity,
          delayed.design,
          delayed.seed,
          false,
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

  #updateStars(delta: number): void {
    const active: Star[] = [];
    for (const star of this.#stars) {
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
    const visible = [...this.#shells, ...this.#stars].slice(0, MAX_STARS);
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
        WATER_LEVEL - Math.max(item.position.y - WATER_LEVEL, 0) * 0.31,
        item.position.z - 2,
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
      writeHistory(shell.trail, 0xffa84f, 1.1);
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
}
