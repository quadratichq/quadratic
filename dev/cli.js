import { Command } from "commander";
export class CLI {
    options;
    constructor() {
        const program = new Command();
        program
            .name("node dev")
            .description("Runs the Quadratic dev server. By default, only React runs in watch mode.")
            .option("-a, --api", "Watch the quadratic-api directory")
            .option("-r, --react", "Do NOT watch quadratic-client (React)")
            .option("-c, --core", "Watch the quadratic-core directory")
            .option("-m, --multiplayer", "Watch the quadratic-multiplayer directory")
            .option("-f, --files", "Watch the quadratic-files directory")
            .option("-n, --connection", "Watch the quadratic-connection directory")
            .option("-s, --shared", "Watch the quadratic-shared directory")
            .option("-w, --cloudcontroller", "Watch the quadratic-cloud-controller directory")
            .option("-y, --python", "Watch the quadratic-kernels/python-wasm directory")
            .option("-l, --all", "Watch all directories")
            .option("-t, --skipTypes", "Skip WASM types compilation")
            .option("-p, --perf", "Run quadratic-core in perf mode (slower to link but faster runtime)")
            .option("-ft, --function-timer", "Run quadratic-core with function timer (log metrics to console)")
            .option("-R, --hideReact", "Hide React output")
            .option("-A, --hideAPI", "Hide React output")
            .option("-C, --hideCore", "Hide React output")
            .option("-T, --hideTypes", "Hide Types output")
            .option("-M, --hideMultiplayer", "Hide Multiplayer output")
            .option("-F, --hideFiles", "Hide Files output")
            .option("-N, --hideConnection", "Hide Connection output")
            .option("-Y, --hidePython", "Hide Python output")
            .option("-E, --hideRustClient", "Hide RustClient")
            .option("-S, --hideShared", "Hide Shared output")
            .option("-O, --hideCloudcontroller", "Hide CloudController output")
            .option("-L, --servicesLocal", "Set Redis & Postgres as running locally")
            .option("-d, --dark", "Use dark theme")
            .showHelpAfterError();
        program.parse();
        this.options = program.opts();
        this.options.client = !program.opts().react;
        if (this.options.all) {
            this.options.api = true;
            this.options.core = true;
            this.options.multiplayer = true;
            this.options.files = true;
            this.options.connection = true;
            this.options.python = true;
            this.options.shared = true;
            this.options.cloudcontroller = true;
        }
    }
}
