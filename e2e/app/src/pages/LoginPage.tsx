import { useReducer, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, getErrorMessage } from '../context/AuthContext';

interface LoginState {
  username: string;
  password: string;
  twoFaCode: string;
  requires2FA: boolean;
  loading: boolean;
  error: string | null;
}

type LoginAction =
  | { type: 'SET_USERNAME'; payload: string }
  | { type: 'SET_PASSWORD'; payload: string }
  | { type: 'SET_TWO_FA_CODE'; payload: string }
  | { type: 'SET_REQUIRES_2FA'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET_2FA' };

function loginReducer(state: LoginState, action: LoginAction): LoginState {
  switch (action.type) {
    case 'SET_USERNAME':
      return { ...state, username: action.payload };
    case 'SET_PASSWORD':
      return { ...state, password: action.payload };
    case 'SET_TWO_FA_CODE':
      return { ...state, twoFaCode: action.payload };
    case 'SET_REQUIRES_2FA':
      return { ...state, requires2FA: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'RESET_2FA':
      return { ...state, requires2FA: false, twoFaCode: '', error: null };
    default:
      return state;
  }
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [state, dispatch] = useReducer(loginReducer, {
    username: '',
    password: '',
    twoFaCode: '',
    requires2FA: false,
    loading: false,
    error: null,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      await login(state.username, state.password, state.requires2FA ? state.twoFaCode : undefined);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      if (errorMessage.toLowerCase().includes('2fa code required')) {
        dispatch({ type: 'SET_REQUIRES_2FA', payload: true });
      } else {
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Welcome Back</h1>
        <p className="auth-subtitle">
          {state.requires2FA ? 'Enter your 2FA code to continue' : 'Log in to your account'}
        </p>

        {state.error && <div className="error" data-testid="error">{state.error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          {!state.requires2FA ? (
            <>
              <div className="form-group">
                <label htmlFor="username">Username or Email</label>
                <input
                  type="text"
                  id="username"
                  value={state.username}
                  onChange={(e) => dispatch({ type: 'SET_USERNAME', payload: e.target.value })}
                  placeholder="Enter username or email"
                  autoComplete="username"
                  disabled={state.loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={state.password}
                  onChange={(e) => dispatch({ type: 'SET_PASSWORD', payload: e.target.value })}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={state.loading}
                />
              </div>
            </>
          ) : (
            <div className="form-group">
              <label htmlFor="twoFaCode">2FA Code</label>
              <input
                type="text"
                id="twoFaCode"
                value={state.twoFaCode}
                onChange={(e) => dispatch({ type: 'SET_TWO_FA_CODE', payload: e.target.value })}
                placeholder="Enter 6-digit code"
                autoComplete="one-time-code"
                maxLength={6}
                disabled={state.loading}
              />
              <span className="hint">Enter the code from your authenticator app</span>
            </div>
          )}

          <button type="submit" id="login-btn" disabled={state.loading} className="btn-primary">
            {state.loading ? 'Logging in...' : state.requires2FA ? 'Verify & Log In' : 'Log In'}
          </button>
        </form>

        {state.requires2FA && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'RESET_2FA' })}
            className="btn-link back-link"
          >
            Back to login
          </button>
        )}

        {!state.requires2FA && (
          <>
            <button type="button" onClick={() => navigate('/forgot-password')} className="btn-link forgot-link">
              Forgot your password?
            </button>

            <p className="auth-footer">
              Don't have an account?{' '}
              <button type="button" onClick={() => navigate('/signup')} className="btn-link">
                Sign up
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
