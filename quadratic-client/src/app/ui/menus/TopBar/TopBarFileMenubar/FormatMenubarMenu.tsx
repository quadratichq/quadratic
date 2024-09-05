import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { QColorPicker } from '@/app/ui/components/qColorPicker';
import { setTextColor } from '@/app/ui/menus/TopBar/SubMenus/formatCells';
import {
  BorderAllIcon,
  FormatAlignCenterIcon,
  FormatAlignLeftIcon,
  FormatAlignRightIcon,
  FormatBoldIcon,
  FormatClearIcon,
  FormatColorFillIcon,
  FormatColorTextIcon,
  FormatItalicIcon,
  FormatTextClipIcon,
  FormatTextOverflowIcon,
  FormatTextWrapIcon,
  Number123Icon,
  VerticalAlignBottomIcon,
  VerticalAlignMiddleIcon,
  VerticalAlignTopIcon,
} from '@/shared/components/Icons';
import {
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

export const FormatMenubarMenu = () => {
  return (
    <MenubarMenu>
      <MenubarTrigger>Format</MenubarTrigger>
      <MenubarContent>
        <MenubarSub>
          <MenubarSubTrigger>
            <Number123Icon /> Number
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
            <FormatTextWrapIcon /> Wrapping
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItem>
              <FormatTextOverflowIcon />
              Overflow
            </MenubarItem>
            <MenubarItem>
              <FormatTextWrapIcon />
              Wrap
            </MenubarItem>
            <MenubarItem>
              <FormatTextClipIcon />
              Clip
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSeparator />
        <MenubarSub>
          <MenubarSubTrigger>
            <FormatColorTextIcon /> Text color
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItem className="hover:bg-background">
              {/* TODO: (jimniels) style the color picker */}
              <QColorPicker
                onChangeComplete={(color) => {
                  setTextColor(color);
                  // focusGrid();
                }}
                onClear={() => {
                  setTextColor(undefined);
                  // focusGrid();
                }}
              />
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger>
            <FormatColorFillIcon /> Fill color
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItem>TODO</MenubarItem>
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger>
            <BorderAllIcon /> Border
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItem>TODO</MenubarItem>
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSeparator />
        <MenubarItem>
          <FormatClearIcon /> Clear <MenubarShortcut>{KeyboardSymbols.Command + '\\'}</MenubarShortcut>
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
};
