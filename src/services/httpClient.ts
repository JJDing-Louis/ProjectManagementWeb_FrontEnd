import { ApiError } from '@/types/models'

const apiBase = `${(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')}/api/v1`
const timeoutMilliseconds = 15_000
let accessToken: string | null = null
let csrfToken: string | null = null
let refreshPromise: Promise<boolean> | null = null

interface ProblemDetails {
  title?: string
  detail?: string
  code?: string
  traceId?: string
  errors?: Record<string, string[]>
}

interface RequestOptions {
  authorize?: boolean
  retryUnauthorized?: boolean
}

async function toApiError(response: Response): Promise<ApiError> {
  let problem: ProblemDetails = {}
  if ((response.headers.get('content-type') ?? '').includes('json')) {
    try {
      problem = (await response.json()) as ProblemDetails
    } catch {
      problem = {}
    }
  }
  const errors = Object.fromEntries(
    Object.entries(problem.errors ?? {}).map(([field, messages]) => [field, messages.join(' ')]),
  )
  return new ApiError(
    response.status,
    problem.detail ?? problem.title ?? response.statusText ?? 'API request failed',
    errors,
    problem.code,
    problem.traceId,
  )
}

async function execute(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  let timedOut = false
  const timeout = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMilliseconds)
  const abort = () => controller.abort()
  init.signal?.addEventListener('abort', abort, { once: true })
  try {
    return await fetch(`${apiBase}${path}`, { ...init, signal: controller.signal })
  } catch (reason) {
    if (timedOut) throw new ApiError(0, 'Request timed out.')
    if (controller.signal.aborted) throw new ApiError(0, 'Request was cancelled.')
    throw reason instanceof ApiError ? reason : new ApiError(0, 'Unable to reach the server.')
  } finally {
    window.clearTimeout(timeout)
    init.signal?.removeEventListener('abort', abort)
  }
}

export function clearAccessToken(): void {
  accessToken = null
}

export function setAccessToken(token: string): void {
  accessToken = token
}

export async function loadCsrfToken(): Promise<void> {
  const response = await execute('/security/csrf-token', {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  })
  if (!response.ok) throw await toApiError(response)
  csrfToken = ((await response.json()) as { token: string }).token
}

export async function authRequest<T>(path: string, body?: unknown): Promise<T> {
  if (!csrfToken) await loadCsrfToken()
  const init: RequestInit = {
    method: 'POST',
    headers: { 'X-CSRF-TOKEN': csrfToken! },
  }
  if (body !== undefined) init.body = JSON.stringify(body)
  return request<T>(path, init, { authorize: false, retryUnauthorized: false })
}

export async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const token = await authRequest<{ accessToken: string }>('/auth/refresh')
      setAccessToken(token.accessToken)
      return true
    } catch (reason) {
      if (reason instanceof ApiError && [400, 401].includes(reason.status)) {
        clearAccessToken()
        return false
      }
      throw reason
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> {
  const authorize = options.authorize ?? true
  const retryUnauthorized = options.retryUnauthorized ?? true
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')
  if (authorize && accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await execute(path, { ...init, headers, credentials: 'include' })
  if (response.status === 401 && authorize && retryUnauthorized && (await refreshAccessToken())) {
    return request<T>(path, init, { authorize, retryUnauthorized: false })
  }
  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
