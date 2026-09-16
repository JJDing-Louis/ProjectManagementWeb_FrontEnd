# ProjectManagementWeb 前端／Backend Contract

本文件記錄 Vue 前端目前依賴的穩定契約邊界。完整 API 欄位與授權規則以後端 `docs/FrontendContract.md`、`docs/ApiList.md` 及 OpenAPI 為準；本文件聚焦前端不得自行推測的部分。

## Transport 與驗證

- Base origin 由 `VITE_API_BASE_URL` 提供，client 統一加上 `/api/v1`。
- Access Token 只保存在 JavaScript 記憶體，不寫入任何 Browser Storage。
- Refresh Token 由 Backend 保存於 HttpOnly Cookie。
- register、login、refresh、logout、Email confirm／resend 等 Auth POST 必須附加 `X-CSRF-TOKEN`。
- 401 允許一次 single-flight refresh 與一次原請求重送，不得形成 retry loop。
- HTTP timeout 預設 15 秒；支援呼叫端取消。

## 共通型別

```ts
export type Guid = string
export type RowVersion = string // SQL Server rowversion 的 Base64
export type IsoDateTime = string

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
}
```

Project 狀態為 `Pending | Active | Completed | Archived`；Task 狀態為 `Pending | InProgress | Blocked | Completed`，四種 Task 狀態允許任意互轉。

## Current User 與權限

`GET /auth/me` 回傳帳號、姓名、唯一系統角色、Email 驗證／啟用狀態與 `functions: string[]`。前端 route、Sidebar 與按鈕顯示依 functions 與專案角色判斷；Backend 仍是唯一安全授權邊界。

Users 管理 route 至少需要 `accounts.read`。角色與啟用狀態使用單一 request：

```ts
export interface UpdateAdministrationRequest {
  roleId: Guid
  isEnabled: boolean
}
```

Backend 在同一 Serializable transaction 驗證 Email、最後一位有效 Admin、角色有效性，成功只遞增一次 token version、撤銷 Refresh Tokens 並寫入 audit。

## Project

```ts
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
```

- Create request 不包含 `code`；response 的唯讀 code 格式為 `PRJ-YYYYMMDD######`。
- 日期使用 UTC，Project 流水號每日獨立從 `000001` 起算。
- 列表／詳情顯示 code；route 與 API 使用 GUID。
- `timeZoneId` 必填且必須是合法 IANA timezone ID；前端不得省略或自行假設伺服器時區。
- Owner 必須是已啟用、Email 已驗證且系統角色恰為 `Administrator` 的帳號；修改 Owner 時還必須已是該 Project member。
- Owner 必須具有 `ProjectManager`；移交時 Backend 在同一交易補上角色，舊 Owner 原角色不移除。
- Project member 具有 `roles: ProjectRole[]`，新增與更新都傳送 `projectRoleIds: Guid[]`。
- member-candidate 分頁只揭露 `accountId`、`account`、`name`，且只能由可管理該專案者呼叫。
- Project 軟刪除使用 `DELETE /projects/{id}?rowVersion=...`，只允許 `Administrator` 與 `Admin`；成功後保留關聯資料，但一般 Project scope 不再顯示。

## Task

```ts
export interface CreateTaskRequest {
  title: string
  description: string | null
  assignedAccountId: Guid
  startAt: IsoDateTime
  deadline: IsoDateTime
}

export interface BatchTaskVersion {
  taskId: Guid
  rowVersion: RowVersion
}
```

- Create request 不包含 `code`；response 的唯讀 code 格式為 `TASK-YYYYMMDD######`。
- 日期使用 UTC，Task 流水號每日獨立從 `000001` 起算，與 Project 計數器互不影響。
- 一般被指派者只呼叫 status-and-deadline PATCH；管理者使用完整 PUT。
- 指派候選人與名稱顯示來自 Project members，不呼叫一般使用者可能無權存取的 Users API。
- batch-status 必須傳每筆 Task ID 與目前 rowVersion。
- 更新與刪除一律包含 projectId、taskId 與 rowVersion。

## Comment

Comment create／list 使用 projectId 與 taskId；update／delete 另外使用 commentId。修改與刪除都必須傳送目前 Base64 rowVersion，409 時前端保留內容並提示重新載入。

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

前端必須保留 401、403、404、409、422 的不同語意。每日業務編號超過 `999999` 時，409 的穩定錯誤碼為 `daily_code_limit_exceeded`。

## Email 驗證

驗證頁從信件連結取得 `accountId` 與 `token` 後呼叫 confirm API，不可只用帳號模擬驗證。重寄可傳帳號或 Email。實際 SMTP 寄送是否成功屬外部服務驗證，不影響前端 token 與確認 API 的契約。
