import { aiSpreadsheetTeamUuidAtom } from '@/aiSpreadsheet/atoms/aiSpreadsheetAtom';
import { AiSpreadsheetCanvas } from '@/aiSpreadsheet/canvas/AiSpreadsheetCanvas';
import { AiSpreadsheetChat } from '@/aiSpreadsheet/chat/AiSpreadsheetChat';
import { NodeInspector } from '@/aiSpreadsheet/canvas/NodeInspector';
import type { AiSpreadsheetLoaderData } from '@/routes/teams.$teamUuid.ai-spreadsheet';
import { QuadraticLogo } from '@/shared/components/QuadraticLogo';
import { ROUTES } from '@/shared/constants/routes';
import { ReactFlowProvider } from '@xyflow/react';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import { useEffect } from 'react';
import { Link } from 'react-router';
import { useSetRecoilState } from 'recoil';

interface AiSpreadsheetProps {
  loaderData: AiSpreadsheetLoaderData;
}

export function AiSpreadsheet({ loaderData }: AiSpreadsheetProps) {
  const { teamUuid, teamName, connections } = loaderData;
  const setTeamUuid = useSetRecoilState(aiSpreadsheetTeamUuidAtom);

  useEffect(() => {
    setTeamUuid(teamUuid);
  }, [teamUuid, setTeamUuid]);

  return (
    <div className="flex h-screen w-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Link
            to={ROUTES.TEAM(teamUuid)}
            className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            <span>Back to {teamName}</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <QuadraticLogo />
          <span className="text-lg font-semibold">AI Spreadsheet</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Prototype</span>
        </div>
        <div className="w-32" /> {/* Spacer for centering */}
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Panel - 1/3 width */}
        <div className="w-1/3 min-w-80 max-w-lg border-r border-border">
          <AiSpreadsheetChat teamUuid={teamUuid} connections={connections} />
        </div>

        {/* Canvas Panel - 2/3 width */}
        <div className="relative flex-1">
          <ReactFlowProvider>
            <AiSpreadsheetCanvas />
            <NodeInspector />
          </ReactFlowProvider>
        </div>
      </div>
    </div>
  );
}
