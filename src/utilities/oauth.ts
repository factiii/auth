import appleSignin from 'apple-signin-auth';
import { OAuth2Client } from 'google-auth-library';

export type OAuthProvider = 'GOOGLE' | 'APPLE';

export interface OAuthResult {
  email: string;
  oauthId: string;
}

/**
 * OAuth keys configuration for Google and Apple providers
 */
export interface OAuthKeys {
  google?: {
    clientId: string;
    clientSecret?: string;
    iosClientId?: string;
  };
  apple?: {
    clientId: string;
    iosClientId?: string;
  };
}

/**
 * OAuth verification error
 */
export class OAuthVerificationError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 401
  ) {
    super(message);
    this.name = 'OAuthVerificationError';
  }
}

/**
 * Creates an OAuth token verifier with the provided keys
 * @param keys OAuth provider keys configuration
 * @returns A function to verify OAuth tokens
 */
export function createOAuthVerifier(keys: OAuthKeys) {
  let googleClient: OAuth2Client | null = null;
  if (keys.google?.clientId) {
    googleClient = new OAuth2Client({
      clientId: keys.google.clientId,
      clientSecret: keys.google.clientSecret,
    });
  }

  return async function verifyOAuthToken(
    provider: OAuthProvider,
    token: string,
    extra?: { email?: string }
  ): Promise<OAuthResult> {
    if (provider === 'GOOGLE') {
      if (!keys.google?.clientId) {
        throw new OAuthVerificationError('Google OAuth configuration missing', 500);
      }

      if (!googleClient) {
        throw new OAuthVerificationError('Google OAuth client not initialized', 500);
      }

      const audience = [keys.google.clientId];
      if (keys.google.iosClientId) {
        audience.push(keys.google.iosClientId);
      }

      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience,
      });

      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        throw new OAuthVerificationError('Invalid Google token', 401);
      }

      return {
        oauthId: payload.sub,
        email: payload.email,
      };
    }

    if (provider === 'APPLE') {
      if (!keys.apple?.clientId) {
        throw new OAuthVerificationError('Apple OAuth configuration missing', 500);
      }

      const audience = [keys.apple.clientId];
      if (keys.apple.iosClientId) {
        audience.push(keys.apple.iosClientId);
      }

      const { sub, email } = await appleSignin.verifyIdToken(token, {
        audience,
        ignoreExpiration: false,
      });

      const finalEmail = email || extra?.email;
      if (!finalEmail || !sub) {
        throw new OAuthVerificationError('Invalid Apple token', 401);
      }

      return {
        oauthId: sub,
        email: finalEmail,
      };
    }

    throw new OAuthVerificationError('Unsupported OAuth provider', 400);
  };
}
