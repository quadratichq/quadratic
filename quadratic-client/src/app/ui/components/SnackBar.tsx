import { useState, useCallback } from 'react';

import { QuadraticSnackBar } from '@/app/ui/components/QuadraticSnackBar';

const defaultDuration = 3000;

export interface UseSnackBar {
  triggerSnackbar: (message: string, duration?: number) => void;

  setOpen: (open: boolean) => void;
  message: string;
  duration: number;
  open: boolean;
}

export const useSnackbar = (): UseSnackBar => {
  const [open, setOpen] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(defaultDuration);
  const [message, setMessage] = useState('');

  const triggerSnackbar = useCallback(
    (message: string, duration = defaultDuration) => {
      setMessage(message);
      setDuration(duration);
      setOpen(true);
    },
    [setOpen]
  );

  return {
    triggerSnackbar,
    message,
    duration,
    open,
    setOpen,
  };
};

export const SnackBar = (props: UseSnackBar): JSX.Element => {
  const { message, duration, open, setOpen } = props;
  return (
    <QuadraticSnackBar
      open={open}
      onClose={() => {
        setOpen(false);
      }}
      autoHideDuration={duration}
      message={message}
    />
  );
};
