import { BitmapText } from "pixi.js";
import { PixiComponent } from "@inlet/react-pixi";

interface FastBitmapTextProps {
  x: number;
  y: number;
  text: string;
  visible: boolean;
  fontSize?: number;
}

const FastBitmapText = PixiComponent("FastText", {
  create: (props: FastBitmapTextProps) =>
    new BitmapText(props.text, {
      fontName: "OpenSans",
      fontSize: props.fontSize ?? 14,
      tint: 0x000000,
      align: "left",
      // maxWidth: 100,
    }),
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
