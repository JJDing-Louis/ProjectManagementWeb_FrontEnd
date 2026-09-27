# GitFlow 開發與發版規範（Frontend）

本文件適用於 `ProjectManagementWeb_FrontEnd`。本專案是 Vue 3／TypeScript／Vite SPA，使用 npm、Vitest 與 Playwright；Backend 與 Spec 各自是獨立 Git repository。前端實作與驗證要求仍以 `AGENTS.md` 及相關規格為準。

## Branch Strategy

| 分支        | 用途                       | 建立來源                            | 合併目標                   |
| ----------- | -------------------------- | ----------------------------------- | -------------------------- |
| `main`      | 已核准的 Production 程式碼 | Release／Hotfix PR                  | 不在此直接開發             |
| `develop`   | 下一版本整合               | Feature／Bugfix／Release／Hotfix PR | Release 的建立來源         |
| `feature/*` | 新功能或一般重構           | `develop`                           | `develop`                  |
| `bugfix/*`  | 尚未發版版本的一般缺陷     | `develop`                           | `develop`                  |
| `release/*` | Release Candidate          | `develop`                           | `main`，再回合併 `develop` |
| `hotfix/*`  | Production 緊急修正        | `main`                              | `main`，再回合併 `develop` |

`main`、`develop` 只接受 PR，不直接 push 或 force push。`feature`／`bugfix` 合併至 `develop`，`release`／`hotfix` 合併至 `main`，都必須使用 PR；`release`／`hotfix` 回合併 `develop` 也使用 PR。PR 合併後才更新目標分支，不改寫既有 history，也不以刪除舊分支作為導入條件。

導入狀態（2026-09-27）：Frontend 的 `develop` 已存在，但 `main` 含有尚未回到 `develop` 的 Cloud Run 容器與 Nginx 變更。下一版 Release 前，維護者應透過經審查的同步 PR，把需要保留的 Production 變更帶回 `develop`；不可對 `develop` 直接 push，AI Agent 亦不可自行合併 `main`。建立依賴 Production 修正的功能分支前，也應先完成同步。請每次重新檢查 Git 狀態。

## Branch Naming

| 類型              | 格式                                | 範例                        |
| ----------------- | ----------------------------------- | --------------------------- |
| 新功能／一般重構  | `feature/<ticket-id>-<description>` | `feature/123-user-login`    |
| 一般 Bug          | `bugfix/<ticket-id>-<description>`  | `bugfix/456-project-filter` |
| Release           | `release/<version>`                 | `release/1.2.0`             |
| Production Hotfix | `hotfix/<version>-<description>`    | `hotfix/1.2.1-login-error`  |

`ticket-id` 使用議題編號；沒有議題系統時，使用可追溯的工作代碼（例如日期 `20260927`），並在 PR 連結需求。`description` 使用小寫英文字母、數字與連字號。一般重構歸在 `feature/*`；修復一般缺陷使用 `bugfix/*`，需立即發版的正式環境缺陷使用 `hotfix/*`。

## Commit Convention

採用 Conventional Commits：`<type>(<scope>): <description>`。`type` 限 `feat`、`fix`、`refactor`、`docs`、`test`、`chore`、`build`、`ci`、`perf`、`style`、`revert`；`scope` 使用穩定模組名，例如 `auth`、`projects`、`tasks`、`ui`、`build`、`docs`。描述與 commit body 使用繁體中文。

```text
feat(auth): 新增登入狀態恢復提示
fix(tasks): 修正批次更新後的清單狀態
docs(git): 補充發版與回復流程
```

Breaking Change 在 commit body 註明 `BREAKING CHANGE: <繁體中文說明>`，並於 PR 說明 API／畫面相容性。舊提交維持原狀；規範從新提交開始適用。預設 Squash Merge 時，最終 squash commit 也必須符合此格式。

## Pull Request

使用 [PR 範本](../.github/PULL_REQUEST_TEMPLATE.md) 填寫 Summary、Changes、Test、Risk、Rollback。Unit、Integration、Manual Test 分別填寫實際結果或未執行原因；依變更範圍列出登入、路由、API contract、桌面／行動版與部署影響。審查者確認相容性、敏感資訊、測試證據與回復方案後再合併。

- `feature/*`／`bugfix/*` → `develop`：預設 Squash Merge，產生一個 Conventional Commit。
- `release/*`／`hotfix/*` → `main`：使用 Merge Commit 保留完整提交與分支脈絡；回合併 `develop` 也保留完整提交。若 GitHub 無法選擇 Merge Commit，先調整 repository 設定。
- 跨 repository 變更各自送 PR，連結 Backend／Spec 的相依 PR，說明可相容的版本組合。

## Release Flow

