import { expect, test } from '@playwright/test'

const account = process.env.PMW_E2E_ACCOUNT ?? 'admin'
const password = process.env.PMW_E2E_PASSWORD

test.beforeEach(async ({ page }) => {
  test.skip(!password, '請設定 PMW_E2E_PASSWORD 後執行正式 API E2E。')
  await page.goto('/sign-in')
  await page.getByLabel('帳號').fill(account)
  await page.getByLabel('密碼').fill(password!)
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page).toHaveURL(/\/projects$/)
})

async function openMobileNavigation(page: import('@playwright/test').Page, projectName: string) {
  if (projectName === 'mobile') {
    await page.getByRole('button', { name: 'Open navigation' }).click()
  }
}

async function signOut(page: import('@playwright/test').Page, projectName: string) {
  await openMobileNavigation(page, projectName)
  await page.getByRole('button', { name: /登出|Logout/ }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
}

async function expectNoViewportOverflow(page: import('@playwright/test').Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true)
}

async function expectSingleColumnOnMobile(
  page: import('@playwright/test').Page,
  projectName: string,
) {
  const columns = await page
    .locator('.form-grid')
    .evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length,
    )
  expect(columns).toBe(projectName === 'mobile' ? 1 : 2)
}

// 測試案例：TC-F-AUTH-020
// 測試結果：Passed（desktop／mobile；完整隔離 E2E 22/22）
// 上次測試時間：2026-09-16 20:44:21 +08:00
test('登入後可載入正式 Project API', async ({ page }, testInfo) => {
  await expect(
    testInfo.project.name === 'mobile'
      ? page.locator('.mobile-header').getByText('ProjectManagementWeb')
      : page.locator('.brand'),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: '專案列表' })).toBeVisible()
})

// 測試案例：TC-F-UI-006
// 測試結果：Passed（desktop／mobile；完整隔離 E2E 22/22）
// 上次測試時間：2026-09-16 20:44:21 +08:00
test('可切換英文並保留語言設定', async ({ page }, testInfo) => {
  await openMobileNavigation(page, testInfo.project.name)
  await page.getByRole('button', { name: /文 \/ EN/ }).click()
  await expect(page.getByRole('heading', { name: 'Project List' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Project List' })).toBeVisible()
  expect(
    await page.evaluate(() =>
      Object.fromEntries(
        Array.from({ length: localStorage.length }, (_, index) => {
          const key = localStorage.key(index)!
          return [key, localStorage.getItem(key)]
        }),
      ),
    ),
  ).toEqual({ 'project-management-web:locale': 'en' })

  await signOut(page, testInfo.project.name)
  await page.getByLabel('Account').fill(account)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByRole('heading', { name: 'Project List' })).toBeVisible()

  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.getByRole('heading', { name: '專案列表' })).toBeVisible()
})

// 測試案例：TC-F-UI-004、TC-F-UI-005、TC-F-UI-008（公開頁、UserList、Settings）
// 測試結果：Passed（desktop／mobile；完整隔離 E2E 22/22）
// 上次測試時間：2026-09-16 20:44:21 +08:00
test('桌面版固定顯示導覽且手機版使用抽屜導覽', async ({ page }, testInfo) => {
  const sidebar = page.locator('.sidebar')
  if (testInfo.project.name === 'mobile') {
    await expect(sidebar).toHaveCSS('transform', /matrix\(1, 0, 0, 1, -/)
    const openNavigation = page.getByRole('button', { name: 'Open navigation' })
    await page.locator('body').click({ position: { x: 1, y: 1 } })
    await page.keyboard.press('Tab')
    await expect(openNavigation).toBeFocused()
    expect(
      await openNavigation.evaluate((element) => getComputedStyle(element).outlineStyle),
    ).not.toBe('none')
    await openNavigation.press('Enter')
    await expect(page.getByRole('button', { name: 'Close navigation' })).toBeVisible()
  } else {
    await expect(sidebar).toHaveCSS('position', 'fixed')
  }
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()
  await page.getByRole('link', { name: '使用者列表' }).click()
  await expect(page.getByRole('heading', { name: '使用者列表' })).toBeVisible()
  await expect(page.getByLabel('搜尋')).toBeVisible()
  await expect(page.getByLabel('系統角色')).toBeVisible()
  await expect(page.locator('.table-wrap')).toBeVisible()
  await expectNoViewportOverflow(page)

  await openMobileNavigation(page, testInfo.project.name)
  await page.getByRole('link', { name: '個人設定' }).click()
  await expect(page.getByRole('heading', { name: '個人設定' }).first()).toBeVisible()
  await expect(page.getByLabel('語言')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: '批次更新時不顯示確認視窗' })).toBeVisible()
  await expectNoViewportOverflow(page)

  await signOut(page, testInfo.project.name)
  await page.keyboard.press('Tab')
  const firstFocusable = page.getByLabel('帳號')
  await expect(firstFocusable).toBeFocused()
  expect(
    await firstFocusable.evaluate((element) => getComputedStyle(element).outlineStyle),
  ).not.toBe('none')
  await expect(page.getByLabel('密碼')).toBeVisible()
  await expect(page.getByRole('button', { name: '登入' })).toBeVisible()

  await page.getByRole('link', { name: '註冊' }).click()
  await expect(page.getByRole('heading', { name: '註冊' })).toBeVisible()
  for (const label of ['帳號', '顯示名稱', '電子郵件', '密碼', '確認密碼']) {
    await expect(page.getByLabel(label, { exact: true })).toBeVisible()
  }
  await expectNoViewportOverflow(page)
})

