# 画像から仮想星を生成するブラウザローカル手法 調査レポート

- 調査日: 2026-07-17
- 対象: CodexStarmine の「画像から生成」機能
- 前提: 画像を外部APIへ送信せず、ブラウザ内で解析して、現在の切断面へ最大240個の編集可能な仮想星を配置する

## 1. 結論

ブラウザローカルでの実現可能性は高い。現行の TypeScript による画素統計方式は、透過PNG、単色背景、ロゴ、輪郭の明瞭なイラストに対する既定経路として妥当であり、維持する価値がある。一方、複雑な写真、背景と同系色の被写体、画像端へ接する被写体、複数の物体を含む画像を、ユーザーの意図どおり完全自動で分離することは、外周色から背景を推定する方式だけでは原理的に難しい。

推奨する構成は、マスク生成部を交換可能にした段階式パイプラインである。

1. 透過画像ではアルファをそのままマスクにする。
2. 通常は現行の軽量方式を即時実行する。
3. 信頼度が低い場合だけプレビューを表示し、ユーザーに被写体を1点タップしてもらう。
4. タップ後は、まず GrabCut、より高精度が必要なら SlimSAM などの対話型セグメンテーションを Web Worker 内で実行する。
5. 得られたマスク以降は、方式に関係なく同じ「輪郭追跡→弧長による点配分→内部特徴→既存仮想星への色割当」を使う。

最優先の改善はAI導入ではない。現行コードのマスク境界画素を走査順に間引く処理を、**順序付き輪郭の追跡と弧長ベースの再サンプリング**へ置き換え、被写体の外接矩形で再中心化することである。花火では最終出力が最大240点に制限されるため、画素単位の切り抜き精度より、「240点で形が読めるか」が品質を決める。

## 2. 「画像から仮想星」の問題設定

この機能が解くべき問題は、一般的な背景除去と完全には同じではない。

```text
入力画像
  → ユーザーが意図する被写体のマスク
  → 読みやすい外形輪郭と少数の内部特徴
  → 最大240点への縮約
  → 各点を既存の仮想星へ色割当
  → 現在の2D切断面を経由して3D座標へ変換
```

重要なのは次の3点である。

- 目的は写真の精密な切り抜きではなく、打上後にも認識できる点群化である。
- 1枚の画像から一意な3D形状を復元することはできない。現仕様は画像を1枚の切断面へ写す「2D配置」であり、この目的には適している。
- 背景と被写体の自動判定には曖昧さがある。1点タップや囲み指定を許すと、複数被写体でもユーザーの意図を低コストで確定できる。

将来、画像を球全体へ展開する場合は別問題として扱うべきである。単純な薄い押し出し、複数断面への複製、単眼深度による2.5D化はいずれも可能だが、現在の「画像と同じ形に開花する」という目的には平面配置が最も予測しやすい。

## 3. 現行実装の評価

現行実装は次の経路で完結している。

対象コードは [imagePixelLoader.ts](../src/ui/craft/imagePixelLoader.ts)、[ImagePlacementRecipe.ts](../src/ui/craft/ImagePlacementRecipe.ts)、[ImagePlacementApplication.ts](../src/ui/craft/ImagePlacementApplication.ts) で、確定仕様と実装記録は [IMAGE_TO_STARMINE.md](IMAGE_TO_STARMINE.md) にまとまっている。

```text
File
  → imagePixelLoader.ts: Canvas 2Dで最長辺256pxへ縮小
  → ImagePlacementRecipe.ts:
       外周中央値、背景洪水充填、連結成分選別、境界、Sobel内部特徴
  → 最大4色へ量子化
  → 既存の仮想星へ最近色割当
  → ImagePlacementApplication.ts: ManualLayerPointへ変換
```

### 3.1 良い点

- 追加の実行時依存やモデルダウンロードがなく、初回から速く動作する。
- 画像を外部へ送らず、保存データにも含めない。
- 入力、設定、走査順が同じなら結果が決定的である。
- 既存の `ManualLayerPoint`、Undo/Redo、置換／追加、打上プレビューをそのまま利用している。
- 256×256以下、240点以下に処理量を固定しており、端末性能差の影響が小さい。
- 透過PNG、白背景の商品画像、ロゴ、フラットなイラストには費用対効果が高い。

### 3.2 構造的な限界

