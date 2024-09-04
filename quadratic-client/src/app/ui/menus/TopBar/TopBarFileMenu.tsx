import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import {
  ArrowDropDownCircleIcon,
  ArrowTopRightIcon,
  CheckBoxIcon,
  CheckSmallIcon,
  CodeIcon,
  CopyAsCsv,
  CopyAsPng,
  CopyIcon,
  CropFreeIcon,
  CutIcon,
  DataObjectIcon,
  DeleteIcon,
  DownloadIcon,
  DraftIcon,
  EditIcon,
  FileCopyIcon,
  FormatAlignCenterIcon,
  FormatAlignLeftIcon,
  FormatAlignRightIcon,
  FormatBoldIcon,
  FormatItalicIcon,
  ImportIcon,
  InsertChartIcon,
  PageViewIcon,
  PasteIcon,
  PersonAddIcon,
  RedoIcon,
  SheetNewIcon,
  UndoIcon,
  VerticalAlignBottomIcon,
  VerticalAlignMiddleIcon,
  VerticalAlignTopIcon,
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

export const TopBarFileMenu = () => {
  return (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            <DraftIcon /> New
          </MenubarItem>
          <MenubarItem>
            <FileCopyIcon />
            Duplicate
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            <PersonAddIcon />
            Share
          </MenubarItem>
          <MenubarItem>
            <DownloadIcon /> Download
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            <EditIcon />
            Rename
          </MenubarItem>
          <MenubarItem>
            <ImportIcon />
            Import
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            <DeleteIcon />
            Delete
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            <UndoIcon />
            Undo
            <MenubarShortcut>{KeyboardSymbols.Command + 'Z'}</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            <RedoIcon />
            Redo
            <MenubarShortcut>{KeyboardSymbols.Shift + KeyboardSymbols.Command + 'Z'}</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            <CutIcon />
            Cut
            <MenubarShortcut>{KeyboardSymbols.Command + 'X'}</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            <CopyIcon />
            Copy
            <MenubarShortcut>{KeyboardSymbols.Command + 'C'}</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            <PasteIcon />
            Paste
            <MenubarShortcut>{KeyboardSymbols.Command + 'V'}</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            <PasteIcon />
            Paste values only
            <MenubarShortcut>{KeyboardSymbols.Shift + KeyboardSymbols.Command + 'V'}</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            <PasteIcon />
            Paste formatting only
          </MenubarItem>
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
          <MenubarItem>
            <CopyAsPng />
            Copy selection as PNG{' '}
            <MenubarShortcut>{KeyboardSymbols.Shift + KeyboardSymbols.Command + 'C'}</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            <CopyAsCsv />
            Download selection as CSV{' '}
            <MenubarShortcut>{KeyboardSymbols.Shift + KeyboardSymbols.Command + 'E'}</MenubarShortcut>
          </MenubarItem>
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
      <MenubarMenu>
        <MenubarTrigger>Insert</MenubarTrigger>
        <MenubarContent>
          <MenubarSub>
            <MenubarSubTrigger>
              <CodeIcon /> Code
            </MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem>Formula</MenubarItem>
              <MenubarItem>Python</MenubarItem>
              <MenubarItem>JavaScript</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSub>
            <MenubarSubTrigger>
              <InsertChartIcon />
              Chart
            </MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem>Python (Plotly)</MenubarItem>
              <MenubarItem>JavaScript (Chart.js))</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSub>
            <MenubarSubTrigger>
              <DataObjectIcon />
              Data
            </MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem>CSV file</MenubarItem>
              <MenubarItem>Excel file</MenubarItem>
              <MenubarItem>Parquet file</MenubarItem>
              <MenubarSeparator />
              <MenubarItem>Python API request</MenubarItem>
              <MenubarItem>JavaScript API request</MenubarItem>
              <MenubarSeparator />
              <MenubarItem>Connection</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>

          <MenubarSeparator />
          <MenubarItem>
            <CheckBoxIcon /> Checkbox
          </MenubarItem>
          <MenubarItem>
            <ArrowDropDownCircleIcon />
            Dropdown
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            <SheetNewIcon />
            Sheet
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Format</MenubarTrigger>
        <MenubarContent>
          <MenubarSub>
            <MenubarSubTrigger>
              <CodeIcon /> Number
            </MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem>Automatic</MenubarItem>
              <MenubarItem>
                Currency <MenubarShortcut>$1,000.12</MenubarShortcut>
              </MenubarItem>
              <MenubarItem>
                Percent <MenubarShortcut>10.12%</MenubarShortcut>
              </MenubarItem>
              <MenubarItem>
                Scientific <MenubarShortcut>1.01E+03</MenubarShortcut>
              </MenubarItem>
              <MenubarItem>
                Toggle commas <MenubarShortcut>1,000.12</MenubarShortcut>
              </MenubarItem>
              <MenubarItem>
                Increase decimal <MenubarShortcut>.0000</MenubarShortcut>
              </MenubarItem>
              <MenubarItem>
                Decrease decimal <MenubarShortcut>.0</MenubarShortcut>
              </MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSub>
            <MenubarSubTrigger>
              <FormatBoldIcon />
              Text
            </MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem>
                <FormatBoldIcon /> Bold
              </MenubarItem>
              <MenubarItem>
                <FormatItalicIcon /> Italic
              </MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSub>
            <MenubarSubTrigger>
              <FormatAlignLeftIcon />
              Alignment
            </MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem>
                <FormatAlignLeftIcon /> Left
              </MenubarItem>
              <MenubarItem>
                <FormatAlignCenterIcon />
                Center
              </MenubarItem>
              <MenubarItem>
                <FormatAlignRightIcon />
                Right
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem>
                <VerticalAlignTopIcon />
                Top
              </MenubarItem>
              <MenubarItem>
                <VerticalAlignMiddleIcon />
                Middle
              </MenubarItem>
              <MenubarItem>
                <VerticalAlignBottomIcon />
                Bottom
              </MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSub>
            <MenubarSubTrigger>
              <CodeIcon /> Wrapping
            </MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem>Overflow</MenubarItem>
              <MenubarItem>Wrap</MenubarItem>
              <MenubarItem>Clip</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
};
