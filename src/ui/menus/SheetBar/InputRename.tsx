import { InputBase, InputBaseComponentProps, SxProps } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { focusGrid } from '../../../helpers/focusGrid';

interface Props {
  value: string;
  onUpdate: (value: string) => void;
  sx?: SxProps;
  displayProps?: InputBaseComponentProps;
  selectTextOnRename?: boolean
}

export const InputRename = (props: Props) => {
  const { value, onUpdate, sx, displayProps, selectTextOnRename } = props;

  const inputRef = useRef<HTMLInputElement>(null);

  const [isRenaming, setIsRenaming] = useState(false);

  // When user selects input, highlight it's contents
  useEffect(() => {
    if (inputRef.current && selectTextOnRename) {
      inputRef.current.setSelectionRange(0, inputRef.current.value.length);
    }
  }, [selectTextOnRename, isRenaming]);

  if (!isRenaming) {
    return <div style={displayProps} onDoubleClick={() => setIsRenaming(true)}>{value}</div>;
  }

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
          setIsRenaming(false);
          inputRef.current.blur();
        }
      }}
      onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
        setIsRenaming(false);
        const updatedValue = inputRef.current?.value;

        // Don't allow empty file names
        if (!updatedValue || (updatedValue && updatedValue.trim() === '')) {
          return;
        }

        // Don't do anything if the name didn't change
        if (updatedValue === value) {
          return;
        }
        onUpdate(updatedValue);
      }}
      defaultValue={value}
      inputRef={inputRef}
      inputProps={displayProps}
      sx={sx}
    />
  );
}
