import { GridViewOutlined, MenuOutlined } from '@mui/icons-material';
import { ToggleButton, ToggleButtonGroup, styled } from '@mui/material';
import { Dispatch, SetStateAction } from 'react';

export type LayoutPreference = 'list' | 'grid';

const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
  '& .MuiToggleButton-root': {
    fontSize: '16px',
    border: `none !important`,
  },
  '& .MuiToggleButtonGroup-grouped': {
    margin: `0 2px`,
    border: 0,
    borderRadius: theme.shape.borderRadius + 'px !important',
    padding: theme.spacing(0.75),
  },
}));

export function FileListLayoutPreferenceToggle({
  layoutPreference,
  setLayoutPreference,
}: {
  layoutPreference: LayoutPreference;
  setLayoutPreference: Dispatch<SetStateAction<LayoutPreference>>;
}) {
  return (
    <StyledToggleButtonGroup
      value={layoutPreference}
      exclusive
      onChange={(event: React.MouseEvent<HTMLElement>, newValue: LayoutPreference) => {
        // TODO persist to localStorage...
        setLayoutPreference(newValue);
      }}
    >
      <ToggleButton value="list" disabled={layoutPreference === 'list'}>
        <MenuOutlined fontSize="inherit" />
      </ToggleButton>

      <ToggleButton value="module" disabled={layoutPreference === 'grid'}>
        <GridViewOutlined fontSize="inherit" />
      </ToggleButton>
    </StyledToggleButtonGroup>
  );
}
