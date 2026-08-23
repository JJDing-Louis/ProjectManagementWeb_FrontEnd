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
})
