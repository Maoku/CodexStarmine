# 被写体・背景分離の精度向上 実装計画書

- 作成日: 2026-07-18
- ステータス: Phase 1〜3基盤とSlimSAM経路を実装済み・Phase 4/5評価継続
- 対象: CodexStarmine「画像から生成」のブラウザローカル処理
- 調査資料: [FOREGROUND_BACKGROUND_SEGMENTATION_ACCURACY_RESEARCH.md](FOREGROUND_BACKGROUND_SEGMENTATION_ACCURACY_RESEARCH.md)
- 現行機能計画: [POINT_GUIDED_IMAGE_TO_STARMINE_IMPLEMENTATION_PLAN.md](POINT_GUIDED_IMAGE_TO_STARMINE_IMPLEMENTATION_PLAN.md)

## 1. 結論

現行の点指定ダイアログ、Worker分離、順序付き輪郭、特徴点配分、確定時だけdraftへ反映する設計は維持する。その上で、被写体マスク生成を次の推奨構成へ段階的に置き換える。

1. 有効な透過alphaがある画像は、alphaを高信頼の初期マスクとして優先する。
2. RGB画像はSlimSAMを第一候補とし、最大辺1024pxの画像埋め込みを画像ごとに1回だけ計算する。
3. 正点、負点、任意の矩形から3候補を生成し、プロンプト充足、モデル品質、閾値安定性、矩形整合、境界整合、前回マスクとの連続性で候補を選ぶ。
4. 選択候補の確率マスクを二値化直前まで保持し、連結成分整理とエッジに沿う境界補正を行う。
5. 大域マスクで修正できない箇所だけ、原画像の局所クロップを512〜1024px相当で再推論して合成する。
6. 実行経路は `WebGPU → WASM → GrabCut → fast` の順に降格し、画像生成操作自体は失敗させない。
7. SlimSAMを既定経路へ昇格するかは、50枚評価、対象端末性能、オフライン再訪、メモリ解放の採用基準を満たした後に決定する。

保存形式は変更しない。元画像、矩形、指定点、確率マスク、モデル埋め込み、診断値はダイアログ内の一時データとし、確定後は従来どおり`ManualLayerPoint`だけを保存する。

## 2. 現行実装と今回の変更境界

### 2.1 維持する実装

- `GuidedImagePlacementDialog.ts`のモーダル所有権、フォーカストラップ、点入力、Undo、ズーム、パン、即時プレビュー。
- `ImagePromptSession.ts`の正規化座標、点種別上限、履歴、revision。
- `ImageSegmentationClient.ts`のWorker所有、requestId/revisionによる古い結果の破棄、取消、dispose。
- `GuidedImagePlacementRecipe.ts`の輪郭追跡、弧長配点、特徴点配分、安全半径0.94、最大240点。
- `IntegratedCraftEditor.ts`の確定時再検証、1回の`updateIntent()`、取消時のdraft不変、Undo/Redo。
- 通常の自動画像生成は最大辺256pxのままとし、モデル資産を通常起動時に取得しない。

### 2.2 置き換える実装

| 現状 | 変更後 |
| --- | --- |
| 点の1画素RGBを代表色にする | SlimSAMの意味的マスクを主経路にし、fastでは点周辺パッチを使う |
| 正点／負点だけ | 任意の被写体矩形を追加する |
| 単一の二値マスクを返す | モデル内部では3候補と確率マスクを保持する |
| 予測IoU相当の候補選択なし | 制約付きの純粋な候補選択関数を追加する |
| 点指定画像を最大辺512pxへ縮小 | SlimSAM入力は最大辺1024px、fast仮表示は256pxとする |
| 一律3×3 Opening/Closing | 正点、面積比、信頼度、細線幅に応じた適応処理へ変える |
| `navigator.gpu`相当の機能検出 | 実セッション作成とウォームアップ推論の成功でバックエンドを決める |
| `fallback`をプロバイダ名として扱う | 実プロバイダと降格理由を別の診断値として保持する |

### 2.3 対象外

- 保存後に元画像や指定点を再編集する機能。
- クラウドAPIへの画像送信。
- alpha matting、人物専用モデル、ドメイン別ファインチューニング。
- 自由線ブラシ。50枚評価で4操作以上を要する画像が多い場合の後続候補とする。
- SAM 2.1、MobileSAM、EdgeSAMの同時導入。SlimSAMが採用基準を満たさない場合だけ比較する。

## 3. 目標アーキテクチャ

