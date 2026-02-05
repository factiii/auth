import { useReducer, useEffect, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { trpc } from '../trpc';
import { useSettingsPanel } from '../hooks/useSettingsPanel';
import { useEmailVerification, type VerificationStatus } from '../hooks/useEmailVerification';

interface DashboardState {
  loggingOut: boolean;
  showSettings: boolean;
  verificationStatus: VerificationStatus | null;
}

type DashboardAction =
  | { type: 'SET_LOGGING_OUT'; payload: boolean }
  | { type: 'TOGGLE_SETTINGS' }
  | { type: 'SET_VERIFICATION_STATUS'; payload: VerificationStatus | null };

function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'SET_LOGGING_OUT':
      return { ...state, loggingOut: action.payload };
    case 'TOGGLE_SETTINGS':
      return { ...state, showSettings: !state.showSettings };
    case 'SET_VERIFICATION_STATUS':
      return { ...state, verificationStatus: action.payload };
    default:
      return state;
  }
}

export function Dashboard() {
  const { user, logout } = useAuth();
  const [state, dispatch] = useReducer(dashboardReducer, {
    loggingOut: false,
    showSettings: false,
    verificationStatus: null,
  });

  useEffect(() => {
    const fetchVerificationStatus = async () => {
      try {
        const result = await trpc.auth.getVerificationStatus.query();
        dispatch({ type: 'SET_VERIFICATION_STATUS', payload: result });
      } catch {
        // Email verification might not be enabled
      }
    };
    fetchVerificationStatus();
  }, []);

  const handleLogout = async () => {
    dispatch({ type: 'SET_LOGGING_OUT', payload: true });
    try {
      await logout();
    } finally {
      dispatch({ type: 'SET_LOGGING_OUT', payload: false });
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <div className="header-actions">
          <button
            type="button"
            onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })}
            className="btn-icon"
            aria-label="Settings"
          >
            <SettingsIcon />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            disabled={state.loggingOut}
            className="btn-secondary"
          >
            {state.loggingOut ? 'Logging out...' : 'Log Out'}
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        {state.verificationStatus && !state.verificationStatus.isVerified && (
          <EmailVerificationBanner
            status={state.verificationStatus}
            onStatusChange={(status) => dispatch({ type: 'SET_VERIFICATION_STATUS', payload: status })}
          />
        )}

        <div className="welcome-card">
          <div className="avatar">
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <h2>Welcome, {user?.username}!</h2>
            <p className="email">{user?.email}</p>
          </div>
        </div>

        {state.showSettings && (
          <SettingsPanel
            onVerificationChange={(status) => dispatch({ type: 'SET_VERIFICATION_STATUS', payload: status })}
          />
        )}

        <div className="stats-grid">
          <StatCard title="Account Status" value="Active" icon="check" />
          <StatCard title="User ID" value={`#${user?.id}`} icon="user" />
          <StatCard title="Sessions" value="1 active" icon="monitor" />
        </div>
      </main>
    </div>
  );
}

