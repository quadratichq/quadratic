import { Command } from "commander";

export class CLI {
  options: {
    api: boolean;
    core: boolean;
    multiplayer: boolean;
    files: boolean;
    skipTypes: boolean;
    all: boolean;
    perf: boolean;
    reactHide: boolean;
    apiHide: boolean;
    multiplayerHide: boolean;
    filesHide: boolean;
  };

  constructor() {
    const program = new Command();
    program
      .name("node dev")
      .description(
        "Runs the Quadratic dev server. By default, only React runs in watch mode."
      )
      .option("-p, --api", "Watch the quadratic-api directory")
      .option("-c, --core", "Watch the quadratic-core directory")
      .option("-m, --multiplayer", "Watch the quadratic-multiplayer directory")
      .option("-f, --files", "Watch the quadratic-files directory")
      .option("-s, --skipTypes", "Skip WASM types compilation")
      .option("-a, --all", "Watch all directories")
      .option("-R, --reactHide", "Hide React output")
      .option(
        "-p, --perf",
        "Run quadratic-core in perf mode (slower linking but faster runtime)"
      )
      .showHelpAfterError();

    program.parse();
    this.options = program.opts();

    if (this.options.all) {
      this.options.api = true;
      this.options.core = true;
      this.options.multiplayer = true;
      this.options.files = true;
    }
  }
}