```text
画像ファイル
  ↓ 1回デコード、総画素数上限24MP
有効alpha判定
  ├─ あり → alpha確率マスク → 適応的後処理
  └─ なし
       ├─ 256px fast仮マスクを即時表示
       └─ Workerへ画像を設定
            ↓
          SlimSAM初期化
            ├─ WebGPUセッション + ウォームアップ成功
            ├─ WASMセッション + ウォームアップ成功
            └─ 失敗 → GrabCut / fast
            ↓
          1024px画像埋め込みを1回計算・保持
            ↓
          正点 + 負点 + 任意の矩形
            ↓
          3候補の確率マスク + predicted IoU
            ↓
          純粋関数で候補採点・閾値選択
            ↓
          trimap + 境界補正 + 適応的成分整理
            ↓
          必要時だけ局所クロップ再推論・合成
            ↓
          二値SubjectMaskをメインスレッドへ転送
            ↓
          順序付き輪郭 → 弧長配点 → 特徴点配点 → 最大240星
```

### 3.1 実行責務

| 層 | 責務 |
| --- | --- |
| ダイアログ | 入力、矩形ドラッグ、点ドラッグ、即時表示、最新revisionだけの反映 |
| Client | Workerのライフサイクル、imageId/requestId/revision照合、降格通知 |
| Worker coordinator | バックエンド選択、画像埋め込みキャッシュ、プロバイダ切替、資源解放 |
| SlimSAM provider | 前処理、画像エンコード、3候補デコード。候補を勝手に1つへ絞らない |
| Candidate selector | 候補採点、閾値探索、前回結果との連続性。DOMやモデルへ依存しない純粋関数 |
| Mask postprocessor | prompt制約、連結成分、穴、細線、trimap、境界補正、局所合成 |
| Placement recipe | 最終二値マスクから輪郭と仮想星を決定的に生成 |

## 4. データ契約の変更

### 4.1 プロンプト

点の保存形式は維持し、矩形を点種別へ混ぜず、セッションに0個または1個の矩形を持たせる。

```ts
interface NormalizedImageRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface ImagePromptSessionState {
  prompts: ImagePrompt[];
  subjectBox?: NormalizedImageRect;
  history: ImagePromptSessionSnapshot[];
  revision: number;
}

type ImageInputMode = "box" | ImagePromptKind;
```

- 矩形は元画像基準の0〜1座標で保持する。
- 逆方向へドラッグした場合は`left <= right`、`top <= bottom`へ正規化する。
- 最小サイズ未満のドラッグはクリックとして確定せず取消す。
- `moveImagePrompt()`、`setSubjectBox()`、`clearSubjectBox()`もUndo履歴へ積み、revisionを増やす。
- `feature`は従来どおりモデルへ渡さない。

### 4.2 マスクと診断

最終配置が使う`SubjectMask`は二値のままにする。モデル出力と診断用に別型を追加する。

```ts
type SegmentationProvider = "alpha" | "slimsam" | "grabcut" | "fast";
type SegmentationExecutionBackend = "webgpu" | "wasm" | "cpu" | "none";

interface ProbabilityMask {
  data: Float32Array; // 0...1へ正規化済み
  width: number;
  height: number;
}

interface ModelMaskCandidate {
  index: number;
  probabilityMask: ProbabilityMask;
  predictedIoU?: number;
}

interface CandidateScore {
  index: number;
  promptViolationCount: number;
  stability: number;
  modelQuality: number;
  boxAlignment: number;
  boundaryAlignment: number;
  continuity: number;
  composite: number;
}

interface SegmentationDiagnostics {
  provider: SegmentationProvider;
  backend: SegmentationExecutionBackend;
  fallbackReason?: string;
  inputEdge: number;
  selectedCandidate?: number;
  selectedThreshold?: number;
  candidateScores: CandidateScore[];
  constraintRepairApplied: boolean;
  localRefinementCount: number;
  encodeDurationMs?: number;
  decodeDurationMs?: number;
  peakWorkingBytesEstimate?: number;
}
```

`GuidedPlacementDiagnostics`はこの診断の要約を持つ。`fallback`は実際のマスク生成方式ではないため、プロバイダ列挙値から外し、`fallbackReason`へ移す。診断値は保存JSONへ含めない。

### 4.3 プロバイダ契約

現在の同期`segment(image, prompts)`だけでは埋め込み再利用を表現できないため、Worker内の高精度プロバイダは状態を持つ非同期契約へ分離する。

```ts
interface PromptMaskProvider {
  readonly provider: SegmentationProvider;
  readonly backend: SegmentationExecutionBackend;
  initialize(): Promise<void>;
  setImage(image: SegmentationImageSource): Promise<ImageEmbeddingInfo>;
  decodeCandidates(input: ModelPromptInput): Promise<ModelMaskCandidate[]>;
  disposeImage(): void;
  dispose(): void;
}
```

