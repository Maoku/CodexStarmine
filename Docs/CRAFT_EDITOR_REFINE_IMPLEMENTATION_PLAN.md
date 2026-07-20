# 花火エディタ改良 実装計画書

- 作成日: 2026-07-20
- ステータス: 実装中（Refine Phase 0 完了）
- 基準資料: [CRAFT_EDITOR_REFINE_PLAN.md](CRAFT_EDITOR_REFINE_PLAN.md)
- 関連計画: [CRAFT_EDITOR_IMPLEMENTATION_PLAN.md](CRAFT_EDITOR_IMPLEMENTATION_PLAN.md)、[RENEWAL_IMPLEMENTATION_PLAN3.md](RENEWAL_IMPLEMENTATION_PLAN3.md)
- 対象: アプリ全体の文字可読性、製作エディタのヘッダー／フッター、玉内配置ワークベンチ、選択レイヤー、打上結果プレビュー

## 1. 目的と完了像

本改修では、現行の製作エディタが持つ編集機能と保存形式を維持したまま、画面の可読性、作業領域の広さ、視点操作、主要操作の見つけやすさを改善する。

完了時には次の状態を満たす。

1. アプリ全体で細すぎる文字を解消し、小さいラベル、補助文、ボタンも読みやすい。
2. エディタのヘッダーは作品名、大きさ、棚へ戻る操作だけに絞られ、編集領域を圧迫しない。
3. 仮想花火の注意文はタイトル画面にだけ表示され、エディタには重複表示されない。
4. フッターに一時ステータス／TIPS、負荷予測、保存、湖面確認が常時見える。
5. `保存して棚へ` は `湖面で確認` と同じ主要操作グループに置かれ、未保存時は青色で状態が分かる。
6. `湖面で確認` はフッター右端、すなわち画面右下にある。
7. 玉内配置ワークベンチはズーム、X/Y/Z面選択、左右／上下回転、5段階の操作面位置を扱える。
8. 回転中は仮想星の前後関係と操作面の傾きが変わり、玉が3次元的に見える。
9. 選択レイヤーの名前をペイン見出しで直接編集でき、設定表示域が現在より広い。
10. 打上結果プレビューは小型化され、中央ワークベンチ領域の右下へ移る。
11. 1440 × 900、1280 × 720、390 × 844で主要操作が重ならず、保存と湖面確認まで横スクロールなしで完了できる。

花火のコンパイル、固定seedプレビュー、保存済み作品、Undo/Redoの意味は変更しない。

## 2. 今回の解釈と既存計画からの更新点

### 2.1 用語の解釈

- `タイトル画面`: `ModeSelectionScreen` の制作／鑑賞モード選択画面を指す。注意文は既にこの画面にあるため、これを正本として残す。
- `操作面`: `SectionRef` が表す切断面を指す。
- `段階スライダー`: 現行の `10 / 30 / 50 / 70 / 90%` の5位置を連続値にせず選ぶレンジ入力を指す。
- `玉の回転`: 作品データを変える操作ではなく、編集時のカメラ／表示姿勢を変える操作を指す。
- `負荷予測`: 新しい見積り方式ではなく、現行の `diagnostic.estimatedCost.maximumParticles` と6,000粒子の実行上限を再利用する。

### 2.2 Renewal3計画の部分更新

`RENEWAL_IMPLEMENTATION_PLAN3.md` では、面の向きと位置を数値式UIから隠し、3D玉ナビゲーターのドラッグだけで操作する方針だった。今回の基準資料は、面ボタンと段階スライダーを明示的に求めている。

そのため本計画は、Renewal3の次の部分だけを更新する。

- X/Y/Zボタンを表示し、押した軸に直交する操作面を選べるようにする。
- 操作面の位置を5段階スライダーで表示する。
- 玉の回転と操作面の選択を別の状態として扱う。

型物、手動配置、固定seedプレビュー、湖面確認との一致など、Renewal3のその他の契約は維持する。

### 2.3 対象外

- 新しい花火種類、仮想星効果、物理挙動の追加
- 打上結果プレビューの内容やseedの変更
- 保存ライブラリの新バージョン化
- 画像から仮想星を生成するダイアログの再設計
- Three.jsへの全面置換
- フリー鑑賞／湖面確認画面のレイアウト変更

## 3. 現状調査と差分

