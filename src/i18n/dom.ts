import type { Locale } from "./locale";

/*
 * The editor is deliberately built from small DOM-producing TypeScript modules.
 * Localizing at the DOM boundary keeps existing saved user strings out of the
 * translation resources while every visible and accessible UI string can share
 * the active locale. New UI should prefer resource-backed markup; this adapter
 * also covers the established editor modules during that migration.
 */
const ENGLISH: Record<string, string> = {
  編集パネル: "Editor panels",
  レイヤーと星: "Layers & stars",
  設定と確認: "Settings & check",
  パネルを閉じる: "Close panel",
  閉じる: "Close",
  レイヤーと仮想星: "Layers and virtual stars",
  作品と配置の設定: "Work and placement settings",
  レイヤー: "Layers",
  既定: "Preset",
  層: "layers",
  仮想星の部品皿: "Virtual star library",
  長押しで確認: "Long-press to preview",
  広がりを見る: "Preview burst",
  仮想星プレビューを閉じる: "Close virtual-star preview",
  挙動サンプル: "Behavior sample",
  簡易表示: "Fallback preview",
  色段階: "Color stages",
  段階変色: "Step color change",
  反復変色: "Looping color change",
  往復変色: "Ping-pong color change",
  光露: "Afterglow",
  輝: "Terminal flash",
  葉落: "Falling leaf",
  遊泳: "Wander",
  旋回: "Spiral",
  終端火花: "Terminal sparks",
  小分裂: "Micro burst",
  最初から: "Restart",
  "挙動サンプル。完成形は打上結果プレビューで確認":
    "Behavior sample. Check the launch preview for the complete design.",
  尾を引く: "Trailing",
  粒で広がる: "Particle burst",
  選択レイヤー: "Selected layer",
  レイヤー名: "Layer name",
  レイヤーを選択: "Select a layer",
  未選択: "None selected",
  ロック中: "Locked",
  "左の一覧からレイヤーを選んでください。":
    "Select a layer from the list on the left.",
  既定の仮想星: "Default virtual star",
  発光タイミング: "Light timing",
  光る順番: "Light order",
  同時: "Simultaneous",
  配置順: "Placement order",
  横方向: "Horizontal",
  縦方向: "Vertical",
  中心から外: "Center outward",
  ランダム: "Random",
  グループ: "Group",
  向き: "Direction",
  順方向: "Forward",
  逆方向: "Reverse",
  広がり: "Spread",
  周回数: "Cycles",
  選択点の光る位置: "Selected point timing",
  仮想星の効果を編集: "Edit virtual-star effects",
  作品内へ複製: "Duplicate in this design",
  名称: "Name",
  色の変わり方: "Color transition",
  滑らか: "Smooth",
  瞬時: "Instant",
  色の再生: "Color playback",
  "1回": "Once",
  繰り返し: "Loop",
  往復: "Ping-pong",
  色の反復: "Color repeats",
  発光: "Light",
  なし: "None",
  周期点滅: "Periodic strobe",
  点滅速度: "Strobe speed",
  点灯時間: "On time",
  消え際: "Ending",
  動きと終端: "Motion & ending",
  動き: "Motion",
  弾道: "Ballistic",
  動きの幅: "Motion range",
  終端: "Ending effect",
  火花: "Sparks",
  終端の粒数: "Ending particles",
  尾と煙: "Trail & smoke",
  尾の表現: "Trail style",
  連続: "Continuous",
  尾だけ点滅: "Trail-only strobe",
  粒状: "Granular",
  尾の点滅速度: "Trail strobe speed",
  粒の間隔: "Grain spacing",
  尾の太さ: "Trail width",
  煙の量: "Smoke amount",
  既定配置: "Preset layout",
  外周: "Outer ring",
  芯: "Core",
  子花: "Child burst",
  枝: "Branches",
  枝数: "Branch count",
  子花数: "Child-burst count",
  仮想星数: "Virtual stars",
  玉内の半径: "Shell radius",
  大きさ: "Size",
  点の密度: "Point density",
  回転: "Rotation",
  "型物の生成点は個別編集できません。断面は中央のワークベンチで選びます。":
    "Pattern points cannot be edited individually. Choose the slice in the central workbench.",
  "手動レイヤーでは、表示中の断面上にある仮想星を1点ずつ編集できます。":
    "In a manual layer, you can edit virtual stars on the displayed slice one point at a time.",
  "＋ 既定": "+ Preset",
  "＋ 型物": "+ Pattern",
  "＋ 手動": "+ Manual",
  既定レイヤーの種類: "Preset layer type",
  選択レイヤーを複製: "Duplicate selected layer",
  削除: "Delete",
  型物: "Pattern",
  手動: "Manual",
  球面: "Spherical",
  枝状: "Branch",
  点光: "Point",
  点滅: "Flicker",
  尾あり: "With trail",
  打上結果プレビュー: "Launch preview",
  "固定 seed": "Fixed seed",
  縮小: "Collapse",
  展開: "Expand",
  一時停止: "Pause",
  再生: "Play",
  先頭へ: "Restart",
  負荷: "Load",
  良好: "Good",
  注意: "Warning",
  超過: "Over limit",
  自動簡略化: "Auto simplify",
  保存して棚へ: "Save to shelf",
  未保存: "Unsaved",
  保存済み: "Saved",
  湖面で確認: "Check on lake",
  操作面を選択: "Choose a working plane",
  面位置: "Slice position",
  表示: "View",
  便利な配置: "Placement tools",
  形状: "Shape",
  生成方法: "Apply method",
  置換: "Replace",
  追加: "Append",
  選択点を削除: "Delete selected point",
  操作面と表示倍率: "Working plane and zoom",
  既定の目標点数: "Default target point count",
  "画像を選ぶと、被写体・特徴・背景の点指定画面が開きます。":
    "Choose an image to open subject, feature, and background prompts.",
  個数: "Count",
  半径: "Radius",
  長さ: "Length",
  角度: "Angle",
  開始角: "Start angle",
  終了角: "End angle",
  行: "Rows",
  列: "Columns",
  間隔: "Spacing",
  生成: "Generate",
  "1点": "Point",
  円周: "Circle",
  直線: "Line",
  円弧: "Arc",
  格子: "Grid",
  画像から生成: "Generate from image",
  "点指定中…": "Choosing points…",
  入力方法: "Input method",
  配置範囲: "Placement range",
  輪郭のみ: "Outline only",
  "輪郭＋内部境界": "Outline + internal boundaries",
  "輪郭＋内部境界＋内部": "Outline + internal boundaries + fill",
  目標点数: "Target point count",
  仮配置点の凡例: "Placement point legend",
  "内部・特徴の仮想星": "Virtual star for interior and features",
  単色星: "Solid star",
  変化星: "Color-changing star",
  引星: "Trailing star",
  輪郭の仮想星色: "Outline virtual-star color",
  画像から仮想星を作る: "Create virtual stars from an image",
  画像と生成プレビュー: "Image and placement preview",
  プレビュー操作: "Preview controls",
  被写体: "Subject",
  背景: "Background",
  特徴: "Feature",
  被写体を囲む: "Outline subject",
  拡大: "Zoom in",
  型物レイヤーを選択: "Select a pattern layer",
  型物配置ツール: "Pattern placement tools",
  選択: "Select",
  ペン: "Pen",
  円: "Circle",
  曲線: "Curve",
  ハート: "Heart",
  円形: "Circle",
  笑顔: "Smile",
  プリセット視点: "Camera preset",
  元の位置に戻る: "Reset position",
  視点を動かす: "Move camera",
  確認: "Check",
  フリー鑑賞: "Free viewing",
  折りたたむ: "Collapse",
  パネルを開く: "Open panel",
  一発を確かめる: "Check one launch",
  確認中の作品: "Work being checked",
  単発ループ: "Single-launch loop",
  湖畔に委ねる: "Leave it to the lakeside",
  演出密度: "Show density",
  静か: "Quiet",
  標準: "Standard",
  華やか: "Vibrant",
  打上中の玉: "Launching shell",
  編集に戻る: "Back to editor",
  モード選択: "Mode selection",
  打上準備中: "Preparing launch",
  打上中: "Launching",
  一時停止中: "Paused",
  待機中: "Waiting",
  確認を再開: "Resume check",
  もう一度発射: "Launch again",
  演目を再開: "Resume show",
  実距離: "Physical",
  演出寄り: "Cinematic",
  即時: "Immediate",
  このレイヤーはパラメーターで編集します:
    "This layer is edited with its parameters.",
  玉内配置ワークベンチ: "Shell layout workbench",
  選択中の切断面と全レイヤーの参照点:
    "Selected slice and reference points for all layers",
  "生成点は参照表示です。右のパラメーターで調整してください。":
    "Generated points are reference-only. Adjust them with the parameters on the right.",
  "断面円を押して1点追加。現在断面の点だけ移動できます。":
    "Click the slice circle to add one point. Only points on the current slice can be moved.",
  "画像上で被写体・特徴・除外背景を指定し、確認後に現在断面へ配置します。":
    "Choose subject, feature, and excluded background on the image, then place the result on the current slice.",
  "現在断面へ等間隔配置し、その後は各点を編集できます。":
    "Place evenly on the current slice, then edit individual points.",
  "形状は上のボタン、サイズ・密度・回転は右のパラメーターで調整します。":
    "Choose the shape above; adjust size, density, and rotation with the parameters on the right.",
  操作面の位置: "Working plane position",
  玉の表示倍率: "Shell zoom",
  描画負荷: "Rendering load",
  状態: "Status",
  最大粒子: "Maximum particles",
  "保存して棚へ（未保存の変更あり）": "Save to shelf (unsaved changes)",
  "保存して棚へ（保存済み）": "Save to shelf (saved)",
  被写体の範囲: "Subject area",
  被写体の範囲を削除: "Remove subject area",
  "画像解析: 準備中": "Image analysis: preparing",
  "画像解析: アルファ / モデル不使用": "Image analysis: alpha / no model",
  "画像解析: SlimSAM / 準備中": "Image analysis: SlimSAM / preparing",
  "画像解析: SlimSAM / CPU": "Image analysis: SlimSAM / CPU",
  "画像解析: GrabCut / CPU": "Image analysis: GrabCut / CPU",
  "画像解析: 高速方式 / CPU": "Image analysis: fast method / CPU",
  "軽量方式へ切り替えました。必要なら特徴・背景を追加できます。":
    "Switched to the lightweight method. Add feature or background prompts if needed.",
  被写体を囲むか点を指定してください: "Outline the subject or add a point.",
  "画像を高精度解析中…": "Analyzing image with the high-accuracy model…",
  "被写体マスクを更新中…": "Updating subject mask…",
  "画像を読み込めませんでした。": "Could not load the image.",
  "被写体の範囲を削除しました。": "Removed the subject area.",
  "点を削除しました。": "Removed point.",
  "1つ戻しました。": "Undid one step.",
  "選択点を削除しました。": "Deleted selected point.",
  "すべての指定を消しました。": "Cleared all prompts.",
  "矩形の入力を取り消しました。": "Cancelled rectangle input.",
  "矩形の始点を指定しました。照準を終点へ動かして確定してください。":
    "Set the rectangle start. Move the crosshair to the end and confirm.",
  "点を移動しました。": "Moved point.",
  "矩形はドラッグして指定してください。": "Drag to set the rectangle.",
  "被写体の範囲は8px以上の大きさで指定してください。":
    "Make the subject area at least 8 px wide and high.",
  "被写体の範囲を更新しました。": "Updated subject area.",
  "高精度処理を利用できないため、軽量方式へ切り替えました。":
    "High-accuracy processing is unavailable; switched to the lightweight method.",
  "画像を8色へ整理中…": "Reducing image to 8 colors…",
  "内部境界を検出中…": "Detecting internal boundaries…",
  "仮想星を配置中…": "Placing virtual stars…",
  "指定が競合しています。点または範囲を修正してください":
    "Your prompts conflict. Adjust a point or area.",
  "画像を解析できません。取消して別の画像を選んでください。":
    "The image cannot be analyzed. Cancel and choose another image.",
  "被写体の範囲または正点を待っています。":
    "Waiting for a subject area or positive point.",
  画像から被写体を検出できませんでした:
    "Could not detect a subject in the image.",
  画像の読み込みに失敗しました: "Failed to load image.",
  手動レイヤーを選んでください: "Select a manual layer.",
  レイヤーのロックを解除してください: "Unlock the layer first.",
  外周レイヤーは残してください: "Keep the outer-ring layer.",
  "実行上限を超えています。自動簡略化してください":
    "The execution limit is exceeded. Use Auto simplify.",
  "実行上限を超えています。先に自動簡略化してください":
    "The execution limit is exceeded. Use Auto simplify first.",
  未保存の変更があります: "You have unsaved changes.",
  "まず、左側の「＋ 既定」「＋ 型物」「＋ 手動」からレイヤーを追加してください":
    'First, add a layer with "+ Default", "+ Pattern", or "+ Manual" on the left.',
  "仮想星の部品皿から、このレイヤーで使う仮想星を選択してください":
    "Choose the virtual star for this layer from the virtual-star tray.",
  "仮想星を選択しました。配置パラメータを設定し、X・Y・Zから操作面を選んでください":
    "Virtual star selected. Set its placement parameters, then choose the X, Y, or Z working plane.",
  "仮想星を選択しました。形状や密度を設定し、X・Y・Zから操作面を選んでください":
    "Virtual star selected. Set its shape and density, then choose the X, Y, or Z working plane.",
  "仮想星を選択しました。右側で星数・半径などのパラメータを設定してください":
    "Virtual star selected. Set parameters such as star count and radius on the right.",
  レイヤーを選ぶと設定を編集できます: "Select a layer to edit its settings.",
  "操作面を押して点を追加し、既存点はドラッグできます":
    "Click the working plane to add points; drag existing points to move them.",
  "形状と操作面を選び、右側で整えます":
    "Choose a shape and working plane, then refine it on the right.",
  右側の設定で星数と半径を整えます:
    "Use the settings on the right to refine star count and radius.",
  選択中の切断面を更新しました: "Updated selected slice.",
  選択した配置点の仮想星を変更しました:
    "Changed the virtual star for the selected point.",
  選択レイヤーの仮想星を変更しました:
    "Changed the virtual star for the selected layer.",
  層構成を保ったまま星数を簡略化しました:
    "Simplified the star count while preserving the layer structure.",
  画像から仮想星を生成: "Generate virtual stars from image",
  演目を準備しています: "Preparing the show",
  演目を終了しました: "The show has ended",
  湖畔の演目: "Lakeside show",
  湖畔の序章: "Lakeside prelude",
  風渡る彩霞: "Windborne color haze",
  星屑の水鏡: "Starlight on the water",
  錦秋の余韻: "Autumnal afterglow",
  "導入 · テーマ色を提示": "Opening · introducing the theme colors",
  "展開 · 左右へ広がる連続打上":
    "Development · launches spreading left and right",
  "間 · 煙と残光を鑑賞": "Interlude · smoke and afterglow",
  "終幕 · スターマイン": "Finale · starmine",
  "余韻 · 次の演目へ": "Afterglow · moving to the next show",
  余韻を残して一時停止中: "Paused with afterglow remaining",
  編集中の花火: "Firework being edited",
};

