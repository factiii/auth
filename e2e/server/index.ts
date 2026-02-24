import { createHTTPServer } from '@trpc/server/adapters/standalone';
import type { CreateHTTPContextOptions } from '@trpc/server/adapters/standalone';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createAuthRouter, type EmailAdapter } from '../../src';
import type { TrpcContext } from '../../src/types/trpc';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5444/auth_test';

// Store tokens for testing - allows tests to retrieve tokens sent via email
const testTokenStore: {
  passwordResetTokens: Map<string, string>; // email -> token
  verificationCodes: Map<string, string>; // email -> code
  otpCodes: Map<string, number>; // email -> otp
} = {
  passwordResetTokens: new Map(),
  verificationCodes: new Map(),
  otpCodes: new Map(),
};

// Test email adapter that stores tokens instead of sending emails
function createTestEmailAdapter(): EmailAdapter {
  return {
    async sendVerificationEmail(email: string, code: string) {
      testTokenStore.verificationCodes.set(email, code);
      console.log(`[TestEmailAdapter] Stored verification code for ${email}. ${code}`);
    },
    async sendPasswordResetEmail(email: string, token: string) {
      testTokenStore.passwordResetTokens.set(email, token);
      console.log(`[TestEmailAdapter] Stored password reset token for ${email}. ${token}`);
    },
    async sendOTPEmail(email: string, otp: number) {
      testTokenStore.otpCodes.set(email, otp);
      console.log(`[TestEmailAdapter] Stored OTP for ${email}. ${otp}`);
    },
    async sendLoginNotification() {
      // No-op for tests
    },
  };
}

function getClientIp(req: CreateHTTPContextOptions['req']): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

const createContext = ({ req, res }: CreateHTTPContextOptions): TrpcContext => ({
  headers: req.headers,
  userId: null,
  sessionId: null,
  socketId: null,
  ip: getClientIp(req),
  res
});

  // Create PostgreSQL connection pool
  const pool = new Pool({ connectionString: DATABASE_URL });

  // Create Prisma adapter
  const adapter = new PrismaPg(pool);

  // Create Prisma client with adapter
  const prisma = new PrismaClient({ adapter });


  const { router: authRouter, t, authProcedure } = createAuthRouter({
    prisma: prisma,
    secrets: {
      jwt: 'test-jwt-secret-for-e2e-testing-only',
    },
    features: {
      twoFa: true,
      twoFaRequiresDevice: false, // Disable device requirement for testing
      biometric: false,
      emailVerification: true,
    },
    tokenSettings: {
      jwtExpiry: 60, // 60 seconds for testing
      passwordResetExpiryMs: 60 * 60 * 1000, // 1 hour
      otpValidityMs: 15 * 60 * 1000, // 15 minutes
    },
    cookieSettings: {
      secure: false,
      sameSite: 'Lax',
      path: '/',
    },
    emailService: createTestEmailAdapter(),
  });

  export const router = t.mergeRouters(
    authRouter,
    t.router({
      me: authProcedure.query(async ({ ctx }) => {
        const user = await prisma.user.findUnique({
          where: { id: ctx.userId },
          select: { id: true, email: true, username: true, twoFaEnabled: true }
        });
        return { user };
      })
    })
  );
  // Test database connection
  prisma.$connect();
  console.log('Connected to database');

  const server = createHTTPServer({
    router,
    createContext,
    onError: ({ error, path }) => {
      // Only log unexpected errors, not validation/auth errors that are expected in tests
      const expectedCodes = ['FORBIDDEN', 'BAD_REQUEST', 'UNAUTHORIZED', 'NOT_FOUND'];
      if (!expectedCodes.includes(error.code)) {
        console.error(`tRPC error on ${path}: [${error.code}] ${error.message} \nStack: ${error}`);
      }
    },
    middleware: (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Credentials', 'true');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Health check endpoint for Playwright
      if (req.url === '/' || req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }

      // Test-only endpoint to get stored tokens
      if (req.url?.startsWith('/test/tokens')) {
        const url = new URL(req.url, 'http://localhost');
        const email = url.searchParams.get('email');
        const type = url.searchParams.get('type');

        if (!email) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'email parameter required' }));
          return;
        }

        let token: string | number | undefined;
        if (type === 'passwordReset') {
          token = testTokenStore.passwordResetTokens.get(email);
        } else if (type === 'verification') {
          token = testTokenStore.verificationCodes.get(email);
        } else if (type === 'otp') {
          token = testTokenStore.otpCodes.get(email);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ token: token ?? null }));
        return;
      }

      next();
    },
  });

  server.listen(3457);
  console.log('E2E API server running on http://localhost:3457');
