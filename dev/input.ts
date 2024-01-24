import { Control } from "./control.js";
import { UI } from "./ui.js";

export class Input {
  private ui: UI;
  private control: Control;

  constructor(ui: UI, control: Control) {
    this.ui = ui;
    this.control = control;
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
    }
  };
}
