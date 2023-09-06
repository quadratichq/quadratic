import { InsertDriveFileOutlined } from '@mui/icons-material';
import { Box, Divider, InputBase, Typography, useTheme } from '@mui/material';
import { ReactNode, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ShareFileOutlined } from '../../ui/icons';

type Props = {
  name: string;
  description: string;
  to: string;
  disabled: boolean;
  handleRename: Function;
  isRenaming: boolean;
  isShared: boolean;
  actions?: ReactNode;
  status?: ReactNode;
};

DashboardFileLink.defaultProps = {
  disabled: false,
  isRenaming: false,
  handleRename: () => {},
  isShared: false,
};

export function DashboardFileLink({
  disabled,
  name,
  description,
  actions,
  status,
  to,
  isShared,
  handleRename,
  isRenaming,
}: Props) {
  const theme = useTheme();
  // , ...(to ? {} : { pointerEvents: 'none', opacity: 0.5 })

  return (
    <Box style={{ position: 'relative' }}>
      <Link
        to={to}
        reloadDocument
        style={{
          textDecoration: 'none',
          color: 'inherit',

          ...(disabled ? { pointerEvents: 'none', opacity: 0.5 } : {}),
        }}
      >
        <Box
          sx={{
            '&:hover': { background: theme.palette.action.hover, cursor: 'pointer' },
            '.FileListItem-icon svg': {
              fill: theme.palette.text.secondary,
            },
            '&:hover .FileListItem-icon svg': {
              fill: theme.palette.text.primary,
            },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing(2),

              [theme.breakpoints.down('md')]: {
                p: theme.spacing(1),
              },

              [theme.breakpoints.up('md')]: {
                p: theme.spacing(1.5),
              },
            }}
          >
            <div className="FileListItem-icon">{isShared ? <ShareFileOutlined /> : <InsertDriveFileOutlined />}</div>
            <div style={{ display: 'flex', flexDirection: 'column', marginRight: 'auto' }}>
              <div style={{ display: 'flex', gap: theme.spacing() }}>
                <Typography variant="body1" color="text.primary">
                  {name}
                </Typography>
                {status && status}
              </div>

              <Typography variant="caption" color="text.secondary">
                {description}
              </Typography>
            </div>
            {actions}
          </Box>
        </Box>
      </Link>
      {isRenaming && <FileNameInput handleRename={handleRename} value={name} />}
      <Divider />
    </Box>
  );
}

function FileNameInput({ handleRename, value }: { handleRename: Function; value: string }) {
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
        left: theme.spacing(6.5),
        right: '0',
        top: '0',
        bottom: '1px',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <InputBase
        inputRef={inputRef}
        onBlur={() => {
          const newName = inputRef.current?.value;
          handleRename(newName);
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
