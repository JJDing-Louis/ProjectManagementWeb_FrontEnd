# ProjectManagementWeb Frontend

ProjectManagementWeb 是以 Vue 3、TypeScript 與 Vite 建立的前後端分離專案管理 SPA。V1 已完成桌面優先的 RWD 介面、角色權限、專案與 Task 工作流程；目前資料來源是 typed Mock services 與瀏覽器 Storage，尚未連接正式 Backend API。

## V1 功能

- 登入、註冊、Email 驗證與重新寄送驗證信的前端流程。
- `Admin`、`Administrator`、`User`、`Viewer` 系統角色與操作限制。
- 桌面固定 Sidebar、手機抽屜導覽及可展開的 Project tree。
- Project 搜尋、狀態篩選、建立、修改及成員管理。
- Task 搜尋、狀態／指派者篩選、URL query、分頁、排序與只看本人。
- Task 新增、修改、軟刪除、optimistic concurrency 與全有或全無的批次更新。
- Task 留言新增、修改與軟刪除。
- User directory、Admin 角色／帳號狀態管理與最後一位 Admin 保護。
- `zh-TW`／`en` 語言切換與使用者批次確認偏好。
- 403、404、loading、empty、validation、conflict 與一般錯誤狀態。

## 技術基線

| 類別                 | 技術                                               |
| -------------------- | -------------------------------------------------- |
| UI                   | Vue 3、Composition API、`<script setup lang="ts">` |
| Build                | Vite、TypeScript                                   |
| Routing              | Vue Router                                         |
| Client State         | Pinia                                              |
| i18n                 | vue-i18n                                           |
| Style                | 原生 CSS、CSS variables、scoped styles             |
| Unit／Component Test | Vitest、Vue Test Utils、jsdom                      |
| E2E                  | Playwright、Chromium                               |
| Quality              | ESLint、Prettier、vue-tsc                          |

## 架構摘要

```text
Vue Views / Pinia Stores
        ↓
Typed Service Interfaces
        ↓
Mock Service Adapter（目前）
        ↓
localStorage / sessionStorage
```

View 不直接讀寫 Storage。未來串接 Backend 時，應以 HTTP adapter 替換 Mock adapter，並保留既有 service interfaces 與 View 呼叫方式。

詳細架構、API 清單與資料契約：

- [Architecture.md](docs/Architecture.md)
- [ApiList.md](docs/ApiList.md)
- [BackendContract.md](docs/BackendContract.md)

## 專案結構

```text
src/
├── assets/          # Design tokens 與全域樣式
├── components/      # 共用 UI 元件與 Sidebar
├── layouts/         # Auth 與登入後 App shell
├── router/          # Routes 與 navigation guards
├── services/        # Contracts、Mock adapter 與 seed data
├── stores/          # Auth 與全域 UI state
├── types/           # Domain models、query、input、ApiError
└── views/           # Auth、Project、Task、User 與 Settings 頁面
tests/
├── e2e/             # Playwright acceptance tests
├── components.spec.ts
├── mockServices.spec.ts
└── router.spec.ts
docs/                # 架構與前後端串接文件
```

## 環境需求

- Node.js 22 或相容版本。
- npm 10 或相容版本。
- 第一次執行 E2E 前安裝 Chromium：`npx playwright install chromium`。

## 開始使用

```bash
npm install
npm run dev
```

Vite 啟動後依終端輸出的 Local URL 開啟網站。

## 示範帳號

| Account         | Role          | Email verified |
| --------------- | ------------- | -------------- |
| `admin`         | Admin         | Yes            |
| `administrator` | Administrator | Yes            |
| `user`          | User          | Yes            |
| `viewer`        | Viewer        | Yes            |
| `pending`       | Viewer        | No             |

所有示範帳號密碼皆為 `Demo123!`。這些帳號只存在於 Mock demo；正式串接後必須從 production bundle 移除。

## Mock Storage

| Storage        | 用途                     |
| -------------- | ------------------------ |
| localStorage   | Mock database 與介面語言 |
| sessionStorage | 目前 Mock 登入使用者 ID  |

可在 Settings 重設示範資料。此功能與 Storage key 都不是正式 Backend contract。

## 常用指令

```bash
# 開發伺服器
npm run dev

# 格式、靜態分析與型別檢查
npm run format:check
npm run lint
npm run type-check

# 單元／元件／路由測試
npm run test

# Playwright 桌面與手機流程
npm run test:e2e

# Production build
npm run build

# 預覽 production build
npm run preview
```

## 串接 Backend

1. 先由前後端共同確認 [BackendContract.md](docs/BackendContract.md) 的待確認事項。
2. 以正式 OpenAPI schema 建立 request／response DTO 與 mapper。
3. 實作 `AuthService`、`UserService`、`ProjectService`、`TaskItemService`、`PreferenceService` 的 HTTP adapters。
4. 在應用程式組裝點替換 Mock services，不在 Vue component 中散落 HTTP 呼叫。
5. 補上驗證 transport、401、CSRF、timeout、request cancellation 與 contract tests。
6. 移除 production bundle 中的 Demo 帳密、Mock reset 與 Mock repository。

## 最近驗證狀態

V1 程式碼曾完成以下驗證：

- Prettier format check。
- ESLint。
- vue-tsc strict type check。
- Vitest：7 個測試通過。
- Playwright：桌面與手機主要流程通過；裝置限定案例在不適用的 project 正常略過。
- Vite production build。
- 1440px 桌面與 390px 手機視覺檢查，browser console 無 error。

文件更新後仍應重新執行與變更風險相稱的檢查；不可只依賴上述歷史結果。

## 已知邊界

- 尚未串接 ASP.NET Core Backend 或真實 Email service。
- Mock 權限只用於 UX 與流程展示，不是正式安全邊界。
- Backend API path、驗證方式、Task 狀態轉換與時區規則仍待確認。
- `displayName` 是目前前端必要欄位，但既有 Database Schema 尚缺少對應欄位。
