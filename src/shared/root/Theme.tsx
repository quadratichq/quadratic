import { PaletteMode, useMediaQuery } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { createContext, useContext, useMemo, useState } from 'react';

type ColorModePreference = PaletteMode | 'system';
export const ColorModeContext = createContext({
  colorModePreference: 'light',
  toggleColorMode: (preference: ColorModePreference) => {},
});

export const useColorMode = () => useContext(ColorModeContext);

export default function Theme(props: any) {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  // TODO store this _somewhere_
  const [colorModePreference, setColorModePreference] = useState<ColorModePreference>('light');
  const colorMode = useMemo(
    () => ({
      colorModePreference,
      toggleColorMode: (newPref: ColorModePreference) => {
        console.log(newPref);
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
        typography: {
          fontFamily: `OpenSans, sans-serif`,
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
                borderRadius: '0',
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
