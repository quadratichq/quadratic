import { editorInteractionStateAtom } from '@/atoms/editorInteractionStateAtom';
import { Popover, PopoverAnchor, PopoverContent } from '@/shadcn/ui/popover';
import { useRecoilState } from 'recoil';

export function Search() {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);

  return (
    <Popover open={editorInteractionState.showSearch}>
      <PopoverAnchor
        style={{
          position: 'absolute',
          right: '1rem',
          top: '100%',
        }}
      />
      <PopoverContent
        style={{
          background: 'white',
          border: '1px solid black',
          padding: '1rem',
        }}
        onKeyDown={(e) => {
          // close search
          if (e.key === 'Escape') {
            setEditorInteractionState((prev) => ({ ...prev, showSearch: false }));
          }
        }}
      >
        <input type="text" />
        HELLO!!!!
      </PopoverContent>
    </Popover>
  );
}
