import { memo } from 'react';

interface JoinListWithProps {
  arr: (number | string)[];
  className?: string;
  conjunction?: string;
}
export const JoinListWith = memo(({ arr, className, conjunction = 'or' }: JoinListWithProps) => {
  if (arr.length === 1) {
    return <span className={className}>{arr[0]}</span>;
  }

  return (
    <>
      <span className={className}>{arr.slice(0, -1).join(', ')}</span>
      {arr.length > 2 ? ',' : ''} {conjunction} <span className={className}>{arr[arr.length - 1]}</span>
    </>
  );
});

/// Non-react version of JoinListWith
export const joinListWith = ({ arr, conjunction = 'or' }: JoinListWithProps): string => {
  if (arr.length === 1) {
    return arr[0] as string;
  }

  return `${arr.slice(0, -1).join(', ')}${arr.length > 2 ? ',' : ''} ${conjunction} ${arr[arr.length - 1]}`;
};
