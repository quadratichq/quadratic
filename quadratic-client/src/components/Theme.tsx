import { PaletteMode, useMediaQuery } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { createContext, useContext, useMemo, useState } from 'react';

type ColorModePreference = PaletteMode | 'system';
export const ColorModeContext = createContext({
  colorModePreference: 'light',
  toggleColorMode: (preference: ColorModePreference) => {},
});

export const useColorMode = () => useContext(ColorModeContext);

export function Theme(props: any) {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  // TODO store this _somewhere_
  const [colorModePreference, setColorModePreference] = useState<ColorModePreference>('light');
  const colorMode = useMemo(
    () => ({
      colorModePreference,
      toggleColorMode: (newPref: ColorModePreference) => {
        setColorModePreference(newPref);
      },
    }),
    [colorModePreference]
  );

  let mode: PaletteMode = colorModePreference === 'system' ? (prefersDarkMode ? 'dark' : 'light') : colorModePreference;

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
        },
        shape: {
          borderRadius: 2,
        },
        typography: {
          // We set a font family on the body in the main `index.css` file
          // so we just inherit from that.
          fontFamily: `inherit`,
          // For some reason, if you change the default font-family, this gets
          // lost on the original overline style
          overline: {
            letterSpacing: '0.08333em',
          },
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: 'none',
              },
            },
          },
          MuiAlert: {
            styleOverrides: {
              action: {
                // These properly align a small button action in the alert
                marginRight: '0',
                padding: '0',
                alignItems: 'center',
              },
            },
          },
          // Any command palette style menu should show up in a fixed position at the top
          MuiDialog: {
            styleOverrides: {
              container: {
                alignItems: 'flex-start',
              },
            },
          },
          MuiBackdrop: {
            styleOverrides: {
              root: {
                backgroundColor: 'rgba(255,255,255,0.75)',
              },
              invisible: {
                backgroundColor: 'transparent',
              },
            },
          },
        },
      }),
    [mode]
  );

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>{props.children}</ThemeProvider>
    </ColorModeContext.Provider>
  );
}