| 要求領域 | 現在の実装 | 解消する差分 |
| --- | --- | --- |
| 文字 | `src/style.css` に0.42〜0.58remの文字とweight 500以下が多い | 文字トークンと用途別weightを定義し、極小文字を引き上げる |
| ヘッダー | `AppShell` が作品名、大きさ、保存状態、注意文を表示。ワークスペース上端は6.25rem | 注意文と保存状態を外し、ヘッダー高とワークスペースinsetを縮める |
| 注意文 | `ModeSelectionScreen` とエディタの両方に表示 | タイトル画面だけに残す |
| フッター | Undo/Redo、保存状態、保存、湖面確認を表示 | 保存状態位置をメッセージ領域へ統合し、負荷予測を追加する |
| メッセージ | エディタ操作も `AppShell.showToast()` の画面トーストを使用 | エディタ内の操作結果とTIPSをフッターで通知する |
| 保存 | `secondary-save` の見た目はdirty状態と無関係 | clean時は抑制色、dirty時は青色の主要ボタンにする |
| 湖面確認 | 右端にあるが、広い1fr領域の影響で保存との階層差が大きい | 右端を維持し、保存と同じ操作グループに整理する |
| 負荷予測 | 右ペイン上部にカード表示。1280 × 720では表示域から押し出されやすい | フッターへ常時表示し、警告時だけ簡略化導線を出す |
| ワークベンチ | 2D正面断面、XY/XZの2面、5断面。ズームと独立した回転状態はない | ズーム、XYZ面、左右／上下回転、段階スライダーを追加する |
| XYZギズモ | X/Y/ZはSVGの装飾テキスト | キーボード操作可能な面選択ボタンにする |
| 選択レイヤー | レイヤー名入力はペイン本体の先頭。負荷カードとプレビューが右ペインを占有 | 名前入力を見出しへ移し、右ペインを設定中心に広げる |
| 打上結果プレビュー | 右ペイン下部で高さ9.5〜13.5rem | 中央ペイン右下へ移し、高さ8〜10rem程度へ縮める |

計画作成時点の品質基準は次のとおり。

- `rtk npm run lint`: 成功。
- `rtk npm run test:run`: 53ファイル、226テストすべて成功。
- 現行の目視基準: `Docs/images/renewal3/final-editor-1440x900.png`、`final-editor-1280x720.png`、`final-editor-390x844.png`。

## 4. 目標レイアウト

### 4.1 デスクトップ

```text
┌──────────────────────────────────────────────────────────────┐
│ 棚へ戻る       作品名                         玉の大きさ      │ compact header
├──────────┬───────────────────────────────┬───────────────────┤
│ レイヤー │ 玉内配置ワークベンチ            │ 選択レイヤー名    │
│ 仮想星   │  [zoom]                [XYZ]   │ ───────────────  │
│          │ [縦回転]   玉・操作面            │ レイヤー設定      │
│          │            [横回転] [小型preview]│                   │
├──────────┴───────────────────────────────┴───────────────────┤
│ Undo Redo │ STATUS / TIPS │ 負荷 │ 保存して棚へ │ 湖面で確認 │
└──────────────────────────────────────────────────────────────┘
```

- `湖面で確認` を右端に固定する。
- `保存して棚へ` はその左隣に置き、両方を同等の高さにする。
- ステータス／TIPSはRedoと保存操作グループの間で伸縮する。
- 負荷予測は主要操作を押し出さない固定幅の要約表示にする。
- 右ペインから負荷カードとプレビューを除き、選択レイヤー設定に使える高さを増やす。

### 4.2 モバイル

- ヘッダーは戻る、作品名、大きさを2行以内に収める。注意文と保存状態は表示しない。
- 左右ペインは現行どおりドロワーを使用する。
- ワークベンチの回転スライダー、面スライダー、ズームは44px以上の操作間隔を保つ。
- フッターは2段まで許容し、上段に短いメッセージと負荷、下段にUndo/Redo、保存、湖面確認を置く。
- TIPSは1行省略可能だが、warningと保存失敗は省略せず `aria-live` でも通知する。
- 小型プレビューは折りたたみ可能なサムネイルとし、ワークベンチの最小編集高17remを奪わない。

## 5. 文字とヘッダーの設計

### 5.1 文字の可読性

