import {
  CodeIcon,
  FormatAlignCenterIcon,
  FormatAlignLeftIcon,
  FormatAlignRightIcon,
  FormatBoldIcon,
  FormatItalicIcon,
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
  );
};
