import { grid } from './Grid';

// default size for URL: &mock-large-data=
const randomFloatSize = { x: 100, y: 1000 };

export const mockLargeData = (): void => {
  const url = new URLSearchParams(window.location.search);
  let { x, y } = randomFloatSize;
  const params = url.get('mock-large-data');
  if (params?.includes(',')) {
    const n = params.split(',');
    x = parseInt(n[0]);
    y = parseInt(n[1]);
  }
  const ids = grid.getSheetIds();
  grid.populateWithRandomFloats(ids[0], x, y);
};
