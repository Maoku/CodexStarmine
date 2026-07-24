# Codex Starmine 英語・多言語対応計画書

- 作成日: 2026-07-24
- ステータス: 計画
- 対象言語: 日本語 `ja`、英語 `en`
- 対象: ブラウザアプリ、アクセシビリティ文言、保存作品の表示、公開README、操作ガイド、現行仕様書
- 非対象: 花火の物理・描画・音響、保存schemaの更新、過去の全計画資料の一括翻訳

## 1. 目的と完了像

Codex Starmineを、日本語版の機能と保存互換性を維持したまま、英語のブラウザ環境でも最初から最後まで利用できる状態にする。

完了時には次を満たす。

1. 初回アクセス時はブラウザ言語から日本語または英語を選び、利用者が画面上でいつでも切り替えられる。
2. モード選択、花火棚、新規作成、統合編集、画像から生成、湖面確認、フリー鑑賞、確認ダイアログ、エラー通知を英語だけで操作できる。
3. `aria-label`、`aria-valuetext`、ライブリージョン、Canvasの説明、WebGLエラーも選択言語になる。
4. 日時、件数、粒子数、点数、秒、発数、パーセント、並び順をロケールに合わせて表示する。
5. v1〜v4の保存作品とJSON入出力は変更せず、既存の日本語作品名やユーザー入力を自動翻訳・上書きしない。
6. 日本語版の挙動と文言を回帰させず、英語の長い文言でもデスクトップとモバイルの主要操作が欠けない。
7. 英語のREADME、操作ガイド、現行仕様への導線があり、英語UIのスクリーンショットで操作を確認できる。
8. 翻訳キー不足と新しい日本語ハードコードをCIで検出できる。

## 2. 現状調査

### 2.1 アプリ

現行アプリはTypeScriptのDOM APIで画面を組み立てており、UIフレームワークやi18n基盤は使っていない。日本語文字列は40以上のproduction `.ts` ファイルにあり、特に次へ集中している。

| 領域 | 主なファイル | 現状 |
| --- | --- | --- |
| アプリ起動 | `index.html`、`src/main.ts` | `lang="ja"`、説明、ロード表示、WebGLエラーが日本語固定 |
| 画面遷移と通知 | `src/ui/AppShell.ts` | ヘッダー、確認、toast、保存通知が日本語固定 |
| 基本画面 | `src/ui/screens/*.ts` | モード選択、棚、新規作成の本文・操作・ダイアログが日本語固定 |
| 統合編集 | `src/ui/craft/*.ts` | ラベル、ツール、診断、Undo操作名、状態通知、アクセシブル名が混在 |
| 画像から生成 | `src/ui/craft/GuidedImagePlacementDialog.ts` | 大量の状態文、診断文、単位、エラー、ライブ通知が日本語固定 |
| 鑑賞 | `src/ui/viewer/ViewingStage.ts`、`src/modes/viewFree/*.ts` | 演目名、進行文、視点名、カメラ説明、単位が日本語固定 |
| データ表示 | `src/data/*.ts` | 花火・星・大きさ・プリセットの表示名と説明がデータ定義へ混在 |
| 保存エラー | `src/data/storage.ts` | 日本語の`Error.message`をUIがそのまま表示 |
| テスト | 25前後の`.test.ts` | 日本語の完全一致やHTML断片へ依存するテストがある |

ロケール対応の足掛かりは一部にある。`formatShelfUpdatedAt()` はロケール引数を受け取れるが、通常呼び出しでは渡していない。一方、名前順は`localeCompare(..., "ja")`に固定され、数値は引数なしの`toLocaleString()`を使っている。

### 2.2 保存データ

表示用の日本語と、保存対象の文字列が同じ型に入っている。

- `FireworkDesign.name`、`description`
- `LayerBase.name`、`PatternGroup.name`
- `VirtualStarPreset.displayName`
- 新規作品、複製、画像由来星へ付ける既定名
- v1からv4への移行時に生成するレイヤー名