`src/style.css` の `:root` に用途別トークンを追加し、個々のセレクターへばらばらに数値を足さない。

```css
--font-ui-weight: 500;
--font-control-weight: 600;
--font-heading-weight: 600;
--font-ui-xs: 0.6875rem;
--font-ui-sm: 0.75rem;
--font-ui-md: 0.875rem;
```

適用方針:

- bodyと通常本文はweight 500を基準にする。
- ボタン、入力ラベル、ペイン見出し、重要な数値は600以上にする。
- 明朝体の見出しは細い500から600へ上げる。
- 0.5rem未満の文字は、装飾用英字を除いて原則 `--font-ui-xs` 以上へ上げる。
- 補助文は文字を細くせず、色の明度差で優先度を下げる。
- 通常文字のコントラスト4.5:1、主要ボタンと大きな文字3:1以上を目標にする。
- 文字拡大200%でも保存、湖面確認、ドロワー操作が隠れないことを確認する。

最初にエディタへ適用し、タイトル、棚、初期設定、湖面画面へ同じトークンを展開する。配置崩れが起きた箇所は文字を再び小さくせず、余白、折返し、ペイン幅を調整する。

### 5.2 コンパクトヘッダー

`AppShell.#createEditorScreen()` のヘッダーから次を削除する。

- `data-editor-header-save-state`
- 仮想花火の注意文を持つ `.header-status > p`
- `.header-status` のためだけの右カラム

保存状態はフッターのメッセージ／保存ボタンへ移す。タイトル画面の `.mode-safety-note` は残す。

レイアウト方針:

- デスクトップのヘッダー高をおおむね4.0〜4.25remへ縮める。
- `craft-workspace` の上端insetを同じCSS変数から計算し、ヘッダーとの隙間を二重管理しない。
- 作品名と玉サイズは現在の編集機能を維持する。
- 戻るボタンとフォーム部品は最低44pxのクリック領域を維持する。
- 390px幅ではラベルを視覚的に簡略化してよいが、accessible nameは残す。

## 6. フッターの設計

### 6.1 DOM順序と責務

フッターは次のDOM順序にする。

1. Undo
2. Redo
3. ステータス／TIPS領域
4. 負荷予測
5. 保存して棚へ
6. 湖面で確認

視覚順とTab順を一致させる。`湖面で確認` は常に最後に置く。

複雑化する文字列と状態分岐を `IntegratedCraftEditor.#render()` へ増やし続けないため、純粋レンダー関数 `EditorTransport.ts` を追加する。

```ts
interface EditorTransportModel {
  canRedo: boolean;
  canUndo: boolean;
  dirty: boolean;
  load: {
    maximumParticles: number;
    limit: number;
    level: "good" | "warning" | "overload";
  };
  message: {
    kind: "status" | "tip" | "warning";
    text: string;
  };
}
```

### 6.2 ステータス／TIPS

エディタ内で発生した短い通知は、原則としてフッターへ表示する。

- 操作成功: 3〜4秒表示した後、現在のTIPSへ戻す。
- warning／保存失敗: 次の操作または明示的な解消まで残す。
- TIPS: 選択レイヤーと編集方式に応じた固定文を表示する。
- dirty状態: 操作メッセージがないとき `未保存の変更があります` をstatusとして表示する。
- clean状態: `保存済みです` を短く表示した後、TIPSへ戻す。

優先順位は `warning > status > dirty/clean > tip` とする。領域には `role="status" aria-live="polite" aria-atomic="true"` を付ける。色だけで種別を示さず、`TIPS`、`注意` などの短いラベルを併記する。

`IntegratedCraftEditor` にタイマーを持たせる場合は `destroy()` で必ず解除する。画面をまたぐ移行警告や棚操作の通知は引き続き `AppShell.showToast()` を使用し、同じ文をフッターとトーストへ二重表示しない。

### 6.3 保存ボタン

- clean: 抑制した灰色／紺色。押せば現在どおり保存処理を経て棚へ移動できる。
- dirty: 青色の背景、輪郭、または発光を付け、`未保存` の短い補助を表示する。
- overload: 無効化はせず、押したときフッターwarningへ理由と簡略化導線を表示する。
- `aria-label` に保存状態を含める。
- 状態は `.is-dirty` と `data-save-state="dirty|saved"` で表し、文言や色だけにテストを依存させない。

