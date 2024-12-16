import { ColorChangeHandler, CompactPicker } from 'react-color';
import './qColorPicker.scss';

interface IProps {
  onChangeComplete: ColorChangeHandler | undefined;
  onClear?: () => void;
  color?: string;
}

export const QColorPicker = (props: IProps) => {
  return (
    <>
      <CompactPicker
        color={props.color}
        className="color-picker-submenu"
        onChangeComplete={props.onChangeComplete}
        colors={[
          '#F9D2CE' /* first row of colors */,
          '#FFEAC8',
          '#FFF3C1',
          '#D8FFE8',
          '#D5FFF7',
          '#DAF0FF',
          '#EBD7F3',
          '#D9F2FA',
          '#FFB4AC' /* second row of colors */,
          '#FFDA9F',
          '#F2E2A4',
          '#AAF1C8',
          '#ADEFE2',
          '#AFD0E7',
          '#D1B4DD',
          '#B4D3DC',
          '#EE8277' /* third row of colors */,
          '#F8C97D',
          '#F5D657',
          '#86E3AE',
          '#7BE9D3',
          '#84BFE7',
          '#C39BD3',
          '#A1B9BA',
          '#E74C3C' /* forth row of colors */,
          '#F39C12',
          '#F1C40F',
          '#2ECC71',
          '#17C8A5',
          '#3498DB',
          '#9B59B6',
          '#698183',
          '#963127' /* fifth row of colors */,
          '#C46B1D',
          '#B69100',
          '#1C8347',
          '#056D6D',
          '#1F608B',
          '#6F258E',
          '#34495E',
          '#000000' /* sixth row of colors */,
          '#333333',
          // '#4d4d4d', // removed so we can add clear color at end
          '#737373',
          '#cccccc',
          '#dddddd',
          '#eeeeee',
          '#ffffff',
          '#123456', // special indicator for color color. See useBorders.tsx#CLEAR_COLOR
        ]}
      />
      {props.onClear && (
        <div className="color-picker-clear">
          <span onClick={props.onClear}>Clear</span>
        </div>
      )}
    </>
  );
};
