import { ChatBubbleOutline, OpenInNew } from '@mui/icons-material';
import { useSetRecoilState } from 'recoil';
import { provideFeedback, viewDocs } from '../../../../actions';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import { CommandPaletteListItem, CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: 'Help: ' + viewDocs.label,
    Component: (props: CommandPaletteListItemSharedProps) => (
      <CommandPaletteListItem
        {...props}
        icon={<OpenInNew />}
        action={() => {
          viewDocs.run();
        }}
      />
    ),
  },
  {
    label: 'Help: ' + provideFeedback.label,
    isAvailable: provideFeedback.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
      return (
        <CommandPaletteListItem
          {...props}
          icon={<ChatBubbleOutline />}
          action={() => {
            provideFeedback.run({ setEditorInteractionState });
          }}
        />
      );
    },
  },
];

export default ListItems;
