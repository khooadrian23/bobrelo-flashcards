<template>
  <div class="locker-room">
    
    <div class="header">
      <h2>{{ headerTitle }}</h2>
      
      <button 
        v-if="selectedOutlet && mode === 'select'" 
        @click="selectedOutlet = null" 
        class="back-btn-text"
      >
        ← Change Location
      </button>

      <button 
        v-if="mode === 'manager_login'" 
        @click="mode = 'select'; selectedOutlet = null" 
        class="back-btn-text"
      >
        ← Back to Lobby
      </button>
    </div>

    <div v-if="!selectedOutlet && mode !== 'manager_login'" class="outlet-view">
      <p class="instruction">Where are you clocking in?</p>
      
      <div v-if="loadingOutlets" class="loading">Loading locations...</div>
      
      <div v-else class="outlet-grid">
        <button 
          v-for="o in outlets" 
          :key="o.id" 
          class="outlet-card" 
          @click="selectOutlet(o)"
        >
          <img v-if="o.logo" :src="getOutletLogo(o)" class="outlet-logo" />
          <span v-else class="outlet-emoji">🏛️</span>
          <br>
          {{ o.name }}
        </button>
      </div>

      <div class="footer-actions">
        <button class="btn-manager-link" @click="mode = 'manager_login'">
          🔐 Manager Access
        </button>
      </div>
    </div>

    <div v-else-if="mode === 'manager_login'" class="manager-form">
      <div class="form-group">
        <label>Username or Email</label>
        <input 
          v-model="managerIdentity" 
          type="text" 
          placeholder="admin@restaurant.com" 
          @keyup.enter="loginManager"
        />
      </div>

      <div class="form-group">
        <label>Password</label>
        <input 
          v-model="managerPassword" 
          type="password" 
          placeholder="••••••••" 
          @keyup.enter="loginManager"
        />
      </div>

      <div class="actions">
        <button class="btn-save" @click="loginManager" :disabled="isSaving">
          {{ isSaving ? 'Verifying...' : 'Log In' }}
        </button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </div>

    <div v-else-if="mode === 'select'" class="selection-view">
      
      <div class="search-bar">
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="🔍 Find your name..." 
        />
      </div>

      <div class="user-grid">
        <div 
          v-for="user in filteredUsers" 
          :key="user.id" 
          class="user-card" 
          @click="selectUser(user)"
        >
          <img :src="getAvatarUrl(user)" alt="Avatar" class="avatar"/>
          <h3>{{ user.name }}</h3>
        </div>
      </div>

      <div class="footer-actions">
        <p>New to the team?</p>
        <button class="btn-register" @click="mode = 'register'">
          Create Profile for {{ selectedOutlet.name }}
        </button>
      </div>
    </div>

    <div v-else-if="mode === 'pin'" class="pin-modal">
      <img :src="getAvatarUrl(selectedUser)" class="avatar-large" />
      <h3>Hi, {{ selectedUser.name }}</h3>
      
      <div class="pin-display">
        <span 
          v-for="n in 4" 
          :key="n" 
          class="dot" 
          :class="{ filled: pinInput.length >= n }"
        ></span>
      </div>
      
      <div class="numpad">
        <button v-for="num in [1,2,3,4,5,6,7,8,9]" :key="num" @click="enterPin(num)">{{ num }}</button>
        <button class="clear" @click="mode = 'select'; pinInput = ''">Back</button>
        <button @click="enterPin(0)">0</button>
        <button class="clear" @click="pinInput = ''">Clear</button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </div>

    <div v-else-if="mode === 'register'" class="register-form">
      <h3>Joining {{ selectedOutlet.name }}</h3>
      
      <div class="form-group">
        <label>Your Name</label>
        <input v-model="newUserName" type="text" placeholder="e.g. Sarah J" />
      </div>

      <div class="form-group">
        <label>Create 4-Digit PIN</label>
        <input v-model="newUserPin" type="tel" maxlength="4" placeholder="e.g. 1234" class="pin-input" />
      </div>

      <div class="actions">
        <button class="btn-cancel" @click="mode = 'select'">Cancel</button>
        <button class="btn-save" :disabled="!isValidRegister" @click="registerUser">
          {{ isSaving ? 'Creating...' : 'Start Training' }}
        </button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import pb from '../pocketbase';

const emit = defineEmits(['login']);

// DATA
const users = ref([]);
const outlets = ref([]); 
const selectedOutlet = ref(null); 
const loadingOutlets = ref(true);

const mode = ref('select'); 
const selectedUser = ref(null);
const searchQuery = ref('');

