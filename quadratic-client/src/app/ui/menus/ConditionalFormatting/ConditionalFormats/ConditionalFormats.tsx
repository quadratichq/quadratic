import { editorInteractionStateShowConditionalFormatAtom } from '@/app/atoms/editorInteractionStateAtom';
import { ConditionalFormatsHeader } from '@/app/ui/menus/ConditionalFormatting/ConditionalFormats/ConditionalFormatsHeader';
import { Button } from '@/shared/shadcn/ui/button';
import { useCallback } from 'react';
import { useSetRecoilState } from 'recoil';

export const ConditionalFormats = () => {
  const setShowConditionalFormat = useSetRecoilState(editorInteractionStateShowConditionalFormatAtom);

  const addConditionalFormat = useCallback(() => {
    setShowConditionalFormat('new');
  }, [setShowConditionalFormat]);

  // TODO: In the future, this will fetch conditional formats from the sheet
  // For now, we just show an empty list with an add button

  return (
    <div
      className="border-gray relative flex h-full shrink-0 flex-col border-l bg-background px-3 text-sm"
      style={{ width: '20rem' }}
      data-testid="conditional-format-panel"
    >
      <ConditionalFormatsHeader />

      <div className="grow overflow-auto">
        <div className="flex h-full items-center justify-center text-muted-foreground">No conditional formats yet</div>
      </div>

      <div className="mt-3 flex w-full border-t border-t-gray-100 pt-2">
        <div className="mx-auto my-1 flex gap-3">
          <Button onClick={addConditionalFormat} autoFocus>
            Add Rule
          </Button>
        </div>
      </div>
    </div>
  );
};
