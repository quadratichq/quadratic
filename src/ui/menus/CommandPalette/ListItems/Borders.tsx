import {
  BorderAll,
  BorderBottom,
  BorderClear,
  BorderHorizontal,
  BorderInner,
  BorderLeft,
  BorderOuter,
  BorderRight,
  BorderTop,
  BorderVertical,
} from '@mui/icons-material';
import { isEditorOrAbove } from '../../../../actions';
import { ChangeBorder, useBorders } from '../../TopBar/SubMenus/useBorders';
import { CommandPaletteListItem, CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';
// import { BorderType } from '../../../../core/gridDB/gridTypes';
// import { BorderDashed, BorderDouble, BorderDotted, BorderThin, BorderThick, BorderMedium } from '../../../icons';

const ListItems = [
  // Convenience to generate all the border component variations
  ...[
    { label: 'Borders: Apply all', icon: <BorderAll />, changeBordersArgs: { borderAll: true } },
    {
      label: 'Borders: Apply outer',
      icon: <BorderOuter />,
      changeBordersArgs: { borderLeft: true, borderRight: true, borderTop: true, borderBottom: true },
    },
    {
      label: 'Borders: Apply inner',
      icon: <BorderInner />,
      changeBordersArgs: { borderHorizontal: true, borderVertical: true },
    },
    {
      label: 'Borders: Apply vertical',
      icon: <BorderVertical />,
      changeBordersArgs: { borderVertical: true },
    },
    {
      label: 'Borders: Apply horizontal',
      icon: <BorderHorizontal />,
      changeBordersArgs: { borderHorizontal: true },
    },
    {
      label: 'Borders: Apply left',
      icon: <BorderLeft />,
      changeBordersArgs: { borderLeft: true },
    },
    {
      label: 'Borders: Apply right',
      icon: <BorderRight />,
      changeBordersArgs: { borderRight: true },
    },
    {
      label: 'Borders: Apply top',
      icon: <BorderTop />,
      changeBordersArgs: { borderTop: true },
    },
    {
      label: 'Borders: Apply bottom',
      icon: <BorderBottom />,
      changeBordersArgs: { borderBottom: true },
    },
  ].map(generateListItem),
  {
    label: 'Borders: Clear all',
    isAvailable: isEditorOrAbove,
    Component: (props: CommandPaletteListItemSharedProps) => {
      const { clearBorders } = useBorders(props.sheetController.sheet, props.app);
      return (
        <CommandPaletteListItem
          {...props}
          action={() => {
            clearBorders();
          }}
          icon={<BorderClear />}
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
];

function generateListItem({
  label,
  icon,
  changeBordersArgs,
}: {
  label: string;
  icon?: JSX.Element;
  changeBordersArgs: ChangeBorder;
}) {
  return {
    label,
    isAvailable: isEditorOrAbove,
    Component: (props: CommandPaletteListItemSharedProps) => {
      const { changeBorders } = useBorders(props.sheetController.sheet, props.app);
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
}

export default ListItems;