`createFastPromptMask()`は同期の即時プレビューとして残す。alpha、fast、GrabCutを無理にSlimSAMと同じクラスへ詰めず、Worker coordinatorが共通の`SegmentationResult`へ正規化する。

### 4.4 Workerプロトコル

- すべての要求へ`imageId`を追加し、別画像の埋め込み混入を防ぐ。
- `initialize`応答で実際に利用できたprovider/backendとモデルバージョンを返す。
- `set-image`完了時に画像埋め込み完了を通知する。
- `segment`は正点、負点、矩形、前回マスクIDを受け取る。
- `segmentation`応答は選択済み確率マスク、最終二値マスク、診断をtransferableで返す。
- 3候補のFloat32ArrayはWorker外へ毎回転送せず、Worker内で採点する。テスト用provider契約では3候補を観察可能にする。
- 取消は推論そのものを必ず停止できるとは限らないため、requestId/imageId/revisionの不一致結果を破棄することを保証する。
- `dispose-image`と`dispose`を分け、画像変更時に埋め込み、Tensor、ImageBitmap、GPUBufferを解放する。

## 5. マスク候補の選択仕様

候補選択は`selectMaskCandidate()`として独立させ、固定画像と合成マスクでモデルなし単体テストを可能にする。

### 5.1 必須条件

1. 正点が二値マスク内にある。
2. 負点が二値マスク外にある。
3. マスクが空または画像全面ではない。
4. 矩形がある場合も矩形で単純に切り落とさず、矩形外への漏れを採点する。

候補ごとに0.45、0.50、0.55の3閾値をまず評価する。いずれかで全プロンプトを満たす候補を、満たさない候補より常に上位へ置く。全候補が違反する場合は違反数が最小の候補を仮選択し、後処理で正点／負点近傍を修復する。修復後も制約を満たせない結果は`ready`にせず、追加点または矩形修正を促す。

### 5.2 スコア

必須条件が同じ候補間では、初期値として次の合成スコアを使う。

```text
0.40 × modelQuality
+ 0.25 × stability
+ 0.15 × boundaryAlignment
+ 0.10 × boxAlignment
+ 0.10 × continuity
```

- `modelQuality`: predicted IoUを0〜1へ正規化する。値がないproviderでは0.5の中立値とする。
- `stability`: 0.45と0.55の二値マスク間IoU。面積差だけではなく形状差を含める。
- `boundaryAlignment`: マスク輪郭上のSobel勾配を画像内勾配分布で正規化した値。
- `boxAlignment`: 前景の矩形外比率を主に使い、矩形内を一定面積以上覆うことは強制しない。
- `continuity`: 追加操作前マスクとのIoUを基本にし、新規点近傍以外の大反転へ弱いペナルティを与える。

重みは設定オブジェクトへ集約し、50枚評価前にコード各所へ埋め込まない。面積は小さい被写体を排除しないよう、空・全面などの退化検出以外では強い固定制約にしない。

### 5.3 最終閾値

選択候補について0.35〜0.65を0.025刻みで探索し、次の辞書順で決定する。

1. 正点／負点違反が0。
2. 近傍閾値との安定性が高い。
3. 境界整合が高い。
4. 0.5に近い。

採用閾値と探索結果は診断へ残す。確率0.4〜0.6は不確実帯としてUIへ渡せるようにする。

## 6. 境界補正と局所再推論

### 6.1 適応的後処理

一律のOpeningを廃止し、次の順で処理する。

1. 選択閾値で仮二値化する。
2. 正点近傍を確定前景、負点近傍を確定背景として制約を修復する。
3. 正点を含む連結成分を必ず保持する。複数正点が別成分にあれば全成分を保持する。
4. 正点を含まない成分は面積比、平均確率、矩形との関係から除去する。
5. 穴は負点を含むものを必ず保持し、それ以外は面積比と周囲確率で判断する。
6. 幅1〜2pxの高信頼な細線をOpening対象から除外する。
7. 1〜2pxの切れ目だけをClosing候補とし、輪郭平滑化はポリライン側で行う。

alpha経路には原則として形態学的Openingを行わない。alphaの半透明値は確率として利用し、完全透明／不透明だけへ早期変換しない。

### 6.2 GrabCut境界補正

SlimSAMの意味的選択後、次のtrimapを初期値にしてGrabCutを3〜5回だけ実行する。

- 確率0.9以上、正点近傍: 確定前景。
- 確率0.1以下、負点近傍: 確定背景。
- 矩形外: 推定背景。画像端へ接する被写体を考慮し、無条件の確定背景にはしない。
- その他: 未確定。

