import { editorInteractionStateShowConditionalFormatAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { ConditionalFormat } from '@/app/ui/menus/ConditionalFormatting/ConditionalFormat/ConditionalFormat';
import { ConditionalFormats } from '@/app/ui/menus/ConditionalFormatting/ConditionalFormats/ConditionalFormats';
import { useEffect, useRef } from 'react';
import { useRecoilState } from 'recoil';

export const ConditionalFormatPanel = () => {
  const [showConditionalFormat, setShowConditionalFormat] = useRecoilState(
    editorInteractionStateShowConditionalFormatAtom
  );
  const prevShowRef = useRef(showConditionalFormat);

  // Only redirect to 'new' when panel first opens (false -> true) with no formats
  useEffect(() => {
    const wasHidden = prevShowRef.current === false;
    const isNowShowingList = showConditionalFormat === true;

    if (wasHidden && isNowShowingList) {
      // Panel just opened - check if there are any conditional formats
      const hasFormats = sheets.sheet.conditionalFormats.length > 0;
      if (!hasFormats) {
        setShowConditionalFormat('new');
      }
    }

    prevShowRef.current = showConditionalFormat;
  }, [showConditionalFormat, setShowConditionalFormat]);

  if (showConditionalFormat === false) {
    return null;
  }

  if (showConditionalFormat === true) {
    return <ConditionalFormats />;
  }

  return <ConditionalFormat />;
};
