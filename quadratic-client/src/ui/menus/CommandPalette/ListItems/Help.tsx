import { useSetRecoilState } from 'recoil';
import { provideFeedbackAction, viewDocsAction } from '../../../../actions';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import { CommandPaletteListItem, CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: 'Help: ' + viewDocsAction.label,
    Component: (props: CommandPaletteListItemSharedProps) => (
      <CommandPaletteListItem
        {...props}
        // icon={<OpenInNew />}
        action={() => {
          viewDocsAction.run();
        }}
      />
    ),
  },
  {
    label: 'Help: ' + provideFeedbackAction.label,
    isAvailable: provideFeedbackAction.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
      return (
        <CommandPaletteListItem
          {...props}
          action={() => {
            provideFeedbackAction.run({ setEditorInteractionState });
          }}
        />
      );
    },
  },
];

export default ListItems;
