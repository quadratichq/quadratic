import { Box, InputBase, useTheme } from '@mui/material';
import { useEffect, useRef } from 'react';

type Props = {
  setValue: Function;
  value: string;
};

export function FileListItemInput({ setValue, value }: Props) {
  const theme = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  return (
    <Box
      sx={{
        backgroundColor: theme.palette.background.default,
        position: 'absolute',
        left: '0',
        right: '0',
        top: '0',
        bottom: '1px',
        display: 'flex',
        alignItems: 'center',
        [theme.breakpoints.down('md')]: {
          left: '0',
        },
      }}
    >
      <InputBase
        inputRef={inputRef}
        onBlur={() => {
          setValue(inputRef.current?.value);
        }}
        onKeyUp={(e) => {
          if (e.key === 'Enter') {
            inputRef.current?.blur();
          } else if (e.key === 'Escape') {
            if (inputRef.current) {
              inputRef.current.blur();
            }
          }
        }}
        sx={{ flex: 1 }}
        placeholder="My file name"
        inputProps={{ 'aria-label': 'File name' }}
        defaultValue={value}
      />
    </Box>
  );
}
