import {
  editorInteractionStateSettingsAtom,
  editorInteractionStateTeamUuidAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { ROUTES } from '@/shared/constants/routes';
import { DOCUMENTATION_ANALYTICS_AI } from '@/shared/constants/urls';
import { memo } from 'react';
import { useRecoilValue } from 'recoil';

export const AIUserMessageFormDisclaimer = memo(() => {
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);
  const teamSettings = useRecoilValue(editorInteractionStateSettingsAtom);
  return (
    <p className="select-none py-0.5 text-center text-xs text-muted-foreground">
      {teamSettings.analyticsAi
        ? 'Your data can be used to improve Quadratic. '
        : 'Some sheet data is sent to the AI model. '}
      <a
        href={teamSettings.analyticsAi ? ROUTES.TEAM_SETTINGS(teamUuid) : DOCUMENTATION_ANALYTICS_AI}
        target="_blank"
        rel="noreferrer"
        className="underline hover:text-foreground"
      >
        Learn more.
      </a>
    </p>
  );
});
