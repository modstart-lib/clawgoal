/**
 * Standard API response format
 */
export interface ApiResponse<T = any> {
  code: number
  msg: string
  data?: T
}

/**
 * Response code constants
 */
export const ResponseCodes = {
  SUCCESS: 0,
  API_TOKEN_EMPTY: 1000,
  LOGIN_REQUIRED: 1001,
  CAPTCHA_ERROR: 1002,
  PERMIT_DENIED: 1003,
  DEFAULT_ERROR: -1,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
} as const
