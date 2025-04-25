import { aiAnalystDelaySecondsAtom } from '@/app/atoms/aiAnalystAtom';
import { editorInteractionStateTeamUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { Button } from '@/shared/shadcn/ui/button';
import mixpanel from 'mixpanel-browser';
import { memo, useEffect } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

type AIUsageExceededProps = {
  show: boolean;
  delaySeconds?: number;
};

const divClassName =
  'mx-2 my-2 rounded-md border border-yellow-200 bg-yellow-50 px-2 py-1.5 text-xs font-medium dark:border-yellow-800 dark:bg-yellow-950/50';
const linkClassName = 'font-semibold text-primary hover:underline';

const showABTest = (teamUuid: string, probability: number) => {
  const hash = parseInt(teamUuid.replace(/-/g, '').slice(0, 8), 16) / 0xffffffff;
  return hash < probability;
};

export const AIUsageExceeded = memo(({ show, delaySeconds }: AIUsageExceededProps) => {
  const setDelaySeconds = useSetRecoilState(aiAnalystDelaySecondsAtom);
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);

  const showVariant = showABTest(teamUuid, 0.5);

  useEffect(() => {
    if (showVariant) {
      setDelaySeconds(999999999);
    }
  }, [setDelaySeconds, showVariant]);

  if (!show || !delaySeconds) {
    return null;
  }

  if (showVariant) {
    return (
      <div className={divClassName}>
        Monthly AI free tier exceeded. <br></br>Upgrade to Quadratic Pro to continue using Quadratic AI.
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              mixpanel.track('[AI].UsageExceeded.clickLearnMore', {
                ab_test: 'variant',
              });
              // go to the team settings page in a new tab
              window.open('/team/settings', '_blank');
            }}
            className="flex-1"
          >
            Learn more
          </Button>
          <Button
            onClick={() => {
              mixpanel.track('[AI].UsageExceeded.clickUpgrade', {
                ab_test: 'variant',
              });
              // navigate to the team settings page
              window.open('/team/settings', '_blank');
            }}
            className="flex-1"
          >
            Upgrade to Pro
          </Button>
        </div>
      </div>
    );
  } else {
    return (
      <div className={divClassName}>
        Message slowed. Wait {delaySeconds} seconds or{' '}
        <a
          href="/team/settings"
          target="_blank"
          rel="noreferrer"
          className={linkClassName}
          onClick={(e) => {
            e.stopPropagation();
            mixpanel.track('[AI].UsageExceeded.clickUpgrade', {
              ab_test: 'control',
            });
          }}
        >
          upgrade to Quadratic Pro
        </a>{' '}
        for more fast requests.
      </div>
    );
  }
});