### 6.4 負荷予測

現行の `diagnostic.estimatedCost.maximumParticles`、2,000の注意閾値、6,000の上限を再利用する。

- 通常: `負荷 良好 · 1,240 / 6,000`
- 注意: `負荷 注意 · 3,800 / 6,000`
- 超過: `負荷 超過 · 6,420 / 6,000`

フッターではmeterを小型化し、数値と状態文を必ず残す。`自動簡略化` はwarning／overload時だけ展開する。右ペインの既存performance cardは削除し、同じ情報を二重表示しない。

## 7. 玉内配置ワークベンチの設計

### 7.1 表示状態と作品状態の分離

次の表示状態を `IntegratedCraftEditor` の一時状態として持つ。

```ts
interface WorkbenchViewState {
  pitchDegrees: number; // 上下回転
  yawDegrees: number;   // 左右回転
  zoom: number;         // 0.5...2.0
}
```

- 既定値はpitch 0°、yaw 0°、zoom 1.0。
- 回転とズームは保存、dirty判定、Undo/Redo、プレビュー再コンパイルへ影響させない。
- 操作面 `SectionRef` は型物／手動配置の編集契約として従来どおり扱う。
- 面選択時だけ、必要に応じて型物レイヤーの `pattern.section` を1履歴として更新する。

### 7.2 X/Y/Z面ボタン

軸と操作面の対応を固定する。

| ボタン | 選択する操作面 | 固定座標 |
| --- | --- | --- |
| X | YZ平面 | x |
| Y | XZ平面 | y |
| Z | XY平面 | z |

現行の `SectionPlane = "xy" | "xz"` に `"yz"` を追加する。オブジェクト形状は変えず、既存のXY/XZデータをそのまま読めるためschemaVersionはv4を維持する。

変更対象:

- `src/data/firework.ts`: `SectionPlane` とvalidatorへ`yz`を追加。
- `src/ui/craft/SliceGeometry.ts`: YZのframe、投影、逆変換、stepを追加。
- `src/ui/craft/ShellSliceNavigator.ts`: X/Y/Zを実ボタンとして描画。
- 保存／読込テスト: YZの型物と手動点がround-tripすることを追加。

軸ボタンを押すと、操作面を切り替え、玉の表示姿勢をその面が見やすい正面寄りへスナップする。選択状態は `aria-pressed` で表す。装飾SVGの文字だけにクリックを持たせず、44px相当のHTML button hit areaを軸端へ重ねる。

### 7.3 操作面の段階スライダー

既存の `SECTION_RATIOS = [0.1, 0.3, 0.5, 0.7, 0.9]` を唯一の値集合として再利用する。

- `input type="range" min="0" max="4" step="1"`
- 表示は `手前 1 / 5`、`中央 3 / 5`、`奥 5 / 5` のようにし、割合だけに意味を依存させない。
- `aria-valuetext` に面名と段階を含める。
- ドラッグ中は表示を更新し、pointer/key操作の完了時に1履歴へまとめる。
- 手動レイヤーでは選択面だけを変え、既存点の保存座標は移動しない。
- 型物レイヤーでは現在の仕様どおりpattern.sectionを更新し、点群を決定的に再生成する。

### 7.4 ズーム

- 範囲50〜200%、10%刻み、既定100%。
- ワークベンチ見出し付近に `縮小 / 拡大` のラベル付きスライダーを置く。
- ズーム後も点追加、点選択、ドラッグ位置が表示点と一致する。
- 拡大時に玉の外へはみ出した領域はワークベンチ内でclipし、ページ全体をスクロールさせない。
- ズーム変更はプレビュー再計算やdocument historyを発生させない。

### 7.5 左右／上下回転

- 玉の左側に縦rangeを置き、pitchを操作する。
- 玉の下側に横rangeを置き、yawを操作する。
- 既定範囲はpitch -60〜60°、yaw -180〜180°、5°刻みとする。
- キーボードの矢印キーでも操作でき、現在角度を `aria-valuetext` で読める。
- 軸ボタンによる面スナップ後も、スライダーで自由に見回せる。
- スライダー操作は `requestAnimationFrame` 単位で表示だけを更新し、固定seedプレビューを再コンパイルしない。

### 7.6 3Dらしい投影