これらを一律に翻訳すると、既存作品の意味とJSONの再現性を壊す。特にmigrationへ現在のロケールを渡す方式は採用しない。

### 2.3 ドキュメント

最初の英語リリースで利用者が必要とする正本は次の4系統である。

- `README.md`
- `Docs/README.md`
- `Docs/USER_GUIDE.md`
- `Docs/IMAGE_TO_STARMINE.md`

操作ガイドは8枚の日本語UIスクリーンショットを参照している。別に調査資料3本、画像生成用プロンプト3本、履歴として保管している計画資料16本がある。履歴資料の全文翻訳は初回リリースの条件にしない。

## 3. 対応範囲

### 3.1 初回英語リリースに含める

- 日本語・英語のロケール選択、保存、URL共有
- 全画面、全ダイアログ、全通知、利用者向けエラーの翻訳
- アクセシビリティ文言とWebGL/ロード失敗表示の翻訳
- 内蔵花火、仮想星、型物、視点、演目の表示名
- ロケール別の日付・数値・件数・単位・並び順
- 英語README、英語操作ガイド、英語版ドキュメント一覧
- `IMAGE_TO_STARMINE.md`の英語版
- 英語UIのデスクトップ・モバイル確認と操作ガイド用画像
- 翻訳完全性、保存互換、主要画面の自動テスト

### 3.2 後続対応

- 調査資料3本の全文英訳
- `Docs/plans/`にある過去計画の全文英訳
- 画像生成用プロンプトの英語版
- 日本語・英語以外の言語
- 翻訳管理サービス、外部翻訳者向けポータル
- 検索エンジン向けに言語別の静的HTMLを生成する構成

英語の`Docs/README.en.md`には、未翻訳資料を日本語資料として明示し、原文へのリンクと短い英語説明を載せる。

## 4. 基本方針

### 4.1 ロケール

対応ロケールは、地域差を増やさず`ja`と`en`の2値に正規化する。`ja-JP`は`ja`、`en-US`や`en-GB`は`en`として扱う。

初期ロケールは次の優先順位で決める。

1. URLの`?lang=ja`または`?lang=en`
2. `localStorage`の`codex-starmine.locale.v1`
3. `navigator.languages`
4. 対応外または取得不能なら`ja`

言語切替時は次を同期する。

- i18nの現在ロケール
- `document.documentElement.lang`
- `document.title`
- `<meta name="description">`
- `localStorage`
- URLの`lang`クエリ（`history.replaceState`を使い、画面遷移履歴は増やさない）

`localStorage`を利用できないブラウザでも、そのセッション中の切替は動作させる。

### 4.2 言語切替UI

`AppShell`直下に、各画面のDOMから独立した`日本語 / English`切替を置く。モード選択だけでなく全画面から到達でき、キーボード操作、フォーカス表示、44px相当の操作領域、現在値のaccessible nameを持たせる。

切替後は現在の画面を同じ`AppFlowController`と`CraftDocumentStore`から再描画する。作品draft、dirty状態、Undo/Redo、保存作品、鑑賞設定は変更しない。画像解析中など破棄できない一時処理がある場合は、その処理を終了または取消してから切り替えることを明示し、暗黙に入力を失わない。

### 4.3 翻訳基盤

Vanilla TypeScriptから使える`i18next`本体だけを導入し、React連携や自動言語判定プラグインは追加しない。言語判定と保存は小さなアプリ固有モジュールで扱う。

想定構成:

```text
src/i18n/
  index.ts
  locale.ts
  format.ts
  types.ts
  resources/
    ja.ts
    en.ts
```

翻訳資源は次のnamespaceへ分ける。

- `common`: 共通操作、状態、単位
- `mode`: モード選択
- `shelf`: 花火棚、JSON、削除・全消去
- `setup`: 新規作成
- `editor`: レイヤー、配置、診断、保存、Undo/Redo
- `imagePlacement`: 画像選択、解析、点指定、進捗
- `viewer`: 湖面確認、フリー鑑賞、カメラ、音
- `errors`: 保存、ファイル、WebGL、画像処理
- `catalog`: 花火、星、型物、視点、演目の内蔵表示名

