import type {
  AppServices,
  AuthService,
  PreferenceService,
  ProjectService,
  RegisterInput,
  TaskItemService,
  UserService,
} from './contracts'
import { seedDatabase, type MockDatabase } from './mockData'
import {
  ApiError,
  type Project,
  type ProjectInput,
  type ProjectQuery,
  type ProjectRole,
  type SystemRole,
  type TaskComment,
  type TaskInput,
  type TaskItem,
  type TaskQuery,
  type TaskStatus,
  type User,
} from '@/types/models'

const databaseKey = 'project-management-web:mock-db:v1'
const sessionKey = 'project-management-web:session:v1'
const demoPassword = 'Demo123!'

const clone = <T>(value: T): T => structuredClone(value)
const nowIso = () => new Date().toISOString()
const randomId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`

class MockRepository {
  read(): MockDatabase {
    const raw = localStorage.getItem(databaseKey)
    if (!raw) {
      const seeded = seedDatabase()
      this.write(seeded)
      return seeded
    }
    try {
      const parsed = JSON.parse(raw) as MockDatabase
      if (parsed.schemaVersion !== 1) throw new Error('Unsupported schema')
      return parsed
    } catch {
      const seeded = seedDatabase()
      this.write(seeded)
      return seeded
    }
  }

  write(database: MockDatabase): void {
    localStorage.setItem(databaseKey, JSON.stringify(database))
  }

  reset(): void {
    this.write(seedDatabase())
    sessionStorage.removeItem(sessionKey)
  }
}

const repository = new MockRepository()

const currentUserOrThrow = (): User => {
  const userId = sessionStorage.getItem(sessionKey)
  const user = repository.read().users.find((item) => item.id === userId)
  if (!user || !user.isEnabled) throw new ApiError(401, 'Session expired')
  return user
}

const findProject = (database: MockDatabase, projectId: string): Project => {
  const project = database.projects.find((item) => item.id === projectId)
  if (!project) throw new ApiError(404, 'Project not found')
  return project
}

const ensureProjectVisible = (project: Project, user: User): void => {
  if (user.role === 'Admin' || user.role === 'Administrator') return
  if (!project.members.some((member) => member.userId === user.id)) {
    throw new ApiError(403, 'You cannot access this project')
  }
}

const canManageProject = (project: Project, user: User): boolean =>
  user.role === 'Admin' ||
  user.role === 'Administrator' ||
  project.ownerId === user.id ||
  project.members.some(
    (member) => member.userId === user.id && member.projectRole === 'ProjectManager',
  )

const ensureManageProject = (project: Project, user: User): void => {
  if (!canManageProject(project, user)) throw new ApiError(403, 'Project management denied')
}

const ensureAdmin = (user: User): void => {
  if (user.role !== 'Admin') throw new ApiError(403, 'Admin permission required')
}

const ensureTaskAdmin = (user: User): void => {
  if (user.role !== 'Admin' && user.role !== 'Administrator') {
    throw new ApiError(403, 'Task administrator permission required')
  }
}

const auth: AuthService = {
  async currentUser() {
    const userId = sessionStorage.getItem(sessionKey)
    if (!userId) return null
    const user = repository.read().users.find((item) => item.id === userId)
    if (!user?.isEnabled) {
      sessionStorage.removeItem(sessionKey)
      return null
    }
    return clone(user)
  },

  async signIn(account, password) {
    const user = repository.read().users.find((item) => item.account === account.trim())
    if (!user || password !== demoPassword || !user.isEnabled) {
      throw new ApiError(401, 'Account or password is incorrect')
    }
    sessionStorage.setItem(sessionKey, user.id)
    return clone(user)
  },

  async signUp(input: RegisterInput) {
    const database = repository.read()
    const fieldErrors: Record<string, string> = {}
    if (database.users.some((user) => user.account.toLowerCase() === input.account.toLowerCase())) {
      fieldErrors.account = 'Account already exists'
    }
    if (database.users.some((user) => user.email.toLowerCase() === input.email.toLowerCase())) {
      fieldErrors.email = 'Email already exists'
    }
    if (input.password.length < 8) fieldErrors.password = 'Password must contain 8 characters'
    if (Object.keys(fieldErrors).length) throw new ApiError(422, 'Validation failed', fieldErrors)
    const user: User = {
      id: randomId('user'),
      account: input.account.trim(),
      displayName: input.displayName.trim(),
      email: input.email.trim(),
      role: 'Viewer',
      isVerified: false,
      isEnabled: true,
      createdAt: nowIso(),
    }
    database.users.push(user)
    repository.write(database)
    return clone(user)
  },

  async signOut() {
    sessionStorage.removeItem(sessionKey)
  },

  async verifyEmail(account) {
    const database = repository.read()
    const user = database.users.find((item) => item.account === account)
    if (!user) throw new ApiError(404, 'Account not found')
    user.isVerified = true
    repository.write(database)
    return clone(user)
  },

  async resendVerification(account) {
    const user = repository.read().users.find((item) => item.account === account)
    if (!user) throw new ApiError(404, 'Account not found')
    if (user.isVerified) throw new ApiError(409, 'Email already verified')
  },
}

const users: UserService = {
  async list(search = '') {
    currentUserOrThrow()
    const needle = search.trim().toLowerCase()
    return clone(
      repository
        .read()
        .users.filter((user) =>
          [user.account, user.displayName, user.email, user.role].some((value) =>
            value.toLowerCase().includes(needle),
          ),
        ),
    )
  },

  async get(id) {
    currentUserOrThrow()
    const user = repository.read().users.find((item) => item.id === id)
    if (!user) throw new ApiError(404, 'User not found')
    return clone(user)
  },

  async update(id, role: SystemRole, isEnabled: boolean) {
    const actor = currentUserOrThrow()
    ensureAdmin(actor)
    const database = repository.read()
    const user = database.users.find((item) => item.id === id)
    if (!user) throw new ApiError(404, 'User not found')
    const wouldRemoveAdmin = user.role === 'Admin' && (role !== 'Admin' || !isEnabled)
    const enabledAdmins = database.users.filter(
      (item) => item.role === 'Admin' && item.isEnabled && item.id !== user.id,
    )
    if (wouldRemoveAdmin && enabledAdmins.length === 0) {
      throw new ApiError(409, 'The last enabled Admin cannot be changed')
    }
    if (!user.isVerified && role !== 'Viewer') {
      throw new ApiError(422, 'Unverified users must remain Viewer')
    }
    user.role = role
    user.isEnabled = isEnabled
    repository.write(database)
    return clone(user)
  },
}

const projects: ProjectService = {
  async list(query: ProjectQuery) {
    const actor = currentUserOrThrow()
    const accessible = repository
      .read()
      .projects.filter(
        (project) =>
          actor.role === 'Admin' ||
          actor.role === 'Administrator' ||
          project.members.some((member) => member.userId === actor.id),
      )
    const needle = query.search.trim().toLowerCase()
    const filtered = accessible.filter(
      (project) =>
        (!query.status || project.status === query.status) &&
        [project.id, project.name, project.description].some((value) =>
          value.toLowerCase().includes(needle),
        ),
    )
    const start = (query.page - 1) * query.pageSize
    return {
      items: clone(filtered.slice(start, start + query.pageSize)),
      page: query.page,
      pageSize: query.pageSize,
      total: filtered.length,
    }
  },

  async listAccessible() {
    const actor = currentUserOrThrow()
    return clone(
      repository
        .read()
        .projects.filter(
          (project) =>
            actor.role === 'Admin' ||
            actor.role === 'Administrator' ||
            project.members.some((member) => member.userId === actor.id),
        ),
    )
  },

  async get(id) {
    const actor = currentUserOrThrow()
    const project = findProject(repository.read(), id)
    ensureProjectVisible(project, actor)
    return clone(project)
  },

  async create(input: ProjectInput) {
    const actor = currentUserOrThrow()
    ensureTaskAdmin(actor)
    const database = repository.read()
    if (!database.users.some((user) => user.id === input.ownerId && user.isEnabled)) {
      throw new ApiError(422, 'Owner is not available', { ownerId: 'Select an enabled owner' })
    }
    const timestamp = nowIso()
    const ownerRole: ProjectRole = 'ProjectManager'
    const project: Project = {
      id: randomId('PRJ').toUpperCase(),
      name: input.name.trim(),
      description: input.description.trim(),
      ownerId: input.ownerId,
      status: input.status,
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      members: [{ userId: input.ownerId, projectRole: ownerRole }],
    }
    database.projects.unshift(project)
    repository.write(database)
    return clone(project)
  },

  async update(id, input: ProjectInput) {
    const actor = currentUserOrThrow()
    const database = repository.read()
    const project = findProject(database, id)
    ensureManageProject(project, actor)
    if (input.version !== project.version) throw new ApiError(409, 'Project has been updated')
    project.name = input.name.trim()
    project.description = input.description.trim()
    project.status = input.status
    project.ownerId = input.ownerId
    if (!project.members.some((member) => member.userId === input.ownerId)) {
      project.members.push({ userId: input.ownerId, projectRole: 'ProjectManager' })
    }
    project.updatedAt = nowIso()
    project.version += 1
    repository.write(database)
    return clone(project)
  },

  async addMember(projectId, userId, role) {
    const actor = currentUserOrThrow()
    const database = repository.read()
    const project = findProject(database, projectId)
    ensureManageProject(project, actor)
    const user = database.users.find((item) => item.id === userId)
    if (!user?.isEnabled) throw new ApiError(422, 'Member must be enabled')
    if (project.members.some((member) => member.userId === userId)) {
      throw new ApiError(409, 'User is already a project member')
    }
    project.members.push({ userId, projectRole: role })
    project.version += 1
    project.updatedAt = nowIso()
    repository.write(database)
    return clone(project)
  },

  async updateMember(projectId, userId, role) {
    const actor = currentUserOrThrow()
    const database = repository.read()
    const project = findProject(database, projectId)
    ensureManageProject(project, actor)
    const member = project.members.find((item) => item.userId === userId)
    if (!member) throw new ApiError(404, 'Project member not found')
    member.projectRole = role
    project.version += 1
    project.updatedAt = nowIso()
    repository.write(database)
    return clone(project)
  },

  async removeMember(projectId, userId) {
    const actor = currentUserOrThrow()
    const database = repository.read()
    const project = findProject(database, projectId)
    ensureManageProject(project, actor)
    if (project.ownerId === userId) throw new ApiError(409, 'Transfer project ownership first')
    const hasOpenTasks = database.tasks.some(
      (task) =>
        task.projectId === projectId &&
        task.assigneeId === userId &&
        task.status !== 'Completed' &&
        !task.deletedAt,
    )
    if (hasOpenTasks) throw new ApiError(409, 'Reassign open tasks before removing this member')
    project.members = project.members.filter((member) => member.userId !== userId)
    project.version += 1
    project.updatedAt = nowIso()
    repository.write(database)
    return clone(project)
  },
}

const ensureTaskEditable = (task: TaskItem, actor: User): void => {
  if (actor.role === 'Admin' || actor.role === 'Administrator' || task.assigneeId === actor.id)
    return
  throw new ApiError(403, 'Task update denied')
}

const tasks: TaskItemService = {
  async list(projectId, query: TaskQuery) {
    const actor = currentUserOrThrow()
    const database = repository.read()
    ensureProjectVisible(findProject(database, projectId), actor)
    const needle = query.search.trim().toLowerCase()
    const filtered = database.tasks
      .filter(
        (task) =>
          task.projectId === projectId &&
          !task.deletedAt &&
          (!query.status || task.status === query.status) &&
          (!query.assigneeId || task.assigneeId === query.assigneeId) &&
          (!query.mineOnly || task.assigneeId === actor.id) &&
          [task.id, task.title, task.description].some((value) =>
            value.toLowerCase().includes(needle),
          ),
      )
      .sort((a, b) =>
        query.sort === 'newest'
          ? b.createdAt.localeCompare(a.createdAt)
          : a.createdAt.localeCompare(b.createdAt),
      )
    const start = (query.page - 1) * query.pageSize
    return {
      items: clone(filtered.slice(start, start + query.pageSize)),
      page: query.page,
      pageSize: query.pageSize,
      total: filtered.length,
    }
  },

  async get(id) {
    const actor = currentUserOrThrow()
    const database = repository.read()
    const task = database.tasks.find((item) => item.id === id && !item.deletedAt)
    if (!task) throw new ApiError(404, 'Task not found')
    ensureProjectVisible(findProject(database, task.projectId), actor)
    return clone(task)
  },

  async create(projectId, input: TaskInput) {
    const actor = currentUserOrThrow()
    ensureTaskAdmin(actor)
    const database = repository.read()
    const project = findProject(database, projectId)
    if (!project.members.some((member) => member.userId === input.assigneeId)) {
      throw new ApiError(422, 'Assignee must be a project member', {
        assigneeId: 'Select a project member',
      })
    }
    if (input.startAt > input.deadline)
      throw new ApiError(422, 'Start date must be before deadline', {
        deadline: 'Deadline must be after start date',
      })
    const timestamp = nowIso()
    const task: TaskItem = {
      id: randomId('TASK').toUpperCase(),
      projectId,
      title: input.title.trim(),
      description: input.description.trim(),
      creatorId: actor.id,
      assigneeId: input.assigneeId,
      startAt: input.startAt,
      deadline: input.deadline,
      status: 'Pending',
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      deletedAt: null,
    }
    database.tasks.unshift(task)
    repository.write(database)
    return clone(task)
  },

  async update(id, input: TaskInput) {
    const actor = currentUserOrThrow()
    const database = repository.read()
    const task = database.tasks.find((item) => item.id === id && !item.deletedAt)
    if (!task) throw new ApiError(404, 'Task not found')
    ensureTaskEditable(task, actor)
    if (input.version !== task.version) throw new ApiError(409, 'Task has been updated')
    if (
      actor.role === 'User' &&
      (input.title !== task.title ||
        input.description !== task.description ||
        input.assigneeId !== task.assigneeId)
    ) {
      throw new ApiError(403, 'Assigned users may only change status and deadline')
    }
    if (input.startAt > input.deadline)
      throw new ApiError(422, 'Start date must be before deadline')
    Object.assign(task, {
      title: input.title.trim(),
      description: input.description.trim(),
      assigneeId: input.assigneeId,
      startAt: input.startAt,
      deadline: input.deadline,
      status: input.status,
      updatedAt: nowIso(),
      version: task.version + 1,
    })
    repository.write(database)
    return clone(task)
  },

  async remove(id) {
    const actor = currentUserOrThrow()
    ensureTaskAdmin(actor)
    const database = repository.read()
    const task = database.tasks.find((item) => item.id === id && !item.deletedAt)
    if (!task) throw new ApiError(404, 'Task not found')
    task.deletedAt = nowIso()
    task.version += 1
    repository.write(database)
  },

  async batchUpdate(ids, status: TaskStatus) {
    const actor = currentUserOrThrow()
    const database = repository.read()
    if (!ids.length) throw new ApiError(422, 'Select at least one task')
    const selected = ids.map((id) =>
      database.tasks.find((task) => task.id === id && !task.deletedAt),
    )
    if (selected.some((task) => !task)) throw new ApiError(404, 'One or more tasks no longer exist')
    const concreteTasks = selected as TaskItem[]
    concreteTasks.forEach((task) => ensureTaskEditable(task, actor))
    const timestamp = nowIso()
    concreteTasks.forEach((task) => {
      task.status = status
      task.updatedAt = timestamp
      task.version += 1
    })
    repository.write(database)
    return clone(concreteTasks)
  },

  async listComments(taskId) {
    await this.get(taskId)
    return clone(
      repository
        .read()
        .comments.filter((comment) => comment.taskId === taskId && !comment.deletedAt),
    )
  },

  async addComment(taskId, content) {
    const actor = currentUserOrThrow()
    if (actor.role === 'Viewer') throw new ApiError(403, 'Viewer cannot comment')
    await this.get(taskId)
    if (!content.trim() || content.trim().length > 2000)
      throw new ApiError(422, 'Comment must contain 1 to 2000 characters')
    const database = repository.read()
    const timestamp = nowIso()
    const comment: TaskComment = {
      id: randomId('comment'),
      taskId,
      authorId: actor.id,
      content: content.trim(),
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    }
    database.comments.push(comment)
    repository.write(database)
    return clone(comment)
  },

  async updateComment(commentId, content) {
    const actor = currentUserOrThrow()
    const database = repository.read()
    const comment = database.comments.find((item) => item.id === commentId && !item.deletedAt)
    if (!comment) throw new ApiError(404, 'Comment not found')
    if (comment.authorId !== actor.id)
      throw new ApiError(403, 'You can only edit your own comments')
    if (!content.trim() || content.trim().length > 2000)
      throw new ApiError(422, 'Comment must contain 1 to 2000 characters')
    comment.content = content.trim()
    comment.updatedAt = nowIso()
    repository.write(database)
    return clone(comment)
  },

  async removeComment(commentId) {
    const actor = currentUserOrThrow()
    const database = repository.read()
    const comment = database.comments.find((item) => item.id === commentId && !item.deletedAt)
    if (!comment) throw new ApiError(404, 'Comment not found')
    if (comment.authorId !== actor.id)
      throw new ApiError(403, 'You can only delete your own comments')
    comment.deletedAt = nowIso()
    repository.write(database)
  },
}

const preferences: PreferenceService = {
  async get() {
    const actor = currentUserOrThrow()
    return clone(
      repository.read().preferences.find((item) => item.userId === actor.id) ?? {
        userId: actor.id,
        skipBatchConfirmation: false,
      },
    )
  },

  async update(skipBatchConfirmation: boolean) {
    const actor = currentUserOrThrow()
    const database = repository.read()
    let preference = database.preferences.find((item) => item.userId === actor.id)
    if (!preference) {
      preference = { userId: actor.id, skipBatchConfirmation }
      database.preferences.push(preference)
    } else {
      preference.skipBatchConfirmation = skipBatchConfirmation
    }
    repository.write(database)
    return clone(preference)
  },
}

export const services: AppServices = {
  auth,
  users,
  projects,
  tasks,
  preferences,
  async reset() {
    repository.reset()
  },
}

export { demoPassword }
