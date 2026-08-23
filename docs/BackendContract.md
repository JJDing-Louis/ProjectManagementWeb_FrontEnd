# ProjectManagementWeb Backend Contract

## 目的與狀態

本文件定義前端 V1 串接 Backend API 所需的資料與行為邊界。內容以目前 TypeScript models、service interfaces 與 Mock 行為為基準；Backend 尚未實作或確認的部分均列在「待確認事項」，不可將本文視為已發布的 OpenAPI 規格。

## Domain Enums

### SystemRole

```text
Admin | Administrator | User | Viewer
```

### ProjectRole

```text
ProjectManager | FrontendDeveloper | BackendDeveloper | SystemAnalyst | Member
```

### TaskStatus

```text
Pending | InProgress | Blocked | Completed
```

Enum 在 JSON 中使用上列精確字串，大小寫不可任意改變。未知值應視為 contract error，不應由前端靜默 mapping。

## Response Models

### User

```json
{
  "id": "u-user",
  "account": "user",
  "displayName": "Lisa Chen",
  "email": "user@example.com",
  "role": "User",
  "isVerified": true,
  "isEnabled": true,
  "createdAt": "2026-08-23T08:00:00.000Z"
}
```

Password、password hash、verification token、session identifier 不得出現在 User response。

### Project

```json
{
  "id": "PRJ-1001",
  "name": "Customer Portal",
  "description": "Customer self-service portal",
  "ownerId": "u-administrator",
  "status": "Active",
  "createdAt": "2026-07-01T08:00:00.000Z",
  "updatedAt": "2026-08-23T08:00:00.000Z",
  "version": 1,
  "members": [
    {
      "userId": "u-user",
      "projectRole": "FrontendDeveloper"
    }
  ]
}
```

Project status 目前只有 `Active`、`Archived`。

### TaskItem

```json
{
  "id": "TASK-101",
  "projectId": "PRJ-1001",
  "title": "Create sign-in page",
  "description": "Complete validation and RWD",
  "creatorId": "u-administrator",
  "assigneeId": "u-user",
  "startAt": "2026-08-20T01:00:00.000Z",
  "deadline": "2026-08-28T09:00:00.000Z",
  "status": "InProgress",
  "createdAt": "2026-08-18T01:00:00.000Z",
  "updatedAt": "2026-08-23T08:00:00.000Z",
  "version": 1,
  "deletedAt": null
}
```

一般查詢不得回傳已軟刪除 Task。若管理或稽核 endpoint 需要回傳，必須使用獨立權限與明確 query，不能改變一般列表語意。

### TaskComment

```json
{
  "id": "comment-1",
  "taskId": "TASK-101",
  "authorId": "u-user",
  "content": "Desktop layout is ready.",
  "createdAt": "2026-08-22T02:00:00.000Z",
  "updatedAt": "2026-08-22T02:00:00.000Z",
  "deletedAt": null
}
```

### UserPreference

```json
{
  "userId": "u-user",
  "skipBatchConfirmation": false
}
```

## Request Models

### SignInRequest

```json
{
  "account": "user",
  "password": "user supplied password"
}
```

登入失敗統一回傳一般性訊息，不得透露帳號不存在、密碼錯誤或帳號停用的個別原因。

### RegisterRequest

```json
{
  "account": "new-user",
  "displayName": "New User",
  "password": "user supplied password",
  "email": "new-user@example.com"
}
```

建立後固定為：

- `role = Viewer`
- `isVerified = false`
- `isEnabled = true`

完成 Email 驗證後仍是 Viewer，必須由 Admin 才能調整系統角色。

### UpdateUserRequest

```json
{
  "role": "Administrator",
  "isEnabled": true
}
```

### ProjectInput

```json
{
  "name": "Customer Portal",
  "description": "Customer self-service portal",
  "ownerId": "u-administrator",
  "status": "Active",
  "version": 1
}
```

建立時不傳 `version`；更新時 `version` 必填。

### ProjectMemberRequest

```json
{
  "userId": "u-user",
  "projectRole": "FrontendDeveloper"
}
```

修改既有成員角色時，request 可以只傳 `projectRole`。

### TaskInput

```json
{
  "title": "Create sign-in page",
  "description": "Complete validation and RWD",
  "assigneeId": "u-user",
  "startAt": "2026-08-20T01:00:00.000Z",
  "deadline": "2026-08-28T09:00:00.000Z",
  "status": "InProgress",
  "version": 1
}
```

建立時不傳 `version`，且後端忽略 request 的 `status` 或要求為 `Pending`；實際建立結果固定為 `Pending`。更新時 `version` 必填。

### BatchStatusRequest

```json
{
  "ids": ["TASK-101", "TASK-102"],
  "status": "Completed"
}
```

後端必須在單一 transaction 中完成：

1. 驗證所有 Task 存在且未刪除。
2. 驗證呼叫者對每一筆都有修改權限。
3. 驗證所有狀態轉換有效。
4. 全部通過才更新；任一失敗則不更新任何資料。

