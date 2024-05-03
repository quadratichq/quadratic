/**
 * This is a temporary workaround for an MUI/react-18 issue described here:
 * https://github.com/mui/material-ui/issues/33004#issuecomment-1455260156
 *
 * This makes it so `autoFocus` doesn't work on the InputBase, so our global
 * menus don't get focus. For some reason, using traditional refs in each
 * component doesn't work (e.g. `const inputRef = useRef()`).
 *
 * And if we use `disableRestoreFocus` then we don't get focus back after
 * closing the global menus.
 *
 * But this works. So we use it in our global menus for now.
 *
 * Once the above mentioned thread is resolved with a proper fix, we can get rid
 * of this and use the `autoFocus` attribute.
 */
export default function focusInput(input: any) {
  if (input !== null) {
    setTimeout(() => {
      input.focus();
    }, 100);
  }
}
