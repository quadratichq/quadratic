import {
  BorderAllIcon,
  BorderBottomIcon,
  BorderHorizontalIcon,
  BorderInnerIcon,
  BorderLeftIcon,
  BorderNoneIcon,
  BorderOuterIcon,
  BorderRightIcon,
  BorderTopIcon,
  BorderVerticalIcon,
} from '@/app/ui/icons';
import { hasPermissionToEditFile } from '../../../../actions';
import { ChangeBorder, useBorders } from '../../TopBar/SubMenus/useBorders';
import { CommandGroup, CommandPaletteListItem } from '../CommandPaletteListItem';

const commands: CommandGroup = {
  heading: 'Borders',
  commands: [
    generateListItem('Border all', { selection: 'all' }, <BorderAllIcon />),
    generateListItem('Border outer', { selection: 'outer' }, <BorderOuterIcon />),
    generateListItem('Border inner', { selection: 'inner' }, <BorderInnerIcon />),
    generateListItem('Border vertical', { selection: 'vertical' }, <BorderVerticalIcon />),
    generateListItem('Border horizontal', { selection: 'horizontal' }, <BorderHorizontalIcon />),
    generateListItem('Border left', { selection: 'left' }, <BorderLeftIcon />),
    generateListItem('Border right', { selection: 'right' }, <BorderRightIcon />),
    generateListItem('Border top', { selection: 'top' }, <BorderTopIcon />),
    generateListItem('Border bottom', { selection: 'bottom' }, <BorderBottomIcon />),
    {
      label: 'Border none',
      keywords: ['Remove borders', 'Clear borders'],
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        const { clearBorders } = useBorders();
        return (
          <CommandPaletteListItem
            {...props}
            icon={<BorderNoneIcon />}
            action={() => {
              clearBorders();
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

function generateListItem(label: string, changeBordersArgs: ChangeBorder, icon: JSX.Element | undefined) {
  const item: CommandGroup['commands'][0] = {
    label,
    isAvailable: hasPermissionToEditFile,
    Component: (props) => {
      const { changeBorders } = useBorders();
      return (
        <CommandPaletteListItem
          {...props}
          action={() => {
            changeBorders(changeBordersArgs);
          }}
          {...(icon ? { icon } : {})}
        />
      );
    },
  };
  return item;
}

export default commands;
