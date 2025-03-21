export interface SuggestController {
  widget: { value: { onDidShow: (fn: () => void) => void; onDidHide: (fn: () => void) => void } };
}
