export const getGridScreenshot = async (page: any) => {
  const imageData = (await page.evaluate(() => {
    // use PIXIJS renderer to get base64 screenshot

    //@ts-expect-error
    window.pixiapp.render();

    //@ts-expect-error
    return window.pixiapp.renderer.plugins.extract.base64();
  })) as string;
  return Buffer.from(imageData.split(',')[1], 'base64');
};
