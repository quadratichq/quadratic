import { BitmapText, IBitmapTextStyle } from 'pixi.js';
import { PixiComponent } from '@inlet/react-pixi';

interface FastBitmapTextProps {
  x: number;
  y: number;
  text: string;
  visible: boolean;
  style?: Partial<IBitmapTextStyle>;
}

const FastBitmapText = PixiComponent('FastText', {
  create: (props: FastBitmapTextProps) => {
    if (props.style) {
      return new BitmapText(props.text, props.style);
    } else {
      return new BitmapText(props.text, {
        fontName: 'OpenSans',
        fontSize: 14,
        tint: 0x000000,
        align: 'left',
        // maxWidth: 100,
      });
    }
  },
  applyProps: (instance, oldProps, props) => {
    const { x, y, text, visible } = props;

    instance.visible = visible;

    if (x !== oldProps.x || y !== oldProps.y) {
      instance.x = x;
      instance.y = y;
    }

    if (text !== oldProps.text) {
      instance.text = text;
    }
  },
});

export default FastBitmapText;
