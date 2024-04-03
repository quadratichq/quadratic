import { cn } from '@/shadcn/utils';
import { ElementType } from 'react';
import { TYPE } from '../constants/appConstants';

type Props = {
  children: React.ReactNode;
  className?: string;
  variant?: keyof typeof TYPE;
  as?: ElementType;
};

export const Type: React.FC<Props> = ({ children, className, variant, as: Component = 'div' }) => {
  if (!variant) {
    variant = 'body2';
  }

  return <Component className={cn(TYPE[variant], className)}>{children}</Component>;
};
