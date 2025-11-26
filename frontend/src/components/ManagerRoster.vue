<template>
  <div class="manager-roster">
    
    <div class="roster-controls">
      <input 
        v-model="search" 
        placeholder="🔍 Find Staff..." 
        class="search-input" 
      />
      <button class="btn-toggle-pin" @click="showPins = !showPins">
        {{ showPins ? '🙈 Hide PINs' : '👁️ Show PINs' }}
      </button>
    </div>

    <div v-if="loading" class="loading">Loading Team...</div>

    <div v-else class="staff-list">
      <div v-for="user in filteredStaff" :key="user.id" class="staff-row">
        
        <div class="staff-info">
          <img :src="getAvatarUrl(user)" class="avatar" />
          <div class="details">
            <div class="name">
              {{ user.name }}
              <span v-if="user.current_streak > 0" class="streak-badge">
                🔥 {{ user.current_streak }}
              </span>
            </div>
            
            <div class="meta">
              <span v-if="showPins" class="pin-text">PIN: {{ user.pin }}</span>
              <span v-else class="pin-hidden">PIN: ••••</span>
            </div>
          </div>
        </div>

        <div class="actions">
          <button class="btn-icon edit" @click="openModal(user)">✏️</button>
          <button 
            v-if="user.id !== currentUser" 
            class="btn-icon delete" 
            @click="kickUser(user)"
          >
            🚫
          </button>
        </div>
      </div>
    </div>

    <div v-if="showModal" class="modal-backdrop">
      <div class="modal">
        <h3>Edit Staff</h3>
        
        <div class="form-group">
          <label>Name</label>
          <input v-model="form.name" type="text" />
        </div>

        <div class="form-group">
          <label>PIN (4 Digits)</label>
          <input v-model="form.pin" type="tel" maxlength="4" />
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" @click="showModal = false">Cancel</button>
          <button class="btn-save" @click="saveUser">Save Changes</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import pb from '../pocketbase';

const props = defineProps(['outletId']);

// STATE
const staffList = ref([]);
const loading = ref(true);
const search = ref('');
const showPins = ref(false);
const currentUser = pb.authStore.model?.id; // To prevent self-deletion

// MODAL STATE
const showModal = ref(false);
const editingUser = ref(null);
const form = ref({ name: '', pin: '' });

// LOAD DATA
onMounted(async () => {
  await loadStaff();
});

const loadStaff = async () => {
  try {
    // Fetch users for this outlet, sort by name
    staffList.value = await pb.collection('users').getFullList({
      filter: `outlet = "${props.outletId}"`,
      sort: 'name'
    });
  } catch (err) {
    console.error("Error loading staff", err);
  } finally {
    loading.value = false;
  }
};

// COMPUTED
const filteredStaff = computed(() => {
  if (!search.value) return staffList.value;
  return staffList.value.filter(u => 
    u.name.toLowerCase().includes(search.value.toLowerCase())
  );
});

// ACTIONS
const getAvatarUrl = (user) => {
  if (user.avatar) return pb.files.getUrl(user, user.avatar, { thumb: '100x100' });
  return `https://ui-avatars.com/api/?name=${user.name}&background=random&color=fff`;
};

const kickUser = async (user) => {
  if (!confirm(`Are you sure you want to remove ${user.name} from this outlet?`)) return;
  
  try {
    await pb.collection('users').delete(user.id);
    staffList.value = staffList.value.filter(u => u.id !== user.id);
  } catch (err) {
    console.error("Delete failed", err);
    alert("Error removing user");
  }
};

// MODAL LOGIC
const openModal = (user) => {
  editingUser.value = user;
  form.value = { name: user.name, pin: user.pin };
  showModal.value = true;
};

const saveUser = async () => {
  if (form.value.pin.toString().length !== 4) return alert("PIN must be 4 digits");
  
  try {
    await pb.collection('users').update(editingUser.value.id, {
      name: form.value.name,
      pin: parseInt(form.value.pin)
    });
    
    // Update local list
    const index = staffList.value.findIndex(u => u.id === editingUser.value.id);
    if (index !== -1) {
      staffList.value[index].name = form.value.name;
      staffList.value[index].pin = parseInt(form.value.pin);
    }
    
    showModal.value = false;
  } catch (err) {
    console.error("Update failed", err);
    alert("Error saving user");
  }
};
</script>

<style scoped>
.manager-roster { padding: 10px; }

/* CONTROLS */
.roster-controls { display: flex; gap: 10px; margin-bottom: 20px; }
.search-input { flex: 1; padding: 12px; border-radius: 8px; border: none; background: #2b2b35; color: white; font-size: 1rem; }
.btn-toggle-pin { background: #3d3d4a; color: #fff; border: 1px solid #555; border-radius: 8px; padding: 0 15px; cursor: pointer; white-space: nowrap; }

/* LIST */
.staff-list { display: flex; flex-direction: column; gap: 10px; }
.staff-row { background: #2b2b35; padding: 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; }

.staff-info { display: flex; align-items: center; gap: 15px; }
.avatar { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid #444; }
.name { color: white; font-weight: bold; font-size: 1.1rem; }
.streak-badge { font-size: 0.8rem; color: #ffd700; margin-left: 5px; }
.meta { font-size: 0.9rem; margin-top: 4px; color: #aaa; }
.pin-text { color: #4a90e2; font-family: monospace; font-weight: bold; letter-spacing: 1px; }

.actions { display: flex; gap: 10px; }
.btn-icon { background: rgba(255,255,255,0.1); border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; transition: 0.2s; }
.btn-icon.delete:hover { background: #ff5252; color: white; }
.btn-icon.edit:hover { background: #4a90e2; color: white; }

/* MODAL */
.modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; z-index: 100; }
.modal { background: #2b2b35; padding: 25px; border-radius: 15px; width: 90%; max-width: 350px; text-align: left; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
.modal h3 { margin-top: 0; color: white; }
.form-group { margin-bottom: 15px; }
.form-group label { display: block; color: #aaa; margin-bottom: 5px; font-size: 0.9rem; }
.form-group input { width: 100%; padding: 12px; background: #1e1e24; border: 1px solid #444; color: white; border-radius: 6px; box-sizing: border-box; font-size: 1.1rem; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.btn-cancel { background: transparent; color: #aaa; border: 1px solid #444; padding: 10px 15px; border-radius: 8px; cursor: pointer; }
.btn-save { background: #4a90e2; color: white; border: none; padding: 10px 15px; border-radius: 8px; cursor: pointer; font-weight: bold; }
</style>