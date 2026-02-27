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

## 📚 参考リンク

- [Prisma: Prototyping your schema](https://www.prisma.io/docs/orm/prisma-migrate/workflows/prototyping-your-schema)
- [Prisma: Development and production](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production)
- [Stack Overflow: db push vs migrate dev](https://stackoverflow.com/questions/68539836/difference-between-prisma-db-push-and-prisma-migrate-dev)
