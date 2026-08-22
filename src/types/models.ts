export type SystemRole = 'Admin' | 'Administrator' | 'User' | 'Viewer'
export type ProjectRole =
  'ProjectManager' | 'FrontendDeveloper' | 'BackendDeveloper' | 'SystemAnalyst' | 'Member'
export type TaskStatus = 'Pending' | 'InProgress' | 'Blocked' | 'Completed'

export interface User {
  id: string
  account: string
  displayName: string
  email: string
  role: SystemRole
  isVerified: boolean
  isEnabled: boolean
  createdAt: string
}

export interface ProjectMember {
  userId: string
  projectRole: ProjectRole
}

export interface Project {
  id: string
  name: string
  description: string
  ownerId: string
  status: 'Active' | 'Archived'
  createdAt: string
  updatedAt: string
  version: number
  members: ProjectMember[]
}

export interface TaskItem {
  id: string
  projectId: string
  title: string
  description: string
  creatorId: string
  assigneeId: string
  startAt: string
  deadline: string
  status: TaskStatus
  createdAt: string
  updatedAt: string
  version: number
  deletedAt: string | null
}

export interface TaskComment {
  id: string
  taskId: string
  authorId: string
  content: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface UserPreference {
  userId: string
  skipBatchConfirmation: boolean
}

export interface PageResult<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface ProjectQuery {
  search: string
  status: '' | Project['status']
  page: number
  pageSize: number
}

export interface TaskQuery {
  search: string
  status: '' | TaskStatus
  assigneeId: string
  mineOnly: boolean
  sort: 'newest' | 'oldest'
  page: number
  pageSize: number
}

export interface ProjectInput {
  name: string
  description: string
  ownerId: string
  status: Project['status']
  version?: number | undefined
}

export interface TaskInput {
  title: string
  description: string
  assigneeId: string
  startAt: string
  deadline: string
  status: TaskStatus
  version?: number | undefined
}
