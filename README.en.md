# Codex Starmine

[日本語版](README.md)

Codex Starmine is a browser simulation for designing virtual launch fireworks and viewing them over a lakeside nightscape. It is built with GPT-5.6 Sol / Codex; the implementation-plan support and image-to-firework feature use Claude Fable 5.

[Open the app in English](https://maoku.github.io/CodexStarmine/?lang=en)

## What you can do

1. Choose **Create fireworks** to open the firework shelf, create a shell, or edit a saved work.
2. Choose a size and a chrysanthemum, peony, or blank starting pattern.
3. Add preset, pattern, and manual layers; arrange virtual stars in the shell; use Undo/Redo and the launch preview.
4. Use **Check** to repeatedly launch the work in fixed conditions over the lake.
5. Save to the shelf, export a JSON backup, or import it later. Existing v1–v4 works remain compatible.
6. Choose **Free viewing** to watch an automatic show including your saved works.

The app stores works in browser `localStorage`. Export important works as JSON before changing browsers or profiles. Image processing runs in the browser; selected images and filenames are not included in the saved work.

## Development

```bash
npm install
npm run dev
npm run lint
npm run test:run
npm run format:check
npm run build
```

## Documentation

- [English documentation index](Docs/README.en.md)
- [English user guide](Docs/USER_GUIDE.en.md)
- [Image-to-starmine specification](Docs/IMAGE_TO_STARMINE.en.md)
- [Japanese documentation](Docs/README.md)

## License

MIT
