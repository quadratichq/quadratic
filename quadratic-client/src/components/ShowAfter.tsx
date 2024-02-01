import { useEffect, useState } from 'react';

/**
 * `delay` indicates the number of milliseconds to wait until rendering the
 * child component.
 */
export const ShowAfter = ({ delay, children }: { delay: number; children: React.ReactElement }) => {
  const [show, setShow] = useState<boolean>(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(true);
    }, delay);

    // Cleanup function to clear the timeout if the component is unmounted before the delay
    return () => clearTimeout(timer);
  }, [delay]);

  return show ? children : null;
};