1. 確認 `develop` 已含預計發版內容及必要的 Production 同步變更，從 `develop` 建立 `release/x.y.z`。
2. Release 分支只接受 Bug Fix、Version Update、Release Note、Config 調整；新功能留在下一版 `develop`。執行格式、Lint、型別、Build、Vitest、Playwright 與桌面／手機手動 QA，並確認 Backend API 相容性。
3. `release/x.y.z` → `main` 透過 PR 審查，使用 Merge Commit；確認合併後 `main` 的發版 commit。
4. 在該 commit 建立 annotated tag `vX.Y.Z`，確認 tag 指向該 commit；發布 GitHub Release 與 Production 部署由已核准流程執行。
5. `release/x.y.z` → `develop` 以 PR 回合併版本修正；遇到衝突時在 PR 中解決並重測。回合併完成才結束發版。

```text
develop → release/x.y.z → QA／Test → main PR → vX.Y.Z tag
        → Production Deployment → develop 回合併 PR
```

## Hotfix Flow

1. 從 `main` 建立 `hotfix/x.y.z-description`，只包含 Production 事件需要的修正與測試。
2. 執行受影響的格式、Lint、型別、Build、Vitest、Playwright 與手動驗收，寫明使用者影響及回復方式。
3. 以 Hotfix PR 合併至 `main`，保留完整提交；在合併 commit 建立對應 `vX.Y.Z` tag，完成核准後的 Production 部署。
4. 以 Hotfix PR 回合併 `develop` 並處理衝突，確保下一版保留修正。

```text
main → hotfix/x.y.z-description → Test → main PR → vX.Y.Z tag
     → Production Deployment → develop 回合併 PR
```

## Versioning

採用 Semantic Versioning `MAJOR.MINOR.PATCH`：不相容的 UI／API 契約變更加 MAJOR；向後相容的新功能加 MINOR；向後相容的修正加 PATCH。版本依 Frontend repository 的可部署 SPA 獨立計算；Backend、Spec 不會因 Frontend 發版而自動加版。跨庫一起發版時，在 PR／Release Note 列出各庫 tag 與相容組合。

`package.json` 目前有版本欄位，但 repository 尚無正式 `v*` tag；第一次採用的版本由 Release PR 核對產品對外版本後決定，不能只因 `package.json` 的值便宣稱已有正式 Release。

## Tagging

正式 tag 格式為 `v<version>`，例如 `v1.2.0`。只在 Release／Hotfix 合併 `main` 後建立，必須指向 `main` 上該次發版的 commit；同一 repository 的版本不得重用。tag 公開後不得移動或覆寫；發版紀錄保存 repository、tag、commit SHA、映像 digest 與時間。部署失敗時回復到已驗證的版本，後續修正使用新的版本號。

## CI/CD Mapping

程式碼託管於 GitHub，因此目標 CI 平台為 GitHub Actions。目前 repository **沒有 GitHub Actions workflow，也沒有已設定的分支保護或自動部署**；下表是待實作的觸發契約，不代表目前已在執行。

| 觸發條件                   | 目標檢查／部署                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| `feature/*`／`bugfix/*` PR | `npm run format:check`、`npm run lint`、`npm run type-check`、`npm run test`、`npm run build` |
| `develop` PR／合併         | 上述檢查；有隔離 Backend／SQL 測試環境時執行 Playwright；核准後部署 DEV                       |
| `release/*` PR／更新       | 上述檢查、Playwright 與桌面／手機 QA；核准後部署 STAGING                                      |
| `main` PR／合併            | Build、Test、E2E 與核准檢查；合併後保留可追溯容器映像，等待正式 tag 與 Production 核准        |
| `v*` tag                   | 驗證 tag 指向 `main` release commit，發布 GitHub Release，依核准流程將同一產物部署 PRODUCTION |

Playwright 的完整路徑需要可用的 Backend 與 SQL Server；若環境不足，CI 明確標示未執行而非宣稱通過。正式容器透過 Nginx 將 `/api/` 反向代理至 `BACKEND_ORIGIN`；部署驗收要檢查實際 API 呼叫、登入 Cookie／CSRF 與 SPA 路由。DEV／STAGING／PRODUCTION 目的地、GitHub Environment、Secret、權限與人工核准尚待建立，文件不授權自動部署。

GitHub repository 管理者需另行啟用 `main`／`develop` 的 PR 必要條件、審查與必要狀態檢查，限制直接 push 與 force push；先建立實際 workflow 再把檢查設為 Required。文件本身不會替代 GitHub 的保護設定。

## AI Agent 作業程序

1. 修改前檢查 repository、`git status --short --branch`、`main`／`develop` 位置與相關規格，辨識工作樹既存變更。
2. 判斷 `feature`（包含一般重構）、`bugfix` 或 `hotfix`，從規定基底建立符合命名的工作分支；若 `develop` 缺少必要 Production 變更，先提出同步 PR。
3. 修改後執行相關 Build、Test、`git diff --check`，檢查 `git diff`、敏感資訊與檔案範圍；未執行的驗證明確標示。
4. 產生繁體中文 Conventional Commit，提供含測試結果、影響與回復方式的 PR 說明。所有合併與發版交由核准流程處理。

AI Agent 未經使用者明確要求，不執行 force push、history rewrite、刪除遠端分支、合併 `main` 或 Production 發版。
