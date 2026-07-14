# Codex Starmine

自分でデザインした打ち上げ花火を、湖畔の夜景で鑑賞するブラウザシミュレーションです。

## 開発

```bash
npm install
npm run dev
```

品質確認:

```bash
npm run lint
npm run test:run
npm run build
```

設計とフェーズごとの実装範囲は
[`Docs/IMPLEMENTATION_PLAN.md`](Docs/IMPLEMENTATION_PLAN.md) を参照してください。

## 構成

- `src/core`: レンダリング非依存のシミュレーション
- `src/render`: three.js のシーンと描画効果
- `src/audio`: 効果音と音楽解析
- `src/data`: データモデル、プリセット、永続化
- `src/modes`: 製作・フリー鑑賞・音楽連動モード
- `src/ui`: UI コンポーネント