日本語資源をキーと値の正本にし、英語資源が同じ構造を満たすことをTypeScriptで検査する。呼び出しは生のキー文字列を広範囲へ渡さず、型付きの`t`とフォーマッターを画面へ依存注入する。

補間値はHTMLとして扱わない。ユーザー入力をテンプレートHTMLへ入れる箇所は、翻訳後も`escapeHTML()`または`textContent`を使い、翻訳導入で既存のエスケープを弱めない。

### 4.4 文言の種類を分離する

次の3種類を区別する。

1. **翻訳対象**: ボタン、説明、通知、アクセシブル名、表示用の内蔵カタログ。
2. **ユーザーデータ**: 作品名、ユーザーが編集したレイヤー名、インポートした説明。表示は原文のまま。
3. **開発内部**: コメント、テスト名、履歴資料、画面に出ないUndo内部ラベル。初回英語リリースでは翻訳不要。

利用者へ到達する可能性がある例外やWorkerの失敗は、文字列ではなく安定したエラーコード／状態コードを返し、UI境界で翻訳する。

## 5. 保存互換と内蔵データ

### 5.1 守る契約

- schemaVersionはv4のままにする。
- v1〜v4 migrationの出力をロケール依存にしない。
- 既存`localStorage`キーとJSON export formatを変更しない。
- ロケール設定は作品JSONへ含めない。
- 既存の作品名、説明、レイヤー名、星名を自動翻訳しない。
- 言語を切り替えてもdraftのJSONとdirty判定を変えない。

### 5.2 内蔵カタログ

内蔵データは安定IDを正本にして表示名を引く。

- 花火種類: `FireworkPattern`
- 内蔵作品: `preset-*`
- 仮想星: `star-*`
- 型物: `PatternTemplate`
- 視点: `FreeViewPresetId`
- 演目名・進行: 新設するruntime ID

`FIREWORK_PATTERN_LABELS`、`SIZE_PRESETS.label`、`FREE_VIEW_PRESETS.label`のようにdomain定義へ埋め込まれた表示名は、UI側の`catalog`翻訳へ移す。数値や位置など言語に依存しない値だけをdomain定義へ残す。

内蔵見本を英語環境で編集用にコピーするときは、コピー作成時だけ英語の既定名・説明・内蔵レイヤー名をmaterializeする。その後は通常のユーザーデータとして扱い、言語切替で書き換えない。

### 5.3 新しく生成する名前

新規作品、複製レイヤー、画像由来星など、保存される既定名を作るコマンドには`DesignNamingPolicy`を渡す。

例:

```ts
interface DesignNamingPolicy {
  blankFirework(): string;
  copiedLayer(sourceName: string): string;
  defaultLayer(kind: LayerAuthoringMode, ordinal: number): string;
  imageDerivedStar(color: string, kind: ImageDerivedStarKind): string;
  newFirework(template: InitialSetupTemplate): string;
}
```

作成時の言語で文字列を確定し、保存後は再翻訳しない。migrationにはこのpolicyを渡さない。

## 6. ロケール別フォーマット

`src/i18n/format.ts`に、現在ロケールを明示して使うフォーマッターを集約する。

- `Intl.DateTimeFormat`: 花火棚の更新日時
- `Intl.NumberFormat`: 粒子数、点数、件数
- `Intl.PluralRules`またはi18next plural: `1 item / 2 items`、`1 shot / 2 shots`
- `Intl.Collator`: 作品名順と検索比較
- 単位付き表示: 秒、発、点、個、本、%、MB、メガピクセル

引数なしの`toLocaleString()`、`localeCompare(..., "ja")`、日本語単位の単純連結を利用者向けUIから除く。

技術用語と製品名は翻訳資源でも表記を固定する。

