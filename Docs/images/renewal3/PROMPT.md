# Renewal3 編集画面イメージ生成プロンプト

## 実行方式

- スキル: `imagegen`
- モード: 組込みの `image_gen`（参照画像を使う新規生成）
- 用途分類: `ui-mockup`
- 生成日: 2026-07-16
- 参照画像: `../renewal2/editor-final-1440x900.png`（スタイル参照のみ）

## 最終プロンプト

```text
Use case: ui-mockup
Asset type: high-fidelity 16:9 desktop web app editing-screen mockup for a virtual Japanese fireworks design application
Primary request: create the Renewal3 editing screen described in Docs/RENEWAL_IMPLEMENTATION_PLAN3.md, focused on spatial slice awareness, geometric pattern authoring, and a launch-equivalent preview
Input images: Image 1 is a style and product-quality reference only, not an edit target. Preserve its practical dark wood workshop, crisp charcoal-navy utility panels, restrained warm-gold selection states, and dense but readable desktop product layout. Replace its cross-section controls and information architecture with the Renewal3 interface below.
Scene/backdrop: straight-on polished desktop product screenshot; the application fills the frame; practical Japanese craft workshop mood with dark wood and subtle paper texture
Style/medium: realistic shippable product UI mockup, not concept art; crisp typography; implementable panel proportions; restrained visual effects
Composition/framing: top editing header, three-column workspace, fixed bottom toolbar. Left column contains layers and a virtual-star parts tray. Center is the largest area and contains the pattern workbench. Right column contains pattern parameters above an always-visible launch-result preview.

Top header: show the editable work title "星巡り", size "大玉", back action "花火棚へ戻る", and save state "未保存". No shop name.

Left layer panel: heading "レイヤー". Show four practical rows named "外周", "芯", "星形型物", "手動配置" with small badges "既定", "既定", "型物", "手動". Select "星形型物" with a restrained gold outline. Keep add buttons "＋ 既定", "＋ 型物", "＋ 手動" and compact duplicate/delete actions inside this panel.

Left virtual-star tray: heading "仮想星の部品皿" and a compact grid of red, blue, gold, and silver paper-like virtual-star spheres. No floating balloon is required in this mockup.

Center workbench: heading "玉内配置ワークベンチ". Do not show any section-direction controls, section-position controls, XY/XZ buttons, percentages, or numeric section readout. Across the top of the workbench, show six compact pattern buttons labeled "円形", "ハート", "星形", "四角", "三角", "六角形" with "星形" selected. Show a large flat circular working slice on a dark cutting-board surface. Inside it, display an unmistakable upright five-point star outline made from evenly spaced red virtual-star dots, centered with safe margin and no point outside the circular slice. Do not show per-dot drag handles.

3D slice navigator: in the upper-right corner of the center workbench, overlay a compact 170-pixel three-dimensional shell navigator. It contains a translucent dark spherical shell, a clearly visible warm-gold internal slice disk at the currently selected location, and a small XYZ axis gizmo with red X, green Y, and blue Z arrows. The sphere should clearly communicate where the large flat working slice sits inside the shell. It is a practical navigation widget, not fantasy machinery. Do not add numeric plane or position controls around it.

Right panel: heading "型物パラメーター". Show controls "仮想星", "大きさ", "点の密度", and "回転" using compact selectors and sliders. Below it, always fully visible without scrolling, show a panel titled "打上結果プレビュー". The preview should depict a small star-shaped virtual firework bloom matching the selected five-point star pattern, with controls "再生" and "先頭へ". Do not label it abstract.

Bottom toolbar: show "Undo", "Redo", "保存", and a primary warm-gold button "湖面で確認".

Text (verbatim): "星巡り", "大玉", "花火棚へ戻る", "未保存", "レイヤー", "外周", "芯", "星形型物", "手動配置", "既定", "型物", "手動", "＋ 既定", "＋ 型物", "＋ 手動", "仮想星の部品皿", "玉内配置ワークベンチ", "円形", "ハート", "星形", "四角", "三角", "六角形", "型物パラメーター", "仮想星", "大きさ", "点の密度", "回転", "打上結果プレビュー", "再生", "先頭へ", "Undo", "Redo", "保存", "湖面で確認"
Constraints: practical implementable desktop layout; all major panels and preview fit within one 16:9 screen with no page scrollbar; the 3D shell navigator is visually clear but compact; the five-point star shape is unmistakable and entirely inside the slice; no shop name; no section direction label; no section position label; no XY or XZ; no percentages; no 10%, 30%, 50%, 70%, or 90%; no per-star editing handles; no manufacturing instructions; no real materials or measurements; no moon; no decorative floral patterns; no ornate gold borders; no excessive glow; no trademarks; no watermark
Avoid: concept-art perspective, fantasy machinery, large 3D globe replacing the main 2D workbench, latitude-longitude editing grid, dense tiny illegible text, oversized decoration, luxury display-case styling
```
