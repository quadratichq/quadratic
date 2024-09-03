import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import {
  ArrowTopRightIcon,
  CheckSmallIcon,
  CopyIcon,
  CropFreeIcon,
  CutIcon,
  DownloadIcon,
  EditIcon,
  PageViewIcon,
  PasteIcon,
  RedoIcon,
  UndoIcon,
  ZoomInIcon,
} from '@/shared/components/Icons';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from '@/shared/shadcn/ui/menubar';

export const TopBarMenu = () => {
  return (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>New</MenubarItem>
          <MenubarItem>Duplicate</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Share</MenubarItem>
          <MenubarItem>Download</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Rename</MenubarItem>
          <MenubarItem>Import</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Delete</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            <EditIcon />
            Edit cell <MenubarShortcut>{KeyboardSymbols.Enter}</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            <UndoIcon />
            Undo
          </MenubarItem>
          <MenubarItem>
            <RedoIcon />
            Redo
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            <CutIcon />
            Cut
          </MenubarItem>
          <MenubarItem>
            <CopyIcon />
            Copy
          </MenubarItem>
          <MenubarItem>
            <PasteIcon />
            Paste
          </MenubarItem>
          <MenubarSub>
            <MenubarSubTrigger>
              <PasteIcon />
              Paste special
            </MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem>
                Values only <MenubarShortcut>{KeyboardSymbols.Shift + KeyboardSymbols.Command + 'V'}</MenubarShortcut>
              </MenubarItem>
              <MenubarItem>Formatting only</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarItem>Select all</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            <ArrowTopRightIcon />
            Go to
          </MenubarItem>
          <MenubarItem>
            <PageViewIcon />
            Find in current sheet
          </MenubarItem>
          <MenubarItem>
            <PageViewIcon />
            Find in all sheets
          </MenubarItem>
          <MenubarSeparator />
          <MenubarSub>
            <MenubarSubTrigger>
              <DownloadIcon />
              Export selection
            </MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem>
                Copy as PNG <MenubarShortcut>{KeyboardSymbols.Shift + KeyboardSymbols.Command + 'C'}</MenubarShortcut>
              </MenubarItem>
              <MenubarItem>
                Download as CSV{' '}
                <MenubarShortcut>{KeyboardSymbols.Shift + KeyboardSymbols.Command + 'E'}</MenubarShortcut>
              </MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          {/* <MenuItem onClick={() => settings.setShowHeadings(!settings.showHeadings)}>
            <MenuLineItem primary="Show row and column headings" icon={settings.showHeadings && Check} indent />
          </MenuItem>
          <MenuItem onClick={() => settings.setShowGridAxes(!settings.showGridAxes)}>
            <MenuLineItem primary="Show grid axis" icon={settings.showGridAxes && Check} indent />
          </MenuItem>
          <MenuItem onClick={() => settings.setShowGridLines(!settings.showGridLines)}>
            <MenuLineItem primary="Show grid lines" icon={settings.showGridLines && Check} indent />
          </MenuItem>
          <MenuItem onClick={() => settings.setShowCellTypeOutlines(!settings.showCellTypeOutlines)}>
            <MenuLineItem primary="Show code cell outlines" icon={settings.showCellTypeOutlines && Check} indent />
          </MenuItem>
          <MenuItem onClick={() => settings.setShowCodePeek(!settings.showCodePeek)}>
            <MenuLineItem primary="Show code peek" icon={settings.showCodePeek && Check} indent />
          </MenuItem>
          <MenuDivider />
          <MenuItem onClick={() => settings.setPresentationMode(!settings.presentationMode)}>
            <MenuLineItem primary="Presentation mode" icon={settings.presentationMode && Check} indent />
          </MenuItem> */}
          <MenubarItem>
            <CheckSmallIcon /> Show row and column headings
          </MenubarItem>
          <MenubarItem>
            <CheckSmallIcon /> Show grid axis
          </MenubarItem>
          <MenubarItem>
            <CheckSmallIcon />
            Show grid lines
          </MenubarItem>
          <MenubarItem>
            <CheckSmallIcon />
            Show code cell outlines
          </MenubarItem>
          <MenubarItem>
            <CheckSmallIcon />
            Show code peek
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            <ZoomInIcon /> Zoom
          </MenubarItem>
          <MenubarItem>
            <CropFreeIcon />
            Presentation mode
            <MenubarShortcut>{KeyboardSymbols.Command + '.'}</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
};

// const actions = {
//   presentationMode: {
//     label: 'Presentation mode',
//     shortcuts: [KeyboardSymbols.Command + '.'],

//   }
// }
