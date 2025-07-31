import type { JSX } from 'react';

export const joinWithOr = (arr: any[], className?: string): JSX.Element => {
  if (className) {
    if (arr.length === 1) {
      return <span className={className}>{arr[0]}</span>;
    }

    return (
      <>
        <span className={className}>{arr.slice(0, -1).join(', ')}</span> or{' '}
        <span className={className}>{arr[arr.length - 1]}</span>
      </>
    );
  }
  if (arr.length === 1) {
    return <span>{arr[0]}</span>;
  }

  return (
    <span>
      {arr.slice(0, -1).join(', ')} or ${arr[arr.length - 1]}
    </span>
  );
};
