# ProjectManagementWeb 前端開發規範

## 1. 適用範圍

本文件適用於 `ProjectManagementWeb_FrontEnd` 目錄及其所有子目錄。

本目錄目前尚未建立前端專案。後續初始化、開發、審查與測試皆以 **Vue 3** 為技術方向，不得將其他框架的範例或 scaffold 視為已完成的 Vue 3 實作。

## 2. 需求與文件的優先順序

實作前必須先閱讀與功能相關的規格，需求判斷依下列順序進行：

1. 使用者在目前任務中明確提出的需求。
2. `../ProjectManagementWeb_Spec/UserStory.md` 的角色、權限與驗收條件。
3. `../ProjectManagementWeb_Spec/Flowchart/` 的業務流程。
4. `../ProjectManagementWeb_Spec/UIMock/` 的畫面配置與操作概念。
5. `../ProjectManagementWeb_Spec/C4/` 的元件責任與相依方向。
6. `../ProjectManagementWeb_Spec/StaticData.md` 與 `Schema.md` 的名稱及資料概念。

文件互相衝突、API 契約未定義或業務規則不完整時，不得自行發明規則。先列出衝突、合理假設與影響範圍，待確認後再實作。資料庫 Schema 是後端儲存設計，不得直接當成前端 API DTO。

## 3. 技術基線

- Vue 3。
- TypeScript，開啟嚴格型別檢查；禁止以 `any` 規避型別問題。
- Vite 作為開發與建置工具。
- Composition API。
- Single File Component 使用 `<script setup lang="ts">`。
- Vue Router 管理頁面路由與 route meta。
- Pinia 管理確實需要跨頁或跨元件共享的用戶端狀態。
- 原生 `fetch` 或專案統一的單一 HTTP client adapter；確定方案後不得在各功能中混用多套 HTTP client。
- Vitest 搭配 Vue Test Utils；以使用者行為為主測試元件。
- ESLint 與 Prettier 統一靜態檢查及格式。

除非需求或架構決策已確認，不得擅自加入大型 UI framework、CSS framework、另一套狀態管理工具或重複用途的第三方套件。新增 dependency 前須說明用途、維護狀態、替代方案與 bundle／安全影響。

## 4. 建議目錄結構

初始化 Vue 專案後，原則上採用下列結構；若實際 scaffold 不同，應維持相同的責任邊界，而非機械式搬移檔案。

```text
src/
├── app/                    # App 啟動、Router、Pinia 與全域 provider
├── assets/                 # 字型、圖片與全域樣式
├── components/             # 跨功能共用的純 UI 元件
├── composables/            # 可重用的組合式邏輯
├── features/               # 依業務功能垂直切分
│   ├── auth/
│   ├── projects/
│   ├── task-items/
│   └── users/
├── layouts/                # 前台、後台與驗證頁版型
├── router/                 # 路由表與 navigation guards
├── services/               # HTTP client 與跨功能 API 基礎設施
├── stores/                 # 真正跨功能的 Pinia stores
├── types/                  # 跨功能共用型別
├── utils/                  # 無副作用的通用函式
└── views/                  # 路由層級頁面；只負責畫面協調
```

功能專屬的 component、composable、API、DTO 與測試應放在對應的 `features/<feature>/` 中，避免所有檔案堆在全域資料夾。每個 component、composable、store、service 與型別集合應依責任拆成獨立檔案。

## 5. Vue 元件與 TypeScript 規範

- Component 使用 PascalCase，例如 `TaskItemTable.vue`。
- Composable 使用 `use` 前綴，例如 `useTaskItemFilters.ts`。
- Pinia store 使用 `useXxxStore`，例如 `useAuthStore.ts`。
- 變數與函式使用 camelCase；常數使用語意清楚的 camelCase 或 UPPER_SNAKE_CASE，專案內保持一致。
- Props 與 emits 必須有明確型別；事件名稱描述已發生的事情，例如 `statusChanged`，避免 `handleClick` 這類模糊的對外名稱。
- Template 不放複雜業務判斷。複雜條件移至 computed、composable 或 domain function。
- 優先使用 `computed` 表達衍生狀態，避免用 `watch` 複製狀態；只有同步外部副作用時才使用 `watch`／`watchEffect`。
- 不直接修改 props；雙向輸入使用明確的 `v-model` contract。
- 不以 non-null assertion 或 type assertion 隱藏 null／型別問題。
- 遠端資料、載入狀態、錯誤狀態與空資料狀態必須分開表達。
- 方法與元件維持單一職責；頁面過大時依畫面責任拆分，不以抽象層數追求形式上的設計模式。

