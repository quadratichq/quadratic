import killPortOriginal from "kill-port";
import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { CLI } from "./cli.js";
import { destroyScreen } from "./terminal.js";
import { UI } from "./ui.js";

const killPort = async (port: number) => {
  try {
    await killPortOriginal(port);
  } catch (e) {}
};

export class Control {
  private cli: CLI;
  private ui: UI;

  api?: ChildProcessWithoutNullStreams;
  types?: ChildProcessWithoutNullStreams;
  core?: ChildProcessWithoutNullStreams;
  client?: ChildProcessWithoutNullStreams;
  multiplayer?: ChildProcessWithoutNullStreams;
  files?: ChildProcessWithoutNullStreams;
  db?: ChildProcessWithoutNullStreams;
  npm?: ChildProcessWithoutNullStreams;
  rust?: ChildProcessWithoutNullStreams;

  status = {
    client: false,
    api: false,
    core: false,
    multiplayer: false,
    files: false,
    types: false,
    db: false,
    npm: false,
  };

  constructor(cli: CLI) {
    this.cli = cli;
  }

  quit() {
    if (this.api) this.api.kill("SIGKILL");
    if (this.files) this.files.kill("SIGTERM");
    if (this.multiplayer) this.multiplayer.kill("SIGTERM");
    if (this.client) this.client.kill("SIGTERM");
    destroyScreen();
    process.exit(0);
  }

  handleResponse(
    name: string,
    data: string,
    options: {
      success: string | string[];
      error: string | string[];
      start: string | string[];
    },
    successCallback?: () => void
  ) {
    const response = data.toString();
    if (
      Array.isArray(options.success)
        ? (options.success as string[]).some((s) => response.includes(s))
        : response.includes(options.success as string)
    ) {
      this.status[name] = true;
      if (successCallback) {
        successCallback();
      }
    } else if (
      Array.isArray(options.error)
        ? (options.error as string[]).some((s) => response.includes(s))
        : response.includes(options.error as string)
    ) {
      this.status[name] = "x";
    } else if (
      Array.isArray(options.start)
        ? (options.start as string[]).some((s) => response.includes(s))
        : response.includes(options.start as string)
    ) {
      this.status[name] = false;
    }
  }

  async runApi() {
    this.ui.print("api");
    await killPort(8000);
    this.api = spawn("npm", [
      "run",
      this.cli.options.api ? "start" : "start-no-watch",
      "--workspace=quadratic-api",
    ]);
    this.ui.printOutput("api", (data) =>
      this.handleResponse("api", data, {
        success: "Server running on port",
        error: "npm ERR!",
        start: "> quadratic-api",
      })
    );
  }

  restartApi() {
    if (this.api) {
      this.api.kill("SIGKILL");
    }
    this.cli.options.api = !this.cli.options.api;
    this.runApi();
  }

  async runTypes() {
    this.ui.print("types");
    return new Promise((resolve) => {
      if (!this.cli.options.skipTypes) {
        this.types = spawn("npm", ["run", "build:wasm:types"]);
        this.ui.printOutput("types", (data) => {
          this.handleResponse("types", data, {
            success: "Running ",
            error: "error:",
            start: ["Compiling", "> quadratic"],
          });
        });
        this.types.on("exit", resolve);
      } else {
        resolve(undefined);
      }
    });
  }

  restartTypes() {
    if (this.types) {
      this.types.kill("SIGKILL");
      this.runTypes();
    }
  }

  runClient() {
    this.ui.print("client");
    if (this.client) {
      this.client.kill("SIGKILL");
    }
    this.client = spawn("npm", ["start", "--workspace=quadratic-client"]);
    this.ui.printOutput("client", (data) =>
      this.handleResponse("client", data, {
        success: "Found 0 errors.",
        error: ["ERROR(", "npm ERR!"],
        start: "> quadratic-client@",
      })
    );
  }

  togglePerf() {
    this.cli.options.perf = !this.cli.options.perf;
    this.restartCore();
  }

