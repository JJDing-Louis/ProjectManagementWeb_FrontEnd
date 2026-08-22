<template>
  <div class="auth-layout">
    <section class="auth-hero">
      <div class="auth-brand">◆ ProjectManagementWeb</div>
      <div class="auth-quote">
        <h1>Move work forward, together.</h1>
        <p>從目標、成員到每一項 Task，讓團隊在同一個清楚的工作空間保持同步。</p>
      </div>
      <small>Project management workspace · Vue 3 demo</small>
    </section>
    <section class="auth-panel">
      <div class="auth-card"><slot /></div>
    </section>
  </div>
</template>
