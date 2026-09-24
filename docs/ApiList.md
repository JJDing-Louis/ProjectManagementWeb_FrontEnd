# ProjectManagementWeb API 清單

本文件依 `src/services/httpServices.ts` 與 `src/services/httpClient.ts` 整理，描述前端目前實際呼叫的 38 組 HTTP Method／Route。Base origin 由 `VITE_API_BASE_URL` 設定，HTTP client 統一加上 `/api/v1`；完整資料結構請參閱 [BackendContract.md](BackendContract.md)。

本清單只收錄 Vue SPA 已使用的 Backend API。Backend 另有平台端點及相容用管理端點時，不代表前端已呼叫。

## 共通約定

| 項目          | 契約                                                                           |
| ------------- | ------------------------------------------------------------------------------ |
| Content Type  | `application/json`                                                             |
| Access Token  | 僅保存在記憶體，以 Bearer header 傳送                                          |
| Refresh Token | `PMW-REFRESH` HttpOnly Cookie，request 使用 `credentials: include`             |
| CSRF          | Auth POST 先呼叫 `/security/csrf-token`，再附加 `X-CSRF-TOKEN`                 |
| 日期時間      | ISO 8601 字串                                                                  |
| 分頁          | `page` 從 1 開始，回應使用 `items`、`page`、`pageSize`、`totalCount`           |
| 並行控制      | Project、Task、Comment 使用 Base64 `rowVersion`；衝突回傳 409                  |
| 業務編號      | Code 由後端依 UTC 日期產生，格式為 `PRJ-YYYYMMDD######`／`TASK-YYYYMMDD######` |
| 錯誤          | RFC 7807 Problem Details，前端正規化為 `ApiError`                              |
| Timeout       | 每個 request 15 秒；timeout 或無法連線時前端使用 `status=0`                    |

## Auth 與 Security

| Method | Route                  | 前端呼叫                           | Request／Success                                       |
| ------ | ---------------------- | ---------------------------------- | ------------------------------------------------------ |
| GET    | `/security/csrf-token` | `loadCsrfToken()`                  | 200 `{ token }`，並建立 antiforgery cookie             |
| POST   | `/auth/register`       | `auth.signUp()`                    | `RegisterRequest`；201 `RegisterResponse`              |
| POST   | `/auth/login`          | `auth.signIn()`                    | `LoginRequest`；200 access token 並設定 refresh cookie |
| POST   | `/auth/refresh`        | `auth.restore()`／401 自動 refresh | Refresh Cookie；200 access token 並輪替 cookie         |
| POST   | `/auth/logout`         | `auth.signOut()`                   | Refresh Cookie；204                                    |
| GET    | `/auth/me`             | `auth.currentUser()`               | 200 `CurrentAccountResponse`                           |
| POST   | `/auth/email/confirm`  | `auth.verifyEmail()`               | `{ accountId, token }`；200 `true`                     |
| POST   | `/auth/email/resend`   | `auth.resendVerification()`        | `{ accountOrEmail }`；200 `true`                       |

頁面重新整理時，前端先 refresh，再呼叫 `/auth/me`。多個 401 共用同一個 refresh Promise；原請求最多重送一次，refresh 回傳 400／401 時清除 Access Token。

## Users、Roles 與 Preferences

| Method | Route                        | 前端呼叫                       | Query／Body                          | Success                     |
| ------ | ---------------------------- | ------------------------------ | ------------------------------------ | --------------------------- |
| GET    | `/users`                     | `users.list()`／`listAll()`    | `search`、`role`、`page`、`pageSize` | `PagedResult<UserResponse>` |
| GET    | `/users/{id}`                | `users.get()`                  | path `id`                            | `UserDetailResponse`        |
| PUT    | `/users/{id}/administration` | `users.updateAdministration()` | `{ roleId, isEnabled }`              | `UserResponse`              |
| GET    | `/roles`                     | `users.roles()`                | 無                                   | `RoleResponse[]`            |
| GET    | `/users/me/profile`          | `profile.get()`                | 無                                   | `OwnProfileResponse`        |
| PUT    | `/users/me/profile`          | `profile.update()`             | `{ name, phoneNumber }`              | `OwnProfileResponse`        |
| GET    | `/users/me/preferences`      | `preferences.get()`            | 無                                   | `PreferenceResponse`        |
| PUT    | `/users/me/preferences`      | `preferences.update()`         | `{ skipBatchConfirmation }`          | `PreferenceResponse`        |