補正前後でプロンプト違反が増えた、境界整合が低下した、または面積が過度に変化した場合は補正前へ戻す。OpenCV.jsはWorker内で遅延ロードし、SlimSAMと同様に同一オリジン配信する。

### 6.3 局所クロップ

次のいずれかに該当するときだけ局所再推論を行う。

- 追加した正点／負点が大域結果で制約違反または不確実帯に残る。
- 点近傍のBoundary F1相当の境界整合が低い。
- 候補安定性が設定した低信頼閾値を下回る。

修正点を中心に原画像から512〜1024px相当の正方形クロップを作り、モデル入力へ拡大する。大域マスク、矩形、クロップ内の点を局所座標へ変換し、局所確率マスクを境界フェザー付きで大域マスクへ合成する。1操作あたりの局所再推論は最大1回、1画像あたり最大3回とし、無限再試行を防ぐ。

## 7. 画像、モデル資産、キャッシュ

### 7.1 画像解像度

- ファイル上限20MB、デコード後24MP上限は維持する。
- fast仮マスクは最大辺256pxとし、クリック直後の表示に使う。
- SlimSAMの大域入力は最大辺1024pxとする。モデル標準のリサイズ、正規化、paddingを1か所へ集約する。
- 原画像座標は常に正規化座標で保持し、256px、1024px、局所クロップ、CSS表示の間で直接座標を使い回さない。
- 原画像ImageBitmapはWorkerが所有し、埋め込みと局所クロップの生成元にする。推定RGBAメモリが端末予算を超える場合は原画像を解放し、Blobから局所クロップだけ再デコードする省メモリ経路へ切り替える。
- 省メモリ時は大域入力を512pxへ落とせるが、UIと診断へ「省メモリ」を表示する。

### 7.2 モデル配布

初期採用候補は量子化SlimSAMの画像エンコーダーとデコーダーで、合計約13.8MBを想定する。実際に配布するファイルはPoCで確定する。

推奨配置:

```text
public/models/slimsam-77-uniform/<fixed-revision>/
  config.json
  preprocessor_config.json
  onnx/<pinned-encoder-file>.onnx
  onnx/<pinned-decoder-file>.onnx
  manifest.json
  LICENSE
```

- Hugging Faceの可変ブランチを実行時に参照しない。
- `manifest.json`へ元リポジトリ、固定revision、各ファイルのSHA-256、容量、ライセンスを記録する。
- ONNXファイル名は固定revisionに実在する名称をPhase 0で記録し、コード側へ推測した名称を埋め込まない。
- モデル取得スクリプトは固定revisionだけを取得し、ハッシュ不一致ならビルドを失敗させる。
- 本番ではモデル、WASM、設定をアプリと同一オリジンから配信する。
- `@huggingface/transformers`はWorker内で動的importし、通常起動バンドルから分離する。
- WebGPU用とWASM用に別モデルが必要な場合も、50枚評価で精度を個別に測る。

バイナリをGit LFSへ置くか、CIで固定ハッシュ取得するかはPoC完了時にリポジトリ運用と配布環境を確認して決める。実行時の外部取得は採用しない。

### 7.3 オフラインキャッシュ

- バージョン付きURLとTransformers.jsのBrowser Cacheを使い、Cache Storageへ固定版を保存する。
- モデル更新時はrevisionをURLへ含め、旧版と衝突させない。
- 初回取得途中の壊れたキャッシュを検出して再取得できるようにする。
- 2回目のオフライン起動でネットワーク要求なしに初期化と推論が成功することをブラウザテストする。
- Viteの`base: "./"`とサブパス配信の両方で、モデルとWASMのURL解決を確認する。

## 8. UI変更

### 8.1 矩形入力

点モードの先頭に「被写体を囲む」を追加する。初回利用時は矩形を推奨するが必須にはしない。

- ドラッグで作成し、四隅または辺をドラッグして修正できる。
- 矩形は1個だけとし、再作成で置換する。
- 矩形操作中はパンと競合しないよう、パンはSpaceキーまたは専用操作へ切り替える。
- 矩形、正点、負点、特徴点は同じUndo履歴で戻せる。
- キーボードでは照準位置を始点／終点として矩形を確定できる。

### 8.2 マスク表示

- fast仮マスクを同期表示し、SlimSAM結果到着時に同じオーバーレイを更新する。
- 確定前景は従来の半透明色、不確実帯は斜線または別の輪郭で表示する。
- マスク更新時も点、矩形、ズーム、パン位置を維持する。
- 点をドラッグして修正でき、pointerup時に1回だけrevisionを増やす。
- 古いrevisionの結果をDOMへ反映しない。

