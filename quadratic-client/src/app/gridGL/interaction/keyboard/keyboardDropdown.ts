import { events } from '@/app/events/events';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';

export const keyboardDropdownKeys = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'];

export function keyboardDropdown(event: KeyboardEvent): boolean {
  const { editorInteractionState } = pixiAppSettings;
  if (editorInteractionState.annotationState === 'dropdown') {
    // todo: use `matchShortcut` by including a state -- right now we can't use recoil in matchShortcut
    if (keyboardDropdownKeys.includes(event.key)) {
      events.emit('dropdownKeyboard', event.key as 'ArrowDown' | 'ArrowUp' | 'Enter' | 'Escape');
      return true;
    }
  }
  return false;
}
