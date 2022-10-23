import useLocalStorage from '../../hooks/useLocalStorage';

export interface IGridSettings {
  showGridAxes: boolean;
  showHeadings: boolean;
  showGridLines: boolean;
  showCellTypeOutlines: boolean;
}

export const defaultGridSettings: IGridSettings = {
  showGridAxes: true,
  showHeadings: true,
  showGridLines: true,
  showCellTypeOutlines: true,
};

interface GridSettings extends IGridSettings {

}

export const useGridSettings = (): GridSettings => {
  const [settings] = useLocalStorage('gridSettings', defaultGridSettings);

  return settings;
};
