import { Response } from 'express'
import { ResponseCodes, ResponseMessages } from '../api/types/constants.js'

/**
 * Standard API response format
 */
export interface ApiResponse<T = any> {
  code: number
  msg: string
  data?: T
}

/**
 * Success response
 */
export const success = <T = any>(
  res: Response,
  data?: T,
  msg?: string
): void => {
  const response: ApiResponse<T> = {
    code: ResponseCodes.SUCCESS,
    msg: msg || ResponseMessages[ResponseCodes.SUCCESS],
    data,
  }
  res.status(200).json(response)
}

/**
 * Error response
 */
export const error = (
  res: Response,
  code: number,
  msg?: string,
  data?: any
): void => {
  const response: ApiResponse = {
    code,
    msg:
      msg ||
      ResponseMessages[code] ||
      ResponseMessages[ResponseCodes.DEFAULT_ERROR],
    data,
  }
  res.status(200).json(response)
}

/**
 * Not authenticated response
 */
export const loginRequired = (res: Response, msg?: string): void => {
  error(res, ResponseCodes.LOGIN_REQUIRED, msg)
}

/**
 * Insufficient permissions response
 */
export const permitDenied = (res: Response, msg?: string): void => {
  error(res, ResponseCodes.PERMIT_DENIED, msg)
}

/**
 * Empty token response
 */
export const tokenEmpty = (res: Response, msg?: string): void => {
  error(res, ResponseCodes.API_TOKEN_EMPTY, msg)
}