// 測試案例：TC-F-AUTH-014
// 測試結果：Passed（desktop／mobile；完整隔離 E2E 22/22）
// 上次測試時間：2026-09-16 20:44:21 +08:00
test('Refresh Cookie 可在重新整理後恢復登入', async ({ page }) => {
  await page.reload()
  await expect(page).toHaveURL(/\/projects$/)
  await expect(page.getByRole('heading', { name: '專案列表' })).toBeVisible()
})

// 測試案例：TC-ERR-AUTH-021（未知 Refresh Cookie 的正式 UI 復原路徑）
// 測試結果：Passed（desktop／mobile；完整隔離 E2E 22/22）
// 上次測試時間：2026-09-16 20:44:21 +08:00
test('未知 Refresh Cookie 會清除登入狀態並返回登入頁', async ({ page, context }) => {
  await context.addCookies([
    {
      name: 'PMW-REFRESH',
      value: 'unknown-refresh-token',
      domain: 'localhost',
      path: '/api/v1/auth',
      httpOnly: true,
      sameSite: 'Lax',
      secure: false,
    },
  ])

  await page.reload()
  await expect(page).toHaveURL(/\/sign-in(?:\?|$)/)
  await expect(page.getByRole('button', { name: '登入' })).toBeVisible()
})

// 測試案例：TC-F-PREF-001（偏好跨 reload 持久化）
// 測試結果：Passed（desktop／mobile；完整隔離 E2E 22/22）
// 上次測試時間：2026-09-16 20:44:21 +08:00
test('批次確認偏好可保存並在重新載入後維持', async ({ page }, testInfo) => {
  await openMobileNavigation(page, testInfo.project.name)
  await page.getByRole('link', { name: '個人設定' }).click()
  await expect(page.getByRole('heading', { name: '個人設定' }).first()).toBeVisible()
  const checkbox = page.getByRole('checkbox', { name: '批次更新時不顯示確認視窗' })
  const original = await checkbox.isChecked()

  await checkbox.setChecked(!original)
  await page.getByRole('button', { name: '儲存' }).click()
  await expect(page.locator('.toast')).toContainText('資料已儲存')
  await page.reload()
  await expect(checkbox).toBeChecked({ checked: !original })

  await checkbox.setChecked(original)
  await page.getByRole('button', { name: '儲存' }).click()
  await expect(page.locator('.toast')).toContainText('資料已儲存')
})

