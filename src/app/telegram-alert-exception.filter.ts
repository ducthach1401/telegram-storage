import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import type { Request } from 'express';
import { TelegramService } from '../storage/telegram/telegram.service';

function resolveHttpStatus(exception: unknown): number {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }
  if (
    typeof exception === 'object' &&
    exception !== null &&
    'statusCode' in exception &&
    typeof (exception as { statusCode: unknown }).statusCode === 'number'
  ) {
    return (exception as { statusCode: number }).statusCode;
  }
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

function formatExceptionBrief(exception: unknown): string {
  if (exception instanceof HttpException) {
    const res = exception.getResponse();
    if (typeof res === 'string') {
      return res;
    }
    try {
      return JSON.stringify(res);
    } catch {
      return String(res);
    }
  }
  if (exception instanceof Error) {
    const stack = exception.stack ?? '';
    const stackShort =
      stack.length > 1200 ? `${stack.slice(0, 1200)}…` : stack;
    return `${exception.name}: ${exception.message}\n${stackShort}`;
  }
  return String(exception);
}

/**
 * Gửi tin lên Telegram (khi có TELEGRAM_ALERT_CHAT_ID) cho lỗi HTTP ≥500 và lỗi không phải HttpException.
 */
@Catch()
export class TelegramAlertExceptionFilter extends BaseExceptionFilter {
  constructor(
    adapterHost: HttpAdapterHost,
    private readonly telegram: TelegramService,
  ) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const status = resolveHttpStatus(exception);
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const req = host.switchToHttp().getRequest<Request>();
      const method = req?.method ?? '?';
      const path = req?.originalUrl ?? req?.url ?? '?';
      const brief = formatExceptionBrief(exception);
      const text = [
        '🚨 Telegram Storage — lỗi API',
        `${method} ${path}`,
        `HTTP ${status}`,
        brief,
      ].join('\n');
      void this.telegram.sendAlertPlainText(text);
    }

    super.catch(exception, host);
  }
}