function EmailVerificationBanner({
  status,
  onStatusChange,
}: {
  status: VerificationStatus;
  onStatusChange: (status: VerificationStatus) => void;
}) {
  const { state, setCode, handleSendVerification, handleVerify } = useEmailVerification(status, onStatusChange);

  return (
    <div className="verification-banner" data-testid="verification-banner">
      <div className="verification-banner-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      </div>
      <div className="verification-banner-content">
        <strong>Verify your email</strong>
        <p>
          {status.status === 'PENDING'
            ? 'We sent a verification code to your email. Enter it below.'
            : 'Please verify your email address to secure your account.'}
        </p>
        {state.error && <div className="verification-error">{state.error}</div>}
        {state.showCodeInput ? (
          <div className="verification-code-form">
            <input
              type="text"
              id="verificationCode"
              value={state.code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter verification code"
              disabled={state.verifying}
            />
            <button
              type="button"
              onClick={handleVerify}
              disabled={state.verifying || state.code.length === 0}
              className="btn-primary"
            >
              {state.verifying ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSendVerification}
            disabled={state.sending}
            className="btn-secondary"
          >
            {state.sending ? 'Sending...' : 'Send Verification Email'}
          </button>
        )}
      </div>
    </div>
  );
}

function SettingsPanel({
  onVerificationChange: _onVerificationChange,
}: {
  onVerificationChange?: (status: VerificationStatus) => void;
}) {
  const { user } = useAuth();
  const {
    state,
    setCurrentPassword,
    setNewPassword,
    setTwoFaPassword,
    setResetUsername,
    setResetPassword,
    setResetOtp,
    showDisable2FAForm,
    showTwoFaResetForm,
    handleChangePassword,
    handleEndAllSessions,
    handleEnable2FA,
    handleDisable2FA,
    handleCancelDisable2FA,
    handleInitiate2FAReset,
    handleVerify2FAReset,
    handleCancelReset2FA,
  } = useSettingsPanel(user?.twoFaEnabled ?? false);

  return (
    <div className="settings-panel">
      <h3>Account Settings</h3>

      {state.message && (
        <div className={state.message.type === 'success' ? 'success' : 'error'} data-testid="settings-message">
          {state.message.text}
        </div>
      )}

      <form onSubmit={handleChangePassword} className="password-form">
        <h4>Change Password</h4>
        <div className="form-group">
          <label htmlFor="currentPassword">Current Password</label>
          <input
            type="password"
            id="currentPassword"
            value={state.currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={state.passwordLoading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="newPassword">New Password</label>
          <input
            type="password"
            id="newPassword"
            value={state.newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={state.passwordLoading}
          />
        </div>
        <button type="submit" disabled={state.passwordLoading} className="btn-primary">
          {state.passwordLoading ? 'Updating...' : 'Update Password'}
        </button>
      </form>

      <TwoFaSection
        state={state}
        setTwoFaPassword={setTwoFaPassword}
        setResetUsername={setResetUsername}
        setResetPassword={setResetPassword}
        setResetOtp={setResetOtp}
        showDisable2FAForm={showDisable2FAForm}
        showTwoFaResetForm={showTwoFaResetForm}
        handleEnable2FA={handleEnable2FA}
        handleDisable2FA={handleDisable2FA}
        handleCancelDisable2FA={handleCancelDisable2FA}
        handleInitiate2FAReset={handleInitiate2FAReset}
        handleVerify2FAReset={handleVerify2FAReset}
        handleCancelReset2FA={handleCancelReset2FA}
      />

      <div className="security-section">
        <h4>Security</h4>
        <p>End all other active sessions to log out of all other devices.</p>
        <button
          type="button"
          onClick={handleEndAllSessions}
          disabled={state.endingAllSessions}
          className="btn-danger"
        >
          {state.endingAllSessions ? 'Ending sessions...' : 'End All Other Sessions'}
        </button>
      </div>
    </div>
  );
}

function TwoFaSection({
  state,
  setTwoFaPassword,
  setResetUsername,
  setResetPassword,
  setResetOtp,
  showDisable2FAForm,
  showTwoFaResetForm,
  handleEnable2FA,
  handleDisable2FA,
  handleCancelDisable2FA,
  handleInitiate2FAReset,
  handleVerify2FAReset,
  handleCancelReset2FA,
}: {
  state: ReturnType<typeof useSettingsPanel>['state'];
  setTwoFaPassword: (value: string) => void;
  setResetUsername: (value: string) => void;
  setResetPassword: (value: string) => void;
  setResetOtp: (value: string) => void;
  showDisable2FAForm: () => void;
  showTwoFaResetForm: () => void;
  handleEnable2FA: () => Promise<void>;
  handleDisable2FA: () => Promise<void>;
  handleCancelDisable2FA: () => void;
  handleInitiate2FAReset: () => Promise<void>;
  handleVerify2FAReset: () => Promise<void>;
  handleCancelReset2FA: () => void;
}) {
  return (
    <div className="twofa-section" data-testid="twofa-section">
      <h4>Two-Factor Authentication</h4>
      {!state.twoFaEnabled ? (
        <>
          <p>Add an extra layer of security to your account.</p>
          <button
            type="button"
            onClick={handleEnable2FA}
            disabled={state.enabling2FA}
            className="btn-primary"
            data-testid="enable-2fa-btn"
          >
            {state.enabling2FA ? 'Enabling...' : 'Enable 2FA'}
          </button>
        </>
      ) : (
        <>
          <p className="twofa-status">
            <span className="status-badge status-enabled">Enabled</span>
            Two-factor authentication is active
          </p>
          {state.twoFaSecret && (
            <div className="twofa-secret" data-testid="twofa-secret">
              <strong>Your 2FA Secret:</strong>
              <code>{state.twoFaSecret}</code>
              <span className="hint">Save this key in your authenticator app</span>
            </div>
          )}
          {!state.showDisable2FA ? (
            <button
              type="button"
              onClick={showDisable2FAForm}
              className="btn-secondary"
              data-testid="show-disable-2fa-btn"
            >
              Disable 2FA
            </button>
          ) : (
            <div className="disable-2fa-form">
              <div className="form-group">
                <label htmlFor="twoFaPassword">Enter your password to disable 2FA</label>
                <input
                  type="password"
                  id="twoFaPassword"
                  value={state.twoFaPassword}
                  onChange={(e) => setTwoFaPassword(e.target.value)}
                  disabled={state.disabling2FA}
                />
              </div>
              <div className="btn-group">
                <button
                  type="button"
                  onClick={handleDisable2FA}
                  disabled={state.disabling2FA}
                  className="btn-danger"
                  data-testid="confirm-disable-2fa-btn"
                >
                  {state.disabling2FA ? 'Disabling...' : 'Confirm Disable'}
                </button>
                <button type="button" onClick={handleCancelDisable2FA} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {!state.showTwoFaReset ? (
        <button
          type="button"
          onClick={showTwoFaResetForm}
          className="btn-link"
          style={{ marginTop: '12px', display: 'block' }}
          data-testid="show-2fa-reset-btn"
        >
          Lost access to your authenticator? Reset 2FA
        </button>
      ) : (
        <TwoFaResetForm
          state={state}
          setResetUsername={setResetUsername}
          setResetPassword={setResetPassword}
          setResetOtp={setResetOtp}
          handleInitiate2FAReset={handleInitiate2FAReset}
          handleVerify2FAReset={handleVerify2FAReset}
          handleCancelReset2FA={handleCancelReset2FA}
        />
      )}
    </div>
  );
}

function TwoFaResetForm({
  state,
  setResetUsername,
  setResetPassword,
  setResetOtp,
  handleInitiate2FAReset,
  handleVerify2FAReset,
  handleCancelReset2FA,
}: {
  state: ReturnType<typeof useSettingsPanel>['state'];
  setResetUsername: (value: string) => void;
  setResetPassword: (value: string) => void;
  setResetOtp: (value: string) => void;
  handleInitiate2FAReset: () => Promise<void>;
  handleVerify2FAReset: () => Promise<void>;
  handleCancelReset2FA: () => void;
}) {
  return (
    <div className="twofa-reset-form" data-testid="twofa-reset-form">
      <h5>Reset 2FA</h5>
      {state.resetStep === 'credentials' ? (
        <>
          <div className="form-group">
            <label htmlFor="resetUsername">Username</label>
            <input
              type="text"
              id="resetUsername"
              value={state.resetUsername}
              onChange={(e) => setResetUsername(e.target.value)}
              disabled={state.resetting2FA}
            />
          </div>
          <div className="form-group">
            <label htmlFor="resetPassword">Password</label>
            <input
              type="password"
              id="resetPassword"
              value={state.resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              disabled={state.resetting2FA}
            />
          </div>
          <button
            type="button"
            onClick={handleInitiate2FAReset}
            disabled={state.resetting2FA}
            className="btn-primary"
            data-testid="initiate-2fa-reset-btn"
          >
            {state.resetting2FA ? 'Sending OTP...' : 'Send OTP to Email'}
          </button>
        </>
      ) : (
        <>
          <p>Enter the OTP code sent to your email</p>
          <div className="form-group">
            <label htmlFor="resetOtp">OTP Code</label>
            <input
              type="text"
              id="resetOtp"
              value={state.resetOtp}
              onChange={(e) => setResetOtp(e.target.value)}
              disabled={state.resetting2FA}
              maxLength={6}
            />
          </div>
          <button
            type="button"
            onClick={handleVerify2FAReset}
            disabled={state.resetting2FA}
            className="btn-primary"
            data-testid="verify-2fa-reset-btn"
          >
            {state.resetting2FA ? 'Verifying...' : 'Reset 2FA'}
          </button>
        </>
      )}
      <button
        type="button"
        onClick={handleCancelReset2FA}
        className="btn-link"
        style={{ marginTop: '8px' }}
      >
        Cancel
      </button>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: string }) {
  const icons: Record<string, ReactNode> = {
    check: <CheckIcon />,
    user: <UserIcon />,
    monitor: <MonitorIcon />,
  };

  return (
    <div className="stat-card">
      <div className="stat-icon">{icons[icon]}</div>
      <div className="stat-info">
        <span className="stat-title">{title}</span>
        <span className="stat-value">{value}</span>
      </div>
    </div>
  );
}

// Icons
function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}
