export function createPhaseStatus(isWebGL2: boolean): HTMLElement {
  const panel = document.createElement("section");
  panel.className = "status-panel";
  panel.setAttribute("aria-live", "polite");

  const eyebrow = document.createElement("p");
  eyebrow.className = "status-panel__eyebrow";
  eyebrow.textContent = "CODEX STARMINE";

  const heading = document.createElement("h1");
  heading.textContent = "菊と牡丹、湖上にひらく";

  const state = document.createElement("p");
  state.className = "status-panel__state";
  state.textContent = isWebGL2
    ? "PHASE 2 · BALLISTICS ACTIVE"
    : "PHASE 2 · WEBGL ACTIVE";

  panel.append(eyebrow, heading, state);
  return panel;
}
