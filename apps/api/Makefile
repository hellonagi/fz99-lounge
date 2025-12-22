# F-ZERO 99 Lounge API - Makefile
# Usage: make <target>

.PHONY: help build start test lint prisma data sim load db

# デフォルト: ヘルプ表示
help:
	@echo ""
	@echo "=== Build & Start ==="
	@echo "  make build          - NestJSビルド"
	@echo "  make start          - 本番起動"
	@echo "  make dev            - 開発モード起動 (watch)"
	@echo "  make debug          - デバッグモード起動"
	@echo ""
	@echo "=== Lint & Format ==="
	@echo "  make format         - Prettierでフォーマット"
	@echo "  make lint           - ESLintで検査・修正"
	@echo ""
	@echo "=== Jest Tests ==="
	@echo "  make test           - 全テスト実行"
	@echo "  make test-watch     - ウォッチモード"
	@echo "  make test-cov       - カバレッジ付きテスト"
	@echo "  make test-unit      - ユニットテストのみ (*.spec.ts)"
	@echo "  make test-e2e       - E2Eテスト"
	@echo "  make test-integration - 統合テスト"
	@echo "  make test-all       - 全テストスイート実行"
	@echo ""
	@echo "=== Simulators (実際のAPIを叩いてテスト) ==="
	@echo "  make sim-fake-users COUNT=50 - フェイクユーザー作成 (default: 40)"
	@echo "  make sim-fake-users-stats    - フェイクユーザー統計表示"
	@echo "  make sim-join COUNT=20       - WAITINGロビーに参加(時間差)"
	@echo "  make sim-leave COUNT=10      - フェイクユーザー退出(時間差)"
	@echo "  make sim-leave-all           - 全フェイクユーザー退出"
	@echo "  make sim-score MODE=gradual  - スコア送信 (gradual|fast|burst)"
	@echo "  make sim-score-latest        - 最新試合にスコア送信"
	@echo "  make sim-score-classic       - CLASSIC専用 (16人/順位重複なし)"
	@echo ""
	@echo "=== Load Tests (Artillery負荷テスト) ==="
	@echo "  make load-lobby     - ロビー操作の負荷テスト"
	@echo "  make load-99        - 99人同時参加テスト"
	@echo ""
	@echo "=== Test DB ==="
	@echo "  make db-up          - テスト用DBコンテナ起動"
	@echo "  make db-down        - テスト用DBコンテナ停止"
	@echo "  make db-migrate     - テスト用DBにマイグレーション適用"
	@echo ""
	@echo "=== Prisma ==="
	@echo "  make prisma-generate - Prismaクライアント生成"
	@echo "  make prisma-migrate  - マイグレーション実行"
	@echo "  make prisma-studio   - Prisma Studio起動"
	@echo "  make prisma-seed     - シードデータ投入"
	@echo ""
	@echo "=== Data Management ==="
	@echo "  make data-clean     - テストユーザー(isFake=true)を削除"
	@echo "  make data-clean-force - 確認なしで削除"
	@echo "  make data-reset     - テストデータ削除 + シード再実行"
	@echo "  make data-clear-scores - 試合スコアをクリア (--latest対応)"
	@echo "  make data-reset-ratings - 全ユーザーのレートを初期化"
	@echo ""

# =============================================================================
# Build & Start
# =============================================================================
build:
	npx nest build

start:
	node dist/main

dev:
	npx dotenv -e ../../.env -- nest start --watch

debug:
	npx dotenv -e ../../.env -- nest start --debug --watch

# =============================================================================
# Lint & Format
# =============================================================================
format:
	npx prettier --write "src/**/*.ts" "test/**/*.ts"

lint:
	npx eslint "{src,apps,libs,test}/**/*.ts" --fix

# =============================================================================
# Jest Tests
# =============================================================================
test:
	npx jest

test-watch:
	npx jest --watch

test-cov:
	npx jest --coverage

test-debug:
	node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand

