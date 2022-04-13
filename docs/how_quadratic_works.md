# How Does Quadratic Work?
## The Grid
The Quadratic Grid is built on WebGL using [PixiJS](https://pixijs.io/). This allows us to render a high-performance grid with all your data, where you can quickly pan and zoom.
By basically using a game engine to render the grid, this gives us a high level of control over what is drawn to the grid and our render pipeline.

We believe that for a tool to become joyful to use, it has to run very smoothly. We prioritize keeping a high frame rate and eliminating visual artifacts when panning and zooming the grid.

## Python Code Execution
Python code is executed via [Pyodide](https://pyodide.org/en/stable/) a WebAssembly compiled version of CPython. 
All cell code is executed on the front end in the client's browser. This creates some Python compatibility issues because system functions do not work, and network requests are made from the front end in the browser.

# Future Architecture
Note: this is not the current Architecture. This diagram is where we envision the product architecture going.
<img width="2224" alt="Quadratic Client Architecture 2" src="https://user-images.githubusercontent.com/3479421/163222487-c979082b-6854-4e81-a807-907d7e5fa8be.png">

We envision a spreadsheet application where you can seamlessly bring in millions of rows of data, and run formulas, scripts, and SQL on your data all in one visual environment.

To achieve this, we envision the grid being a [Vector Tilemap](https://docs.mapbox.com/data/tilesets/guides/vector-tiles-introduction/) (think Google Maps) this way we can have lots of data in a file, allow the user to navigate with pan and zoom quickly, but not require all data to be loaded at all times.

A blog post series by the CTO of Figma [Evan Wallnce](https://twitter.com/evanwallace?lang=en) has convinced us this is possible using a combination of WebAssembly (Rust!), WebWorkers, and WebGL.
- https://www.figma.com/blog/webassembly-cut-figmas-load-time-by-3x/
- https://www.figma.com/blog/building-a-professional-design-tool-on-the-web/
