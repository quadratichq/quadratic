// check if setTimeout is available in deno_core
if (typeof setTimeout === "undefined") {
  console.log(
    "setTimeout not available, creating microtask-based implementation...",
  );

  // proper setTimeout implementation using microtasks and Date.now()
  globalThis.setTimeout = function (callback, delay = 0) {
    const start = Date.now();
    let timeoutId = Math.floor(Math.random() * 1000000);

    function checkTime() {
      if (Date.now() - start >= delay) {
        try {
          if (typeof callback === "function") {
            callback();
          } else if (typeof callback === "string") {
            eval(callback);
          }
        } catch (e) {
          console.error("setTimeout callback error:", e);
        }
      } else {
        queueMicrotask(checkTime);
      }
    }

    queueMicrotask(checkTime);
    return timeoutId;
  };

  globalThis.clearTimeout = function (id) {
    // basic clearTimeout - in a full implementation this would cancel the timer
    console.log("clearTimeout called with id:", id);
  };
} else {
  console.log("setTimeout is available in deno_core!");
}
