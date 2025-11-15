export const help = "(press h for help | q to quit)";
export const helpCLI = "\n\nOptions:" +
    "\n     Usage: node dev [options]" +
    "\n     Runs the Quadratic dev server. By default, only React runs in watch mode." +
    "\n" +
    "\n     -a, --api             Watch the quadratic-api directory" +
    "\n     -c, --core            Watch the quadratic-core directory" +
    "\n     -m, --multiplayer     Watch the quadratic-multiplayer directory" +
    "\n     -f, --files           Watch the quadratic-files directory" +
    "\n     -n, --connection      Watch the quadratic-connection directory" +
    "\n     -y, --python          Watch the quadratic-kernel/python-wasm directory" +
    "\n     -s, --shared          Watch the quadratic-shared directory" +
    "\n     -o, --cloudController Watch the quadratic-cloud-controller directory" +
    "\n     -t, --skipTypes       Skip WASM types compilation" +
    "\n     -l, --all             Watch all directories" +
    "\n     -p, --perf            Run quadratic-core in perf mode (slower linking but faster runtime)" +
    "\n     -R, --hideReact       Hide React output" +
    "\n     -A, --hideApi         Hide API output" +
    "\n     -C, --hideCore        Hide Core output" +
    "\n     -P, --hideMultiplayer Hide Multiplayer output" +
    "\n     -F, --hideFiles       Hide Files output" +
    "\n     -N, --hideConnection  Hide Connection output" +
    "\n     -Y, --hidePython      Hide Python output" +
    "\n     -S, --hideShared      Hide Shared output" +
    "\n     -O, --hideCloudController Hide CloudController output" +
    "\n     -T, --hideTypes       Hide Types output" +
    "\n     -L, --servicesLocal   Set Redis & Postgres as running locally" +
    "\n     -d, --dark            Use dark theme" +
    "\n     -h, --help            Display help for command" +
    "\n     \n(press h to hide help. press q to quit)";
export const helpKeyboard = "\n\nPress:" +
    "\n   a c s e m f o y - Toggle watch for component" +
    "\n A C   E M F O Y H - Toggle showing logs for component" +
    "\n                 p - Toggle performance build for Core" +
    "\n                 r - Restart React" +
    "\n                 t - Rebuild WASM types from Core for React" +
    "\n                 l - Watch all" +
    "\n            ctrl+m - Kill/Resurrect multiplayer" +
    "\n            ctrl+f - Kill/Resurrect files" +
    "\n                 d - Toggle dark theme" +
    "\n                 L - Toggle Redis & Postgres as running locally" +
    "\n                 H - Show CLI options" +
    "\n       \n(press h to hide help. press q to quit)";