// 測試案例：TC-F-UI-001、TC-ST-AUTH-013
// 測試結果：Passed（desktop／mobile；完整隔離 E2E 22/22）
// 上次測試時間：2026-09-16 20:44:21 +08:00
test('受保護路由在登出後保存 redirect 並於重新登入後返回', async ({ page }, testInfo) => {
  await signOut(page, testInfo.project.name)
  const protectedPath = '/projects/missing-project/task-items?status=Pending&sort=oldest'
  await page.goto(protectedPath)
  await expect(page).toHaveURL(/\/sign-in\?redirect=/)
  expect(new URL(page.url()).searchParams.get('redirect')).toBe(protectedPath)

  await page.getByLabel('帳號').fill(account)
  await page.getByLabel('密碼').fill(password!)
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page).toHaveURL(new RegExp(`${protectedPath.replace('?', '\\?')}$`))
})

// 測試案例：TC-F-AUTH-001、TC-ST-AUTH-006、TC-F-AUTH-007、TC-F-AUTH-011、TC-ERR-AUTH-022
// 測試結果：Passed（desktop／mobile；完整隔離 E2E 22/22）
// 上次測試時間：2026-09-16 20:44:21 +08:00
test('SMTP 失敗仍保留新 Viewer 且重寄不洩漏帳號存在性', async ({ page }, testInfo) => {
  await signOut(page, testInfo.project.name)
  const viewerAccount = `e2e-viewer-${testInfo.project.name}`
  const viewerPassword = 'PmwViewer-123!'
  await page.goto('/sign-up')
  await page.getByLabel('帳號').fill(viewerAccount)
  await page.getByLabel('顯示名稱').fill(`E2E Viewer ${testInfo.project.name}`)
  await page.getByLabel('電子郵件').fill(`${viewerAccount}@example.test`)
  await page.getByLabel('密碼', { exact: true }).fill(viewerPassword)
  await page.getByLabel('確認密碼').fill(viewerPassword)
  await page.getByRole('button', { name: '註冊' }).click()

  await expect(page).toHaveURL(/\/verify-email\?accountId=/)
  await expect(page.getByRole('alert')).toContainText('帳號已建立，但驗證信寄送失敗')
  await page.getByRole('link', { name: '重新寄送驗證信' }).click()
  await page.getByLabel('Account or email').fill(viewerAccount)
  await page.getByRole('button', { name: 'Resend verification' }).click()
  const genericMessage = '若帳號存在且符合條件，系統已受理重寄請求。'
  await expect(page.getByRole('status')).toHaveText(genericMessage)

  await page.getByLabel('Account or email').fill(`missing-${testInfo.project.name}`)
  await page.getByRole('button', { name: 'Resend verification' }).click()
  await expect(page.getByRole('status')).toHaveText(genericMessage)

  await page.getByRole('link', { name: 'Return to sign in' }).click()
  await page.getByLabel('帳號').fill(viewerAccount)
  await page.getByLabel('密碼').fill(viewerPassword)
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page).toHaveURL(/\/projects$/)
  await expect(page.getByRole('link', { name: /新增專案/ })).toHaveCount(0)
})

// 測試案例：TC-ERR-AUTH-010
// 測試結果：Passed（desktop／mobile；真實 API 一般化錯誤與重寄入口；完整隔離 E2E 22/22）
// 上次測試時間：2026-09-16 20:44:21 +08:00
test('無效 Email 驗證 Token 顯示一般化訊息與重寄入口', async ({ page }) => {
  await page.goto(
    '/verify-email?accountId=00000000-0000-0000-0000-000000000000&token=invalid-token',
  )
  await page.getByRole('button', { name: 'Verify email' }).click()

  await expect(page.getByRole('alert')).toHaveText('驗證連結無效或已過期。')
  await expect(page.getByRole('link', { name: '重新寄送驗證信' })).toBeVisible()
})