## 6. 狀態管理原則

依狀態的真正擁有者決定放置位置：

- 單一元件暫存狀態：放在元件內。
- 可重用互動邏輯：放在 composable。
- 跨頁登入資訊、目前使用者或全域偏好：放在 Pinia。
- 後端業務資料：以 API 回應為準，不在 store 建立另一份無同步策略的真相來源。
- 搜尋、篩選、排序與分頁：以 URL query string 為可分享、可返回的狀態來源。

Task Item 清單的 checkbox 僅代表目前頁面的暫時選取狀態，不得寫入後端或永久儲存。重新整理頁面或批次操作完成後必須清除。使用者的「不再顯示批次確認視窗」屬於個人偏好，應透過已確認的後端 API 按帳號保存，不得與 checkbox 狀態混用。

## 7. 路由規範

至少保留規格已定義的路由語意：

- `/projects/{projectId}/task-items`
- `/projects/{projectId}/task-items/{taskId}`
- `/admin/projects/{projectId}/task-items/new`
- `/admin/projects/{projectId}/task-items/{taskId}/edit`

Vue Router 實作時使用 `:projectId` 與 `:taskId`。頁面名稱、route name 與 route meta 應集中定義，避免各處硬編碼路徑。

Navigation guard 可用於改善導覽體驗與隱藏不可用頁面，但不是安全邊界。所有授權與資料範圍仍必須由 Backend API 驗證。從 Task 詳情返回列表時，須保留原搜尋、篩選、排序與分頁 query。

## 8. API 與資料契約

- 所有 HTTP 呼叫經過統一 service／API adapter，不得散落在 Vue component 中。
- API base URL 由 Vite environment variable 提供；不得硬編碼 localhost、正式網域、token、密碼或其他機密。
- 僅允許在前端暴露可公開的 `VITE_*` 設定；任何放進前端 bundle 的值都不視為秘密。
- Request DTO、Response DTO 與畫面 ViewModel 分開定義；需要時以 mapper 轉換，不讓後端欄位結構滲透整個 UI。
- 日期在傳輸層保留後端定義的 ISO 8601 格式；顯示時才依產品時區與格式轉換。未確認時不得自行假設 UTC 或本地時間。
- 集中處理逾時、取消、網路錯誤、驗證錯誤、未登入、權限不足、衝突及伺服器錯誤。
- 不得吞掉例外；對使用者顯示可理解的訊息，技術細節則交由適當 logging／observability 機制處理。
- API 契約尚未確定時，先建立介面邊界或 mock adapter，清楚標註待確認，不得把猜測的 endpoint 當成正式契約。

批次修改 Task 狀態時，前端送出選取的 Task IDs 與目標狀態，並將後端回應視為唯一結果。任一項失敗時，不得在前端假裝部分成功；應保留原畫面資料、顯示錯誤，並依需要重新取得最新資料。更新成功後才清除選取狀態。

## 9. 身分驗證與授權

系統角色包含 `Admin`、`Administrator`、`User` 與 `Viewer`，角色名稱須與規格及 API 契約一致，不得在前端自行改名或推導額外角色。

- `Viewer` 只能查看有權限存取的資料，不得新增、修改、刪除、留言或切換 Task 狀態。
- 未完成 Email 驗證的帳號只能以 `Viewer` 能力操作，直到後端允許角色異動。
- UI 可依 capability 控制按鈕、checkbox 與路由入口，但不能只用角色字串取代後端授權。
- 優先由後端提供 capability／permission 資訊；若 API 尚未提供，角色對應規則必須集中管理，禁止散落在 template 中。
- 身分憑證的保存與傳送方式須依後端安全設計決定。未確認前不得自行選擇 localStorage 保存長效 token。
- 所有使用者輸入以不可信任資料處理；避免 `v-html`。確需顯示 HTML 時，必須先採用已審查的消毒策略。

