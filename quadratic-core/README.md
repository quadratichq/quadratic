# Arrow2 DEMO

## Project Scope
- Create simple API for communicating between Javascript and Wasm
- Fetch Parquet file 
- Parse Parquet file into native arrow2 chunk format and store it in wasm QuadraticsCore object
- Generate a matrix of stringified values for each chunk in QuadraticsObject
- Send this back to the Javascript frontend.

## Remarks
- This is merely a demo. More input and work is needed to adopt it to a functional part of Quadratic
- The wasm object QuadraticCore holds both the "state", i.e. an array of chunks/recordBatches, and the list of string matrices
- Currently I copy the string matrix data from wasm to javascript. Obviously, copying large mounts of data from the wasm to javascript side is not optimal and will impact performance negatively. There is probably some way of letting javascript own the matrices object and only let the wasm side have a reference to it.
- Should add console_error_panic_hook to get better and more automated errors messages. Should make this a debug features so that it's not included in release
- Consider using a crate (e.g. ndarray) to better represent matrices; for now I'm just using ```Vec<Vec<String>>```
- This code should be tested against the large parquet file and investigate why it failed.