// 測試案例：TC-F-PRJ-003、TC-F-TASK-008、TC-ERR-TASK-009、TC-F-TASK-021
// 測試結果：Passed（desktop／mobile；完整隔離 E2E 22/22）
// 上次測試時間：2026-09-16 20:44:21 +08:00
test('Admin 可建立專案與 Task', async ({ page }) => {
  await page.getByRole('link', { name: /新增專案/ }).click()
  await page.getByLabel('專案名稱').fill('E2E Launch Project')
  await page.getByLabel('Owner').selectOption({ index: 1 })
  await page.getByLabel('時區').selectOption('Asia/Taipei')
  await page.getByLabel('說明').fill('Created by the Playwright acceptance flow.')
  await page.getByRole('button', { name: '儲存' }).click()
  await expect(page.getByRole('heading', { name: 'E2E Launch Project' })).toBeVisible()
  await expect(page.getByText(/^PRJ-\d{14}$/)).toBeVisible()
  await page.getByRole('link', { name: 'Open Task List' }).click()
  await page.getByRole('link', { name: /新增 Task/ }).click()
  await page.getByLabel('標題').fill('Prepare launch checklist')
  await page.getByLabel('指派對象').selectOption({ index: 1 })
  await page.getByLabel('開始時間').fill('2026-09-05T17:00')
  await page.getByLabel('交付期限').fill('2026-09-01T09:00')
  await page.getByLabel('說明').fill('Confirm owners, dates, and release communication.')
  await page.getByRole('button', { name: '儲存' }).click()
  await expect(page.getByRole('alert')).toContainText('開始時間不得晚於交付期限')
  await expect(page.getByLabel('標題')).toHaveValue('Prepare launch checklist')

  await page.getByLabel('交付期限').fill('2026-09-05T18:00')
  await page.getByRole('button', { name: '儲存' }).click()
  await expect(page.getByRole('heading', { name: 'Prepare launch checklist' })).toBeVisible()
  await expect(page.getByText(/^TASK-\d{14}$/)).toBeVisible()
  await expect(
    page.getByText('Confirm owners, dates, and release communication.').first(),
  ).toBeVisible()
  await expect(page.getByText('Pending', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('開始時間', { exact: true })).toBeVisible()
  await expect(page.getByText('交付期限', { exact: true })).toBeVisible()
  await expect(page.getByText('建立者', { exact: true })).toBeVisible()
  await expect(page.getByText('指派對象', { exact: true })).toBeVisible()
  await expect(page.getByText('建立時間', { exact: true })).toBeVisible()
  await expect(page.getByText('最後更新時間', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: '編輯' }).click()
  await expect(page).toHaveURL(/\/admin\/projects\/[^/]+\/task-items\/[^/]+\/edit$/)
  await expect(page.getByLabel('標題')).toHaveValue('Prepare launch checklist')
  await expect(page.getByLabel('說明')).toHaveValue(
    'Confirm owners, dates, and release communication.',
  )
  await page.getByRole('button', { name: '取消' }).first().click()
  await expect(page.getByRole('heading', { name: 'Prepare launch checklist' })).toBeVisible()
})

// 測試案例：TC-F-UI-004、TC-F-UI-005、TC-SEC-UI-007、TC-F-UI-008
// 測試結果：Passed（desktop／mobile；完整隔離 E2E 22/22）
// 上次測試時間：2026-09-16 20:44:21 +08:00
test('八頁核心資訊、完整 viewport、鍵盤語意與 Project XSS 防護', async ({ page }, testInfo) => {
  const xssProjectName = `<img src=x onerror="globalThis.__pmwXss=1"> E2E ${testInfo.project.name}`
  await page.evaluate(() => {
    ;(globalThis as typeof globalThis & { __pmwXss?: number }).__pmwXss = 0
  })

  await expect(page.getByRole('heading', { name: '專案列表' })).toBeVisible()
  await expect(page.getByLabel('搜尋')).toBeVisible()
  await expect(page.getByLabel('狀態')).toBeVisible()
  await expectNoViewportOverflow(page)

  await page.getByRole('link', { name: /新增專案/ }).click()
  await expectSingleColumnOnMobile(page, testInfo.project.name)
  await page.getByLabel('專案名稱').fill(xssProjectName)
  await page.getByLabel('Owner').selectOption({ index: 1 })
  await page.getByLabel('時區').selectOption('Asia/Taipei')
  await page.getByLabel('說明').fill('<script>globalThis.__pmwXss=2</script> & safe text')
  await page.getByRole('button', { name: '儲存' }).click()

  await expect(page.getByRole('heading', { name: xssProjectName })).toBeVisible()
  await expect(page.getByText('<script>globalThis.__pmwXss=2</script> & safe text')).toBeVisible()
  await expect(page.locator('script', { hasText: '__pmwXss' })).toHaveCount(0)
  await expect(page.locator('img[onerror]')).toHaveCount(0)
  expect(
    await page.evaluate(() => (globalThis as typeof globalThis & { __pmwXss?: number }).__pmwXss),
  ).toBe(0)
  await expect(page.getByText('Owner', { exact: true })).toBeVisible()
  await expect(page.getByText('Created', { exact: true })).toBeVisible()
  await expect(page.getByText('Last updated', { exact: true })).toBeVisible()
  await expectNoViewportOverflow(page)

  const roleSelector = page.locator('[aria-haspopup="listbox"]').first()
  await roleSelector.focus()
  await roleSelector.press('Enter')
  await expect(roleSelector).toHaveAttribute('aria-expanded', 'true')
  await roleSelector.press('Escape')
  await expect(roleSelector).toHaveAttribute('aria-expanded', 'false')

  await page.getByRole('link', { name: 'Open Task List' }).click()
  await expect(page.getByLabel('搜尋')).toBeVisible()
  await expect(page.getByLabel('批次更新')).toHaveValue('InProgress')
  await expect(page.getByRole('button', { name: /確認/ })).toBeDisabled()
  await expect(page.getByText('沒有符合條件的資料')).toBeVisible()
  await expectNoViewportOverflow(page)

  await page.getByRole('link', { name: /新增 Task/ }).click()
  await expectSingleColumnOnMobile(page, testInfo.project.name)
  await page.getByLabel('標題').fill('XSS-safe task')
  await page.getByLabel('指派對象').selectOption({ index: 1 })
  await page.getByLabel('開始時間').fill('2026-10-01T09:00')
  await page.getByLabel('交付期限').fill('2026-10-01T18:00')
  await page.getByLabel('說明').fill('Task detail viewport contract')
  await page.getByRole('button', { name: '儲存' }).click()

  await expect(page.getByRole('heading', { name: 'XSS-safe task' })).toBeVisible()
  await expect(page.getByText('Task detail viewport contract').first()).toBeVisible()
  await expect(page.getByLabel('新增留言')).toBeVisible()
  await expect(page.getByRole('button', { name: '返回' })).toBeVisible()
  await expectNoViewportOverflow(page)

  await page.getByLabel('新增留言').fill(' ')
  await page.getByRole('button', { name: '儲存' }).click()
  await expect(page.getByRole('alert')).toBeVisible()

  await page.getByLabel('新增留言').fill('E2E accessible comment')
  await page.getByRole('button', { name: '儲存' }).click()
  await expect(page.getByRole('status')).toContainText('資料已儲存')
  await expect(page.getByText('E2E accessible comment')).toBeVisible()

  await page.getByRole('button', { name: '返回' }).click()
  await expect(page.locator('.table-wrap')).toBeVisible()
  await expectNoViewportOverflow(page)
  const taskCheckbox = page.getByRole('checkbox', { name: 'Select XSS-safe task' })
  await taskCheckbox.check()
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm')
    await dialog.dismiss()
  })
  await page.getByRole('button', { name: /確認 · 1/ }).click()
  await expect(taskCheckbox).toBeChecked()

  await page.goto('/projects')
  await page.getByLabel('搜尋').fill(xssProjectName)
  const xssRow = page.locator('tbody tr').filter({ hasText: xssProjectName }).first()
  await expect(xssRow).toContainText(xssProjectName)
  await expect(xssRow).toContainText('<script>globalThis.__pmwXss=2</script> & safe text')
  await expect(page.locator('img[onerror]')).toHaveCount(0)
  expect(
    (await page.evaluate(
      () => (globalThis as typeof globalThis & { __pmwXss?: number }).__pmwXss,
    )) ?? 0,
  ).toBe(0)
})