| 現象 | 原因 | 影響 |
| --- | --- | --- |
| 複雑な写真で背景が被写体に混ざる | 外周の単一代表色を背景モデルにしている | 背景の模様や照明勾配を輪郭として拾う |
| 被写体が画像端に接すると外形が欠ける | 画像端を輪郭とみなさない設計 | クロップ線を除ける一方、本物の輪郭も欠落する |
| 離れた髪、手、小物が消える | 主成分比15%未満をノイズとして除く | 正当な小成分とノイズを意味的に区別できない |
| 内部特徴が目ではなく服の模様へ寄る | Sobelは意味ではなく局所コントラストを測る | テクスチャの多い箇所が点数を消費する |
| 輪郭点の密度が場所により偏る | 候補は画像走査順であり、輪郭曲線の順序ではない | 曲線長に対する厳密な等間隔配置にならない |
| 小さな被写体が点群でも小さい | 画像全体の中心と対角長で正規化している | 余白が配置可能領域を消費する |
| 近い見た目の星が選ばれない場合がある | sRGB空間のユークリッド距離で比較している | 人間の知覚上の色差と一致しない |

これらは現行実装の不具合というより、軽量方式の適用範囲である。完全自動のしきい値追加だけで全種類の画像へ対応しようとすると、ある画像の修正が別の画像を悪化させやすい。

## 4. 候補手法の比較

### 4.1 比較表

| 方式 | 任意被写体 | 操作 | 初回負荷 | ブラウザ互換性 | ライセンス／配布 | 本件での判断 |
| --- | --- | --- | --- | --- | --- | --- |
| 現行の画素統計 | 背景が単純な画像向け | なし | 極小 | Canvas 2Dがあれば可 | 自作 | 既定経路として維持 |
| GrabCut（OpenCV.jsまたは同等実装） | 色分離できる写真まで | 囲み、必要なら前景／背景の修正 | WASM追加、モデルなし | WASM対応ブラウザ | OpenCVはApache 2.0 | 中間経路として有力 |
| MediaPipe Interactive Segmenter | 一般物体を1点から選択 | 被写体を1点タップ | WASM＋TFLiteモデル | Web向けAPIあり | モデル資産を個別確認 | 軽量AI候補、PoC比較対象 |
| SlimSAM + Transformers.js | 一般物体を点プロンプトで選択 | 被写体を1点以上タップ | 選択重み約13.8〜39.9MB、リポジトリ計74.3MB | WebGPU優先、WASMフォールバック | Apache 2.0 | 高精度オプションの第一候補 |
| MODNet | 人物ポートレート | なし | モデル一式110MB | Transformers.jsで実行可 | Apache 2.0 | 人物専用なので主経路には不適 |
| BiRefNet-ONNX | 自動の一般前景抽出 | なし | 公開リポジトリ1.46GB | ブラウザ実行は可能でも重い | MIT表記 | 本件の240点用途には過大 |
| `@imgly/background-removal` | 自動の一般前景抽出 | なし | 初回にWASM・ONNX取得 | ブラウザ対応 | AGPLまたは商用契約 | 現行プロジェクトのライセンス方針次第 |
| BRIA RMBG 1.4/2.0 | 自動の一般前景抽出 | なし | 比較的大きいモデル | Transformers.js対応表記 | 非商用、商用は別契約 | 無条件採用不可 |

### 4.2 古典画像処理

OpenCV.js には `cv.grabCut()`、二値マスクの `cv.findContours()`、Opening/Closingなどの形態学処理が用意されている。GrabCutは、被写体を囲む矩形から開始し、必要なら前景・背景のストロークで修正する対話型手法である。モデル重みを配らずに、現行の外周色推定より複雑な背景へ対応できる。

ただし、背景と被写体の色や模様が近い場合、髪や毛の細部、透明・半透明物体では限界がある。OpenCV.js全体を導入するとWASM資産とメモリ管理が増えるため、本件で必要な輪郭追跡と形態学処理だけはTypeScriptで実装し、GrabCutだけをPoCで評価する案も現実的である。

