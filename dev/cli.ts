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
    hideReact: boolean;
    hideAPI: boolean;
    hideCore: boolean;
    hideTypes: boolean;
    hideMultiplayer: boolean;
    hideFiles: boolean;
    dark: boolean;
  };

  constructor() {
    const program = new Command();
    program
      .name("node dev")
      .description(
        "Runs the Quadratic dev server. By default, only React runs in watch mode."
      )
      .option("-a, --api", "Watch the quadratic-api directory")
      .option("-c, --core", "Watch the quadratic-core directory")
      .option("-m, --multiplayer", "Watch the quadratic-multiplayer directory")
      .option("-f, --files", "Watch the quadratic-files directory")
      .option("-l, --all", "Watch all directories")
      .option("-s, --skipTypes", "Skip WASM types compilation")
      .option(
        "-p, --perf",
        "Run quadratic-core in perf mode (slower to link but faster runtime)"
      )
      .option("-R, --hideReact", "Hide React output")
      .option("-A, --hideAPI", "Hide React output")
      .option("-C, --hideCore", "Hide React output")
      .option("-T, --hideTypes", "Hide Types output")
      .option("-M, --hideMultiplayer", "Hide Multiplayer output")
      .option("-F, --hideFiles", "Hide Files output")
      .option("-d, --dark", "Use dark theme")
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