帳號管理頁只允許具有 `accounts.read` 的帳號進入；修改操作仍同時依賴 `accounts.manage-role` 與 `accounts.manage-status`。Users 清單及成員候選人會排除 `isBootstrapAdmin=true` 的系統預設 Admin，Backend 也拒絕修改該帳號。

本人 Profile 的 `name` 必填且最多 100 字元；`phoneNumber` 可為 `null`，非空時最多 30 字元並須通過後端電話格式驗證。電話變更會由 Backend 清除既有電話確認狀態。

## Projects 與 Members

| Method | Route                                | 前端呼叫                              | Query／Body                                           | Success                                |
| ------ | ------------------------------------ | ------------------------------------- | ----------------------------------------------------- | -------------------------------------- |
| GET    | `/projects`                          | `projects.list()`／`listAccessible()` | `search`、`status`、`page`、`pageSize`                | `PagedResult<ProjectResponse>`         |
| POST   | `/projects`                          | `projects.create()`                   | `name`、`description`、`ownerAccountId`、`timeZoneId` | 201 `ProjectResponse`                  |
| GET    | `/projects/{id}`                     | `projects.get()`                      | path `id`                                             | `ProjectResponse`                      |
| PUT    | `/projects/{id}`                     | `projects.update()`                   | Project 欄位、`status`、`rowVersion`                  | `ProjectResponse`                      |
| DELETE | `/projects/{id}?rowVersion=...`      | `projects.remove()`                   | query `rowVersion`                                    | 204                                    |
| GET    | `/projects/roles`                    | `projects.roles()`                    | 無                                                    | `ProjectRoleResponse[]`                |
| GET    | `/projects/{id}/members`             | `projects.get()`                      | path `id`                                             | `ProjectMemberResponse[]`              |
| GET    | `/projects/{id}/member-candidates`   | `projects.memberCandidates()`         | `search`、`page`、`pageSize`                          | `PagedResult<MemberCandidateResponse>` |
| POST   | `/projects/{id}/members`             | `projects.addMember()`                | `{ accountId, projectRoleIds }`                       | `ProjectMemberResponse`                |
| PUT    | `/projects/{id}/members/{accountId}` | `projects.updateMember()`             | `{ projectRoleIds }`                                  | `ProjectMemberResponse`                |
| DELETE | `/projects/{id}/members/{accountId}` | `projects.removeMember()`             | path `id`、`accountId`                                | 204                                    |

`projects.get()` 會平行呼叫 Project detail 與 members，再由 adapter 組成前端 `Project` model。`listAccessible()` 與候選人載入會重複讀取每頁，直到取得 `totalCount`。

列表與詳情以 `code` 顯示業務編號，但 API 與 Vue route 一律使用 GUID。建立與修改必須傳送合法 IANA `timeZoneId`；Owner 必須是已啟用、Email 已驗證的 `Administrator`，修改 Owner 時還必須已是 Project member。Owner 移交後，新 Owner 由後端保證具有 `ProjectManager`。Project 軟刪除成功後保留成員、Task、留言與歷史資料，但一般 Project scope 不再顯示。

## Task Items

