const TAB = '  ';

class JavascriptConsole {
  private oldConsoleLog: Function;
  logs: any[] = [];

  constructor() {
    this.oldConsoleLog = console.log;
    console.log = this.consoleMap;
    console.warn = this.consoleMap;
  }

  log(...args: any[]) {
    this.oldConsoleLog(args);
  }

  consoleMap = (...args: any[]) => {
    args = args.map((a) => {
      return this.mapArgument(a);
    });
    this.logs.push(...args);
  };

  reset() {
    this.logs = [];
  }

  push(s: any) {
    if (Array.isArray(s)) {
      this.logs.push(...s);
    } else {
      this.logs.push(s);
    }
  }

  output() {
    if (this.logs.length) {
      return this.logs.join('');
    }
    return null;
  }

  tab = (n: number) => {
    return Array(n).fill(TAB).join('');
  };

  // Better console.log for objects and array
  mapArgument(a: any, level = 0) {
    if (Array.isArray(a)) {
      if (a.length === 0) {
        return 'Array: []\\n';
      }
      let s = 'Array: [\\n';
      for (let i = 0; i < a.length; i++) {
        s += this.tab(level + 1) + i + ': ' + this.mapArgument(a[i], level + 2);
      }
      return s + this.tab(level) + ']\\n';
    } else if (a === null) {
      return 'null\\n';
    } else if (typeof a == 'bigint') {
      return a.toString() + 'n\\n';
    } else if (a instanceof Date) {
      return a.toString() + '\\n';
    } else if (typeof a === 'object') {
      let s = 'Object: { \\n';
      for (const key in a) {
        s += this.tab(level + 1) + key + ': ' + this.mapArgument(a[key], level + 1);
      }
      return s + this.tab(level) + '}\\n';
    } else if (typeof a === 'string') {
      return a + '\\n';
    } else if (a === undefined) {
      return 'undefined\\n';
    } else {
      return a + '\\n';
    }
  }
}

// Keeps track of all Javascript logs and expands Arrays and Objects to make
// them more useful.
export const javascriptConsole = new JavascriptConsole();
