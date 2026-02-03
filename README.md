# @factiii/auth

Drop-in authentication for tRPC. JWT sessions, OAuth, 2FA—all type-safe.

## Install

```bash
npm install @factiii/auth @prisma/client
```

## Setup

**1. Add Prisma models:**

```bash
npx @factiii/auth init
npx prisma generate && npx prisma db push
npx @factiii/auth doctor  # Verify setup
```

**2. Create auth router:**

```typescript
import { createAuthRouter } from '@factiii/auth';
import { prisma } from './prisma';

export const { router, authProcedure, createContext } = createAuthRouter({
  prisma,
  secrets: { jwt: process.env.JWT_SECRET! },
});
```

**3. Use protected routes:**

```typescript
const protectedRouter = router({
  getProfile: authProcedure.query(({ ctx }) => {
    return { userId: ctx.userId };
  }),
});
```

## Config

```typescript
createAuthRouter({
  prisma,
  secrets: { jwt: 'your-secret' },

  // Optional
  features: {
    emailVerification: true,
    twoFa: true,
    oauth: { google: true, apple: true },
    biometric: false,
  },
  oauthKeys: {
    google: { clientId: '...' },
    apple: { clientId: '...' },
  },
  emailService: {
    sendVerificationEmail: async (email, code) => {},
    sendPasswordResetEmail: async (email, token) => {},
    sendOTPEmail: async (email, otp) => {},
  },
  hooks: {
    onUserCreated: async (userId) => {},
    onUserLogin: async (userId, sessionId) => {},
    // ... 15+ lifecycle hooks
  },
  tokenSettings: {
    accessTokenExpiry: '5m',           // JWT expiry (default: 5 minutes)
    passwordResetExpiryMs: 3600000,    // Reset token expiry (default: 1 hour)
    otpValidityMs: 900000,             // OTP validity window (default: 15 minutes)
  },
});
```

## Procedures

Auth procedures: `register`, `login`, `logout`, `refresh`, `changePassword`, `resetPassword`, `oAuthLogin`, `enableTwofa`, `disableTwofa`, `sendVerificationEmail`, `verifyEmail`, and more.

## Lifecycle Hooks

```typescript
interface AuthHooks {
  // Registration & Login
  beforeRegister?: (input) => Promise<void>;
  beforeLogin?: (input) => Promise<void>;
  onUserCreated?: (userId, input) => Promise<void>;
  onUserLogin?: (userId, sessionId) => Promise<void>;

  // Sessions
  onSessionCreated?: (sessionId) => Promise<void>;
  onSessionRevoked?: (sessionId, socketId, reason) => Promise<void>;
  afterLogout?: (userId, sessionId, socketId) => Promise<void>;
  onRefresh?: (userId) => Promise<void>;

  // Security
  onPasswordChanged?: (userId) => Promise<void>;
  onEmailVerified?: (userId) => Promise<void>;
  onTwoFaStatusChanged?: (userId, enabled) => Promise<void>;
  onOAuthLinked?: (userId, provider) => Promise<void>;
  onBiometricVerified?: (userId) => Promise<void>;
  getBiometricTimeout?: () => Promise<number | null>;
}
```

## CLI

```bash
npx @factiii/auth init     # Copy Prisma schema to your project
npx @factiii/auth schema   # Print schema path for manual copying
npx @factiii/auth doctor   # Check setup for common issues
npx @factiii/auth help     # Show help
```

## License

MIT
