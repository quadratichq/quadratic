import { CommandPaletteListItem } from '../CommandPaletteListItem';
import { ChatBubbleOutline, OpenInNew } from '@mui/icons-material';
import { DOCUMENTATION_URL } from '../../../../constants/urls';
import { CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import { useSetRecoilState } from 'recoil';

const ListItems = [
  {
    label: 'Help: View the docs',
    Component: (props: CommandPaletteListItemSharedProps) => (
      <CommandPaletteListItem
        {...props}
        icon={<OpenInNew />}
        action={() => {
          window.open(DOCUMENTATION_URL, '_blank')?.focus();
        }}
      />
    ),
  },
  {
    label: 'Help: Provide feedback',
    Component: (props: CommandPaletteListItemSharedProps) => {
      const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
      return (
        <CommandPaletteListItem
          {...props}
          icon={<ChatBubbleOutline />}
          action={() => {
            setEditorInteractionState((prevState) => ({ ...prevState, showFeedbackMenu: true }));
          }}
        />
      );
    },
  },
];

export default ListItems;
