import { beforeEach, describe, expect, it, vi } from 'vitest'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

describe('HTTP services', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  // 測試案例：TC-F-AUTH-020（Frontend CSRF/Bearer 流程；部分覆蓋）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 15:34:32 +08:00
  it('登入時先取得 CSRF token，並以記憶體中的 Bearer token 讀取目前帳號', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token' }))
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'access-token' }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'account-id',
          account: 'admin',
          email: 'admin@example.test',
          name: 'Admin',
          emailConfirmed: true,
          isEnabled: true,
          role: 'Admin',
          functions: ['accounts.read'],
        }),
      )
    vi.stubGlobal('fetch', fetchMock)
    const { services } = await import('@/services')

    const user = await services.auth.signIn('admin', 'password')

    expect(user.displayName).toBe('Admin')
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('X-CSRF-TOKEN')).toBe(
      'csrf-token',
    )
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get('Authorization')).toBe(
      'Bearer access-token',
    )
  })

  // 測試案例：TC-F-AUTH-014（以下三個互補情境共同覆蓋 single-flight、單次重送與失敗終止）
  // 測試結果：Passed（3 tests）
  // 上次測試時間：2026-09-15 15:34:32 +08:00
  it('並行恢復登入時只送出一個 refresh request', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)
      if (url.endsWith('/security/csrf-token')) return jsonResponse({ token: 'csrf-token' })
      if (url.endsWith('/auth/refresh')) return jsonResponse({ accessToken: 'access-token' })
      return jsonResponse({
        id: 'account-id',
        account: 'user',
        email: 'user@example.test',
        name: null,
        emailConfirmed: true,
        isEnabled: true,
        role: 'User',
        functions: [],
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { services } = await import('@/services')

    await Promise.all([services.auth.restore(), services.auth.restore()])

    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/auth/refresh')),
    ).toHaveLength(1)
  })

  it('401 時只 refresh 一次並以新 Token 重送原請求一次', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ title: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token' }))
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'new-token' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'project-id' }))
    vi.stubGlobal('fetch', fetchMock)
    const { request, setAccessToken } = await import('@/services/httpClient')
    setAccessToken('old-token')

    await expect(request<{ id: string }>('/projects/project-id')).resolves.toEqual({
      id: 'project-id',
    })

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe(
      'Bearer old-token',
    )
    expect(new Headers(fetchMock.mock.calls[3]?.[1]?.headers).get('Authorization')).toBe(
      'Bearer new-token',
    )
  })

  it('refresh 失敗後清除 Access Token 並保留原始 401 語意', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ title: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token' }))
      .mockResolvedValueOnce(jsonResponse({ title: 'Refresh expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const { request, setAccessToken } = await import('@/services/httpClient')
    setAccessToken('expired-token')

    await expect(request('/projects')).rejects.toMatchObject({ status: 401 })
    await request('/public-check', {}, { authorize: true, retryUnauthorized: false })

    expect(new Headers(fetchMock.mock.calls[3]?.[1]?.headers).has('Authorization')).toBe(false)
  })

  // 測試案例：TC-ERR-UI-003（Problem Details 基本映射；部分覆蓋）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 15:34:32 +08:00
  it('Problem Details 應映射狀態、錯誤碼、欄位錯誤與 traceId', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(
        {
          title: 'Validation failed',
          detail: '資料驗證失敗。',
          code: 'validation_error',
          traceId: 'trace-123',
          errors: { deadline: ['期限不可早於開始時間。'] },
        },
        422,
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { request } = await import('@/services/httpClient')

    await expect(
      request('/validation', {}, { authorize: false, retryUnauthorized: false }),
    ).rejects.toMatchObject({
      status: 422,
      message: '資料驗證失敗。',
      code: 'validation_error',
      traceId: 'trace-123',
      fieldErrors: { deadline: '期限不可早於開始時間。' },
    })
  })

  // 測試案例：TC-ERR-UI-003（狀態碼、非 JSON、網路、timeout 與 caller cancellation 合併測試）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 15:34:32 +08:00
  it('應完整區分 HTTP、非 JSON、網路中斷、timeout 與 caller cancellation', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
    const { request } = await import('@/services/httpClient')

    for (const status of [400, 403, 404, 409, 422, 500]) {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          {
            title: `HTTP ${status}`,
            detail: `status-${status}`,
            code: `code_${status}`,
            traceId: `trace-${status}`,
          },
          status,
        ),
      )
      await expect(
        request(`/status-${status}`, {}, { authorize: false, retryUnauthorized: false }),
      ).rejects.toMatchObject({
        status,
        message: `status-${status}`,
        code: `code_${status}`,
        traceId: `trace-${status}`,
      })
    }

    fetchMock.mockResolvedValueOnce(
      new Response('<html>upstream details</html>', {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'Content-Type': 'text/html' },
      }),
    )
    await expect(
      request('/non-json', {}, { authorize: false, retryUnauthorized: false }),
    ).rejects.toMatchObject({ status: 502, message: 'Bad Gateway' })

    fetchMock.mockRejectedValueOnce(new TypeError('network internals'))
    await expect(
      request('/network', {}, { authorize: false, retryUnauthorized: false }),
    ).rejects.toMatchObject({ status: 0, message: 'Unable to reach the server.' })

    vi.useFakeTimers()
    fetchMock.mockImplementationOnce(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )
    const timeoutRequest = request('/timeout', {}, { authorize: false, retryUnauthorized: false })
    const timeoutError = timeoutRequest.catch((reason: unknown) => reason)
    await vi.advanceTimersByTimeAsync(15_000)
    await expect(timeoutError).resolves.toMatchObject({ status: 0, message: 'Request timed out.' })

    const caller = new AbortController()
    fetchMock.mockImplementationOnce(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )
    const cancelledRequest = request(
      '/cancelled',
      { signal: caller.signal },
      { authorize: false, retryUnauthorized: false },
    )
    const cancelledError = cancelledRequest.catch((reason: unknown) => reason)
    caller.abort()
    await expect(cancelledError).resolves.toMatchObject({
      status: 0,
      message: 'Request was cancelled.',
    })
    vi.useRealTimers()
  })
})
