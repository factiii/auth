import { type CreateHTTPContextOptions } from '@trpc/server/adapters/standalone';

import { type createBaseProcedure, type createTrpcBuilder } from '../utilities/trpc';

export type TrpcBuilder = ReturnType<typeof createTrpcBuilder>;
export type AuthProcedure = ReturnType<typeof createBaseProcedure>;
export type BaseProcedure = ReturnType<typeof createBaseProcedure>;

export type Meta = {
  authRequired?: boolean;
  adminRequired?: boolean;
  ignoreExpiration?: boolean;
};

export interface TrpcContext {
  userId: number | null;
  sessionId: number | null;
  refreshToken: string | null;
  socketId: string | null;
  headers: CreateHTTPContextOptions['req']['headers'];
  res: CreateHTTPContextOptions['res']; // Allows us to stream responses
  ip?: string;
}
