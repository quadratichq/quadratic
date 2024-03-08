export const getCursorPos = async () => {
    return new Promise((resolve) => {
        process.stdin.once("data", (data) => {
            const values = data
                .toString()
                .substring("\u001b[".length)
                .split(";")
                .map((n) => parseInt(n));
            resolve({ x: values[1], y: values[0] });
        });
        process.stdout.write("\x1b[6n");
    });
};
