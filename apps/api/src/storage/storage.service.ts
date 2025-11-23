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

    this.baseUrl = endpoint || `https://${this.bucketName}.s3.${this.region}.amazonaws.com`;

    this.logger.log(
      `Storage initialized: ${endpoint ? 'MinIO (dev)' : 'AWS S3 (prod)'} - Bucket: ${this.bucketName}`,
    );
  }

  /**
   * 一時フォルダにファイルをアップロード
   */
  async uploadTempScreenshot(
    matchId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const key = `screenshots/temp/${matchId}/${Date.now()}-${file.originalname}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const url = `${this.baseUrl}/${key}`;
    this.logger.log(`Uploaded temp screenshot: ${url}`);
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

    const url = `${this.baseUrl}/${permanentKey}`;
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
