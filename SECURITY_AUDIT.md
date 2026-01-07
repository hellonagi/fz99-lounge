# セキュリティ監査レポート

**プロジェクト**: fz99-lounge
**監査日**: 2026-01-07
**スキャン対象**: Git履歴全体（129コミット、2ブランチ）

---

## エグゼクティブサマリー

| 重要度 | 件数 | 説明 |
|--------|------|------|
| CRITICAL | 0 | 本番環境の秘密情報の漏洩なし |
| HIGH | 0 | 機密性の高い情報の漏洩なし |
| MEDIUM | 0 | 中程度のリスクなし |
| LOW | 2 | 開発用デフォルト値・サンプル値のみ |

**結論**: このリポジトリはオープンソース化の準備ができています。実際の機密情報（本番環境の秘密鍵、APIキー、パスワード等）はGit履歴に含まれていません。

---

## 使用ツール

| ツール | バージョン | 結果 |
|--------|-----------|------|
| gitleaks | 8.21.2 | 1件検出（誤検知/サンプル値） |
| trufflehog | 2.2.1 | 0件（package-lock.jsonのハッシュのみ） |
| 手動grep | - | 0件（実際の秘密なし） |

---

## 発見内容

### Finding #1: README.mdのサンプルトークン

| 項目 | 内容 |
|------|------|
| **種類** | サンプルAPIトークン |
| **重要度** | LOW（誤検知） |
| **ファイル** | `apps/api/README.md:5` |
| **コミット** | `5e29283` (Initial commit, 2025-09-29) |
| **現在のHEAD** | 存在する |
| **値（墨消し）** | `abc1...f456` |
| **コンテキスト** | NestJSスターターテンプレートのバッジURL |

```
[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc1...f456
```

**分析**: これはNestJSの公式スターターテンプレートに含まれるサンプル値であり、実際のCircleCIトークンではありません。Gitleaksはパターンマッチにより検出しましたが、誤検知です。

**対処**: 任意。削除しても良いが、セキュリティリスクはない。

---

### Finding #2: MinIO開発用デフォルト認証情報

| 項目 | 内容 |
|------|------|
| **種類** | 開発用デフォルトパスワード |
| **重要度** | LOW（意図的な開発設定） |
| **ファイル** | `compose.yaml:94-95, 213-214`<br>`apps/api/src/storage/storage.service.ts:42-43` |
| **現在のHEAD** | 存在する |
| **値** | `minioadmin` / `minioadmin` |

```yaml
# compose.yaml
S3_ACCESS_KEY_ID: ${S3_ACCESS_KEY_ID:-minioadmin}
S3_SECRET_ACCESS_KEY: ${S3_SECRET_ACCESS_KEY:-minioadmin}
```

```typescript
// storage.service.ts
accessKeyId: this.configService.get<string>('S3_ACCESS_KEY_ID') || 'minioadmin',
secretAccessKey: this.configService.get<string>('S3_SECRET_ACCESS_KEY') || 'minioadmin',
```

**分析**: MinIOの公式デフォルト認証情報です。ローカル開発環境でのみ使用され、本番環境では環境変数で上書きされます。オープンソースプロジェクトでは一般的なパターンです。

**対処**: 不要。これは意図的な開発用設定であり、セキュリティリスクではない。

---

## 個人情報（PII）チェック

| 項目 | 結果 |
|------|------|
| Gitコミット作者 | `hellonagi <38994662+hellonagi@users.noreply.github.com>` のみ（GitHub noreplyアドレス使用、本名なし） |
| 個人メールアドレス | 検出なし |
| 電話番号 | 検出なし |
| 住所情報 | 検出なし |
| 実際のDiscord ID | 検出なし（テストデータは `admin-001`, `player-001` 等の架空ID） |
| Discord アバターURL | 検出なし |
| ユーザーデータダンプ | 検出なし（.csv, .xlsx, .log ファイルなし） |
| seed.ts | テスト用架空データのみ（`test_admin`, `test_player_1` 等） |

**結論**: 本名やメールアドレスなどの個人情報はGit履歴に含まれていません。

---

## 検出されなかったパターン

以下のパターンはGit履歴に存在しませんでした（良い結果）:

| パターン | 結果 |
|---------|------|
| Discord OAuth Client Secret | 検出なし（テンプレートのみ） |
| Discord Bot Token | 検出なし（テンプレートのみ） |
| Discord Webhook URL | 検出なし |
| AWS Access Key (AKIA...) | 検出なし |
| AWS Secret Access Key | 検出なし |
| OpenAI API Key (sk-...) | 検出なし |
| JWT Secret（実値） | 検出なし（プレースホルダーのみ） |
| VAPID Private Key（実値） | 検出なし（空値のみ） |
| Database Password（実値） | 検出なし（プレースホルダーのみ） |
| Redis Password（実値） | 検出なし（プレースホルダーのみ） |
| Private Keys (PEM形式) | 検出なし |
| .env ファイル（実値入り） | 検出なし |
| 削除された機密ファイル | 検出なし |

---

## 環境変数テンプレートの確認

以下のファイルはプレースホルダー値のみを含み、安全です:

- `.env.example` - 開発用テンプレート
- `.env.stg.example` - ステージング用テンプレート
- `.env.prod.example` - 本番用テンプレート

すべての機密値は `<placeholder>` 形式で記載されています。

---

## 次のステップチェックリスト

オープンソース化に向けて:

- [x] Git履歴に実際の秘密情報がないことを確認
- [x] 環境変数テンプレートにプレースホルダーのみ含まれることを確認
- [x] .gitignoreで.envファイルが除外されていることを確認
- [ ] **任意**: README.mdのサンプルトークン行を削除またはプロジェクト固有の内容に置き換え
- [ ] **任意**: プロジェクト固有のREADME.mdを作成
- [ ] **推奨**: オープンソース化前に本番環境の全秘密をローテーション
- [ ] **推奨**: GitHub Secretsの権限を再確認
- [ ] **推奨**: ライセンスファイルの追加（必要に応じて）
- [ ] **推奨**: CONTRIBUTING.mdの追加（必要に応じて）

---

## 結論

このリポジトリは**オープンソース化可能**です。

- 実際の秘密情報はGit履歴に含まれていません
- 検出された2件はいずれも開発用デフォルト値またはサンプル値であり、セキュリティリスクではありません
- 環境変数による秘密管理が適切に実装されています

念のため、オープンソース化後は本番環境で使用しているすべての秘密（Discord Bot Token, JWT Secret, Database Password等）をローテーションすることを推奨します。

---

*このレポートは gitleaks 8.21.2, trufflehog 2.2.1, および手動grepスキャンにより生成されました。*
