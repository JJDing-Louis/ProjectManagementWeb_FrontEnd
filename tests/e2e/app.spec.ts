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

test('登入後可載入正式 Project API', async ({ page }) => {
  await expect(page.getByText('ProjectManagementWeb').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: '專案列表' })).toBeVisible()
})

test('可切換英文並保留語言設定', async ({ page }, testInfo) => {
  await openMobileNavigation(page, testInfo.project.name)
  await page.getByRole('button', { name: /文 \/ EN/ }).click()
  await expect(page.getByText('Project List').first()).toBeVisible()
  await page.reload()
  await expect(page.getByText('Project List').first()).toBeVisible()
})

test('手機版使用抽屜導覽', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()
  await page.getByRole('link', { name: '使用者列表' }).click()
  await expect(page.getByRole('heading', { name: '使用者列表' })).toBeVisible()
})

test('Refresh Cookie 可在重新整理後恢復登入', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop')
  await page.reload()
  await expect(page).toHaveURL(/\/projects$/)
  await expect(page.getByRole('heading', { name: '專案列表' })).toBeVisible()
})

test('Admin 可建立專案與 Task', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop')
  await page.getByRole('link', { name: /新增專案/ }).click()
  await page.getByLabel('專案名稱').fill('E2E Launch Project')
  await page.getByLabel('Owner').selectOption({ index: 1 })
  await page.getByLabel('說明').fill('Created by the Playwright acceptance flow.')
  await page.getByRole('button', { name: '儲存' }).click()
  await expect(page.getByRole('heading', { name: 'E2E Launch Project' })).toBeVisible()
  await expect(page.getByText(/^PRJ-\d{14}$/)).toBeVisible()
  await page.getByRole('link', { name: 'Open Task List' }).click()
  await page.getByRole('link', { name: /新增 Task/ }).click()
  await page.getByLabel('標題').fill('Prepare launch checklist')
  await page.getByLabel('指派對象').selectOption({ index: 1 })
  await page.getByLabel('開始時間').fill('2026-09-01T09:00')
  await page.getByLabel('交付期限').fill('2026-09-05T17:00')
  await page.getByLabel('說明').fill('Confirm owners, dates, and release communication.')
  await page.getByRole('button', { name: '儲存' }).click()
  await expect(page.getByRole('heading', { name: 'Prepare launch checklist' })).toBeVisible()
  await expect(page.getByText(/^TASK-\d{14}$/)).toBeVisible()
})
