import { InputBase } from '@mui/material';
import { useEffect, useRef } from 'react';
import { focusGrid } from '../../../helpers/focusGrid';

interface Props {
  value: string;
  onUpdate: (value?: string) => void;
}

export const SheetBarRename = (props: Props) => {
  const { value, onUpdate } = props;

  const inputRef = useRef<HTMLInputElement>(null);

  // When user selects input, highlight it's contents
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.setSelectionRange(0, inputRef.current.value.length);
    }
  }, []);

  return (
    <InputBase
      autoFocus={true}
      onKeyUp={(e) => {
        if (e.key === 'Enter') {
          if (!inputRef.current) return;
          inputRef.current?.blur();
          onUpdate(inputRef.current.value)
          focusGrid();
        } else if (e.key === 'Escape') {
          if (!inputRef.current) return;
          onUpdate();
          inputRef.current.blur();
        }
      }}
      onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
        const updatedValue = inputRef.current?.value;

        // Don't allow empty file names
        if (!updatedValue || (updatedValue && updatedValue.trim() === '')) {
          onUpdate();
        }

        // Don't do anything if the name didn't change
        if (updatedValue === value) {
          onUpdate();
        }
        onUpdate(updatedValue);
      }}
      defaultValue={value}
      inputRef={inputRef}
      inputProps={{
        style: {
          textAlign: 'center',
          fontFamily: '"Roboto","Helvetica","Arial",sans-serif',
          fontSize: '14px',
          padding: 0,
          color: 'rgb(25, 118, 210)',
          fontWeight: 500,
          lineHeight: '1.25rem',
          textOverflow: 'ellipsis',
        }
      }}
    />
  );
}