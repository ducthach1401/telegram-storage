import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Account } from './account.entity';

export const CurrentAccount = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Account => {
    const req = ctx.switchToHttp().getRequest<{ account?: Account }>();
    if (!req.account) {
      throw new UnauthorizedException();
    }
    return req.account;
  },
);
