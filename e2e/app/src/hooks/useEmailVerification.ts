import { useReducer } from 'react';
import { trpc, getErrorMessage } from '../trpc';

export interface VerificationStatus {
  email: string;
  isVerified: boolean;
  status: 'VERIFIED' | 'UNVERIFIED' | 'PENDING';
}

interface VerificationBannerState {
  sending: boolean;
  verifying: boolean;
  code: string;
  error: string | null;
  showCodeInput: boolean;
}

type VerificationBannerAction =
  | { type: 'SET_SENDING'; payload: boolean }
  | { type: 'SET_VERIFYING'; payload: boolean }
  | { type: 'SET_CODE'; payload: string }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SHOW_CODE_INPUT' }
  | { type: 'RESET_ERROR' };

function verificationBannerReducer(
  state: VerificationBannerState,
  action: VerificationBannerAction
): VerificationBannerState {
  switch (action.type) {
    case 'SET_SENDING':
      return { ...state, sending: action.payload };
    case 'SET_VERIFYING':
      return { ...state, verifying: action.payload };
    case 'SET_CODE':
      return { ...state, code: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SHOW_CODE_INPUT':
      return { ...state, showCodeInput: true };
    case 'RESET_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

export function useEmailVerification(
  status: VerificationStatus,
  onStatusChange: (status: VerificationStatus) => void
) {
  const [state, dispatch] = useReducer(verificationBannerReducer, {
    sending: false,
    verifying: false,
    code: '',
    error: null,
    showCodeInput: status.status === 'PENDING',
  });

  const setCode = (value: string) => dispatch({ type: 'SET_CODE', payload: value });

  const handleSendVerification = async () => {
    dispatch({ type: 'SET_SENDING', payload: true });
    dispatch({ type: 'RESET_ERROR' });
    try {
      await trpc.auth.sendVerificationEmail.mutate();
      dispatch({ type: 'SHOW_CODE_INPUT' });
      onStatusChange({ ...status, status: 'PENDING' });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: getErrorMessage(err) });
    } finally {
      dispatch({ type: 'SET_SENDING', payload: false });
    }
  };

  const handleVerify = async () => {
    dispatch({ type: 'SET_VERIFYING', payload: true });
    dispatch({ type: 'RESET_ERROR' });
    try {
      await trpc.auth.verifyEmail.mutate({ code: state.code });
      onStatusChange({ ...status, isVerified: true, status: 'VERIFIED' });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: getErrorMessage(err) });
    } finally {
      dispatch({ type: 'SET_VERIFYING', payload: false });
    }
  };

  return {
    state,
    setCode,
    handleSendVerification,
    handleVerify,
  };
}
