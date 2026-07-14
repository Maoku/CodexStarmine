import { Color, FogExp2, PerspectiveCamera, Scene } from "three";

export const NIGHT_SKY_COLOR = 0x020511;

export interface NightSkyScene {
  camera: PerspectiveCamera;
  scene: Scene;
}

export function createNightSkyScene(aspect: number): NightSkyScene {
  const scene = new Scene();
  scene.background = new Color(NIGHT_SKY_COLOR);
  scene.fog = new FogExp2(NIGHT_SKY_COLOR, 0.0008);

  const camera = new PerspectiveCamera(50, aspect, 0.1, 2_000);
  camera.position.set(0, 8, 26);
  camera.lookAt(0, 16, 0);

  return { camera, scene };
}
