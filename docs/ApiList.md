# ProjectManagementWeb API 清單

本文件描述前端目前實際呼叫的 ASP.NET Core API。Base URL 由 `VITE_API_BASE_URL` 設定，HTTP client 統一加上 `/api/v1`。完整 request／response 欄位以後端 `docs/FrontendContract.md` 與 OpenAPI 為準。

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

## Auth 與 Security

| Method | Route                  | 用途                                     |
| ------ | ---------------------- | ---------------------------------------- |
| GET    | `/security/csrf-token` | 取得 CSRF request token                  |
| POST   | `/auth/register`       | 註冊未驗證 Viewer                        |
| POST   | `/auth/login`          | 登入並取得 Access Token／Refresh Cookie  |
| POST   | `/auth/refresh`        | 輪替 Refresh Token 並取得新 Access Token |
| POST   | `/auth/logout`         | 撤銷 Refresh Token 並清除 Cookie         |
| GET    | `/auth/me`             | 取得目前帳號、系統角色與 functions       |
| POST   | `/auth/email/confirm`  | 使用 `accountId`、`token` 驗證 Email     |
| POST   | `/auth/email/resend`   | 依帳號或 Email 重寄驗證信                |

頁面重新整理時，前端先 refresh，再呼叫 `/auth/me`。多個 401 只會共用一個 refresh；原請求最多重送一次，refresh 失敗即登出。

## Users、Roles 與 Preferences

| Method | Route                        | 用途                                          |
| ------ | ---------------------------- | --------------------------------------------- |
| GET    | `/users`                     | 搜尋、角色篩選與分頁；需要 `accounts.read`    |
| GET    | `/users/{id}`                | 查詢帳號；本人或具 `accounts.read`            |
| PUT    | `/users/{id}/administration` | 以 `{ roleId, isEnabled }` 原子更新角色與狀態 |
| GET    | `/roles`                     | 載入系統角色 ID 與 functions                  |
| GET    | `/users/me/preferences`      | 讀取自己的偏好                                |
| PUT    | `/users/me/preferences`      | 更新自己的偏好                                |

帳號管理頁只允許具有 `accounts.read` 的帳號進入；修改操作仍依 `accounts.manage-role` 與 `accounts.manage-status` 控制。前端不顯示後端未提供的帳號建立時間。

## Projects 與 Members

| Method | Route                                | 用途                                        |
| ------ | ------------------------------------ | ------------------------------------------- |
| GET    | `/projects`                          | 搜尋、狀態篩選與分頁，只回傳可查看的專案    |
| POST   | `/projects`                          | 建立專案；request 不含 Code                 |
| GET    | `/projects/{id}`                     | 查詢專案詳情                                |
| PUT    | `/projects/{id}`                     | 更新專案、Owner、四種狀態與 `rowVersion`    |
| DELETE | `/projects/{id}?rowVersion=...`      | `Administrator`／`Admin` 軟刪除專案         |
| GET    | `/projects/roles`                    | 載入專案角色 ID                             |
| GET    | `/projects/{id}/members`             | 載入含多重 roles 的專案成員                 |
| GET    | `/projects/{id}/member-candidates`   | 管理者搜尋可加入成員；僅回傳 ID、帳號及姓名 |
| POST   | `/projects/{id}/members`             | 加入成員與多重 `projectRoleIds`             |
| PUT    | `/projects/{id}/members/{accountId}` | 完整取代成員角色集合                        |
| DELETE | `/projects/{id}/members/{accountId}` | 移除非 Owner 且無未完成 Task 的成員         |

列表與詳情以 `code` 顯示業務編號，但 API 與 Vue route 一律使用 GUID。建立與修改必須傳送合法 IANA `timeZoneId`；Owner 必須是已啟用、Email 已驗證的 `Administrator`，修改 Owner 時還必須已是 Project member。Owner 移交後，新 Owner 由後端保證具有 `ProjectManager`。Project 軟刪除成功後保留成員、Task、留言與歷史資料，但一般 Project scope 不再顯示。

## Task Items

| Method | Route                                                           | 用途                                                          |
| ------ | --------------------------------------------------------------- | ------------------------------------------------------------- |
| GET    | `/projects/{projectId}/task-items`                              | 搜尋、篩選、排序與分頁                                        |
| POST   | `/projects/{projectId}/task-items`                              | 建立 Task；request 不含 Code                                  |
| GET    | `/projects/{projectId}/task-items/{taskId}`                     | 查詢 Task 詳情                                                |
| PUT    | `/projects/{projectId}/task-items/{taskId}`                     | 管理者完整更新與 `rowVersion`                                 |
| PATCH  | `/projects/{projectId}/task-items/{taskId}/status-and-deadline` | 被指派者更新狀態、期限與 `rowVersion`                         |
| PATCH  | `/projects/{projectId}/task-items/batch-status`                 | 傳送每筆 Task ID、`rowVersion` 與目標狀態，單一交易全有或全無 |
| DELETE | `/projects/{projectId}/task-items/{taskId}?rowVersion=...`      | 軟刪除 Task                                                   |

Task 四種狀態可任意切換，但後端仍驗證權限、指派關係、專案範圍與版本。指派選項與名稱只使用專案成員資料，不依賴全域 Users API。

## Comments

| Method | Route                                                                           | 用途                        |
| ------ | ------------------------------------------------------------------------------- | --------------------------- |
| GET    | `/projects/{projectId}/task-items/{taskId}/comments`                            | 讀取留言                    |
| POST   | `/projects/{projectId}/task-items/{taskId}/comments`                            | 新增留言                    |
| PUT    | `/projects/{projectId}/task-items/{taskId}/comments/{commentId}`                | 作者更新內容與 `rowVersion` |
| DELETE | `/projects/{projectId}/task-items/{taskId}/comments/{commentId}?rowVersion=...` | 作者軟刪除留言              |

## HTTP 狀態處理

|             Status | 前端行為                          |
| -----------------: | --------------------------------- |
|                400 | 顯示格式或 CSRF 錯誤              |
|                401 | single-flight refresh；失敗則登出 |
|                403 | 顯示權限不足或導向 Forbidden      |
|                404 | 顯示資源不存在                    |
|                409 | 保留輸入並提示版本或業務衝突      |
|                422 | 對應欄位／業務驗證訊息            |
| 5xx／網路／timeout | 顯示可重試的一般錯誤              |
