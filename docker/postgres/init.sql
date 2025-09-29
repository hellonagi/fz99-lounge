-- PostgreSQL初期化スクリプト
-- Discord Cafe Database Setup

-- 拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- 類似検索用
CREATE EXTENSION IF NOT EXISTS "unaccent"; -- アクセント除去

-- データベース設定
ALTER DATABASE discord_cafe SET timezone TO 'Asia/Tokyo';

-- 初期ユーザー作成（開発用）
-- 本番環境では別途セキュアな方法で作成
DO $$
BEGIN
    -- アプリケーション用ユーザー
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'app_user') THEN
        CREATE USER app_user WITH PASSWORD 'app_password';
    END IF;

    -- 読み取り専用ユーザー（分析用）
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'readonly_user') THEN
        CREATE USER readonly_user WITH PASSWORD 'readonly_password';
    END IF;
END
$$;

-- 権限設定
GRANT ALL PRIVILEGES ON DATABASE discord_cafe TO app_user;
GRANT CONNECT ON DATABASE discord_cafe TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly_user;

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