const DYNAMIC_REPLACERS: readonly [(value: string) => string][] = [
  [(value) => value.replace(/(\d[\d,]*)点/g, "$1 points")],
  [(value) => value.replace(/(\d[\d,]*)発/g, "$1 launches")],
  [(value) => value.replace(/(\d[\d,]*)星/g, "$1 stars")],
  [(value) => value.replace(/(\d[\d,]*)秒/g, "$1 sec")],
  [(value) => value.replace(/(\d[\d,]*)個/g, "$1 items")],
  [(value) => value.replace(/(\d[\d,]*)本/g, "$1 branches")],
  [(value) => value.replace(/(\d+(?:\.\d+)?)Hz点滅/g, "$1 Hz strobe")],
  [(value) => value.replace(/(\d+)パーセント/g, "$1 percent")],
  [(value) => value.replace(/^良好 ·/, "Good ·")],
  [(value) => value.replace(/^注意 ·/, "Warning ·")],
  [(value) => value.replace(/^超過 ·/, "Over limit ·")],
  [
    (value) =>
      value.replace(
        /^([XYZ])軸に直交する([XYZ]{2})面$/,
        "$1 axis normal to $2 plane",
      ),
  ],
  [
    (value) =>
      value.replace(
        /^([XYZ]{2}) · (手前|中央|奥) (\d+ \/ 5)$/,
        (_match, plane, depth, index) =>
          `${plane} · ${({ 手前: "front", 中央: "center", 奥: "back" } as Record<string, string>)[depth]} · ${index}`,
      ),
  ],
  [
    (value) =>
      value.replace(
        /^([XYZ]{2})面 (手前|中央|奥) (\d+ \/ 5)$/,
        (_match, plane, depth, index) =>
          `${plane} plane · ${({ 手前: "front", 中央: "center", 奥: "back" } as Record<string, string>)[depth]} · ${index}`,
      ),
  ],
  [(value) => value.replace(/^(\d+) 層$/, "$1 layers")],
  [
    (value) =>
      value.replace(
        /^画像から(\d+)点を配置しました$/,
        "Placed $1 points from image.",
      ),
  ],
  [(value) => value.replace(/^(\d+)点を生成しました$/, "Generated $1 points.")],
  [
    (value) =>
      value.replace(
        /^(\d[\d,]*) starsの打上結果プレビュー$/,
        "$1-star launch preview",
      ),
  ],
  [
    (value) =>
      value.replace(
        /^描画負荷 (良好|注意|超過): 最大粒子 (.+)$/,
        (_match, level, particles) =>
          `Rendering load ${({ 良好: "good", 注意: "warning", 超過: "over limit" } as Record<string, string>)[level]}: maximum particles ${particles}`,
      ),
  ],
  [(value) => value.replace(/^(\d+) \/ (\d+) stars$/, "$1 / $2 stars")],
  [(value) => value.replace(/(.+)を配置$/, "Assign $1")],
  [(value) => value.replace(/(.+)の広がりを見る$/, "Preview $1 burst")],
  [(value) => value.replace(/(.+)を編集$/, "Edit $1")],
  [(value) => value.replace(/(.+)を削除$/, "Delete $1")],
  [(value) => value.replace(/(.+)を非表示にする$/, "Hide $1")],
  [(value) => value.replace(/(.+)を表示する$/, "Show $1")],
  [(value) => value.replace(/(.+)を上へ移動$/, "Move $1 up")],
  [(value) => value.replace(/(.+)を下へ移動$/, "Move $1 down")],
  [(value) => value.replace(/(.+)のロックを有効化$/, "Enable lock for $1")],
  [(value) => value.replace(/(.+)のロックを解除$/, "Unlock $1")],
];

