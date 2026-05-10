import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import { ApiExceptionMessage } from "../common/api-messages";
import { EnvKey } from "../common/env-keys";
import {
  BasicAuthWwwAuthenticateValue,
  BufferEncoding,
  HttpAuthScheme,
  HttpHeader,
  HttpIncomingHeader,
  HttpMethod,
} from "../common/http.constants";
import { IS_PUBLIC_KEY } from "./public.decorator";

/**
 * Basic Auth luôn bật — user/password lấy từ EnvKey.API_BASIC_AUTH_* (bootstrap kiểm tra không rỗng).
 */
@Injectable()
export class BasicAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    if (req.method === HttpMethod.OPTIONS) {
      return true;
    }

    const password = (
      this.config.get<string>(EnvKey.API_BASIC_AUTH_PASSWORD) ?? ""
    ).trim();
    const expectedUser = (
      this.config.get<string>(EnvKey.API_BASIC_AUTH_USER) ?? ""
    ).trim();

    const authHeader =
      req.headers[HttpIncomingHeader.AUTHORIZATION] ??
      this.authHeaderFromCookie(req.headers.cookie);

    if (!authHeader?.startsWith(HttpAuthScheme.BASIC_PREFIX)) {
      this.unauthorized(req, res);
    }

    let decoded: string;
    try {
      decoded = Buffer.from(
        authHeader.slice(HttpAuthScheme.BASIC_PREFIX.length).trim(),
        BufferEncoding.BASE64,
      ).toString(BufferEncoding.UTF8);
    } catch {
      this.unauthorized(req, res);
    }

    const colon = decoded.indexOf(":");
    const user = colon >= 0 ? decoded.slice(0, colon) : decoded;
    const pass = colon >= 0 ? decoded.slice(colon + 1) : "";

    if (
      !this.safeEqualUtf8(user, expectedUser) ||
      !this.safeEqualUtf8(pass, password)
    ) {
      this.unauthorized(req, res);
    }

    return true;
  }

  private unauthorized(req: Request, res: Response): never {
    if (req.headers['x-auth-mode'] !== 'app' && req.query.appAuth !== '1') {
      res.setHeader(HttpHeader.WWW_AUTHENTICATE, BasicAuthWwwAuthenticateValue);
    }
    throw new UnauthorizedException(ApiExceptionMessage.BASIC_AUTH_REQUIRED);
  }

  private authHeaderFromCookie(cookieHeader: string | undefined): string | undefined {
    const raw = cookieHeader
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('tg_drive_auth='))
      ?.slice('tg_drive_auth='.length);
    if (!raw) {
      return undefined;
    }
    return `${HttpAuthScheme.BASIC_PREFIX}${decodeURIComponent(raw)}`;
  }

  private safeEqualUtf8(a: string, b: string): boolean {
    const ba = Buffer.from(a, BufferEncoding.UTF8);
    const bb = Buffer.from(b, BufferEncoding.UTF8);
    if (ba.length !== bb.length) {
      return false;
    }
    return timingSafeEqual(ba, bb);
  }
}
