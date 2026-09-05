export type SystemRole = 'Admin' | 'Administrator' | 'User' | 'Viewer'
export type ProjectRoleCode =
  'ProjectManager' | 'FrontendDeveloper' | 'BackendDeveloper' | 'SystemAnalyst' | 'Member'
export type ProjectStatus = 'Pending' | 'Active' | 'Completed' | 'Archived'
export type TaskStatus = 'Pending' | 'InProgress' | 'Blocked' | 'Completed'

export interface User {
  id: string
  account: string
  displayName: string
  email: string
  role: SystemRole
  isVerified: boolean
  isEnabled: boolean
  isBootstrapAdmin?: boolean
}

export interface CurrentUser extends User {
  functions: string[]
}

export interface RoleOption {
  id: string
  name: SystemRole
  functions: string[]
}

export interface ProjectRoleOption {
  id: string
  code: ProjectRoleCode
  name: string
}

export interface ProjectMember {
  userId: string
  account: string
  displayName: string
  roles: ProjectRoleOption[]
}

export interface MemberCandidate {
  id: string
  account: string
  displayName: string
}

export interface Project {
  id: string
  code: string
  name: string
  description: string
  ownerId: string
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  versionNumber: number
  rowVersion: string
  members: ProjectMember[]
}

export interface TaskItem {
  id: string
  code: string
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
  rowVersion: string
}

export interface TaskComment {
  id: string
  taskId: string
  authorId: string
  content: string
  createdAt: string
  updatedAt: string
  rowVersion: string
}

export interface UserPreference {
  skipBatchConfirmation: boolean
}

export interface PageResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
    public readonly code?: string,
    public readonly traceId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface UserQuery {
  search: string
  role: '' | SystemRole
  page: number
  pageSize: number
}

export interface ProjectQuery {
  search: string
  status: '' | ProjectStatus
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
  status: ProjectStatus
  rowVersion?: string | undefined
}

export interface TaskInput {
  title: string
  description: string
  assigneeId: string
  startAt: string
  deadline: string
  status: TaskStatus
  rowVersion?: string | undefined
}