const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();

const BUILTIN_STAR_NAMES: Readonly<Record<string, [string, string]>> = {
  "star-solid-red": ["赤の単色星", "Solid red star"],
  "star-change-blue": ["青から銀の変化星", "Blue-to-silver changing star"],
  "star-charcoal": ["炭火引・赤から銀", "Charcoal trail · red to silver"],
  "star-gold": ["金引星", "Gold trailing star"],
  "star-silver": ["銀引星", "Silver trailing star"],
  "star-flicker": ["白銀の点滅星", "Silver-white flicker star"],
  "star-long": ["長寿命の冠星", "Long-lasting crown star"],
  "star-child": ["時間差の子花星", "Delayed child-burst star"],
  "star-strobe-white-hard": ["強白点滅星", "Hard white strobe star"],
  "star-strobe-pastel": ["彩色パステル点滅星", "Pastel color strobe star"],
  "star-kouro": ["銀光露星", "Silver afterglow star"],
  "star-teka": ["白銀輝星", "Silver terminal-flash star"],
  "star-repeat-change": ["紅青反復変化星", "Red-blue repeating star"],
  "star-relay-light": ["時差リレー星", "Relay light star"],
  "star-gradient-fade": ["流光グラデーション星", "Flowing gradient star"],
  "star-strobe-leaf": ["点滅葉落星", "Strobing falling-leaf star"],
  "star-popping": ["はじけ子花星", "Popping child-spark star"],
};

