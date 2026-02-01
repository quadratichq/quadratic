import { events } from '@/app/events/events';
import { QuadraticGrid } from '@/app/gridGL/QuadraticGrid';
import { FloatingFPS } from '@/app/ui/components/FloatingFPS';
import { CodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditor';
import { SheetBar } from '@/app/ui/menus/SheetBar/SheetBar';
import { Toolbar } from '@/app/ui/menus/Toolbar/Toolbar';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { QuadraticLogo } from '@/shared/components/QuadraticLogo';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Button } from '@/shared/shadcn/ui/button';
import { CrossCircledIcon } from '@radix-ui/react-icons';
import { useEffect, useState } from 'react';

/**
 * Button to open the file in the full Quadratic app.
 * Currently non-functional - will be implemented in a future update.
 */
const EditInQuadraticButton = () => {
  return (
    <div className="absolute bottom-10 right-2 z-10 flex justify-end rounded-md border border-border bg-background shadow-md">
      <Button
        variant="default"
        size="sm"
        className="gap-2"
        onClick={() => {
          // TODO: Implement - will open the file in the full Quadratic app
          console.log('Edit in Quadratic - to be implemented');
        }}
      >
        <div className="flex h-2 w-2 items-center justify-center">
          <QuadraticLogo />
        </div>
        Edit in Quadratic
      </Button>
    </div>
  );
};

/**
 * Simplified UI for embed mode.
 * This bypasses the complex hooks and components used in the main app.
 * Features excluded: AI, multiplayer, connections, scheduled tasks, sharing, etc.
 */
export function EmbedUI() {
  const [error, setError] = useState<{ from: string; error: Error | unknown } | null>(null);

  useEffect(() => {
    const handleError = (from: string, error: Error | unknown) => setError({ from, error });
    events.on('coreError', handleError);
    return () => {
      events.off('coreError', handleError);
    };
  }, []);

  useRemoveInitialLoadingUI();

  if (error) {
    return (
      <EmptyPage
        title="Quadratic crashed"
        description="Something went wrong. Please reload the application to continue."
        Icon={CrossCircledIcon}
        actions={<Button onClick={() => window.location.reload()}>Reload</Button>}
        error={error.error}
        source={error.from}
      />
    );
  }

  return (
    <div
      id="quadratic-ui"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Toolbar />
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <QuadraticGrid />
          <EditInQuadraticButton />
          <SheetBar />
          <FloatingFPS />
        </div>
        <CodeEditor />
      </div>
    </div>
  );
}
