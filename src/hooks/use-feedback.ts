// Title: Global Feedback Hook
// Path: src/hooks/use-feedback.ts
// Functionality: Centralizes toast and error state. Callbacks are memoized with
//   useCallback to keep effect dependencies stable.

import { useState, useCallback } from 'react';
import { UI_TIMING } from '@/config/limits';

export function useFeedback() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), UI_TIMING.successToastMs);
  }, []);

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), UI_TIMING.errorToastMs);
  }, []);

  const clearFeedback = useCallback(() => {
    setErrorMsg(null);
    setSuccessMsg(null);
  }, []);

  return { errorMsg, successMsg, showToast, showError, clearFeedback };
}