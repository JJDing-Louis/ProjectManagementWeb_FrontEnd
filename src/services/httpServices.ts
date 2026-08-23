import type { AppServices } from '@/services/contracts'
import {
  authRequest,
  clearAccessToken,
  refreshAccessToken,
  request,
  setAccessToken,
} from '@/services/httpClient'
import type {
  CurrentUser,
  MemberCandidate,
  PageResult,
  Project,
  ProjectMember,
  ProjectQuery,
  ProjectRoleCode,
  ProjectRoleOption,
  RoleOption,
  SystemRole,
  TaskComment,
  TaskItem,
  TaskQuery,
  User,
  UserQuery,
} from '@/types/models'

interface PagedDto<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
}

interface UserDto {
  id: string
  account: string
  email: string
  name: string | null
  emailConfirmed: boolean
  isEnabled: boolean
  role: SystemRole
}

interface CurrentUserDto extends UserDto {
  functions: string[]
}

interface ProjectRoleDto {
  id: string
  code: ProjectRoleCode
  name: string
}

interface ProjectMemberDto {
  accountId: string
  account: string
  name: string | null
  roles: ProjectRoleDto[]
}

interface ProjectDto {
  id: string
  code: string
  name: string
  description: string | null
  ownerAccountId: string
  status: Project['status']
  createdAt: string
  updatedAt: string
  rowVersion: string
}

interface TaskDto {
  id: string
  code: string
  projectId: string
  title: string
  description: string | null
  createdByAccountId: string
  assignedAccountId: string
  startAt: string
  deadline: string
  status: TaskItem['status']
  createdAt: string
  updatedAt: string
  rowVersion: string
}

interface CommentDto {
  id: string
  taskItemId: string
  authorAccountId: string
  content: string
  createdAt: string
  updatedAt: string
  rowVersion: string
}

function queryString(values: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value))
  })
  const value = query.toString()
  return value ? `?${value}` : ''
}

function json(method: string, body: unknown): RequestInit {
  return { method, body: JSON.stringify(body) }
}

function mapUser(dto: UserDto): User {
  return {
    id: dto.id,
    account: dto.account,
    displayName: dto.name?.trim() || dto.account,
    email: dto.email,
    role: dto.role,
    isVerified: dto.emailConfirmed,
    isEnabled: dto.isEnabled,
  }
}

function mapCurrentUser(dto: CurrentUserDto): CurrentUser {
  return { ...mapUser(dto), functions: dto.functions }
}

function mapProjectRole(dto: ProjectRoleDto): ProjectRoleOption {
  return { id: dto.id, code: dto.code, name: dto.name }
}

function mapMember(dto: ProjectMemberDto): ProjectMember {
  return {
    userId: dto.accountId,
    account: dto.account,
    displayName: dto.name?.trim() || dto.account,
    roles: dto.roles.map(mapProjectRole),
  }
}

function mapProject(dto: ProjectDto, members: ProjectMember[] = []): Project {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    description: dto.description ?? '',
    ownerId: dto.ownerAccountId,
    status: dto.status,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    rowVersion: dto.rowVersion,
    members,
  }
}

function mapTask(dto: TaskDto): TaskItem {
  return {
    id: dto.id,
    code: dto.code,
    projectId: dto.projectId,
    title: dto.title,
    description: dto.description ?? '',
    creatorId: dto.createdByAccountId,
    assigneeId: dto.assignedAccountId,
    startAt: dto.startAt,
    deadline: dto.deadline,
    status: dto.status,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    rowVersion: dto.rowVersion,
  }
}

function mapComment(dto: CommentDto): TaskComment {
  return {
    id: dto.id,
    taskId: dto.taskItemId,
    authorId: dto.authorAccountId,
    content: dto.content,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    rowVersion: dto.rowVersion,
  }
}

async function allPages<T>(load: (page: number) => Promise<PageResult<T>>): Promise<T[]> {
  const items: T[] = []
  let page = 1
  while (true) {
    const result = await load(page)
    items.push(...result.items)
    if (items.length >= result.totalCount || result.items.length === 0) return items
    page++
  }
}

