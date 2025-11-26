<script setup>
import { ref } from 'vue';
import ManagerDash from './components/ManagerDash.vue';
import LockerRoom from './components/LockerRoom.vue';
import Dojo from './components/Dojo.vue';

// STATE
const currentUser = ref(null);
const isManager = ref(false);
const showDojo = ref(false);
const dojoMode = ref('study'); // 'study' or 'assessment'

// ACTIONS
const handleLogin = (user) => {
  console.log("Logged in:", user.name, "Position:", user.position);
  currentUser.value = user;
  
  // 1. Check if user is a Manager based on DB field 'position'
  if (user.position === 'manager') {
    isManager.value = true;
  } else {
    isManager.value = false;
  }
};

const handleLogout = () => {
  currentUser.value = null;
  isManager.value = false;
  showDojo.value = false;
};

const enterDojo = (mode) => {
  dojoMode.value = mode;
  showDojo.value = true;
};
</script>

<template>
  <div class="app-container">
    
    <LockerRoom v-if="!currentUser" @login="handleLogin" />

    <div v-else>

      <ManagerDash 
        v-if="isManager" 
        :user="currentUser" 
        :outlet="currentUser.expand?.outlet || {}" 
        @exit="handleLogout"
      />

      <div v-else>
        
        <div v-if="!showDojo" class="dashboard">
          <header class="dash-header">
            <div class="user-info">
               <h1>Hi, {{ currentUser.name }}</h1>
               <p class="streak">🔥 Streak: {{ currentUser.current_streak }}</p>
            </div>
            <button class="logout-btn" @click="handleLogout">Log Out</button>
          </header>

          <div class="menu-grid">
            <button class="big-btn study" @click="enterDojo('study')">
              <span>📖</span>
              Study Mode
            </button>
            
            <button class="big-btn assess" @click="enterDojo('assessment')">
              <span>🔥</span>
              Self Assessment
            </button>

            <button class="big-btn secondary" disabled>
              <span>🏆</span>
              Leaderboard
            </button>
          </div>
        </div>

        <Dojo 
          v-else 
          :user="currentUser" 
          :modeType="dojoMode" 
          @exit="showDojo = false" 
          @updateUser="(u) => currentUser = u" 
        />

      </div>

    </div>
  </div>
</template>

<style>

/* GLOBAL THEME */
body { 
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: #1e1e24;
  color: #f0f0f0;
  margin: 0; 
  padding: 0;
  /* CRITICAL FOR MOBILE: Prevents horizontal scroll if padding is added */
  box-sizing: border-box; 
}

*, *:before, *:after {
  box-sizing: inherit;
}

.app-container { 
  width: 100%; /* Change from max-width to width 100% initially */
  max-width: 600px;
  margin: 0 auto; 
  padding: 15px; /* Reduced padding for small screens */
  min-height: 100vh;
  display: flex; /* Centers content vertically if needed */
  flex-direction: column;
}

/* Make buttons easier to tap on mobile */
button {
  touch-action: manipulation; /* Removes tap delay on some browsers */
}
/* Dashboard Styles */
.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #2b2b35;
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 30px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.3);
}

.user-info h1 { margin: 0; font-size: 1.5rem; color: #fff; }
.streak { margin: 5px 0 0 0; color: #ffd700; font-weight: bold; font-size: 1.1rem; }

.logout-btn {
  background: transparent;
  border: 1px solid #666;
  color: #aaa;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
}

.menu-grid { display: grid; gap: 20px; }

.big-btn {
  background: #4a90e2;
  color: white;
  border: none;
  padding: 30px;
  font-size: 1.5rem;
  border-radius: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  transition: transform 0.1s;
  box-shadow: 0 4px 0 #357abd;
}
.big-btn:active { transform: translateY(4px); box-shadow: none; }
.big-btn.secondary { background: #444; box-shadow: 0 4px 0 #222; color: #888; }
.big-btn.study { background: #6c5ce7; box-shadow: 0 4px 0 #4834d4; }
.big-btn.assess { background: #e17055; box-shadow: 0 4px 0 #d63031; }
</style>