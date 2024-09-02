import { IconButton, Tooltip } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Close } from '@mui/icons-material';
import { useSetRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { focusGrid } from '@/app/helpers/focusGrid';
import { usePositionCellMessage } from '../usePositionCellMessage';
import { Rectangle } from 'pixi.js';
import { Validation } from '@/app/quadratic-core-types';
import { pixiApp } from '../../pixiApp/PixiApp';
import { Button } from '@/shared/shadcn/ui/button';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import { colors } from '@/app/theme/colors';
import { validationText } from '@/app/ui/menus/Validations/Validations/ValidationEntry';
import { translateValidationError } from './translateValidationError';

interface Props {
  column?: number;
  row?: number;
  offsets?: Rectangle;
  validation?: Validation;
  hoverError?: boolean;
}

export const HtmlValidationMessage = (props: Props) => {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  const { offsets, validation, column, row, hoverError } = props;
  const [hide, setHide] = useState(true);

  const showError = useMemo(() => {
    if (column === undefined || row === undefined) {
      return false;
    }

    if (hoverError !== undefined || pixiApp.cellsSheets.current?.getErrorMarkerValidation(column, row)) {
      return true;
    }
    return false;

    // we need to watch changes to validations to check if error has changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [column, hoverError, row, validation]);

  const [div, setDiv] = useState<HTMLDivElement | null>(null);
  const ref = useCallback((node: HTMLDivElement) => {
    setDiv(node);
  }, []);

  useEffect(() => {
    setHide(false);
  }, [validation]);

  const { top, left } = usePositionCellMessage({ div, offsets, forceLeft: true });

  const showValidation = useCallback(() => {
    if (validation) {
      setEditorInteractionState((old) => ({
        ...old,
        showValidation: validation?.id,
      }));
    }
  }, [setEditorInteractionState, validation]);

  let title: JSX.Element | null = null;
  let message: JSX.Element | null = null;

  if (showError) {
    let icon: JSX.Element | null = null;
    switch (validation?.error?.style) {
      case 'Stop':
        icon = <ErrorIcon style={{ color: colors.error }} />;
        break;
      case 'Warning':
        icon = <WarningIcon />;
        break;
      case 'Information':
        icon = <InfoIcon />;
        break;
    }
    const errorTitle = validation?.error?.title;
    let severity = 'Error';
    switch (validation?.error?.style) {
      case 'Stop':
        severity = 'Error';
        break;
      case 'Warning':
        severity = 'Warning';
        break;
      case 'Information':
        severity = 'Information';
        break;
    }
    title = (
      <div className="flex items-start whitespace-normal align-middle">
        <span className="mr-2">{icon}</span>
        <span>{errorTitle ? errorTitle : `Validation ${severity}`}</span>
      </div>
    );

    message = (
      <>
        <div>{validation?.error?.message}</div>
        {validation && translateValidationError(validation)}
        <div>
          {validation && <div className="mt-2">{}</div>}
          {validation && (
            <Tooltip title="Show validation">
              <Button className="pointer-events-auto mt-1 text-xs" variant="link" size="none" onClick={showValidation}>
                Rule: {validationText(validation)}
              </Button>
            </Tooltip>
          )}
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

  if (hide || !offsets || (!title && !message)) return null;

  const wrapStyle = {
    overflowWrap: 'break-word',
    wordWrap: 'break-word',
    wordBreak: 'break-word',
    hyphens: 'auto',
  } as const;

  // if hover error, we have to remove the wrapper as HoverCell handles that.
  if (hoverError !== undefined) {
    return (
      <div className="leading-2 max-w-xs whitespace-normal" style={wrapStyle}>
        <div className="flex items-center justify-between gap-2">{<div className="mb-2">{title}</div>}</div>
        {message && <div className="pb-1 pt-2 text-xs">{message}</div>}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute w-64 max-w-xs rounded-md border border-gray-300 bg-popover bg-white p-4 text-popover-foreground shadow-md outline-none"
      style={{ top, left }}
    >
      <div className="leading-2 whitespace-normal" style={wrapStyle}>
        <div className="flex items-start justify-between gap-2">
          {<div className="mb-2">{title}</div>}
          {
            <IconButton
              sx={{ padding: 0.5 }}
              className="pointer-events-auto"
              onClick={() => {
                setHide(true);
                focusGrid();
              }}
            >
              <Close sx={{ padding: 0, width: 15, height: 15 }} />
            </IconButton>
          }
        </div>
        {message && <div className="pb-1 pt-2 text-xs">{message}</div>}
      </div>
    </div>
  );
};
