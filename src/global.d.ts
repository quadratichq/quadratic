declare module '*.py' {
  const content: string;
  export default content;
}

declare module '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm' {
  const value: string;
  export default value;
}

declare module '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm' {
  const value: string;
  export default value;
}
