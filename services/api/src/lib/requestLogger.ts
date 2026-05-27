import type { Request, Response, NextFunction } from "express";

/**
 * One structured line per request once the response finishes
 * (method, path, status, duration). Off under test, or with LOG_REQUESTS=false.
 */
export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.VITEST || process.env.LOG_REQUESTS === "false") return next();
    const start = Date.now();
    res.on("finish", () => {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  };
}
