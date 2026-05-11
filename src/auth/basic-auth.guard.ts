import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
import { ApiExceptionMessage } from "../common/api-messages";
import { AccountService } from "../accounts/account.service";
import { verifyPassword } from "../accounts/password-hash.util";
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
 * Basic Auth — kiểm tra username/password với bảng `accounts` (bootstrap admin tạo từ env khi DB trống).
 */
@Injectable()
export class BasicAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accounts: AccountService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    const account = await this.accounts.findByUsername(user);
    if (!account || !verifyPassword(pass, account.passwordHash)) {
      this.unauthorized(req, res);
    }
    if (!account.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa');
    }

    req.account = account;
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

}
