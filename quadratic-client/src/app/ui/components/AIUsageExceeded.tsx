import { ABTest } from '@/shared/components/ABTest';
import mixpanel from 'mixpanel-browser';
import { memo } from 'react';

type AIUsageExceededProps = {
  show: boolean;
  delaySeconds?: number;
};

const divClassName =
  'mx-2 my-2 rounded-md border border-yellow-200 bg-yellow-50 px-2 py-1.5 text-xs font-medium dark:border-yellow-800 dark:bg-yellow-950/50';
const linkClassName = 'font-semibold text-primary hover:underline';

export const AIUsageExceeded = memo(({ show, delaySeconds }: AIUsageExceededProps) => {
  if (!show || !delaySeconds) {
    return null;
  }

  return (
    <ABTest
      name="ai-usage-exceeded"
      probability={0.5}
      control={
        <div className={divClassName}>
          AI free tier exceeded. Wait {delaySeconds} seconds or{' '}
          <a
            href="/team/settings"
            target="_blank"
            rel="noreferrer"
            className={linkClassName}
            onClick={(e) => {
              e.stopPropagation();
              mixpanel.track('[AI].UsageExceeded.upgrade', { ab_test: 'control' });
            }}
          >
            upgrade to Quadratic Pro
          </a>
          .
        </div>
      }
      variant={
        <div className={divClassName}>
          Message slowed. Wait {delaySeconds} seconds or{' '}
          <a
            href="/team/settings"
            target="_blank"
            rel="noreferrer"
            className={linkClassName}
            onClick={(e) => {
              e.stopPropagation();
              mixpanel.track('[AI].UsageExceeded.upgrade', { ab_test: 'variant' });
            }}
          >
            upgrade to Quadratic Pro
          </a>{' '}
          for more fast requests.
        </div>
      }
    />
  );
});
