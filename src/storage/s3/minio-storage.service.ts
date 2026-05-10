import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { BadGatewayException, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { EnvKey } from '../../common/env-keys';

export interface MinioObjectStream {
  body: Readable;
  contentLength?: number;
  contentType?: string;
}

@Injectable()
export class MinioStorageService implements OnModuleInit {
  private readonly client: S3Client | null;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>(EnvKey.MINIO_ENDPOINT)?.trim();
    const accessKeyId = this.config.get<string>(EnvKey.MINIO_ACCESS_KEY)?.trim();
    const secretAccessKey = this.config.get<string>(EnvKey.MINIO_SECRET_KEY)?.trim();
    this.bucket = this.config.get<string>(EnvKey.MINIO_BUCKET)?.trim() || 'telegram-storage';

    this.client =
      endpoint && accessKeyId && secretAccessKey
        ? new S3Client({
            endpoint,
            region: this.config.get<string>(EnvKey.MINIO_REGION)?.trim() || 'us-east-1',
            credentials: { accessKeyId, secretAccessKey },
            forcePathStyle: this.config.get<string>(EnvKey.MINIO_FORCE_PATH_STYLE) !== 'false',
          })
        : null;
  }

  async onModuleInit(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  getBucket(): string {
    return this.bucket;
  }

  async putFileFromPath(params: {
    objectKey: string;
    path: string;
    contentType: string;
    contentLength: number;
  }): Promise<void> {
    const client = this.requireClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.objectKey,
        Body: createReadStream(params.path),
        ContentType: params.contentType,
        ContentLength: params.contentLength,
      }),
    );
  }

  async putBuffer(params: {
    objectKey: string;
    buffer: Buffer;
    contentType: string;
  }): Promise<void> {
    const client = this.requireClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.objectKey,
        Body: params.buffer,
        ContentType: params.contentType,
        ContentLength: params.buffer.length,
      }),
    );
  }

  async getObject(objectKey: string): Promise<MinioObjectStream> {
    const client = this.requireClient();
    const result = await client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
    );
    if (!(result.Body instanceof Readable)) {
      throw new BadGatewayException('MinIO không trả về stream hợp lệ');
    }
    return {
      body: result.Body,
      contentLength: result.ContentLength,
      contentType: result.ContentType,
    };
  }

  async deleteObject(objectKey: string | null | undefined): Promise<void> {
    if (!objectKey || !this.client) return;
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
    );
  }

  private requireClient(): S3Client {
    if (!this.client) {
      throw new BadGatewayException('Chưa cấu hình MinIO/S3');
    }
    return this.client;
  }
}
