import * as React from 'react';
import Paper from '@mui/material/Paper';
import InputBase from '@mui/material/InputBase';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import { FilterAltOutlined } from '@mui/icons-material';

export const FileSearchBar = () => {
  return (
    <Paper component="form" sx={{ p: '2px 4px', display: 'flex', alignItems: 'center', maxWidth: '300px' }}>
      <IconButton sx={{ p: '10px' }} aria-label="search">
        <SearchIcon />
      </IconButton>
      <InputBase
        sx={{ ml: 1, flex: 1 }}
        placeholder="Search Quadratic Files"
        inputProps={{ 'aria-label': 'Search Quadratic Files' }}
      />
      {/* <Divider sx={{ height: 28, m: 0.5 }} orientation="vertical" />
      <IconButton sx={{ p: '10px' }} aria-label="directions">
        <FilterAltOutlined />
      </IconButton> */}
    </Paper>
  );
};