| 日本語 | 英語候補 |
| --- | --- |
| 花火玉 | firework shell |
| 仮想星 | virtual star |
| 玉内配置 | shell layout |
| 既定レイヤー | preset layer |
| 型物 | pattern |
| 手動レイヤー | manual layer |
| 芯 | core |
| 子花 | child burst |
| 菊 | chrysanthemum |
| 牡丹 | peony |
| スターマイン | starmine |

英訳開始前にこのglossaryを確定し、ボタン、ヘルプ、README、操作ガイドで同じ語を使う。`Codex Starmine`、`SlimSAM`、`WebGPU`、`WASM`、`seed`などの固有名・技術語は必要以上に言い換えない。

## 7. 実装フェーズ

### Phase 0: 受け入れ契約と基準固定

1. 日本語を含むproduction文字列を、翻訳対象、ユーザーデータ、内部文字列へ分類する。
2. 主要画面、ダイアログ、toast、Canvas説明、エラーのチェックリストを作る。
3. 保存作品とexport JSONのfixtureを固定し、言語切替前後で同一であるテストを追加する。
4. 既存の日本語DOMテストを、安定した`data-*`属性と必要な文言検査へ分ける。
5. 用語集と英語writing styleを確定する。

完了条件:

- 翻訳対象の所有コンポーネントと翻訳キーnamespaceが対応付いている。
- 既存保存データの非変更を自動比較できる。

### Phase 1: i18n基盤とアプリ起動

1. `src/i18n`と`i18next`を追加する。
2. URL、保存値、ブラウザ言語からロケールを解決する。
3. `NightSkyApp`と`AppShell`へi18nを依存注入する。
4. 言語切替、`html lang`、title、meta descriptionを同期する。
5. `index.html`のロード表示は言語に依存しない表示にするか、module読込前の小さなbootstrapで初期言語を反映し、日本語が一瞬表示される状態を避ける。
6. `src/main.ts`のWebGLエラー、夜景Canvasのaccessible nameを翻訳する。
7. 翻訳キー欠落は開発・テストで失敗させ、productionでは日本語へfallbackする。

完了条件:

- `?lang=en`で最初の表示から英語になる。
- `?lang=ja`、保存値、未対応言語fallbackのテストが通る。
- 言語切替だけでは作品documentがdirtyにならない。

### Phase 2: 基本画面と鑑賞画面

次の順に移行する。

1. `ModeSelectionScreen`
2. `FireworkShelfScreen`
3. `InitialSetupScreen`
4. `AppShell`のヘッダー、確認、toast
5. `ViewingStage`
6. フリー演目名、進行状態、視点名

この段階で日時、件数、並び順、plural、風向、カメラ説明もロケール対応する。`FreeShowState`へ完成済み日本語を渡す方式はやめ、演目・進行のruntime IDと動的値をUIで翻訳する。

完了条件:

- 作成開始、棚の検索・並べ替え・JSON入出力、確認、フリー鑑賞を英語だけで操作できる。
- 日本語と英語の両方で既存保存作品を開ける。

### Phase 3: 統合編集と画像から生成

大きいファイルを一括置換せず、表示責務ごとに移行する。

1. `LayerPanel`、`StarLibraryPanel`
2. `SelectedLayerInspector`
3. `IntegratedPlacementWorkbench`、`ShellSliceNavigator`
4. `EditorTransport`、`DiagnosticView`、プレビュー
5. `IntegratedCraftEditor`の操作通知と確認
6. `GuidedImagePlacementDialog`
7. 画像処理の警告・失敗コード

テンプレートHTML内の可視文言だけでなく、`aria-*`、`title`、`placeholder`、`aria-valuetext`、処理中のライブ通知を同時に移行する。内部Undoラベルを画面へ出す場合だけ翻訳し、履歴の同一性には翻訳文を使わない。

完了条件:

- 新規作成から画像配置、Undo/Redo、保存、湖面確認まで英語で完了できる。
- 画像解析の全状態と失敗が英語で説明される。
- 390 × 844で主要操作が横にはみ出さない。

### Phase 4: 内蔵カタログと保存境界

