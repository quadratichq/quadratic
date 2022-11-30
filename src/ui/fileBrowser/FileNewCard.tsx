import { Button } from '@mui/material';
import { AddCircleOutline } from '@mui/icons-material';

export const FileNewCard = () => {
  return (
    <Button variant="outlined" sx={{ width: '275px', minHeight: '260px' }} startIcon={<AddCircleOutline />}>
      Create New File
    </Button>
  );
};
