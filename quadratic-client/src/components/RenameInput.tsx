import { InputBase, useTheme } from '@mui/material';
import { SxProps } from '@mui/system';
import { useEffect, useRef, useState } from 'react';

/**
 * Takes a value and displays an input that autogrows horizontally with it's
 * contents as the user types. When complete, passes the new value (if there is one).
 * @param props
 * @param props.value - The initial value of the input
 * @param props.onClose - Called when the rename is complete. Passes the new value
 *   or undefined if the rename was cancelled or invalid.
 * @param props.sx - mui sx props
 * @returns
 */
export function RenameInput({
  value,
  onClose,
  sx = {},
}: {
  value: string;
  onClose: (newValue?: string) => void;
  sx?: SxProps;
}) {
  const theme = useTheme();

  const inputRef = useRef<HTMLInputElement>();
  const [localValue, setLocalValue] = useState<string>(value);

  // Focus and highlight input contents on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.setSelectionRange(0, inputRef.current.value.length);
      inputRef.current.focus();
    }
  }, []);

  const componentSx = [
    {
      // Resizing magic
      // Borrowed from https://css-tricks.com/auto-growing-inputs-textareas/
      display: 'inline-grid',
      verticalAlign: 'top',
      alignItems: 'center',
      position: 'relative',
      '&::after, input': {
        width: 'auto',
        minWidth: '1em',
        gridArea: '1 / 2',
      },
      '&::after': {
        content: 'attr(data-value) " "',
        visibility: 'hidden',
        whiteSpace: 'pre-wrap',
        // We don't want this messing with the height of the rendered input
        height: '0px',
      },

      // Component styles
      px: theme.spacing(0.5),
      borderRadius: theme.shape.borderRadius,
      '&.Mui-focused': {
        outline: `2px solid ${theme.palette.primary.main}`,
      },
    },
    // Any overrides
    ...(Array.isArray(sx) ? sx : [sx]),
  ];

  return (
    <InputBase
      data-value={localValue}
      value={localValue}
      inputProps={{ size: 2 }}
      inputRef={inputRef}
      sx={componentSx}
      onChange={(e) => setLocalValue(e.target.value)}
      onKeyUp={(e) => {
        if (e.key === 'Enter') {
          inputRef.current?.blur();
        } else if (e.key === 'Escape') {
          onClose();
        }
      }}
      onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
        const newValue = localValue.trim();

        // Don't allow empty file names
        if (newValue.length === 0) {
          onClose();
          return;
        }

        // Don't pass anything if the name didn't change
        if (newValue === value) {
          onClose();
          return;
        }

        onClose(newValue);
      }}
    />
  );
}
