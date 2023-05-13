import { Box } from '@mui/system';
import { SheetController } from '../../../grid/controller/sheetController';
import { colors } from '../../../theme/colors';
import { Tab, Tabs } from '@mui/material';
import { useCallback, useState } from 'react';
import { InputRename } from './InputRename';
import { useLocalFiles } from '../../contexts/LocalFiles';

interface Props {
  sheetController: SheetController;
}

export const SheetBar = (props: Props): JSX.Element => {
  const { sheetController } = props;
  const [current, setCurrent] = useState(sheetController.current);

  const localFiles = useLocalFiles()

  const changeSheet = useCallback(
    (_, value: number | 'create') => {
      if (value === 'create') {
        sheetController.addSheet();
        setCurrent(sheetController.current);
      } else {
        sheetController.current = value;
        setCurrent(sheetController.current);
      }
    },
    [sheetController]
  );

  return (
    <div
      onContextMenu={(event) => {
        // Disable right-click
        event.preventDefault();
      }}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderTop: `1px solid ${colors.mediumGray}`,
        color: colors.darkGray,
        bottom: 0,
        width: '100%',
        backdropFilter: 'blur(1px)',
        display: 'flex',
        justifyContent: 'space-between',
        paddingLeft: '1rem',
        paddingRight: '1rem',
        fontFamily: 'sans-serif',
        fontSize: '0.7rem',
        userSelect: 'none',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          height: '1.5rem'
        }}
      >
        <Tabs
          value={current}
          onChange={changeSheet}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="select sheet control"
          sx={{ height: '1.5rem' }}
        >
          {sheetController.sheets.map((sheet, index) => (
            <Tab
              key={index}
              value={index}
              label={<InputRename
                value={sheet.name}
                displayProps={{
                  style: {
                    textAlign: 'center',
                    fontFamily: '"Roboto","Helvetica","Arial",sans-serif',
                    fontSize: '14px',
                    minWidth: '90px',
                    maxWidth: '360px',
                    padding: 0,
                    color: 'rgb(25, 118, 210)',
                    fontWeight: 500,
                    lineHeight: '1.25rem',
                    textOverflow: 'ellipsis',
                  }
                }}
                selectTextOnRename
                onUpdate={(value?: string) => {
                  if (value) {
                    sheet.rename(value);
                    localFiles.save();
                  }
                }}
              />}
              sx={{
                height: '1.5rem',
                padding: 0,
                textAlign: 'center',
                textTransform: 'none',
                marginRight: '1rem'
              }} />
          ))}
          <Tab value={'create'} label="+" style={{ width: '1rem' }} />
        </Tabs>
      </Box>
    </div>
  );
};
