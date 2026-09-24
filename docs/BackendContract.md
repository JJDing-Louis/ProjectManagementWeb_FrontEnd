# ProjectManagementWeb 前端／Backend Contract

本文件記錄 Vue 前端目前依賴的 Backend 契約，並對照 `src/services/httpServices.ts` 的 DTO 與 mapper。若內容出現衝突，判斷順序為 Backend Controller／Application contract、Backend OpenAPI、Backend 文件，最後才是本文件；前端不得從資料庫 Schema 推測 API DTO。

## Transport 與驗證

- Base origin 由 `VITE_API_BASE_URL` 提供，client 統一加上 `/api/v1`。
- Access Token 只保存在 JavaScript 記憶體，不寫入任何 Browser Storage。
- Refresh Token 由 Backend 保存於 HttpOnly Cookie。
- register、login、refresh、logout、Email confirm／resend 等 cookie-sensitive Auth POST 必須附加 `X-CSRF-TOKEN`。
- 401 允許一次 single-flight refresh 與一次原請求重送，不得形成 retry loop。
- HTTP timeout 預設 15 秒；支援呼叫端取消。
- 所有 request 使用 `credentials: 'include'`；一般業務 API 仍以 Bearer Access Token 驗證。
- CSRF token 只存在記憶體。現行 client 不會在 antiforgery 400 後自動重新取得，使用者需重新觸發操作或重新載入頁面。

## 共通型別

```ts
export type Guid = string
export type RowVersion = string // SQL Server rowversion 的 Base64
export type IsoDateTime = string

export type SystemRole = 'Admin' | 'Administrator' | 'User' | 'Viewer'
export type ProjectRoleCode =
  'ProjectManager' | 'FrontendDeveloper' | 'BackendDeveloper' | 'SystemAnalyst' | 'Member'
export type ProjectStatus = 'Pending' | 'Active' | 'Completed' | 'Archived'
export type TaskStatus = 'Pending' | 'InProgress' | 'Blocked' | 'Completed'

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
}
```

enum 一律以字串傳輸。Task 四種狀態允許任意互轉，但 Backend 仍驗證 Function、Project scope、指派關係與 `rowVersion`。

分頁預設 `page=1&pageSize=20`，Backend 會把 `pageSize` 限制在 1–100。前端應省略空白 optional query，不可傳送字串 `undefined` 或 `null`。

## DTO 與 View Model Mapping

HTTP DTO 不直接暴露給 View。`httpServices.ts` 目前進行以下轉換：

| Backend DTO 欄位         | 前端 Model 欄位   | 規則                                     |
| ------------------------ | ----------------- | ---------------------------------------- |
| `name`                   | `displayName`     | trim 後為空時 fallback 至 `account`      |
| `emailConfirmed`         | `isVerified`      | 僅重新命名                               |
| `ownerAccountId`         | `ownerId`         | 僅重新命名                               |
| `createdByAccountId`     | `creatorId`       | 僅重新命名                               |
| `assignedAccountId`      | `assigneeId`      | 僅重新命名                               |
| `taskItemId`             | `taskId`          | 僅重新命名                               |
| `description: null`      | `description: ''` | 畫面使用空字串                           |
| Project detail + members | `Project.members` | `projects.get()` 以兩個 request 平行組合 |
| Base64 `rowVersion`      | 同名欄位          | 原樣保存與回傳，不解碼、不以版本號取代   |

## Auth Contract

```ts
export interface RegisterRequest {
  account: string
  password: string
  confirmPassword: string
  email: string
  name: string
}

export interface RegisterResponse {
  accountId: Guid
  verificationEmailSent: boolean
}

export interface LoginRequest {
  account: string
  password: string
}

export interface AuthTokenResponse {
  accessToken: string
  accessTokenExpiresAt: IsoDateTime
}

export interface ConfirmEmailRequest {
  accountId: Guid
  token: string
}

export interface ResendEmailRequest {
  accountOrEmail: string
}
```

登入與 refresh 的原始 Refresh Token 只透過 HttpOnly Cookie 傳遞。現行前端只讀取 `accessToken`，尚未使用 `accessTokenExpiresAt` 主動更新，而是在業務 request 收到 401 後 refresh。

註冊成功但 `verificationEmailSent=false` 代表帳號已建立、寄信失敗；畫面仍進入驗證流程並提供重寄入口。未驗證 Email 的帳號可以登入，但有效角色固定為 Viewer。

密碼至少 10 字元，並須包含大寫、小寫、數字與非英數字元；`confirmPassword` 必須一致。驗證錯誤以 Problem Details `errors` 對應 `account`、`name`、`email`、`password` 與 `confirmPassword`。

## Current User、Users 與 Profile

