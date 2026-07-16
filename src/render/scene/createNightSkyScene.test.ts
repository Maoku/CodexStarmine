import { Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  createNightSkyScene,
  NIGHT_LAKE_FRAGMENT_SHADER,
  NIGHT_LAKE_VERTEX_SHADER,
  NIGHT_SCENE_ACCESSIBLE_LABEL,
  resolveLakeQuality,
} from "./createNightSkyScene";

function lakeFromScene(pixelRatio: number) {
  const night = createNightSkyScene(16 / 9, pixelRatio);
  const lake = night.scene.getObjectByName("night-lake");
  if (!(lake instanceof Mesh) || !(lake.geometry instanceof PlaneGeometry)) {
    throw new Error("Night lake mesh is missing.");
  }
  if (!(lake.material instanceof ShaderMaterial)) {
    throw new Error("Night lake shader is missing.");
  }
  return { lake, night };
}

describe("night sky scene", () => {
  it("contains no moon object, reflection path, or moon aria copy", () => {
    const { night } = lakeFromScene(1);
    expect(night.scene.children.some((child) => /moon/i.test(child.name))).toBe(
      false,
    );
    expect(NIGHT_SCENE_ACCESSIBLE_LABEL).not.toContain("月");
    expect(NIGHT_LAKE_VERTEX_SHADER).not.toMatch(/moon/i);
    expect(NIGHT_LAKE_FRAGMENT_SHADER).not.toMatch(/moon/i);
  });

  it("uses layered drifting noise instead of two repeating wave bands", () => {
    expect(NIGHT_LAKE_VERTEX_SHADER).toContain("layeredNoise");
    expect(NIGHT_LAKE_FRAGMENT_SHADER).toContain("valueNoise");
    expect(NIGHT_LAKE_VERTEX_SHADER).not.toMatch(/waveA|waveB/);
    expect(NIGHT_LAKE_FRAGMENT_SHADER).not.toMatch(/moonPath|vUv\.x \* 330/);
  });

  it("reduces geometry density on high pixel-ratio displays", () => {
    const high = lakeFromScene(1).lake.geometry.attributes.position.count;
    const low = lakeFromScene(2).lake.geometry.attributes.position.count;
    expect(resolveLakeQuality(1)).toBe("high");
    expect(resolveLakeQuality(2)).toBe("low");
    expect(low).toBeLessThan(high);
  });

  it("keeps burst flash color and intensity connected to the lake", () => {
    const { lake, night } = lakeFromScene(1);
    night.flash(new Vector3(0, 120, -112), 0xff2200, 1.2);
    night.update(0.05);
    expect(lake.material.uniforms.flashColor.value.getHex()).toBe(0xff2200);
    expect(lake.material.uniforms.flashIntensity.value).toBeGreaterThan(0);
  });
});
