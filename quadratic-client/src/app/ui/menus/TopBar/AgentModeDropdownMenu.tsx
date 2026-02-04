import { createNewFileAction, deleteFile, duplicateFileAction } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import {
  editorInteractionStateFileUuidAtom,
  editorInteractionStatePermissionsAtom,
  editorInteractionStateShowCellTypeMenuAtom,
  editorInteractionStateShowIsRunningAsyncActionAtom,
  editorInteractionStateTeamUuidAtom,
  editorInteractionStateTransactionsInfoAtom,
  editorInteractionStateUserAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import {
  presentationModeAtom,
  showAIAnalystOnStartupAtom,
  showCellTypeOutlinesAtom,
  showCodePeekAtom,
  showGridLinesAtom,
  showHeadingsAtom,
  showScrollbarsAtom,
} from '@/app/atoms/gridSettingsAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { focusGrid } from '@/app/helpers/focusGrid';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import type { CellFormatSummary } from '@/app/quadratic-core-types';
import { BorderMenu } from '@/app/ui/components/BorderMenu';
import { ColorPicker } from '@/app/ui/components/ColorPicker';
import { DateFormat } from '@/app/ui/components/DateFormat';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { useIsAvailableArgs } from '@/app/ui/hooks/useIsAvailableArgs';
import { AgentModeDropdownMenuItem } from '@/app/ui/menus/TopBar/AgentModeDropdownMenuItem';
import { SidebarTooltip } from '@/app/ui/QuadraticSidebar';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useRootRouteLoaderData } from '@/routes/_root';
import {
  BorderAllIcon,
  CheckSmallIcon,
  CodeIcon,
  CropFreeIcon,
  DataObjectIcon,
  DeleteIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileCopyIcon,
  FileIcon,
  FileOpenIcon,
  FormatAlignLeftIcon,
  FormatBoldIcon,
  FormatTextWrapIcon,
  InsertChartIcon,
  Number123Icon,
  SpinnerIcon,
  ThemeIcon,
  ZoomInIcon,
} from '@/shared/components/Icons';
import { QuadraticLogo } from '@/shared/components/QuadraticLogo';
import { ShowAfter } from '@/shared/components/ShowAfter';
import { ThemeCustomization } from '@/shared/components/ThemeCustomization';
import { ROUTES } from '@/shared/constants/routes';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import type { RecentFile } from '@/shared/utils/updateRecentFiles';
import { RECENT_FILES_KEY } from '@/shared/utils/updateRecentFiles';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSubmit } from 'react-router';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

const feedbackAction = defaultActionSpec[Action.HelpFeedback];

