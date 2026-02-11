import { useState, useEffect } from 'react';

interface UseCountdownReturn {
  timeLeft: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

/**
 * Countdown timer hook
 * @param initialSeconds - Initial countdown duration in seconds
 * @param autoReset - Whether to reset when countdown reaches 0 (default: true)
 * @param resetValue - Value to reset to (default: 180 seconds / 3 minutes)
 */
export function useCountdown(
  initialSeconds: number,
  autoReset: boolean = true,
  resetValue: number = 180
): UseCountdownReturn {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          return autoReset ? resetValue : 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoReset, resetValue]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isExpired = timeLeft === 0;

  return { timeLeft, minutes, seconds, isExpired };
}
