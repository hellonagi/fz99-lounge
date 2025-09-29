# Makefile for Discord Cafe Development
# 2025年9月版 - Docker Compose v2対応

.PHONY: help up down build logs ps clean reset migrate seed test

# デフォルトタスク
help: ## ヘルプを表示
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Docker Commands
up: ## Docker環境を起動
	docker-compose up -d
	@echo "🚀 Discord Cafe is running!"
	@echo "📱 Web: http://localhost:3001"
	@echo "🔧 API: http://localhost:3000"
	@echo "💾 Adminer: http://localhost:8080"

down: ## Docker環境を停止
	docker-compose down

build: ## Dockerイメージをビルド
	docker-compose build --no-cache

build-prod: ## 本番用Dockerイメージをビルド
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

logs: ## ログを表示
	docker-compose logs -f

logs-api: ## APIのログを表示
	docker-compose logs -f api

logs-web: ## Webのログを表示
	docker-compose logs -f web

ps: ## コンテナの状態を表示
	docker-compose ps

restart: ## 特定のサービスを再起動
	docker-compose restart $(service)

# Database Commands
migrate: ## Prismaマイグレーションを実行
	docker-compose exec api npx prisma migrate dev

migrate-deploy: ## 本番用マイグレーションを実行
	docker-compose exec api npx prisma migrate deploy

generate: ## Prisma Clientを生成
	docker-compose exec api npx prisma generate

seed: ## データベースにシードデータを投入
	docker-compose exec api npx prisma db seed

studio: ## Prisma Studioを起動
	docker-compose exec api npx prisma studio

db-reset: ## データベースをリセット
	docker-compose exec api npx prisma migrate reset

# Development Commands
dev: up ## 開発環境を起動

install: ## 依存関係をインストール
	cd apps/api && npm install
	cd apps/web && npm install

install-api: ## API依存関係をインストール
	docker-compose exec api npm install

install-web: ## Web依存関係をインストール
	docker-compose exec web npm install

# Testing Commands
test: ## テストを実行
	docker-compose exec api npm test
	docker-compose exec web npm test

test-api: ## APIテストを実行
	docker-compose exec api npm test

test-web: ## Webテストを実行
	docker-compose exec web npm test

test-e2e: ## E2Eテストを実行
	docker-compose exec api npm run test:e2e

# Linting Commands
lint: ## Lintを実行
	cd apps/api && npm run lint
	cd apps/web && npm run lint

format: ## コードをフォーマット
	cd apps/api && npm run format
	cd apps/web && npm run format

# Cleanup Commands
clean: ## 不要なファイルを削除
	rm -rf apps/api/dist
	rm -rf apps/api/node_modules
	rm -rf apps/web/.next
	rm -rf apps/web/node_modules

reset: down ## 環境を完全にリセット
	docker-compose down -v
	docker system prune -af
	@echo "⚠️  All containers and volumes have been removed!"

# Production Commands
prod: ## 本番環境を起動
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

prod-build: ## 本番環境をビルドして起動
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

prod-logs: ## 本番環境のログを表示
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Utility Commands
shell-api: ## APIコンテナにシェルで入る
	docker-compose exec api sh

shell-web: ## Webコンテナにシェルで入る
	docker-compose exec web sh

shell-db: ## データベースコンテナにシェルで入る
	docker-compose exec postgres psql -U dbuser discord_cafe

redis-cli: ## Redisコンテナに接続
	docker-compose exec redis redis-cli -a redispass

backup: ## データベースをバックアップ
	docker-compose exec postgres pg_dump -U dbuser discord_cafe > backup_$$(date +%Y%m%d_%H%M%S).sql

restore: ## データベースをリストア
	docker-compose exec -T postgres psql -U dbuser discord_cafe < $(file)