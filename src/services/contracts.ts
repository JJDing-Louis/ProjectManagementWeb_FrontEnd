import type {
  CurrentUser,
  MemberCandidate,
  PageResult,
  Project,
  ProjectInput,
  ProjectQuery,
  ProjectRoleOption,
  RoleOption,
  TaskComment,
  TaskInput,
  TaskItem,
  TaskQuery,
  TaskStatus,
  User,
  UserPreference,
  UserQuery,
} from '@/types/models'

export interface RegisterInput {
  account: string
  displayName: string
  password: string
  email: string
}

export interface AuthService {
  restore(): Promise<CurrentUser | null>
  currentUser(): Promise<CurrentUser>
  signIn(account: string, password: string): Promise<CurrentUser>
  signUp(input: RegisterInput): Promise<string>
  signOut(): Promise<void>
  verifyEmail(accountId: string, token: string): Promise<void>
  resendVerification(accountOrEmail: string): Promise<void>
}

export interface UserService {
  list(query: UserQuery): Promise<PageResult<User>>
  listAll(search?: string): Promise<User[]>
  get(id: string): Promise<User>
  roles(): Promise<RoleOption[]>
  updateAdministration(id: string, roleId: string, isEnabled: boolean): Promise<User>
}

export interface ProjectService {
  list(query: ProjectQuery): Promise<PageResult<Project>>
  listAccessible(): Promise<Project[]>
  get(id: string): Promise<Project>
  roles(): Promise<ProjectRoleOption[]>
  memberCandidates(projectId: string, search?: string): Promise<MemberCandidate[]>
  create(input: ProjectInput): Promise<Project>
  update(id: string, input: ProjectInput): Promise<Project>
  addMember(projectId: string, userId: string, roleIds: string[]): Promise<void>
  updateMember(projectId: string, userId: string, roleIds: string[]): Promise<void>
  removeMember(projectId: string, userId: string): Promise<void>
}

export interface TaskItemService {
  list(projectId: string, query: TaskQuery): Promise<PageResult<TaskItem>>
  get(projectId: string, taskId: string): Promise<TaskItem>
  create(projectId: string, input: TaskInput): Promise<TaskItem>
  update(projectId: string, taskId: string, input: TaskInput): Promise<TaskItem>
  updateAssigned(projectId: string, taskId: string, input: TaskInput): Promise<TaskItem>
  remove(projectId: string, task: TaskItem): Promise<void>
  batchUpdate(projectId: string, tasks: TaskItem[], status: TaskStatus): Promise<number>
  listComments(projectId: string, taskId: string): Promise<TaskComment[]>
  addComment(projectId: string, taskId: string, content: string): Promise<TaskComment>
  updateComment(
    projectId: string,
    taskId: string,
    comment: TaskComment,
    content: string,
  ): Promise<TaskComment>
  removeComment(projectId: string, taskId: string, comment: TaskComment): Promise<void>
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
}
