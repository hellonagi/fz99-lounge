import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { fromInstanceMetadata } from '@aws-sdk/credential-providers';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;
  private baseUrl: string;

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.get<string>('S3_BUCKET_NAME')!;
    this.region = this.configService.get<string>('AWS_REGION') || 'ap-northeast-1';

    // MinIO (開発環境) vs AWS S3 (本番環境)
    const endpoint = this.configService.get<string>('S3_ENDPOINT');

    // MinIO (開発環境) の場合は明示的な認証情報が必要
    // AWS S3 (本番環境) の場合はIAMロールを使用するため credentials を指定しない
    const s3Config: ConstructorParameters<typeof S3Client>[0] = {
      region: this.region,
    };

    if (endpoint) {
      // MinIO用設定（開発環境）
      s3Config.endpoint = endpoint;
      s3Config.forcePathStyle = true;
      s3Config.credentials = {
        accessKeyId: this.configService.get<string>('S3_ACCESS_KEY_ID') || 'minioadmin',
        secretAccessKey: this.configService.get<string>('S3_SECRET_ACCESS_KEY') || 'minioadmin',
      };
    } else {
      // AWS S3（本番環境）- EC2インスタンスメタデータから認証情報を取得
      s3Config.credentials = fromInstanceMetadata({
        timeout: 1000,
        maxRetries: 3,
      });
    }

    this.s3Client = new S3Client(s3Config);

    // ブラウザからアクセス可能なURLを設定
    // MinIOの場合、Docker内部URLではなく、localhost:9000を使用
    if (endpoint) {
      this.baseUrl = endpoint.replace('minio:9000', 'localhost:9000');
    } else {
      this.baseUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com`;
    }

    this.logger.log(
      `Storage initialized: ${endpoint ? 'MinIO (dev)' : 'AWS S3 (prod)'} - Bucket: ${this.bucketName}`,
    );
    this.logger.log(`Public URL: ${this.baseUrl}`);
  }

  /**
   * 画像を圧縮するヘルパーメソッド
   */
  private async compressImage(buffer: Buffer): Promise<Buffer> {
    return await sharp(buffer)
      .resize(1920, 1080, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 85,
        progressive: true,
      })
      .toBuffer();
  }

  /**
   * 一時フォルダにファイルをアップロード（後方互換性のため維持）
   */
  async uploadTempScreenshot(
    matchId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const compressedBuffer = await this.compressImage(file.buffer);
    const key = `screenshots/temp/${matchId}/${Date.now()}.jpg`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: compressedBuffer,
        ContentType: 'image/jpeg',
      }),
    );

    const url = `${this.baseUrl}/${this.bucketName}/${key}`;
    const originalSize = (file.size / 1024 / 1024).toFixed(2);
    const compressedSize = (compressedBuffer.length / 1024 / 1024).toFixed(2);
    this.logger.log(
      `Uploaded temp screenshot: ${url} (${originalSize}MB → ${compressedSize}MB)`,
    );
    return url;
  }

  /**
   * 個人成績スクショをアップロード
   * フォルダ: screenshots/individual/{gameId}/{userId}_{timestamp}.jpg
   * 7日後にクリーンアップ対象
   */
  async uploadIndividualScreenshot(
    gameId: string,
    userId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const compressedBuffer = await this.compressImage(file.buffer);
    const key = `screenshots/individual/${gameId}/${userId}_${Date.now()}.jpg`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: compressedBuffer,
        ContentType: 'image/jpeg',
      }),
    );

    const url = `${this.baseUrl}/${this.bucketName}/${key}`;
    const originalSize = (file.size / 1024 / 1024).toFixed(2);
    const compressedSize = (compressedBuffer.length / 1024 / 1024).toFixed(2);
    this.logger.log(
      `Uploaded individual screenshot: ${url} (${originalSize}MB → ${compressedSize}MB)`,
    );
    return url;
  }

  /**
   * 全体スコアスクショをアップロード（1位のみ）
   * フォルダ: screenshots/final/{gameId}/{timestamp}.jpg
   * 永久保存
   */
  async uploadFinalScoreScreenshot(
    gameId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const compressedBuffer = await this.compressImage(file.buffer);
    const key = `screenshots/final/${gameId}/${Date.now()}.jpg`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: compressedBuffer,
        ContentType: 'image/jpeg',
      }),
    );

    const url = `${this.baseUrl}/${this.bucketName}/${key}`;
    const originalSize = (file.size / 1024 / 1024).toFixed(2);
    const compressedSize = (compressedBuffer.length / 1024 / 1024).toFixed(2);
    this.logger.log(
      `Uploaded final score screenshot: ${url} (${originalSize}MB → ${compressedSize}MB)`,
    );
    return url;
  }

  /**
   * 永久フォルダにファイルをコピー
   */
  async copyToPermanent(tempUrl: string, matchId: string): Promise<string> {
    const tempKey = this.extractKeyFromUrl(tempUrl);
    const permanentKey = `screenshots/permanent/${matchId}.jpg`;

    await this.s3Client.send(
      new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${tempKey}`,
        Key: permanentKey,
      }),
    );

    const url = `${this.baseUrl}/${this.bucketName}/${permanentKey}`;
    this.logger.log(`Copied to permanent: ${url}`);
    return url;
  }

  /**
   * ファイルを削除
   */
  async deleteFile(fileUrl: string): Promise<void> {
    const key = this.extractKeyFromUrl(fileUrl);

    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
    );

    this.logger.log(`Deleted file: ${fileUrl}`);
  }

  /**
   * 署名付きURLを生成（プライベートファイル用）
   */
  async getSignedUrl(fileUrl: string, expiresIn = 3600): Promise<string> {
    const key = this.extractKeyFromUrl(fileUrl);

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * URLからS3キーを抽出
   * URL形式: http://localhost:9000/fz99-screenshots/screenshots/...
   * → キー: screenshots/...
   */
  private extractKeyFromUrl(url: string): string {
    const urlObj = new URL(url);
    let path = urlObj.pathname.substring(1); // 先頭の "/" を削除

    // MinIO URLの場合、パスにバケット名が含まれているので除去
    // 例: "fz99-screenshots/screenshots/..." → "screenshots/..."
    if (path.startsWith(`${this.bucketName}/`)) {
      path = path.substring(this.bucketName.length + 1);
    }

    return path;
  }
}