1. 花火種類、内蔵見本、星、型物、視点、演目の表示名をIDベースにする。
2. `DesignNamingPolicy`を新規作成・複製・画像由来星へ適用する。
3. `storage.ts`などの利用者向け例外を型付きエラーコードへ変える。
4. 英語環境で作った作品と、日本語環境で作った作品の相互importを検証する。
5. migration結果がロケールで変化しないことをfixtureで保証する。

完了条件:

- 内蔵見本は選択言語で表示され、ユーザー作品は保存された原文で表示される。
- 英語で作ったJSONを日本語UIへ、日本語で作ったJSONを英語UIへ読み込める。
- v1〜v4 migrationとproduction compile結果に差分がない。

### Phase 5: 英語ドキュメント

既存日本語ファイルを動かさず、次を追加する。

```text
README.en.md
Docs/README.en.md
Docs/USER_GUIDE.en.md
Docs/IMAGE_TO_STARMINE.en.md
Docs/images/guide/en/
```

日本語版と英語版の各冒頭へ相互リンクを置く。公開URLの英語リンクは`?lang=en`を付ける。英語操作ガイドの画像は英語UIで撮り直し、alt textも英語にする。

翻訳時は段落ごとの直訳にせず、操作名をアプリの英語ラベルと完全に一致させる。日本語版の仕様更新時に英語版も更新できるよう、見出し構造と画像番号は揃える。

完了条件:

- 英語READMEから英語アプリ、英語操作ガイド、英語現行仕様へ到達できる。
- ガイドの操作名、画面、画像が現行英語UIと一致する。
- Markdownリンク切れと画像参照切れがない。

### Phase 6: 品質ゲートと公開

1. 日本語・英語のunit/DOMテストを全実行する。
2. ローカライズ漏れ検査をCIへ追加する。
3. 主要画面を1280 × 720、1440 × 900、390 × 844で確認する。
4. 200%文字拡大、キーボード、スクリーンリーダー向け属性を確認する。
5. Chrome、Safari、Firefoxの最新安定版で切替と保存を確認する。
6. GitHub Pagesの本番URLで`?lang=en`、リロード、戻る、直接リンクを確認する。

英語版を一度に既定化せず、ブラウザ言語判定と明示切替で公開する。保存エラー率、言語切替失敗、未翻訳報告を確認してから、追加言語や静的英語ページを検討する。

## 8. テスト計画

### 8.1 Unit

- ロケール正規化と優先順位
- 未対応・破損した保存ロケールのfallback
- `ja`と`en`の翻訳キー完全一致
- plural、日付、数値、単位、collation
- 内蔵IDからの表示名解決
- `DesignNamingPolicy`の日本語・英語出力
- エラーコードから利用者向け文言への変換

### 8.2 DOM

各ロケールで次を検証する。

- 5画面フローと戻る操作
- 棚の空状態、検索0件、保存作品、内蔵見本
- import競合、削除、全消去
- editorの主要ラベル、状態通知、負荷表示
- 画像配置の全処理状態
- check/freeの操作、視点、音、件数
- visible labelとaccessible nameの対応
- 言語切替後のcurrent screen、focus、dirty、Undo/Redo

文言そのものが仕様である箇所は両言語を検査する。構造や操作のテストは`data-*`属性を使い、翻訳文をセレクターにしない。

### 8.3 保存・migration

- locale変更前後のdraft JSON完全一致
- 既存v1〜v4 fixtureのmigration結果完全一致
- 日本語名を含む作品の英語UIでのround-trip
- 英語名を含む作品の日本語UIでのround-trip
- export format、ID、updatedAt、schemaVersionの不変
- 内蔵見本コピー時だけ選択言語の既定名をmaterialize

### 8.4 Browser・visual

最低限のPlaywright smoke/visualテストを追加し、二言語×主要viewportを固定する。