export function AgentModeDropdownMenu() {
  const isRunningAsyncAction = useRecoilValue(editorInteractionStateShowIsRunningAsyncActionAtom);
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const canEdit = useMemo(() => permissions.includes('FILE_EDIT'), [permissions]);

  return (
    <DropdownMenu>
      <SidebarTooltip label="Menu">
        <DropdownMenuTrigger asChild>
          <div
            className="group relative flex h-9 w-9 items-center justify-center rounded text-muted-foreground hover:bg-border"
            data-testid="back-to-dashboard-link"
          >
            <QuadraticLogo />
            {isRunningAsyncAction && (
              <ShowAfter delay={300}>
                <div className="absolute left-0 top-0 flex h-full w-full items-center justify-center bg-accent group-hover:hidden">
                  <SpinnerIcon className="text-primary" />
                </div>
              </ShowAfter>
            )}
          </div>
        </DropdownMenuTrigger>
      </SidebarTooltip>
      <DropdownMenuContent className="w-48">
        <DropdownMenuItem asChild>
          <Link to="/" reloadDocument>
            Back to dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="!block" />

        <FileDropdownMenu />
        <EditDropdownMenu />
        <ViewDropdownMenu />
        {canEdit && <InsertDropdownMenu />}
        {canEdit && <FormatDropdownMenu />}
        <HelpDropdownMenu />

        <DropdownMenuSeparator className="!block" />
        <DropdownMenuItem onClick={() => feedbackAction.run()}>{feedbackAction.label()}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =============================================================================
// File Menu
// =============================================================================

function FileDropdownMenu() {
  const { name } = useFileContext();
  const submit = useSubmit();
  const { isAuthenticated } = useRootRouteLoaderData();
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);
  const fileUuid = useRecoilValue(editorInteractionStateFileUuidAtom);
  const user = useRecoilValue(editorInteractionStateUserAtom);
  const isAvailableArgs = useIsAvailableArgs();

  const [recentFiles, setRecentFiles] = useLocalStorage<RecentFile[]>(RECENT_FILES_KEY, []);
  const recentFilesWithoutCurrentFile = useMemo(
    () => recentFiles.filter((file) => file.uuid !== fileUuid && file.name.trim().length > 0),
    [recentFiles, fileUuid]
  );

  if (!isAuthenticated) return null;

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>File</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {createNewFileAction.isAvailable(isAvailableArgs) && (
          <DropdownMenuItem className="gap-2" onClick={() => createNewFileAction.run({ teamUuid })}>
            <FileIcon />
            {createNewFileAction.label}
            <ExternalLinkIcon className="ml-auto !h-4 !w-4 text-center !text-xs text-muted-foreground opacity-50" />
          </DropdownMenuItem>
        )}
        {duplicateFileAction.isAvailable(isAvailableArgs) && (
          <DropdownMenuItem className="gap-2" onClick={() => duplicateFileAction.run({ fileUuid })}>
            <FileCopyIcon />
            Duplicate to personal files
            <ExternalLinkIcon className="ml-auto !h-4 !w-4 text-center !text-xs text-muted-foreground opacity-50" />
          </DropdownMenuItem>
        )}
        <AgentModeDropdownMenuItem action={Action.FileVersionHistory} actionArgs={{ uuid: fileUuid }} />

        {recentFilesWithoutCurrentFile.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2">
                <FileOpenIcon /> Open recent
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {recentFilesWithoutCurrentFile.map((file) => (
                  <DropdownMenuItem
                    onClick={() => {
                      window.location.href = ROUTES.FILE({ uuid: file.uuid, searchParams: '' });
                    }}
                    key={file.uuid}
                  >
                    {file.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setRecentFiles([])}>Clear</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}

        <DropdownMenuSeparator />

        <AgentModeDropdownMenuItem action={Action.FileShare} actionArgs={undefined} />
        <AgentModeDropdownMenuItem action={Action.FileRename} actionArgs={undefined} />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <DownloadIcon /> Download
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <AgentModeDropdownMenuItem action={Action.FileDownload} actionArgs={{ name, uuid: fileUuid }} />
            <AgentModeDropdownMenuItem action={Action.FileDownloadExcel} actionArgs={{ name, uuid: fileUuid }} />
            <DropdownMenuSeparator />
            <AgentModeDropdownMenuItem action={Action.FileDownloadCsv} actionArgs={{ name, uuid: fileUuid }} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {deleteFile.isAvailable(isAvailableArgs) && (
          <DropdownMenuItem
            className="gap-2"
            onClick={() =>
              deleteFile.run({
                fileUuid,
                userEmail: user?.email ?? '',
                redirect: true,
                submit,
              })
            }
          >
            <DeleteIcon />
            Delete
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <AgentModeDropdownMenuItem action={Action.HelpSettings} actionArgs={undefined} shortcutOverride="" />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

// =============================================================================
// Edit Menu
// =============================================================================

function EditDropdownMenu() {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Edit</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <AgentModeDropdownMenuItem action={Action.Undo} actionArgs={undefined} />
        <AgentModeDropdownMenuItem action={Action.Redo} actionArgs={undefined} />

        <DropdownMenuSeparator />

        <AgentModeDropdownMenuItem action={Action.Cut} actionArgs={undefined} />
        <AgentModeDropdownMenuItem action={Action.Copy} actionArgs={undefined} />
        <AgentModeDropdownMenuItem action={Action.Paste} actionArgs={undefined} />
        <AgentModeDropdownMenuItem action={Action.PasteValuesOnly} actionArgs={undefined} />
        <AgentModeDropdownMenuItem action={Action.PasteFormattingOnly} actionArgs={undefined} />

        <DropdownMenuSeparator />

        <AgentModeDropdownMenuItem action={Action.ShowGoToMenu} actionArgs={undefined} />
        <AgentModeDropdownMenuItem action={Action.FindInCurrentSheet} actionArgs={undefined} />
        <AgentModeDropdownMenuItem action={Action.FindInAllSheets} actionArgs={undefined} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

// =============================================================================
// View Menu
// =============================================================================

const DropdownMenuItemCheckbox = ({ checked }: { checked: boolean }) => {
  return <CheckSmallIcon className={checked ? 'visible opacity-100' : 'invisible opacity-0'} />;
};

function ViewDropdownMenu() {
  const [showHeadings, setShowHeadings] = useRecoilState(showHeadingsAtom);
  const [showGridLines, setShowGridLines] = useRecoilState(showGridLinesAtom);
  const [showCellTypeOutlines, setShowCellTypeOutlines] = useRecoilState(showCellTypeOutlinesAtom);
  const [showCodePeek, setShowCodePeek] = useRecoilState(showCodePeekAtom);
  const [showScrollbars, setShowScrollbars] = useRecoilState(showScrollbarsAtom);
  const [showAIAnalystOnStartup, setShowAIAnalystOnStartup] = useRecoilState(showAIAnalystOnStartupAtom);
  const setPresentationMode = useSetRecoilState(presentationModeAtom);
  const [isThemeSubmenuOpen, setIsThemeSubmenuOpen] = useState(false);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>View</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuItem className="gap-2" onClick={() => setShowHeadings((prev) => !prev)}>
          <DropdownMenuItemCheckbox checked={showHeadings} /> Show row and column headings
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onClick={() => setShowGridLines((prev) => !prev)}>
          <DropdownMenuItemCheckbox checked={showGridLines} />
          Show grid lines
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onClick={() => setShowCellTypeOutlines((prev) => !prev)}>
          <DropdownMenuItemCheckbox checked={showCellTypeOutlines} />
          Show code cell outlines
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onClick={() => setShowAIAnalystOnStartup((prev) => !prev)}>
          <DropdownMenuItemCheckbox checked={showAIAnalystOnStartup} />
          Show AI on startup
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onClick={() => setShowCodePeek((prev) => !prev)}>
          <DropdownMenuItemCheckbox checked={showCodePeek} />
          Show code peek
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onClick={() => setShowScrollbars((prev) => !prev)}>
          <DropdownMenuItemCheckbox checked={showScrollbars} />
          Show scrollbars
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <ZoomInIcon /> Zoom
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <AgentModeDropdownMenuItem action={Action.ZoomIn} actionArgs={undefined} />
            <AgentModeDropdownMenuItem action={Action.ZoomOut} actionArgs={undefined} />
            <DropdownMenuSeparator />
            <AgentModeDropdownMenuItem action={Action.ZoomToSelection} actionArgs={undefined} />
            <AgentModeDropdownMenuItem action={Action.ZoomToFit} actionArgs={undefined} />
            <DropdownMenuSeparator />
            <AgentModeDropdownMenuItem action={Action.ZoomTo50} actionArgs={undefined} />
            <AgentModeDropdownMenuItem action={Action.ZoomTo100} actionArgs={undefined} />
            <AgentModeDropdownMenuItem action={Action.ZoomTo200} actionArgs={undefined} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem className="gap-2" onClick={() => setPresentationMode((prev) => !prev)}>
          <CropFreeIcon />
          Presentation mode
          <DropdownMenuShortcut>{KeyboardSymbols.Command + '.'}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub open={isThemeSubmenuOpen} onOpenChange={setIsThemeSubmenuOpen}>
          <DropdownMenuSubTrigger className="gap-2">
            <ThemeIcon /> Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-80">
            <div className="p-4">
              <h2 className="text-md font-semibold">Theme customization</h2>
              <p className="mb-4 text-xs text-muted-foreground">Pick a style that fits you</p>
              {isThemeSubmenuOpen && <ThemeCustomization />}
            </div>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

// =============================================================================
// Insert Menu
// =============================================================================

function InsertDropdownMenu() {
  const setShowCellTypeMenu = useSetRecoilState(editorInteractionStateShowCellTypeMenuAtom);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Insert</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <CodeIcon /> Code
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <AgentModeDropdownMenuItem action={Action.InsertCodePython} actionArgs={undefined} />
            <AgentModeDropdownMenuItem action={Action.InsertCodeJavascript} actionArgs={undefined} />
            <AgentModeDropdownMenuItem action={Action.InsertCodeFormula} actionArgs={undefined} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <InsertChartIcon />
            Chart
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <AgentModeDropdownMenuItem action={Action.InsertChartPython} actionArgs={undefined} />
            <AgentModeDropdownMenuItem action={Action.InsertChartJavascript} actionArgs={undefined} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <DataObjectIcon />
            Data
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <AgentModeDropdownMenuItem action={Action.InsertFile} actionArgs={undefined} />

            <DropdownMenuSeparator />
            <AgentModeDropdownMenuItem action={Action.InsertApiRequestJavascript} actionArgs={undefined} />
            <AgentModeDropdownMenuItem action={Action.InsertApiRequestPython} actionArgs={undefined} />
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowCellTypeMenu(true)}>From connection…</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <AgentModeDropdownMenuItem action={Action.InsertCheckbox} actionArgs={undefined} />
        <AgentModeDropdownMenuItem action={Action.InsertDropdown} actionArgs={undefined} />
        <AgentModeDropdownMenuItem action={Action.InsertHyperlink} actionArgs={undefined} />
        <AgentModeDropdownMenuItem action={Action.ToggleDataValidation} actionArgs={undefined} />
        <AgentModeDropdownMenuItem action={Action.InsertScheduledTask} actionArgs={undefined} />

        <DropdownMenuSeparator />

        <AgentModeDropdownMenuItem action={Action.InsertSheet} actionArgs={undefined} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

// =============================================================================
// Format Menu
// =============================================================================

function FormatDropdownMenu() {
  // get the format summary for the current selection
  const [formatSummary, setFormatSummary] = useState<CellFormatSummary | undefined>(undefined);
  const transactionsInfo = useRecoilValue(editorInteractionStateTransactionsInfoAtom);
  useEffect(() => {
    const updateFormatSummary = async () => {
      // don't update the format summary if there are transactions in progress
      if (transactionsInfo.length > 0) return;
      try {
        const summary = await quadraticCore.getFormatSelection(sheets.sheet.cursor.save());
        if (summary && 'error' in summary) {
          console.error('[FormatDropdownMenu] Error getting format summary', summary.error);
        } else {
          setFormatSummary(summary);
        }
      } catch (e) {
        console.error('[FormatDropdownMenu] Error getting format summary', e);
      }
    };
    updateFormatSummary();

    events.on('cursorPosition', updateFormatSummary);
    return () => {
      events.off('cursorPosition', updateFormatSummary);
    };
  }, [transactionsInfo.length]);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Format</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <Number123Icon /> Number
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <AgentModeDropdownMenuItem action={Action.FormatNumberAutomatic} actionArgs={undefined} />
            <AgentModeDropdownMenuItem
              action={Action.FormatNumberCurrency}
              actionArgs={undefined}
              shortcutOverride="$1,000.12"
            />
            <AgentModeDropdownMenuItem
              action={Action.FormatNumberPercent}
              actionArgs={undefined}
              shortcutOverride="10.12%"
            />
            <AgentModeDropdownMenuItem
              action={Action.FormatNumberScientific}
              actionArgs={undefined}
              shortcutOverride="1.01E+03"
            />

            <DropdownMenuSeparator />

            <AgentModeDropdownMenuItem
              action={Action.FormatNumberToggleCommas}
              actionArgs={undefined}
              shortcutOverride="1,000.12"
            />
            <AgentModeDropdownMenuItem
              action={Action.FormatNumberDecimalIncrease}
              actionArgs={undefined}
              shortcutOverride=".0000"
            />
            <AgentModeDropdownMenuItem
              action={Action.FormatNumberDecimalDecrease}
              actionArgs={undefined}
              shortcutOverride=".0"
            />
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownDateTimeSubMenu action={Action.FormatDateTime} />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <FormatBoldIcon />
            Text
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <AgentModeDropdownMenuItem action={Action.ToggleBold} actionArgs={undefined} />
            <AgentModeDropdownMenuItem action={Action.ToggleItalic} actionArgs={undefined} />
            <AgentModeDropdownMenuItem action={Action.ToggleUnderline} actionArgs={undefined} />
            <AgentModeDropdownMenuItem action={Action.ToggleStrikeThrough} actionArgs={undefined} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <FormatAlignLeftIcon />
            Alignment
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <AgentModeDropdownMenuItem action={Action.FormatAlignHorizontalLeft} actionArgs={undefined} />
            <AgentModeDropdownMenuItem action={Action.FormatAlignHorizontalCenter} actionArgs={undefined} />
            <AgentModeDropdownMenuItem action={Action.FormatAlignHorizontalRight} actionArgs={undefined} />

            <DropdownMenuSeparator />

            <AgentModeDropdownMenuItem action={Action.FormatAlignVerticalTop} actionArgs={undefined} />
            <AgentModeDropdownMenuItem action={Action.FormatAlignVerticalMiddle} actionArgs={undefined} />
            <AgentModeDropdownMenuItem action={Action.FormatAlignVerticalBottom} actionArgs={undefined} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <FormatTextWrapIcon /> Wrapping
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <AgentModeDropdownMenuItem action={Action.FormatTextWrapWrap} actionArgs={undefined} />
            <AgentModeDropdownMenuItem action={Action.FormatTextWrapOverflow} actionArgs={undefined} />
            <AgentModeDropdownMenuItem action={Action.FormatTextWrapClip} actionArgs={undefined} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownColorPickerSubMenu
          action={Action.FormatTextColor}
          activeColor={formatSummary?.textColor ?? undefined}
        />

        <DropdownColorPickerSubMenu
          action={Action.FormatFillColor}
          activeColor={formatSummary?.fillColor ?? undefined}
        />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <BorderAllIcon /> Borders
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <BorderMenu />
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <AgentModeDropdownMenuItem action={Action.ClearFormattingBorders} actionArgs={undefined} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function DropdownDateTimeSubMenu({ action }: { action: Action.FormatDateTime }) {
  const actionSpec = defaultActionSpec[action];
  const label = actionSpec.label();
  const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">
        {Icon && <Icon />}
        {label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DateFormat className="block min-w-80 p-2" closeMenu={() => focusGrid()} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function DropdownColorPickerSubMenu({
  action,
  activeColor,
}: {
  action: Action.FormatTextColor | Action.FormatFillColor;
  activeColor?: string;
}) {
  const actionSpec = defaultActionSpec[action];
  const label = actionSpec.label();
  const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;

  const iconNode = Icon ? (
    <div className="relative flex items-center justify-center">
      <Icon />
      <div
        className="absolute bottom-0 left-0.5 right-0.5 h-1 rounded-sm"
        style={{ backgroundColor: activeColor ?? 'currentColor' }}
      />
    </div>
  ) : null;

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">
        {iconNode}
        {label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuItem className="color-picker-dropdown-menu flex-col gap-0 p-0 hover:bg-background focus:bg-background">
          <ColorPicker
            color={activeColor}
            onChangeComplete={(color) => {
              actionSpec.run(color);
              focusGrid();
            }}
            onClear={() => {
              actionSpec.run(undefined);
              focusGrid();
            }}
          />
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

// =============================================================================
// Help Menu
// =============================================================================

function HelpDropdownMenu() {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Help</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <AgentModeDropdownMenuItem action={Action.HelpDocs} actionArgs={undefined} />
        <AgentModeDropdownMenuItem action={Action.HelpQuadratic101} actionArgs={undefined} />
        <AgentModeDropdownMenuItem action={Action.HelpCommunity} actionArgs={undefined} />
        <AgentModeDropdownMenuItem action={Action.HelpChangelog} actionArgs={undefined} />
        <AgentModeDropdownMenuItem action={Action.HelpYouTube} actionArgs={undefined} />
        <DropdownMenuSeparator />
        <AgentModeDropdownMenuItem action={Action.HelpContactUs} actionArgs={undefined} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
