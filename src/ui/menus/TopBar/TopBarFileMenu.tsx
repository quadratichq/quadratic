import { Box, Chip, InputBase, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

import { Link } from 'react-router-dom';
import { ROUTES } from '../../../constants/routes';

import { focusGrid } from '../../../helpers/focusGrid';
// import { useRootRouteLoaderData } from '../../../router';
import { colors } from '../../../theme/colors';
import { useFileContext } from '../../contexts/FileContext';

export const TopBarFileMenu = () => {
  const { name, renameFile } = useFileContext();
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  // const { isAuthenticated } = useRootRouteLoaderData();
  // const { user } = useAuth0();

  // const showEditControls = isAuthenticated && !isMobile; // TODO and it's not read only

  // if (false && isMobile) {
  //   return (
  //     <Box
  //       sx={{
  //         display: 'flex',
  //         alignItems: 'center',
  //         userSelect: 'none',
  //       }}
  //     >
  //       <Typography
  //         variant="body2"
  //         fontFamily={'sans-serif'}
  //         color={colors.mediumGray}
  //         style={{ whiteSpace: 'nowrap', marginLeft: '1rem' }}
  //       >
  //         Read only
  //       </Typography>
  //     </Box>
  //   );
  // }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexGrow: '1',
      }}
    >
      {isRenaming ? (
        <FileNameInput setIsRenaming={setIsRenaming} currentFilename={name} renameCurrentFile={renameFile} />
      ) : (
        <Stack direction="row" gap={theme.spacing()} alignItems="center">
          <Typography
            variant="body2"
            color={theme.palette.text.disabled}
            sx={{
              [theme.breakpoints.down('md')]: {
                display: 'none',
              },
              '&:hover a': { color: theme.palette.text.primary },
            }}
          >
            <Link to={ROUTES.MY_FILES} reloadDocument style={{ textDecoration: 'none' }}>
              My files
            </Link>
          </Typography>
          <Typography
            variant="body2"
            color={theme.palette.text.disabled}
            sx={{
              userSelect: 'none',
              [theme.breakpoints.down('md')]: {
                display: 'none',
              },
            }}
          >
            /
          </Typography>
          <Stack direction="row" gap={theme.spacing(1)} alignItems="center">
            <Typography
              onClick={() => {
                if (isMobile) {
                  return;
                }
                setIsRenaming(true);
              }}
              variant="body2"
              style={{
                display: 'block',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                // this is a little bit of a magic number for now, but it
                // works and truncates at an appropriate, proportional size
                maxWidth: '25vw',
              }}
            >
              {name}
            </Typography>
            {isMobile && <Chip label="Read only" variant="outlined" size="small" />}
          </Stack>
        </Stack>
      )}

      {/* <KeyboardArrowDown fontSize="small" style={{ color: colors.darkGray }}></KeyboardArrowDown> */}
    </Box>
  );
};

function FileNameInput({
  currentFilename,
  renameCurrentFile,
  setIsRenaming,
}: {
  currentFilename: string;
  renameCurrentFile: (name: string) => void;
  setIsRenaming: Function;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // When user selects input, highlight it's contents
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.setSelectionRange(0, inputRef.current.value.length);
    }
  }, []);

  return (
    <InputBase
      onKeyUp={(e) => {
        if (e.key === 'Enter') {
          inputRef.current?.blur();
          focusGrid();
        } else if (e.key === 'Escape') {
          if (inputRef.current) {
            inputRef.current.value = currentFilename;
            inputRef.current.blur();
          }
          focusGrid();
        }
      }}
      onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
        setIsRenaming(false);
        const value = inputRef.current?.value;

        // Don't allow empty file names
        if (!(value && value.trim())) {
          return;
        }

        // Don't do anything if the name didn't change
        if (value === currentFilename) {
          return;
        }

        renameCurrentFile(value);
      }}
      defaultValue={currentFilename}
      inputRef={inputRef}
      autoFocus
      inputProps={{ style: { textAlign: 'center' } }}
      sx={{ fontSize: '.875rem', color: colors.darkGray, width: '100%' }}
    />
  );
}
