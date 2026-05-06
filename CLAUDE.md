# Claude Code 作業メモ

## 🚨 重要: Docker環境での作業

**このプロジェクトは完全にDocker環境で動作しています。**
**すべての変更はDockerコンテナ内に反映させる必要があります。**

### 主要コンテナ
- `fz99-lounge-api`: NestJS API (localhost:3000)
- `fz99-lounge-web`: Next.js Web (localhost:3001)
- `fz99-lounge-db`: PostgreSQL (localhost:5432)
- `fz99-lounge-redis`: Redis (localhost:6379)

### エラー発生時の確認手順
1. **必ず最初に**: `docker logs fz99-lounge-api --tail 50` でAPIログを確認
2. **Webエラーの場合**: `docker logs fz99-lounge-web --tail 50`
3. **DB関連**: `docker exec fz99-lounge-db psql -U postgres -d fz99_lounge -c "\dt"`

## 📊 Prismaスキーマ変更時の手順

### `prisma db push` は禁止。必ず `prisma migrate dev` を使う

本番は `migrate deploy` でマイグレーションファイルを順に適用する。
`db push` はマイグレーションファイルを作らないため、ローカルでは動くが本番にデプロイすると反映されず500エラーになる。

schema.prisma を変更したら、**同じコミットに必ずマイグレーションファイルを含める**こと。
schema.prisma の変更だけがコミットされてマイグレーションが無い状態は禁止。

### 手順

```bash
# 1. schema.prisma を編集
# 2. マイグレーション作成（これがDBへの適用とファイル生成を同時にやる）
cd apps/api
npx prisma migrate dev --name <変更内容>
# 3. コンテナに反映
docker exec fz99-lounge-api npx prisma generate
docker restart fz99-lounge-api
# 4. schema.prisma とマイグレーションファイルを一緒にコミット
git add prisma/schema.prisma prisma/migrations/
```

### 本番/stg環境への適用
```bash
IMAGE_TAG=xxx docker compose -f compose.ecr.yaml --env-file .env.stg run --rm api npx prisma migrate deploy
```

### よくある問題
- **本番だけ500エラー**: マイグレーションファイルが無い可能性大。`prisma migrate status` で確認
- **"column does not exist"エラー**: コンテナ内のPrismaクライアントが古い → `prisma generate` + 再起動
- **Drift detected**: ローカルDBとマイグレーション履歴が不一致 → `prisma migrate resolve --applied <名前>` で解消

## 環境変数追加時

`compose.yaml`, `compose.ecr.yaml`, `compose.aws.yaml` すべてに追加すること。

## フロントエンドの開発方針

- Next.js App Router + TypeScript + shadcn/ui を前提とする
- UI は `components/ui` に一元管理する（Button / Card / Input / Dialog など）
- ページ側では Tailwind の className を書き散らさず、uiコンポーネント + `variant` / `size` で表現する
- バリエーションは必ず cva（class-variance-authority）で管理する
- 不要な wrapper コンポーネントを作らない（意味のあるものだけ作る）
- `use client` は最小限にし、Radix系コンポーネントなど「動きのあるUI」にだけ付ける
- ダークモードは ThemeProvider（next-themes） + `dark:` で制御する
- globals.css にはリセットとベーススタイル以外を極力書かない
- フォームは可能な限り react-hook-form + zod + shadcn Form で実装する
- **絵文字は基本的に使わない**。アイコンが必要な場合は `lucide-react` を使用する
- **翻訳**: next-intl使用。`messages/en.json`, `messages/ja.json` に追加し、`useTranslations`で参照。TSXに直接日本語を書かない


## 🧪 テスト実装の手順

テストを実装する際は、以下の手順を守ること:

1. **実装コードの確認**: テスト対象のメソッドを読み、実装内容を理解する
2. **ベストプラクティス確認**: トランザクションの必要性、クエリの最適化など、改善点がないか確認
3. **必要なら最適化**: 問題があれば実装コードを先に修正する
4. **1テストずつ実装**: 1回の実装では1つのテストケースのみ実装する
5. **ユーザーに説明**: 各テストケースが何をテストしているか説明する
6. **ユーザー確認**: 次のテストに進む前にユーザーの確認を得る
7. **テスト実行**: 実装後、必ずテストを実行して動作確認する

