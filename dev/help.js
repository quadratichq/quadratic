export const help = "(press h for help | q to quit)";
export const helpCLI = "\n\nOptions:" +
    "\n     Usage: node dev [options]" +
    "\n     Runs the Quadratic dev server. By default, only React runs in watch mode." +
    "\n" +
    "\n     -a, --api           Watch the quadratic-api directory" +
    "\n     -c, --core          Watch the quadratic-core directory" +
    "\n     -m, --multiplayer   Watch the quadratic-multiplayer directory" +
    "\n     -f, --files         Watch the quadratic-files directory" +
    "\n     -s, --skipTypes     Skip WASM types compilation" +
    "\n     -l, --all           Watch all directories" +
    "\n     -p, --perf          Run quadratic-core in perf mode (slower linking but faster runtime)" +
    "\n     -R, --noReact       Hide React output" +
    "\n     -A, --noApi         Hide API output" +
    "\n     -P, --noMultiplayer Hide Multiplayer output" +
    "\n     -F, --noFiles       Hide Files output" +
    "\n     -C, --noCore        Hide Core output" +
    "\n     -h, --help          Display help for command" +
    "\n     \n(press h to hide help. press q to quit)";
export const helpKeyboard = "\n\nPress:" +
    "\n       a c m f - Toggle watch for component" +
    "\n     R A C M F - Toggle showing logs for component" +
    "\n             p - Toggle performance build for Core" +
    "\n             t - Rebuild WASM types from Core for React" +
    "\n             H - Show CLI options" +
    "\n     \n(press h to hide help. press q to quit)";
