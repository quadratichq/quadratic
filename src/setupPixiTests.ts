import { ImageResource, settings } from 'pixi.js';

const getContext = () => {
  return {
    fillRect: () => {},
    clearRect: () => {},
    getImageData: (x: number, y: number, w: number, h: number) => {
      return {
        data: new Array(w * h * 4),
      };
    },
    putImageData: () => {},
    createImageData: () => {
      return [];
    },
    setTransform: () => {},
    drawImage: () => {},
    save: () => {},
    fillText: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    arc: () => {},
    fill: () => {},
    measureText: () => {
      return {
        width: 0,
      };
    },
    transform: () => {},
    rect: () => {},
    clip: () => {},
  };
};

// this does not work perfectly yet
export const setupPixiTests = (): void => {
  settings.ADAPTER = {
    /** Returns a canvas object that can be used to create a webgl context. */
    createCanvas: (width?: number, height?: number) => {
      return {
        getContext,
        test: () => {
          return {} as ImageResource;
        },
      } as any as HTMLCanvasElement;
    },
    /** Returns a webgl rendering context. */
    getWebGLRenderingContext: () => {
      return {} as typeof WebGLRenderingContext;
    },
    /** Returns a partial implementation of the browsers window.navigator */
    getNavigator: () => {
      return { userAgent: '' };
    },
    /** Returns the current base URL For browser environments this is either the document.baseURI or window.location.href */
    getBaseUrl: () => {
      return '';
    },
    fetch: (url: RequestInfo, options?: RequestInit) => {
      return {} as Promise<Response>;
    },
  };
};
