/**
 * Static registry for built-in agent role workflow modules.
 *
 * Using static imports here allows tsup/bun to include these modules in the
 * compiled binary at build time, so no filesystem access is needed at runtime.
 *
 * When adding a new built-in role with a workflow module:
 *   1. Create src/agent/roles/<roleName>/workflow.ts
 *   2. Add an entry to BUILTIN_WORKFLOW_REGISTRY below
 */

// Lazy imports to avoid loading all modules upfront — each is loaded on first use
const BUILTIN_WORKFLOW_REGISTRY: Record<
  string,
  () => Promise<Record<string, (...args: any[]) => any>>
> = {
  programer: () => import('./programer/workflow.js'),
}

/**
 * Get a built-in workflow module by role name.
 * Returns the module's exported functions, or null if not registered.
 */
export async function getBuiltinWorkflow(
  roleName: string
): Promise<Record<string, (...args: any[]) => any> | null> {
  const loader = BUILTIN_WORKFLOW_REGISTRY[roleName]
  if (!loader) return null
  try {
    return await loader()
  } catch {
    return null
  }
}
