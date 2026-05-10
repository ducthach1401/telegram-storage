import type { Account } from '../accounts/account.entity';

declare global {
  namespace Express {
    interface Request {
      /** Basic Auth đã xác thực — account trong DB */
      account?: Account;
    }
  }
}

export {};
