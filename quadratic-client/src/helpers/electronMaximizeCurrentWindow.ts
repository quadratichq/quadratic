export const electronMaximizeCurrentWindow = () => {
  //@ts-expect-error
  if (window.electronAPI) window.electronAPI.maximizeCurrentWindow();
};
