import * as muiColors from '@mui/material/colors';

export const colors = {
  // Pulled from the CSS theme styles
  // hsla(from var(--border) h s 20% / a) - a is set in pixi
  gridLines: 0x233143,
  cellFontColor: 0x000000,
  cellColorUserText: 0x8ecb89,
  cellColorUserPython: 0x3776ab,
  cellColorUserPythonRgba: 'rgba(55, 118, 171, 0.5)',
  cellColorUserFormula: 0x8c1a6a,
  cellColorUserJavascript: 0xca8a04,
  cellColorUserAI: 0x1a8c5d,
  cellColorError: 0xf25f5c,
  cursorCell: 0x6cd4ff,
  searchCell: 0x50c878,

  // todo: this should be changed
  movingCells: 0x6cd4ff,

  gridBackground: 0xffffff,

  independence: 0x5d576b,
  headerBackgroundColor: 0xffffff,
  headerSelectedBackgroundColor: 0xe7f7ff,
  headerSelectedRowColumnBackgroundColor: 0xb6e7ff,
  headerCornerBackgroundColor: 0xffffff,
  boxCellsDeleteColor: Number(`0x${muiColors.red['400'].replace('#', '')}`),
  htmlPlaceholderThumbnailColor: 0xeeeeee,
  htmlPlaceholderThumbnailBorderColor: 0,
  boxCellsColor: 0x6cd4ff,
  boxCellsAlpha: 0.333,
  gridHeadingLabel: 0x233143, // same as gridLines, no alpha
  defaultBorderColor: 0,
  lightGray: '#f6f8fa',
  mediumGray: '#cfd7de',
  darkGray: '#55606b',
  warning: '#C0803F',
  quadraticPrimary: '#6cd4ff',
  quadraticSecondary: '#8ecb89',
  quadraticThird: '#cb8999',
  quadraticForth: '#ffc800',
  quadraticFifth: '#5d576b',
  languagePython: '#3776ab',
  languageFormula: '#8c1a6a',
  languageAI: '#1a8c5d',
  languagePostgres: '#336791',
  languageMysql: '#00758f',
  languageJavascript: '#ca8a04',

  // todo: this can be change for dark background
  backgroundColor: 0xffffff,

  error: '#f25f5c',
  cellHighlightColor: [
    muiColors.orange['900'],
    muiColors.purple['500'],
    muiColors.cyan['800'],
    muiColors.green['800'],
    muiColors.indigo['500'],
    muiColors.pink['600'],
    muiColors.blueGrey['600'],
    muiColors.lime['900'],
    muiColors.brown['500'],
  ],
};