// PIN Logic
const pinInput = ref('');
const error = ref('');

// Registration Logic
const newUserName = ref('');
const newUserPin = ref('');
const isSaving = ref(false);

// Manager Login Logic
const managerIdentity = ref('');
const managerPassword = ref('');

// INITIAL LOAD
onMounted(async () => {
  try {
    const [userRes, outletRes] = await Promise.all([
      // FIX 1: Add expand: 'outlet' here so we have the data for staff logins
      pb.collection('users').getFullList({ sort: 'name', expand: 'outlet' }),
      pb.collection('outlets').getFullList({ sort: 'name' })
    ]);
    users.value = userRes;
    outlets.value = outletRes;
  } catch (err) {
    console.error("Error loading data:", err);
  } finally {
    loadingOutlets.value = false;
  }
});

// COMPUTED PROPERTIES
const headerTitle = computed(() => {
  if (mode.value === 'manager_login') return 'Manager Login';
  if (!selectedOutlet.value) return 'Select Restaurant';
  if (mode.value === 'register') return 'New Staff Member';
  return `${selectedOutlet.value.name} Team`;
});

const filteredUsers = computed(() => {
  if (!selectedOutlet.value) return [];
  let list = users.value.filter(u => u.outlet === selectedOutlet.value.id);
  
  if (searchQuery.value) {
    list = list.filter(u => u.name.toLowerCase().includes(searchQuery.value.toLowerCase()));
  }
  return list;
});

const isValidRegister = computed(() => {
  return newUserName.value.length > 2 && newUserPin.value.length === 4;
});

// ACTIONS
const selectOutlet = (outletObj) => {
  selectedOutlet.value = outletObj;
  mode.value = 'select';
  searchQuery.value = '';
};

const getOutletLogo = (outlet) => {
  return pb.files.getUrl(outlet, outlet.logo, { thumb: '100x100' });
};

const getAvatarUrl = (user) => {
  if (user && user.avatar) return pb.files.getUrl(user, user.avatar, { thumb: '100x100' });
  const name = user ? user.name : 'User';
  return `https://ui-avatars.com/api/?name=${name}&background=random&color=fff&size=128`;
};

// LOGIN FLOW (STAFF)
const selectUser = (user) => {
  selectedUser.value = user;
  pinInput.value = '';
  error.value = '';
  mode.value = 'pin';
};

const enterPin = (num) => {
  if (pinInput.value.length < 4) pinInput.value += num;
  if (pinInput.value.length === 4) checkPin();
};

const checkPin = () => {
  if (parseInt(pinInput.value) === selectedUser.value.pin) {
    emit('login', selectedUser.value);
  } else {
    error.value = 'Incorrect PIN';
    pinInput.value = '';
  }
};

// MANAGER LOGIN
const loginManager = async () => {
  if (!managerIdentity.value || !managerPassword.value) return;
  isSaving.value = true;
  error.value = '';

  try {
    // FIX 2: Add { expand: 'outlet' } here so the manager gets their outlet data immediately
    const authData = await pb.collection('users').authWithPassword(
      managerIdentity.value,
      managerPassword.value,
      { expand: 'outlet' } 
    );

    if (authData.record.position !== 'manager') {
      error.value = "Access Denied. You are not listed as a Manager.";
      pb.authStore.clear(); 
    } else {
      emit('login', authData.record);
    }
  } catch (err) {
    console.error(err);
    error.value = "Invalid credentials.";
  } finally {
    isSaving.value = false;
  }
};

// REGISTER FLOW
const registerUser = async () => {
  if (!isValidRegister.value) return;
  isSaving.value = true;
  
  try {
    const newUser = await pb.collection('users').create({
      name: newUserName.value,
      pin: parseInt(newUserPin.value),
      outlet: selectedOutlet.value.id,
      position: 'staff',
      email: `${newUserName.value.replace(/\s/g, '')}.${Date.now()}@local.temp`, 
      password: 'password123', 
      passwordConfirm: 'password123',
      current_streak: 0
    });
    
    // We need to fetch the fresh user WITH expand to login correctly immediately after signup
    const freshUser = await pb.collection('users').getOne(newUser.id, { expand: 'outlet' });
    emit('login', freshUser);

  } catch (err) {
    console.error(err);
    error.value = "Error creating user. Try again.";
  } finally {
    isSaving.value = false;
  }
};
</script>

