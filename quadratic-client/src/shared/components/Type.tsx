import { TYPE } from '@/shared/constants/appConstants';
import { cn } from '@/shared/shadcn/utils';
import type { ElementType } from 'react';

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