WebGLを追加せず、既存SVGの編集性とテスト容易性を維持する。`WorkbenchViewGeometry.ts` を新設し、次を純粋関数としてまとめる。

- yaw/pitch回転行列
- 3D点からSVG座標とdepthへの投影
- 画面座標から選択操作面への逆投影
- zoomとviewBox中心の変換
- 操作面円の楕円投影
- 前後順の安定したdepth sort

見た目の契約:

- 手前の星を大きく明るく、奥の星を小さく暗くする。
- 玉皮にハイライト、奥側の破線、薄い陰影を付ける。
- 操作面は回転に応じて円から楕円へ変形する。
- 選択中レイヤーと編集可能点の輪郭は回転後も失わない。
- 視点を変えても星の作品座標自体は変えない。

ポインター編集は、回転・ズーム後の画面点から選択面へray-plane逆投影して求める。見た目だけをCSS transformで回し、入力座標を旧い正面投影のままにする実装は禁止する。

## 8. 選択レイヤーとプレビューの設計

### 8.1 選択レイヤー

右ペインの見出しを次の構成へ変える。

```text
選択レイヤー  [ レイヤー名入力                         ]  [型物]
```

- レイヤー名inputを`.inspector-fields`本体からペインheaderへ移す。
- inputには現在と同じmaxlength 24と更新処理を使う。
- レイヤー未選択時は入力をdisabledにし、`レイヤーを選択` と表示する。
- 名前編集中のdocument更新で全DOMを置換してフォーカスやカーソル位置を失わないよう、既存の値同期方式を使うか、change時だけcommitする。
- 右ペインからperformance cardとpreviewを除く。
- inspector cardを残り高さいっぱいに広げ、内部フィールドだけをスクロールさせる。
- preset、pattern、manualの既存設定とロック時の制限は維持する。

見出しの責務が増えるため、選択レイヤー表示を `SelectedLayerInspector.ts` の純粋レンダー関数へ分離する。

### 8.2 打上結果プレビュー

`InlineDiagnosticPreview` のモデルとfixed seedは変更せず、配置と大きさだけを変更する。

- DOMを右ペインから`integrated-craft-bench`内のpreview dockへ移す。
- desktopでは中央ペインの下段右端に置く。
- 高さを8〜10rem、幅を11〜15rem程度に抑える。
- 左側の下段を横回転スライダーへ使い、previewと重ねない。
- 再生／一時停止、先頭へ、星数表示は残す。
- 1280 × 720でもプレビューfooterが切れない。
- 390 × 844ではサムネイル表示を既定とし、必要時に展開できる。展開時もフッター主要操作を覆わない。
- `buildCompiledBurstPreviewModel()` の150ms更新抑制と決定的間引きは維持する。

## 9. 主なファイル変更

### 9.1 変更

| ファイル | 内容 |
| --- | --- |
| `src/style.css` | 文字トークン、compact header、新footer、右ペイン拡張、workbench controls、preview dock、responsive |
| `src/ui/AppShell.ts` | エディタ注意文とheader保存状態の削除、footer通知との責務整理 |
| `src/ui/screens/ModeSelectionScreen.ts` | 注意文をタイトル正本として維持。必要なら文言／テスト属性だけ調整 |
| `src/ui/craft/IntegratedCraftEditor.ts` | view state、メッセージ状態、controls event、footer／preview／inspector組立変更 |
| `src/ui/craft/IntegratedPlacementWorkbench.ts` | zoom・回転・面controlsを受け取り、回転投影で描画 |
| `src/ui/craft/ShellSliceNavigator.ts` | XYZ面ボタンと選択面表示 |
| `src/ui/craft/SliceGeometry.ts` | YZ面とview transform連携 |
| `src/ui/craft/InlineDiagnosticPreview.ts` | 小型dock／mobile展開用markup |
| `src/data/firework.ts` | `SectionPlane`への`yz`追加とvalidation |

`src/style.css` にはPhase 4レイアウト規則が前半と末尾に重複している。改修時は、後勝ちの規則を確認せず前半だけ変更しない。新しいrefineブロックを最終のauthoritative layerとしてまとめるか、重複規則を同時に整理し、同一selectorの値を二重管理しない。

### 9.2 新規

