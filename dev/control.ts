import killPort from "kill-port";
import {
  ChildProcessWithoutNullStreams,
  exec,
  spawn,
} from "node:child_process";
import treeKill from "tree-kill";
import { CLI } from "./cli.js";
import { UI } from "./ui.js";
export class Control {
  private cli: CLI;
  private ui: UI;
  private quitting = false;

  api?: ChildProcessWithoutNullStreams;
  types?: ChildProcessWithoutNullStreams;
  core?: ChildProcessWithoutNullStreams;
  client?: ChildProcessWithoutNullStreams;
  multiplayer?: ChildProcessWithoutNullStreams;
  files?: ChildProcessWithoutNullStreams;
  connection?: ChildProcessWithoutNullStreams;
  python?: ChildProcessWithoutNullStreams;
  db?: ChildProcessWithoutNullStreams;
  npm?: ChildProcessWithoutNullStreams;
  rust?: ChildProcessWithoutNullStreams;
  shared?: ChildProcessWithoutNullStreams;

  signals: Record<string, AbortController> = {};

  status: Record<string, boolean | "error" | "killed"> = {
    client: false,
    api: false,
    core: false,
    multiplayer: false,
    files: false,
    connection: false,
    python: false,
    types: false,
    db: false,
    npm: false,
    postgres: false,
    redis: false,
    shared: false,
  };

  constructor(cli: CLI) {
    this.cli = cli;
  }

