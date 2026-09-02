import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import COS from 'cos-nodejs-sdk-v5';
import { randomUUID } from 'node:crypto';

@Injectable()
export class CosService {
  constructor(private readonly configService: ConfigService) {}

  private getConfig() {
    const names = [
      'TENCENT_COS_SECRET_ID',
      'TENCENT_COS_SECRET_KEY',
      'TENCENT_COS_BUCKET',
      'TENCENT_COS_REGION',
    ] as const;
    const values = Object.fromEntries(
      names.map((name) => [name, this.configService.get<string>(name)]),
    ) as Record<(typeof names)[number], string | undefined>;
    const missing = names.filter((name) => !values[name]);
    if (missing.length > 0) {
      throw new Error(`缺少 COS 环境变量: ${missing.join(', ')}`);
    }
    return values as Record<(typeof names)[number], string>;
  }

  createObjectKey(directory: string, extension: string) {
    const safeExtension = extension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `${directory}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${safeExtension || 'bin'}`;
  }

  async uploadPrivateObject(key: string, body: Buffer, contentType: string) {
    const config = this.getConfig();
    const client = new COS({
      SecretId: config.TENCENT_COS_SECRET_ID,
      SecretKey: config.TENCENT_COS_SECRET_KEY,
    });

    await client.putObject({
      Bucket: config.TENCENT_COS_BUCKET,
      Region: config.TENCENT_COS_REGION,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    return { key };
  }
}
