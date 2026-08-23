# ProjectManagementWeb API 清單

## 文件狀態

本文件依目前前端程式碼整理，對應來源為：

- `src/services/contracts.ts`：前端使用的 service interfaces。
- `src/types/models.ts`：前端 domain models、輸入型別與錯誤型別。
- `src/services/mockServices.ts`：目前已可執行的 Mock 行為與權限規則。

目前專案尚未串接 Backend API。下表的 REST endpoint 是為了讓後端與前端對接而提出的**建議契約**，不是已上線或已實作的後端路由。實際 base URL、驗證方式、endpoint 命名與 OpenAPI 文件仍待後端確認。

## 共通約定

| 項目           | 約定                                                           |
| -------------- | -------------------------------------------------------------- |
| 建議 Base Path | `/api`                                                         |
| Content Type   | `application/json`                                             |
| 日期時間       | ISO 8601 字串，必須包含時區或 `Z`                              |
| 分頁           | `page` 從 1 開始，`pageSize` 為每頁筆數                        |
| 驗證           | Transport 待後端確認；前端不得假設 localStorage token          |
| 授權           | 後端必須重新驗證角色、專案成員關係與資源範圍                   |
| 版本衝突       | 更新 Project／Task 時傳送 `version`；不一致回傳 `409 Conflict` |
| 軟刪除         | Task DELETE 只做軟刪除，留言與稽核資料仍保留                   |

## Auth API

| 前端方法                      | 建議 HTTP API                        | 說明                                        | 權限   |
| ----------------------------- | ------------------------------------ | ------------------------------------------- | ------ |
| `currentUser()`               | `GET /api/auth/me`                   | 取得目前登入使用者；無有效 Session 回傳 401 | 已登入 |
| `signIn(account, password)`   | `POST /api/auth/sign-in`             | 登入；錯誤訊息不得透露帳號是否存在          | 公開   |
| `signUp(input)`               | `POST /api/auth/sign-up`             | 建立未驗證的 Viewer 帳號                    | 公開   |
| `signOut()`                   | `POST /api/auth/sign-out`            | 使目前 Session／Refresh Token 失效          | 已登入 |
| `verifyEmail(account)`        | `POST /api/auth/verify-email`        | 正式 API 應傳驗證 Token，不應只傳 account   | 公開   |
| `resendVerification(account)` | `POST /api/auth/resend-verification` | 重新寄送驗證信；正式環境需 rate limit       | 公開   |

## User API

| 前端方法                      | 建議 HTTP API                   | 說明                                                  | 權限   |
| ----------------------------- | ------------------------------- | ----------------------------------------------------- | ------ |
| `list(search?)`               | `GET /api/users?search={value}` | 公司名錄搜尋；比對 Account、Display Name、Email、Role | 已登入 |
| `get(id)`                     | `GET /api/users/{userId}`       | 取得使用者資料                                        | 已登入 |
| `update(id, role, isEnabled)` | `PATCH /api/users/{userId}`     | 修改系統角色與帳號啟用狀態                            | Admin  |

User 更新必須遵守：

- 未完成 Email 驗證的帳號只能維持 `Viewer`。
- 不得停用、降級或移除最後一位啟用中的 `Admin`。
- 非 Admin 只能讀取名錄，不得透過直接呼叫 API 修改角色。

## Project API

| 前端方法                                | 建議 HTTP API                                       | 說明                                           | 權限                 |
| --------------------------------------- | --------------------------------------------------- | ---------------------------------------------- | -------------------- |
| `list(query)`                           | `GET /api/projects`                                 | 搜尋、狀態篩選與分頁；只回傳呼叫者可查看的專案 | 已登入               |
| `listAccessible()`                      | `GET /api/projects/navigation`                      | Sidebar 使用的精簡專案清單                     | 已登入               |
| `get(id)`                               | `GET /api/projects/{projectId}`                     | 專案詳情與成員                                 | 可查看該專案         |
| `create(input)`                         | `POST /api/projects`                                | 建立專案；Owner 必須是啟用中的使用者           | Admin、Administrator |
| `update(id, input)`                     | `PUT /api/projects/{projectId}`                     | 修改名稱、說明、Owner、狀態與版本              | 可管理該專案         |
| `addMember(projectId, userId, role)`    | `POST /api/projects/{projectId}/members`            | 加入啟用中的非重複成員                         | 可管理該專案         |
| `updateMember(projectId, userId, role)` | `PATCH /api/projects/{projectId}/members/{userId}`  | 修改專案角色                                   | 可管理該專案         |
| `removeMember(projectId, userId)`       | `DELETE /api/projects/{projectId}/members/{userId}` | 移除成員                                       | 可管理該專案         |

「可管理該專案」目前定義為下列任一條件：

