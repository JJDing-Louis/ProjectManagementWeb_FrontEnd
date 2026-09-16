#!/usr/bin/env bash
set -euo pipefail

script_directory=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
frontend_directory=$(cd "${script_directory}/.." && pwd)
backend_directory=${PMW_BACKEND_DIR:-"${frontend_directory}/../ProjectManagementWeb_BackEnd"}
compose_project=projectmanagementweb-e2e

export MSSQL_HOST_PORT=${PMW_E2E_SQL_PORT:-11433}
export API_HOST_PORT=${PMW_E2E_API_PORT:-18080}
export PMW_E2E_FRONTEND_PORT=${PMW_E2E_FRONTEND_PORT:-15173}
export PMW_E2E_API_BASE_URL="http://localhost:${API_HOST_PORT}"
export PMW_E2E_ACCOUNT=e2e-admin
export PMW_E2E_PASSWORD="PmwE2e-$(openssl rand -hex 12)"
export BOOTSTRAP_ADMIN_PASSWORD=${PMW_E2E_PASSWORD}
export VUE_ORIGIN="http://localhost:${PMW_E2E_FRONTEND_PORT}"
export PMW_MIGRATION_DEFAULT_TIME_ZONE_ID=Asia/Taipei
# E2E 必須可重現 SMTP 失敗契約，且不可讀取後端目錄的本機寄信設定。
# 明確提供空白值，避免 Compose 自動載入 .env 後誤寄真實郵件。
export SMTP_USERNAME=
export SMTP_PASSWORD=
export SMTP_FROM_ADDRESS=

compose() {
  docker compose --project-name "${compose_project}" --file "${backend_directory}/compose.yaml" "$@"
}

cleanup() {
  compose down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

wait_for_api() {
  local attempt
  for attempt in $(seq 1 120); do
    if curl --fail --silent --show-error "${PMW_E2E_API_BASE_URL}/health" >/dev/null; then
      return 0
    fi
    sleep 1
  done
  compose logs api
  return 1
}

set_owner_role() {
  compose exec --no-TTY sqlserver /bin/bash -c \
    '/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -b -d ProjectManagementWeb -Q "UPDATE ar SET ar.RoleId = r.Id FROM AccountRoles AS ar INNER JOIN Accounts AS a ON a.Id = ar.UserId CROSS JOIN Roles AS r WHERE a.UserName = N'"'"'e2e-owner'"'"' AND r.Name = N'"'"'Administrator'"'"'; IF @@ROWCOUNT <> 1 THROW 51000, N'"'"'無法將 E2E Owner 設為 Administrator。'"'"', 1;"'
}

cleanup

# 先建立可作為 Project Owner 的已驗證帳號；第二次啟動改以 e2e-admin
# 作為受保護的 Bootstrap Admin，前一帳號便能出現在 Owner 候選清單。
export BOOTSTRAP_ADMIN_ACCOUNT=e2e-owner
export BOOTSTRAP_ADMIN_EMAIL=e2e-owner@example.test
compose up --detach --build api
wait_for_api

compose stop api >/dev/null
set_owner_role
export BOOTSTRAP_ADMIN_ACCOUNT=${PMW_E2E_ACCOUNT}
export BOOTSTRAP_ADMIN_EMAIL=e2e-admin@example.test
compose up --detach --force-recreate api
wait_for_api

cd "${frontend_directory}"
npx playwright test --workers=1 "$@"
