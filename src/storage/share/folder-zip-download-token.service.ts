import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { ApiExceptionMessage } from '../../common/api-messages';
import { EnvKey } from '../../common/env-keys';

interface TokenPayload {
  jid: string;
  exp: number;
}

@Injectable()
export class FolderZipDownloadTokenService {
  constructor(private readonly config: ConfigService) {}

  create(jobId: string): { token: string; expiresAt: Date } {
    const secret = this.config.getOrThrow<string>(EnvKey.DOWNLOAD_SHARE_SECRET);
    const ttlRaw = this.config.get<string>(EnvKey.FOLDER_ZIP_DOWNLOAD_TOKEN_TTL_SECONDS)?.trim();
    const ttl = Math.min(
      Math.max(Number(ttlRaw !== '' && ttlRaw !== undefined ? ttlRaw : 3600) || 3600, 60),
      604800,
    );
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const payloadB64 = Buffer.from(
      JSON.stringify({ jid: jobId, exp } satisfies TokenPayload),
      'utf8',
    ).toString('base64url');
    const sig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
    return { token: `${payloadB64}.${sig}`, expiresAt: new Date(exp * 1000) };
  }

  verifyJobId(token: string): string {
    const secret = this.config.getOrThrow<string>(EnvKey.DOWNLOAD_SHARE_SECRET);
    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new UnauthorizedException(ApiExceptionMessage.SHARE_TOKEN_INVALID);
    }
    const [payloadB64, sig] = parts;
    if (!payloadB64 || !sig) {
      throw new UnauthorizedException(ApiExceptionMessage.SHARE_TOKEN_INVALID);
    }
    const expectedSig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
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
    if (typeof p.jid !== 'string' || typeof p.exp !== 'number' || !p.jid.trim()) {
      throw new UnauthorizedException(ApiExceptionMessage.SHARE_TOKEN_INVALID);
    }
    if (p.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException(ApiExceptionMessage.SHARE_TOKEN_INVALID);
    }

    return p.jid.trim();
  }
}
