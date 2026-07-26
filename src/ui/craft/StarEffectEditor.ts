import type { VirtualStarPreset } from "../../data";
import { colorToCSS, escapeHTML } from "./viewUtils";

function selected(selected: boolean): string {
  return selected ? "selected" : "";
}

export function renderStarEffectEditor(
  star: VirtualStarPreset,
  disabled = false,
): string {
  const profile = star.effectProfile ?? {};
  const color = profile.color ?? {
    mode: "smooth",
    playback: "once",
    repeatCount: 1,
  };
  const light = profile.light ?? {
    dutyCycle: 0.5,
    frequencyHz: 6,
    mode: "continuous",
  };
  const motion = profile.motion ?? {
    amplitude: 0.35,
    mode: "ballistic",
  };
  const secondary = profile.secondary ?? {
    count: 0,
    mode: "none",
  };
  const trail = profile.trail ?? {
    frequencyHz: 6,
    grainSpacing: 2,
    mode: "continuous",
  };
  const disabledAttribute = disabled ? "disabled" : "";
  return `<details class="star-effect-editor">
    <summary>仮想星の効果を編集</summary>
    <div class="star-effect-editor__body">
      <button type="button" data-action="duplicate-selected-star" ${disabledAttribute}>作品内へ複製</button>
      <label><span>名称</span><input name="star-effect-name" type="text" maxlength="28" value="${escapeHTML(star.displayName)}" ${disabledAttribute} /></label>
      <fieldset>
        <legend>色段階</legend>
        <div class="star-effect-stage-grid">${star.colorStages
          .map(
            (stage, index) =>
              `<label><span>${index + 1}</span><input name="star-effect-stage-color" data-stage="${index}" type="color" value="${colorToCSS(stage.color)}" aria-label="色段階${index + 1}" ${disabledAttribute} /></label>`,
          )
          .join("")}</div>
        <label><span>色の変わり方</span><select name="star-effect-color-mode" ${disabledAttribute}><option value="smooth" ${selected(color.mode === "smooth")}>滑らか</option><option value="step" ${selected(color.mode === "step")}>瞬時</option></select></label>
        <label><span>色の再生</span><select name="star-effect-color-playback" ${disabledAttribute}><option value="once" ${selected(color.playback === "once")}>1回</option><option value="loop" ${selected(color.playback === "loop")}>繰り返し</option><option value="pingPong" ${selected(color.playback === "pingPong")}>往復</option></select></label>
        <label><span>色の反復 <output>${color.repeatCount ?? 1}</output></span><input name="star-effect-color-repeat" type="range" min="1" max="8" value="${color.repeatCount ?? 1}" ${disabledAttribute} /></label>
      </fieldset>
      <fieldset>
        <legend>発光</legend>
        <label><span>点滅</span><select name="star-effect-light-mode" ${disabledAttribute}><option value="continuous" ${selected(light.mode === "continuous")}>なし</option><option value="strobe" ${selected(light.mode === "strobe")}>周期点滅</option></select></label>
        <label><span>点滅速度 <output>${light.frequencyHz ?? 6}Hz</output></span><input name="star-effect-light-frequency" type="range" min="5" max="180" value="${Math.round((light.frequencyHz ?? 6) * 10)}" ${disabledAttribute} /></label>
        <label><span>点灯時間 <output>${Math.round((light.dutyCycle ?? 0.5) * 100)}%</output></span><input name="star-effect-light-duty" type="range" min="8" max="92" value="${Math.round((light.dutyCycle ?? 0.5) * 100)}" ${disabledAttribute} /></label>
        <label><span>消え際</span><select name="star-effect-terminal-mode" ${disabledAttribute}><option value="none" ${selected(!light.terminal || light.terminal.mode === "none")}>なし</option><option value="kouro" ${selected(light.terminal?.mode === "kouro")}>光露</option><option value="teka" ${selected(light.terminal?.mode === "teka")}>輝</option></select></label>
      </fieldset>
      <fieldset>
        <legend>動きと終端</legend>
        <label><span>動き</span><select name="star-effect-motion-mode" ${disabledAttribute}><option value="ballistic" ${selected(motion.mode === "ballistic")}>弾道</option><option value="fallingLeaf" ${selected(motion.mode === "fallingLeaf")}>葉落</option><option value="wander" ${selected(motion.mode === "wander")}>遊泳</option><option value="spiral" ${selected(motion.mode === "spiral")}>旋回</option></select></label>
        <label><span>動きの幅 <output>${Math.round((motion.amplitude ?? 0.35) * 100)}%</output></span><input name="star-effect-motion-amplitude" type="range" min="0" max="100" value="${Math.round((motion.amplitude ?? 0.35) * 100)}" ${disabledAttribute} /></label>
        <label><span>終端</span><select name="star-effect-secondary-mode" ${disabledAttribute}><option value="none" ${selected(secondary.mode === "none")}>なし</option><option value="spark" ${selected(secondary.mode === "spark")}>火花</option><option value="microBurst" ${selected(secondary.mode === "microBurst")}>小分裂</option></select></label>
        <label><span>終端の粒数 <output>${secondary.count ?? 0}</output></span><input name="star-effect-secondary-count" type="range" min="0" max="6" value="${secondary.count ?? 0}" ${disabledAttribute} /></label>
      </fieldset>
      <fieldset>
        <legend>尾と煙</legend>
        <label><span>尾の表現</span><select name="star-effect-trail-mode" ${disabledAttribute}><option value="continuous" ${selected(trail.mode === "continuous")}>連続</option><option value="strobe" ${selected(trail.mode === "strobe")}>尾だけ点滅</option><option value="granular" ${selected(trail.mode === "granular")}>粒状</option></select></label>
        <label><span>尾の点滅速度 <output>${trail.frequencyHz ?? 6}Hz</output></span><input name="star-effect-trail-frequency" type="range" min="5" max="180" value="${Math.round((trail.frequencyHz ?? 6) * 10)}" ${disabledAttribute} /></label>
        <label><span>粒の間隔 <output>${trail.grainSpacing ?? 2}</output></span><input name="star-effect-trail-grain" type="range" min="1" max="4" value="${trail.grainSpacing ?? 2}" ${disabledAttribute} /></label>
        <label><span>尾の太さ <output>${Math.round(star.trailWidth * 100)}%</output></span><input name="star-effect-trail-width" type="range" min="20" max="200" value="${Math.round(star.trailWidth * 100)}" ${disabledAttribute} /></label>
        <label><span>煙の量 <output>${Math.round(star.smokeAmount * 100)}%</output></span><input name="star-effect-smoke" type="range" min="0" max="100" value="${Math.round(star.smokeAmount * 100)}" ${disabledAttribute} /></label>
      </fieldset>
    </div>
  </details>`;
}
