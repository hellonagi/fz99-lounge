#!/usr/bin/env bash
# 結果カードHTMLをPNGに書き出す
# 使い方: ./render.sh lounge-masters-2.html
# 出力: output/<name>.png (1200x675) と output/<name>@2x.png (2400x1350)
set -euo pipefail
cd "$(dirname "$0")"

HTML="${1:?usage: ./render.sh <file>.html}"
NAME="$(basename "$HTML" .html)"
URL="file://$(pwd)/$HTML"
CHROME="${CHROME:-google-chrome}"
W=1200 H=675
mkdir -p output

# --window-size はブラウザUI分を含むため縦に余裕を持たせ、カード寸法にクロップする
common=(--headless=new --disable-gpu --hide-scrollbars --window-size=$W,$((H + 150)) --virtual-time-budget=3000)

"$CHROME" "${common[@]}" --screenshot="output/$NAME.png" "$URL" 2>/dev/null
convert "output/$NAME.png" -crop "${W}x${H}+0+0" +repage "output/$NAME.png"

"$CHROME" "${common[@]}" --force-device-scale-factor=2 --screenshot="output/$NAME@2x.png" "$URL" 2>/dev/null
convert "output/$NAME@2x.png" -crop "$((W * 2))x$((H * 2))+0+0" +repage "output/$NAME@2x.png"

echo "wrote output/$NAME.png and output/$NAME@2x.png"
