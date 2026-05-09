import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate limit cho endpoint chỉ cần token (không Basic Auth): `/shared/files/*` và tải ZIP async `/folders/download/stream`.
 */
@Injectable()
export class ShareRouteThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ originalUrl?: string; url?: string }>();
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0] ?? '';
    if (path.includes('/shared/files')) {
      return false;
    }
    if (path.endsWith('/folders/download/stream')) {
      return false;
    }
    return true;
  }
}
