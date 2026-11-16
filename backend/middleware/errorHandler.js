function errorHandler(err, req, res, next){
    console.error("================= ERROR =================");
    console.error("Timestamp:", new Date().toISOString());
    console.error("Method:", req.method);
    console.error("URL:", req.originalUrl);
    console.error("Error Name:", err.name);
    console.error("Error Message:", err.message);
    console.error("Error Code:", err.code);
    console.error("Stack Trace:", err.stack);
    console.error("=========================================");

    const statusCode = Number.isInteger(err.statusCode) &&
    err.statusCode >= 400 &&
    err.statusCode <= 599 ? err.statusCode:500;

    // Don't expose internal error details in production
    const message = statusCode === 500
        ? "Internal Server Error. Please try again later."
        : err.message || "Request failed";

    res.status(statusCode).json({
        message: message,
        ...(process.env.NODE_ENV === 'development' && { error: err.message, stack: err.stack })
    });
}

module.exports = errorHandler;