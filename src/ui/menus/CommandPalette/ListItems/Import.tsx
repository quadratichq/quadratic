import { CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';
import { CommandPaletteListItem } from '../CommandPaletteListItem';

import { UploadFile } from '@mui/icons-material';
import { useSetRecoilState } from 'recoil';
import { showCSVImportHelpAtom } from '../../../../atoms/showCSVImportHelpAtom';

const ListItems = [
  {
    label: 'Import: CSV',
    Component: (props: CommandPaletteListItemSharedProps) => {
      const setShowCSVImportHelpMessage = useSetRecoilState(showCSVImportHelpAtom);
      return (
        <CommandPaletteListItem
          {...props}
          icon={<UploadFile />}
          action={() => {
            setShowCSVImportHelpMessage(true);
          }}
        />
      );
    },
  },
];

export default ListItems;