test-unit:
	npx jest --testPathPattern=spec.ts$$

test-e2e:
	npx jest --config ./test/jest-e2e.json

test-integration:
	npx jest --testPathPattern=integration.spec.ts$$

test-all:
	bash test/run-all-tests.sh

# =============================================================================
# Simulators
# =============================================================================
MODE ?= gradual
COUNT ?= 40
DELAY ?= 500

# フェイクユーザー作成
# Usage: make sim-fake-users COUNT=50
sim-fake-users:
	npx dotenv -e ../../.env -- ts-node test/simulators/create-fake-users.ts --count=$(COUNT)

sim-fake-users-stats:
	npx dotenv -e ../../.env -- ts-node test/simulators/create-fake-users.ts --stats

# スコア送信シミュレータ (API経由)
# Usage: make sim-score MODE=fast
#        make sim-score MODE=burst OPTS="--latest --all"
sim-score:
	npx dotenv -e ../../.env -- ts-node test/simulators/simulate-scores.ts $(MODE) $(OPTS)

# 最新試合にスコア送信 (ショートカット)
sim-score-latest:
	npx dotenv -e ../../.env -- ts-node test/simulators/simulate-scores.ts $(MODE) --latest

# CLASSICモード専用スコア送信 (16人、各レース4人脱落、順位重複なし)
sim-score-classic:
	npx dotenv -e ../../.env -- ts-node test/simulators/simulate-classic-scores.ts

# ロビー参加シミュレータ (既存フェイクユーザーを使用、API経由)
# Usage: make sim-join COUNT=20 DELAY=500
# Note: Run 'make sim-fake-users' first to create fake users
sim-join:
	npx dotenv -e ../../.env -- ts-node test/simulators/join-lobby-simulator.ts --count=$(COUNT) --delay=$(DELAY)

# ロビー退出シミュレータ (フェイクユーザーを退出させる、API経由)
# Usage: make sim-leave COUNT=10 DELAY=300
#        make sim-leave-all  (全フェイクユーザー退出)
sim-leave:
	npx dotenv -e ../../.env -- ts-node test/simulators/leave-lobby-simulator.ts --count=$(COUNT) --delay=$(DELAY)

sim-leave-all:
	npx dotenv -e ../../.env -- ts-node test/simulators/leave-lobby-simulator.ts --all --delay=$(DELAY)

# =============================================================================
# Load Tests
# =============================================================================
load-lobby:
	npx artillery run test/load/lobby-stress.yml

load-99:
	npx artillery run test/load/99-players-test.yml

# =============================================================================
# Test DB
# =============================================================================
db-up:
	docker-compose -f docker-compose.test.yml up -d

db-down:
	docker-compose -f docker-compose.test.yml down

db-migrate:
	DATABASE_URL='postgresql://postgres:postgres@localhost:5433/fz99_lounge_test?schema=public' npx prisma migrate deploy

# =============================================================================
# Prisma
# =============================================================================
prisma-generate:
	npx dotenv -e ../../.env -- prisma generate

prisma-migrate:
	npx dotenv -e ../../.env -- prisma migrate dev

prisma-studio:
	npx dotenv -e ../../.env -- prisma studio

prisma-seed:
	npx dotenv -e ../../.env -- prisma db seed

# =============================================================================
# Data Management
# =============================================================================
data-clean:
	npx ts-node scripts/clean-test-data.ts

data-clean-force:
	npx ts-node scripts/clean-test-data.ts --force

data-reset: data-clean-force prisma-seed

# Usage: make data-clear-scores OPTS="--latest"
data-clear-scores:
	npx ts-node scripts/clear-match-scores.ts $(OPTS)

# 全ユーザーのレートを初期化
data-reset-ratings:
	npx dotenv -e ../../.env -- ts-node scripts/reset-ratings.ts

# n_a_ユーザーにADMIN権限を付与
grant-admin:
	npx dotenv -e ../../.env -- ts-node scripts/grant-admin.ts