- 系統角色是 `Admin` 或 `Administrator`。
- 使用者是 Project Owner。
- 使用者在該專案的角色是 `ProjectManager`。

移除成員前，後端必須拒絕下列情況：

- 目標使用者仍是 Project Owner，尚未完成 Owner 移交。
- 目標使用者仍被指派未完成且未刪除的 Task。

## Task Item API

| 前端方法                   | 建議 HTTP API                               | 說明                                     | 權限                 |
| -------------------------- | ------------------------------------------- | ---------------------------------------- | -------------------- |
| `list(projectId, query)`   | `GET /api/projects/{projectId}/task-items`  | 搜尋、狀態、指派者、只看本人、排序及分頁 | 可查看該專案         |
| `get(id)`                  | `GET /api/task-items/{taskId}`              | 取得未刪除的 Task 詳情                   | 可查看所屬專案       |
| `create(projectId, input)` | `POST /api/projects/{projectId}/task-items` | 建立 Task，初始狀態固定為 `Pending`      | Admin、Administrator |
| `update(id, input)`        | `PUT /api/task-items/{taskId}`              | 修改 Task，必須包含 `version`            | 依欄位及指派關係判斷 |
| `remove(id)`               | `DELETE /api/task-items/{taskId}`           | 軟刪除 Task                              | Admin、Administrator |
| `batchUpdate(ids, status)` | `PATCH /api/task-items/batch-status`        | 批次更新狀態，必須以單一交易全有或全無   | 每筆皆有修改權限     |

Task 更新規則：

- `Admin`、`Administrator` 可以修改完整可編輯欄位。
- 被指派的 `User` 只能修改狀態與交付期限。
- `Viewer` 不得修改 Task。
- 指派對象必須是該專案有效成員。
- `startAt` 不得晚於 `deadline`。
- 批次更新任一 Task 驗證失敗時，全部資料都不得更新。

## Comment API

| 前端方法                            | 建議 HTTP API                            | 說明               | 權限                 |
| ----------------------------------- | ---------------------------------------- | ------------------ | -------------------- |
| `listComments(taskId)`              | `GET /api/task-items/{taskId}/comments`  | 取得未刪除留言     | 可查看該 Task        |
| `addComment(taskId, content)`       | `POST /api/task-items/{taskId}/comments` | 新增 1–2000 字留言 | 非 Viewer 的專案成員 |
| `updateComment(commentId, content)` | `PUT /api/comments/{commentId}`          | 修改自己的留言     | 留言作者             |
| `removeComment(commentId)`          | `DELETE /api/comments/{commentId}`       | 軟刪除自己的留言   | 留言作者             |

## Preference API

| 前端方法                        | 建議 HTTP API                     | 說明                     | 權限   |
| ------------------------------- | --------------------------------- | ------------------------ | ------ |
| `get()`                         | `GET /api/users/me/preferences`   | 取得目前使用者偏好       | 已登入 |
| `update(skipBatchConfirmation)` | `PATCH /api/users/me/preferences` | 更新是否略過批次確認視窗 | 已登入 |

## 不屬於正式 API 的功能

`AppServices.reset()` 只用於目前瀏覽器版 Mock demo，會重設 localStorage 與 sessionStorage。正式後端不得提供對應的 production endpoint。

## HTTP 狀態碼

| Status                      | 前端處理語意                                             |
| --------------------------- | -------------------------------------------------------- |
| `200 OK`                    | 查詢或更新成功                                           |
| `201 Created`               | Project、Task、Comment 或 User 建立成功                  |
| `204 No Content`            | 登出、軟刪除等無 Response Body 的成功操作                |
| `400 Bad Request`           | Request 格式錯誤                                         |
| `401 Unauthorized`          | 未登入或 Session 過期                                    |
| `403 Forbidden`             | 已登入但沒有資源或操作權限                               |
| `404 Not Found`             | 資源不存在，或依安全策略不揭露資源存在性                 |
| `409 Conflict`              | 版本衝突、重複成員、最後一位 Admin、Owner／Task 指派阻擋 |
| `422 Unprocessable Content` | 欄位或業務驗證失敗                                       |
| `429 Too Many Requests`     | 登入或重寄驗證信超過限制                                 |
| `500 Internal Server Error` | 未預期後端錯誤                                           |

## 待後端確認

- 正式 API base URL、版本策略及 OpenAPI 文件位置。
- Cookie Session、JWT 或其他驗證傳輸方式，以及 CSRF 處理方式。
- Email 驗證 Token 的 request shape、有效時間與重寄限制。
- Project／Task 的正式 ID 格式與可接受的狀態轉換。
- `displayName` 尚未出現在既有 Database Schema，後端須補充欄位或提供替代 mapping。
- 分頁回應是否需要 `totalPages`、排序欄位白名單及最大 `pageSize`。
