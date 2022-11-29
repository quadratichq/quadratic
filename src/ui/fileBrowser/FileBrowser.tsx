import { useState, useEffect } from 'react';
import { FilePreviewCard } from './FilePreviewCard';
import { Container, Avatar, ListItem, ListItemAvatar, ListItemText, Tooltip, Button, Box } from '@mui/material';
import { Menu } from '@szhsin/react-menu';
import { FileNewCard } from './FileNewCard';
import { FileSearchBar } from '../../quadratic/FileSearchBar';
import { TopBar } from '../components/TopBar';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { colors } from '../../theme/colors';
import { useAuth0 } from '@auth0/auth0-react';

export const FileBrowser = () => {
  const { user } = useAuth0();

  const [files, setFiles] = useState<any[]>();

  const { getAccessTokenSilently } = useAuth0();

  const fetchData = async () => {
    console.log('test');
    // based on implementation from https://github.com/dennisMeeQ/auth0-react-express/blob/master/client/src/components/people.js#L15

    const token = await getAccessTokenSilently();

    const res = await fetch(`http://localhost:8000/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    res
      .json()
      .then((json) => {
        setFiles(json.files);
      })
      .catch((err) => console.log(err));
  };

  useEffect(
    () => {
      fetchData();
    },
    // eslint-disable-next-line
    []
  );

  return (
    <>
      <TopBar>
        <Box
          style={{
            //@ts-expect-error
            WebkitAppRegion: 'no-drag',
            display: 'flex',
            alignItems: 'center',
            width: '15rem',
          }}
        >
          <Menu
            menuButton={
              <Tooltip title="Main Menu" arrow>
                <Button style={{ color: colors.darkGray }}>
                  <img src="logo512.png" height="35px" alt="Quadratic Icon" />
                  <KeyboardArrowDown fontSize="small"></KeyboardArrowDown>
                </Button>
              </Tooltip>
            }
          ></Menu>
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '1rem',
            width: '20rem',
          }}
        >
          <Menu
            menuButton={
              <ListItem button sx={{ paddingTop: '2px', paddingBottom: '2px' }}>
                <ListItemAvatar>
                  <Avatar
                    sx={{
                      bgcolor: colors.quadraticSecondary,
                    }}
                    alt={user?.name}
                    src={user?.picture}
                  >
                    {user?.name && user?.name[0]}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText primary={user?.email} secondary={user?.name} />
              </ListItem>
            }
          ></Menu>
        </Box>
      </TopBar>
      <Container maxWidth="lg" sx={{ marginTop: '6rem' }}>
        <FileSearchBar></FileSearchBar>
        <h3 style={{ color: colors.darkGray }}>Recent</h3>
        <div
          style={{
            flex: 1,
            flexDirection: 'row',
            display: 'flex',
            flexWrap: 'wrap',
            alignContent: 'flex-start',
            justifyContent: 'center',
            gap: '2rem',
            paddingTop: '2rem',
          }}
        >
          <FileNewCard></FileNewCard>
          {files && files.map((file) => <FilePreviewCard key={file.id} file={file}></FilePreviewCard>)}
        </div>
      </Container>
    </>
  );
};
