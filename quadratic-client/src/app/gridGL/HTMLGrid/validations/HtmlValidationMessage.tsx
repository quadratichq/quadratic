import { IconButton } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Close } from '@mui/icons-material';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { focusGrid } from '@/app/helpers/focusGrid';
import { usePositionCellMessage } from './usePositionCellMessage';
import { Rectangle } from 'pixi.js';
import { Validation } from '@/app/quadratic-core-types';
import { pixiApp } from '../../pixiApp/PixiApp';
import { Button } from '@/shared/shadcn/ui/button';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';

interface Props {
  column?: number;
  row?: number;
  offsets?: Rectangle;
  validation?: Validation;
  hoverError?: boolean;
}

export const HtmlValidationMessage = (props: Props) => {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  const { annotationState } = useRecoilValue(editorInteractionStateAtom);
  const { offsets, validation, column, row, hoverError } = props;
  const [hide, setHide] = useState(true);

  const showError = useMemo(() => {
    if (column === undefined || row === undefined) {
      return false;
    }
    if (hoverError || pixiApp.cellsSheets.current?.getErrorMarkerValidation(column, row)) {
      return true;
    }
    return false;
  }, [column, hoverError, row]);

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHide(false);
  }, [validation]);

  const { top, left } = usePositionCellMessage(ref.current, offsets);

  const showValidation = useCallback(() => {
    if (validation) {
      setEditorInteractionState((old) => {
        return {
          ...old,
          showValidation: validation?.id,
        };
      });
    }
  }, [setEditorInteractionState, validation]);

  let title: JSX.Element | null = null;
  let message: JSX.Element | null = null;
  if (showError) {
    let icon: JSX.Element | null = null;
    switch (validation?.error?.style) {
      case 'Stop':
        icon = <ErrorIcon />;
        break;
      case 'Warning':
        icon = <WarningIcon />;
        break;
      case 'Information':
        icon = <InfoIcon />;
        break;
    }
    const errorTitle = validation?.error?.title;
    title = (
      <div className="flex align-middle">
        <span className="mr-2">{icon}</span>
        <span>{errorTitle ? errorTitle : 'Validation Error'}</span>
      </div>
    );
    message = (
      <>
        <div>{validation?.error?.message}</div>
        <div>
          <Button className="pointer-events-auto mt-4 text-xs" variant="link" size="none" onClick={showValidation}>
            Show Validation
          </Button>
        </div>
      </>
    );
  } else if (validation?.message) {
    if (validation?.message.title) {
      title = <span>{validation.message.title}</span>;
    }
    if (validation?.message.message) {
      message = <span>{validation.message.message}</span>;
    }
  }

  if (hide || annotationState === 'dropdown' || !offsets || (!title && !message)) return null;

  return (
    <div
      ref={ref}
      className={
        hoverError
          ? ''
          : 'border.gray-300 pointer-events-none absolute rounded-md border bg-popover bg-white p-4 text-popover-foreground shadow-md outline-none'
      }
      style={{ top, left }}
    >
      <div className="leading-2 whitespace-nowrap">
        <div className="flex items-center justify-between gap-2">
          {<div className="margin-bottom: 0.5rem">{title}</div>}
          {!hoverError && (
            <IconButton
              sx={{ padding: 0 }}
              className="pointer-events-auto"
              onClick={() => {
                setHide(true);
                focusGrid();
              }}
            >
              <Close sx={{ padding: 0, width: 15 }} />
            </IconButton>
          )}
        </div>
        {message && <div className="pb-1 pt-2 text-xs">{message}</div>}
      </div>
    </div>
  );
};
