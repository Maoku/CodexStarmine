export function createPhaseStatus(isWebGL2: boolean): HTMLElement {
  const panel = document.createElement("section");
  panel.className = "status-panel";
  panel.setAttribute("aria-live", "polite");

  const eyebrow = document.createElement("p");
  eyebrow.className = "status-panel__eyebrow";
  eyebrow.textContent = "CODEX STARMINE";

  const heading = document.createElement("h1");
  heading.textContent = "花火を待つ夜空";

  const state = document.createElement("p");
  state.className = "status-panel__state";
  state.textContent = isWebGL2
    ? "PHASE 0 · WEBGL 2 READY"
    : "PHASE 0 · WEBGL READY";

  panel.append(eyebrow, heading, state);
  return panel;
}
