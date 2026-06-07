function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.')
  let current = obj
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key]
    } else {
      return undefined
    }
  }
  return current
}

function resolveVariables(
  value: string | object,
  variables: Record<string, any>,
  _defaultValue: string = ''
): any {
  const replaceVariable = (v: string): string => {
    return v.replace(/\$\{([^}]+)\}/g, (_, varPath) => {
      const parts = varPath.split('.')
      if (parts.length === 1) {
        const varName = parts[0]
        if (variables[varName] !== undefined) {
          return typeof variables[varName] === 'object'
            ? JSON.stringify(variables[varName])
            : String(variables[varName])
        }
        return ''
      }
      const sourceNodeTitle = parts[0]
      const fieldPath = parts.slice(1).join('.')
      if (sourceNodeTitle && fieldPath && variables[sourceNodeTitle]) {
        const resolved = getNestedValue(variables[sourceNodeTitle], fieldPath)
        if (resolved !== undefined) {
          return typeof resolved === 'object'
            ? JSON.stringify(resolved)
            : String(resolved)
        }
      }
      return ''
    })
  }

  const toResultRaw = (input: string | object): any => {
    if (typeof input === 'string') {
      const match = input.match(/^@RAW\(([\s\S]*)\)$/)
      if (match) {
        try {
          return JSON.parse(match[1])
        } catch {
          return match[1]
        }
      }
      return input
    } else if (Array.isArray(input)) {
      return (input as any[]).map((item) => toResultRaw(item))
    } else if (input && typeof input === 'object') {
      const res: any = {}
      for (const k in input as object) {
        res[k] = toResultRaw((input as any)[k])
      }
      return res
    }
    return input
  }

  const replaceVariableAll = (input: any): any => {
    if (typeof input === 'string') return replaceVariable(input)
    else if (Array.isArray(input))
      return input.map((item) => replaceVariableAll(item))
    else if (input && typeof input === 'object') {
      const res: any = {}
      for (const k in input) {
        res[k] = replaceVariableAll(input[k])
      }
      return res
    }
    return input
  }

  return toResultRaw(replaceVariableAll(value))
}

export { getNestedValue, resolveVariables }
