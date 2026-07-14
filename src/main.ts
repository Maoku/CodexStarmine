import "./style.css";

import { NightSkyApp } from "./render/NightSkyApp";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("App root element was not found.");
}

let app: NightSkyApp | undefined;

try {
  app = new NightSkyApp(root);
  app.start();
} catch (error) {
  console.error(error);
  root.dataset.state = "error";
  root.innerHTML = `
    <section class="webgl-error" role="alert">
      <p class="status-panel__eyebrow">CODEX STARMINE</p>
      <h1>夜空を表示できませんでした</h1>
      <p>WebGL 2 が利用できるブラウザで、もう一度お試しください。</p>
    </section>
  `;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => app?.destroy());
}
