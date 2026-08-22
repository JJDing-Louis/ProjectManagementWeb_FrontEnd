import type {
  PageResult,
  Project,
  ProjectInput,
  ProjectQuery,
  ProjectRole,
  SystemRole,
  TaskComment,
  TaskInput,
  TaskItem,
  TaskQuery,
  TaskStatus,
  User,
  UserPreference,
} from '@/types/models'

export interface RegisterInput {
  account: string
  displayName: string
  password: string
  email: string
}

export interface AuthService {
  currentUser(): Promise<User | null>
  signIn(account: string, password: string): Promise<User>
  signUp(input: RegisterInput): Promise<User>
  signOut(): Promise<void>
  verifyEmail(account: string): Promise<User>
  resendVerification(account: string): Promise<void>
}

export interface UserService {
  list(search?: string): Promise<User[]>
  get(id: string): Promise<User>
  update(id: string, role: SystemRole, isEnabled: boolean): Promise<User>
}

export interface ProjectService {
  list(query: ProjectQuery): Promise<PageResult<Project>>
  listAccessible(): Promise<Project[]>
  get(id: string): Promise<Project>
  create(input: ProjectInput): Promise<Project>
  update(id: string, input: ProjectInput): Promise<Project>
  addMember(projectId: string, userId: string, role: ProjectRole): Promise<Project>
  updateMember(projectId: string, userId: string, role: ProjectRole): Promise<Project>
  removeMember(projectId: string, userId: string): Promise<Project>
}

export interface TaskItemService {
  list(projectId: string, query: TaskQuery): Promise<PageResult<TaskItem>>
  get(id: string): Promise<TaskItem>
  create(projectId: string, input: TaskInput): Promise<TaskItem>
  update(id: string, input: TaskInput): Promise<TaskItem>
  remove(id: string): Promise<void>
  batchUpdate(ids: string[], status: TaskStatus): Promise<TaskItem[]>
  listComments(taskId: string): Promise<TaskComment[]>
  addComment(taskId: string, content: string): Promise<TaskComment>
  updateComment(commentId: string, content: string): Promise<TaskComment>
  removeComment(commentId: string): Promise<void>
}

export interface PreferenceService {
  get(): Promise<UserPreference>
  update(skipBatchConfirmation: boolean): Promise<UserPreference>
}

export interface AppServices {
  auth: AuthService
  users: UserService
  projects: ProjectService
  tasks: TaskItemService
  preferences: PreferenceService
  reset(): Promise<void>
}
