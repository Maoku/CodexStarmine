# Renewal2 編集画面イメージ生成プロンプト

## 実行方式

- スキル: `imagegen`
- モード: 組込みの `image_gen`（新規生成）
- 用途分類: `ui-mockup`
- 生成日: 2026-07-16

## 最終プロンプト

```text
Use case: ui-mockup
Asset type: high-fidelity desktop web app editing screen mockup for a virtual Japanese fireworks design application
Primary request: create the renewed editing screen described in Docs/RENEWAL_IMPLEMENTATION_PLAN2.md, focused on precise two-dimensional cross-section editing of virtual firework stars
Input images: Image 1 is a style and product-quality reference only, not an edit target; preserve its practical dark-wood workshop mood and restrained utility-panel finish, but replace its 3D globe editor and information architecture with the new 2D cross-section interface specified below
Scene/backdrop: a practical dark wood fireworks craft workshop, viewed straight-on as a polished 16:9 desktop product screenshot; the interface fills the frame
Style/medium: realistic shippable product UI mockup, not concept art; restrained Japanese craft atmosphere; crisp dark navy utility panels over a warm wooden workbench; subtle brass-gold only for selection and primary actions
Composition/framing: top editing header, three-column workspace, fixed bottom toolbar. Left column contains layers above a virtual-star parts tray. Center is the largest area and contains a circular cross-section workbench. Right column contains pattern parameters above an always-visible compact whole-design preview.

Top header: no shop or brand name. Show the editable work title "宵の心" prominently, the size selector "大玉", a back action "花火棚へ戻る", and a small save state "未保存".

Left layer panel: heading "レイヤー". Show four rows named "外周", "芯", "ハート型物", "手動配置", each with a small mode badge: "既定", "既定", "型物", "手動". Select "ハート型物" with a restrained gold outline. At the bottom show add buttons "＋ 既定", "＋ 型物", "＋ 手動", then actions "選択レイヤーを複製" and "削除" inside this same panel.

Left virtual-star tray: heading "仮想星の部品皿" and a compact grid of red, blue, gold, and silver paper-like star spheres. Show a floating star-preview balloon opened from a blue star; the entire balloon extends beyond the tray boundary into the workspace without any clipping. Balloon label: "青変化星". Keep the balloon readable and unobstructed.

Center workbench: heading "玉内配置ワークベンチ". At the top show plane buttons "XY面" and "XZ面" with "XY面" selected. Show five section buttons "10%", "30%", "50%", "70%", "90%" with "50%" selected. Below, show a large flat circular 50-percent cross-section on a dark cutting-board surface, with subtle X and Y axes and a thin shell boundary. Inside it, display a clearly recognizable upright heart outline made from evenly spaced red virtual-star dots, centered with generous margin. The heart must have a clear top notch, rounded lobes, symmetric sides, and one pointed bottom. Do not show per-dot drag handles, selection rings, or 3D latitude/longitude grid lines. Above or beside the circle, show convenience shape buttons "円形", "ハート", with "ハート" selected, plus a compact size slider labeled "大きさ".

Right panel: heading "型物パラメーター". Show controls "仮想星", "大きさ", "点の密度", "回転" with practical sliders or selectors. Do not show speed, ignition order, gravity, drag, or explanatory physics copy. Below it, always fully visible without scrolling, show a compact panel titled "配置全体の簡易確認" with a small abstract multicolor burst preview and controls "再生" and "先頭へ".

Bottom toolbar: show "Undo", "Redo", a save button "保存", and a primary gold button "湖面で確認".

Text (verbatim): "宵の心", "大玉", "花火棚へ戻る", "未保存", "レイヤー", "外周", "芯", "ハート型物", "手動配置", "既定", "型物", "手動", "＋ 既定", "＋ 型物", "＋ 手動", "選択レイヤーを複製", "削除", "仮想星の部品皿", "青変化星", "玉内配置ワークベンチ", "XY面", "XZ面", "10%", "30%", "50%", "70%", "90%", "円形", "ハート", "大きさ", "型物パラメーター", "仮想星", "点の密度", "回転", "配置全体の簡易確認", "再生", "先頭へ", "Undo", "Redo", "保存", "湖面で確認"
Constraints: practical implementable desktop layout; all major panels and the whole-design preview fit within one 16:9 screen with no page scrollbar; hierarchy must be obvious; the floating blue-star balloon must not be clipped; heart shape must be unmistakable; no shop name; no "星見煙火店"; no "今夜は、何をしますか"; no per-star editing handles on the pattern; no speed or ignition text; no manufacturing instructions; no decorative floral patterns; no ornate gold borders; no excessive glow; no trademarks; no watermark
Avoid: concept-art perspective, fantasy machinery, 3D globe editor, latitude-longitude grid, dense tiny illegible text, oversized decoration, luxury display-case styling
```
