# ProjectManagementWeb Frontend

ProjectManagementWeb Frontend 是以 Vue 3、TypeScript 與 Vite 建立的前後端分離專案管理 SPA。應用程式透過集中式 typed HTTP services 串接 ASP.NET Core `/api/v1`，涵蓋身分驗證、Function-based UI 權限、Project、Task、留言、使用者管理與個人設定。

## 已實作功能

- 登入、註冊、Email 驗證、重新寄送驗證信及重新整理後恢復登入狀態。
- `Admin`、`Administrator`、`User`、`Viewer` 系統角色與後端 Functions 對應的 UI 控制。
- 桌面固定 Sidebar、手機抽屜導覽及可展開的 Project tree。
- Project 搜尋、狀態篩選、分頁、IANA 時區、建立、修改、軟刪除及多重成員角色管理。
- Task 搜尋、狀態／指派者篩選、URL query、分頁、建立時間排序與只看本人。
- Task 新增、完整修改、被指派者局部修改、軟刪除、optimistic concurrency 與全有或全無批次更新。
- Task 留言新增、修改及軟刪除。
- 使用者名錄、使用者詳情、Admin 原子更新角色／帳號狀態、最後一位 Admin 與系統預設 Admin 保護。
- 本人顯示名稱與電話號碼維護，以及批次確認偏好設定。
- `zh-TW`／`en` 介面語言切換與瀏覽器端語言偏好保存。
- 403、404、loading、empty、validation、conflict、timeout 與一般錯誤狀態。

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

View 與 Pinia store 不直接呼叫 `fetch`。Access Token 僅保存在 JavaScript 記憶體，Refresh Token 由後端透過 HttpOnly Cookie 管理；共用 client 統一處理 CSRF、single-flight refresh、15 秒 timeout 與 RFC 7807 Problem Details。

詳細架構、API 清單與資料契約：

- [Architecture.md](docs/Architecture.md)
- [ApiList.md](docs/ApiList.md)
- [BackendContract.md](docs/BackendContract.md)

## 專案結構

```text
src/
├── assets/                    # Design tokens 與全域樣式
├── components/                # 共用 UI、Sidebar 與選擇元件
├── features/                  # 功能專屬 helper 與 component
├── layouts/                   # Auth 與登入後 App shell
├── router/                    # Routes 與 navigation guards
├── services/                  # Service contracts、HTTP client、adapters、DTO mappers
├── stores/                    # Auth 與全域 UI state
├── types/                     # Domain models、query、input、ApiError
└── views/                     # Auth、Project、Task、User 與 Settings 頁面
tests/
├── e2e/app.spec.ts            # Playwright desktop／mobile acceptance tests
├── mockServices.spec.ts       # 沿用舊檔名的 HTTP client／adapter 測試
└── *.spec.ts                  # View、router、validation 與 component 測試
docs/
├── ApiList.md                 # 前端實際呼叫的 API 清單
├── Architecture.md            # 前端 Level 3 component architecture
└── BackendContract.md         # 前端依賴的 Backend contract
```

## 環境需求

- Node.js 22。
- npm 10 或與 `package-lock.json` 相容的版本。
- 可連線的 ProjectManagementWeb Backend 與 SQL Server；若使用隔離 E2E，需安裝 Docker Desktop、Docker Compose、OpenSSL 與 curl。
- 第一次執行 E2E 前安裝 Chromium：`npx playwright install chromium`。

## 開始使用

```bash
npm install
```

複製環境設定並確認 Backend 已啟動：

```bash
cp .env.example .env.local
npm run dev
```

`VITE_API_BASE_URL` 只填 Backend origin，例如 `http://localhost:8080`；client 會統一加上 `/api/v1`。變更環境變數後需重新啟動 Vite。

## 驗證與 Session

- 登入後 Access Token 只存在記憶體，不寫入 localStorage 或 sessionStorage。
- Refresh Token 是 `PMW-REFRESH` HttpOnly Cookie，JavaScript 無法讀取。
- cookie-sensitive Auth POST 會先取得 CSRF token 並附加 `X-CSRF-TOKEN`。
- 頁面重新整理時先 refresh，再呼叫 `/auth/me` 恢復使用者。
- 401 只會 single-flight refresh，原請求最多重送一次；refresh 失敗即清除登入狀態。
- 語言偏好是唯一寫入 localStorage 的前端設定；Access Token 與業務資料不寫入 Browser Storage。

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

# 建立全新 SQL volume、即時測試密碼與隔離 Backend 的完整 E2E
npm run test:e2e:isolated

# Production build
npm run build

# 預覽 production build
npm run preview
```

## API 與 Backend 契約

- API base path：`/api/v1`。
- Project／Task 的 `code` 為唯讀，由後端依 UTC 日期產生 `PRJ-YYYYMMDD######`／`TASK-YYYYMMDD######`。
- 路由與 API 使用 GUID；畫面顯示業務編號。
- Project、Task、Comment 更新與刪除傳送 Base64 `rowVersion`。
- 分頁回應使用 `totalCount`。
- Project member 支援多重 `roles`，候選人由專案範圍 API 載入。
- 使用者角色與啟用狀態由 `/users/{id}/administration` 在後端單一交易中更新。
- 本人名稱與電話由 `/users/me/profile` 維護；電話變更後的確認狀態由後端管理。

前端目前實際使用 38 組 HTTP Method／Route。請參閱 [API 清單](docs/ApiList.md) 與 [前後端契約](docs/BackendContract.md)。

## 測試與驗證

- Vitest 涵蓋 HTTP adapter、router、表單契約、主要 View 與共用元件。目前共有 18 個 test files、80 個 tests。
- Playwright 以 Desktop Chrome（1440×900）與 Pixel 7 兩種 project 執行，目前收錄 26 個案例。
- `npm run test:e2e` 使用現有 Backend；可透過環境變數提供 `PMW_E2E_ACCOUNT`、`PMW_E2E_PASSWORD` 與 `PMW_E2E_API_BASE_URL`。
- `npm run test:e2e:isolated` 會建立獨立 Docker Compose project、SQL volume 與即時測試密碼，停用真實 SMTP，結束時清除容器與 volume。

文件更新後建議執行 `format:check`、`lint`、`type-check`、`test` 與 `build`；涉及 Backend 或核心互動時再執行完整 E2E。

## 已知邊界

- Email 驗證的 token 與確認 API 流程已串接；實際寄信仍取決於 Backend SMTP secret 與外部郵件服務。
- 前端權限顯示來自 `/auth/me.functions` 與專案角色，但正式安全邊界仍由 Backend 強制執行。
- 共用 HTTP client 目前在 401 時自動 refresh；若 CSRF token 過期並回傳 antiforgery 400，需由使用者重新觸發操作或重新載入頁面。
- route guard 與隱藏按鈕只改善導覽體驗，不代表授權；任何寫入都必須接受 Backend 再驗證。
