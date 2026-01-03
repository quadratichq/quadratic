import chalk from "chalk";
import { CLI } from "./cli.js";
import {
  ANIMATE_STATUS,
  ANIMATION_INTERVAL,
  BROKEN,
  COMPONENTS,
  DONE,
  FUNCTION_TIMER,
  KILLED,
  NO_LOGS,
  PERF,
  SPACE,
  WATCH,
} from "./constants.js";
import { Control } from "./control.js";
import { helpCLI, helpKeyboard } from "./help.js";
import { logo } from "./logo.js";

export class UI {
  private cli: CLI;
  private control: Control;
  private spin = 0;
  private help: boolean | "cli" = false;

  // keep track of cursor when drawing the menu
  private showing = false;
  private characters = 0;
  private lines = 0;
  private interval: NodeJS.Timeout;

  constructor(cli: CLI, control: Control) {
    this.cli = cli;
    this.control = control;

    console.log(logo);

    this.interval = setInterval(() => {
      this.spin = (this.spin + 1) % ANIMATE_STATUS.length;
      if (this.showing) {
        this.clear();
        this.prompt();
      }
    }, ANIMATION_INTERVAL);
  }

  quit(errorMessage?: string) {
    this.clear();
    if (errorMessage) {
      const width = Math.max(80, errorMessage.length + 4);
      const border = "-".repeat(width - 2);
      const message = chalk.yellow.bgRed(errorMessage);
      const padding = " ".repeat(Math.max(0, width - errorMessage.length - 4));
      const borderStyle = chalk.yellow.bgRed;

      process.stdout.write(borderStyle(`+${border}+\n`));
      process.stdout.write(borderStyle(`| `));
      process.stdout.write(`${message}`);
      process.stdout.write(borderStyle(`${padding} |\n`));
      process.stdout.write(borderStyle(`+${border}+\n`));
    }
    clearInterval(this.interval);
    process.stdin.pause();
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

  writeWarning(text: string, highlight: boolean) {
    // Handle undefined, null, or non-string values
    if (text == null) {
      return;
    }

    if (highlight) {
      process.stdout.write(chalk.yellow.bgRed(text));
    } else {
      process.stdout.write(chalk.red(text));
    }
    this.trackPromptTextSize(text);
  }

  write(text: string, color?: string, underline?: boolean) {
    // Handle undefined, null, or non-string values
    if (text == null) {
      return;
    }

    if (underline) {
      process.stdout.write(
        color ? chalk[color].underline(text) : chalk.underline(text),
      );
    } else {
      process.stdout.write(color ? chalk[color](text) : text);
    }
    this.trackPromptTextSize(text);
  }

  trackPromptTextSize(text: string) {
    // Handle undefined, null, or non-string values
    if (text == null || typeof text !== "string") {
      return;
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

  statusItem(component: string) {
    // For rustRenderer, we combine the status of both rustRenderer and rustLayout
    const isCombinedRenderer = component === "rustRenderer";
    const status = this.control.status[component];
    const layoutStatus = isCombinedRenderer ? this.control.status.rustLayout : null;

    // Combined error check: error if either has error
    const error =
      status === "error" || (isCombinedRenderer && layoutStatus === "error");
    // Combined killed check: killed only if both are killed
    const killed =
      status === "killed" && (!isCombinedRenderer || layoutStatus === "killed");
    // Combined loading check: loading if either is loading (not done)
    const loading =
      !status || (isCombinedRenderer && !layoutStatus);
    // Combined done check: done if both are done
    const done =
      status === true && (!isCombinedRenderer || layoutStatus === true);

    const { name, color, dark, shortcut } = COMPONENTS[component];
    const index = name.toLowerCase().indexOf(shortcut.toLowerCase());
    const writeColor = error ? "red" : this.cli.options.dark ? dark : color;
    this.write(name.substring(0, index), writeColor);
    this.write(name[index], writeColor, true);
    this.write(name.substring(index + 1), writeColor);
    if (this.getHideOption(component)) {
      this.write(" " + NO_LOGS);
    }
    if (error) {
      this.write(" " + BROKEN, "red");
    } else if (killed) {
      this.write(" " + KILLED);
    } else if (loading) {
      this.write(" " + ANIMATE_STATUS[this.spin], "gray");
    } else if (this.cli.options[component]) {
      this.write(" " + WATCH, "gray");
    } else if (done) {
      this.write(" " + DONE, "green");
    }

    if (component === "core" && this.cli.options.perf) {
      this.write(PERF);
    }

    if (component === "core" && this.cli.options.functionTimer) {
      this.write(FUNCTION_TIMER);
    }

    this.write(SPACE);
  }

  print(component: string, text = "starting...", textColor?: string) {
    if (this.getHideOption(component)) return;
    this.clear();
    const { name, color, dark } = COMPONENTS[component];
    const displayColor = this.cli.options.dark ? dark : color;
    process.stdout.write(`[${chalk[displayColor](name)}] `);
    process.stdout.write(textColor ? chalk[textColor](text) : text);
    process.stdout.write("\n");
    this.prompt();
  }

  printBoxedError(component: string, text: string) {
    if (this.getHideOption(component)) return;
    this.clear();
    const { name, color, dark } = COMPONENTS[component];
    const displayColor = this.cli.options.dark ? dark : color;
    const prefix = `[${chalk[displayColor](name)}] `;
    const message = chalk.red(text);
    const width = Math.max(80, text.length + 4);
    const border = "-".repeat(width - 2);

    process.stdout.write(`${prefix}+${border}+\n`);
    process.stdout.write(`${prefix}| ${message}${" ".repeat(Math.max(0, width - text.length - 4))} |\n`);
    process.stdout.write(`${prefix}+${border}+\n`);
    this.prompt();
  }

  prompt() {
    this.clear();
    this.write("\n");
    this.statusItem("client");
    this.statusItem("api");
    // we don't need to show core since we're not compiling it
    if (!this.cli.options.noRust) {
      this.statusItem("core");
      this.statusItem("rustRenderer"); // combined UI for rustRenderer + rustLayout
      this.statusItem("rustClient");
    }
    this.statusItem("multiplayer");
    this.statusItem("files");
    this.statusItem("connection");
    this.statusItem("types");
    this.statusItem("python");
    this.statusItem("shared");
    this.statusItem("cloudController");
    if (this.help === "cli") {
      this.write(helpCLI);
    } else if (this.help) {
      this.write(helpKeyboard);
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
    const color = this.cli.options.dark ? component.dark : component.color;
    const displayName = component.name;
    command.stdout.on("data", (data: string) => {
      const hide = COMPONENTS[name].hide || this.getHideOption(name);
      if (hide) {
        if (callback) {
          callback(data);
        }
      } else {
        this.clear();
        process.stdout.write(
          `[${chalk[color](displayName)}] ${chalk[color](data)}`,
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
      const hide = COMPONENTS[name].hide || this.getHideOption(name);
      if (hide) {
        if (callback) {
          callback(data);
        }
      } else {
        this.clear();
        if (
          data.includes("[ESLint] Found 0 error and 0 warning") ||
          data.includes(
            "[TypeScript] Found 0 errors. Watching for file changes.",
          )
        ) {
          process.stdout.write(
            `[${chalk[color](displayName)}] ${chalk[color](data)}`,
          );
        } else {
          let dataColor = this.cli.options.dark ? "white" : "red";
          process.stdout.write(
            `[${chalk[color](displayName)}] ${chalk[dataColor](data)}`,
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
