export interface QuadraticCommand {
  name: string;
  type:
    | {
        type: 'CHECKBOX';
        state: boolean;
        setState: Function;
      }
    | {
        type: 'COMMAND';
        state: boolean;
        setState: Function;
      };
  shortcut: string; // TODO: this should accept key icons and show them based on system
  // https://devtrium.com/posts/how-keyboard-shortcut
}

const QUADRATIC_COMMANDS = [
  {
    name: 'Delete Selected Cells',
  },
  {
    name: 'Transform Selected Cells to Uppercase',
  },
  {
    name: 'Transform Selected Cells to Lowercase',
  },
] as QuadraticCommand[];
