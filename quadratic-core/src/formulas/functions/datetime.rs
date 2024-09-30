use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Date & time functions",
    docs: "Other spreadsheet software treats dates, times, and durations \
           as pure numbers, which can cause mistakes and can't represent \
           operations like \"plus one month\". Instead, Quadratic \
           has separate types of data for each of the following:

           - **Date**, such as `April 8, 2024`
           - **Time**, such as `2:30 PM`
           - **Date time**, such as `April 8, 2024 2:30 PM`
           - **Duration**, such as `6 months 15 days 1h30m12s`

           Dates, times, and date times can be entered into a cell using \
           the formats above, or other formats (such as `YYYY-MM-DD`). \
           Durations can be entered using long form (such as \
           `1 hour, 30 minutes, 12 seconds`) or short form (such as \
           `1h30m12s`). Durations support the following units:

           - **Years**, written `y`, `yr`, `year`, `yrs`, or `years`
           - **Months**, written `mo`, `mon`, `month`, or `months`
           - **Weeks**, written `w`, `week`, or `weeks`
           - **Days**, written `d`, `day`, or `days`
           - **Hours**, written `h`, `hr`, `hour`, `hrs`, or `hours`
           - **Minutes**, written `m`, `min`, `minute`, `mins`, or `minutes`
           - **Seconds**, written `s`, `sec`, `second`, `secs`, or `seconds`
           - **Milliseconds**, written `ms`, `millisec`, `millisecond`, or `milliseconds`
           - **Microseconds**, written `us`, `µs`, `microsec`, `microsecond`, or `microseconds`
           - **Nanoseconds**, written `ns`, `nanosec`, `nanosecond`, or `nanoseconds`
           - **Picoseconds**, written `ps`, `picosec`, `picosecond`, or `picoseconds`
           - **Femtoseconds**, written `fs`, `femtosec`, `femtosecond`, or `femtoseconds`
           - **Attoseconds**, written `as`, `attosec`, `attosecond`, or `attoseconds`

           Quadratic automatically converts between years and months \
           (with 1 year = 12 months) and between any units less than one \
           month, but does not convert months into days because months \
           vary in length.
    ",
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![]
}

#[cfg(test)]
#[cfg_attr(test, serial_test::parallel)]
mod tests {
    use crate::formulas::tests::*;
}
