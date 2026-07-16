// Express 4 doesn't forward rejected promises from async route handlers to
// the error-handling middleware automatically. This wraps a handler so any
// thrown error or rejection is passed to next(err).
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
