import { editorInteractionStateShowConditionalFormatAtom } from '@/app/atoms/editorInteractionStateAtom';
import { ConditionalFormat } from '@/app/ui/menus/ConditionalFormatting/ConditionalFormat/ConditionalFormat';
import { ConditionalFormats } from '@/app/ui/menus/ConditionalFormatting/ConditionalFormats/ConditionalFormats';
import { useRecoilValue } from 'recoil';

export const ConditionalFormatPanel = () => {
  const showConditionalFormat = useRecoilValue(editorInteractionStateShowConditionalFormatAtom);

  if (showConditionalFormat === false) {
    return null;
  }

  if (showConditionalFormat === true) {
    return <ConditionalFormats />;
  }

  return <ConditionalFormat />;
};
