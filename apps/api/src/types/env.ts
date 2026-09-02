import type { AuthVariables } from '../middleware/auth'

export type ApiEnv = {
  Variables: AuthVariables
  Bindings: Record<string, never>
}
