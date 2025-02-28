import { isAvailableBecauseCanEditFile } from '@/app/actions';
import type { ChangeBorder, UseBordersResults } from '@/app/ui/hooks/useBorders';
import { useBorders } from '@/app/ui/hooks/useBorders';
import type { CommandGroup } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import {
  BorderAllIcon,
  BorderBottomIcon,
  BorderClearIcon,
  BorderHorizontalIcon,
  BorderInnerIcon,
  BorderLeftIcon,
  BorderOuterIcon,
  BorderRightIcon,
  BorderTopIcon,
  BorderVerticalIcon,
} from '@/shared/components/Icons';

export const BordersHook = (): CommandGroup => {
  const borders = useBorders();

  return {
    heading: 'Borders',
    commands: [
      generateListItem(borders, 'Border all', { selection: 'all' }, <BorderAllIcon />),
      generateListItem(borders, 'Border outer', { selection: 'outer' }, <BorderOuterIcon />),
      generateListItem(borders, 'Border inner', { selection: 'inner' }, <BorderInnerIcon />),
      generateListItem(borders, 'Border vertical', { selection: 'vertical' }, <BorderVerticalIcon />),
      generateListItem(borders, 'Border horizontal', { selection: 'horizontal' }, <BorderHorizontalIcon />),
      generateListItem(borders, 'Border left', { selection: 'left' }, <BorderLeftIcon />),
      generateListItem(borders, 'Border right', { selection: 'right' }, <BorderRightIcon />),
      generateListItem(borders, 'Border top', { selection: 'top' }, <BorderTopIcon />),
      generateListItem(borders, 'Border bottom', { selection: 'bottom' }, <BorderBottomIcon />),
      {
        label: 'Border none',
        keywords: ['Remove borders', 'Clear borders'],
        isAvailable: isAvailableBecauseCanEditFile,
        Component: (props) => {
          return (
            <CommandPaletteListItem
              {...props}
              icon={<BorderClearIcon />}
              action={() => {
                borders.clearBorders();
              }}
            />
          );
        },
      },
      // We can uncomment these once we figure out how border styles will work
      // ...[
      //   { label: 'Borders: Style thin', icon: <BorderThin />, changeBordersArgs: { type: BorderType.line1 } },
      //   { label: 'Borders: Style medium', icon: <BorderMedium />, changeBordersArgs: { type: BorderType.line2 } },
      //   { label: 'Borders: Style thick', icon: <BorderThick />, changeBordersArgs: { type: BorderType.line3 } },
      //   { label: 'Borders: Style dashed', icon: <BorderDashed />, changeBordersArgs: { type: BorderType.dashed } },
      //   { label: 'Borders: Style dotted', icon: <BorderDotted />, changeBordersArgs: { type: BorderType.dotted } },
      //   { label: 'Borders: Style double', icon: <BorderDouble />, changeBordersArgs: { type: BorderType.double } },
      // ].map(generateListItem),
    ],
  };
};

function generateListItem(
  borders: UseBordersResults,
  label: string,
  changeBordersArgs: ChangeBorder,
  icon: JSX.Element | undefined
) {
  const item: CommandGroup['commands'][0] = {
    label,
    isAvailable: isAvailableBecauseCanEditFile,
    Component: (props) => {
      return (
        <CommandPaletteListItem
          {...props}
          action={() => {
            borders.changeBorders(changeBordersArgs);
          }}
          {...(icon ? { icon } : {})}
        />
      );
    },
  };
  return item;
}
