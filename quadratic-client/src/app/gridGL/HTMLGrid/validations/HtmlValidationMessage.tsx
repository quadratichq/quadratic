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
import { events } from '@/app/events/events';

interface Props {
  column?: number;
  row?: number;
  offsets?: Rectangle;
  validation?: Validation;
  hoverError?: string;
  rejected?: boolean;
}

export const HtmlValidationMessage = (props: Props) => {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  const { offsets, validation, column, row, hoverError, rejected } = props;
  const [hide, setHide] = useState(true);

  const showError = useMemo(() => {
    if (column === undefined || row === undefined) {
      return false;
    }

    if (hoverError !== undefined || pixiApp.cellsSheets.current?.getErrorMarkerValidation(column, row)) {
      return true;
    }
    return false;
  }, [column, hoverError, row]);

  const [div, setDiv] = useState<HTMLDivElement | null>(null);
  const ref = useCallback((node: HTMLDivElement) => {
    setDiv(node)
  }, []);

  useEffect(() => {
    setHide(false);
  }, [validation]);

  const { top, left } = usePositionCellMessage({ div, offsets, forceLeft: true });

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
      <div className="flex align-middle">
        <span className="mr-2">{icon}</span>
        <span>{errorTitle ? errorTitle : `Validation ${severity}`}</span>
      </div>
    );

    const invalidValue =
      hoverError !== undefined ? <div className="pointer-events-auto whitespace-normal">"{hoverError}" {rejected ? 'was rejected because it ' : ''} is not valid</div> : null;
    message = (
      <>
        <div className="">{invalidValue}</div>
        <div>{validation?.error?.message}</div>
        <div>
          {validation && <div className="mt-2">{}</div>}
          {validation && (
            <Tooltip title="Show validation">
              <Button className="pointer-events-auto mt-4 text-xs" variant="link" size="none" onClick={showValidation}>
                {validationText(validation)}
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

  // if hover error, we have to remove the wrapper as HoverCell handles that.
  if (hoverError !== undefined) {
    return (
      <div className="leading-2 whitespace-nowrap">
        <div className="flex items-center justify-between gap-2">
          {<div className="margin-bottom: 0.5rem">{title}</div>}
          { rejected &&
            <IconButton
              sx={{ padding: 0 }}
              className="pointer-events-auto"
              onClick={() => {
                events.emit('hoverCell');
                focusGrid();
              }}
            >
              <Close sx={{ padding: 0, width: 15 }} />
            </IconButton>
          }

        </div>
        {message && <div className="pb-1 pt-2 text-xs">{message}</div>}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="border.gray-300 pointer-events-none absolute w-64 rounded-md border bg-popover bg-white p-4 text-popover-foreground shadow-md outline-none"
      style={{ top, left }}
    >
      <div className="leading-2 whitespace-nowrap">
        <div className="flex items-center justify-between gap-2">
          {<div className="margin-bottom: 0.5rem">{title}</div>}
          {
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
          }
        </div>
        {message && <div className="pb-1 pt-2 text-xs">{message}</div>}
      </div>
    </div>
  );
};
