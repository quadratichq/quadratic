import { BitmapText } from '@inlet/react-pixi';
import { colors } from '../../../../theme/colors';

interface CodeIconProps {
  x_pos: number;
  y_pos: number;
}

export const CodeIcon = (props: CodeIconProps) => {
  const { x_pos, y_pos } = props;

  return (
    <BitmapText
      x={x_pos + 1}
      y={y_pos - 0.5}
      style={{ fontName: 'OpenSans', fontSize: 4 }}
      tint={colors.cellColorUserPython}
      align="left"
      text="</>"
    ></BitmapText>
  );
};
