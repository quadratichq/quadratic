import killPortOriginal from "kill-port";
import {
  ChildProcessWithoutNullStreams,
  exec,
  spawn,
} from "node:child_process";
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

  status: Record<string, boolean | "error" | "killed"> = {
    client: false,
    api: false,
    core: false,
    multiplayer: false,
    files: false,
    types: false,
    db: false,
    npm: false,
    postgres: false,
    redis: false,
  };

  constructor(cli: CLI) {
    this.cli = cli;
    this.isRedisRunning().then((running: boolean | "not found") => {
      this.ui.print("redis", "checking whether redis is running...");
      if (running === "not found") {
        this.status.redis = "killed"; // use killed to indicate that redis-cli was not found
        this.ui.print("redis", "redis-cli not found", "red");
      } else if (running === true) {
        this.status.redis = true;
        this.ui.print("redis", "is running", "green");
      } else {
        this.status.redis = "error";
        this.ui.print("redis", "is NOT running!", "red");
      }
    });
    this.isPostgresRunning().then((running: boolean | "not found") => {
      this.ui.print("redis", "checking whether postgres is running...");
      if (running === "not found") {
        this.status.postgres = "killed"; // use killed to indicate that redis-cli was not found
        this.ui.print("postgres", "pg_isready not found", "red");
      } else if (running === true) {
        this.status.postgres = true;
        this.ui.print("postgres", "is running", "green");
      } else {
        this.status.postgres = "error";
        this.ui.print("postgres", "is NOT running!", "red");
      }
    });
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
      this.status[name] = "error";
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

  async runTypes(restart?: boolean) {
    this.ui.print("types");
    if (this.cli.options.skipTypes && !restart) {
      this.runCore();
    } else {
      this.types = spawn("npm", ["run", "build:wasm:types"]);
      this.ui.printOutput("types", (data) => {
        this.handleResponse("types", data, {
          success: "Running ",
          error: "error:",
          start: ["Compiling", "> quadratic"],
        });
      });
      this.types.on("exit", () => {
        if (!restart) {
          this.runCore();
        }
      });
    }
  }

  restartTypes() {
    if (this.types) {
      this.types.kill();
      this.runTypes(true);
    }
  }

  runClient() {
    this.ui.print("client");
    if (this.client) {
      this.client.kill("SIGKILL");
    }
    // clean the node_modules/.vite directory to avoid client errors
    const clean = exec("rm -rf node_modules/.vite");
    clean.on("close", () => {
      this.client = spawn("npm", ["start", "--workspace=quadratic-client"]);
      this.ui.printOutput("client", (data) => {
        this.handleResponse("client", data, {
          success: "Found 0 errors.",
          error: ["ERROR(", "npm ERR!"],
          start: "> quadratic-client@",
        });
        if (data.includes("Killed: 9")) {
          this.ui.print(
            "client",
            "React failed to run. Trying again...",
            "red"
          );
          this.runClient();
        }
      });
    });
  }

  togglePerf() {
    this.cli.options.perf = !this.cli.options.perf;
    this.restartCore();
  }

  runCore(restart?: boolean) {
    this.ui.print("core");
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
            if (!restart) {
              this.runNpmInstall();
              if (this.status.multiplayer !== "killed") {
                this.runMultiplayer();
              } else {
                this.runFiles();
              }
            }
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
        if (!restart) {
          this.runNpmInstall();
          if (this.status.multiplayer !== "killed") {
            this.runMultiplayer();
          } else {
            this.runFiles();
          }
        }
      });
    }
  }

  killMultiplayer() {
    if (this.status.multiplayer === "killed") {
      this.status.multiplayer = false;
      this.ui.print("multiplayer", "resurrecting...");
    } else {
      if (this.multiplayer) {
        this.multiplayer.kill("SIGKILL");
        this.ui.print("multiplayer", "killed", "red");
      }
      this.status.multiplayer = "killed";
    }
  }

  restartCore() {
    if (this.core) {
      this.core.kill("SIGKILL");
    }
    this.cli.options.core = !this.cli.options.core;
    this.runCore();
  }

  async runMultiplayer(restart?: boolean) {
    if (this.status.multiplayer === "killed") return;
    this.ui.print("multiplayer");
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
        () => {
          if (!restart) {
            this.runFiles();
          }
        }
      )
    );
  }

  restartMultiplayer() {
    if (this.multiplayer) {
      this.multiplayer.kill("SIGKILL");
    }
    this.cli.options.multiplayer = !this.cli.options.multiplayer;
    this.runMultiplayer();
  }

  runFiles() {
    if (this.status.files === "killed") return;
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

  killFiles() {
    if (this.status.files === "killed") {
      this.status.files = false;
      this.ui.print("files", "restarting...");
    } else {
      if (this.files) {
        this.files.kill("SIGKILL");
        this.ui.print("files", "killed", "red");
      }
      this.status.files = "killed";
    }
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
        this.ui.print("db", "migration completed");
        this.status.db = true;
      } else {
        this.ui.print("db", "failed");
        this.status.db = "error";
      }
      this.runApi();
    });
  }

  runNpmInstall() {
    this.ui.print("npm", "installing...");
    this.npm = spawn("npm", ["install"]);
    this.npm.on("close", (code) => {
      if (code === 0) {
        this.ui.print("npm", "installation completed");
        this.status.npm = true;
      } else {
        this.ui.print("npm", "installation failed");
        this.status.npm = "error";
      }
      this.runClient();
    });
  }

  runRust() {
    this.ui.print("rust", "upgrading...");
    this.rust = spawn("rustup", ["upgrade"]);
    this.rust.on("close", (code) => {
      if (code === 0) {
        this.ui.print("rust", "completed");
        this.status.rust = true;
      } else {
        this.ui.print("rust", "failed");
        this.status.rust = "error";
      }
      this.runTypes();
    });
  }

  isRedisRunning(): Promise<boolean | "not found"> {
    return new Promise((resolve) => {
      const redis = spawn("redis-cli", ["ping"]);
      redis.on("error", (e: any) => {
        if (e.code === "ENOENT") {
          resolve("not found");
        }
      });
      redis.on("close", (code) => {
        resolve(code === 0);
      });
    });
  }

  isPostgresRunning(): Promise<boolean | "not found"> {
    return new Promise((resolve) => {
      const postgres = spawn("pg_isready");
      postgres.on("error", (e: any) => {
        if (e.code === "ENOENT") {
          resolve("not found");
        }
      });
      postgres.on("close", (code) => {
        resolve(code === 0);
      });
    });
  }

  async start(ui: UI) {
    this.ui = ui;
    this.runRust();
    this.runDb();
  }
}
