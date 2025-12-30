-- PostgreSQL初期化スクリプト
-- FZ99 Lounge Database Setup

-- 拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- 類似検索用
CREATE EXTENSION IF NOT EXISTS "unaccent"; -- アクセント除去

-- データベース設定
ALTER DATABASE fz99_lounge SET timezone TO 'Asia/Tokyo';

-- 追加ユーザーが必要な場合は環境変数経由で作成
-- 開発環境: .envのDB_USER/DB_PASSWORDを使用
-- 本番環境: RDSのマスターユーザーを使用

-- 権限設定（追加ユーザーを作成した場合のみ有効化）
-- GRANT ALL PRIVILEGES ON DATABASE fz99_lounge TO app_user;
-- GRANT CONNECT ON DATABASE fz99_lounge TO readonly_user;
-- GRANT USAGE ON SCHEMA public TO readonly_user;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly_user;

-- パフォーマンス設定
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '7864kB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;
ALTER SYSTEM SET work_mem = '1310kB';
ALTER SYSTEM SET min_wal_size = '1GB';
ALTER SYSTEM SET max_wal_size = '4GB';