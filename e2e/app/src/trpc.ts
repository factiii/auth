import { createTRPCClient, httpLink, TRPCClientError, type TRPCLink, type TRPCClient } from '@trpc/client';
import { observable } from '@trpc/server/observable';
import superjson from 'superjson';
import type { AppRouter } from '../../server/trpc';

const getAccessToken = () => {
  const cookies = typeof document === 'undefined' ? '' : document.cookie;
  if (!cookies.includes('auth-token=')) return '';
  return cookies.split('auth-token=')[1]?.split(';')[0] || '';
};

class ClientService {
  client: TRPCClient<AppRouter>;
  refreshLink: TRPCLink<AppRouter>;
  refreshingPromise: Promise<boolean> | null = null;
  lastRefreshedAt = 0;

  constructor() {
    this.refreshLink = () => {
      return ({ next, op }) => {
        return observable((observer) => {
          const executeRequest = async () => {
            if (op.path !== 'auth.refresh') {
              const valid = await this.ensureTokenValidity();
              if (valid === false) {
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
                  this.lastRefreshedAt = Date.now();
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

  async ensureTokenValidity(): Promise<boolean> {
    if (!getAccessToken()) return true;

    const interval = 10_000; // 10 seconds for e2e testing

    if (Date.now() - this.lastRefreshedAt >= interval) {
      return this.refresh();
    }

    return true;
  }

  refresh(): Promise<boolean> {
    if (this.refreshingPromise) return this.refreshingPromise;

    this.refreshingPromise = this.client.auth.refresh
      .query()
      .then(() => {
        this.refreshingPromise = null;
        this.lastRefreshedAt = Date.now();
        return true;
      })
      .catch(() => {
        this.refreshingPromise = null;
        return false;
      });

    return this.refreshingPromise;
  }

  clearTokens() {
    this.refreshingPromise = null;
    this.lastRefreshedAt = 0;
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
