import { useReducer, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { trpc, getErrorMessage } from '../trpc';

interface ResetPasswordState {
  newPassword: string;
  confirmPassword: string;
  loading: boolean;
  validating: boolean;
  error: string | null;
  success: boolean;
  tokenValid: boolean;
}

type ResetPasswordAction =
  | { type: 'SET_NEW_PASSWORD'; payload: string }
  | { type: 'SET_CONFIRM_PASSWORD'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_VALIDATING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SUCCESS'; payload: boolean }
  | { type: 'SET_TOKEN_VALID'; payload: boolean }
  | { type: 'TOKEN_INVALID'; payload: string }
  | { type: 'RESET_SUCCESS' };

function resetPasswordReducer(state: ResetPasswordState, action: ResetPasswordAction): ResetPasswordState {
  switch (action.type) {
    case 'SET_NEW_PASSWORD':
      return { ...state, newPassword: action.payload };
    case 'SET_CONFIRM_PASSWORD':
      return { ...state, confirmPassword: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_VALIDATING':
      return { ...state, validating: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_SUCCESS':
      return { ...state, success: action.payload };
    case 'SET_TOKEN_VALID':
      return { ...state, tokenValid: action.payload };
    case 'TOKEN_INVALID':
      return { ...state, tokenValid: false, error: action.payload, validating: false };
    case 'RESET_SUCCESS':
      return { ...state, success: true, loading: false };
    default:
      return state;
  }
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [state, dispatch] = useReducer(resetPasswordReducer, {
    newPassword: '',
    confirmPassword: '',
    loading: false,
    validating: true,
    error: null,
    success: false,
    tokenValid: false,
  });

  useEffect(() => {
    const checkToken = async () => {
      if (!token) {
        dispatch({ type: 'TOKEN_INVALID', payload: 'No reset token provided.' });
        return;
      }

      try {
        const result = await trpc.auth.checkPasswordReset.query({ token });
        dispatch({ type: 'SET_TOKEN_VALID', payload: result.valid });
        if (!result.valid) {
          dispatch({ type: 'SET_ERROR', payload: 'This password reset link is invalid or has expired.' });
        }
      } catch (err) {
        dispatch({ type: 'TOKEN_INVALID', payload: getErrorMessage(err) });
      } finally {
        dispatch({ type: 'SET_VALIDATING', payload: false });
      }
    };
    checkToken();
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    dispatch({ type: 'SET_ERROR', payload: null });

    if (state.newPassword !== state.confirmPassword) {
      dispatch({ type: 'SET_ERROR', payload: 'Passwords do not match' });
      return;
    }

    if (state.newPassword.length < 6) {
      dispatch({ type: 'SET_ERROR', payload: 'Password must be at least 6 characters' });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      await trpc.auth.resetPassword.mutate({ token, password: state.newPassword });
      dispatch({ type: 'RESET_SUCCESS' });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: getErrorMessage(err) });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  if (state.validating) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="loading-spinner">
            <div className="spinner" />
          </div>
          <p className="auth-subtitle" style={{ textAlign: 'center', marginTop: '16px' }}>
            Validating reset link...
          </p>
        </div>
      </div>
    );
  }

  if (!state.tokenValid && !state.success) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="error-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1>Invalid Reset Link</h1>
          <p className="auth-subtitle">
            {state.error || 'This password reset link is invalid or has expired.'}
          </p>
          <button type="button" onClick={handleBackToLogin} className="btn-primary">
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (state.success) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="success-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h1>Password Reset Complete</h1>
          <p className="auth-subtitle">
            Your password has been successfully reset. You can now log in with your new password.
          </p>
          <button type="button" onClick={handleBackToLogin} className="btn-primary">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Set New Password</h1>
        <p className="auth-subtitle">Enter your new password below</p>

        {state.error && <div className="error" data-testid="error">{state.error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <input
              type="password"
              id="newPassword"
              value={state.newPassword}
              onChange={(e) => dispatch({ type: 'SET_NEW_PASSWORD', payload: e.target.value })}
              placeholder="Enter new password"
              autoComplete="new-password"
              disabled={state.loading}
              minLength={6}
            />
            <span className="hint">Must be at least 6 characters</span>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={state.confirmPassword}
              onChange={(e) => dispatch({ type: 'SET_CONFIRM_PASSWORD', payload: e.target.value })}
              placeholder="Confirm new password"
              autoComplete="new-password"
              disabled={state.loading}
            />
          </div>

          <button type="submit" disabled={state.loading} className="btn-primary">
            {state.loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <button type="button" onClick={handleBackToLogin} className="btn-link back-link">
          Back to Login
        </button>
      </div>
    </div>
  );
}
