import init, { QuadraticCore } from './pkg/quadratic_core.js';
const filePath = "./data/1-partition-brotli.parquet";
const large_parquet_file_path = "./data/yellow_tripdata_2022-01.parquet";

async function run() {
    await init();

    //let qcore = QuadraticCore.new();
    fetch(filePath).then(response => {

        response.arrayBuffer().then(buf => {
            const arr = new Uint8Array(buf);

            console.log("------------Parquet MetaData------------");
            console.log(QuadraticCore.read_parquet_meta_data(arr))

            let arrow_bytes = QuadraticCore.read_parquet(arr);
            console.log("------------Arrow bytes------------");
            console.log(arrow_bytes);

        })
    })

    // QuadraticCore.wasm_fetch_file().then(response => {
    //     console.log("QCore wasm fetching file:" + response);
    // })
}


run();