import { CommandPaletteListItem } from '../CommandPaletteListItem';
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined';
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
];

export default ListItems;
