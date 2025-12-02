import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
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

    this.s3Client = new S3Client({
      region: this.region,
      endpoint: endpoint || undefined, // MinIOの場合はendpointを指定
      forcePathStyle: !!endpoint, // MinIOの場合はtrueにする
      credentials: endpoint
        ? {
            // MinIO用
            accessKeyId: this.configService.get<string>('S3_ACCESS_KEY_ID') || 'minioadmin',
            secretAccessKey: this.configService.get<string>('S3_SECRET_ACCESS_KEY') || 'minioadmin',
          }
        : {
            // AWS S3用
            accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
            secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY')!,
          },
    });

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
   * 一時フォルダにファイルをアップロード
   * 画像を圧縮してからアップロード
   */
  async uploadTempScreenshot(
    matchId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    // 画像を圧縮 (最大1920x1080、JPEG 85%品質)
    const compressedBuffer = await sharp(file.buffer)
      .resize(1920, 1080, {
        fit: 'inside', // アスペクト比を維持
        withoutEnlargement: true, // 元画像より大きくしない
      })
      .jpeg({
        quality: 85, // JPEG品質 (1-100)
        progressive: true, // プログレッシブJPEG
      })
      .toBuffer();

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
   */
  private extractKeyFromUrl(url: string): string {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1); // 先頭の "/" を削除
  }
}
