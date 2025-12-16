import { canvasTeamUuidAtom } from '@/canvas/atoms/canvasAtom';
import { CanvasView } from '@/canvas/canvasView/CanvasView';
import { CanvasChat } from '@/canvas/chat/CanvasChat';
import { NodeInspector } from '@/canvas/canvasView/NodeInspector';
import { ExecutionProvider } from '@/canvas/execution/ExecutionContext';
import { useExecutionEngine } from '@/canvas/hooks/useExecutionEngine';
import type { CanvasLoaderData } from '@/routes/teams.$teamUuid.canvas';
import { QuadraticLogo } from '@/shared/components/QuadraticLogo';
import { ROUTES } from '@/shared/constants/routes';
import { ReactFlowProvider } from '@xyflow/react';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import { useEffect } from 'react';
import { Link } from 'react-router';
import { useSetRecoilState } from 'recoil';

interface CanvasProps {
  loaderData: CanvasLoaderData;
}

export function Canvas({ loaderData }: CanvasProps) {
  const { teamUuid, teamName, connections } = loaderData;
  const setTeamUuid = useSetRecoilState(canvasTeamUuidAtom);

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
          <span className="text-lg font-semibold">Canvas</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Prototype</span>
        </div>
        <div className="w-32" /> {/* Spacer for centering */}
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Panel - 1/3 width */}
        <div className="w-1/3 min-w-80 max-w-lg border-r border-border">
          <CanvasChat teamUuid={teamUuid} connections={connections} />
        </div>

        {/* Canvas Panel - 2/3 width */}
        <div className="relative flex-1">
          <ReactFlowProvider>
            <CanvasWithExecution />
          </ReactFlowProvider>
        </div>
      </div>
    </div>
  );
}

/**
 * Canvas wrapper that includes the execution engine.
 * Must be inside ReactFlowProvider and have access to Recoil state.
 */
function CanvasWithExecution() {
  // Initialize the execution engine - this sets up reactive execution
  const { executeCodeNode } = useExecutionEngine();

  return (
    <ExecutionProvider executeCodeNode={executeCodeNode}>
      <CanvasView />
      <NodeInspector />
    </ExecutionProvider>
  );
}
