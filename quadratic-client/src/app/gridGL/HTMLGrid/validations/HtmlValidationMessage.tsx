import { Divider, IconButton } from '@mui/material';
import { HtmlValidationsData } from './useHtmlValidations';
import { useEffect, useState } from 'react';
import { Close } from '@mui/icons-material';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';

interface Props {
  htmlValidationsData: HtmlValidationsData;
}

export const HtmlValidationMessage = (props: Props) => {
  const { annotationState } = useRecoilValue(editorInteractionStateAtom);
  const { offsets, validation } = props.htmlValidationsData;
  const [hide, setHide] = useState(true);

  const message = validation?.message;

  useEffect(() => {
    setHide(false);
  }, [validation]);

  const hasMessage = message && (!!message.title || !!message.message);

  if (hide || annotationState === 'dropdown' || !offsets || !hasMessage) return null;

  return (
    <div
      className={'border.gray-300 pointer-events-none absolute mt-1 border bg-white text-gray-500'}
      style={{ top: offsets.bottom, left: offsets.left + offsets.width / 2 }}
    >
      <div className="leading-2 mt- whitespace-nowrap px-2 py-1 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium">{message.title}</div>
          <IconButton sx={{ padding: 0 }} className="pointer-events-auto" onClick={() => setHide(true)}>
            <Close sx={{ padding: 0, width: 15 }} />
          </IconButton>
        </div>
        {message.message && <Divider />}
        {message.message && <div className="pb-1 pt-2 text-gray-500">{message.message}</div>}
      </div>
    </div>
  );
};
