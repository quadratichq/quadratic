# run a single bench
# usage: ./benches.sh run <bench_name>
#
# watch a single bench
# usage: ./benches.sh watch <bench_name>
#
# watch src files for changes and run the bench
# usage: ./benches.sh src <bench_name>

if [ "$1" = "run" ]; then
    cargo bench --bench $2 --features function-timer -- --nocapture
fi

if [ "$1" = "watch" ]; then
    cargo watch -c -w benches -x "bench --bench $2 --features function-timer -- --nocapture"
fi

if [ "$1" = "src" ]; then
    cargo watch -c -w src -x "bench --bench $2 --features function-timer -- --nocapture"
fi