### 8.3 状態表示

ユーザー向け表示は内部ライブラリ名より意味を優先する。

| 内部状態 | 表示例 |
| --- | --- |
| fast仮表示 | 「高速プレビュー」 |
| SlimSAM WebGPU | 「高精度・GPU」 |
| SlimSAM WASM | 「高精度・互換」 |
| GrabCut | 「軽量補正」 |
| 省メモリ | 「省メモリで解析」 |
| 降格 | 「高精度処理を利用できないため軽量方式へ切替」 |

WebGPU/WASMの初期化中も点編集とfastプレビューを許可する。最終マスクが全プロンプト制約を満たし、8点以上を生成できたときだけ「配置」を有効にする。

## 9. フォールバック戦略

実行時は次の順で1段ずつ降格し、同じ失敗経路をループしない。

1. 有効alpha。RGB推論で品質を下げない。
2. SlimSAM WebGPU。セッション生成と小さなウォームアップ推論まで成功した場合だけ採用する。
3. SlimSAM WASM。量子化モデルの全演算子が実行できることを確認する。
4. GrabCut。矩形、正点、負点、パッチ標本を初期値にする。
5. 改良fast。5×5〜11×11パッチの中央値・分散、CIELAB距離、複数色クラスタ、エッジコストを使う。
6. 現行fast。最終保険として残す。

GPU device lost、モデル初期化失敗、unsupported operator、メモリ不足は回復可能エラーとする。Worker crash時は新しいWorkerを最大1回だけ生成し、WASMまたは軽量方式へ降格する。理由は診断へ残すが画像内容は外部へ送信しない。

## 10. ファイル変更計画

| ファイル | 変更内容 |
| --- | --- |
| `package.json` / `package-lock.json` | `@huggingface/transformers`、採用時のみOpenCV.js、評価用コマンドを追加 |
| `vite.config.ts` | Workerの動的chunk、モデル/WASMの同一オリジンURL、通常bundleとの分離を確認 |
| `public/models/**` | 固定モデル、設定、ハッシュmanifest、ライセンス |
| `public/wasm/**` | 必要なWASM実行資産を固定して自己ホスト |
| `src/ui/craft/GuidedImagePlacementTypes.ts` | 矩形、確率マスク、候補、backend、診断、Worker応答型 |
| `src/ui/craft/ImagePromptSession.ts` | 矩形、点ドラッグ、矩形ドラッグ、統合Undo/revision |
| `src/ui/craft/PromptMaskProvider.ts` | 現行fastを維持し、共通結果型へ合わせる |
| `src/ui/craft/SlimSamPromptMaskProvider.ts`（新規） | モデル初期化、前処理、埋め込み、3候補デコード、Tensor破棄 |
| `src/ui/craft/MaskCandidateSelector.ts`（新規） | 制約、安定性、境界、矩形、連続性の純粋な候補採点 |
| `src/ui/craft/SubjectMaskPostprocessor.ts`（新規） | 閾値探索、適応的成分整理、trimap、prompt制約 |
| `src/ui/craft/GrabCutMaskRefiner.ts`（新規） | Worker内の境界補正とモデルなしフォールバック |
| `src/ui/craft/LocalMaskRefiner.ts`（新規） | クロップ座標、局所推論、フェザー合成、回数上限 |
| `src/ui/craft/imageSegmentation.worker.ts` | coordinator、backend probe、画像埋め込みキャッシュ、降格、資源解放 |
| `src/ui/craft/ImageSegmentationClient.ts` | imageId、初期化状態、確率マスク転送、Worker再生成、降格通知 |
| `src/ui/craft/imagePixelLoader.ts` | 1024px入力、原画像所有権、fast用256px、メモリ予算 |
| `src/ui/craft/GuidedImagePlacementDialog.ts` | 矩形UI、点ドラッグ、不確実帯、backend/省メモリ表示 |
| `src/ui/craft/GuidedImagePlacementRecipe.ts` | 一律Opening/Closingを外し、後処理済み二値マスクを受け取る責務へ整理 |
| `src/style.css` | 矩形ハンドル、不確実帯、ドラッグ、各画面幅の表示 |
| `src/ui/craft/segmentationMetrics.ts`（新規） | IoU、Boundary F1、プロンプト違反、240点輪郭距離 |
| `test-assets/segmentation/**`（新規） | 50枚評価の画像、正解マスク、操作シナリオ、利用条件 |
| `Docs/IMAGE_TO_STARMINE.md` | 採用版、モデルhash、性能、品質、ブラウザ確認結果を記録 |

新規ファイル名は実装時に責務が重ならない範囲で調整してよい。ただし候補選択と後処理をWorker本体へ直接埋め込まず、純粋関数としてテスト可能にする。

