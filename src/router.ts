import { type CreateHTTPContextOptions } from '@trpc/server/adapters/standalone';

import { createAuthGuard } from './middleware/authGuard';
import { BaseProcedureFactory } from './procedures/base';
import { BiometricProcedureFactory } from './procedures/biometric';
import { EmailVerificationProcedureFactory } from './procedures/emailVerification';
import { OAuthLoginProcedureFactory } from './procedures/oauth';
import { TwoFaProcedureFactory } from './procedures/twoFa';
import type { SchemaExtensions } from './types/hooks';
import { type AuthProcedure, type BaseProcedure, type TrpcContext } from './types/trpc';
import type { AuthConfig, ResolvedAuthConfig } from './utilities/config';
import { createAuthConfig } from './utilities/config';
import { createBaseProcedure, createTrpcBuilder, getClientIp } from './utilities/trpc';
import { createSchemas, type CreatedSchemas } from './validators';

export const createContext = ({ req, res }: CreateHTTPContextOptions): TrpcContext => ({
  headers: req.headers,
  userId: null,
  sessionId: null,
  socketId: null,
  ip: getClientIp(req),
  res,
});

class AuthRouterFactory<TExtensions extends SchemaExtensions = {}> {
  private config: ResolvedAuthConfig;
  private schemas: CreatedSchemas<TExtensions>;
  t: ReturnType<typeof createTrpcBuilder>;
  private authGuard: ReturnType<typeof createAuthGuard>;
  procedure: BaseProcedure;
  authProcedure: AuthProcedure;
  constructor(private userConfig: AuthConfig<TExtensions>) {
    this.config = createAuthConfig(this.userConfig);
    this.schemas = createSchemas<TExtensions>(this.config.schemaExtensions as TExtensions);
    this.t = createTrpcBuilder(this.config);
    this.authGuard = createAuthGuard(this.config, this.t);
    this.procedure = createBaseProcedure(this.t, this.authGuard);
    this.authProcedure = this.procedure.meta({ authRequired: true });
  }

  createRouter() {
    const baseRoutes = new BaseProcedureFactory<TExtensions>(
      this.config,
      this.procedure,
      this.authProcedure
    );
    const biometricRoutes = new BiometricProcedureFactory(this.config, this.authProcedure);
    const emailVerificationRoutes = new EmailVerificationProcedureFactory(
      this.config,
      this.authProcedure
    );
    const oAuthLoginRoutes = new OAuthLoginProcedureFactory<TExtensions>(
      this.config,
      this.procedure
    );
    const twoFaRoutes = new TwoFaProcedureFactory(this.config, this.procedure, this.authProcedure);

    return this.t.router({
      ...baseRoutes.createBaseProcedures(this.schemas),
      ...oAuthLoginRoutes.createOAuthLoginProcedures(this.schemas),
      ...twoFaRoutes.createTwoFaProcedures(),
      ...biometricRoutes.createBiometricProcedures(),
      ...emailVerificationRoutes.createEmailVerificationProcedures(),
    });
  }
}

export function createAuthRouter<TExtensions extends SchemaExtensions = {}>(
  config: AuthConfig<TExtensions>
) {
  const factory = new AuthRouterFactory<TExtensions>(config);
  const router = factory.t.router({
    auth: factory.createRouter(),
  });
  return {
    router: router,
    t: factory.t,
    procedure: factory.procedure,
    authProcedure: factory.authProcedure,
    createContext: createContext,
  };
}

export type AuthRouter<TExtensions extends SchemaExtensions = {}> = ReturnType<
  typeof createAuthRouter<TExtensions>
>;
