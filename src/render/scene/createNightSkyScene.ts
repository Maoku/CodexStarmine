import {
  AdditiveBlending,
  AmbientLight,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Vector3,
} from "three";

export const NIGHT_SKY_COLOR = 0x01030b;
export const WATER_LEVEL = 0;

export interface NightSkyScene {
  camera: PerspectiveCamera;
  environmentLight: HemisphereLight;
  scene: Scene;
  update: (elapsedSeconds: number) => void;
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function createSkyDome(): Mesh<SphereGeometry, ShaderMaterial> {
  const material = new ShaderMaterial({
    uniforms: {
      horizonColor: { value: new Color(0x122342) },
      midColor: { value: new Color(0x071126) },
      zenithColor: { value: new Color(0x01030b) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 horizonColor;
      uniform vec3 midColor;
      uniform vec3 zenithColor;
      varying vec3 vWorldPosition;
      void main() {
        float heightMix = clamp(normalize(vWorldPosition).y * 1.65, 0.0, 1.0);
        vec3 lower = mix(horizonColor, midColor, smoothstep(0.0, 0.36, heightMix));
        vec3 color = mix(lower, zenithColor, smoothstep(0.3, 1.0, heightMix));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: BackSide,
    depthWrite: false,
  });

  return new Mesh(new SphereGeometry(950, 40, 24), material);
}

function createStars(): Points<BufferGeometry, PointsMaterial> {
  const random = seededRandom(0x57a2_2026);
  const count = 1_450;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const theta = random() * Math.PI * 2;
    const height = 55 + Math.pow(random(), 0.72) * 630;
    const radius = 700 + random() * 120;
    const offset = index * 3;
    positions[offset] = Math.cos(theta) * radius;
    positions[offset + 1] = height;
    positions[offset + 2] = Math.sin(theta) * radius - 120;

    const warmth = random();
    const brightness = 0.48 + random() * 0.52;
    colors[offset] = brightness;
    colors[offset + 1] = brightness * (0.88 + warmth * 0.12);
    colors[offset + 2] = brightness * (0.86 + (1 - warmth) * 0.14);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));

  return new Points(
    geometry,
    new PointsMaterial({
      blending: AdditiveBlending,
      color: 0xffffff,
      depthWrite: false,
      opacity: 0.88,
      size: 1.25,
      sizeAttenuation: true,
      transparent: true,
      vertexColors: true,
    }),
  );
}

function createMountainLayer(
  seed: number,
  baseY: number,
  color: number,
  z: number,
  amplitude: number,
): Mesh<ShapeGeometry, MeshBasicMaterial> {
  const random = seededRandom(seed);
  const shape = new Shape();
  shape.moveTo(-720, baseY - 70);
  shape.lineTo(-720, baseY);

  for (let x = -720; x <= 720; x += 24) {
    const broad = Math.sin(x * 0.012 + seed) * amplitude * 0.42;
    const ridge = Math.abs(Math.sin(x * 0.029 + seed * 0.3)) * amplitude * 0.58;
    const noise = random() * amplitude * 0.34;
    shape.lineTo(x, baseY + broad + ridge + noise);
  }

  shape.lineTo(720, baseY - 70);
  shape.closePath();
  const mountain = new Mesh(
    new ShapeGeometry(shape),
    new MeshBasicMaterial({ color, fog: true }),
  );
  mountain.position.z = z;
  return mountain;
}

function createMoon(): Group {
  const group = new Group();
  group.position.set(-245, 286, -610);

  const glow = new Mesh(
    new CircleGeometry(22, 64),
    new MeshBasicMaterial({
      blending: AdditiveBlending,
      color: 0x8ca7ce,
      depthWrite: false,
      opacity: 0.14,
      transparent: true,
    }),
  );
  glow.scale.setScalar(2.9);

  const disc = new Mesh(
    new CircleGeometry(18, 64),
    new MeshBasicMaterial({ color: 0xdbe4ed, fog: false }),
  );
  disc.position.z = 0.2;
  group.add(glow, disc);
  return group;
}

function createLake(): {
  lake: Mesh<PlaneGeometry, ShaderMaterial>;
  material: ShaderMaterial;
} {
  const material = new ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      deepColor: { value: new Color(0x010711) },
      horizonColor: { value: new Color(0x142c47) },
      moonColor: { value: new Color(0x9cb6d0) },
    },
    vertexShader: `
      uniform float time;
      varying vec2 vUv;
      varying float vRipple;
      void main() {
        vUv = uv;
        vec3 p = position;
        float waveA = sin(p.x * 0.055 + time * 0.55) * 0.24;
        float waveB = sin(p.y * 0.037 - time * 0.34) * 0.18;
        p.z += waveA + waveB;
        vRipple = waveA + waveB;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 deepColor;
      uniform vec3 horizonColor;
      uniform vec3 moonColor;
      varying vec2 vUv;
      varying float vRipple;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      void main() {
        float horizon = pow(1.0 - vUv.y, 2.7);
        vec3 color = mix(deepColor, horizonColor, horizon * 0.72);
        float waves = sin(vUv.x * 330.0 + vUv.y * 57.0 + time * 0.7);
        waves += sin(vUv.x * 118.0 - vUv.y * 83.0 - time * 0.42);
        float sparkle = smoothstep(1.62, 1.96, waves + hash(floor(vUv * 420.0)) * 0.18);
        float moonPath = exp(-pow((vUv.x - 0.31) * 15.0, 2.0));
        moonPath *= smoothstep(0.02, 0.58, vUv.y) * (0.6 + sparkle * 1.8);
        color += moonColor * moonPath * (0.045 + sparkle * 0.075);
        color += vec3(0.018, 0.035, 0.052) * sparkle;
        color += vRipple * 0.008;
        gl_FragColor = vec4(color, 0.97);
      }
    `,
    side: DoubleSide,
  });

  const lake = new Mesh(new PlaneGeometry(1_600, 1_150, 96, 72), material);
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(0, WATER_LEVEL, -260);
  return { lake, material };
}

