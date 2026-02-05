import { useReducer } from 'react';
import { trpc, getErrorMessage } from '../trpc';

interface SettingsPanelState {
  currentPassword: string;
  newPassword: string;
  passwordLoading: boolean;
  message: { type: 'success' | 'error'; text: string } | null;
  endingAllSessions: boolean;
  twoFaEnabled: boolean;
  twoFaSecret: string | null;
  enabling2FA: boolean;
  disabling2FA: boolean;
  twoFaPassword: string;
  showDisable2FA: boolean;
  showTwoFaReset: boolean;
  resetUsername: string;
  resetPassword: string;
  resetOtp: string;
  resetStep: 'credentials' | 'otp';
  resetting2FA: boolean;
}

type SettingsPanelAction =
  | { type: 'SET_CURRENT_PASSWORD'; payload: string }
  | { type: 'SET_NEW_PASSWORD'; payload: string }
  | { type: 'SET_PASSWORD_LOADING'; payload: boolean }
  | { type: 'SET_MESSAGE'; payload: { type: 'success' | 'error'; text: string } | null }
  | { type: 'CLEAR_PASSWORD_FORM' }
  | { type: 'SET_ENDING_ALL_SESSIONS'; payload: boolean }
  | { type: 'SET_TWO_FA_PASSWORD'; payload: string }
  | { type: 'SET_SHOW_DISABLE_2FA'; payload: boolean }
  | { type: 'ENABLE_2FA_SUCCESS'; payload: string }
  | { type: 'DISABLE_2FA_SUCCESS' }
  | { type: 'SET_ENABLING_2FA'; payload: boolean }
  | { type: 'SET_DISABLING_2FA'; payload: boolean }
  | { type: 'SET_SHOW_TWO_FA_RESET'; payload: boolean }
  | { type: 'SET_RESET_USERNAME'; payload: string }
  | { type: 'SET_RESET_PASSWORD'; payload: string }
  | { type: 'SET_RESET_OTP'; payload: string }
  | { type: 'SET_RESET_STEP'; payload: 'credentials' | 'otp' }
  | { type: 'SET_RESETTING_2FA'; payload: boolean }
  | { type: 'RESET_2FA_SUCCESS' }
  | { type: 'SET_TWO_FA_ENABLED'; payload: boolean };

function settingsPanelReducer(state: SettingsPanelState, action: SettingsPanelAction): SettingsPanelState {
  switch (action.type) {
    case 'SET_CURRENT_PASSWORD':
      return { ...state, currentPassword: action.payload };
    case 'SET_NEW_PASSWORD':
      return { ...state, newPassword: action.payload };
    case 'SET_PASSWORD_LOADING':
      return { ...state, passwordLoading: action.payload };
    case 'SET_MESSAGE':
      return { ...state, message: action.payload };
    case 'CLEAR_PASSWORD_FORM':
      return { ...state, currentPassword: '', newPassword: '' };
    case 'SET_ENDING_ALL_SESSIONS':
      return { ...state, endingAllSessions: action.payload };
    case 'SET_TWO_FA_PASSWORD':
      return { ...state, twoFaPassword: action.payload };
    case 'SET_SHOW_DISABLE_2FA':
      return { ...state, showDisable2FA: action.payload };
    case 'ENABLE_2FA_SUCCESS':
      return { ...state, twoFaSecret: action.payload, twoFaEnabled: true };
    case 'DISABLE_2FA_SUCCESS':
      return {
        ...state,
        twoFaEnabled: false,
        twoFaSecret: null,
        twoFaPassword: '',
        showDisable2FA: false,
      };
    case 'SET_ENABLING_2FA':
      return { ...state, enabling2FA: action.payload };
    case 'SET_DISABLING_2FA':
      return { ...state, disabling2FA: action.payload };
    case 'SET_SHOW_TWO_FA_RESET':
      return { ...state, showTwoFaReset: action.payload };
    case 'SET_RESET_USERNAME':
      return { ...state, resetUsername: action.payload };
    case 'SET_RESET_PASSWORD':
      return { ...state, resetPassword: action.payload };
    case 'SET_RESET_OTP':
      return { ...state, resetOtp: action.payload };
    case 'SET_RESET_STEP':
      return { ...state, resetStep: action.payload };
    case 'SET_RESETTING_2FA':
      return { ...state, resetting2FA: action.payload };
    case 'RESET_2FA_SUCCESS':
      return {
        ...state,
        twoFaEnabled: false,
        showTwoFaReset: false,
        resetStep: 'credentials',
        resetUsername: '',
        resetPassword: '',
        resetOtp: '',
      };
    case 'SET_TWO_FA_ENABLED':
      return { ...state, twoFaEnabled: action.payload };
    default:
      return state;
  }
}

const initialState: SettingsPanelState = {
  currentPassword: '',
  newPassword: '',
  passwordLoading: false,
  message: null,
  endingAllSessions: false,
  twoFaEnabled: false,
  twoFaSecret: null,
  enabling2FA: false,
  disabling2FA: false,
  twoFaPassword: '',
  showDisable2FA: false,
  showTwoFaReset: false,
  resetUsername: '',
  resetPassword: '',
  resetOtp: '',
  resetStep: 'credentials',
  resetting2FA: false,
};