```ts
export interface UserQuery {
  search?: string
  role?: SystemRole
  page?: number
  pageSize?: number
}

export interface CurrentAccountResponse {
  id: Guid
  account: string
  email: string
  name: string | null
  emailConfirmed: boolean
  isEnabled: boolean
  role: SystemRole
  functions: string[]
}

export interface UserResponse {
  id: Guid
  account: string
  email: string
  name: string | null
  emailConfirmed: boolean
  isEnabled: boolean
  role: SystemRole
  isBootstrapAdmin: boolean
}

export interface UserDetailResponse extends UserResponse {
  phoneNumber: string | null
}

export interface RoleResponse {
  id: Guid
  name: SystemRole
  functions: string[]
}

export interface UpdateAdministrationRequest {
  roleId: Guid
  isEnabled: boolean
}

export interface OwnProfileResponse {
  name: string
  phoneNumber: string | null
}

export interface UpdateOwnProfileRequest {
  name: string
  phoneNumber: string | null
}

export interface PreferenceResponse {
  skipBatchConfirmation: boolean
}
```

`GET /auth/me` 回傳目前帳號的唯一系統角色與 `functions`。前端 route、Sidebar 與按鈕依 Functions 與專案角色改善 UX；Backend 仍是唯一安全授權邊界。

- Users 管理 route 至少需要 `accounts.read`。
- 角色與狀態透過 `/users/{id}/administration` 原子更新。Backend 在 Serializable transaction 驗證 Email、最後一位有效 Admin、角色有效性與系統預設 Admin 保護，成功後撤銷 Refresh Tokens 並寫入 audit。
- Users 清單與 Project member candidates 不應顯示系統預設 Admin；即使前端漏掉篩選，Backend 仍拒絕修改或加入。
- Profile `name` trim 後必填且最多 100 字元；`phoneNumber` 可清除，非空時最多 30 字元並須為有效電話格式。
- 電話變更後，Backend 將 `PhoneNumberConfirmed` 重設為 false；前端目前不顯示電話驗證狀態。

## Project

```ts
export interface ProjectQuery {
  search?: string
  status?: ProjectStatus
  page?: number
  pageSize?: number
}

export interface CreateProjectRequest {
  name: string
  description: string | null
  ownerAccountId: Guid
  timeZoneId: string
}

export interface UpdateProjectRequest {
  name: string
  description: string | null
  ownerAccountId: Guid
  timeZoneId: string
  status: 'Pending' | 'Active' | 'Completed' | 'Archived'
  rowVersion: RowVersion
}

export interface ProjectResponse {
  id: Guid
  code: string
  name: string
  description: string | null
  ownerAccountId: Guid
  timeZoneId: string
  status: ProjectStatus
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
  versionNumber: number
  rowVersion: RowVersion
}

export interface ProjectRoleResponse {
  id: Guid
  code: ProjectRoleCode
  name: string
}

export interface ProjectMemberResponse {
  accountId: Guid
  account: string
  name: string | null
  roles: ProjectRoleResponse[]
}

export interface MemberCandidateResponse {
  id: Guid
  account: string
  name: string | null
}

export interface SaveProjectMemberRequest {
  accountId: Guid
  projectRoleIds: Guid[]
}

export interface UpdateProjectMemberRequest {
  projectRoleIds: Guid[]
}
```

- Create request 不包含 `code`；response 的唯讀 code 格式為 `PRJ-YYYYMMDD######`。
- 日期使用 UTC，Project 流水號每日獨立從 `000001` 起算。
- 列表／詳情顯示 code；route 與 API 使用 GUID。
- `timeZoneId` 必填且必須是合法 IANA timezone ID；前端不得省略或自行假設伺服器時區。
- `versionNumber` 是顯示用業務版本，只在 Project 基本資料更新後遞增；並行控制仍使用 `rowVersion`。
- Owner 必須是已啟用、Email 已驗證且系統角色恰為 `Administrator` 的帳號；修改 Owner 時還必須已是該 Project member。
- Owner 必須具有 `ProjectManager`；移交時 Backend 在同一交易補上角色，舊 Owner 原角色不移除。
- Project member 具有 `roles: ProjectRole[]`，新增與更新都傳送 `projectRoleIds: Guid[]`。
- member-candidate 分頁只揭露 `id`、`account`、`name`，且只能由可管理該專案者呼叫。
- Project 軟刪除使用 `DELETE /projects/{id}?rowVersion=...`，只允許 `Administrator` 與 `Admin`；成功後保留關聯資料，但一般 Project scope 不再顯示。

## Task