| ファイル | 内容 |
| --- | --- |
| `src/ui/craft/WorkbenchViewGeometry.ts` | 回転、投影、逆投影、zoom、depth sort |
| `src/ui/craft/WorkbenchViewGeometry.test.ts` | 幾何とround-tripの単体テスト |
| `src/ui/craft/EditorTransport.ts` | footerの純粋レンダー |
| `src/ui/craft/EditorTransport.test.ts` | DOM順、dirty、load、messageのmarkupテスト |
| `src/ui/craft/SelectedLayerInspector.ts` | 選択レイヤー見出しと設定表示 |
| `src/ui/craft/SelectedLayerInspector.test.ts` | 名前入力、未選択、locked表示のテスト |

## 10. 実装フェーズ

### Refine Phase 0: 契約固定と基準画像

目的: 変更前の挙動と今回変更する部分を明確にする。

- 現行lint/test/buildを実行し結果を記録する。
- 1440 × 900、1280 × 720、390 × 844のeditor画像を撮る。
- header高、右ペイン表示域、preview寸法、footer高を記録する。
- 最新要望がRenewal3の面選択方針を上書きすることをテスト名と文書へ反映する。

完了条件:

- 既存失敗と本改修による失敗を区別できる。
- 変更対象の各UIにテスト可能な`data-*`契約が決まっている。

### Refine Phase 1: 文字とcompact header

目的: 全画面の可読性基準を作り、エディタ上部を先に広げる。

- 文字トークンとweightを追加する。
- エディタheaderから注意文と保存状態を削除する。
- mode selectionの注意文を回帰テストで固定する。
- headerとworkspace insetを共通変数へ寄せる。
- desktop/mobileでフォームが欠けないことを確認する。

完了条件:

- エディタに仮想花火注意文がなく、タイトルにはある。
- headerが縮まり、その分だけworkbenchの縦表示域が増える。
- 主要ラベルとボタンのcomputed font weightが500以上である。

### Refine Phase 2: footer、選択レイヤー、preview再配置

目的: 既存データを使い、画面構造と主要操作の優先度を先に整える。

- `EditorTransport` とメッセージ状態を追加する。
- 負荷予測を右ペインからfooterへ移す。
- 保存dirty装飾と右端の湖面確認を実装する。
- レイヤー名を右ペインheaderへ移す。
- previewを中央ペイン右下へ移して小型化する。
- mobileのfooter 2段とpreview縮退を実装する。

完了条件:

- footerのDOM順、dirty状態、負荷状態がunit testで固定される。
- 右ペインにperformance cardとpreviewがなく、設定表示域が増える。
- 3基準viewportで主要操作が切れない。

### Refine Phase 3: YZ面と幾何基盤

目的: 見た目の操作追加前に、3面を正しく扱う純粋幾何を完成させる。

- `SectionPlane`へYZを追加する。
- XY/XZ/YZのframe、投影、逆変換を実装する。
- view rotation、zoom、depthの純粋関数を追加する。
- YZを含む保存round-tripとcompile回帰テストを追加する。

完了条件:

- 各面の中心と端点が投影→逆投影で許容誤差内に戻る。
- 既存XY/XZ作品の保存JSONと打上planが意図せず変わらない。
- YZの型物／手動点が保存後も同じ位置へ戻る。

### Refine Phase 4: workbench controlsと3D表示

目的: ズーム、面、回転をワークベンチへ接続する。

- XYZボタン、操作面range、zoom range、pitch/yaw rangeを追加する。
- 選択面とview stateを分離してevent処理する。
- SVG点、玉皮、操作面を回転投影する。
- 回転・ズーム込みのpointer追加／移動を逆投影へ切り替える。
- view-only操作がdirty、history、preview compileを変えないことをテストする。

完了条件:

- X→YZ、Y→XZ、Z→XYへ切り替わる。
- 操作面rangeは5段階以外の値を作らない。
- 上下／左右回転で前後表現と面の楕円が変化する。
- 50〜200%の全zoomでポインターと星の位置が一致する。

### Refine Phase 5: responsive、アクセシビリティ、統合検証

目的: desktopだけの完成にせず、既存フロー全体を回帰確認する。

- 文字拡大、キーボード、reduced motion、aria-liveを確認する。
- mobile drawer表示中のfocusとinertを確認する。
- 新規作品、保存作品、型物、手動、画像配置、Undo/Redo、保存、湖面確認を通しで確認する。
- 最終画像を基準viewportで更新する。
- lint/test/buildをすべて通す。

