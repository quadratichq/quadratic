import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { getConnectionInfo } from '@/app/helpers/codeCellLanguage';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { PanelPositionBottomIcon, PanelPositionLeftIcon } from '@/app/ui/icons';
import { useCodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditorContext';
import { CodeEditorPanelData, PanelPosition } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { useRootRouteLoaderData } from '@/routes/_root';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { SchemaBrowser } from '@/shared/hooks/useSchemaBrowser';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { IconButton } from '@mui/material';
import { ClipboardCopyIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
import { MouseEvent, memo, useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { CodeEditorPanelBottom } from './CodeEditorPanelBottom';
import { CodeEditorPanelSide } from './CodeEditorPanelSide';

interface Props {
  codeEditorPanelData: CodeEditorPanelData;
}

export const CodeEditorPanel = memo((props: Props) => {
  const { isAuthenticated } = useRootRouteLoaderData();
  const {
    userMakingRequest: { teamPermissions },
  } = useFileRouteLoaderData();
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const connectionInfo = getConnectionInfo(editorInteractionState.mode);
  const isConnection = connectionInfo !== undefined;
  const { codeEditorPanelData } = props;
  const { panelPosition, setPanelPosition } = codeEditorPanelData;

  const changePanelPosition = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      setPanelPosition((prev: PanelPosition) => (prev === 'left' ? 'bottom' : 'left'));
      e.currentTarget.blur();
    },
    [setPanelPosition]
  );

  const { editorRef } = useCodeEditor();
  // <TooltipHint title="Insert query">
  //           <Button variant="ghost" onClick={onQuery} size="icon-sm" className="hover:bg-background">
  //             <ClipboardCopyIcon />
  //           </Button>
  //         </TooltipHint>

  // const onQuery = ;
  const showSchemaViewer = Boolean(isAuthenticated && isConnection && teamPermissions?.includes('TEAM_EDIT'));
  const schemaBrowser = showSchemaViewer ? (
    <SchemaBrowser
      connectionType={connectionInfo?.kind}
      connectionUuid={connectionInfo?.id}
      tableQueryAction={(query: string) => (
        <TooltipPopover label="Insert query">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              mixpanel.track('[Connections].schemaViewer.insertQuery');

              if (editorRef.current) {
                const model = editorRef.current.getModel();
                if (!model) return;

                const range = model.getFullModelRange();
                editorRef.current.executeEdits('insert-query', [
                  {
                    range,
                    text: query,
                  },
                ]);

                editorRef.current.focus();
              }
            }}
          >
            <ClipboardCopyIcon />
          </Button>
        </TooltipPopover>
      )}
    />
  ) : undefined;

  const showAiAssistant = Boolean(isAuthenticated);

  return (
    <>
      {/* Panel position (left/bottom) control */}
      <div className={cn('absolute z-10', panelPosition === 'bottom' ? 'right-1.5 top-1' : 'right-0.5 top-0.5')}>
        <TooltipHint title={panelPosition === 'bottom' ? 'Move panel left' : 'Move panel bottom'}>
          <IconButton onClick={changePanelPosition} size="small">
            {panelPosition === 'left' ? <PanelPositionBottomIcon /> : <PanelPositionLeftIcon />}
          </IconButton>
        </TooltipHint>
      </div>

      {panelPosition === 'left' && (
        <CodeEditorPanelSide
          schemaBrowser={schemaBrowser}
          showAiAssistant={showAiAssistant}
          codeEditorPanelData={props.codeEditorPanelData}
        />
      )}
      {panelPosition === 'bottom' && (
        <CodeEditorPanelBottom
          schemaBrowser={schemaBrowser}
          showAiAssistant={showAiAssistant}
          codeEditorPanelData={props.codeEditorPanelData}
        />
      )}
    </>
  );
});
