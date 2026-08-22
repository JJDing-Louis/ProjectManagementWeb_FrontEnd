import { describe, expect, it } from 'vitest'
import { services } from '@/services/mockServices'
import { ApiError } from '@/types/models'

describe('Mock services', () => {
  it('允許未驗證的 Viewer 登入，但維持 Viewer 權限', async () => {
    const user = await services.auth.signIn('pending', 'Demo123!')
    expect(user.isVerified).toBe(false)
    expect(user.role).toBe('Viewer')
    await expect(services.tasks.addComment('TASK-101', 'Hello')).rejects.toMatchObject({
      status: 403,
    })
  })

  it('禁止停用最後一位 Admin', async () => {
    await services.auth.signIn('admin', 'Demo123!')
    await expect(services.users.update('u-admin', 'Viewer', false)).rejects.toMatchObject({
      status: 409,
    })
  })

  it('批次更新先驗證全部 Task，失敗時不寫入任何資料', async () => {
    await services.auth.signIn('user', 'Demo123!')
    await expect(
      services.tasks.batchUpdate(['TASK-101', 'TASK-102'], 'Completed'),
    ).rejects.toBeInstanceOf(ApiError)
    expect((await services.tasks.get('TASK-101')).status).toBe('InProgress')
  })

  it('以版本欄位拒絕過期的 Project 更新', async () => {
    await services.auth.signIn('admin', 'Demo123!')
    const project = await services.projects.get('PRJ-1001')
    await expect(
      services.projects.update(project.id, {
        name: project.name,
        description: project.description,
        ownerId: project.ownerId,
        status: project.status,
        version: 99,
      }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('專案查詢只回傳符合關鍵字的資料', async () => {
    await services.auth.signIn('admin', 'Demo123!')
    const result = await services.projects.list({
      search: 'Customer',
      status: '',
      page: 1,
      pageSize: 10,
    })
    expect(result.items.map((project) => project.id)).toEqual(['PRJ-1001'])
  })
})