完了条件:

- 第12章の受け入れ条件をすべて満たす。
- 意図したUI差分以外の保存データ／打上結果差分がない。

## 11. テスト計画

### 11.1 単体テスト

`SliceGeometry.test.ts` / `WorkbenchViewGeometry.test.ts`:

- XY/XZ/YZの`sliceFrame()`が正しいnormalとtangentを返す。
- X/Y/ZとYZ/XZ/XYの対応が固定されている。
- 5段階range indexとSectionRatioが双方向に一致する。
- yaw/pitch 0°・zoom 100%が現行正面投影と一致する。
- 代表角度とzoomでproject/unprojectが許容誤差内に戻る。
- pitch/yaw/zoomがclampされ、NaNを作らない。
- depth sortが同値時にも決定的である。

`EditorTransport.test.ts`:

- DOM順がUndo、Redo、message、load、save、checkである。
- clean／dirtyでsave classとaccessible nameが変わる。
- good／warning／overloadで数値、状態文、簡略化導線が正しい。
- status／tip／warningが文言だけでなくkind属性を持つ。

`SelectedLayerInspector.test.ts`:

- レイヤー名入力がheader内にある。
- preset／pattern／manualの設定が失われない。
- 未選択とlockedの操作制限が正しい。

### 11.2 結合・保存テスト

- XYZ面変更後の型物が保存／再読込され、compile後も同じ層と星数を持つ。
- 手動レイヤーで面を変えても既存点座標が変わらない。
- zoomと回転だけでは`dirty`、`canUndo`、保存JSONが変わらない。
- 段階スライダー1操作をUndo 1回で戻せる。
- 保存成功後にdirty装飾がcleanへ戻る。
- 6,000超過時に保存が実行されず、footer warningが表示される。
- preview modelのfixed seed、total star count、更新抑制が維持される。
- headerから注意文を除いてもmode selectionの注意文が残る。

### 11.3 実ブラウザ確認

viewport:

- 1440 × 900
- 1280 × 720
- 390 × 844

シナリオ:

1. 新規作品を開き、headerの高さと文字を確認する。
2. preset、pattern、manualを順に選び、右ペインの表示域を確認する。
3. X/Y/Z、5段階面、zoom最小／最大、pitch/yaw端まで操作する。
4. 回転・zoom後に手動点を追加、移動、削除する。
5. Undo/Redoし、footer statusが更新されることを確認する。
6. 粒子数を注意／超過へ上げ、負荷表示と保存拒否を確認する。
7. dirty保存ボタンの青色、保存後のclean色、棚遷移を確認する。
8. 湖面確認が右下から実行でき、固定seedの完成形が従来どおり再生されることを確認する。
9. mobile drawerとpreview展開を操作し、footerを覆わないことを確認する。

### 11.4 品質ゲート

- `rtk npm run lint`
- `rtk npm run test:run`
- `rtk npm run build`
- 通常文字4.5:1、主要UI境界3:1以上のコントラスト
- 主要ボタン、軸ボタン、range thumbの操作領域44px以上
- キーボードだけでXYZ、各range、保存、湖面確認を操作可能
- view-only操作でcompiler／preview modelを再生成しない
- 2,048点の手動レイヤーでも回転rangeが入力を取りこぼさず、DOM更新は1 animation frameに1回以下
- 3基準viewportで意図しない横スクロールなし

## 12. 受け入れ条件

- [ ] アプリ全体の通常文字が細すぎず、エディタの主要本文／操作文字はweight 500以上である。
- [ ] エディタheaderが現在より低く、作品名、大きさ、戻る操作だけを表示する。
- [ ] 仮想花火の注意文はタイトルにあり、エディタにない。
- [ ] footerのRedoと保存の間にstatus／TIPS領域がある。
- [ ] status／TIPSは`aria-live`で通知され、warningは自動で消えない。
- [ ] 湖面確認がfooter右端、画面右下にある。
- [ ] 保存して棚へが湖面確認と同じ主要操作グループにある。
- [ ] 保存ボタンはclean時に抑制色、dirty時に青色となり、文字でも状態が分かる。
- [ ] footerに仮想星ベースの負荷予測値、状態、上限が表示される。
- [ ] 右ペインの負荷カードは重複表示されない。
- [ ] workbenchに50〜200%のzoom sliderがある。
- [ ] XボタンでYZ、YボタンでXZ、ZボタンでXYが映る。
- [ ] 玉の左に上下回転、下に左右回転のsliderがある。
- [ ] 回転により玉皮、操作面、星の前後表現が変わる。
- [ ] 操作面を5段階sliderで選べる。
- [ ] 回転とzoomはdirty、Undo/Redo、保存内容へ影響しない。
- [ ] 回転・zoom後も点の追加／移動位置がポインターと一致する。
- [ ] 選択レイヤー名inputがペインtitle位置にある。
- [ ] 選択レイヤーの設定表示域が現行より広い。
- [ ] 打上結果previewが小型化され、workbench右下にある。
- [ ] previewのfixed seedと再生操作が維持される。
- [ ] 1440 × 900、1280 × 720、390 × 844で主要UIが重ならない。
- [ ] lint、test、buildがすべて成功する。

