/**
 * API Interceptor Utility
 * Automatically adds company_id to all API requests from localStorage
 */

/**
 * Get company ID from localStorage
 * Returns the company_id stored during login
 */
export function getCompanyId(): number | null {
  if (typeof window === 'undefined') return null
  const companyId = localStorage.getItem('company_id')
  return companyId ? parseInt(companyId, 10) : null
}

/**
 * Add company_id to request params
 * Mutates the config object to add company_id query parameter
 */
export function addCompanyIdToParams(config: any): any {
  const companyId = getCompanyId()

  if (companyId) {
    // Initialize params if not present
    if (!config.params) {
      config.params = {}
    }
    // Add company_id to params
    config.params.company_id = companyId
  }

  return config
}

/**
 * Add company_id to request body (POST/PATCH/PUT)
 * Mutates the data object to include company_id
 */
export function addCompanyIdToBody(data: any): any {
  const companyId = getCompanyId()

  if (companyId && data && typeof data === 'object') {
    // Only add if not FormData (for file uploads)
    if (!(data instanceof FormData)) {
      return {
        ...data,
        company_id: companyId,
      }
    }
    // For FormData, append the company_id
    if (data instanceof FormData) {
      data.append('company_id', companyId.toString())
    }
  }

  return data
}

/**
 * Create a request interceptor that adds company_id
 * Use this in your axios interceptors
 */
export function createCompanyIdInterceptor(isBodyRequest: boolean = false) {
  return (config: any) => {
    if (typeof window === 'undefined') return config

    if (isBodyRequest) {
      // For POST, PATCH, PUT requests - add to body
      config.data = addCompanyIdToBody(config.data)
    } else {
      // For GET requests - add to params
      config = addCompanyIdToParams(config)
    }

    return config
  }
}

/**
 * Helper to safely get company_id with fallback
 * Returns company_id or a default value
 */
export function getCompanyIdOrDefault(defaultValue: number = 0): number {
  return getCompanyId() ?? defaultValue
}

/**
 * Check if user is logged in and has company_id
 */
export function hasCompanyId(): boolean {
  return getCompanyId() !== null
}
