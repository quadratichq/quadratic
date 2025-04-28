import { TYPE } from '@/shared/constants/appConstants';
import { cn } from '@/shared/shadcn/utils';
import type { IconProps } from '@radix-ui/react-icons/dist/types';

export type EmptyStateProps = {
  description: React.ReactNode | string;
  Icon: React.ForwardRefExoticComponent<IconProps>;
  title: string;
  actions?: React.ReactNode;
  className?: string;
  isError?: boolean;
};

/**
 * Component for use in various places throughout the app when we want to display
 * what is essentially a 'no data' state, e.g. when a user has no files, or no connections.
 * It is also used when there are errors, or a 404, which is an "empty state".
 */
export function EmptyState({ title, description, actions, Icon, isError, className }: EmptyStateProps) {
  return (
    <div className={cn(`max-w mx-auto max-w-md px-2 text-center`, className)}>
      <div
        className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center border border-border text-muted-foreground`}
      >
        <Icon className={cn(`h-[30px] w-[30px]`, isError && 'text-destructive')} />
      </div>
      <h4 className={cn(TYPE.h4, `mb-1`, isError && 'text-destructive')}>{title}</h4>
      <div className={`text-sm text-muted-foreground`}>{description}</div>
      {actions && <div className={`mt-8`}>{actions}</div>}
    </div>
  );
}
