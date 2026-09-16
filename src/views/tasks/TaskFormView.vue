<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import { services } from '@/services'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { ApiError, type Project, type TaskStatus } from '@/types/models'
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const projectId = String(route.params.projectId)
const taskId = computed(() => String(route.params.taskId ?? ''))
const editing = computed(() => Boolean(taskId.value))
const project = ref<Project>()
const loading = ref(true)
const loadError = ref('')
const saveError = ref('')
const submitting = ref(false)
const statuses: TaskStatus[] = ['Pending', 'InProgress', 'Blocked', 'Completed']
const form = reactive({
  title: '',
  description: '',
  assigneeId: '',
  startAt: '',
  deadline: '',
  status: 'Pending' as TaskStatus,
  rowVersion: undefined as string | undefined,
})
const fullEdit = computed(() => auth.isTaskAdministrator)
const toLocal = (value: string) => value.slice(0, 16)
onMounted(async () => {
  try {
    project.value = await services.projects.get(projectId)
    if (editing.value) {
      const task = await services.tasks.get(projectId, taskId.value)
      Object.assign(form, {
        title: task.title,
        description: task.description,
        assigneeId: task.assigneeId,
        startAt: toLocal(task.startAt),
        deadline: toLocal(task.deadline),
        status: task.status,
        rowVersion: task.rowVersion,
      })
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
    const input = {
      ...form,
      startAt: new Date(form.startAt).toISOString(),
      deadline: new Date(form.deadline).toISOString(),
    }
    const saved = !editing.value
      ? await services.tasks.create(projectId, input)
      : fullEdit.value
        ? await services.tasks.update(projectId, taskId.value, input)
        : await services.tasks.updateAssigned(projectId, taskId.value, input)
    ui.notify(t('message.saved'))
    await router.push({ name: 'task-detail', params: { projectId, taskId: saved.id } })
  } catch (reason) {
    saveError.value = reason instanceof ApiError ? reason.message : 'Save failed'
  } finally {
    submitting.value = false
  }
}
</script>
<template>
  <PageHeader
    :eyebrow="project?.name"
    :title="editing ? t('common.edit') + ' ' + t('task.detail') : t('task.new')"
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
            <label for="task-title">{{ t('task.name') }}</label
            ><input
              id="task-title"
              v-model.trim="form.title"
              :disabled="editing && !fullEdit"
              maxlength="300"
              required
            />
          </div>
          <div class="field">
            <label for="task-form-assignee">{{ t('task.assignee') }}</label
            ><select
              id="task-form-assignee"
              v-model="form.assigneeId"
              :disabled="editing && !fullEdit"
              required
            >
              <option value="">Select member</option>
              <option
                v-for="member in project?.members"
                :key="member.userId"
                :value="member.userId"
              >
                {{ member.displayName }}
              </option>
            </select>
          </div>
          <div class="field">
            <label for="task-start">{{ t('task.startAt') }}</label
            ><input
              id="task-start"
              v-model="form.startAt"
              type="datetime-local"
              :disabled="editing && !fullEdit"
              required
            />
          </div>
          <div class="field">
            <label for="task-deadline">{{ t('task.deadline') }}</label
            ><input id="task-deadline" v-model="form.deadline" type="datetime-local" required />
          </div>
          <div v-if="editing" class="field">
            <label for="task-form-status">{{ t('common.status') }}</label
            ><select id="task-form-status" v-model="form.status">
              <option v-for="status in statuses" :key="status">{{ status }}</option>
            </select>
          </div>
          <div class="field full">
            <label for="task-description">{{ t('task.description') }}</label
            ><textarea
              id="task-description"
              v-model.trim="form.description"
              :disabled="editing && !fullEdit"
              maxlength="8000"
            />
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