  runCore() {
    this.ui.print("core");
    return new Promise((resolve) => {
      if (this.cli.options.core) {
        this.core = spawn("npm", [
          "run",
          this.cli.options.perf
            ? "watch:wasm:perf:javascript"
            : "watch:wasm:javascript",
        ]);
        this.ui.printOutput("core", (data) =>
          this.handleResponse(
            "core",
            data,
            {
              success: "[Finished running. Exit status: 0",
              error: "error[",
              start: ["> quadratic", "[Running "],
            },
            () => {
              this.runClient();
              resolve(undefined);
            }
          )
        );
      } else {
        this.core = spawn("npm", [
          "run",
          this.cli.options.perf
            ? "build:wasm:perf:javascript"
            : "build:wasm:javascript",
        ]);
        this.ui.printOutput("core", (data) =>
          this.handleResponse("core", data, {
            success: "Your wasm pkg is ready to publish",
            error: "error[",
            start: "[Running ",
          })
        );
        this.core.on("exit", () => {
          this.runClient();
          resolve(undefined);
        });
      }
    });
  }

  restartCore() {
    if (this.core) {
      this.core.kill("SIGKILL");
    }
    this.cli.options.core = !this.cli.options.core;
    this.runCore();
  }

  runMultiplayer() {
    this.ui.print("multiplayer");
    return new Promise(async (resolve) => {
      await killPort(3001);
      this.multiplayer = spawn("npm", [
        "run",
        this.cli.options.multiplayer ? "dev" : "start",
        "--workspace=quadratic-multiplayer",
      ]);
      this.ui.printOutput("multiplayer", (data) =>
        this.handleResponse(
          "multiplayer",
          data,
          {
            success: "listening on",
            error: "error[",
            start: "    Compiling",
          },
          () => resolve(undefined)
        )
      );
    });
  }

  restartMultiplayer() {
    if (this.multiplayer) {
      this.multiplayer.kill("SIGKILL");
    }
    this.cli.options.multiplayer = !this.cli.options.multiplayer;
    this.runMultiplayer();
  }

  runFiles() {
    this.ui.print("files");
    return new Promise(async (resolve) => {
      await killPort(3002);
      this.files = spawn("npm", [
        "run",
        this.cli.options.files ? "dev" : "start",
        "--workspace=quadratic-files",
      ]);
      this.ui.printOutput("files", (data) => {
        this.handleResponse("files", data, {
          success: "listening on",
          error: ["error[", "npm ERR!"],
          start: "    Compiling",
        });
      });
    });
  }

  restartFiles() {
    if (this.files) {
      this.files.kill("SIGKILL");
    }
    this.cli.options.files = !this.cli.options.files;
    this.runFiles();
  }

  runDb() {
    this.ui.print("db", "checking migration...");
    if (this.db) {
      this.db.kill("SIGTERM");
    }
    this.db = spawn("npm", [
      "run",
      "prisma:migrate",
      "--workspace=quadratic-api",
    ]);
    this.ui.printOutput("db");
    this.db.once("exit", (code) => {
      if (code === 0) {
        this.ui.print("db", "completed");
      } else {
        this.ui.print("db", "failed");
      }
    });
  }

  runNpmInstall() {
    this.ui.print("npm", "installing...");
    this.npm = spawn("npm", ["install"]);
    this.npm.on("close", (code) => {
      if (code === 0) {
        this.ui.print("npm", "completed");
      } else {
        this.ui.print("npm", "failed");
      }
    });
  }

  runRust() {
    this.ui.print("rust", "upgrading...");
    this.rust = spawn("rustup", ["upgrade"]);
    this.rust.on("close", (code) => {
      if (code === 0) {
        this.ui.print("rust", "completed");
      } else {
        this.ui.print("rust", "failed");
      }
    });
  }

  async start(ui: UI) {
    this.ui = ui;
    this.runRust();
    this.runApi();
    this.runDb();
    this.runNpmInstall();
    await this.runTypes();
    await this.runCore();
    await this.runMultiplayer();
    await this.runFiles();
  }
}
