import { editorInteractionStateFileUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { gridSettingsAtom } from '@/app/atoms/gridSettingsAtom';
import { EmbedUI } from '@/app/embed/EmbedUI';
import { PixiAppEffectsEmbed } from '@/app/embed/PixiAppEffectsEmbed';
import { useEmbedMcpPostMessage } from '@/app/embed/useEmbedMcpPostMessage';
import { WorkerLoadingIndicator } from '@/app/embed/WorkerLoadingIndicator';
import { Events } from '@/app/gridGL/Events';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { focusGrid } from '@/app/helpers/focusGrid';
import { TooltipProvider } from '@/shared/shadcn/ui/tooltip';
import { memo, useEffect, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

/**
 * Simplified app component for embed mode.
 * Unlike QuadraticApp, this doesn't wait for multiplayer or offline sync
 * since those features are disabled in embed mode.
 */
export const EmbedApp = memo(() => {
  // Ensure GridSettings are loaded before app starts
  useSetRecoilState(gridSettingsAtom);
  useEmbedMcpPostMessage();

  const fileUuid = useRecoilValue(editorInteractionStateFileUuidAtom);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (fileUuid && !pixiApp.initialized) {
      pixiApp.init().then(() => {
        setIsReady(true);
        // Focus the grid after initialization
        setTimeout(() => {
          focusGrid();
        }, 100);
      });
    } else if (fileUuid && pixiApp.initialized) {
      setIsReady(true);
      // Focus the grid if already initialized
      setTimeout(() => {
        focusGrid();
      }, 100);
    }
  }, [fileUuid]);

  if (!isReady) {
    return null;
  }

  return (
    <TooltipProvider skipDelayDuration={0} delayDuration={700}>
      <EmbedUI />
      <PixiAppEffectsEmbed />
      <Events />
      <WorkerLoadingIndicator />
    </TooltipProvider>
  );
});
