import killPortOriginal from "kill-port";
import { exec, spawn, } from "node:child_process";
import { destroyScreen } from "./terminal.js";
const killPort = async (port) => {
    try {
        await killPortOriginal(port);
    }
    catch (e) { }
};
export class Control {
    cli;
    ui;
    api;
    types;
    core;
    client;
    multiplayer;
    files;
    db;
    npm;
    rust;
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
    constructor(cli) {
        this.cli = cli;
    }
    quit() {
        if (this.api)
            this.api.kill("SIGKILL");
        if (this.files)
            this.files.kill("SIGTERM");
        if (this.multiplayer)
            this.multiplayer.kill("SIGTERM");
        if (this.client)
            this.client.kill("SIGTERM");
        destroyScreen();
        process.exit(0);
    }
    handleResponse(name, data, options, successCallback) {
        const response = data.toString();
        if (Array.isArray(options.success)
            ? options.success.some((s) => response.includes(s))
            : response.includes(options.success)) {
            this.status[name] = true;
            if (successCallback) {
                successCallback();
            }
        }
        else if (Array.isArray(options.error)
            ? options.error.some((s) => response.includes(s))
            : response.includes(options.error)) {
            this.status[name] = "x";
        }
        else if (Array.isArray(options.start)
            ? options.start.some((s) => response.includes(s))
            : response.includes(options.start)) {
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
        this.ui.printOutput("api", (data) => this.handleResponse("api", data, {
            success: "Server running on port",
            error: "npm ERR!",
            start: "> quadratic-api",
        }));
    }
    restartApi() {
        if (this.api) {
            this.api.kill("SIGKILL");
        }
        this.cli.options.api = !this.cli.options.api;
        this.runApi();
    }
    async runTypes(restart) {
        this.ui.print("types");
        if (this.cli.options.skipTypes && !restart) {
            this.runCore();
        }
        else {
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
        clean.on("close", (code) => {
            this.client = spawn("npm", ["start", "--workspace=quadratic-client"]);
            this.ui.printOutput("client", (data) => this.handleResponse("client", data, {
                success: "Found 0 errors.",
                error: ["ERROR(", "npm ERR!"],
                start: "> quadratic-client@",
            }));
        });
    }
    togglePerf() {
        this.cli.options.perf = !this.cli.options.perf;
        this.restartCore();
    }
    runCore(restart) {
        this.ui.print("core");
        if (this.cli.options.core) {
            this.core = spawn("npm", [
                "run",
                this.cli.options.perf
                    ? "watch:wasm:perf:javascript"
                    : "watch:wasm:javascript",
            ]);
            this.ui.printOutput("core", (data) => this.handleResponse("core", data, {
                success: "[Finished running. Exit status: 0",
                error: "error[",
                start: ["> quadratic", "[Running "],
            }, () => {
                if (!restart) {
                    this.runNpmInstall();
                    this.runMultiplayer();
                }
            }));
        }
        else {
            this.core = spawn("npm", [
                "run",
                this.cli.options.perf
                    ? "build:wasm:perf:javascript"
                    : "build:wasm:javascript",
            ]);
            this.ui.printOutput("core", (data) => this.handleResponse("core", data, {
                success: "Your wasm pkg is ready to publish",
                error: "error[",
                start: "[Running ",
            }));
            this.core.on("exit", () => {
                if (!restart) {
                    this.runNpmInstall();
                    this.runMultiplayer();
                }
            });
        }
    }
    restartCore() {
        if (this.core) {
            this.core.kill("SIGKILL");
        }
        this.cli.options.core = !this.cli.options.core;
        this.runCore();
    }
    async runMultiplayer(restart) {
        this.ui.print("multiplayer");
        await killPort(3001);
        this.multiplayer = spawn("npm", [
            "run",
            this.cli.options.multiplayer ? "dev" : "start",
            "--workspace=quadratic-multiplayer",
        ]);
        this.ui.printOutput("multiplayer", (data) => this.handleResponse("multiplayer", data, {
            success: "listening on",
            error: "error[",
            start: "    Compiling",
        }, () => {
            if (!restart) {
                this.runFiles();
            }
        }));
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
                this.status.db = true;
            }
            else {
                this.ui.print("db", "failed");
                this.status.db = "x";
            }
            this.runApi();
        });
    }
    runNpmInstall() {
        this.ui.print("npm", "installing...");
        this.npm = spawn("npm", ["install"]);
        this.npm.on("close", (code) => {
            if (code === 0) {
                this.ui.print("npm", "completed");
                this.status.npm = true;
            }
            else {
                this.ui.print("npm", "failed");
                this.status.npm = "x";
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
            }
            else {
                this.ui.print("rust", "failed");
                this.status.rust = "x";
            }
            this.runTypes();
        });
    }
    async start(ui) {
        this.ui = ui;
        this.runRust();
        this.runDb();
    }
}
