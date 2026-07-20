# Codex Starmine

GPT-5.6 Sol / Codex （実装計画書サポートと画像から花火を作る機能は Claude Fable 5 ）で作成した
自分でデザインした打ち上げ花火を、湖畔の夜景で鑑賞するブラウザシミュレーションです。

動かせるページ: https://maoku.github.io/CodexStarmine/

自分でデザインした花火を打ち上げたり、作成済みのものを鑑賞するのもできます。

初めて使う場合は、画面ごとの操作をまとめた [`Docs/USER_GUIDE.md`](Docs/USER_GUIDE.md) のスクリーンショット付き操作ガイドを参照してください。

## 公開版

GitHub Pagesを有効化すると、[https://maoku.github.io/CodexStarmine/](https://maoku.github.io/CodexStarmine/) で利用できます。

## 遊び方

1. 起動時に「花火を作る」または「フリー鑑賞」を選ぶ
2. 「花火を作る」では花火棚から内蔵見本・保存作品を編集するか、「新しい花火」で大きさと菊／牡丹／白紙を選ぶ。保存作品はJSONでインポート／エクスポートできる
3. 統合編集画面で `既定 / 型物 / 手動` レイヤーを追加し、3D玉とXYZギズモで切断面を選ぶ。型物は円・ハート・星・四角・三角・六角形、手動は1点編集と円周・直線・円弧・格子の追加／置換、Undo/Redoを利用できる
4. 仮想星を長押しするかキーボードで `Space` を押すと、画面端でも欠けないオーバーレイで星単体の広がりを確認できる。右側の固定小窓では、本番と同じコンパイル結果と粒子運動を最大256星へ決定的に間引いた「打上結果プレビュー」を再生できる
5. 「湖面で確認」では編集中の1作品だけを固定条件で単発ループ再生し、湖面反射、煙、音を含む完成表示を確認する。確認中もドラッグ、ズーム、WASD、4つのプリセット視点を利用できる
6. 編集へ戻って調整するか、「保存して棚へ」で保存する。作品の削除は花火棚でのみ行う
7. 「フリー鑑賞」では演出密度を選び、保存作品を含む自動ショーを楽しむ。ドラッグ／タッチ、ホイール／ピンチ、WASD／矢印／Q/E、4つのプリセット視点でカメラを操作できる

保存作品はユニークIDと更新日時を持ち、ブラウザの `localStorage` にv4編集意図として保持されます。同じIDのJSONをインポートした場合は重複件数を確認し、ユーザーが「重複をスキップ」または「置き換える」を選びます。置換時はJSON側の内容と更新日時を採用し、同じIDを重複登録しません。v1／v2／v3作品は検証成功時だけv4へ非破壊移行し、旧キーを削除しません。花火棚の「ローカル作品を全消去」は確認後に全世代の保存キーを消去します。音は最初のクリックまたはキー入力後に有効になり、鑑賞画面の「音の距離感」で物理遅延と即時寄りの演出を調整できます。

## 利用技術

| 分類           | 技術                                 | 用途                                                                       |
| -------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| 言語・ビルド   | TypeScript 5.9、Vite 6.4             | 型安全な実装、開発サーバー、production bundle                              |
| 3D描画         | three.js 0.185、WebGL 2              | 花火、湖面、煙、夜空、自由カメラのリアルタイム描画                         |
| ポストプロセス | `EffectComposer`、`UnrealBloomPass`  | 発光、残光、ブルーム表現                                                   |
| UI             | HTML、CSS、SVG、TypeScript DOM API   | モード選択、花火棚、配置エディター、鑑賞操作。UIフレームワークは使用しない |
| 音響           | Web Audio API                        | 打上音・開花音の合成と距離遅延                                             |
| 並列処理       | Web Workers、OffscreenCanvas         | 画像セグメンテーション、減色、境界追跡、配置点生成                         |
| 保存           | `localStorage`、JSON                 | schema v4作品のブラウザ内保存とバックアップ／復元                          |
| 品質管理       | Vitest、ESLint、Prettier、TypeScript | 単体・統合テスト、静的解析、フォーマット、型検査                           |

### SlimSAMによる被写体抽出

手動レイヤーの「画像から生成」では、画像から被写体の輪郭を抽出する高精度プロバイダとして [Xenova/slimsam-77-uniform](https://huggingface.co/Xenova/slimsam-77-uniform) を使用しています。

- **実行環境**: `@huggingface/transformers` 3.8.1とONNX Runtime Webを専用Worker内で遅延ロードし、推論をブラウザ内で完結させます。
- **バックエンド**: `WebGPU + fp16` を優先し、利用できない場合や処理に失敗した場合は `WASM + q8`、最後に軽量な古典画像処理へフォールバックします。透過画像はalphaを優先し、SlimSAMをロードしません。
- **プライバシー**: 選択した画像は外部へ送信せず、画像本体やファイル名も保存作品へ埋め込みません。
- **自己ホスト**: モデル、設定、ライセンス、ONNX Runtime WASMを `public/models` と `public/wasm` から同一オリジン配信し、Transformers.jsのリモートモデル取得を無効にしています。
- **再現性と供給網対策**: モデルrevisionを `5850ab45f587c112167512ffef949107115e26a0` に固定し、production build前にファイル容量とSHA-256を検証します。モデルのライセンスはApache-2.0です。
- **処理の分離**: 画像埋め込みを再利用し、点・矩形の変更時はマスクデコーダーだけを再実行します。減色、内部境界追跡、最大2048点の配置生成も別Workerへ分離しています。

回帰比較ではURLへ `?segmentation=fast` を付けると、SlimSAMを使わない軽量方式を強制できます。確定仕様、制限、モデル資産の詳細は [`Docs/IMAGE_TO_STARMINE.md`](Docs/IMAGE_TO_STARMINE.md)、固定ファイル一覧は [`manifest.json`](public/models/slimsam-77-uniform/5850ab45f587c112167512ffef949107115e26a0/manifest.json) を参照してください。

## 開発

```bash
npm install
npm run dev
```

品質確認:

```bash
npm run lint
npm run test:run
npm run format:check
npm run build
```

### GitHub Pagesへの公開

`.github/workflows/deploy-pages.yml` が、`main` ブランチへのpush時に依存関係のインストール、SlimSAM資産の検証、TypeScriptの型検査、Viteのproduction build、GitHub Pagesへのデプロイを自動実行します。

初回だけGitHubの `Settings` → `Pages` → `Build and deployment` で、`Source` を `GitHub Actions` に設定してください。その後は `main` へのpushで自動公開されます。GitHubの `Actions` タブから `Deploy to GitHub Pages` を選び、`Run workflow` で手動実行することもできます。

現行仕様と関連資料は [`Docs/README.md`](Docs/README.md)、設計とフェーズごとの実装範囲は [`Docs/plans/IMPLEMENTATION_PLAN.md`](Docs/plans/IMPLEMENTATION_PLAN.md)、最新の編集体験リニューアル計画は [`Docs/plans/RENEWAL_IMPLEMENTATION_PLAN3.md`](Docs/plans/RENEWAL_IMPLEMENTATION_PLAN3.md) を参照してください。

## 構成

- `src/core`: レンダリング非依存のシミュレーション
- `src/render`: three.js のシーンと描画効果
- `src/audio`: 効果音と音楽解析
- `src/data`: データモデル、プリセット、永続化
- `src/modes`: 製作・フリー鑑賞・音楽連動モード
- `src/ui`: UI コンポーネント

## 現在の実装範囲

- 月と月光筋を除いた湖畔夜景、星空、山影、非周期の多層波、HDR・ブルーム
- 14種類の花火、3サイズ、芯、色変化、尾、子花、打上揺らぎ
- 距離遅延付きの合成音、風下へ蓄積する煙、開花時の環境照明
- モード選択、花火棚、初期設定、統合編集、check/free共通湖面画面の5画面フロー
- 花火棚での保存作品の検索・並替・編集・削除、ローカル時刻の更新日表示、重複を防ぐJSON入出力と全消去
- 8種の仮想星、既定・型物・手動レイヤー、3D玉の切断面ナビゲーター、6種の幾何型物、4種の手動配置支援
- 画面端で反転する星オーバーレイ、本番planを最大256星で示す固定プレビュー、100件Undo/Redo、描画負荷診断と自動簡略化
- 固定assembly seedとcheck seedによる再現可能な内部配置・単発確認、現在のv4編集意図を直接コンパイルする本番打上
- v1/v2/v3保存作品を残したまま行うv4非破壊移行
- ShowCue タイムラインによる単発・連続・連発・スターマインとフリー鑑賞
- check/free共通の自由カメラ、4つのプリセット視点、湖畔固定席へのリセット

# ライセンス

MIT
