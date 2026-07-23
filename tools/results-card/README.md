# 大会結果カード ジェネレーター

大会結果のシェア用画像 (1200x675 / X カードサイズ) を生成するツール。

## 使い方

```bash
tools/results-card/render.sh lounge-masters-2.html
# → output/lounge-masters-2.png (1200x675)
# → output/lounge-masters-2@2x.png (2400x1350)
```

要件はローカルの `google-chrome` と ImageMagick (`convert`) のみ。Docker不要。

## 新しい大会のカードを作る

1. 既存のHTML (例: `lounge-masters-2.html`) をコピー
2. ファイル先頭の `CONFIG` オブジェクトだけ書き換える
   - タイトル・ラウンド表記・サブタイトル
   - `top3` / `rest` の順位表 (国コードは `assets/flags/` のSVG名)
   - `chart` のバンプチャート (GPごとの総合順位)。順位データはdev DBから取れる:
     `games` (leagueTypeでGP特定) → `game_participants.totalScore` を累積して順位化
   - `stats` の統計チップ3つ
3. `./render.sh <新ファイル>.html`

CONFIG以下のコード (背景・チャート描画) は編集不要。

## デザイン

シンセウェーブ×エスポーツ放送グラフィック調。フォントは Saira Condensed / Chakra Petch
(latin woff2 を `assets/fonts/` に同梱、日本語は Noto Sans CJK JP を使用)。
`SairaCondensedTab-*.woff2` は Saira Condensed の数字を等幅化した自作派生フォント
(fontTools で数字の送り幅を統一・中央寄せ)。ポイント列の桁揃えに使う。
国旗SVGは `flag-icons` から `assets/flags/` にコピーして使う。
足りない国旗は `apps/web/node_modules/flag-icons/flags/4x3/` からコピーする。
