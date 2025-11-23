# Claude Code 作業メモ

## 🐳 プロジェクト環境

このプロジェクトはDockerで動いています。

**主要コンテナ**:
- `fz99-lounge-api`: NestJS API (localhost:3000)
- `fz99-lounge-web`: Next.js Web (localhost:3001)
- `fz99-lounge-db`: PostgreSQL (localhost:5432)
- `fz99-lounge-redis`: Redis (localhost:6379)

**確認コマンド**: `docker ps`

## 📊 Prismaスキーマ変更

**現在**: プロトタイピング段階

```bash
cd apps/api
npx prisma db push --accept-data-loss
```

**本番運用後**: マイグレーション管理

```bash
cd apps/api
npx prisma migrate dev --name feature_name
```

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

## 📚 参考リンク

- [Prisma: Prototyping your schema](https://www.prisma.io/docs/orm/prisma-migrate/workflows/prototyping-your-schema)
- [Prisma: Development and production](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production)
- [Stack Overflow: db push vs migrate dev](https://stackoverflow.com/questions/68539836/difference-between-prisma-db-push-and-prisma-migrate-dev)