  async quit() {
    if (this.quitting) return;
    this.quitting = true;
    this.ui.quit();
    await Promise.all([
      this.kill("api"),
      this.kill("types"),
      this.kill("core"),
      this.kill("client"),
      this.kill("multiplayer"),
      this.kill("files"),
      this.kill("connection"),
      this.kill("python"),
      this.kill("shared"),
    ]);
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
    successCallback?: () => void,
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

  checkServices() {
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
      this.ui.print("postgres", "checking whether postgres is running...");
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

  async runApi(restart?: boolean) {
    if (this.quitting) return;
    this.status.api = false;
    await this.kill("api");
    try {
      this.ui.print(
        "api",
        "killing port 8000 to ensure it's really good and dead...",
      );
      await killPort(8000);
      // need to ignore the error if there is no process running on port 8000
    } catch (e) {}
    this.ui.print("api");

    // this function is called more than once,
    // so we need to check if it's the first run
    let firstRun = true;

    this.signals.api = new AbortController();
    this.api = spawn(
      "npm",
      [
        "run",
        this.cli.options.api ? "start" : "start-no-watch",
        "--workspace=quadratic-api",
      ],
      { signal: this.signals.api.signal },
    );
    this.ui.printOutput("api", (data) =>
      this.handleResponse(
        "api",
        data,
        {
          success: "Server running on port",
          error: "npm ERR!",
          start: "> quadratic-api",
        },
        () => {
          if (firstRun && !restart) {
            firstRun = false;
            if (this.status.multiplayer !== "killed" && !this.multiplayer) {
              this.runMultiplayer();
            }
            if (this.status.files !== "killed" && !this.files) {
              this.runFiles();
            }
            if (this.status.connection !== "killed" && !this.connection) {
              this.runConnection();
            }
          }
        },
      ),
    );
  }

  async restartApi() {
    this.cli.options.api = !this.cli.options.api;
    this.runApi(true);
  }

  async runTypes(restart?: boolean) {
    this.ui.print("types");
    this.status.types = false;
    await this.kill("types");
    if (!this.cli.options.skipTypes || restart) {
      this.types = spawn("npm run build:wasm:types", { shell: true });
      this.ui.printOutput("types", (data) => {
        this.handleResponse("types", data, {
          success: "Running ",
          error: "error:",
          start: ["Compiling", "> quadratic"],
        });
      });
      this.types.on("exit", () => {
        this.types = undefined;
        this.ui.print("types", "completed.");
      });
    }
  }

  async restartTypes() {
    this.runTypes(true);
  }

  async runClient() {
    if (this.quitting) return;
    this.status.client = false;
    this.ui.print("client");
    await this.kill("client");
    this.signals.client = new AbortController();
    // clean the node_modules/.vite directory to avoid client errors
    const clean = exec("rm -rf quadratic-client/node_modules/.vite");
    clean.on("close", () => {
      this.client = spawn(
        "npm",
        [
          "run",
          this.cli.options.client ? "start" : "start:no-hmr",
          "--workspace=quadratic-client",
        ],
        {
          signal: this.signals.client.signal,
        },
      );
      this.ui.printOutput("client", (data) => {
        this.handleResponse("client", data, {
          success: ["Found 0 errors.", "Network: use --host to expose"],
          error: ["ERROR(", "npm ERR!"],
          start: "> quadratic-client@",
        });
        if (data.includes("Killed: 9")) {
          this.ui.print(
            "client",
            "React failed to run. Trying again...",
            "red",
          );
          this.runClient();
        }
      });
    });
  }

  restartClient() {
    this.cli.options.client = !this.cli.options.client;
    this.runClient();
  }

  togglePerf() {
    this.cli.options.perf = !this.cli.options.perf;
    this.restartCore();
  }

  async runCore(restart?: boolean) {
    if (this.quitting) return;
    this.status.core = false;
    this.ui.print("core");
    await this.kill("core");

    // this function is called more than once,
    // so we need to check if it's the first run
    let firstRun = true;

    this.signals.core = new AbortController();
    this.core = spawn(
      "npm",
      [
        "run",
        this.cli.options.perf
          ? `${this.cli.options.core ? "watch" : "build"}:wasm:perf:javascript`
          : `${this.cli.options.core ? "watch" : "build"}:wasm:javascript`,
      ],
      { signal: this.signals.core.signal },
    );
    this.ui.printOutput("core", (data) =>
      this.handleResponse(
        "core",
        data,
        {
          success: ["[Finished running. Exit status: 0", "ready to publish"],
          error: "error[",
          start: ["> quadratic", "[Running "],
        },
        () => {
          if (firstRun && !restart) {
            this.runNpmInstall();
            firstRun = false;
          }
        },
      ),
    );
  }

  kill(name: string) {
    if (!this[name]) return;
    this.ui.print(name, "killing...");
    return new Promise((resolve) => {
      this[name].stdout?.pause();
      this[name].stderr?.pause();
      treeKill(this[name].pid, (error?: Error) => {
        if (error) {
          this.ui.print(name, "failed to kill", "red");
        } else {
          this.ui.print(name, "successfully killed");
          resolve(undefined);
        }
      });
    });
  }

  async killMultiplayer() {
    if (this.status.multiplayer === "killed") {
      this.status.multiplayer = false;
      this.ui.print("multiplayer", "resurrecting...");
      this.runMultiplayer(true);
    } else {
      if (this.multiplayer) {
        await this.kill("multiplayer");
        this.ui.print("multiplayer", "killed", "red");
      }
      this.status.multiplayer = "killed";
    }
  }

  async restartCore() {
    this.cli.options.core = !this.cli.options.core;
    this.runCore(true);
  }

  async runMultiplayer(restart?: boolean) {
    if (this.quitting) return;
    if (this.status.multiplayer === "killed") return;
    this.status.multiplayer = false;
    await this.kill("multiplayer");
    try {
      this.ui.print(
        "multiplayer",
        "killing port 3001 to ensure it's really good and dead...",
      );
      await killPort(3001);
      // need to ignore the error if there is no process running on port 3001
    } catch (e) {}

    this.signals.multiplayer = new AbortController();
    this.ui.print("multiplayer");
    this.multiplayer = spawn(
      "cargo",
      this.cli.options.multiplayer
        ? ["watch", "-x", "run -p quadratic-multiplayer --target-dir=target"]
        : ["run", "-p", "quadratic-multiplayer", "--target-dir=target"],
      {
        signal: this.signals.multiplayer.signal,
        cwd: "quadratic-multiplayer",
        env: { ...process.env, RUST_LOG: "info" },
      },
    );
    this.ui.printOutput("multiplayer", (data) =>
      this.handleResponse("multiplayer", data, {
        success: "listening on",
        error: "error[",
        start: "    Compiling",
      }),
    );
  }

  async restartMultiplayer() {
    this.cli.options.multiplayer = !this.cli.options.multiplayer;
    if (this.multiplayer) {
      this.runMultiplayer(true);
    }
  }

  async runFiles() {
    if (this.quitting) return;
    if (this.status.files === "killed") return;
    this.status.files = false;
    this.ui.print("files");
    await this.kill("files");
    try {
      this.ui.print(
        "files",
        "killing port 3002 to ensure it's really good and dead...",
      );
      await killPort(3002);
      // need to ignore the error if there is no process running on port 3001
    } catch (e) {}

    this.signals.files = new AbortController();
    this.files = spawn(
      "cargo",
      this.cli.options.files
        ? ["watch", "-x", "run -p quadratic-files --target-dir=target"]
        : ["run", "-p", "quadratic-files", "--target-dir=target"],
      {
        signal: this.signals.files.signal,
        cwd: "quadratic-files",
        env: { ...process.env, RUST_LOG: "info" },
      },
    );
    this.ui.printOutput("files", (data) => {
      this.handleResponse("files", data, {
        success: "listening on",
        error: ["error[", "npm ERR!"],
        start: "    Compiling",
      });
    });
  }

  async restartFiles() {
    this.cli.options.files = !this.cli.options.files;
    if (this.files) {
      this.runFiles();
    }
  }

  async killFiles() {
    if (this.status.files === "killed") {
      this.status.files = false;
      this.ui.print("files", "restarting...");
      this.runFiles();
    } else {
      if (this.files) {
        await this.kill("files");
        this.ui.print("files", "killed", "red");
      }
      this.status.files = "killed";
    }
  }

  async runShared(restart?: boolean) {
    if (this.quitting) return;
    if (this.status.shared === "killed") return;
    this.status.shared = false;
    this.ui.print("shared");
    await this.kill("shared");

    let firstRun = true;

    this.signals.shared = new AbortController();
    this.shared = spawn(
      `npm run ${this.cli.options.shared ? "watch" : "compile"} --workspace=quadratic-shared`,
      {
        signal: this.signals.shared.signal,
        shell: true,
      },
    );
    this.ui.printOutput("shared", (data) => {
      this.handleResponse(
        "shared",
        data,
        {
          success: [" 0 errors.", "successfully"],
          error: ["error"],
          start: "Starting",
        },
        () => {
          if (firstRun && !restart) {
            firstRun = false;
            if (this.status.db !== "killed" && !this.db) {
              this.runDb();
            }
          }
        },
      );
    });
  }

  async restartShared() {
    this.cli.options.shared = !this.cli.options.shared;
    if (this.shared) {
      this.runShared(true);
    }
  }

  async killShared() {
    if (this.status.shared === "killed") {
      this.status.shared = false;
      this.ui.print("shared", "restarting...");
      this.runShared();
    } else {
      if (this.shared) {
        await this.kill("shared");
        this.ui.print("shared", "killed", "red");
      }
      this.status.shared = "killed";
    }
  }
  async runConnection() {
    if (this.quitting) return;
    if (this.status.connection === "killed") return;
    this.status.connection = false;
    this.ui.print("connection");
    await this.kill("connection");
    try {
      this.ui.print(
        "connection",
        "killing port 3003 to ensure it's really good and dead...",
      );
      await killPort(3003);
      // need to ignore the error if there is no process running on port 3001
    } catch (e) {}

    this.signals.connection = new AbortController();
    this.connection = spawn(
      "cargo",
      this.cli.options.connection
        ? ["watch", "-x", "run -p quadratic-connection --target-dir=target"]
        : ["run", "-p", "quadratic-connection", "--target-dir=target"],
      {
        signal: this.signals.connection.signal,
        cwd: "quadratic-connection",
        env: { ...process.env, RUST_LOG: "info" },
      },
    );
    this.ui.printOutput("connection", (data) => {
      this.handleResponse("connection", data, {
        success: "listening on",
        error: ["error[", "npm ERR!"],
        start: "    Compiling",
      });
    });
  }

  async restartConnection() {
    this.cli.options.connection = !this.cli.options.connection;
    if (this.connection) {
      this.runConnection();
    }
  }

  async killConnection() {
    if (this.status.connection === "killed") {
      this.status.connection = false;
      this.ui.print("connection", "restarting...");
      this.runConnection();
    } else {
      if (this.connection) {
        await this.kill("connection");
        this.ui.print("connection", "killed", "red");
      }
      this.status.connection = "killed";
    }
  }

  async runPython() {
    if (this.quitting) return;
    this.status.python = false;
    await this.kill("python");
    this.ui.print("python");
    this.signals.python = new AbortController();
    this.python = spawn(
      "npm",
      ["run", this.cli.options.python ? "watch:python" : "build:python"],
      { signal: this.signals.python.signal },
    );
    this.ui.printOutput("python", (data) =>
      this.handleResponse("python", data, {
        success: "Python complete",
        error: "Python error!",
        start: "quadratic-kernels/python-wasm/",
      }),
    );
  }

  async restartPython() {
    this.cli.options.python = !this.cli.options.python;
    this.runPython();
  }

  async runDb() {
    if (this.quitting) return;
    this.ui.print("db", "checking migration...");
    this.status.db = false;
    await this.kill("db");
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
    if (this.quitting) return;
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
    if (this.quitting) return;
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
      this.runCore();
    });
  }

  isRedisRunning(): Promise<boolean | "not found"> {
    return new Promise((resolve) => {
      if (this.quitting) resolve(false);
      const dockerDev = this.cli.options.dockerDev;
      if (dockerDev) {
        resolve(true);
      }
      const servicesLocal = this.cli.options.servicesLocal;
      const redis = servicesLocal
        ? spawn("redis-cli", ["ping"])
        : spawn("docker", ["exec", "redis", "redis-cli", "ping"]);
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
      if (this.quitting) resolve(false);
      const dockerDev = this.cli.options.dockerDev;
      if (dockerDev) {
        resolve(true);
      }
      const servicesLocal = this.cli.options.servicesLocal;
      const postgres = servicesLocal
        ? spawn("pg_isready")
        : spawn("docker", ["exec", "postgres", "pg_isready"]);
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
    exec("rm -rf quadratic-client/src/app/quadratic-core");
    this.ui = ui;
    this.checkServices();
    this.runRust();
    this.runPython();
    this.runShared();
  }
}
