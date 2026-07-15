# Renewal UI mockup prompt set

- Generator: built-in `imagegen`
- Use case: `ui-mockup`
- Output: PNG, 1672 × 941
- Primary style reference: `../phase-6-5-internal-layout-editor-v2.png`

## 01 Mode selection

Reference images:

- `../phase-6-5-internal-layout-editor-v2.png`: style reference

```text
Use case: ui-mockup
Asset type: desktop browser game renewal mockup, screen 1 of 5
Input images: Image 1 is a style reference only; preserve its deep navy, warm gold, Japanese atelier, lacquered wood and textured paper visual language, but create a brand-new screen.
Primary request: Create the mode selection home screen for the Japanese virtual-firework design app "星見煙火店".
Scene/backdrop: full-bleed calm lakeside night with subtle stars, mountain silhouettes and reflected gold light; a restrained distant firework glow, cinematic but still clearly a practical product UI.
Subject: centered welcome composition with the brand title "星見煙火店" and exactly two large equal choice cards. First card label "花火を作る" with a refined illustration of an opened spherical shell and colored virtual stars. Second card label "フリー鑑賞" with a refined lakeside fireworks illustration. A small top-right sound button and a small footer safety note area.
Style/medium: polished shippable desktop game UI mockup, not concept art; Japanese premium craft aesthetic; same visual system as Image 1.
Composition/framing: 16:9 landscape, 1680 by 945 style, generous margins, symmetrical two-card hierarchy, large click targets, no side panels, no editor controls.
Lighting/mood: elegant summer night, quiet anticipation, warm gold highlights over dark navy.
Color palette: midnight navy, ink blue, antique gold, parchment beige, restrained vermilion and cobalt accents.
Text (verbatim): "星見煙火店", "花火を作る", "フリー鑑賞"
Constraints: render the three Japanese labels exactly once each and clearly; practical keyboard-focus states; no actual manufacturing instructions; no chemical labels; no logos or trademarks; no watermark; no extra main navigation tabs; avoid tiny dense text.
```

## 02 Firework shelf

Reference images:

- `02-firework-shelf.png`: edit target before correction

```text
Use case: precise-object-edit
Asset type: desktop browser game renewal mockup, corrected screen 2 of 5
Input images: Image 1 is the edit target. Preserve its page purpose, five-card shelf layout, navigation placement, card actions, and readable Japanese labels, but revise the visual setting and decoration.
Primary request: Change the saved-firework library into a practical working workshop. Keep the title "花火棚", the first card "新しい花火", four saved items, and the actions "編集", "削除", "戻る".
Change only these aspects:
- Make the screen clearly part of a working Japanese craft workshop: sturdy timber shelves, a plain workbench edge, small label holders, modest storage drawers, neutral task lighting.
- Replace ornate lacquered floral and scenic shell decorations with restrained handmade paper shells in muted solid colors, simple bands, tiny practical identification tags, and subtle surface texture.
- Remove decorative filigree, glowing corner flourishes, repeated gold rosettes, ornate borders, and collectible-display glamour.
- Use thin functional dividers. Reserve warm gold only for the selected card, current focus, and primary action.
- Keep "削除" visually secondary and calm.
Style/medium: polished shippable product UI, understated workshop utility, realistic tactile wood and paper, less ceremonial and less luxurious than Image 1.
Composition/framing: keep the existing 16:9 landscape structure and clear five-card hierarchy; make the environment feel used for daily work without clutter.
Lighting/mood: quiet practical workshop, warm neutral task lighting, focused and approachable.
Color palette: charcoal navy, natural wood brown, warm gray, off-white paper, muted vermilion and indigo, very limited antique gold.
Text (verbatim): "花火棚", "新しい花火", "編集", "削除", "戻る"
Constraints: preserve all listed labels clearly; no extra prominent labels; no flowers, waves, maple leaves, gilded art, ornate lacquer painting, filigree, excessive glow, real ingredients, measurements, chemistry, manufacturing instructions, trademarks, or watermark.
```

## 03 Initial setup

Reference images:

- `../phase-6-5-internal-layout-editor-v2.png`: established editor style
- `02-firework-shelf.png`: renewed shelf style

```text
Use case: ui-mockup
Asset type: desktop browser game renewal mockup, screen 3 of 5
Input images: Image 1 is the established editor style reference; Image 2 is the saved-firework shelf style reference. Use them only to keep the same visual system and create a brand-new screen.
Primary request: Create the new-firework initial setup screen for "星見煙火店". The user chooses a virtual shell size and a starting template or blank, then continues to the editor.
Scene/backdrop: deep navy application canvas with subtle Japanese paper texture and a very faint workshop tabletop silhouette; no night-sky fireworks.
Subject: header with back arrow and title "新しい花火". Centered two-step setup panel. Upper section title "大きさ" with three large circular shell-size choices labelled "小玉", "中玉", "大玉"; "中玉" is selected with a warm gold focus ring. Lower section title "型" with three equally prominent template cards: "菊" showing a clean abstract radial dotted icon, "牡丹" showing a softer radial dotted icon, and "白紙から" showing an empty hemisphere grid. A sticky footer has secondary "花火棚へ戻る" and primary gold "作り始める".
Style/medium: polished shippable desktop game UI mockup, not concept art; calm premium Japanese craft configurator; tactile paper and lacquer details; same deep navy and antique gold UI language as both references.
Composition/framing: 16:9 landscape; large centered panel; step sections stacked but both visible without scrolling; clear selection state; generous spacing; no sidebars, no fine parameter sliders, no real fireworks preview.
Lighting/mood: focused, welcoming, deliberate first step.
Color palette: midnight navy, ink blue, antique gold, parchment beige, muted vermilion and cobalt accents.
Text (verbatim): "新しい花火", "大きさ", "小玉", "中玉", "大玉", "型", "菊", "牡丹", "白紙から", "花火棚へ戻る", "作り始める"
Constraints: render all listed Japanese labels clearly and do not invent more prominent labels; emphasize that only size and starting template are chosen; no allowed-angle, ignition-timing, physics, chemistry, ingredients, real measurements, or manufacturing instructions; no logos or trademarks; no watermark; avoid tiny dense text.
```