## 10. 表單與使用者體驗

- 前端驗證用於即時回饋，後端驗證才是最終規則；必須能顯示後端欄位與整體錯誤。
- 提交期間避免重複送出，並提供明確 loading 狀態。
- 成功後依 User Story 顯示訊息並導向正確頁面；失敗時保留使用者仍可修正的輸入。
- 刪除操作須顯示具體項目名稱與軟刪除影響，取得使用者確認後才送出。
- 版本衝突不得靜默覆蓋；應顯示衝突並提供重新載入最新資料的方式。
- 所有資料畫面皆應處理 loading、empty、error 與 success 狀態。
- 互動元件支援鍵盤操作、可見 focus、正確 label 與語意化 HTML；顏色不得是唯一的狀態提示。
- 頁面至少需支援常見桌面與行動裝置寬度，不得只針對單一螢幕尺寸。

## 11. 樣式規範

- 先建立少量共用 design tokens，例如顏色、間距、字級、圓角與陰影；避免在每個元件重複 magic values。
- 元件樣式預設使用 scoped CSS，真正全域的 reset、tokens 與 typography 才放在全域樣式。
- class 命名須表達用途，避免依 DOM 層級或暫時外觀命名。
- UI Mock 是版面與流程依據，但若與 User Story、可用性或無障礙需求衝突，先提出差異再調整。

## 12. 測試規範

每項功能至少依風險補充下列測試：

- 純函式與 mapper：單元測試。
- Composable 與 store：狀態轉換、錯誤與邊界條件測試。
- Component：以使用者看得到的文字、角色與互動進行測試，避免綁死內部實作。
- Router guard：未登入、無權限、有權限與返回 query 的案例。
- API adapter：request mapping、成功回應、驗證錯誤、403、409 與 5xx。
- 關鍵流程：登入、列表查詢、詳情返回、批次更新、表單驗證、版本衝突與軟刪除。

不得只測 happy path。修正 bug 時應先補能重現問題的測試，再修正實作。

## 13. 開發與驗證流程

開始修改前：

1. 閱讀本文件及相關 User Story、流程圖、UI Mock 與 C4 文件。
2. 盤點既有元件、型別、API adapter、測試與相依套件，避免重複實作。
3. 說明需求理解、必要假設、影響範圍與最小修改策略。

完成修改後，必須依 `package.json` 中實際存在的 scripts 執行驗證。Vue 專案初始化後，原則上至少應提供並執行：

```bash
npm run format:check
npm run lint
npm run type-check
npm run test
npm run build
```

若專案採用不同 package manager，整個 repository 必須一致，並以 lockfile 為準。不得混用 npm、pnpm 與 yarn，也不得在未經同意下改寫 lockfile。

涉及主要畫面或互動時，除自動化測試外還要啟動應用程式，實際檢查瀏覽器 console、network、桌面／行動版面、鍵盤操作及核心流程。未執行的檢查必須明確說明，不得宣稱「全部通過」。

## 14. 變更與交付原則

- 優先做最小必要修改，保持既有公開介面與資料契約。
- 不進行與需求無關的大型重構或技術替換。
- 不提交 `.env`、憑證、token、個資、建置產物、coverage 或 `node_modules`。
- 不得以 TODO、假資料或空 handler 宣稱功能完成；必要的暫時實作須清楚標示限制。
- Git commit message 使用繁體中文，且一個 commit 聚焦一個可說明的變更。
- 交付時列出修改檔案、行為差異、影響範圍、風險、已執行的驗證及未驗證項目。

## 15. 架構底線

- View／component 不直接承擔 HTTP、權限判斷、DTO mapping 與複雜業務規則等多重責任。
- 高層畫面依賴穩定的 service／repository interface，不依賴分散的底層 HTTP 細節。
- 共用元件不得反向依賴特定 feature。
- feature 之間若需共享能力，透過清楚的公開介面或提升至共用層，避免循環依賴。
- 前端顯示控制不是授權機制；Backend API 永遠是資料正確性與安全性的最終邊界。
