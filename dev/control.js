import killPortOriginal from "kill-port";
import { spawn } from "node:child_process";
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
    status = {
        client: false,
        api: false,
        core: false,
        multiplayer: false,
        files: false,
        types: false,
        db: false,
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
        this.ui.run("api");
        await killPort(8000);
        this.api = spawn("npm", [
            "run",
            this.cli.options.api ? "start" : "start-no-watch",
            "--workspace=quadratic-api",
        ]);
        this.ui.printOutput(this.api, "API", "blue", (data) => this.handleResponse("api", data, {
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
    async runTypes() {
        this.ui.run("types");
        return new Promise((resolve) => {
            if (!this.cli.options.skipTypes) {
                this.types = spawn("npm", ["run", "build:wasm:types"]);
                this.ui.printOutput(this.types, "WASM Types", "magenta", (data) => {
                    this.handleResponse("types", data, {
                        success: "Running ",
                        error: "error:",
                        start: ["Compiling", "> quadratic"],
                    });
                });
                this.types.on("exit", resolve);
            }
            else {
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
        this.ui.run("client");
        if (this.client) {
            this.client.kill("SIGKILL");
        }
        this.client = spawn("npm", ["start", "--workspace=quadratic-client"]);
        this.ui.printOutput(this.client, "Client", "magenta", (data) => this.handleResponse("client", data, {
            success: "Found 0 errors.",
            error: ["ERROR(", "npm ERR!"],
            start: "> quadratic-client@",
        }));
    }
    togglePerf() {
        this.cli.options.perf = !this.cli.options.perf;
        this.restartCore();
    }
    runCore() {
        this.ui.run("core");
        return new Promise((resolve) => {
            if (this.cli.options.core) {
                this.core = spawn("npm", [
                    "run",
                    this.cli.options.perf
                        ? "watch:wasm:perf:javascript"
                        : "watch:wasm:javascript",
                ]);
                this.ui.printOutput(this.core, "Core", "cyan", (data) => this.handleResponse("core", data, {
                    success: "[Finished running. Exit status: 0",
                    error: "error[",
                    start: ["> quadratic", "[Running "],
                }, () => {
                    this.runClient();
                    resolve(undefined);
                }));
            }
            else {
                this.core = spawn("npm", [
                    "run",
                    this.cli.options.perf
                        ? "build:wasm:perf:javascript"
                        : "build:wasm:javascript",
                ]);
                this.ui.printOutput(this.core, "Core", "magenta", (data) => this.handleResponse("core", data, {
                    success: "Your wasm pkg is ready to publish",
                    error: "error[",
                    start: "[Running ",
                }));
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
        this.ui.run("multiplayer");
        return new Promise(async (resolve) => {
            await killPort(3001);
            this.multiplayer = spawn("npm", [
                "run",
                this.cli.options.multiplayer ? "dev" : "start",
                "--workspace=quadratic-multiplayer",
            ]);
            this.ui.printOutput(this.multiplayer, "Multiplayer", "green", (data) => this.handleResponse("multiplayer", data, {
                success: "listening on",
                error: "error[",
                start: "    Compiling",
            }, () => resolve(undefined)));
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
        this.ui.run("files");
        return new Promise(async (resolve) => {
            await killPort(3002);
            this.files = spawn("npm", [
                "run",
                this.cli.options.files ? "dev" : "start",
                "--workspace=quadratic-files",
            ]);
            this.ui.printOutput(this.files, "Files", "yellow", (data) => {
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
        this.ui.run("db");
        if (this.db) {
            this.db.kill("SIGTERM");
        }
        this.db = spawn("npm", [
            "run",
            "prisma:migrate",
            "--workspace=quadratic-api",
        ]);
        this.ui.printOutput(this.db, "DB", "blue", (data) => {
            this.handleResponse("db", data, {
                success: ["Already in sync"],
                error: "error[",
                start: "Prisma Migrate",
            }, undefined),
                undefined,
                true;
        });
    }
    async start(ui) {
        this.ui = ui;
        this.runApi();
        this.runDb();
        // await this.runTypes();
        // await this.runCore();
        // await this.runMultiplayer();
        // await this.runFiles();
    }
}
