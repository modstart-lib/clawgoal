/**
 * Async route handler wrapper
 * Automatically catches errors in async functions and passes them to Express error handling middleware
 */
import { NextFunction, Request, Response } from 'express'

type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>

export const apiHandler = (fn: AsyncRouteHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
