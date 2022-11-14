import init, { QuadraticCore } from './pkg/quadratic_core.js';
const filePath = "./data/1-partition-brotli.parquet";
//const large_parquet_file_path = "./data/yellow_tripdata_2022-01.parquet";

async function run() {
    await init();

    let qCore = QuadraticCore.new();
    fetch(filePath).then(response => {
        response.arrayBuffer().then(buf => {
            const arr = new Uint8Array(buf);
            console.log("------------Parquet MetaData------------");
            console.log(QuadraticCore.read_parquet_meta_data(arr))
            console.log("------------Loading Parquet and storing it in qCore as chunks ------------");
            qCore.load_parquet(arr);
            qCore.generate_string_matrices();
            console.log("------------Generating and printing string matrices from chunks ------------");
            qCore.print_matrices();
            console.log("------------Copying String rects to javascript------------");
            let string_rects = qCore.copy_string_rects_to_javascript();
            console.log("------------Printing Javascript matrices object------------");
            console.log(string_rects);
        })
    })
}


run();