**例**:
- ❌ 一度に全7テストケースを実装
- ✅ 成功ケースを実装 → 説明 → 確認 → 次のエラーケースへ

## 🔧 パッケージ追加時の手順

### APIにパッケージを追加する場合:
```bash
# 1. ローカルでインストール
cd apps/api
npm install package-name

# 2. 【重要】コンテナ内にも反映
docker exec fz99-lounge-api npm install package-name

# 3. コンテナ再起動
docker restart fz99-lounge-api
```

### Webにパッケージを追加する場合:
```bash
# 1. ローカルでインストール
cd apps/web
npm install package-name

# 2. 【重要】コンテナ内にも反映
docker exec fz99-lounge-web npm install package-name

# 3. コンテナ再起動
docker restart fz99-lounge-web
```

## 🎮 レーティングシミュレーション

`simulations/` フォルダでPythonシミュレーションを実行する際は、**必ずvenvを有効化**すること:

```bash
cd simulations
source venv/bin/activate
python rating_simulator.py  # シミュレーション実行
python visualize.py         # グラフ生成
```

出力は全て `simulations/output/` に保存される。

## 📰 ニュース記事の執筆ルール

`apps/web/content/news/` の markdown 記事を書く・編集する際は以下を守ること。

### ファイル構成

- 1 記事につき **EN + JA 両方** を作成: `<slug>.en.md` / `<slug>.ja.md`
- 共有する frontmatter フィールド: `title`, `date` (ISO `yyyy-mm-dd`), `author`, `summary`, `cover` (任意)
- 画像は `apps/web/public/news/<slug>/` 配下に置き、`cover: "/news/<slug>/cover.jpg"` で参照

### スタイルルール

**ダッシュは使わない**
- em-dash (`—`) / en-dash (`–`) を使わない
- 区切りはピリオド・コンマで。数値範囲は「1 to 2 months」「2 or 3 skyways」のように語で
- 複合語 hyphen (`hard-fought`, `back-to-back`) は OK (ハイフンであってダッシュではない)

**括弧は避ける**
- 本文の `()` / `（）` 補足はなるべく使わない
- コンマ同格で `Mirror Ace, the seventh GP played, ...` のように対応するか、文構造の組み替えで対応
- markdown link 構文 `[text](url)` は対象外

**コロンも本文では避ける**
- `X: explanation of X` のような言い換え用のコロン (半角 `:` / 全角 `：`) は使わない
- "and"・"between"・"is/was" などで自然につなぐか、文を分ける
- frontmatter (`title:`, `date:`) や markdown link の `https:` 等の構文は対象外

**太字 (markdown `**...**`) は控えめに**
- 各選手の名前は **本文初登場時のみ太字**、以降はプレーン
- **リード文の太字ポリシーは記事タイプによって変える**:
  - 結果記事など地の文が長い記事: リード文は太字なし、本文で初登場時に太字
  - インタビューなど本文の大半が verbatim 引用 (blockquote) の記事: リード文での初登場太字を許容 (地の文が短いため、リードで紹介する役割が大きい)
- 順位表で 1 位の選手のみ太字でハイライト OK
- マシン名など注目要素を強調したいときは太字 OK
- 全選手・全登場を太字にすると読みづらくなるので避ける

**自己言及は簡潔に**
- `author` が `Nag` で、Nag 自身が大会参加者として登場する場合、自分のパフォーマンス描写は 1 文程度に圧縮
- ドラマチックな描写は他選手用に取っておく
- 順位表・グラフ・データ参照は普通に残してよい

**Verbatim 引用 (blockquote) は原文を変更しない**
- インタビュー記事などで `>` blockquote 内に置く本人の発言は、文法ミスや typo、二重スペースがあっても **修正しない**
- 例: `much much 99` (二重 much)、`the the process` (二重 the)、`ended  up` (2 スペース)、`What happened in the final King GP.` (`?` ではなく `.` で終わる) などは原文ママ
- ダッシュ・括弧・コロン禁止などの記事スタイルルールは、blockquote 内の verbatim 引用には適用しない (`(due to the meteor event)` のような括弧、`To name a few:` のようなコロンが原文に含まれていれば保持)
- 翻訳版 (例: JA) は読みやすさのため正書法を整えてもよい (verbatim 保持は原文側のみ)

