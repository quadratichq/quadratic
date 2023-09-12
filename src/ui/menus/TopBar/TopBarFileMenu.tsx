import { Box, InputBase, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { isEditorOrAbove } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { ROUTES } from '../../../constants/routes';
import { focusGrid } from '../../../helpers/focusGrid';
import { useFileContext } from '../../components/FileProvider';
import { TopBarFileMenuDropdown } from './TopBarFileMenuDropdown';

export const TopBarFileMenu = () => {
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const { name } = useFileContext();
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const theme = useTheme();
  const isNarrowScreen = useMediaQuery(theme.breakpoints.down('md'));
  const { permission } = editorInteractionState;

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
        <FileNameInput setIsRenaming={setIsRenaming} />
      ) : (
        <Stack direction="row" gap={theme.spacing()} alignItems="center">
          {permission === 'OWNER' && (
            <>
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
            </>
          )}

          <Stack direction="row" gap={theme.spacing(1)} alignItems="center">
            <Typography
              onClick={() => {
                if (isNarrowScreen || !isEditorOrAbove(permission)) {
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
            {!isNarrowScreen && <TopBarFileMenuDropdown setIsRenaming={setIsRenaming} />}
          </Stack>
        </Stack>
      )}
    </Box>
  );
};

function FileNameInput({ setIsRenaming }: { setIsRenaming: Dispatch<SetStateAction<boolean>> }) {
  const { name, renameFile } = useFileContext();
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
            inputRef.current.value = name;
            inputRef.current.blur();
          }
          focusGrid();
        }
      }}
      onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
        setIsRenaming(false);
        const newName = inputRef.current?.value;

        // Don't allow empty file names
        if (!(newName && newName.trim())) {
          return;
        }

        // Don't do anything if the name didn't change
        if (newName === name) {
          return;
        }

        renameFile(newName);
      }}
      defaultValue={name}
      inputRef={inputRef}
      autoFocus
      inputProps={{ style: { textAlign: 'center' } }}
      sx={{ fontSize: '.875rem', width: '100%' }}
    />
  );
}
