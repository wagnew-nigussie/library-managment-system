export function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}

export function errorHandler(error, req, res, next) {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(error.status || 500).json({
    success: false,
    message: error.status ? error.message : "Internal server error"
  });
}