**JA 本文では英単語・数字の前後に半角スペースを入れない**
- `150 ポイント` → `150ポイント`
- `Misa が` → `Misaが`
- `Mr. Angelo の` → `Mr. Angeloの`
- `8 GP` → `8GP`
- 英単語同士のスペースは保持: `Mirror Knight`, `Mr. Angelo`, `F-Zero 99` はそのまま
- frontmatter の YAML 構文 (`title:`, `date:`)、markdown link 構文、HTML 属性内のスペースは対象外

**JA は常体 (だ・である調) で統一**
- 「ですます」を本文で使わない
- 例: 「ご覧いただけます」→「確認できる」、「もらいました」→「もらった」、「~ました」→「~た」
- 体言止め (語尾を名詞や助詞で止める) はニュース記事の常套句として OK: 「全順位とGPごとの詳細は[大会ページ](...)から。」

**JA は日本語スポーツ記事の文体で書く**
- 英文の直訳調を避ける。原文のニュアンスを保ちつつ、日本のスポーツ記事として自然に読める表現に
- 直訳例 → 日本語スポーツ記事調:
  - `clinical precision` 「冷徹な精度で応えた」→ 「確実な走りで応えた」「○○ポイントを叩き出して応えた」(動作で語る)
  - `heroic run` 「英雄的な走り」→ 「圧巻の走り」
  - `reclaim the throne` 「玉座を奪還」→ 「首位を奪い返す」
  - `silver from the jaws of defeat` 「逃げ場のない場面から銀を掴み取った」→ 「終盤の猛追で銀メダルを掴み取った」
  - `marathon` (GP 制大会で) 「マラソンレース」→ 「長丁場」
  - `the result doesn't tell the whole story` 「結果は実際のドラマを語り尽くさない」→ より自然な表現か、不要なら削除
  - `emerged from the smoke` 「煙の中から立ち上がった」→ 「波乱を切り抜けた」(直訳の戦闘比喩は JA では不自然)

**選手・順位の呼称**
- 得点トップの選手たちを「リーダー」と書かない (チーム長の意味になりがち)。「上位2人」「先頭」「首位争い」を使う
- 「優勝候補のひとり」より「優勝候補の一角」が日本語スポーツ記事として自然
- 物理的な賞品は「トロフィー」、抽象的な championship は「優勝」「タイトル」と使い分け
  - 例: 「優勝のプレッシャー」(抽象) / 「トロフィーは Shiragi さんから発送される」(物理)

**JA 数字は Arabic に統一、GP 番号は「第N GP」表記**
- 漢数字 (一・二・三...) は使わず Arabic (1, 2, 3...) で統一。記事中の他の数字 (得点 944, 6628 等) と整合
- プレイ順を指すときは「Nつ目のGP」より「第N GP」(数字は Arabic)
  - 「2つ目のGP」→「第2GP」
  - 「8つ目の最終GP」→「最終GP」(8 は冗長なので略)

### 使える記法・埋め込み

- **GFM テーブル**: `remark-gfm` 有効。`| col | col |` 記法 OK
- **国旗インライン**: `<span class="fi fi-us" title="US"></span>` (flag-icons CSS は `app/layout.tsx` で global 読み込み済み)
- **YouTube 埋め込み**: `<div class="aspect-video w-full my-6 overflow-hidden rounded-lg"><iframe ... ></iframe></div>` を生 HTML で書く (`rehype-raw` 有効)
- **チャート埋め込み**: `<div data-chart="<id>"></div>` で `components/features/news/charts/index.ts` の registry を呼ぶ。新規チャートはコンポーネントを作って ID 登録するだけ

### 翻訳・i18n

- `messages/en.json` / `messages/ja.json` の `news` namespace で section title 等を管理
- 記事用に新たに翻訳キーが必要な場合 (例: チャートタイトル) は両ファイルに追加
- TSX には直接日本語を書かない (CLAUDE.md フロントエンド方針と同じ)

## 📚 参考リンク

- [Prisma: Prototyping your schema](https://www.prisma.io/docs/orm/prisma-migrate/workflows/prototyping-your-schema)
- [Prisma: Development and production](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production)
- [Stack Overflow: db push vs migrate dev](https://stackoverflow.com/questions/68539836/difference-between-prisma-db-push-and-prisma-migrate-dev)
