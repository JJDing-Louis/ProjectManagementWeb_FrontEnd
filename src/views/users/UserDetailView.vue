<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { services } from '@/services'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { ApiError, type RoleOption, type UserDetail } from '@/types/models'
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const user = ref<UserDetail>()
const error = ref('')
const submitting = ref(false)
const form = reactive({ roleId: '', isEnabled: true })
const roles = ref<RoleOption[]>([])
const isBootstrapAdmin = computed(() => user.value?.isBootstrapAdmin === true)
onMounted(async () => {
  try {
    ;[user.value, roles.value] = await Promise.all([
      services.users.get(String(route.params.userId)),
      services.users.roles(),
    ])
    form.roleId = roles.value.find((role) => role.name === user.value?.role)?.id ?? ''
    form.isEnabled = user.value.isEnabled
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Load failed'
  }
})
async function save() {
  if (!user.value || submitting.value) return
  error.value = ''
  submitting.value = true
  try {
    const updatedUser = await services.users.updateAdministration(
      user.value.id,
      form.roleId,
      form.isEnabled,
    )
    user.value = { ...updatedUser, phoneNumber: user.value.phoneNumber }
    ui.notify(t('message.saved'))
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Save failed'
  } finally {
    submitting.value = false
  }
}
</script>
<template>
  <div v-if="error" class="alert" role="alert">{{ error }}</div>
  <div v-if="!user && !error" class="empty-state">{{ t('common.loading') }}</div>
  <template v-if="user"
    ><PageHeader eyebrow="Directory" :title="user.displayName" :description="`@${user.account}`"
      ><button class="button secondary" @click="router.back()">
        {{ t('common.back') }}
      </button></PageHeader
    >
    <div class="detail-grid">
      <section class="card">
        <div class="card-header">
          <h2>{{ t('user.detail') }}</h2>
          <StatusBadge :value="user.role" />
        </div>
        <div class="card-body detail-list">
          <div class="detail-item">
            <label>{{ t('user.account') }}</label
            ><strong>{{ user.account }}</strong>
          </div>
          <div class="detail-item">
            <label>{{ t('user.name') }}</label
            ><span>{{ user.displayName }}</span>
          </div>
          <div class="detail-item">
            <label>{{ t('user.email') }}</label
            ><span>{{ user.email }}</span>
          </div>
          <div class="detail-item">
            <label>{{ t('user.phoneNumber') }}</label
            ><span>{{ user.phoneNumber || '—' }}</span>
          </div>
          <div class="detail-item">
            <label>{{ t('user.verified') }}</label
            ><span>{{ user.isVerified ? 'Yes' : 'No' }}</span>
          </div>
        </div>
      </section>
      <aside class="card">
        <div class="card-header"><h2>Access</h2></div>
        <div class="card-body">
          <form v-if="auth.isAdmin && !isBootstrapAdmin" @submit.prevent="save">
            <div class="field">
              <label for="role">{{ t('user.role') }}</label
              ><select id="role" v-model="form.roleId" required>
                <option v-for="role in roles" :key="role.id" :value="role.id">
                  {{ role.name }}
                </option>
              </select>
            </div>
            <label class="check-field"
              ><input v-model="form.isEnabled" type="checkbox" />{{ t('common.active') }}</label
            >
            <div class="form-actions">
              <button class="button primary" :disabled="submitting">
                {{ submitting ? t('common.loading') : t('common.save') }}
              </button>
            </div>
          </form>
          <p v-else-if="isBootstrapAdmin" style="color: var(--slate-500)">
            {{ t('user.bootstrapAdminProtected') }}
          </p>
          <p v-else style="color: var(--slate-500)">{{ t('message.forbidden') }}</p>
        </div>
      </aside>
    </div></template
  >
</template>
