import { memo } from 'react';

type AIUsageExceededProps = {
  show: boolean;
  delaySeconds?: number;
};

export const AIUsageExceeded = memo(({ show, delaySeconds }: AIUsageExceededProps) => {
  if (!show || !delaySeconds) {
    return null;
  }

  return (
    <div className="mx-2 my-2 rounded-md border border-yellow-200 bg-yellow-50 px-2 py-1.5 text-xs font-medium dark:border-yellow-800 dark:bg-yellow-950/50">
      AI free tier exceeded. Wait {delaySeconds} seconds or{' '}
      <a
        href="/team/settings"
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-primary hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        upgrade to Quadratic Pro
      </a>
      .
    </div>
  );
});
