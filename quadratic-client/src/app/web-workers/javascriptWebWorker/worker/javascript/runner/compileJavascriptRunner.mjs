// This file is run using node ./compileJavascriptRunner.mjs. It runs the
// javascriptConsole.ts and javascriptLibrary.ts files through esbuild to
// generate a single javascriptLibrary.js file that contains the minified and
// combined contents of the two files. This is used to generate the
// javascriptLibrary.js file that is used in the runner.

import esbuild from 'esbuild';
import fs from 'fs/promises';

const javascriptLibrary = './javascriptLibrary.ts';
const javascriptConsole = './javascriptConsole.ts';

async function main() {
  const libraryContent = await fs.readFile(javascriptLibrary, 'utf-8');
  const consoleContent = await fs.readFile(javascriptConsole, 'utf-8');
  const buildResults = await esbuild.build({
    stdin: {
      contents: libraryContent + consoleContent,
      loader: 'ts',
    },
    format: 'esm',
    target: 'es2022',
    sourcemap: false,
    write: false,
    minifySyntax: true,
    minifyWhitespace: true,
  });
  await fs.writeFile(
    './generateJavascriptForRunner.ts',
    '// Generated file from ./compileJavascriptRunner.mjs\nexport const javascriptLibrary = `' +
      buildResults.outputFiles[0].text +
      '`;\nexport const javascriptLibraryLines = javascriptLibrary.split("\\n").length;'
  );
  await fs.writeFile(
    './generatedJavascriptForEditor.ts',
    '// Generated file from ./compileJavascriptRunner.mjs\nexport const javascriptLibraryForEditor = `' +
      libraryContent +
      '`;\n'
  );
}

main();
