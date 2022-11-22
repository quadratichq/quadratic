import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardMedia from '@mui/material/CardMedia';

import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';

import MoreVertIcon from '@mui/icons-material/MoreVert';

export const FilePreviewCard = () => {
  return (
    <Card sx={{ width: '275px' }}>
      <CardMedia
        component="img"
        height="194"
        image="/images/example_file_preview.png"
        alt="Paella dish"
        sx={{ objectFit: 'contain' }}
      />
      <CardHeader
        avatar={
          <Avatar variant="square" aria-label="recipe" src="/favicon.ico" sx={{ width: 24, height: 24 }}></Avatar>
        }
        action={
          <IconButton aria-label="settings">
            <MoreVertIcon />
          </IconButton>
        }
        title="Python Example File"
        subheader="Edited 3 Days Ago"
      />
    </Card>
  );
};
