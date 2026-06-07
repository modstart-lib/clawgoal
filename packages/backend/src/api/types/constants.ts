/**
 * API response status codes
 */
export class ResponseCodes {
  static readonly SUCCESS = 0
  static readonly API_TOKEN_EMPTY = 1000
  static readonly LOGIN_REQUIRED = 1001
  static readonly CAPTCHA_ERROR = 1002
  static readonly PERMIT_DENIED = 1003
  static readonly DEFAULT_ERROR = -1

  static readonly AGENT_TASK_NOT_FOUND = 7001
  static readonly AGENT_TASK_ALREADY_RUNNING = 7002
  static readonly AGENT_MAX_CONCURRENT_REACHED = 7003
  static readonly AGENT_CHECKPOINT_LOAD_FAILED = 7004
}

/**
 * Response message mapping
 */
export const ResponseMessages: Record<number, string> = {
  [ResponseCodes.SUCCESS]: 'ok',
  [ResponseCodes.API_TOKEN_EMPTY]: 'Authentication token not provided',
  [ResponseCodes.LOGIN_REQUIRED]: 'Login required',
  [ResponseCodes.CAPTCHA_ERROR]: 'Captcha error',
  [ResponseCodes.PERMIT_DENIED]: 'Insufficient permissions',
  [ResponseCodes.DEFAULT_ERROR]: 'Request failed',
  [ResponseCodes.AGENT_TASK_NOT_FOUND]: 'Agent task not found',
  [ResponseCodes.AGENT_TASK_ALREADY_RUNNING]: 'Agent task is already running',
  [ResponseCodes.AGENT_MAX_CONCURRENT_REACHED]: 'Maximum concurrency reached',
  [ResponseCodes.AGENT_CHECKPOINT_LOAD_FAILED]: 'Checkpoint load failed',
}
