// ─── S3 Storage Service ───────────────────────────────────────────────────
// AWS S3 implementation of IStorageService

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { IStorageService } from '../../application/ports/storage.port.js';

const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

export class S3StorageService implements IStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(bucket: string, region: string, endpointUrl?: string) {
    this.bucket = bucket;
    this.client = new S3Client({
      region,
      ...(endpointUrl ? { endpoint: endpointUrl, forcePathStyle: true } : {}),
    });
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return key;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async getSignedUrl(key: string, expiresInSeconds = SEVEN_DAYS_IN_SECONDS): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}