## 11. 実装フェーズ

### Phase 0: 評価基盤とSlimSAM採否PoC（P0）

1. 50枚の正解マスク付き評価セットと利用条件を用意する。最初のPoCは代表10枚で開始し、採用判定は50枚で行う。
2. 現行fastについてMask IoU、Boundary F1、プロンプト違反、必要クリック数、240点化後輪郭距離を測る。
3. Worker内で量子化SlimSAMをWebGPU/WASMそれぞれ動かし、画像エンコード1回と複数回デコードを確認する。
4. 実配布ファイル、固定revision、SHA-256、ライセンス、容量を記録する。
5. コールド取得、ウォーム取得、画像エンコード、再クリック、ピークメモリ、dispose後メモリを対象端末で記録する。

完了条件:

- 代表10枚で正点／負点がマスクへ反映され、3候補とpredicted IoUを取得できる。
- 同一画像の2回目以降で画像エンコーダーが再実行されない。
- WebGPU失敗時にWASM、WASM失敗時に現行fastへ戻る。
- 実行時の画像外部送信が0件である。
- 50枚評価を再実行できるmanifestと指標コードがある。

### Phase 1: 契約と矩形UI（P0）

1. 矩形、確率マスク、候補、backend、診断、Workerプロトコルを型へ追加する。
2. `ImagePromptSession`へ矩形と点ドラッグを追加する。
3. ダイアログへ「被写体を囲む」、矩形修正、Undo、キーボード入力を追加する。
4. モデル未接続の状態でも矩形＋fast仮マスクで全UIを操作できるようにする。

完了条件:

- 矩形と点がCSSサイズ、ズーム、パン、devicePixelRatioによらず同じ元画像座標を指す。
- 点移動と矩形移動が1操作1履歴になり、古いrevisionを無効化する。
- 390×844、1280×720、1440×900で入力から取消／配置まで完了できる。

### Phase 2: SlimSAM Workerと候補選択（P0）

1. `SlimSamPromptMaskProvider`を実装し、モデルとWASMを自己ホストする。
2. Worker coordinatorでWebGPUセッションを実推論し、失敗時にWASMへ降格する。
3. 画像埋め込みをimageId単位で保持し、点／矩形変更時はデコーダーだけを実行する。
4. 3候補を`MaskCandidateSelector`で採点し、最終閾値を決める。
5. Clientへ選択確率マスク、二値マスク、診断を転送する。

完了条件:

- 連打、点移動、Undo後も最新imageId/revisionだけが表示される。
- 正点／負点違反がある結果で「配置」が有効にならない。
- WebGPUとWASMの候補選択が許容誤差内で同じ対象を選ぶ。
- ダイアログ終了後にTensor、ImageBitmap、Workerが破棄される。

### Phase 3: 確率マスクと適応的後処理（P1）

1. 0.35〜0.65の閾値探索と不確実帯を実装する。
2. 一律Opening/Closingを適応的な成分・穴・細線処理へ置き換える。
3. alphaを確率マスクとして扱い、高信頼alphaを保護する。
4. 境界整合を候補選択と後処理の回帰判定へ使う。
5. ダイアログへ不確実帯と低信頼表示を追加する。

完了条件:

- 正点成分と高信頼細線を形態学処理で消さない。
- 負点を含む領域が最終マスクへ残らない。
- 同一入力、同一backend、同一設定で輪郭と点順が決定的である。
- 240点化後にもMask/Boundary改善が残る。

### Phase 4: GrabCutと局所再推論（P1）

1. trimapからのGrabCut境界補正をWorkerへ遅延導入する。
2. 補正前後の制約、境界、面積を比較し、悪化時に戻す。
3. 低信頼点周辺の局所クロップ再推論とフェザー合成を実装する。
4. SlimSAMなしのGrabCut経路へパッチ標本、CIELAB、複数クラスタを接続する。
5. 原画像保持と省メモリ経路を対象モバイルで確認する。

完了条件:

- 局所補正が修正箇所以外の大域マスクを不必要に反転させない。
- GrabCutが悪化した場合に必ず補正前マスクへ戻る。
- WebGPU/WASM不可でも矩形＋正点／負点で生成を完了できる。
- メモリ不足時にクラッシュせず、省メモリまたはfastへ降格する。

### Phase 5: 50枚採用ゲートとロールアウト（P0/P1完了判定）

