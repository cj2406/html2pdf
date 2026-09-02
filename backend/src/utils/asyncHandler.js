/**
 * Express 4 does not catch rejected promises from async route handlers —
 * an unhandled rejection inside `async (req, res) => {...}` doesn't get
 * turned into a 500 response, it becomes a process-level unhandled
 * rejection. In modern Node that CRASHES THE ENTIRE SERVER, not just the
 * one request (see: Node's default --unhandled-rejections=throw behavior).
 *
 * Wrap every async route handler in this so a single bad request (e.g. a
 * database error) turns into a 500 response instead of taking the whole
 * process down with it.
 *
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