<style scoped>
.locker-room { color: white; padding-bottom: 50px; text-align: center; }
.header { position: relative; margin-bottom: 20px; }
.header h2 { margin: 0; color: #fff; }
.back-btn-text { background: none; border: none; color: #aaa; cursor: pointer; font-size: 0.9rem; margin-top: 5px; text-decoration: underline; }
.back-btn-text:hover { color: #fff; }

.loading { color: #888; font-style: italic; margin-top: 30px; }

/* OUTLET SELECTOR */
.instruction { color: #aaa; margin-bottom: 20px; }
.outlet-grid, .user-grid {
  /* Change minmax(130px) to minmax(100px) for better fit on small phones */
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); 
  gap: 10px;
}
.outlet-card {
  padding: 15px; /* Reduce padding slightly */
  min-height: 100px;
}
.outlet-card:hover { border-color: #4a90e2; background: #444; transform: translateY(-5px); }
.outlet-logo { width: 60px; height: 60px; object-fit: contain; margin-bottom: 10px; }
.outlet-emoji { font-size: 3rem; display: block; margin-bottom: 10px; }

/* SEARCH & USER GRID */
.search-bar input {
  width: 100%; max-width: 300px; padding: 15px; border-radius: 30px;
  border: none; background: #2b2b35; color: white; font-size: 1.1rem; text-align: center;
  box-shadow: 0 4px 6px rgba(0,0,0,0.2); margin-bottom: 20px;
}
.search-bar input:focus { outline: 2px solid #4a90e2; }

.user-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 15px;
  max-height: 400px; overflow-y: auto; padding: 10px;
}
.user-card {
  background: #2b2b35; border: 1px solid #3d3d4a; padding: 15px 10px; border-radius: 12px;
  text-align: center; cursor: pointer; transition: 0.2s;
}
.user-card:hover { border-color: #4a90e2; transform: translateY(-3px); }
.avatar { width: 60px; height: 60px; border-radius: 50%; margin-bottom: 10px; object-fit: cover; border: 2px solid #333; }
.avatar-large { width: 100px; height: 100px; border-radius: 50%; margin-bottom: 20px; border: 4px solid #4a90e2; }

/* PIN & NUMPAD */
.pin-modal { max-width: 320px; margin: 0 auto; }
.pin-display { 
  font-size: 3rem; 
  margin-bottom: 20px; 
  height: auto;
  min-height: 40px;
  display: flex; 
  justify-content: center; 
  gap: 15px;
  flex-wrap: wrap; /* Allow wrapping just in case, though unlikely */
}
.dot { width: 15px; height: 15px; border-radius: 50%; background: #444; transition: 0.2s; }
.dot.filled { background: #4a90e2; box-shadow: 0 0 10px #4a90e2; }

.numpad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 20px; }
.numpad button { padding: 20px; font-size: 1.5rem; border-radius: 12px; border: none; background: #3d3d4a; color: white; cursor: pointer; box-shadow: 0 4px 0 #222; }
.numpad button:active { transform: translateY(4px); box-shadow: none; }
.numpad button.clear { font-size: 1rem; background: #2b2b35; color: #aaa; }

/* COMMON FORM STYLES (Register + Manager) */
.register-form, .manager-form { max-width: 300px; margin: 0 auto; text-align: left; }
.form-group { margin-bottom: 20px; }
.form-group label { display: block; color: #888; margin-bottom: 5px; font-size: 0.9rem; }
.form-group input { width: 100%; padding: 15px; background: #2b2b35; border: 1px solid #444; color: white; border-radius: 8px; font-size: 1.1rem; box-sizing: border-box; }
.btn-save { width: 100%; background: #4caf50; color: white; border: none; padding: 15px; border-radius: 8px; font-size: 1.1rem; cursor: pointer; margin-top: 10px; font-weight: bold; }
.btn-cancel { width: 100%; background: transparent; color: #888; border: 1px solid #444; padding: 10px; border-radius: 8px; cursor: pointer; margin-top: 10px;}
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
.error { color: #ff5252; text-align: center; margin-top: 15px; font-weight: bold;}

.footer-actions { margin-top: 30px; border-top: 1px solid #333; padding-top: 20px; }
.btn-register { background: transparent; border: 1px solid #4a90e2; color: #4a90e2; padding: 10px 20px; border-radius: 20px; cursor: pointer; transition: 0.2s; }
.btn-register:hover { background: #4a90e2; color: white; }

.btn-manager-link { background: transparent; border: none; color: #666; cursor: pointer; font-size: 0.9rem; text-decoration: underline; margin-top: 20px; }
.btn-manager-link:hover { color: #aaa; }
</style>