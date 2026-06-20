import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { AppConfig } from 'config';
import { Readable } from 'stream';
import { APP_CONFIG } from './storage.constants';

export interface StoredObject {
  body: Buffer;
  contentType: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    const { endpoint, port, accessKey, secretKey, useSsl, bucket } =
      config.minio;
    this.bucket = bucket;
    this.client = new S3Client({
      endpoint: `${useSsl ? 'https' : 'http'}://${endpoint}:${port}`,
      region: 'us-east-1',
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
    });
  }

  objectKeyFor(documentId: string, revisionId: string, filename: string): string {
    const safeName = filename.replace(/[/\\]/g, '_');
    return `documents/${documentId}/${revisionId}-${safeName}`;
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      this.logger.log(`Creating MinIO bucket "${this.bucket}"`);
      await this.client.send(
        new CreateBucketCommand({ Bucket: this.bucket }),
      );
    }
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getObject(key: string): Promise<StoredObject> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    const stream = response.Body;
    if (!stream) {
      throw new Error(`Empty object body for key ${key}`);
    }

    const body = await this.streamToBuffer(stream as Readable);
    return {
      body,
      contentType: response.ContentType ?? 'application/octet-stream',
    };
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
