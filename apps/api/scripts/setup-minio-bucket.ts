#!/usr/bin/env ts-node

/**
 * MinIOバケット初期化スクリプト
 * 開発環境でMinIOのバケットを作成します
 *
 * 実行方法:
 * npx ts-node scripts/setup-minio-bucket.ts
 */

import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'fz99-screenshots';
const ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:9000';

const s3Client = new S3Client({
  region: 'us-east-1', // MinIOではリージョンは任意
  endpoint: ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'minioadmin',
  },
});

async function setupBucket() {
  console.log(`🪣  Setting up MinIO bucket: ${BUCKET_NAME}`);
  console.log(`📡  Endpoint: ${ENDPOINT}`);

  try {
    // バケットが存在するか確認
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`✅  Bucket '${BUCKET_NAME}' already exists`);
  } catch (error) {
    if (error.name === 'NotFound') {
      // バケットが存在しない場合は作成
      console.log(`📦  Creating bucket '${BUCKET_NAME}'...`);
      await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
      console.log(`✅  Bucket '${BUCKET_NAME}' created successfully`);
    } else {
      console.error('❌  Error:', error.message);
      throw error;
    }
  }

  console.log('\n✨  MinIO setup complete!');
  console.log(`🌐  MinIO Console: http://localhost:9001`);
  console.log(`🔑  Login: minioadmin / minioadmin`);
}

setupBucket().catch((error) => {
  console.error('❌  Setup failed:', error);
  process.exit(1);
});
