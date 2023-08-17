import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined';
import { SheetController } from '../../../../grid/controller/SheetController';
import { CommandPaletteListItem } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: 'Sheet: Create',
    Component: (props: any) => {
      return (
        <CommandPaletteListItem
          {...props}
          icon={<PostAddOutlinedIcon />}
          action={() => {
            const sheetController = props.sheetController as SheetController;
            sheetController.sheets.createNew();
            // createSheet({ sheetController, sheet, create_transaction: true });
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
            // (props.sheetController as SheetController).duplicateSheet();
          }}
        />
      );
    },
  },
];

export default ListItems;
