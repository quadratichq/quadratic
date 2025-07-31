import { editorInteractionStateShowValidationAtom } from '@/app/atoms/editorInteractionStateAtom';
import { usePositionCellMessage } from '@/app/gridGL/HTMLGrid/usePositionCellMessage';
import { translateValidationError } from '@/app/gridGL/HTMLGrid/validations/translateValidationError';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { focusGrid } from '@/app/helpers/focusGrid';
import type { Validation } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import { validationText } from '@/app/ui/menus/Validations/Validations/ValidationEntry';
import { Button } from '@/shared/shadcn/ui/button';
import { Close } from '@mui/icons-material';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import { IconButton, Tooltip } from '@mui/material';
import type { Rectangle } from 'pixi.js';
import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useSetRecoilState } from 'recoil';

interface Props {
  column?: number;
  row?: number;
  offsets?: Rectangle;
  validation?: Validation;
  hoverError?: boolean;
}

export const HtmlValidationMessage = (props: Props) => {
  const setShowValidation = useSetRecoilState(editorInteractionStateShowValidationAtom);
  const { offsets, validation, column, row, hoverError } = props;
  const [hide, setHide] = useState(true);

  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (column === undefined || row === undefined) {
      setShowError(false);
    } else if (hoverError !== undefined || pixiApp.cellsSheets.current?.getErrorMarkerValidation(column, row)) {
      setShowError(true);
    } else {
      setShowError(false);
    }
    // we need to watch changes to validations to check if error has changed
  }, [column, hoverError, row, validation]);

  useEffect(() => {
    setHide(false);
  }, [validation]);

  const [div, setDiv] = useState<HTMLDivElement | null>(null);
  const ref = useCallback((node: HTMLDivElement) => {
    setDiv(node);
  }, []);
  const { top, left } = usePositionCellMessage({ div, offsets, forceLeft: true });

  const showValidation = useCallback(() => {
    if (validation) {
      setShowValidation(validation?.id);
    }
  }, [setShowValidation, validation]);

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
      message = (
        <Tooltip title="Show validation">
          <Button className="pointer-events-auto mt-1 text-xs" variant="link" size="none" onClick={showValidation}>
            Rule: {validationText(validation)}
          </Button>
        </Tooltip>
      );
    }
    if (validation?.message.message) {
      message = (
        <>
          <div>{validation.message.message}</div>
          <Tooltip title="Show validation">
            <Button className="pointer-events-auto mt-1 text-xs" variant="link" size="none" onClick={showValidation}>
              Rule: {validationText(validation)}
            </Button>
          </Tooltip>
        </>
      );
    } else {
      message = (
        <>
          <div>{translateValidationError(validation)}</div>
          <Tooltip title="Show validation">
            <Button className="pointer-events-auto mt-1 text-xs" variant="link" size="none" onClick={showValidation}>
              Rule: {validationText(validation)}
            </Button>
          </Tooltip>
        </>
      );
    }
  }

  if (hide || !offsets || (!title && !message) || !validation) return null;

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
      className="pointer-events-auto absolute w-64 max-w-xs rounded-md border border-gray-300 bg-popover bg-white p-4 text-popover-foreground shadow-md outline-none"
      style={{ top, left, transformOrigin: `0 0`, transform: `scale(${1 / pixiApp.viewport.scale.x})` }}
    >
      <div className="leading-2 whitespace-normal" style={wrapStyle}>
        <div className="flex items-start justify-between gap-2">
          {<div className="mb-2">{title}</div>}
          {
            <IconButton
              sx={{ padding: 0.5 }}
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
