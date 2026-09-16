<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import { services } from '@/services'
import { useUiStore } from '@/stores/ui'
import { ApiError, type ProjectStatus } from '@/types/models'
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const id = computed(() => String(route.params.projectId ?? ''))
const editing = computed(() => Boolean(id.value))
const owners = ref<Array<{ id: string; displayName: string }>>([])
const loading = ref(true)
const submitting = ref(false)
const loadError = ref('')
const saveError = ref('')
const timeZoneOptions = [
  'Asia/Taipei',
  'Asia/Tokyo',
  'America/Los_Angeles',
  'America/New_York',
  'Europe/London',
  'Australia/Sydney',
  'Etc/UTC',
]
const form = reactive({
  name: '',
  description: '',
  ownerId: '',
  timeZoneId: '',
  status: 'Pending' as ProjectStatus,
  rowVersion: undefined as string | undefined,
})
onMounted(async () => {
  try {
    if (editing.value) {
      const project = await services.projects.get(id.value)
      owners.value = project.members.map((member) => ({
        id: member.userId,
        displayName: member.displayName,
      }))
      Object.assign(form, {
        name: project.name,
        description: project.description,
        ownerId: project.ownerId,
        timeZoneId: project.timeZoneId,
        status: project.status,
        rowVersion: project.rowVersion,
      })
    } else {
      owners.value = (await services.users.listAll())
        .filter((user) => user.isEnabled && user.isVerified && user.role === 'Administrator')
        .map((user) => ({ id: user.id, displayName: user.displayName }))
    }
  } catch (reason) {
    loadError.value = reason instanceof ApiError ? reason.message : 'Load failed'
  } finally {
    loading.value = false
  }
})
async function submit() {
  if (submitting.value) return
  saveError.value = ''
  submitting.value = true
  try {
    const saved = editing.value
      ? await services.projects.update(id.value, form)
      : await services.projects.create(form)
    ui.notify(t('message.saved'))
    await router.push({ name: 'project-detail', params: { projectId: saved.id } })
  } catch (reason) {
    saveError.value = reason instanceof ApiError ? reason.message : 'Save failed'
  } finally {
    submitting.value = false
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
      <div v-if="loadError" class="alert" role="alert">{{ loadError }}</div>
      <div v-else-if="loading" class="empty-state">{{ t('common.loading') }}</div>
      <form v-else @submit.prevent="submit">
        <div v-if="saveError" class="alert" role="alert">{{ saveError }}</div>
        <div class="form-grid">
          <div class="field">
            <label for="project-name">{{ t('project.name') }}</label
            ><input
              id="project-name"
              v-model.trim="form.name"
              minlength="1"
              maxlength="200"
              required
            />
          </div>
          <div class="field">
            <label for="project-owner">{{ t('project.owner') }}</label
            ><select id="project-owner" v-model="form.ownerId" required>
              <option value="">Select owner</option>
              <option v-for="user in owners" :key="user.id" :value="user.id">
                {{ user.displayName }}
              </option>
            </select>
          </div>
          <div v-if="editing" class="field">
            <label for="project-form-status">{{ t('common.status') }}</label
            ><select id="project-form-status" v-model="form.status">
              <option>Active</option>
              <option>Pending</option>
              <option>Completed</option>
              <option>Archived</option>
            </select>
          </div>
          <div class="field">
            <label for="project-time-zone">{{ t('project.timeZone') }}</label
            ><select id="project-time-zone" v-model="form.timeZoneId" required>
              <option value="">{{ t('project.selectTimeZone') }}</option>
              <option v-for="timeZoneId in timeZoneOptions" :key="timeZoneId" :value="timeZoneId">
                {{ timeZoneId }}
              </option>
            </select>
          </div>
          <div class="field full">
            <label for="project-description">{{ t('project.description') }}</label
            ><textarea id="project-description" v-model.trim="form.description" maxlength="4000" />
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="button secondary" @click="router.back()">
            {{ t('common.cancel') }}</button
          ><button class="button primary" :disabled="submitting">
            {{ submitting ? t('common.loading') : t('common.save') }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>