export function translateText(value: string): string {
  const trimmed = value.trim();
  const direct = ENGLISH[trimmed];
  if (direct) return value.replace(trimmed, direct);
  return DYNAMIC_REPLACERS.reduce((next, [replace]) => replace(next), value);
}

function translateCatalogText(value: string, element: Element): string {
  const option =
    element instanceof HTMLOptionElement ? element : element.closest("option");
  const starId =
    option?.value ??
    element.closest<HTMLElement>("[data-star-part]")?.dataset.starPart;
  const star = starId ? BUILTIN_STAR_NAMES[starId] : undefined;
  return star ? value.replaceAll(star[0], star[1]) : value;
}

function shouldSkip(element: Element | null): boolean {
  return Boolean(
    element?.closest(
      "[data-i18n-skip], input, textarea, option[data-user-value]",
    ),
  );
}

function shouldSkipAttribute(element: Element): boolean {
  return Boolean(element.closest("[data-i18n-skip]"));
}

export function localizeDOM(root: ParentNode, locale: Locale): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) textNodes.push(node as Text);
  textNodes.forEach((text) => {
    if (shouldSkip(text.parentElement)) return;
    if (locale === "ja") {
      const original = originalText.get(text);
      if (original !== undefined) text.data = original;
      return;
    }
    if (!originalText.has(text)) originalText.set(text, text.data);
    const translated = translateCatalogText(
      translateText(originalText.get(text) ?? text.data),
      text.parentElement ?? document.body,
    );
    if (translated !== text.data) text.data = translated;
  });
  root
    .querySelectorAll?.(
      "[aria-label], [aria-valuetext], [placeholder], [title]",
    )
    .forEach((element) => {
      if (shouldSkipAttribute(element)) return;
      ["aria-label", "aria-valuetext", "placeholder", "title"].forEach(
        (attribute) => {
          const value = element.getAttribute(attribute);
          if (!value) return;
          const originals =
            originalAttributes.get(element) ?? new Map<string, string>();
          if (!originalAttributes.has(element))
            originalAttributes.set(element, originals);
          if (locale === "ja") {
            const original = originals.get(attribute);
            if (original !== undefined)
              element.setAttribute(attribute, original);
            return;
          }
          if (!originals.has(attribute)) originals.set(attribute, value);
          const translated = translateCatalogText(
            translateText(originals.get(attribute) ?? value),
            element,
          );
          if (translated !== value) element.setAttribute(attribute, translated);
        },
      );
    });
}

export function installDOMLocalizer(
  root: HTMLElement,
  getLocale: () => Locale,
): () => void {
  const observer = new MutationObserver((records) => {
    if (getLocale() !== "en") return;
    records.forEach((record) => {
      if (record.type === "characterData")
        localizeDOM(record.target.parentNode ?? root, "en");
      record.addedNodes.forEach((node) => {
        if (node instanceof Element || node instanceof DocumentFragment)
          localizeDOM(node, "en");
      });
    });
  });
  observer.observe(root, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  localizeDOM(root, getLocale());
  return () => observer.disconnect();
}
