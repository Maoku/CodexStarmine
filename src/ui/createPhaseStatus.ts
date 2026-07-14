export function createPhaseStatus(isWebGL2: boolean): HTMLElement {
  const panel = document.createElement("section");
  panel.className = "status-panel";
  panel.setAttribute("aria-live", "polite");

  const eyebrow = document.createElement("p");
  eyebrow.className = "status-panel__eyebrow";
  eyebrow.textContent = "CODEX STARMINE";

  const heading = document.createElement("h1");
  heading.textContent = "六景、三つの大きさ";

  const state = document.createElement("p");
  state.className = "status-panel__state";
  state.textContent = isWebGL2
    ? "PHASE 3 · 6 PATTERNS / 3 SIZES"
    : "PHASE 3 · WEBGL ACTIVE";

  panel.append(eyebrow, heading, state);
  return panel;
}
