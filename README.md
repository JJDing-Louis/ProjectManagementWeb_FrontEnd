# ProjectManagementWeb Frontend

Vue 3、TypeScript 與 Vite 建立的前後端分離前端 MVP。目前使用 typed Mock services 與瀏覽器本機資料，未連接正式 Backend API。

## 開始使用

```bash
npm install
npm run dev
```

示範帳號為 `admin`、`administrator`、`user`、`viewer`、`pending`，密碼統一為 `Demo123!`。

## 驗證

```bash
npm run format:check
npm run lint
npm run type-check
npm run test
npm run test:e2e
npm run build
```

Mock 業務資料保存在 localStorage，登入狀態只保存在 sessionStorage。可在 Settings 清除本機修改並回復示範資料。
