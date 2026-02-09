import { editorInteractionStateShowCellTypeMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { QuadraticGrid } from '@/app/gridGL/QuadraticGrid';
import { embedSheetName } from '@/app/helpers/isEmbed';
import { FloatingFPS } from '@/app/ui/components/FloatingFPS';
import { CellTypeMenu } from '@/app/ui/menus/CellTypeMenu/CellTypeMenu';
import { CodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditor';
import { SheetBar } from '@/app/ui/menus/SheetBar/SheetBar';
import { Toolbar } from '@/app/ui/menus/Toolbar/Toolbar';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { apiClient, FILE_VERSION } from '@/shared/api/apiClient';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { QuadraticLogo } from '@/shared/components/QuadraticLogo';
import { ROUTES, SEARCH_PARAMS } from '@/shared/constants/routes';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Button } from '@/shared/shadcn/ui/button';
import { CrossCircledIcon } from '@radix-ui/react-icons';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { v4 as uuidv4 } from 'uuid';

/**
 * Button to open the file in the full Quadratic app.
 * Exports the current grid to S3 and redirects to the main app with a claim token.
 */
const EditInQuadraticButton = ({ showSheetBar }: { showSheetBar: boolean }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEditInQuadratic = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // 1. Generate claim token client-side
    const claimToken = uuidv4();

    // 2. Open the Quadratic app immediately (avoids popup blockers)
    // Redirect to the dedicated claim page after login
    const baseUrl = window.location.origin;
    const postAuthUrl = ROUTES.EMBED_CLAIM(claimToken);
    const redirectUrl = `${baseUrl}${ROUTES.LOGIN}?${SEARCH_PARAMS.REDIRECT_TO.KEY}=${encodeURIComponent(postAuthUrl)}`;
    window.open(redirectUrl, '_blank');

    try {
      // 3. Export the grid to Uint8Array
      const gridData = await quadraticCore.export();

      // 4. Get presigned upload URL from API (passing our claim token)
      const { uploadUrl } = await apiClient.embed.uploadRequest({ version: FILE_VERSION, claimToken });

      // 5. Upload the grid data to storage
      // Create a copy backed by a regular ArrayBuffer to avoid SharedArrayBuffer compatibility issues
      const buffer = new Uint8Array(gridData).buffer;
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: buffer,
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      setIsLoading(false);
    } catch (err) {
      setError('Failed to upload file. The opened tab may not work correctly.');
      setIsLoading(false);
    }
  }, []);

  return (
    <div className={`absolute right-2 z-10 flex flex-col items-end gap-1 ${showSheetBar ? 'bottom-10' : 'bottom-2'}`}>
      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {error}
        </div>
      )}
      <div className="rounded-md border border-border bg-background shadow-md">
        <Button variant="default" size="sm" className="gap-2" onClick={handleEditInQuadratic} disabled={isLoading}>
          <div className="flex h-2 w-2 items-center justify-center">
            <QuadraticLogo />
          </div>
          {isLoading ? 'Exporting…' : 'Edit in Quadratic'}
        </Button>
      </div>
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
  const showCellTypeMenu = useRecoilValue(editorInteractionStateShowCellTypeMenuAtom);

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
      <div className="flex items-center">
        <a
          href="https://app.quadratichq.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border-b border-r border-border transition-colors hover:bg-accent"
          title="Open Quadratic"
        >
          <QuadraticLogo />
        </a>
        <div className="min-w-0 flex-1 overflow-hidden">
          <Toolbar />
        </div>
      </div>
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
          <EditInQuadraticButton showSheetBar={!embedSheetName} />
          {!embedSheetName && <SheetBar />}
          <FloatingFPS />
        </div>
        <CodeEditor />
      </div>
      {showCellTypeMenu && <CellTypeMenu />}
    </div>
  );
}
