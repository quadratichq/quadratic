import { CLI } from "./cli.js";
import { Control } from "./control.js";
import { UI } from "./ui.js";

export class Input {
  private ui: UI;
  private control: Control;
  private cli: CLI;

  constructor(ui: UI, control: Control, cli: CLI) {
    this.ui = ui;
    this.control = control;
    this.cli = cli;

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", this.handleKey);
  }

  private handleKey = (key: string) => {
    switch (key.toString()) {
      case "q":
        this.control.quit();
        break;
      case "\u0003":
        this.control.quit();
        break; // ctrl + x
      case "h": // help
        this.ui.showHelp();
        break;
      case "H": // CLI help
        this.ui.showHelp(true);
        break;
      case "t": // toggle types
        this.control.restartTypes();
        break;
      case "c": // toggle core
        this.control.restartCore();
        break;
      case "m": // toggle multiplayer
        this.control.restartMultiplayer();
        break;
      case "f": // toggle files
        this.control.restartFiles();
        break;
      case "p":
        this.control.togglePerf();
        break;
      case "a": // toggle API
        this.control.restartApi();
        break;
      case "A": // toggle showing API
        this.cli.options.hideAPI = !this.cli.options.hideAPI;
        break;
      case "C": // toggle showing Core
        this.cli.options.hideCore = !this.cli.options.hideCore;
        break;
      case "M": // toggle showing Multiplayer
        this.cli.options.hideMultiplayer = !this.cli.options.hideMultiplayer;
        break;
      case "F": // toggle showing Files
        this.cli.options.hideFiles = !this.cli.options.hideFiles;
        break;
      case "R": // toggle showing React
        this.cli.options.hideReact = !this.cli.options.hideReact;
        break;
      case "T": // toggle showing React
        this.cli.options.hideTypes = !this.cli.options.hideTypes;
        break;
      case "d": // toggle dark theme
        this.cli.options.dark = !this.cli.options.dark;
        break;
      case "r": // restart React
        this.control.runClient();
        break;
    }
  };
}
