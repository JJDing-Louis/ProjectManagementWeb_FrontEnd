<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import { services } from '@/services/mockServices'
import { useUiStore } from '@/stores/ui'
import { ApiError, type User } from '@/types/models'
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const id = computed(() => String(route.params.projectId ?? ''))
const editing = computed(() => Boolean(id.value))
const users = ref<User[]>([])
const error = ref('')
const form = reactive({
  name: '',
  description: '',
  ownerId: '',
  status: 'Active' as 'Active' | 'Archived',
  version: undefined as number | undefined,
})
onMounted(async () => {
  users.value = await services.users.list()
  if (editing.value) {
    const project = await services.projects.get(id.value)
    Object.assign(form, {
      name: project.name,
      description: project.description,
      ownerId: project.ownerId,
      status: project.status,
      version: project.version,
    })
  }
})
async function submit() {
  error.value = ''
  try {
    const saved = editing.value
      ? await services.projects.update(id.value, form)
      : await services.projects.create(form)
    ui.notify(t('message.saved'))
    await router.push({ name: 'project-detail', params: { projectId: saved.id } })
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Save failed'
  }
}
</script>
<template>
  <PageHeader eyebrow="Project" :title="editing ? t('project.edit') : t('project.new')"
    ><button class="button secondary" @click="router.back()">
      {{ t('common.cancel') }}
    </button></PageHeader
  >
  <section class="card">
    <div class="card-body">
      <div v-if="error" class="alert">{{ error }}</div>
      <form @submit.prevent="submit">
        <div class="form-grid">
          <div class="field">
            <label for="project-name">{{ t('project.name') }}</label
            ><input
              id="project-name"
              v-model.trim="form.name"
              minlength="2"
              maxlength="120"
              required
            />
          </div>
          <div class="field">
            <label for="project-owner">{{ t('project.owner') }}</label
            ><select id="project-owner" v-model="form.ownerId" required>
              <option value="">Select owner</option>
              <option
                v-for="user in users.filter((u) => u.isEnabled)"
                :key="user.id"
                :value="user.id"
              >
                {{ user.displayName }}
              </option>
            </select>
          </div>
          <div class="field">
            <label for="project-form-status">{{ t('common.status') }}</label
            ><select id="project-form-status" v-model="form.status">
              <option>Active</option>
              <option>Archived</option>
            </select>
          </div>
          <div class="field full">
            <label for="project-description">{{ t('project.description') }}</label
            ><textarea id="project-description" v-model.trim="form.description" required />
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="button secondary" @click="router.back()">
            {{ t('common.cancel') }}</button
          ><button class="button primary">{{ t('common.save') }}</button>
        </div>
      </form>
    </div>
  </section>
</template>
