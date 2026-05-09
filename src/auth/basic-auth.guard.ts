import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "crypto";
import type { Request, Response } from "express";

/**
 * Basic Auth luôn bật — user/password lấy từ `API_BASIC_AUTH_*` (bootstrap kiểm tra không rỗng).
 */
@Injectable()
export class BasicAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    if (req.method === "OPTIONS") {
      return true;
    }

    const password = (
      this.config.get<string>("API_BASIC_AUTH_PASSWORD") ?? ""
    ).trim();
    const expectedUser = (
      this.config.get<string>("API_BASIC_AUTH_USER") ?? ""
    ).trim();

    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Basic ")) {
      this.unauthorized(res);
    }

    let decoded: string;
    try {
      decoded = Buffer.from(authHeader.slice(6).trim(), "base64").toString(
        "utf8",
      );
    } catch {
      this.unauthorized(res);
    }

    const colon = decoded.indexOf(":");
    const user = colon >= 0 ? decoded.slice(0, colon) : decoded;
    const pass = colon >= 0 ? decoded.slice(colon + 1) : "";

    if (
      !this.safeEqualUtf8(user, expectedUser) ||
      !this.safeEqualUtf8(pass, password)
    ) {
      this.unauthorized(res);
    }

    return true;
  }

  private unauthorized(res: Response): never {
    res.setHeader(
      "WWW-Authenticate",
      'Basic realm="Telegram Storage API"',
    );
    throw new UnauthorizedException("Yêu cầu Basic Authorization");
  }

  private safeEqualUtf8(a: string, b: string): boolean {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) {
      return false;
    }
    return timingSafeEqual(ba, bb);
  }
}
