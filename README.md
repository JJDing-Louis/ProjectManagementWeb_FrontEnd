# ProjectManagementWeb Frontend

ProjectManagementWeb 是以 Vue 3、TypeScript 與 Vite 建立的前後端分離專案管理 SPA。前端已透過 typed HTTP services 串接 ASP.NET Core `/api/v1`，涵蓋驗證、角色權限、Project、Task、留言、偏好與帳號管理流程。

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
HTTP Service Adapters + DTO Mappers
        ↓
ASP.NET Core `/api/v1`
```

View 不直接呼叫 `fetch`。Access Token 僅保存在記憶體，Refresh Token 由後端透過 HttpOnly Cookie 管理；共用 client 統一處理 CSRF、single-flight refresh、timeout 與 Problem Details。

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
├── services/        # Contracts、HTTP client、adapters 與 DTO mappers
├── stores/          # Auth 與全域 UI state
├── types/           # Domain models、query、input、ApiError
└── views/           # Auth、Project、Task、User 與 Settings 頁面
tests/
├── e2e/             # Playwright acceptance tests
├── components.spec.ts
├── mockServices.spec.ts # HTTP client／adapter 測試
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
```

先複製環境設定並確認 Backend 已啟動：

```bash
cp .env.example .env.local
npm run dev
```

`VITE_API_BASE_URL` 應填 Backend origin，例如 `http://localhost:8080`；client 會統一加上 `/api/v1`。Vite 啟動後依終端輸出的 Local URL 開啟網站。

## 驗證與 Session

- 登入後 Access Token 只存在記憶體，不寫入 localStorage 或 sessionStorage。
- Refresh Token 是 `PMW-REFRESH` HttpOnly Cookie，JavaScript 無法讀取。
- Auth POST 會先取得 CSRF token 並附加 `X-CSRF-TOKEN`。
- 頁面重新整理時先 refresh，再呼叫 `/auth/me` 恢復使用者。
- 401 只會 single-flight refresh，原請求最多重送一次；refresh 失敗即清除登入狀態。

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

## Backend 契約

- API base path：`/api/v1`。
- Project／Task 的 `code` 為唯讀，由後端依 UTC 日期產生 `PRJ-YYYYMMDD######`／`TASK-YYYYMMDD######`。
- 路由與 API 使用 GUID；畫面顯示業務編號。
- Project、Task、Comment 更新與刪除傳送 Base64 `rowVersion`。
- 分頁回應使用 `totalCount`。
- Project member 支援多重 `roles`，候選人由專案範圍 API 載入。

## 最近驗證狀態

目前程式碼已完成以下驗證：

- Prettier format check。
- ESLint。
- vue-tsc strict type check。
- Vitest：7 個測試通過。
- Playwright 串接實際 Backend：7 個通過，3 個因裝置不適用而略過。
- Vite production build。
- 實際驗證登入／refresh cookie、Project 與 Task 自動編號、桌面與手機主要流程。

## 已知邊界

- Email 驗證的 token 與確認 API 流程已串接；實際寄信仍取決於 Backend SMTP secret 與外部郵件服務。
- 前端權限顯示來自 `/auth/me.functions` 與專案角色，但正式安全邊界仍由 Backend 強制執行。
- E2E 需先啟動 SQL Server 與 Backend，並透過 `PMW_E2E_PASSWORD` 提供測試 Admin 密碼。