function createLaunchSite(): Group {
  const site = new Group();
  const island = new Mesh(
    new PlaneGeometry(126, 18),
    new MeshStandardMaterial({ color: 0x060807, roughness: 0.94 }),
  );
  island.rotation.x = -Math.PI / 2;
  island.position.set(0, 0.22, -115);
  site.add(island);

  const lampMaterial = new MeshBasicMaterial({ color: 0xffa553 });
  for (const x of [-52, -26, 0, 26, 52]) {
    const lamp = new Mesh(new SphereGeometry(0.45, 10, 6), lampMaterial);
    lamp.position.set(x, 1.35, -112);
    site.add(lamp);
  }
  return site;
}

export function createNightSkyScene(aspect: number): NightSkyScene {
  const scene = new Scene();
  scene.background = new Color(NIGHT_SKY_COLOR);
  scene.fog = new FogExp2(0x07101d, 0.00105);

  const camera = new PerspectiveCamera(48, aspect, 0.5, 2_100);
  camera.position.set(0, 13, 74);
  camera.lookAt(new Vector3(0, 104, -155));

  scene.add(createSkyDome(), createStars(), createMoon());
  scene.add(
    createMountainLayer(17, 4, 0x0a1320, -430, 35),
    createMountainLayer(41, 0, 0x050b12, -275, 25),
  );

  const { lake, material: lakeMaterial } = createLake();
  scene.add(lake, createLaunchSite());

  const environmentLight = new HemisphereLight(0x334b71, 0x010204, 0.42);
  const moonLight = new DirectionalLight(0x8ca6c9, 0.36);
  moonLight.position.set(-160, 260, -180);
  scene.add(environmentLight, moonLight, new AmbientLight(0x10182b, 0.18));

  return {
    camera,
    environmentLight,
    scene,
    update: (elapsedSeconds: number) => {
      lakeMaterial.uniforms.time.value = elapsedSeconds;
    },
  };
}
