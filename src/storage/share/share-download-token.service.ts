import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { validate as isUuid } from 'uuid';
import { ApiExceptionMessage } from '../../common/api-messages';
import { EnvKey } from '../../common/env-keys';

interface TokenPayload {
  fid: string;
  exp: number;
}

@Injectable()
export class ShareDownloadTokenService {
  constructor(private readonly config: ConfigService) {}

  create(
    fileId: string,
    ttlSeconds: number,
  ): { token: string; expiresAt: Date } {
    const secret = this.config.getOrThrow<string>(EnvKey.DOWNLOAD_SHARE_SECRET);
    const ttl = Math.min(Math.max(ttlSeconds, 60), 604800);
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const payloadB64 = Buffer.from(
      JSON.stringify({ fid: fileId, exp } satisfies TokenPayload),
      'utf8',
    ).toString('base64url');
    const sig = createHmac('sha256', secret)
      .update(payloadB64)
      .digest('base64url');
    const token = `${payloadB64}.${sig}`;
    return { token, expiresAt: new Date(exp * 1000) };
  }

  verifyFileId(token: string): string {
    const secret = this.config.getOrThrow<string>(EnvKey.DOWNLOAD_SHARE_SECRET);
    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new UnauthorizedException(ApiExceptionMessage.SHARE_TOKEN_INVALID);
    }
    const [payloadB64, sig] = parts;
    if (!payloadB64 || !sig) {
      throw new UnauthorizedException(ApiExceptionMessage.SHARE_TOKEN_INVALID);
    }
    const expectedSig = createHmac('sha256', secret)
      .update(payloadB64)
      .digest('base64url');
    const sb = Buffer.from(sig, 'utf8');
    const eb = Buffer.from(expectedSig, 'utf8');
    if (sb.length !== eb.length || !timingSafeEqual(sb, eb)) {
      throw new UnauthorizedException(ApiExceptionMessage.SHARE_TOKEN_INVALID);
    }

    let raw: unknown;
    try {
      raw = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException(ApiExceptionMessage.SHARE_TOKEN_INVALID);
    }

    const p = raw as Partial<TokenPayload>;
    if (typeof p.fid !== 'string' || typeof p.exp !== 'number') {
      throw new UnauthorizedException(ApiExceptionMessage.SHARE_TOKEN_INVALID);
    }
    if (!isUuid(p.fid)) {
      throw new UnauthorizedException(ApiExceptionMessage.SHARE_TOKEN_INVALID);
    }
    if (p.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException(ApiExceptionMessage.SHARE_TOKEN_INVALID);
    }

    return p.fid;
  }
}