export function useSettingsPanel(twoFaEnabled: boolean = false) {
  const [state, dispatch] = useReducer(settingsPanelReducer, {
    ...initialState,
    twoFaEnabled,
  });

  const setCurrentPassword = (value: string) => dispatch({ type: 'SET_CURRENT_PASSWORD', payload: value });
  const setNewPassword = (value: string) => dispatch({ type: 'SET_NEW_PASSWORD', payload: value });
  const setTwoFaPassword = (value: string) => dispatch({ type: 'SET_TWO_FA_PASSWORD', payload: value });
  const setResetUsername = (value: string) => dispatch({ type: 'SET_RESET_USERNAME', payload: value });
  const setResetPassword = (value: string) => dispatch({ type: 'SET_RESET_PASSWORD', payload: value });
  const setResetOtp = (value: string) => dispatch({ type: 'SET_RESET_OTP', payload: value });
  const showDisable2FAForm = () => dispatch({ type: 'SET_SHOW_DISABLE_2FA', payload: true });
  const showTwoFaResetForm = () => dispatch({ type: 'SET_SHOW_TWO_FA_RESET', payload: true });

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: 'SET_PASSWORD_LOADING', payload: true });
    dispatch({ type: 'SET_MESSAGE', payload: null });

    try {
      const result = await trpc.auth.changePassword.mutate({
        currentPassword: state.currentPassword,
        newPassword: state.newPassword,
      });
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: result.message } });
      dispatch({ type: 'CLEAR_PASSWORD_FORM' });
    } catch (err) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: getErrorMessage(err) } });
    } finally {
      dispatch({ type: 'SET_PASSWORD_LOADING', payload: false });
    }
  };

  const handleEndAllSessions = async () => {
    if (!confirm('This will log you out of all other devices. Continue?')) return;

    dispatch({ type: 'SET_ENDING_ALL_SESSIONS', payload: true });
    try {
      const result = await trpc.auth.endAllSessions.mutate({ skipCurrentSession: true });
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: `Ended ${result.revokedCount} session(s)` } });
    } catch (err) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: getErrorMessage(err) } });
    } finally {
      dispatch({ type: 'SET_ENDING_ALL_SESSIONS', payload: false });
    }
  };

  const handleEnable2FA = async () => {
    dispatch({ type: 'SET_ENABLING_2FA', payload: true });
    dispatch({ type: 'SET_MESSAGE', payload: null });
    try {
      const result = await trpc.auth.enableTwofa.mutate();
      dispatch({ type: 'ENABLE_2FA_SUCCESS', payload: result.secret });
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: '2FA has been enabled. Save your secret key!' } });
    } catch (err) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: getErrorMessage(err) } });
    } finally {
      dispatch({ type: 'SET_ENABLING_2FA', payload: false });
    }
  };

  const handleDisable2FA = async () => {
    if (!state.twoFaPassword) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: 'Please enter your password to disable 2FA' } });
      return;
    }

    dispatch({ type: 'SET_DISABLING_2FA', payload: true });
    dispatch({ type: 'SET_MESSAGE', payload: null });
    try {
      await trpc.auth.disableTwofa.mutate({ password: state.twoFaPassword });
      dispatch({ type: 'DISABLE_2FA_SUCCESS' });
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: '2FA has been disabled' } });
    } catch (err) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: getErrorMessage(err) } });
    } finally {
      dispatch({ type: 'SET_DISABLING_2FA', payload: false });
    }
  };

  const handleCancelDisable2FA = () => {
    dispatch({ type: 'SET_SHOW_DISABLE_2FA', payload: false });
    dispatch({ type: 'SET_TWO_FA_PASSWORD', payload: '' });
  };

  const handleInitiate2FAReset = async () => {
    dispatch({ type: 'SET_RESETTING_2FA', payload: true });
    dispatch({ type: 'SET_MESSAGE', payload: null });
    try {
      await trpc.auth.twoFaReset.mutate({
        username: state.resetUsername,
        password: state.resetPassword,
      });
      dispatch({ type: 'SET_RESET_STEP', payload: 'otp' });
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: 'Check your email for the OTP code' } });
    } catch (err) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: getErrorMessage(err) } });
    } finally {
      dispatch({ type: 'SET_RESETTING_2FA', payload: false });
    }
  };

  const handleVerify2FAReset = async () => {
    dispatch({ type: 'SET_RESETTING_2FA', payload: true });
    dispatch({ type: 'SET_MESSAGE', payload: null });
    try {
      await trpc.auth.twoFaResetVerify.mutate({
        username: state.resetUsername,
        code: parseInt(state.resetOtp, 10),
      });
      dispatch({ type: 'RESET_2FA_SUCCESS' });
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'success', text: '2FA has been reset successfully' } });
    } catch (err) {
      dispatch({ type: 'SET_MESSAGE', payload: { type: 'error', text: getErrorMessage(err) } });
    } finally {
      dispatch({ type: 'SET_RESETTING_2FA', payload: false });
    }
  };

  const handleCancelReset2FA = () => {
    dispatch({ type: 'SET_SHOW_TWO_FA_RESET', payload: false });
    dispatch({ type: 'SET_RESET_STEP', payload: 'credentials' });
    dispatch({ type: 'SET_RESET_USERNAME', payload: '' });
    dispatch({ type: 'SET_RESET_PASSWORD', payload: '' });
    dispatch({ type: 'SET_RESET_OTP', payload: '' });
  };

  return {
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
  };
}
