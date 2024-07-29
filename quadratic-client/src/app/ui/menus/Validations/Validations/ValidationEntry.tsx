import { Validation } from '@/app/quadratic-core-types';

interface Props {
  className?: string;
  validation: Validation;
}

export const ValidationEntry = (props: Props) => {
  const { validation, className } = props;

  return <div className={className} key={validation.id}></div>;
};
