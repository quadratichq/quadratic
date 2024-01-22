import chalk from "chalk";
import { ChildProcessWithoutNullStreams } from "node:child_process";
import { CLI } from "./cli.js";
import { Control } from "./control.js";

const SPACE = "     ";
const DONE = chalk.green(" ✓");
const BROKEN = chalk.red(" ✗");
const WORKING_CHARACTERS = ["◐", "◓", "◑", "◒"];
const WATCH = chalk.gray(" 👀");
const ANIMATION_INTERVAL = 100;

const COMPONENTS = {
  client: { color: "magenta", name: "Client" },
  api: { color: "blue", name: "API" },
  core: { color: "cyan", name: "Core" },
  multiplayer: { color: "green", name: "Multiplayer" },
  files: { color: "yellow", name: "Files" },
  types: { color: "magenta", name: "Types" },
};

export class UI {
  private cli: CLI;
  private control: Control;
  private spin = 0;
  private showing = 0;
  private help = false;

  constructor(cli: CLI, control: Control) {
    this.cli = cli;
    this.control = control;

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", (key) => {
      switch (key.toString()) {
        case "q":
          control.quit();
          break;
        case "\u0003":
          control.quit();
          break; // ctrl + x
        case "h": // help
          this.showHelp();
          break;
        case "t": // toggle types
          control.restartTypes();
          break;
        case "c": // toggle core
          control.restartCore();
          break;
        case "m": // toggle multiplayer
          control.restartMultiplayer();
          break;
        case "f": // toggle files
          control.restartFiles();
          break;
        case "p":
          control.togglePerf();
          break;
        case "a": // toggle API
          control.restartApi();
          break;
      }
    });

    setInterval(() => {
      this.spin = (this.spin + 1) % WORKING_CHARACTERS.length;
      if (this.showing) {
        this.clear();
        this.prompt();
      }
    }, ANIMATION_INTERVAL);

    this.prompt();
  }

  clear() {
    if (this.showing) {
      const width = process.stdout.getWindowSize()[0];
      const lines = Math.floor(this.showing / width);
      for (let i = 0; i < lines + 1; i++) {
        process.stdout.clearLine(0);
        process.stdout.moveCursor(0, -1);
      }
      process.stdout.cursorTo(0);
      this.showing = 0;
    }
  }

  write(text: string, color?: string): number {
    process.stdout.write(color ? chalk[color](text) : text);
    return text.length;
  }

  statusItem(name: string, alwaysWatch?: boolean): number {
    let status = "";
    if (this.control.status[name] === "x") {
      status = BROKEN + SPACE;
    } else if (!this.control.status[name]) {
      status = chalk.gray(" " + WORKING_CHARACTERS[this.spin]) + SPACE;
    } else if (this.cli.options[name] || alwaysWatch) {
      status = WATCH + SPACE;
    } else {
      status = DONE + SPACE;
    }
    const error = this.control.status[name] === "x";
    return this.write(name + status, error ? "red" : COMPONENTS[name].color);
  }

  run(component: string) {
    this.clear();
    const { name, color } = COMPONENTS[component];
    process.stdout.write(`[${chalk[color](name)}] running...\n`);
    this.prompt();
  }

  prompt() {
    this.clear();
    this.write("\n");
    let characters =
      this.write("Quadratic Dev", "underline") +
      this.write(SPACE) +
      this.statusItem("client", true) +
      this.statusItem("api") +
      this.statusItem("core") +
      this.statusItem("multiplayer") +
      this.statusItem("files") +
      this.statusItem("types");

    if (this.help) {
      this.write("\n");
      // characters += process.stdout.getWindowSize()[0] - 1;
      characters += this.write(
        "(press t to toggle types | c to (un)watch core | a to (un)watch API | m to (un)watch multiplayer | f to (un)watch files | p to toggle perf for core | h to toggle help | q to quit)"
      );
    } else {
      characters += this.write(` (press h for help | q to quit)`);
    }
    this.showing = characters;
  }

  printOutput(
    command: ChildProcessWithoutNullStreams,
    name: string,
    color: string,
    callback?: (data: string) => void
  ) {
    command.stdout.on("data", (data) => {
      this.clear();
      process.stdout.write(`[${chalk[color](name)}] ${chalk[color](data)}`);
      this.prompt();
      if (callback) {
        this.clear();
        callback(data);
        this.prompt();
      }
    });
    command.stderr.on("data", (data) => {
      this.clear();
      process.stdout.write(`[${chalk[color](name)}] ${chalk.red(data)}`);
      this.prompt();
      if (callback) {
        this.clear();
        callback(data);
        this.prompt();
      }
    });
  }

  showHelp() {
    this.help = !this.help;
    this.clear();
    this.prompt();
  }
}
