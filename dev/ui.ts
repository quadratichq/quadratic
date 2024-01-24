import chalk from "chalk";
import { CLI } from "./cli.js";
import { Control } from "./control.js";
import { help, helpCLI, helpKeyboard } from "./help.js";
import { createScreen } from "./terminal.js";

const SPACE = "     ";
const DONE = "✓";
const BROKEN = "✗";
const ANIMATE_STATUS = ["◐", "◓", "◑", "◒"];
const WATCH = "👀";
const NO_LOGS = "🙈"; // AI picked this awesome character

const ANIMATION_INTERVAL = 100;

const COMPONENTS = {
  client: { color: "magenta", name: "React", shortcut: "r" },
  api: { color: "blue", name: "API", shortcut: "a" },
  core: { color: "cyan", name: "Core", shortcut: "c" },
  multiplayer: { color: "green", name: "Multiplayer", shortcut: "m" },
  files: { color: "yellow", name: "Files", shortcut: "f" },
  types: { color: "magenta", name: "Types", shortcut: "t" },
  db: { color: "gray", name: "Database", shortcut: "d", hide: true },
  npm: { color: "gray", name: "npm install", shortcut: "n", hide: true },
  rust: { color: "gray", name: "rustup upgrade", shortcut: "r", hide: true },
};

export class UI {
  private cli: CLI;
  private control: Control;
  private spin = 0;
  private help: boolean | "cli" = false;

  // keep track of cursor when drawing the menu
  private showing = false;
  private characters = 0;
  private lines = 0;

  constructor(cli: CLI, control: Control) {
    this.cli = cli;
    this.control = control;

    setInterval(() => {
      this.spin = (this.spin + 1) % ANIMATE_STATUS.length;
      if (this.showing) {
        this.clear();
        this.prompt();
      }
    }, ANIMATION_INTERVAL);

    createScreen();
  }

  clear() {
    if (this.showing) {
      // reset the current line
      process.stdout.clearLine(0);
      this.characters = 0;

      for (let i = 0; i < this.lines; i++) {
        process.stdout.moveCursor(0, -1);
        process.stdout.clearLine(0);
      }
      this.lines = 0;

      // move cursor to start of line
      process.stdout.cursorTo(0);
      this.showing = false;
    }
  }

  write(text: string, color?: string, underline?: boolean) {
    if (underline) {
      process.stdout.write(
        color ? chalk[color].underline(text) : chalk.underline(text)
      );
    } else {
      process.stdout.write(color ? chalk[color](text) : text);
    }

    const width = process.stdout.getWindowSize()[0];

    // keep track of the cursor and wraps to remove the menu bar when writing logs

    // use an array to turn utf8 characters into 1 character
    for (const char of [...text]) {
      if (char === "\n") {
        this.lines++;
        this.characters = 0;
      } else {
        this.characters++;
      }
      if (this.characters > width) {
        this.lines++;
        this.characters = 0;
      }
    }
  }

  statusItem(component: string, alwaysWatch?: boolean) {
    const error = this.control.status[component] === "x";
    const { name, color, shortcut } = COMPONENTS[component];
    const index = name.toLowerCase().indexOf(shortcut.toLowerCase());
    const writeColor = error ? "red" : color;
    this.write(name.substring(0, index), writeColor);
    this.write(name[index], writeColor, true);
    this.write(name.substring(index + 1), writeColor);
    if (this.getHideOption(component)) {
      this.write(" " + NO_LOGS);
    }
    if (this.control.status[component] === "x") {
      this.write(" " + BROKEN, "red");
    } else if (!this.control.status[component]) {
      this.write(" " + ANIMATE_STATUS[this.spin], "gray");
    } else if (this.cli.options[component] || alwaysWatch) {
      this.write(" " + WATCH, "gray");
    } else {
      this.write(" " + DONE, "green");
    }
    this.write(SPACE);
  }

  print(component: string, text = "starting...") {
    if (this.getHideOption(component)) return;
    this.clear();
    const { name, color } = COMPONENTS[component];
    process.stdout.write(`[${chalk[color](name)}] ${text}\n`);
    this.prompt();
  }

  prompt() {
    this.clear();
    this.write("\n");
    this.write("Quadratic Dev", "underline");
    this.write(SPACE);
    this.statusItem("client", true);
    this.statusItem("api");
    this.statusItem("core");
    this.statusItem("multiplayer");
    this.statusItem("files");
    this.statusItem("types");
    if (this.help === "cli") {
      this.write(helpCLI);
    } else if (this.help) {
      this.write(helpKeyboard);
    } else {
      this.write(help);
    }
    this.showing = true;
  }

  getHideOption(name: string): boolean {
    if (name === "client") name = "react";
    if (name === "api") name = "API";
    const option = `hide${name[0].toUpperCase() + name.substring(1)}`;
    return !!this.cli.options[option];
  }

  printOutput(name: string, callback?: (data: string) => void) {
    const command = this.control[name];
    const component = COMPONENTS[name];
    const color = component.color;
    const hide = component.hide || this.getHideOption(name);
    const displayName = component.name;
    command.stdout.on("data", (data: string) => {
      if (hide) {
        if (callback) {
          callback(data);
        }
      } else {
        this.clear();
        process.stdout.write(
          `[${chalk[color](displayName)}] ${chalk[color](data)}`
        );
        this.prompt();
        if (callback) {
          this.clear();
          callback(data);
          this.prompt();
        }
      }
    });
    command.stderr.on("data", (data: string) => {
      if (hide) {
        if (callback) {
          callback(data);
        }
      } else {
        this.clear();
        if (data.includes("[ESLint] Found 0 error and 0 warning")) {
          process.stdout.write(
            `[${chalk[color](displayName)}] ${chalk[color](data)}`
          );
        } else {
          process.stdout.write(
            `[${chalk[color](displayName)}] ${chalk.red(data)}`
          );
        }
        this.prompt();
        if (callback) {
          this.clear();
          callback(data);
          this.prompt();
        }
      }
    });
  }

  showHelp(cli?: boolean) {
    if (cli) {
      this.help = "cli";
    } else {
      this.help = !this.help;
    }
    this.clear();
    this.prompt();
  }
}
