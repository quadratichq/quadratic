import { editorInteractionStateAtom } from '@/atoms/editorInteractionStateAtom';
import { Input } from '@/shadcn/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/shadcn/ui/popover';
import { useState } from 'react';
import { useRecoilState } from 'recoil';

export function Search() {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const [results, setResult] = useState(false);

  const placeholder = editorInteractionState.searchOptions?.all_sheets
    ? 'Search all sheets...'
    : 'Search this sheet...';

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
        style={
          {
            // background: 'white',
            // border: '1px solid black',
            // padding: '1rem',
          }
        }
        onKeyDown={(e) => {
          // close search
          if (e.key === 'Escape') {
            setEditorInteractionState((prev) => ({ ...prev, showSearch: false }));
          }
        }}
      >
        <Input placeholder={placeholder} />
      </PopoverContent>
    </Popover>
  );
}
