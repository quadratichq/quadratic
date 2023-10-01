import { GridViewOutlined, MenuOutlined } from '@mui/icons-material';
import { ToggleButton, ToggleButtonGroup, styled } from '@mui/material';
import { Layout } from './FilesListViewControlsDropdown';

export type LayoutPreference = 'list' | 'grid';

const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
  '& .MuiToggleButton-root': {
    fontSize: '16px',
    border: `none !important`,
  },
  '& .MuiToggleButtonGroup-grouped': {
    margin: `0 2px`,
    border: 0,
    borderRadius: theme.shape.borderRadius - 1 + 'px !important',
    padding: theme.spacing(0.75),
  },
}));

export function FilesListViewControlsLayoutToggle({ viewPreferences, setViewPreferences }: any) {
  return (
    <StyledToggleButtonGroup
      value={viewPreferences.layout}
      exclusive
      onChange={(event: React.MouseEvent<HTMLElement>, newValue: any) => {
        setViewPreferences((prev: any) => ({ ...prev, layout: newValue }));
      }}
    >
      <ToggleButton value={Layout.List} disabled={viewPreferences.layout === Layout.List}>
        <MenuOutlined fontSize="inherit" />
      </ToggleButton>

      <ToggleButton value={Layout.Grid} disabled={viewPreferences.layout === Layout.Grid}>
        <GridViewOutlined fontSize="inherit" />
      </ToggleButton>
    </StyledToggleButtonGroup>
  );
}
