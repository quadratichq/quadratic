function processOutput(value) {
  if (value === null || value === undefined) {
    return {
      outputType: value === null ? "null" : "undefined",
      hasHeaders: false,
      outputValue: null,
      outputArray: null,
    };
  }

  // handle arrays (including nested arrays)
  if (Array.isArray(value)) {
    const hasHeaders =
      value.length > 0 &&
      Array.isArray(value[0]) &&
      value[0].some((cell) => typeof cell === "string");

    return {
      outputType: "Array",
      hasHeaders: hasHeaders,
      outputValue: null,
      outputArray: value.map((row) =>
        Array.isArray(row)
          ? row.map((cell) => [
              cell instanceof Date ? cell.toISOString() : String(cell),
              getJsType(cell),
            ])
          : [[
              row instanceof Date ? row.toISOString() : String(row),
              getJsType(row),
            ]],
      ),
    };
  }

  // handle single values
  return {
    outputType: typeof value,
    hasHeaders: false,
    outputValue: [
      value instanceof Date ? value.toISOString() : String(value),
      getJsType(value),
    ],
    outputArray: null,
  };
}

function getJsType(value) {
  if (value === null) return 0; // blank
  if (typeof value === "string") return 1; // text
  if (typeof value === "number") return 2; // number
  if (typeof value === "boolean") return 3; // boolean
  if (value instanceof Date) return 11; // datetime
  return 1; // Default to text
}

// AST-based analysis to determine if code ends with an expression
function analyzeCode(code) {
  try {
    // parse the code to get AST
    const ast = new Function("return (" + code + ")")();
    return { hasExpression: true, setupCode: "", exprCode: code };
  } catch (e1) {
    try {
      // if parsing as expression fails, try parsing as statements
      // wrap in async function to handle top-level await
      // don't actually execute, just check if it parses
      new Function("return (async () => { " + code + " })");

      // try to determine if last statement is an expression
      const lines = code.trim().split("\n");
      const lastLine = lines[lines.length - 1].trim();

      // simple heuristics for common expression patterns
      // remove semicolon for analysis
      const lineForAnalysis = lastLine.endsWith(";")
        ? lastLine.slice(0, -1)
        : lastLine;

      const isExpression =
        lastLine &&
        !lastLine.startsWith("//") &&
        !lastLine.startsWith("if") &&
        !lastLine.startsWith("for") &&
        !lastLine.startsWith("while") &&
        !lastLine.startsWith("function") &&
        !lastLine.startsWith("class") &&
        !lastLine.startsWith("const") &&
        !lastLine.startsWith("let") &&
        !lastLine.startsWith("var") &&
        !lineForAnalysis.includes("=") &&
        lastLine.length > 0;

      // special handling for return statements - treat as expressions
      const isReturnStatement = lastLine.startsWith("return ");

      if (isExpression || isReturnStatement) {
        const setupCode = lines.slice(0, -1).join("\n");
        let exprCode = lastLine;

        // for return statements, extract the expression part
        if (isReturnStatement) {
          exprCode = lastLine.substring(7).replace(/;$/, ""); // remove "return " prefix and trailing semicolon
        }

        return {
          hasExpression: true,
          setupCode: setupCode,
          exprCode: exprCode,
        };
      } else {
        return {
          hasExpression: false,
          setupCode: code,
          exprCode: null,
        };
      }
    } catch (e2) {
      // if both fail, treat as statements only, but still check for return statements
      // this handles cases where import statements prevent parsing but we still want
      // to detect return statements
      const lines = code.trim().split("\n");
      const lastLine = lines[lines.length - 1].trim();

      if (lastLine.startsWith("return ")) {
        const setupCode = lines.slice(0, -1).join("\n");
        const exprCode = lastLine.substring(7).replace(/;$/, ""); // remove "return " prefix and trailing semicolon
        return {
          hasExpression: true,
          setupCode: setupCode,
          exprCode: exprCode,
        };
      }

      return {
        hasExpression: false,
        setupCode: code,
        exprCode: null,
      };
    }
  }
}

globalThis.processOutput = processOutput;
globalThis.analyzeCode = analyzeCode;
