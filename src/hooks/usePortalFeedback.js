import { useCallback, useState } from 'react';

const DEFAULT_DURATION_MS = 5000;

export function usePortalFeedback() {
  const [feedback, setFeedback] = useState({
    open: false,
    message: '',
    severity: 'success',
    autoHideDuration: DEFAULT_DURATION_MS,
  });

  const showFeedback = useCallback((message, severity = 'success', options = {}) => {
    if (!message) return;
    setFeedback({
      open: true,
      message,
      severity,
      autoHideDuration: options.autoHideDuration ?? DEFAULT_DURATION_MS,
    });
  }, []);

  const closeFeedback = useCallback(() => {
    setFeedback((prev) => ({ ...prev, open: false }));
  }, []);

  return { feedback, showFeedback, closeFeedback };
}

