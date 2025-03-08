// use function_timer::function_timer;
use std::thread::sleep;
use std::time::Duration;

#[allow(unused_macros)]
macro_rules! dbgjs {
    ($($arg:tt)*) => {
        println!("{}", $($arg)*);
    };
}

// #[function_timer]
// fn test_function_timer() {
//     for _ in 0..2 {
//         sleep(Duration::from_millis(10));
//     }
// }

// fn main() {
//     test_function_timer();
// }
