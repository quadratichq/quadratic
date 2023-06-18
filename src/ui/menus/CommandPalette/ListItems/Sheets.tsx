import { CommandPaletteListItem } from '../CommandPaletteListItem';
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { SheetController } from '../../../../grid/controller/sheetController';

const ListItems = [
  {
    label: 'Sheet: Create',
    Component: (props: any) => {
      return (
        <CommandPaletteListItem
          {...props}
          icon={<PostAddOutlinedIcon />}
          action={() => {
            (props.sheetController as SheetController).addSheet();
          }}
        />
      );
    },
  },
  {
    label: 'Sheet: Delete',
    Component: (props: any) => {
      return (
        <CommandPaletteListItem {...props} icon={<DeleteOutlineOutlinedIcon />} action={() => props.confirmDelete()} />
      );
    },
  },
  {
    label: 'Sheet: Duplicate',
    Component: (props: any) => {
      return (
        <CommandPaletteListItem
          {...props}
          icon={<PostAddOutlinedIcon />}
          action={() => {
            (props.sheetController as SheetController).duplicateSheet();
          }}
        />
      );
    },
  },
];

export default ListItems;
