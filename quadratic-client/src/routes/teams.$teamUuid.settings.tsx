import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { SettingControl } from '@/dashboard/components/SettingControl';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { getActionUpdateTeam, type TeamAction } from '@/routes/teams.$teamUuid';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { CheckIcon } from '@/shared/components/Icons';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { DOCUMENTATION_ANALYTICS_AI } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import type { TeamSettings } from 'quadratic-shared/typesAndSchemas';
import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useFetcher, useSubmit } from 'react-router-dom';

export const Component = () => {
  const {
    activeTeam: {
      team,
      userMakingRequest: { teamPermissions },
    },
  } = useDashboardRouteLoaderData();

  const submit = useSubmit();
  const fetcher = useFetcher({ key: 'update-team' });
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const [value, setValue] = useState<string>(team.name);
  const disabled = value === '' || value === team.name || fetcher.state !== 'idle';

  // Add state for AI rules text and track changes
  const [aiRulesText, setAiRulesText] = useState<string>(team.settings.aiRulesText ?? '');
  const [originalAiRulesText, setOriginalAiRulesText] = useState<string>(team.settings.aiRulesText ?? '');
  const aiRulesDisabled = aiRulesText === originalAiRulesText || fetcher.state !== 'idle';

  // Optimistic UI
  let optimisticSettings = team.settings;
  if (fetcher.state !== 'idle' && isJsonObject(fetcher.json)) {
    const optimisticData = fetcher.json as TeamAction['request.update-team'];

    if (optimisticData.settings) {
      optimisticSettings = { ...optimisticSettings, ...optimisticData.settings };
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (disabled) {
      return;
    }

    const data = getActionUpdateTeam({ name: value });
    submit(data, {
      method: 'POST',
      action: ROUTES.TEAM(team.uuid),
      encType: 'application/json',
      fetcherKey: `update-team`,
      navigate: false,
    });
  };

  const handleUpdatePreference = (key: keyof TeamSettings, checked: boolean) => {
    const data = getActionUpdateTeam({ settings: { [key]: checked } });
    submit(data, {
      method: 'POST',
      action: ROUTES.TEAM(team.uuid),
      encType: 'application/json',
      fetcherKey: `update-team`,
      navigate: false,
    });
  };

  // Add handler for AI rules form submission
  const handleAiRulesSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (aiRulesDisabled) return;

    const data = getActionUpdateTeam({ settings: { aiRulesText } });

    setOriginalAiRulesText(aiRulesText);
  };

  // If for some reason it failed, display an error
  useEffect(() => {
    if (fetcher.data && fetcher.data.ok === false) {
      addGlobalSnackbar('Failed to save. Try again later.', { severity: 'error' });
    }
  }, [fetcher.data, addGlobalSnackbar]);

  // If you don't have permission, you can't see this view
  if (!teamPermissions.includes('TEAM_EDIT')) {
    return <Navigate to={ROUTES.TEAM(team.uuid)} />;
  }

  return (
    <>
      <DashboardHeader title="Team settings" />
      <div className={`mt-6 flex flex-col gap-8`}>
        <Row>
          <Type variant="body2" className="font-bold">
            Name
          </Type>
          <form className="flex items-center gap-2" onSubmit={handleSubmit}>
            <Input value={value} onChange={(e) => setValue(e.target.value)} />
            <Button type="submit" disabled={disabled} variant="secondary">
              Save
            </Button>
          </form>
        </Row>

        {teamPermissions.includes('TEAM_MANAGE') && (
          <>
            <Row>
              <Type variant="body2" className="font-bold">
                AI
              </Type>

              <div>
                <div className="rounded border border-border px-3 py-2 shadow-sm">
                  <Type variant="body2" className="font-bold">AI rules</Type>
                  <p className="text-sm text-muted-foreground mb-2">
                    Set rules that Quadratic AI will follow. Make as verbose as necessary. Example: "When writing code only use Formulas." {' '}
                    <a href={DOCUMENTATION_ANALYTICS_AI} target="_blank" className="underline hover:text-primary">
                      Learn more
                    </a>
                  </p>
                  <form onSubmit={handleAiRulesSubmit}>
                    <textarea
                      className="mt-2 min-h-[120px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      placeholder="Enter AI rules here..."
                      value={aiRulesText}
                      onChange={(e) => setAiRulesText(e.target.value)}
                    />
                    <div className="mt-2 flex">
                      <Button type="submit" disabled={aiRulesDisabled} variant="secondary">
                        Save
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </Row>

            <Row>
              <Type variant="body2" className="font-bold">
                Privacy
              </Type>

              <div>
                <SettingControl
                  label="Improve AI results"
                  description={
                    <>
                      Help improve AI results by allowing Quadratic to store and analyze user prompts.{' '}
                      <a href={DOCUMENTATION_ANALYTICS_AI} target="_blank" className="underline hover:text-primary">
                        Learn more
                      </a>
                      .
                    </>
                  }
                  onCheckedChange={(checked) => {
                    handleUpdatePreference('analyticsAi', checked);
                  }}
                  checked={optimisticSettings.analyticsAi}
                  className="rounded border border-border px-3 py-2 shadow-sm"
                />
                <p className="mt-2 text-sm text-muted-foreground">
                  When using AI features your data is sent to our AI providers:
                </p>
                <ul className="mt-2 text-sm text-muted-foreground">
                  {['OpenAI', 'Anthropic', 'AWS Bedrock'].map((item, i) => (
                    <li className="flex items-center gap-2" key={i}>
                      <CheckIcon /> <span className="font-semibold">{item}:</span> zero-day data retention
                    </li>
                  ))}
                </ul>
              </div>
            </Row>
          </>
        )}
      </div>
    </>
  );
};

function Row(props: { children: ReactNode[]; className?: string }) {
  if (props.children.length !== 2) {
    throw new Error('Row must have exactly two children');
  }

  return (
    <div className={cn(`flex grid-cols-[160px_1fr] flex-col gap-2 sm:grid sm:max-w-2xl`, props.className)}>
      <div className="pt-2">{props.children[0]}</div>
      <div className="">{props.children[1]}</div>
    </div>
  );
}