export const services: AppServices = {
  auth: {
    async restore() {
      if (!(await refreshAccessToken())) return null
      return this.currentUser()
    },
    async currentUser() {
      return mapCurrentUser(await request<CurrentUserDto>('/auth/me'))
    },
    async signIn(account, password) {
      const token = await authRequest<{ accessToken: string }>('/auth/login', { account, password })
      setAccessToken(token.accessToken)
      return this.currentUser()
    },
    async signUp(input) {
      const result = await authRequest<{ accountId: string }>('/auth/register', {
        account: input.account,
        password: input.password,
        email: input.email,
        name: input.displayName,
      })
      return result.accountId
    },
    async signOut() {
      try {
        await authRequest<void>('/auth/logout')
      } finally {
        clearAccessToken()
      }
    },
    async verifyEmail(accountId, token) {
      await authRequest<boolean>('/auth/email/confirm', { accountId, token })
    },
    async resendVerification(accountOrEmail) {
      await authRequest<boolean>('/auth/email/resend', { accountOrEmail })
    },
  },
  users: {
    async list(query: UserQuery) {
      const dto = await request<PagedDto<UserDto>>(
        `/users${queryString({ search: query.search, role: query.role, page: query.page, pageSize: query.pageSize })}`,
      )
      return { ...dto, items: dto.items.map(mapUser) }
    },
    async listAll(search = '') {
      return allPages((page) => this.list({ search, role: '', page, pageSize: 100 }))
    },
    async get(id) {
      return mapUser(await request<UserDto>(`/users/${id}`))
    },
    async roles() {
      const roles =
        await request<Array<{ id: string; name: SystemRole; functions: string[] }>>('/roles')
      return roles satisfies RoleOption[]
    },
    async updateAdministration(id, roleId, isEnabled) {
      return mapUser(
        await request<UserDto>(`/users/${id}/administration`, json('PUT', { roleId, isEnabled })),
      )
    },
  },
  projects: {
    async list(query: ProjectQuery) {
      const dto = await request<PagedDto<ProjectDto>>(
        `/projects${queryString({ search: query.search, status: query.status, page: query.page, pageSize: query.pageSize })}`,
      )
      return { ...dto, items: dto.items.map((item) => mapProject(item)) }
    },
    async listAccessible() {
      return allPages((page) => this.list({ search: '', status: '', page, pageSize: 100 }))
    },
    async get(id) {
      const [project, members] = await Promise.all([
        request<ProjectDto>(`/projects/${id}`),
        request<ProjectMemberDto[]>(`/projects/${id}/members`),
      ])
      return mapProject(project, members.map(mapMember))
    },
    async roles() {
      return (await request<ProjectRoleDto[]>('/projects/roles')).map(mapProjectRole)
    },
    async memberCandidates(projectId, search = '') {
      const candidates = await allPages(async (page) => {
        const dto = await request<PagedDto<{ id: string; account: string; name: string | null }>>(
          `/projects/${projectId}/member-candidates${queryString({ search, page, pageSize: 100 })}`,
        )
        return {
          ...dto,
          items: dto.items.map<MemberCandidate>((item) => ({
            id: item.id,
            account: item.account,
            displayName: item.name?.trim() || item.account,
          })),
        }
      })
      return candidates
    },
    async create(input) {
      return mapProject(
        await request<ProjectDto>(
          '/projects',
          json('POST', {
            name: input.name,
            description: input.description || null,
            ownerAccountId: input.ownerId,
          }),
        ),
      )
    },
    async update(id, input) {
      return mapProject(
        await request<ProjectDto>(
          `/projects/${id}`,
          json('PUT', {
            name: input.name,
            description: input.description || null,
            ownerAccountId: input.ownerId,
            status: input.status,
            rowVersion: input.rowVersion,
          }),
        ),
      )
    },
    async addMember(projectId, userId, roleIds) {
      await request(
        `/projects/${projectId}/members`,
        json('POST', { accountId: userId, projectRoleIds: roleIds }),
      )
    },
    async updateMember(projectId, userId, roleIds) {
      await request(
        `/projects/${projectId}/members/${userId}`,
        json('PUT', { projectRoleIds: roleIds }),
      )
    },
    async removeMember(projectId, userId) {
      await request<void>(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' })
    },
  },
  tasks: {
    async list(projectId, query: TaskQuery) {
      const dto = await request<PagedDto<TaskDto>>(
        `/projects/${projectId}/task-items${queryString({
          search: query.search,
          status: query.status,
          assignedAccountId: query.assigneeId,
          onlyMine: query.mineOnly || undefined,
          sortBy: 'createdAt',
          sortDirection: query.sort === 'oldest' ? 'asc' : 'desc',
          page: query.page,
          pageSize: query.pageSize,
        })}`,
      )
      return { ...dto, items: dto.items.map(mapTask) }
    },
    async get(projectId, taskId) {
      return mapTask(await request<TaskDto>(`/projects/${projectId}/task-items/${taskId}`))
    },
    async create(projectId, input) {
      return mapTask(
        await request<TaskDto>(
          `/projects/${projectId}/task-items`,
          json('POST', {
            title: input.title,
            description: input.description || null,
            assignedAccountId: input.assigneeId,
            startAt: input.startAt,
            deadline: input.deadline,
          }),
        ),
      )
    },
    async update(projectId, taskId, input) {
      return mapTask(
        await request<TaskDto>(
          `/projects/${projectId}/task-items/${taskId}`,
          json('PUT', {
            title: input.title,
            description: input.description || null,
            assignedAccountId: input.assigneeId,
            startAt: input.startAt,
            deadline: input.deadline,
            status: input.status,
            rowVersion: input.rowVersion,
          }),
        ),
      )
    },
    async updateAssigned(projectId, taskId, input) {
      return mapTask(
        await request<TaskDto>(
          `/projects/${projectId}/task-items/${taskId}/status-and-deadline`,
          json('PATCH', {
            status: input.status,
            deadline: input.deadline,
            rowVersion: input.rowVersion,
          }),
        ),
      )
    },
    async remove(projectId, task) {
      await request<void>(
        `/projects/${projectId}/task-items/${task.id}?rowVersion=${encodeURIComponent(task.rowVersion)}`,
        { method: 'DELETE' },
      )
    },
    async batchUpdate(projectId, tasks, status) {
      const result = await request<{ updatedCount: number }>(
        `/projects/${projectId}/task-items/batch-status`,
        json('PATCH', {
          tasks: tasks.map((task) => ({ taskId: task.id, rowVersion: task.rowVersion })),
          targetStatus: status,
        }),
      )
      return result.updatedCount
    },
    async listComments(projectId, taskId) {
      return (
        await request<CommentDto[]>(`/projects/${projectId}/task-items/${taskId}/comments`)
      ).map(mapComment)
    },
    async addComment(projectId, taskId, content) {
      return mapComment(
        await request<CommentDto>(
          `/projects/${projectId}/task-items/${taskId}/comments`,
          json('POST', { content }),
        ),
      )
    },
    async updateComment(projectId, taskId, comment, content) {
      return mapComment(
        await request<CommentDto>(
          `/projects/${projectId}/task-items/${taskId}/comments/${comment.id}`,
          json('PUT', { content, rowVersion: comment.rowVersion }),
        ),
      )
    },
    async removeComment(projectId, taskId, comment) {
      await request<void>(
        `/projects/${projectId}/task-items/${taskId}/comments/${comment.id}?rowVersion=${encodeURIComponent(comment.rowVersion)}`,
        { method: 'DELETE' },
      )
    },
  },
  preferences: {
    get: () => request('/users/me/preferences'),
    update: (skipBatchConfirmation) =>
      request('/users/me/preferences', json('PUT', { skipBatchConfirmation })),
  },
}
