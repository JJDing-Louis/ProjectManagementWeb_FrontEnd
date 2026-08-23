# ProjectManagementWeb 前端架構

## 架構狀態

目前是 Vue 3 SPA 的 V1 前端 MVP。畫面已透過 typed service interfaces 與資料來源隔離，但實際資料來源仍是 `MockServices` 與瀏覽器 Storage；Backend HTTP adapter 尚未建立。

## Level 3 Component Diagram

```mermaid
flowchart LR
    subgraph SPA[ProjectManagementWeb Vue 3 SPA]
        direction LR

        subgraph Presentation[Presentation Layer]
            AuthViews[Auth Views<br/>SignIn / SignUp / Verify]
            ProjectViews[Project Views<br/>List / Detail / Form]
            TaskViews[Task Views<br/>List / Detail / Form]
            UserViews[User Views<br/>List / Detail / Settings]
            Shell[AppShell / AppSidebar<br/>RWD Navigation]
            Router[Vue Router<br/>Route Guards]
            I18n[vue-i18n<br/>zh-TW / en]
        end

        subgraph ClientState[Client State]
            AuthStore[Pinia Auth Store]
            UiStore[Pinia UI Store]
        end

        subgraph ApplicationBoundary[Application Boundary]
            Contracts[Service Interfaces<br/>Auth / User / Project / Task / Preference]
            Models[Typed Models<br/>Inputs / Queries / ApiError]
        end

        subgraph Infrastructure[Infrastructure]
            MockAdapter[Mock Service Adapter<br/>Business Rules / Authorization]
            MockRepository[Mock Repository<br/>Schema Version v1]
            FutureHttp[Future HTTP Adapter<br/>Not Implemented]
        end
    end

    Session[(sessionStorage<br/>Mock Session)]
    Local[(localStorage<br/>Mock Data / Locale)]
    Backend[ASP.NET Core Web API<br/>Future]

    Shell --> Router
    Router --> AuthStore
    AuthViews --> AuthStore
    ProjectViews --> Contracts
    TaskViews --> Contracts
    UserViews --> Contracts
    Shell --> I18n
    AuthStore --> Contracts
    UiStore -. Toast / Drawer .-> Shell
    Contracts --> Models
    Contracts --> MockAdapter
    MockAdapter --> MockRepository
    MockRepository --> Session
    MockRepository --> Local
    Contracts -. Adapter replacement .-> FutureHttp
    FutureHttp -. JSON / HTTPS .-> Backend
```

## 元件責任

| 元件                 | 主要責任                                         | 不應負責                            |
| -------------------- | ------------------------------------------------ | ----------------------------------- |
| Views                | 組合畫面、讀取 route、觸發 service、顯示狀態     | 直接讀寫 localStorage、實作後端授權 |
| AppShell／AppSidebar | RWD 版型、專案樹、語言切換、Logout               | Project／Task 業務規則              |
| Vue Router           | 公開／登入路由、基本角色導向、lazy loading       | 作為安全授權邊界                    |
| Pinia Auth Store     | 目前使用者、Session restore、登入登出狀態        | 複製所有後端業務資料                |
| Pinia UI Store       | Sidebar 與 Toast 等全域 UI 狀態                  | 持久化 domain data                  |
| Service Interfaces   | 定義 View 可依賴的穩定操作介面                   | 洩漏 Mock 或 HTTP 實作細節          |
| Mock Service Adapter | 模擬授權、驗證、交易、軟刪除與版本衝突           | 被視為正式安全邊界                  |
| Mock Repository      | schema version、seed、Storage 序列化             | 在 View 中直接暴露 Storage API      |
| Future HTTP Adapter  | 將 service calls mapping 成 Backend HTTP request | 改變 Views 的呼叫方式               |

## 依賴方向

```text
View / Store
    ↓
Service Interface + Models
    ↓
Mock Adapter（目前）或 HTTP Adapter（未來）
    ↓
Browser Storage（目前）或 Backend API（未來）
```

View 與 Store 只能依賴 service interface。串接後端時，應新增 HTTP adapter 並在應用程式組裝點替換實作，不應讓 Vue component 直接散落 `fetch` 呼叫。

## 主要資料流程

### 登入與 Route Guard

```mermaid
sequenceDiagram
    actor User
    participant View as SignInView
    participant Store as AuthStore
    participant Service as AuthService
    participant Adapter as Mock or HTTP Adapter
    participant Router

    User->>View: 輸入 Account / Password
    View->>Store: signIn()
    Store->>Service: signIn(account, password)
    Service->>Adapter: 驗證並建立 Session
    Adapter-->>Store: User
    Store-->>View: 更新登入狀態
    View->>Router: 前往原目標或 /projects
    Router->>Store: 檢查登入與 route meta
```

### Task 批次更新

```mermaid
sequenceDiagram
    actor User
    participant View as TaskListView
    participant Service as TaskItemService
    participant Backend as Mock Adapter or Backend API

    User->>View: 選取目前頁面可修改的 Task
    User->>View: 選擇目標狀態並確認
    View->>Service: batchUpdate(ids, status)
    Service->>Backend: 驗證全部 ID、權限與狀態
    alt 任一項失敗
        Backend-->>Service: 4xx，不更新任何 Task
        Service-->>View: ApiError
        View-->>User: 保留選取與畫面資料，顯示原因
    else 全部通過
        Backend-->>Service: 更新後的 Task array
        Service-->>View: 成功結果
        View-->>User: 清除選取並重新載入列表
    end
```

## Route 與 View 分組

| Feature    | Views                                           | 主要 Route                              |
| ---------- | ----------------------------------------------- | --------------------------------------- |
| Auth       | SignIn、SignUp、VerifyEmail、ResendVerification | `/sign-in`、`/sign-up`、`/verify-email` |
| Project    | ProjectList、ProjectDetail、ProjectForm         | `/projects`、`/projects/:projectId`     |
| Task       | TaskList、TaskDetail、TaskForm                  | `/projects/:projectId/task-items`       |
| User       | UserList、UserDetail                            | `/users`、`/users/:userId`              |
| Preference | Settings                                        | `/settings`                             |
| Error      | Forbidden、NotFound                             | `/forbidden`、fallback route            |

## Storage Boundary

| Storage        | Key                                 | 用途                                               |
| -------------- | ----------------------------------- | -------------------------------------------------- |
| localStorage   | `project-management-web:mock-db:v1` | Mock users、projects、tasks、comments、preferences |
| localStorage   | `project-management-web:locale`     | `zh-TW`／`en` 選擇                                 |
| sessionStorage | `project-management-web:session:v1` | Mock 登入使用者 ID                                 |

Storage 僅是 V1 Demo infrastructure。正式串接時不得把真實密碼、Access Token 或機密資料沿用此方式保存。

## 串接後端的架構變更

1. 保留 `contracts.ts` 與 View 呼叫方式。
2. 依 `ApiList.md` 與正式 OpenAPI 實作 HTTP adapters。
3. 新增 request／response DTO 與 mapper，不直接把 Backend DTO 當 ViewModel。
4. 在應用程式組裝點注入 HTTP services，移除 production bundle 對 Mock repository 的依賴。
5. 依後端驗證設計補上 Cookie／Token refresh、CSRF、401 retry 與 timeout。
6. Contract tests 通過後，才移除 Demo-only `reset()` 與預設密碼提示。