### CommentRequest

```json
{
  "content": "Comment content between 1 and 2000 characters."
}
```

### PreferenceRequest

```json
{
  "skipBatchConfirmation": true
}
```

## Pagination Contract

### Request

```text
?page=1&pageSize=20
```

### Response

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0
}
```

`items` 依 endpoint 分別為 `Project[]` 或 `TaskItem[]`。Backend 必須限制最大 `pageSize`，實際上限待確認。

### Project Query

| Query      | Type                 | 說明                       |
| ---------- | -------------------- | -------------------------- |
| `search`   | string               | 比對 ID、Name、Description |
| `status`   | `Active`／`Archived` | 空值表示全部               |
| `page`     | positive integer     | 預設 1                     |
| `pageSize` | positive integer     | 前後端需確認預設與上限     |

### Task Query

| Query        | Type               | 說明                          |
| ------------ | ------------------ | ----------------------------- |
| `search`     | string             | 比對 ID、Title、Description   |
| `status`     | TaskStatus         | 空值表示全部                  |
| `assigneeId` | string             | 指派者篩選                    |
| `mineOnly`   | boolean            | 只回傳目前使用者被指派的 Task |
| `sort`       | `newest`／`oldest` | 依建立時間排序                |
| `page`       | positive integer   | 預設 1                        |
| `pageSize`   | positive integer   | 前後端需確認預設與上限        |

## Error Contract

目前前端 `ApiError` 需要 `status`、`message` 與 `fieldErrors`。建議 Backend 統一回傳：

```json
{
  "status": 422,
  "title": "Validation failed",
  "message": "One or more fields are invalid.",
  "fieldErrors": {
    "deadline": "Deadline must be after startAt."
  },
  "traceId": "00-example-trace-id"
}
```

規則：

- `fieldErrors` 沒有欄位錯誤時回傳空物件 `{}`，不要在 object／array／null 之間變動。
- `message` 可提供使用者可理解的摘要，但不得包含 stack trace、SQL 或機密資訊。
- `traceId` 供前後端 log correlation；前端可顯示或記錄，但不應取代錯誤訊息。
- 401、403、404、409、422 必須保有不同語意，前端才能正確顯示登入、權限、找不到、衝突或欄位錯誤。

## Authorization Contract

| 操作                         | Viewer | User | Administrator | Admin |
| ---------------------------- | ------ | ---- | ------------- | ----- |
| 查看可存取的專案／Task       | 是     | 是   | 是            | 是    |
| 查看公司名錄                 | 是     | 是   | 是            | 是    |
| 修改系統角色／帳號狀態       | 否     | 否   | 否            | 是    |
| 建立 Project／Task           | 否     | 否   | 是            | 是    |
| 修改完整 Task 欄位           | 否     | 否   | 是            | 是    |
| 修改被指派 Task 的狀態／期限 | 否     | 是   | 是            | 是    |
| 新增留言                     | 否     | 是   | 是            | 是    |
| 修改／刪除自己的留言         | 否     | 是   | 是            | 是    |

Project Owner 與 `ProjectManager` 另外具有該 Project 的專案資料及成員管理能力。前端 route guard 和按鈕顯示只改善 UX，Backend 必須逐次驗證。

## Concurrency Contract

- Project 與 Task response 都包含整數 `version`。
- 更新 request 必須帶入使用者讀取時的 `version`。
- 更新條件必須包含 ID 與 version；受影響筆數為 0 時回傳 `409 Conflict`。
- 成功後 response 回傳增加後的新 version 與完整最新資料。
- 前端遇到 409 保留輸入，提示資料已變更並讓使用者重新載入。

## Authentication and Security Boundary

下列項目尚未由 Backend 決定：

- HttpOnly Cookie Session 或 Bearer Access Token。
- Refresh Token 旋轉、撤銷及多裝置登入策略。
- Cookie 模式下的 SameSite、Secure、Domain 與 CSRF Token。
- CORS allowlist、timeout、rate limit 與登入鎖定策略。

不論採用何種方式，前端不應把長效 Token 或秘密放在 localStorage。正式 Production build 也不得包含 Mock 帳號、預設密碼或資料重設功能。

## 待確認事項

1. `displayName` 在既有 Database Schema 中缺少對應欄位。
2. User Story 與既有流程圖的 Email 驗證規則曾有衝突；本前端採「未驗證可用 Viewer 登入，驗證後仍為 Viewer」。Backend 必須確認採用相同規則。
3. Account、Project、Task、Comment ID 的正式格式與產生端。
4. Task 狀態允許的轉換矩陣。
5. 正式 endpoint path、API version 與 OpenAPI schema。
6. 日期時間採 UTC 儲存或其他產品時區規則。
7. 公司名錄中 Email 對所有登入者可見是否符合個資政策。
8. 稽核欄位、操作紀錄與軟刪除資料的管理查詢需求。