```ts
export interface TaskQuery {
  search?: string
  status?: TaskStatus
  assignedAccountId?: Guid
  onlyMine?: boolean
  sortBy?: 'createdAt' | 'deadline' | 'status' | 'code'
  sortDirection?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface CreateTaskRequest {
  title: string
  description: string | null
  assignedAccountId: Guid
  startAt: IsoDateTime
  deadline: IsoDateTime
}

export interface UpdateTaskRequest {
  title: string
  description: string | null
  assignedAccountId: Guid
  startAt: IsoDateTime
  deadline: IsoDateTime
  status: TaskStatus
  rowVersion: RowVersion
}

export interface UpdateAssignedTaskRequest {
  status: TaskStatus
  deadline: IsoDateTime
  rowVersion: RowVersion
}

export interface BatchTaskVersion {
  taskId: Guid
  rowVersion: RowVersion
}

export interface BatchUpdateTaskStatusRequest {
  tasks: BatchTaskVersion[]
  targetStatus: TaskStatus
}

export interface BatchUpdateResponse {
  updatedCount: number
}

export interface TaskResponse {
  id: Guid
  code: string
  projectId: Guid
  title: string
  description: string | null
  createdByAccountId: Guid
  assignedAccountId: Guid
  startAt: IsoDateTime
  deadline: IsoDateTime
  status: TaskStatus
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
  rowVersion: RowVersion
}
```

- Create request 不包含 `code`；response 的唯讀 code 格式為 `TASK-YYYYMMDD######`。
- 日期使用 UTC，Task 流水號每日獨立從 `000001` 起算，與 Project 計數器互不影響。
- 一般被指派者只呼叫 status-and-deadline PATCH；管理者使用完整 PUT。
- 指派候選人與名稱顯示來自 Project members，不呼叫一般使用者可能無權存取的 Users API。
- batch-status 必須傳每筆 Task ID 與目前 rowVersion。
- batch-status 成功回傳 `{ updatedCount }`，不是更新後的 Task array；前端成功後清除 selection 並重新載入列表。
- 更新與刪除一律包含 projectId、taskId 與 rowVersion。

## Comment

```ts
export interface CreateCommentRequest {
  content: string
}

export interface UpdateCommentRequest {
  content: string
  rowVersion: RowVersion
}

export interface CommentResponse {
  id: Guid
  taskItemId: Guid
  authorAccountId: Guid
  content: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
  rowVersion: RowVersion
}
```

Comment create／list 使用 projectId 與 taskId；update／delete 另外使用 commentId。內容 trim 後為 1–2000 字，只有作者可修改或軟刪除。修改與刪除都必須傳送目前 Base64 rowVersion，409 時前端保留內容並提示重新載入。

## Function 與資源範圍

常用 Function 包含：

- Accounts：`accounts.read`、`accounts.manage-role`、`accounts.manage-status`。
- Projects：`projects.read`、`projects.create`、`projects.manage-all`、`project-members.manage-all`。
- Tasks：`tasks.read`、`tasks.create`、`tasks.update-any`、`tasks.update-assigned`、`tasks.delete`。
- Comments：`comments.read`、`comments.create`、`comments.update-own`、`comments.delete-own`。
- Preferences：`preferences.read-own`、`preferences.update-own`。

Function 只回答帳號具備哪些全域能力；Project member、ProjectManager、Task assignee、Comment author 等資源範圍仍由 Backend 對每個 request 驗證。未驗證 Email 的帳號以 Viewer 能力操作。

## Error Contract

Backend 回傳 RFC 7807 Problem Details，並可能包含：

```ts
export interface ApiProblemDetails {
  status?: number
  title?: string
  detail?: string
  code?: string
  traceId?: string
  errors?: Record<string, string[]>
}
```

前端必須保留 401、403、404、409、422 與 429 的不同語意。每日業務編號超過 `999999` 時，409 的穩定錯誤碼為 `daily_code_limit_exceeded`；登入或 Email 重寄遇到 429 時不得自動重送。

`httpClient.ts` 會將 `errors: Record<string, string[]>` 合併為單一欄位訊息，並保留 `code` 與 `traceId`。網路無法連線、timeout 或取消使用前端自訂 `ApiError(status=0)`；這三種情況沒有 Backend Problem Details。

## Email 驗證

驗證頁從信件連結取得 `accountId` 與 `token` 後呼叫 confirm API，不可只用帳號模擬驗證。重寄可傳帳號或 Email。實際 SMTP 寄送是否成功屬外部服務驗證，不影響前端 token 與確認 API 的契約。

## 串接維護檢查表

Backend contract 變更時，至少同步檢查：

1. `src/services/contracts.ts` 的 View-facing interface。
2. `src/services/httpServices.ts` 的 request、DTO 與 mapper。
3. `src/types/models.ts` 的 domain／View model。
4. 對應 View 的 loading、validation、403、404、409 與 empty state。
5. HTTP adapter、View、router 與 Playwright 測試。
6. 本文件、[ApiList.md](ApiList.md) 與 [Architecture.md](Architecture.md)。

目前已知的 client 邊界：

- 前端尚未利用 `accessTokenExpiresAt` 預先更新 Access Token。
- antiforgery 400 不會自動重新取得 CSRF token。
- 部分 edit route 沒有 `requiredFunction` meta，仍由 View capability 與 Backend authorization 擋下；route guard 不可視為安全邊界。