## 04 Integrated editor

Reference images:

- `04-integrated-editor.png`: editor edit target before correction
- `02-firework-shelf.png`: simplified practical workshop style

```text
Use case: precise-object-edit
Asset type: desktop browser game renewal mockup, corrected screen 4 of 5
Input images: Image 1 is the editor edit target. Image 2 is a style reference for the newly simplified practical workshop treatment. Preserve Image 1's useful left-center-right editing hierarchy, but substantially revise the controls and decoration.
Primary request: Redesign the virtual-firework editor as one always-visible integrated workbench inside a practical workshop.
Required structural changes:
- Completely remove the top tabs and every tab-shaped control for hemisphere, section view, pattern, or simple check. There must be no view-tab row.
- Keep one large central workbench at all times: a cutaway spherical shell with virtual stars, coarse latitude/longitude guide lines, a selected quarter region, and direct drag placement. Circle and heart placement are tools applied directly to this same workbench, not alternate tabs or screens.
- Left column: expanded "レイヤー" list above an expanded "仮想星" parts tray.
- Right column: compact "配置ツール" with large "円形", "ハート", and "手動" controls, followed by selected-star basics.
- Add a small embedded window titled "簡易確認" in the lower right or lower center of the editor. It shows a compact abstract overview animation with sparse colored dots and a simple expanding ring, enough to understand the rough composition without leaving the editor.
- Bottom bar: undo/redo, simple rotation controls, secondary "保存", and a clear primary action "湖面で確認" that opens the full lakeside playback check.
Visual changes:
- Make the editor clearly part of a working craft workshop: natural wooden workbench edge, modest shelves or drawers, plain task lighting, practical panels.
- Remove decorative gold rosettes, filigree, ceremonial borders, excessive glow, and luxury presentation.
- Use thin functional lines and reserve warm gold for active selection and the primary button.
Style/medium: polished shippable desktop product UI, understated workshop utility, tactile paper shell and colored virtual stars, readable and practical.
Composition/framing: 16:9 landscape; left about 22 percent, center about 55 percent, right about 23 percent; no horizontal tab row; central workbench remains the dominant editing surface.
Lighting/mood: calm focused craft workshop, warm neutral work light.
Color palette: charcoal navy, natural wood, warm gray, off-white paper, muted vermilion, indigo and ochre, very limited antique gold.
Text (verbatim): "編集", "レイヤー", "仮想星", "配置ツール", "円形", "ハート", "手動", "簡易確認", "保存", "湖面で確認"
Constraints: render the listed labels clearly; preserve no tab labels from the original; no labels "半球" or "断面" anywhere; "型物" must not appear as a tab; no ornate decoration, real ingredients, dimensions, chemistry, manufacturing instructions, trademarks, or watermark; avoid tiny dense text.
```

## 05 Shared viewer

Reference images:

- `05-shared-viewer.png`: shared-viewer edit target before correction
- `01-mode-selection.png`: established lakeside scene and brand

```text
Use case: precise-object-edit
Asset type: desktop browser game renewal mockup, corrected screen 5 of 5
Input images: Image 1 is the shared-viewer edit target. Image 2 is a style reference for the established lakeside scene and brand. Preserve the lakeside composition and shared top/bottom control-shell idea, but change the purpose from abstract simple preview to real playback checking.
Primary request: Create the common lakeside viewing screen with the mode "確認" selected. This mode checks the actual edited firework by launching one real firework repeatedly in a single-shot loop. "フリー鑑賞" uses the same lake screen for automatic shows.
Required changes:
- Rename the selected top context from "簡易確認" to "確認". Keep "フリー鑑賞" as the adjacent unselected context.
- Remove every abstract guide ring, dotted diagram, directional arrow, legend, "イメージ表示" badge, and diagrammatic preview overlay.
- Show exactly one fully rendered virtual firework blooming over the lake, with a single launch trail, natural glow, reflection on the water, and restrained smoke. Do not show a multi-firework show.
- Add a small status label "単発ループ" and the current work name near the top or transport controls.
- Bottom transport controls should make the playback-check role obvious: large "再生" or pause button, loop on/off, interval indicator, and progress until the next single launch.
- Keep a clear "編集に戻る" button.
- Retain the same shared screen shell so that selecting "フリー鑑賞" would switch to the automatic show without changing the lake layout.
Style/medium: polished shippable desktop game UI, calm cinematic lakeside, practical playback controls, minimal decoration.
Composition/framing: 16:9 landscape; lake scene occupies at least 80 percent; one firework centered above the lake; slim top context switch; compact bottom transport bar.
Lighting/mood: serene night, clear playback check, restrained reflections.
Color palette: midnight navy, moonlit blue, warm gold UI accents, one firework using muted vermilion, indigo and gold.
Text (verbatim): "確認", "フリー鑑賞", "単発ループ", "再生", "編集に戻る"
Constraints: render all five labels clearly; show one real virtual firework only; no abstract guide rings or arrows; no "簡易確認" label; no multi-firework show; no excessive decorative borders, manufacturing instructions, trademarks, or watermark; avoid tiny dense text.
```
