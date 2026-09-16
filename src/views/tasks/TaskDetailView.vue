<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { services } from '@/services'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { ApiError, type Project, type TaskComment, type TaskItem } from '@/types/models'
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const task = ref<TaskItem>()
const comments = ref<TaskComment[]>([])
const project = ref<Project>()
const content = ref('')
const error = ref('')
const editingCommentId = ref('')
const editingContent = ref('')
const projectId = String(route.params.projectId)
const taskId = String(route.params.taskId)
const canEdit = computed(() =>
  Boolean(
    task.value &&
    auth.user &&
    (auth.hasFunction('tasks.update-any') ||
      (auth.hasFunction('tasks.update-assigned') && task.value.assigneeId === auth.user.id)),
  ),
)
const canComment = computed(() => auth.hasFunction('comments.create'))
const userName = (id: string) =>
  project.value?.members.find((member) => member.userId === id)?.displayName ?? id
function validateComment(value: string) {
  const length = value.trim().length
  if (length >= 1 && length <= 2000) return true
  error.value = t('task.commentLength')
  return false
}
async function load() {
  try {
    ;[task.value, comments.value, project.value] = await Promise.all([
      services.tasks.get(projectId, taskId),
      services.tasks.listComments(projectId, taskId),
      services.projects.get(projectId),
    ])
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Load failed'
  }
}
async function addComment() {
  if (!validateComment(content.value)) return
  try {
    error.value = ''
    await services.tasks.addComment(projectId, taskId, content.value)
    content.value = ''
    comments.value = await services.tasks.listComments(projectId, taskId)
    ui.notify(t('message.saved'))
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Failed'
  }
}
async function removeComment(comment: TaskComment) {
  if (!confirm(t('message.confirmRemove', { name: 'comment' }))) return
  try {
    error.value = ''
    await services.tasks.removeComment(projectId, taskId, comment)
    comments.value = await services.tasks.listComments(projectId, taskId)
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Delete failed'
  }
}
function startEditing(comment: TaskComment) {
  editingCommentId.value = comment.id
  editingContent.value = comment.content
}
async function saveComment(comment: TaskComment) {
  if (!validateComment(editingContent.value)) return
  try {
    error.value = ''
    await services.tasks.updateComment(projectId, taskId, comment, editingContent.value)
    editingCommentId.value = ''
    editingContent.value = ''
    comments.value = await services.tasks.listComments(projectId, taskId)
    ui.notify(t('message.saved'))
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Failed'
  }
}
onMounted(load)
</script>
<template>
  <div v-if="error" class="alert" role="alert">{{ error }}</div>
  <div v-if="!task && !error" class="empty-state">{{ t('common.loading') }}</div>
  <template v-if="task"
    ><PageHeader :eyebrow="task.code" :title="task.title" :description="task.description"
      ><button
        class="button secondary"
        @click="router.push({ name: 'task-list', params: { projectId }, query: route.query })"
      >
        {{ t('common.back') }}</button
      ><RouterLink
        v-if="canEdit"
        class="button primary"
        :to="{ name: 'task-edit', params: { projectId, taskId } }"
        >{{ t('common.edit') }}</RouterLink
      ></PageHeader
    >
    <div class="detail-grid">
      <section>
        <div class="card">
          <div class="card-header">
            <h2>{{ t('task.detail') }}</h2>
            <StatusBadge :value="task.status" />
          </div>
          <div class="card-body detail-list">
            <div class="detail-item">
              <label>{{ t('task.creator') }}</label
              ><strong>{{ userName(task.creatorId) }}</strong>
            </div>
            <div class="detail-item">
              <label>{{ t('task.assignee') }}</label
              ><strong>{{ userName(task.assigneeId) }}</strong>
            </div>
            <div class="detail-item">
              <label>{{ t('task.startAt') }}</label
              ><span>{{ new Date(task.startAt).toLocaleString() }}</span>
            </div>
            <div class="detail-item">
              <label>{{ t('task.deadline') }}</label
              ><span>{{ new Date(task.deadline).toLocaleString() }}</span>
            </div>
            <div class="detail-item">
              <label>{{ t('task.createdAt') }}</label
              ><span>{{ new Date(task.createdAt).toLocaleString() }}</span>
            </div>
            <div class="detail-item">
              <label>{{ t('task.updatedAt') }}</label
              ><span>{{ new Date(task.updatedAt).toLocaleString() }}</span>
            </div>
            <div class="detail-item full" style="grid-column: 1/-1">
              <label>{{ t('task.description') }}</label>
              <div class="description-box">{{ task.description }}</div>
            </div>
          </div>
        </div>
      </section>
      <aside class="card">
        <div class="card-header">
          <h2>{{ t('task.comments') }} · {{ comments.length }}</h2>
        </div>
        <div class="card-body">
          <form v-if="canComment" @submit.prevent="addComment">
            <div class="field">
              <label for="comment">{{ t('task.addComment') }}</label
              ><textarea id="comment" v-model="content" maxlength="2000" required />
            </div>
            <div class="form-actions">
              <button class="button primary">{{ t('common.save') }}</button>
            </div>
          </form>
          <div
            v-for="comment in comments"
            :key="comment.id"
            style="padding: 16px 0; border-bottom: 1px solid var(--slate-200)"
          >
            <strong>{{ userName(comment.authorId) }}</strong>
            <div v-if="editingCommentId === comment.id" class="field" style="margin-top: 10px">
              <textarea v-model="editingContent" maxlength="2000" aria-label="Edit comment" />
              <div class="row-actions">
                <button class="button primary" @click="saveComment(comment)">
                  {{ t('common.save') }}
                </button>
                <button class="button secondary" @click="editingCommentId = ''">
                  {{ t('common.cancel') }}
                </button>
              </div>
            </div>
            <p v-else style="white-space: pre-wrap">{{ comment.content }}</p>
            <small>{{ new Date(comment.createdAt).toLocaleString() }}</small
            ><span v-if="comment.authorId === auth.user?.id" style="float: right">
              <button
                class="link"
                style="border: 0; background: none"
                @click="startEditing(comment)"
              >
                {{ t('common.edit') }}
              </button>
              <button
                class="link"
                style="border: 0; background: none"
                @click="removeComment(comment)"
              >
                {{ t('common.remove') }}
              </button>
            </span>
          </div>
          <p v-if="!comments.length" style="color: var(--slate-500)">{{ t('common.noData') }}</p>
        </div>
      </aside>
    </div></template
  >
</template>
