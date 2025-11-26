<template>
  <div class="manager-dash">
    
    <header class="dash-header">
      <div class="title-group">
        <h1>👨‍💼 Manager Mode</h1>
        <p class="subtitle">{{ outlet.name }}</p>
      </div>
      <button class="logout-btn" @click="$emit('exit')">Exit</button>
    </header>

    <div class="tabs">
      <button :class="{ active: currentTab === 'roster' }" @click="currentTab = 'roster'">
        👥 Team
      </button>
      <button :class="{ active: currentTab === 'menu' }" @click="currentTab = 'menu'">
        🍔 Menu
      </button>
      <button :class="{ active: currentTab === 'eval' }" @click="currentTab = 'eval'">
        📝 Eval
      </button>
    </div>

    <div class="tab-content">
      
      <ManagerRoster 
        v-if="currentTab === 'roster'" 
        :outletId="outlet.id" 
      />

      <ManagerMenu 
        v-else-if="currentTab === 'menu'" 
        :outletId="outlet.id" 
      />

      <ManagerEval 
        v-else-if="currentTab === 'eval'"
        :outletId="outlet.id"
        :managerId="user.id"
      />

    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue';
import ManagerMenu from './ManagerMenu.vue';
import ManagerRoster from './ManagerRoster.vue';
import ManagerEval from './ManagerEval.vue'; // IMPORTED HERE

const props = defineProps(['user', 'outlet']);
const emit = defineEmits(['exit']);

const currentTab = ref('eval'); // Set default to 'eval' for testing
</script>

<style scoped>
/* (Keep existing styles) */
.manager-dash { padding-bottom: 50px; }
.dash-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; background: #333; padding: 15px; border-radius: 12px; }
.title-group h1 { margin: 0; color: white; font-size: 1.2rem; }
.subtitle { margin: 0; color: #aaa; font-size: 0.9rem; }
.logout-btn { background: #444; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; }

.tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #444; padding-bottom: 10px; }
.tabs button { background: transparent; border: none; color: #888; font-size: 1rem; padding: 10px 20px; cursor: pointer; font-weight: bold; border-radius: 8px; transition: 0.2s; }
.tabs button.active { background: #4a90e2; color: white; }
.tabs button:hover:not(.active) { background: #333; }

.tab-content { animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>