1. 50枚を`1正点`、`1正点+1負点`、`合計3点以内`、`矩形+2点以内`で評価する。
2. WebGPU、WASM、GrabCut、現行fastの品質と性能を同じ条件で比較する。
3. オフライン再訪、Worker crash、GPU device lost、キャッシュ破損、連続画像切替を試験する。
4. 対象ブラウザ、対象端末、画面寸法、キーボード操作を確認する。
5. 合格後に`auto`経路を既定にし、fast強制フラグを回帰調査用に残す。

SlimSAMが不合格の場合:

1. UI、Worker、候補選択、評価基盤は維持する。
2. MediaPipe Interactive SegmenterとEfficientSAMを同じ50枚条件で比較する。
3. どちらも端末条件を満たさない場合はGrabCut＋改良fastを正式経路とする。

## 12. テスト計画

### 12.1 単体テスト

| 対象 | 主なケース |
| --- | --- |
| Prompt session | 矩形作成・反転ドラッグ・移動・削除、点ドラッグ、統合Undo、revision |
| Candidate selector | 3候補、正点内包、負点除外、全候補違反、IoU同点、安定性、矩形外漏れ、前回連続性 |
| Threshold selector | 0.35〜0.65、制約優先、安定性同点、0.5優先 |
| Postprocessor | 複数正点成分、負点穴、細線、画像端、微小ノイズ、alpha、空／全面 |
| Local refinement | 座標変換、画像端クロップ、フェザー重複、回数上限、修正箇所以外不変 |
| Metrics | IoU、Boundary F1、制約違反、輪郭距離の既知形状 |
| Placement | 穴、複数成分、最大240点、安全半径、同一結果の決定性 |

### 12.2 Worker／Clientテスト

- initialize、set-image、embedding-ready、segment、disposeの順序。
- imageId/requestId/revisionのそれぞれが古い応答を破棄する。
- 同一画像でエンコード1回、デコード複数回。
- WebGPU初期化失敗、推論失敗、device lostからWASMへ1回だけ降格。
- WASM失敗からGrabCut/fastへ降格。
- Worker crash後の再生成上限と、同じ画像の資源混入防止。
- Float32Array、Uint8Array、ImageBitmapのtransferと破棄。
- モデル本体は通常のVitestでロードせず、偽providerを注入する。

### 12.3 実モデルテスト

- 固定画像と固定プロンプトで対象物を含むことを、IoUと制約で判定する。
- GPU差による浮動小数点差があるため、マスクのバイト完全一致を要求しない。
- モデル取得が必要なテストと、完全オフラインの単体テストをnpm scriptで分離する。
- 外部URLを許可せず、自己ホスト資産だけで実行する。

### 12.4 統合／アクセシビリティ

- 被写体点0件、制約違反、8点未満では配置不可。
- 矩形だけ、正点だけ、矩形＋正負点、特徴点追加の各フロー。
- 推論中の連打、点ドラッグ、Undo、画像切替、取消。
- 確定時のレイヤー削除／ロック／モード変更を拒否する。
- 取消と全エラーでdraftとUndo履歴が不変。
- 確定はUndo 1回、Redo 1回で往復する。
- Tab/Shift+Tab、Escape、矢印、Enter/Spaceだけで操作できる。
- 保存JSONへ画像、矩形、点、マスク、モデル診断が含まれない。

## 13. 採用基準

### 13.1 品質

- 難しい画像の80%以上が、矩形を含め合計3操作以内で意図したマスクになる。
- 現行fastと比べ、Mask IoU中央値とBoundary F1中央値がともに改善する。
- 最終マスクの正点／負点制約違反が0件である。
- 240点化後の輪郭距離も改善し、細部改善のために全体形状を悪化させない。
- 透過PNGは現行alpha経路と同等以上である。

### 13.2 性能と安定性

- 対象デスクトップのWebGPUで、埋め込み後のクリック更新が連続修正を妨げない。
- 対象モバイルのWASMまたは軽量経路で、クラッシュや長時間のUI停止がない。
- 具体的なp50/p95ミリ秒上限はPhase 0の対象端末ベースライン取得後に本節へ固定する。
- メインスレッドで50ms超の画像処理Long Taskを発生させない。
- 連続10画像の処理後、disposeによって次回処理へ持ち越す継続的なメモリ増加がない。
- 2回目のオフライン再訪でモデルを再取得しない。

### 13.3 製品要件

- 画像データを外部送信しない。
- モデル、WASM、設定、ライセンスを固定して同一オリジン配信する。
- 通常起動と画像生成未使用時にモデルコード・重みを取得しない。
- WebGPU/WASM/モデル失敗時も画像生成操作を完了できる。
- schema v4と既存の手動点編集、保存、Undo/Redoを維持する。
- lint、format check、全テスト、production buildが成功する。

## 14. ロールアウトと診断

