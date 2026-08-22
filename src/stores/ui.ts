import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(false)
  const toast = ref('')
  let toastTimer: number | undefined

  function notify(message: string) {
    toast.value = message
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => (toast.value = ''), 3500)
  }

  return { sidebarOpen, toast, notify }
})
