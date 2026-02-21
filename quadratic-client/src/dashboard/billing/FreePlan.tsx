import { VITE_MAX_EDITABLE_FILES } from '@/env-vars';
import { Badge } from '@/shared/shadcn/ui/badge';
import { type ReactNode } from 'react';

export const FreePlan = ({
  className,
  showCurrentPlanBadge,
  children,
}: {
  children?: ReactNode;
  className?: string;
  showCurrentPlanBadge?: boolean;
}) => {
  return (
    <div className={`${className} flex h-full flex-col`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Free plan</h3>
        {showCurrentPlanBadge && <Badge>Current plan</Badge>}
      </div>
      <div className="flex flex-grow flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <span>Team members</span>
          <span className="font-medium">Limited</span>
        </div>
        <div className="flex items-center justify-between">
          <span>AI messages</span>
          <span className="font-medium">5/month</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Connections</span>
          <span className="font-medium">Limited</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Files</span>
          <span className="font-medium">{VITE_MAX_EDITABLE_FILES} editable files</span>
        </div>
      </div>

      <div className="mt-auto">{children}</div>
    </div>
  );
};
