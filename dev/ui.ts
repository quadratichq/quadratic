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
  private showing = false;
  private help = false;

  constructor(cli: CLI, control: Control) {
    this.cli = cli;
    this.control = control;

    // from https://stackoverflow.com/a/12506613
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

  displayStatus(name: string, alwaysWatch?: boolean) {
    if (this.control.status[name] === "x") return BROKEN + SPACE;
    if (!this.control.status[name])
      return chalk.gray(" " + WORKING_CHARACTERS[this.spin]) + SPACE;
    if (this.cli.options[name] || alwaysWatch) return WATCH + SPACE;
    return DONE + SPACE;
  }

  clear() {
    process.stdout.clearLine(-1);
    process.stdout.cursorTo(0);
    this.showing = false;
  }

  showName(name: string): string {
    if (this.control.status[name] === "x") {
      return chalk.red(name);
    } else {
      return chalk[COMPONENTS[name].color](name);
    }
  }

  run(component: string) {
    const showing = this.showing;
    if (showing) this.clear();
    const { name, color } = COMPONENTS[component];
    process.stdout.write(`[${chalk[color](name)}] running...\n`);
    if (showing) this.prompt();
  }

  prompt() {
    this.clear();
    process.stdout.write(chalk.underline("Quadratic Dev") + SPACE);
    process.stdout.write(
      this.showName("client") + this.displayStatus("client", true)
    );
    process.stdout.write(this.showName("api") + this.displayStatus("api"));
    process.stdout.write(this.showName("core") + this.displayStatus("core"));
    process.stdout.write(
      this.showName("multiplayer") + this.displayStatus("multiplayer")
    );
    process.stdout.write(this.showName("files") + this.displayStatus("files"));
    process.stdout.write(this.showName("types") + this.displayStatus("types"));

    if (this.help) {
      process.stdout.write(
        "(press t to toggle types | c to (un)watch core | a to (un)watch API | m to (un)watch multiplayer | f to (un)watch files | h to toggle help | q to quit)"
      );
    } else {
      process.stdout.write(`(press h for help | q to quit)`);
    }
    this.showing = true;
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