参考: [OpenCV.js GrabCut](https://docs.opencv.org/master/dd/dfc/tutorial_js_grabcut.html)、[OpenCV.js contours](https://docs.opencv.org/master/d5/daa/tutorial_js_contours_begin.html)、[OpenCV.js morphological operations](https://docs.opencv.org/master/d4/d76/tutorial_js_morphological_ops.html)

### 4.3 MediaPipe Interactive Segmenter

MediaPipeのWeb向け対話型セグメンテーションは、画像内の1点を受け取り、その地点にある物体の境界を推定してマスクを返す。`@mediapipe/tasks-vision` とTFLiteモデルを使うため、用途は本件とよく一致する。

注意点は、Web版がSolutions Previewであること、`segment()` が同期実行でUIスレッドをブロックするためWeb Workerへ分離すべきこと、配布するモデル資産のサイズとライセンスをPoC時に固定する必要があることである。

参考: [MediaPipe Interactive Image Segmenter for Web](https://developers.google.com/edge/mediapipe/solutions/vision/interactive_segmenter/web_js)

### 4.4 SlimSAM + Transformers.js

Transformers.jsはONNX Runtimeを使って画像セグメンテーションをブラウザ内で実行でき、WebGPUは `device: "webgpu"` で選択できる。公式サンプルには SlimSAM を使う「Segment Anything WebGPU」があり、点プロンプトから複数候補マスクとIoUスコアを得られる。`Xenova/slimsam-77-uniform` はApache 2.0表記で、ONNXフォルダ全体は74.3MBである。ただし実行時に1種類だけを配るなら、エンコーダー＋デコーダーは量子化版で約13.8MB、FP16版で約20.8MB、FP32版で約39.9MBになる。

本件では、画像読み込み直後にモデルを強制ダウンロードするのではなく、「うまく切り抜けない場合」だけ動的importして自己ホストした重みを取得する。画像埋め込みは1回だけ計算し、ユーザーの追加タップでは軽いマスクデコーダだけを再実行できる構成が望ましい。

参考: [Transformers.js WebGPU guide](https://huggingface.co/docs/transformers.js/en/guides/webgpu)、[公式のSegment Anything WebGPU例](https://github.com/huggingface/transformers.js-examples/tree/main/segment-anything-webgpu)、[SlimSAMモデルカード](https://huggingface.co/Xenova/slimsam-77-uniform)、[ONNXファイル別容量](https://huggingface.co/Xenova/slimsam-77-uniform/tree/main/onnx)

### 4.5 自動背景除去モデル

1クリックの完全自動体験には魅力があるが、モデルごとの対象範囲、容量、ライセンス差が大きい。

- MODNetは公式例でも「tiny portrait background removal model」とされ、人物以外のイラスト、動物、製品を含む本件の共通モデルにはできない。[Transformers.js MODNet例](https://github.com/huggingface/transformers.js-examples/tree/main/remove-background-webgpu)
- BiRefNet-ONNXはMIT表記だがリポジトリが1.46GBあり、最大240点の生成機能へ常時配布するには重すぎる。[BiRefNet-ONNX](https://huggingface.co/onnx-community/BiRefNet-ONNX/tree/main)
- IMG.LYのライブラリはブラウザローカル実行を提供するが、OSS利用条件はAGPLである。プロジェクト全体の配布条件に合わなければ商用契約が必要になる。[IMG.LY background-removal-js](https://github.com/imgly/background-removal-js)
- BRIA RMBG 1.4/2.0はTransformers.js対応表記がある一方、モデルカード上は非商用利用で、商用利用には別契約が必要である。[RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4)、[RMBG-2.0](https://huggingface.co/briaai/RMBG-2.0)

したがって、商用化の可能性を残すなら、Apache 2.0のSlimSAMを使う対話型経路が、容量・任意物体対応・利用条件のバランスを取りやすい。

## 5. 推奨アーキテクチャ

### 5.1 コンポーネント構成

```text
Main thread
  ImageImportController
    - ファイル選択
    - プレビュー、被写体タップ、進捗、キャンセル
    - 最終結果を1回のupdateIntentで適用
          │ transferable ImageBitmap / ArrayBuffer
          ▼
Image worker
  ImageDecoder
    - createImageBitmap
    - EXIF向きを反映した縮小
  MaskProvider
    - AlphaMaskProvider
    - FastBorderMaskProvider（現行方式）
    - GrabCutMaskProvider（任意）
    - PromptSegmentationProvider（SlimSAM/MediaPipe、任意）
  MaskPostProcessor
    - しきい値、Opening/Closing、小成分処理
  PointExtractor
    - 輪郭追跡、階層、弧長配点、内部特徴
  StarColorResolver
    - Lab色空間で既存星へ割当
          │ points + colors + diagnostics
          ▼
Main thread
  applyImagePlacementToDraft
```

`createImageBitmap()` はWorkerでも利用でき、画像デコードをUIスレッドから外せる。MediaPipeのWeb APIは同期呼び出しがUIスレッドをブロックすると公式に明記されているため、AIを採用しない場合でもWorker化には価値がある。

参考: [WorkerGlobalScope.createImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/createImageBitmap)、[MediaPipe Image Segmenterのスレッド注意事項](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter/web_js)

### 5.2 マスク方式の自動選択

次の優先順位なら、速度と成功率を両立できる。

1. 有意な透過アルファがある: アルファマスクを採用。
2. 透過がない: 現行の高速マスクを生成。
3. 高速マスクの信頼度が高い: そのまま点群プレビューへ進む。
4. 信頼度が低い: 「残したいものをタップ」へ遷移。
5. WebGPUと任意モデルが利用可能: SlimSAM。
6. WebGPUが利用できない: MediaPipe/WASMまたはGrabCutへフォールバック。
7. いずれも失敗: 矩形トリミング、前景／背景ストローク、現行方式のしきい値調整を提示。

高速マスクの信頼度は、学習モデルを使わず次の診断値から決められる。

- マスク面積が画像の2〜90%に収まるか。
- 前景が画像端へ接する比率。
- 最大成分と第2成分の比率。
- 背景差の分布に十分な分離があるか。
- 輪郭長に対して抽出可能な点が十分か。
- 点群化後の最近傍距離が極端に偏っていないか。

信頼度は自動採否にのみ使い、「80%」のような誤解を招く精度表示はしないほうがよい。

### 5.3 マスクから仮想星への変換

#### A. マスク整形

- アルファまたは確率マスクを二値化する。AIの確率マスクは固定0.5だけでなく、面積と境界安定性を見て0.35〜0.65で選ぶ。
- Openingで孤立ノイズを除き、Closingで1〜2pxの切れ目をつなぐ。
- 小成分を一律削除せず、タップ位置を含む成分は必ず残す。複数点をタップした場合は複数成分を残す。
- 穴は輪郭階層として保持し、目やロゴの抜きとして使えるようにする。

#### B. 順序付き輪郭

現在の「境界画素の集合」ではなく、`findContours()`相当またはMarching Squaresで閉じた輪郭列を作る。輪郭ごとに周長を求め、重要度に応じて点数を割り当てる。

```text
輪郭 i の点予算
  = round(外形予算 × 周長_i × 重要度_i / 全輪郭の加重周長)
```

外形は高い重要度、穴や内部線は低い重要度にする。各輪郭は累積弧長に対して等間隔に再サンプリングする。これにより、斜線、曲線、別成分が画像の走査順に混ざらず、同じ240点でも輪郭が連続して見える。

#### C. 正規化

- 画像全体ではなく、採用マスクの外接矩形を求める。
- 外接矩形の中心を原点へ移し、アスペクト比を保って安全半径0.94へ収める。
- 余白を残したい用途向けに「画像全体を維持」オプションを内部設定として残す。
- 被写体が細長い場合、円への内接だけでは点が中央へ密集するため、最小表示幅を設けるかプレビューで拡大を許す。

#### D. 内部特徴

内部特徴の25%固定は初期値として妥当だが、画像ごとに可変にする。

- 輪郭だけで十分なロゴやシルエット: 0〜10%。
- 顔、動物、キャラクター: 15〜30%。
- テクスチャ写真: Sobel上位点を直接使わず、短いエッジを除外し、線分／閉曲線単位で採用。
- ユーザーが追加タップした目や模様: 最優先の特徴点として予算を確保。

特徴も画素スコアの点集合ではなく、細線化または輪郭化した線へ弧長配点するほうが、打上後にまとまりやすい。

#### E. 色割当

- sRGBを線形化し、CIELABへ変換して知覚色差で既存星を選ぶ。
- 各仮想星は時間で色が変化するため、中間色1点だけでなく、発光開始色・主色・尾色の加重代表を使う。
- 外形は現行どおり代表色1種に統一し、内部特徴だけ最大3色を追加すると形が読みやすい。
- 黒や低彩度の画像色は花火では発光できないため、「暗色」を白銀、銀引、炭火引などの明度差へ写す専用規則を持たせる。

### 5.4 決定性

AI推論を導入しても、同じモデルバージョン、同じ重み、同じ実行プロバイダ、同じ前処理なら通常は同じ結果を得られる。ただしWebGPUとWASMの浮動小数点差でマスク境界が1画素変わる可能性がある。

保存上の再現性を厳密にするには、生成後の `ManualLayerPoint` だけを保存し、再読込時に画像から再推論しない現在の方針を維持する。Undo/Redo中も推論を再実行せず、生成結果を履歴へ保持する。テストでは同一プロバイダ内の決定性と、WebGPU/WASM間の許容差を分けて定義する。

## 6. ブラウザ、性能、オフライン

### 6.1 実行プロバイダ

ONNX Runtime WebはWASM、WebGPU、WebNN、WebGLを選べるが、すべての演算子がGPU系プロバイダで動くとは限らない。WASMは全演算子対応でフォールバックとして堅い。WebGLはメンテナンスモードで、新規実装ではWebGPUを優先するのが公式方針である。

WebGPUは2026年時点でもMDN上はBaselineではなく、HTTPSのsecure contextが必要である。Safari 26はWebGPUを搭載したが、実際のモデル互換性は端末・ブラウザごとに確認が必要である。したがって、ユーザーエージェントではなく `navigator.gpu` と実際のセッション生成で機能検出し、WASMへ戻す。

参考: [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)、[ONNX Runtime WebGPU](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html)、[MDN WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)、[Safari 26 WebGPU](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)

### 6.2 ローカル処理と完全オフラインの違い

「画像をローカル処理する」と「初回からネットワーク不要」は別である。

- CDNやHugging Faceからモデルを取得しても、画像を送信せず推論だけ端末内で行うことはできる。
- 完全オフラインを保証するには、JS、WASM、モデル重みをすべて自サイトから配信し、Service Worker/Cache Storageへ保存する。
- Content Security Policyの `connect-src` を自サイトに制限し、画像送信がないことを技術的にも検証可能にする。
- モデルURL、バージョン、ハッシュを固定し、上流更新で結果が変化しないようにする。
- 初回の任意モデル取得前に、実際に選んだ重みの合計容量を明示し、モバイル回線では同意を取る。

### 6.3 性能目標

次の値は実測値ではなく、PoCで合否を決めるための目標である。

| 指標 | 目標 |
| --- | --- |
| 高速方式のウォーム処理 | 中位スマートフォンで500ms以内 |
| メインスレッドのLong Task | 50ms超を発生させない |
| 任意AIのキャッシュ後処理 | デスクトップ2秒以内、対象モバイル5秒以内 |
| 進捗表示 | モデル取得、初期化、マスク生成、点群化を区別 |
| キャンセル | 画像変更時に古いジョブ結果を適用しない |
| メモリ | Worker終了またはモデル解放後にImageBitmap、Tensor、GPUBufferを破棄 |
| モデル配布 | 任意機能1つあたり100MB以下を優先 |

## 7. セキュリティとプライバシー

- `accept="image/*"` とMIMEだけを信用せず、ブラウザデコーダの成功を確認する。
- 圧縮爆弾対策としてファイル容量だけでなく、デコード後の縦横・総画素数上限を設ける。
- SVGを許可する場合はDOMへ挿入せず、画像デコーダ経由でラスタライズする。不要ならPNG/JPEG/WebP/AVIFに限定する。
- Blob URLは現行どおりロード成功・失敗の両方で破棄する。
- 画像、ファイル名、画素ハッシュをテレメトリへ含めない。
- AIモデルを自己ホストし、外部CDNを使う場合も画像本体をURL化して外部ライブラリへ渡さない。
- 生成後に保存するのは点群、断面、既存星IDだけとし、元画像やマスクは保存しない。

## 8. 推奨する導入順

### Phase 1: 現行方式の出力品質を上げる

1. `MaskProvider` と `PointExtractor` の境界を型として分離する。
2. マスク外接矩形で再中心化・再拡大する。
3. 順序付き輪郭追跡と弧長ベースの等間隔配置を実装する。
4. Opening/Closingと輪郭階層を追加する。
5. RGB最近色をLab色差へ変更する。
6. マスクと最終点群の確認プレビューを追加する。

この段階はモデルなしで実施でき、透過PNG、ロゴ、イラストの品質を直接改善する。

### Phase 2: 軽いユーザー補助

1. 被写体の囲み指定または1点タップを追加する。
2. GrabCutをOpenCV.jsでPoCし、現行方式とバンドル容量・速度・成功率を比較する。
3. 前景追加／背景除外を少数のタップで修正できるようにする。
4. 画像処理をWorkerへ移す。

### Phase 3: 任意の高精度モード

1. SlimSAMとMediaPipe Interactive Segmenterを同一テスト画像で比較する。
2. WebGPU、WASM、Safari/iOS、低メモリ端末でコールド／ウォーム時間を測る。
3. 精度、容量、ライセンス、端末範囲から1方式を選ぶ。
4. 動的import、自己ホスト、キャッシュ、進捗、キャンセルを実装する。
5. 高速方式が低信頼度のときだけ提案し、常時の初回ダウンロードにはしない。

## 9. PoCと評価方法

### 9.1 テスト画像

最低50枚を、次のカテゴリで均等に用意する。公開配布できる自作・許諾済み画像を使う。

- 透過PNGのロゴ／アイコン
- 白背景・単色背景の商品
- 人物ポートレート
- 動物、毛、髪
- アニメ／フラットイラスト
- 複雑な自然背景
- 被写体と背景が同系色
- 被写体が画像端に接する
- 複数被写体から1つを選ぶ
- 細長い形、穴のある形、小さな分離パーツ

既存の `latte.png` と `mao.png` は回帰画像として残すが、この2枚だけで方式選定はしない。

### 9.2 指標

| 観点 | 指標 |
| --- | --- |
| マスク | 人手正解とのIoU、境界F-score |
| 点群 | 正解輪郭との対称Chamfer距離、点間隔の変動係数 |
| 認識性 | 240点の静止プレビューと打上後を別々に、被写体を識別できた割合 |
| 操作 | 成功までのタップ数、手動修正時間、やり直し率 |
| 性能 | 初回モデル取得、初期化、推論、点群化の各時間、ピークメモリ |
| 安定性 | 同一入力の再現、画像変更時のキャンセル、失敗後の復帰 |
| 互換性 | 対象Chrome/Edge/Safari/Firefox、iOS/Android、WebGPU/WASM |

マスクIoUだけで採否を決めない。花火の認識性は、細い毛を正確に切り抜くことより、耳、顔の外形、目などへ限られた点をどう配るかに左右される。

### 9.3 Go/No-Go基準

- Phase 1だけで、単純背景カテゴリの90%以上が手直しなしで認識可能。
- 高速方式が失敗するカテゴリの80%以上を、追加2タップ以内で対話方式が救済。
- 任意AIのキャッシュ後処理が対象端末の性能目標を満たす。
- AIなしの既存経路と保存schema v4が維持される。
- 画像またはマスクの外部送信がネットワーク検査で0件。
- 採用するコードとモデル重みの再配布条件を法務・プロジェクト方針上満たす。

## 10. 最終提案

本機能は「AI背景除去機能」として作り直すのではなく、**軽量な既定経路と、ユーザーが必要時だけ呼び出す対話型救済経路**として発展させるのがよい。

短期は、現行のマスク生成を残しつつ、輪郭の順序化、弧長配点、外接矩形正規化、マスクプレビューを実装する。中期はGrabCutまたはMediaPipeで被写体タップを導入する。高精度モードが必要と実測で確認できた場合だけ、Apache 2.0のSlimSAMを動的に追加する。量子化版ならモデル重みは約13.8MBから試せるため、リポジトリ全体を配信する必要はない。

この構成なら、通常利用は今と同じく即時・軽量・ローカルのまま、難しい写真だけ精度を上げられる。さらに、AIモデルを将来交換しても、マスク後の点群化、既存星への割当、Undo/Redo、保存形式へ影響を及ぼさない。

## 11. 主要参考資料

- [ONNX Runtime Web: in-browser inference](https://onnxruntime.ai/docs/tutorials/web/)
- [ONNX Runtime Web: WebGPU execution provider](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html)
- [Transformers.js](https://huggingface.co/docs/transformers.js/en/index)
- [Transformers.js WebGPU guide](https://huggingface.co/docs/transformers.js/en/guides/webgpu)
- [Transformers.js Segment Anything WebGPU example](https://github.com/huggingface/transformers.js-examples/tree/main/segment-anything-webgpu)
- [Xenova/slimsam-77-uniform](https://huggingface.co/Xenova/slimsam-77-uniform)
- [MediaPipe Interactive Image Segmenter for Web](https://developers.google.com/edge/mediapipe/solutions/vision/interactive_segmenter/web_js)
- [OpenCV.js GrabCut](https://docs.opencv.org/master/dd/dfc/tutorial_js_grabcut.html)
- [OpenCV.js contours](https://docs.opencv.org/master/d5/daa/tutorial_js_contours_begin.html)
- [MDN WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [WebKit: WebGPU in Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