| Method | Route                                                           | 前端呼叫                 | Query／Body                                                     | Success                     |
| ------ | --------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------- | --------------------------- |
| GET    | `/projects/{projectId}/task-items`                              | `tasks.list()`           | `search`、`status`、`assignedAccountId`、`onlyMine`、排序與分頁 | `PagedResult<TaskResponse>` |
| POST   | `/projects/{projectId}/task-items`                              | `tasks.create()`         | title、description、assignedAccountId、startAt、deadline        | 201 `TaskResponse`          |
| GET    | `/projects/{projectId}/task-items/{taskId}`                     | `tasks.get()`            | path projectId、taskId                                          | `TaskResponse`              |
| PUT    | `/projects/{projectId}/task-items/{taskId}`                     | `tasks.update()`         | 完整 Task 欄位、status、rowVersion                              | `TaskResponse`              |
| PATCH  | `/projects/{projectId}/task-items/{taskId}/status-and-deadline` | `tasks.updateAssigned()` | `{ status, deadline, rowVersion }`                              | `TaskResponse`              |
| PATCH  | `/projects/{projectId}/task-items/batch-status`                 | `tasks.batchUpdate()`    | `{ tasks: [{ taskId, rowVersion }], targetStatus }`             | `{ updatedCount }`          |
| DELETE | `/projects/{projectId}/task-items/{taskId}?rowVersion=...`      | `tasks.remove()`         | query `rowVersion`                                              | 204                         |

目前 UI 將 newest／oldest 映射為 `sortBy=createdAt` 與 `sortDirection=desc|asc`；Backend 雖支援其他排序欄位，前端尚未提供選項。Task 四種狀態可任意切換，但後端仍驗證權限、指派關係、專案範圍與版本。指派選項與名稱只使用專案成員資料，不依賴全域 Users API。

## Comments

| Method | Route                                                                           | 前端呼叫                | Request／Success                             |
| ------ | ------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------- |
| GET    | `/projects/{projectId}/task-items/{taskId}/comments`                            | `tasks.listComments()`  | 200 `CommentResponse[]`                      |
| POST   | `/projects/{projectId}/task-items/{taskId}/comments`                            | `tasks.addComment()`    | `{ content }`；200 `CommentResponse`         |
| PUT    | `/projects/{projectId}/task-items/{taskId}/comments/{commentId}`                | `tasks.updateComment()` | `{ content, rowVersion }`；`CommentResponse` |
| DELETE | `/projects/{projectId}/task-items/{taskId}/comments/{commentId}?rowVersion=...` | `tasks.removeComment()` | query `rowVersion`；204                      |

留言內容 trim 後必須為 1–2000 字；修改與刪除只允許作者本人，並以 `rowVersion` 防止靜默覆寫。

## Backend 已提供但前端未呼叫

| Method | Route                      | 說明                                                   |
| ------ | -------------------------- | ------------------------------------------------------ |
| PUT    | `/users/{id}/role`         | 獨立更新角色；目前 UI 使用原子 administration endpoint |
| PATCH  | `/users/{id}/status`       | 獨立更新狀態；目前 UI 使用原子 administration endpoint |
| GET    | `/health`                  | Backend／Docker 健康檢查；隔離 E2E 腳本會直接使用      |
| GET    | `/openapi/v1.json`         | 開發或明確啟用時提供的 OpenAPI                         |
| GET    | `/swagger/v1/swagger.json` | Swashbuckle OpenAPI                                    |
| GET    | `/swagger`                 | Swagger UI                                             |

這些端點不計入前述 38 組 SPA API。`run-isolated-e2e.sh` 使用 `/health` 等待 Backend 就緒，但這不是瀏覽器應用程式的 service call。

## HTTP 狀態處理

| Status | 前端處理                                                           |
| -----: | ------------------------------------------------------------------ |
|      0 | request timeout、取消或無法連線；顯示一般連線錯誤                  |
|    400 | 顯示格式、model binding 或 CSRF 錯誤                               |
|    401 | 已授權 request 進行 single-flight refresh；失敗則清除 Access Token |
|    403 | 顯示權限不足；route guard 只處理已有 requiredFunction 的前端路由   |
|    404 | 顯示資源不存在                                                     |
|    409 | 保留輸入並提示版本或業務衝突                                       |
|    422 | 將 Problem Details `errors` 合併成欄位錯誤訊息                     |
|    429 | 顯示 Backend rate-limit 訊息，不自動重送登入或寄信 request         |
|    5xx | 顯示一般錯誤；可保留 `traceId` 供問題追蹤                          |
