import "./style.css";

import { NightSkyApp } from "./render/NightSkyApp";
import { initialLocale, text } from "./i18n";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("App root element was not found.");
}

let app: NightSkyApp | undefined;
const locale = initialLocale();
document.documentElement.lang = locale;
document.title = "Codex Starmine";
document
  .querySelector<HTMLMetaElement>('meta[name="description"]')
  ?.setAttribute("content", text(locale, "description"));

try {
  app = new NightSkyApp(root, locale);
  app.start();
} catch (error) {
  console.error(error);
  root.dataset.state = "error";
  root.innerHTML = `
    <section class="webgl-error" role="alert">
      <p class="status-panel__eyebrow">CODEX STARMINE</p>
      <h1>${text(locale, "webglHeading")}</h1>
      <p>${text(locale, "webglDetail")}</p>
    </section>
  `;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => app?.destroy());
}