| 画面 | 1440 × 900 | 1280 × 720 | 390 × 844 |
| --- | --- | --- | --- |
| モード選択 | ja / en | en | ja / en |
| 花火棚 | ja / en | en | ja / en |
| 新規作成 | ja / en | en | ja / en |
| 統合編集 | ja / en | ja / en | ja / en |
| 画像配置 | en | ja / en | ja / en |
| 湖面確認 | en | ja / en | en |
| フリー鑑賞 | en | ja / en | en |

英語は日本語より横幅が増えやすいため、`white-space: nowrap`、固定幅ボタン、省略表示、モバイルドロワー、dialog footerを重点確認する。文字を小さく戻して解決せず、折返し、幅、余白、レイアウトを調整する。

## 9. CIと翻訳漏れ防止

`scripts/check-localization.mjs`を追加し、TypeScript ASTから利用者向けディレクトリの日本語文字列リテラルを検出する。対象外は翻訳資源、テストfixture、migrationの互換文字列、コメント、履歴契約に限定し、理由付きallowlistにする。

推奨コマンド:

```json
{
  "scripts": {
    "localization:check": "node scripts/check-localization.mjs",
    "test:e2e:locale": "playwright test tests/e2e/locales.spec.ts"
  }
}
```

通常の品質ゲートへ次を追加する。

```bash
npm run localization:check
npm run lint
npm run test:run
npm run test:e2e:locale
npm run format:check
npm run build
```

## 10. 主なリスクと対策

| リスク | 対策 |
| --- | --- |
| 英訳で保存JSONが変わる | 表示カタログとユーザーデータを分離し、locale切替前後のJSONを完全比較する |
| migrationが言語依存になる | migrationへtranslatorやlocaleを渡さず、既存fixtureを固定する |
| 英語の長さで操作が欠ける | visual matrixと200%拡大を品質ゲートにし、固定幅・nowrapを見直す |
| 一部の動的通知だけ日本語に残る | Worker・domainからコードを返し、UI境界で翻訳する |
| テストが日本語HTMLへ過度に依存する | 構造テストと翻訳仕様テストを分離する |
| HTML補間でXSS対策が弱まる | 補間をHTMLとして扱わず、既存のescape/textContent境界を維持する |
| 言語切替で一時入力を失う | document stateを再利用し、破棄不能処理は明示確認後に切り替える |
| 日本語と英語の文書がずれる | 見出し・画像番号を揃え、PR checklistで両言語更新要否を確認する |

## 11. 実装PRの分け方

レビューと切り戻しを容易にするため、次の6本を基本とする。

1. `i18n-foundation`: locale解決、資源、切替、起動文言、テスト
2. `localize-primary-screens`: mode、shelf、setup、AppShell、viewer
3. `localize-editor`: editor、diagnostic、preview
4. `localize-image-and-data-boundaries`: guided image、エラーコード、catalog、naming policy、保存互換
5. `english-docs`: README、操作ガイド、仕様、英語スクリーンショット
6. `locale-quality-gates`: 漏れ検査、Playwright、visual、CI

各PRで日本語の既存フローを通し、最後まで英語化される前でも日本語版を壊さない。中間段階の英語UIに未翻訳文が混ざる期間はmainへ長く残さず、feature branchまたは連続した短いPRで進める。

## 12. Definition of Done

- `ja`と`en`の全翻訳キーが揃っている。
- `?lang=en`から英語だけで新規作成、編集、画像配置、保存、JSON復元、湖面確認、フリー鑑賞を完了できる。
- ユーザーデータを除く全visible text、accessible name、status/errorが選択言語になる。
- locale切替でdraft、Undo/Redo、保存作品、schema、export JSONが変わらない。
- 既存の日本語ユーザーデータは英語UIでも原文のまま保持される。
- 日本語と英語でunit、DOM、migration、browser、visualの品質ゲートが通る。
- 1440 × 900、1280 × 720、390 × 844、200%文字拡大で主要操作が隠れない。
- 英語README、操作ガイド、現行仕様、英語スクリーンショットが公開され、相互リンクに切れがない。
- 日本語ハードコードの新規混入をCIが検出する。
