import { memo } from 'react';

interface JoinWithOrProps {
  arr: (number | string)[];
  className?: string;
}
export const JoinWithOr = memo(({ arr, className }: JoinWithOrProps) => {
  if (arr.length === 1) {
    return <span className={className}>{arr[0]}</span>;
  }

  return (
    <>
      <span className={className}>{arr.slice(0, -1).join(', ')}</span>
      {arr.length > 2 ? ',' : ''} or <span className={className}>{arr[arr.length - 1]}</span>
    </>
  );
});
