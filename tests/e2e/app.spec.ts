import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/sign-in')
  await page.getByLabel('帳號').fill('admin')
  await page.getByLabel('密碼').fill('Demo123!')
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page).toHaveURL(/\/projects$/)
})

async function openMobileNavigation(page: import('@playwright/test').Page, projectName: string) {
  if (projectName === 'mobile') {
    await page.getByRole('button', { name: 'Open navigation' }).click()
  }
}

test('登入後可展開專案並進入 Task List', async ({ page }, testInfo) => {
  await expect(page.getByText('ProjectManagementWeb').first()).toBeVisible()
  await openMobileNavigation(page, testInfo.project.name)
  await page.getByRole('button', { name: /Customer Portal/ }).click()
  await page.getByRole('link', { name: 'Task 列表' }).first().click()
  await expect(page.getByRole('heading', { name: 'Customer Portal' })).toBeVisible()
  await expect(page.getByText('建立登入頁面')).toBeVisible()
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

test('五種示範帳號皆可登入與登出', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop')
  await page.evaluate(() => sessionStorage.clear())
  for (const account of ['admin', 'administrator', 'user', 'viewer', 'pending']) {
    await page.goto('/sign-in')
    await page.getByLabel('帳號').fill(account)
    await page.getByLabel('密碼').fill('Demo123!')
    await page.getByRole('button', { name: '登入' }).click()
    await expect(page).toHaveURL(/\/projects$/)
    await page.getByRole('button', { name: '登出' }).click()
    await expect(page).toHaveURL(/\/sign-in$/)
  }
})

test('Admin 可建立專案與 Task', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop')
  await page.getByRole('link', { name: /新增專案/ }).click()
  await page.getByLabel('專案名稱').fill('E2E Launch Project')
  await page.getByLabel('Owner').selectOption('u-admin')
  await page.getByLabel('說明').fill('Created by the Playwright acceptance flow.')
  await page.getByRole('button', { name: '儲存' }).click()
  await expect(page.getByRole('heading', { name: 'E2E Launch Project' })).toBeVisible()
  await page.getByRole('link', { name: 'Open Task List' }).click()
  await page.getByRole('link', { name: /新增 Task/ }).click()
  await page.getByLabel('標題').fill('Prepare launch checklist')
  await page.getByLabel('指派對象').selectOption('u-admin')
  await page.getByLabel('開始時間').fill('2026-09-01T09:00')
  await page.getByLabel('交付期限').fill('2026-09-05T17:00')
  await page.getByLabel('說明').fill('Confirm owners, dates, and release communication.')
  await page.getByRole('button', { name: '儲存' }).click()
  await expect(page.getByRole('heading', { name: 'Prepare launch checklist' })).toBeVisible()
})
