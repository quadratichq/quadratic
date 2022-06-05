export const electronMaximizeFocusedWindow = () => {
  //@ts-expect-error
  if (window.electronAPI) window.electronAPI.maximizeCurrentWindow();
};