実装中は内部設定`segmentationMode: "fast" | "auto"`を設け、既定を`fast`にする。Phase 5合格後だけ`auto`を既定へ変更する。URLまたは開発設定からfastを強制できるようにし、モデル回帰との比較を容易にする。

診断はダイアログ内または評価結果JSONへ限定し、画像内容や点座標を外部送信しない。最低限、次を記録する。

- モデルrevision、量子化形式、provider/backend。
- 入力解像度、候補スコア、閾値、降格理由。
- 取得、初期化、エンコード、デコード、後処理、局所補正の時間。
- 推定作業メモリ、局所補正回数、制約修復有無。
- 最終マスク指標と240点化後指標。

## 15. 主なリスクと対策

| リスク | 対策 |
| --- | --- |
| SlimSAMが対象画像で不足 | 50枚採用ゲートを先に作り、MediaPipe/EfficientSAMへ契約を保ったまま交換する |
| WebGPU対応表示でも演算子やdriverで失敗 | 実セッションとウォームアップで判定し、WASMへ一度だけ降格する |
| 1024pxと原画像保持でメモリ不足 | 24MP上限、作業メモリ見積り、512px省メモリ、Blob再クロップ、資源明示破棄 |
| 候補スコアの重みが過学習 | 50枚をカテゴリ分割し、重みを設定へ集約、カテゴリ別指標も確認する |
| GrabCutが良い意味マスクを壊す | 補正前後を採点し、悪化時は必ず戻す |
| 矩形とパン／点入力が競合 | 明示モード、Spaceパン、pointer capture、最小ドラッグ距離を設ける |
| 初回約13.8MB取得が長い | 1回目の正点／矩形後に遅延取得、fast即時表示、進捗、Cache Storage |
| モデル更新で結果が変化 | 固定revision、SHA-256 manifest、評価結果をモデル版ごとに保存 |
| 局所補正が大域マスクを反転 | クロップ回数上限、フェザー合成、修正点外の連続性評価 |
| 通常bundleが肥大化 | Worker内動的import、モデル/WASMを別資産にし、production buildでchunkを確認 |

## 16. 完了時の記録

実装完了時は本書と`IMAGE_TO_STARMINE.md`へ次を追記する。

1. 採用provider/backend、ライブラリ版、モデルrevision、量子化形式、各SHA-256、配布容量。
2. 50枚のカテゴリ別Mask IoU、Boundary F1、操作数、制約違反、240点輪郭距離。
3. 対象端末別のコールド取得、エンコード、再クリック、後処理、ピークメモリ。
4. WebGPU→WASM→GrabCut→fastの各障害試験結果。
5. オフライン再訪、ネットワーク送信、キャッシュ更新、CSPの確認結果。
6. 対象ブラウザ、画面寸法、キーボード、モバイル操作の確認結果。
7. lint、format check、全テスト、production buildの実行結果。

この記録とPhase 5の採用基準が揃うまでは、SlimSAMを本番の既定経路へ切り替えない。

## 17. 2026-07-18 実装記録

ユーザー判断によりSlimSAMを採用し、内部 `auto` 経路を既定に変更した。Phase 5完了前のため `?segmentation=fast` による強制比較経路を維持し、診断と50枚評価を継続する。

- `@huggingface/transformers` 3.8.1と `Xenova/slimsam-77-uniform` revision `5850ab45f587c112167512ffef949107115e26a0` を固定した。
- WebGPU用fp16とWASM用q8のONNX、Apache-2.0ライセンス、ONNX Runtime WASMを同一オリジン配信へ配置した。manifestは11資産の容量とSHA-256を保持し、取得時とbuild時に検証する。
- `SlimSamPromptMaskProvider` はモデル初期化、1024px画像埋め込み、点・矩形による3候補デコード、Tensor破棄を担当する。同一画像の点修正では画像エンコーダーを再実行しない。
- Worker coordinatorはalphaを先に判定し、RGB画像でWebGPU→WASM→fastを一方向に降格する。画像エンコード30秒、デコード15秒の上限を設け、遅いbackendで操作全体を停止させない。
- 候補選択、0.35〜0.65閾値探索、適応的連結成分整理、正点／負点修復、不確実帯表示、矩形・点ドラッグ・統合Undoを実装した。
- 実ブラウザでは自己ホスト資産だけでモデル初期化を開始し、検証環境のWebGPU/WASMが各30秒を超えた場合にfastへ復帰して240点を生成できた。console warning/errorは0件だった。
- 未完了: 50枚評価セットと実測、GrabCut、局所クロップ再推論、対象モバイル実機、オフライン再訪・GPU device lost・連続画像メモリ試験。
