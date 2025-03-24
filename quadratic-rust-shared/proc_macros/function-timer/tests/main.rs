use function_timer::function_timer;
use std::sync::{LazyLock, Mutex};
use std::thread::sleep;
use std::time::Duration;

static FUNCTIONS: LazyLock<Mutex<Vec<(String, i64)>>> = LazyLock::new(|| Mutex::new(vec![]));

#[allow(unused_macros)]
macro_rules! dbgjs {
    ($($arg:tt)*) => {
        println!("{}", $($arg)*);
    };
}

#[function_timer(dbgjs)]
fn test_function_timer() {
    for _ in 0..2 {
        sleep(Duration::from_millis(10));
    }

    // println!("{:?}", CELL.get().unwrap());
}

fn main() {
    test_function_timer();
}
