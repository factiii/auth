import { createTRPCClient, httpLink, TRPCClientError, type TRPCLink, type TRPCClient } from '@trpc/client';
import { observable } from '@trpc/server/observable';
import superjson from 'superjson';
import type { AppRouter } from '../../server/trpc';

const parseJwt = (accessToken: string): { exp?: number; userId?: number } | null => {
  const base64Url = accessToken.split('.')[1];
  const base64 = base64Url?.replace(/-/g, '+').replace(/_/g, '/');
  if (!base64) return null;
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
};

const getAccessToken = () => {
  const cookies = typeof document === 'undefined' ? '' : document.cookie;
  if (!cookies.includes('auth-at=')) return '';
  return cookies.split('auth-at=')[1]?.split(';')[0] || '';
};

class ClientService {
  client: TRPCClient<AppRouter>;
  refreshLink: TRPCLink<AppRouter>;
  tokenExpiry: number | null = null;
  refreshingPromise: Promise<boolean> | null = null;

  constructor() {
    void this.setTokenExpiry();

    this.refreshLink = () => {
      return ({ next, op }) => {
        return observable((observer) => {
          const executeRequest = async () => {
            if (
              this.tokenExpiry &&
              Date.now() > this.tokenExpiry &&
              op.path !== 'auth.refresh'
            ) {
              if (!this.refreshingPromise) {
                this.refreshingPromise = this.client.auth.refresh
                  .query()
                  .then(() => {
                    void this.setTokenExpiry();
                    this.refreshingPromise = null;
                    return true;
                  })
                  .catch(() => {
                    this.refreshingPromise = null;
                    return false;
                  });
              }

              const refreshSuccess = await this.refreshingPromise;
              if (!refreshSuccess) {
                observer.error(new TRPCClientError('Refresh failed'));
                return;
              }
            }

            const unsubscribe = next(op).subscribe({
              next: (value) => {
                if (
                  op.path.includes('refresh') ||
                  op.path.includes('login') ||
                  op.path.includes('register')
                ) {
                  void this.setTokenExpiry();
                }
                observer.next(value);
              },
              error: (err) => {
                observer.error(err);
              },
              complete() {
                observer.complete();
              }
            });
            return unsubscribe;
          };
          void executeRequest();
        });
      };
    };

    this.client = createTRPCClient<AppRouter>({
      links: [
        this.refreshLink,
        httpLink({
          url: '/api',
          transformer: superjson,
          fetch(url, options) {
            return fetch(url, {
              ...options,
              credentials: 'include',
            });
          },
        }),
      ],
    });
  }

  async setTokenExpiry() {
    const at = getAccessToken();
    const exp = parseJwt(at)?.exp;
    if (exp && !isNaN(exp)) {
      this.tokenExpiry = exp * 1000 - 1000; // 1 second before actual expiry
    }
  }

  clearTokens() {
    this.tokenExpiry = null;
    this.refreshingPromise = null;
  }
}

export const service = new ClientService();
export const trpc = service.client;

export function isTRPCClientError(
  error: unknown
): error is TRPCClientError<AppRouter> {
  return error instanceof TRPCClientError;
}

export function getErrorMessage(error: unknown): string {
  if (isTRPCClientError(error)) {
    // Check for zod validation errors
    const zodError = error.data?.zodError;
    if (zodError) {
      const fieldErrors = zodError.fieldErrors;
      if (fieldErrors) {
        const firstField = Object.keys(fieldErrors)[0];
        if (firstField && fieldErrors[firstField]?.length) {
          return fieldErrors[firstField][0];
        }
      }
      if (zodError.formErrors?.length) {
        return zodError.formErrors[0];
      }
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}
