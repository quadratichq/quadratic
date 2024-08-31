import { z } from 'zod';
import { ActionEnum } from './actions';
import { KeysEnum, MacModifiersEnum, WindowsModifiersEnum } from './keys';

function validateShortcut(
  shortcut: string,
  platformKeys: typeof KeysEnum,
  platformModifiers: typeof MacModifiersEnum | typeof WindowsModifiersEnum
): boolean {
  const keys = shortcut.split('+').map((part) => part.trim());
  const lastKey = keys[keys.length - 1];

  if (lastKey !== 'Click' && !platformKeys.safeParse(lastKey).success) {
    return false;
  }

  for (let i = 0; i < keys.length - 1; i++) {
    if (!platformModifiers.safeParse(keys[i]).success) {
      return false;
    }
  }

  const modifiers = new Set(keys.slice(0, -1));

  // Check double modifiers
  if (modifiers.size !== keys.length - 1) {
    return false;
  }

  // Check cross platform modifiers
  if (modifiers.has('Cmd') && modifiers.has('Win')) {
    return false;
  }

  return true;
}

const ShortcutSchema = z.object({
  action: ActionEnum,
  shortcuts: z.object({
    mac: z.array(
      z.string().refine((shortcut) => validateShortcut(shortcut, KeysEnum, MacModifiersEnum), {
        message: 'Invalid Mac shortcut',
      })
    ),
    windows: z.array(
      z.string().refine((shortcut) => validateShortcut(shortcut, KeysEnum, WindowsModifiersEnum), {
        message: 'Invalid Windows shortcut',
      })
    ),
  }),
});

export const ShortcutsSchema = z.array(ShortcutSchema).refine(
  (shortcuts) => {
    const allActions = new Set(ActionEnum.options);
    const defineActions = new Set(shortcuts.map((shortcut) => shortcut.action));
    return allActions.size === defineActions.size;
  },
  { message: 'Shortcuts not defined for all actions' }
);

export type Shortcuts = z.infer<typeof ShortcutsSchema>;
