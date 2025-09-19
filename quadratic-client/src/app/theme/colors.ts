import tailwindColors from 'tailwindcss/colors';

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

  cellColorWarning: 0xffb74d,
  cellColorInfo: 0x4fc3f7,

  cursorCell: 0x2463eb,
  searchCell: 0x50c878,

  movingCells: 0x2463eb,

  gridBackground: 0xffffff,
  gridBackgroundOutOfBounds: 0xfdfdfd,

  independence: 0x5d576b,
  headerBackgroundColor: 0xffffff,
  headerSelectedBackgroundColor: 0x2463eb,
  headerSelectedBackgroundColorAlpha: 0.1,
  headerSelectedRowColumnBackgroundColor: 0x2463eb,
  headerSelectedRowColumnBackgroundColorAlpha: 0.25,
  headerCornerBackgroundColor: 0xffffff,
  boxCellsDeleteColor: Number(`0x${tailwindColors.red['400'].replace('#', '')}`),
  htmlPlaceholderThumbnailColor: 0xfefefe,
  htmlPlaceholderThumbnailBorderColor: 0,
  boxCellsColor: 0x2463eb,
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
  languageMssql: '#cfd8dc',
  languageSnowflake: '#249edc',
  languageCockroachdb: '#336791',
  languageBigquery: '#4285f4',
  languageMariadb: '#00758f',
  languageSupabase: '#249edc',
  languageNeon: '#336791',
  languageSynced: '#ffc800',
  languageJavascript: '#ca8a04',
  link: '#2463eb',

  // todo: this can be change for dark background
  backgroundColor: 0xffffff,

  error: '#f25f5c',
  cellHighlightColor: [
    tailwindColors.orange['600'],
    tailwindColors.fuchsia['700'],
    tailwindColors.cyan['700'],
    tailwindColors.green['700'],
    tailwindColors.indigo['600'],
    tailwindColors.pink['600'],
    tailwindColors.lime['800'],
  ],
};