## 13. リスクと対策

| リスク | 対策 |
| --- | --- |
| 玉の回転と操作面変更が混同され、意図せず作品がdirtyになる | `WorkbenchViewState`と`SectionRef`を別型・別更新経路にする |
| CSSだけ回転し、手動点の入力位置がずれる | 投影と逆投影を同じ純粋幾何へ集約し、round-trip testを必須にする |
| YZ追加で古い作品が読めなくなる | enumの加算だけに留め、既存XY/XZ fixtureとstorage testを維持する |
| range入力ごとにUndo履歴が増える | inputは一時表示、change／pointer endで1回だけcommitする |
| 全DOM再描画でrangeや名前入力のfocusが飛ぶ | view-only更新は対象SVG属性だけ更新し、document更新時もfocus復元をテストする |
| footerがmobileで過密になる | 2段layout、短縮ラベル、TIPS省略を使い、主要2ボタンの幅を優先する |
| previewが編集点や回転sliderを覆う | overlayにせず中央ペインの専用bottom dockへ置く |
| 文字を太く／大きくして既存ペインがあふれる | fontを戻さず、wrap、gap、minmax、scroll領域を調整する |
| トーストとfooterへ同じ通知が二重表示される | editor内通知とscreen共通通知の所有範囲を分ける |
| `style.css`の重複規則で変更が無効になる | 最終authoritative blockへ集約し、computed styleを3viewportで確認する |

## 14. 実装着手順

1. Phase 0で現行画像と品質基準を固定する。
2. 文字／headerを先に改修して利用可能な縦領域を確定する。
3. footer、右ペイン、previewを再配置して中央／右の最終グリッドを確定する。
4. YZとview geometryをUI非依存で実装し、単体テストを通す。
5. workbench controlsを1つずつ接続し、各段階でpointer一致を確認する。
6. mobile、アクセシビリティ、保存／湖面確認の通し検証を行う。
7. 最終スクリーンショットと実装記録を本書へ追記する。

この順序により、画面骨格と純粋幾何を先に固定し、入力処理、見た目、responsiveを同時に変更して原因追跡が難しくなることを避ける。

## 15. 実装記録

### Refine Phase 0: 契約固定と基準画像

- 実施日: 2026-07-20
- 品質基準: `lint`、53ファイル／226テスト、`build`がすべて成功。
- Renewal3更新契約: `R3-02`はX/Y/Z実ボタン、`R3-03`は5段階の操作面位置スライダーで上書きする。
- 安定した検証属性: `data-editor-header`、`data-editor-transport`、`data-editor-message`、`data-editor-load`、`data-save-state`、`data-selected-layer-inspector`、`data-preview-dock`、`data-workbench-zoom`、`data-workbench-pitch`、`data-workbench-yaw`、`data-section-plane`、`data-section-step`。

変更前の実測値:

| viewport | header | workspace | 右ペイン | preview | footer | 横overflow |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1440 × 900 | 92px | 790px | 709px | 297px | 72px | なし |
| 1280 × 720 | 92px | 610px | 529px | 283px | 72px | なし |
| 390 × 844 | 78px | 745px | 745px | 297px | 67px | なし |

変更前画像:

- `Docs/images/craft-editor-refine/baseline-editor-1440x900.png`
- `Docs/images/craft-editor-refine/baseline-editor-1280x720.png`
- `Docs/images/craft-editor-refine/baseline-editor-390x844.png`
