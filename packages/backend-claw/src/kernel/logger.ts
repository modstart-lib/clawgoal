import { createNamedLogger } from '../../../backend/src/utils/logger'

export const logger = createNamedLogger('claw')

export function createLogger(scope: string) {
  return logger.child({ scope })
}
