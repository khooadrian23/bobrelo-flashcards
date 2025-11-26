<template>
  <div class="manager-menu">
    
    <div class="menu-controls">
      <div class="filter-group">
        <select v-model="filterCategory">
          <option value="">All Categories</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">
            {{ cat.category }}
          </option>
        </select>
      </div>
      <button class="btn-add" @click="openModal(null)">+ New Card</button>
    </div>

    <div v-if="loading" class="loading">Loading Menu...</div>
    
    <div v-else class="card-list">
      <div v-for="card in filteredCards" :key="card.id" class="menu-item">
        
        <div class="item-thumb" @click="openPreview(card)" title="Click to Preview">
          <img v-if="card.image" :src="getCardImg(card)" />
          <span v-else>👁️</span>
          <div class="thumb-overlay">Preview</div>
        </div>

        <div class="item-info">
          <span class="category-tag">{{ getCategoryName(card.category) }}</span>
          <div class="item-text" v-html="truncate(card.front_text, 40)"></div>
        </div>

        <div class="item-actions">
          <label class="switch">
            <input 
              type="checkbox" 
              :checked="card.is_active" 
              @change="toggleActive(card)"
            >
            <span class="slider round"></span>
          </label>
          
          <button class="btn-icon edit" @click="openModal(card)">✏️</button>
          <button class="btn-icon delete" @click="deleteCard(card)">🗑️</button>
        </div>
      </div>
    </div>

    <div v-if="showModal" class="modal-backdrop">
      <div class="modal">
        <h3>{{ editingCard ? 'Edit Card' : 'New Card' }}</h3>
        
        <div class="form-group">
          <label>Category</label>
          <select v-model="form.category" class="locked-select">
            <option disabled value="">Select a Category...</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.category }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>Front Text (Question)</label>
          <textarea v-model="form.front_text" rows="2"></textarea>
        </div>

        <div class="form-group">
          <label>Back Text (Answer)</label>
          <textarea v-model="form.back_text" rows="3"></textarea>
        </div>

        <div class="form-group">
          <label>Image (Optional)</label>
          <input type="file" @change="handleFileChange" accept="image/*" />
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" @click="closeModal">Cancel</button>
          <button class="btn-save" @click="saveCard">{{ isSaving ? 'Saving...' : 'Save Card' }}</button>
        </div>
      </div>
    </div>

    <div v-if="showPreview" class="preview-backdrop" @click.self="closePreview">
      <div class="preview-container">
        <h3 style="color:white; margin-bottom: 20px;">Staff Preview</h3>
        
        <div class="scene">
          <div 
            class="flashcard" 
            :class="{ 'is-flipped': isPreviewFlipped }" 
            @click="isPreviewFlipped = !isPreviewFlipped"
          >
            <div class="card-face front">
              <div class="card-content" v-html="previewCard.front_text"></div>
              <p class="hint">Tap to flip ↻</p>
            </div>

            <div class="card-face back">
              <div class="scroll-content">
                <img v-if="previewCard.image" :src="getCardImg(previewCard)" class="card-img" />
                <div class="answer" v-html="previewCard.back_text"></div>
              </div>
            </div>
          </div>
        </div>

        <button class="btn-close-preview" @click="closePreview">Close Preview</button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import pb from '../pocketbase';

const props = defineProps(['outletId']); 

const cards = ref([]);
const categories = ref([]); 
const loading = ref(true);
const filterCategory = ref("");

// EDIT MODAL STATE
const showModal = ref(false);
const editingCard = ref(null);
const isSaving = ref(false);
const form = ref({ category: '', front_text: '', back_text: '', image: null });

// PREVIEW MODAL STATE
const showPreview = ref(false);
const previewCard = ref(null);
const isPreviewFlipped = ref(false);

onMounted(async () => {
  await loadData();
});

const loadData = async () => {
  try {
    const catRes = await pb.collection('categories').getFullList({ sort: 'category' });
    categories.value = catRes;
    await loadCards();
  } catch (err) {
    console.error("Error loading data:", err);
  } finally {
    loading.value = false;
  }
};

const loadCards = async () => {
  cards.value = await pb.collection('cards').getFullList({
    filter: `outlet = "${props.outletId}" || outlet = ""`,
    sort: '-created',
    expand: 'category' 
  });
};

const filteredCards = computed(() => {
  if (!filterCategory.value) return cards.value;
  return cards.value.filter(c => c.category === filterCategory.value);
});

// HELPERS
const getCategoryName = (catId) => {
  const cat = categories.value.find(c => c.id === catId);
  if (cat) return cat.category;
  const cardWithExpand = cards.value.find(c => c.category === catId);
  return cardWithExpand?.expand?.category?.category || '...';
};

const getCardImg = (card) => pb.files.getUrl(card, card.image, { thumb: '100x100' });
const truncate = (str, n) => (str && str.length > n) ? str.slice(0, n-1) + '&hellip;' : str;

// ACTIONS
const toggleActive = async (card) => {
  try {
    const newVal = !card.is_active;
    await pb.collection('cards').update(card.id, { is_active: newVal });
    card.is_active = newVal;
  } catch (err) { console.error("Toggle failed", err); }
};

const deleteCard = async (card) => {
  if (!confirm("Delete this card?")) return;
  try {
    await pb.collection('cards').delete(card.id);
    cards.value = cards.value.filter(c => c.id !== card.id);
  } catch (err) { console.error("Delete failed", err); }
};

// EDIT MODAL LOGIC
const openModal = (card) => {
  editingCard.value = card;
  if (card) {
    form.value = { 
      category: card.category, front_text: card.front_text, back_text: card.back_text, image: null 
    };
  } else {
    form.value = { category: '', front_text: '', back_text: '', image: null };
  }
  showModal.value = true;
};
const closeModal = () => { showModal.value = false; editingCard.value = null; };
const handleFileChange = (event) => { form.value.image = event.target.files[0]; };

const saveCard = async () => {
  if (!form.value.front_text || !form.value.back_text || !form.value.category) return alert("Please fill in all fields.");
  if (!props.outletId) return alert("System Error: No Outlet ID.");
  isSaving.value = true;

  try {
    const data = new FormData();
    data.append('category', form.value.category);
    data.append('front_text', form.value.front_text);
    data.append('back_text', form.value.back_text);
    if (form.value.image) data.append('image', form.value.image);
    data.append('outlet', props.outletId);
    data.append('is_active', true);

    if (editingCard.value) await pb.collection('cards').update(editingCard.value.id, data);
    else await pb.collection('cards').create(data);

    await loadCards();
    closeModal();
  } catch (err) { console.error("Save failed", err); alert("Error saving card."); }
  finally { isSaving.value = false; }
};

// PREVIEW LOGIC
const openPreview = (card) => {
  previewCard.value = card;
  isPreviewFlipped.value = false;
  showPreview.value = true;
};
const closePreview = () => {
  showPreview.value = false;
  previewCard.value = null;
};
</script>

<style scoped>
.manager-menu { padding: 10px; }
.menu-controls { display: flex; justify-content: space-between; margin-bottom: 20px; }
.filter-group select { padding: 10px; border-radius: 8px; border: none; background: #444; color: white; cursor: pointer; }
.btn-add { background: #4caf50; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; }

.card-list { display: flex; flex-direction: column; gap: 10px; }
.menu-item { display: flex; align-items: center; background: #2b2b35; padding: 10px; border-radius: 8px; gap: 15px; }

/* THUMBNAIL STYLE UPDATE */
.item-thumb { 
  width: 60px; height: 60px; background: #333; border-radius: 6px; 
  display: flex; align-items: center; justify-content: center; 
  overflow: hidden; position: relative; cursor: pointer; border: 2px solid #444;
}
.item-thumb img { width: 100%; height: 100%; object-fit: cover; }
.thumb-overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.6); color: white; font-size: 0.6rem;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: 0.2s; font-weight: bold; text-transform: uppercase;
}
.item-thumb:hover .thumb-overlay { opacity: 1; }
.item-thumb:hover { border-color: #4a90e2; }

.item-info { flex: 1; text-align: left; }
.category-tag { font-size: 0.75rem; background: #444; color: #aaa; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; }
.item-text { color: white; font-weight: bold; margin-top: 4px; font-size: 0.95rem; }
.item-actions { display: flex; align-items: center; gap: 10px; }
.btn-icon { background: none; border: none; cursor: pointer; font-size: 1.2rem; }
.locked-select { width: 100%; padding: 10px; background: #1e1e24; border: 1px solid #4a90e2; color: white; border-radius: 6px; cursor: pointer; font-size: 1rem; }

/* TOGGLE SWITCH */
.switch { position: relative; display: inline-block; width: 40px; height: 24px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #555; transition: .4s; border-radius: 34px; }
.slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; }
input:checked + .slider { background-color: #4caf50; }
input:checked + .slider:before { transform: translateX(16px); }

/* EDIT MODAL */
.modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; z-index: 100; }
.modal { background: #2b2b35; padding: 25px; border-radius: 15px; width: 90%; max-width: 400px; text-align: left; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
.modal h3 { margin-top: 0; color: white; }
.form-group { margin-bottom: 15px; }
.form-group label { display: block; color: #aaa; margin-bottom: 5px; font-size: 0.9rem; }
.form-group input, .form-group textarea { width: 100%; padding: 10px; background: #1e1e24; border: 1px solid #444; color: white; border-radius: 6px; box-sizing: border-box; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.btn-cancel { background: transparent; color: #aaa; border: 1px solid #444; padding: 10px 15px; border-radius: 8px; cursor: pointer; }
.btn-save { background: #4a90e2; color: white; border: none; padding: 10px 15px; border-radius: 8px; cursor: pointer; font-weight: bold; }

/* PREVIEW MODAL & 3D SCENE */
.preview-backdrop { 
  position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
  background: rgba(0,0,0,0.95); /* Darker bg for focus */
  display: flex; justify-content: center; align-items: center; z-index: 200; 
  padding: 20px; /* Add padding so card doesn't touch edges */
}
.preview-container { 
  width: 100%; 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
}
.btn-close-preview { margin-top: 20px; background: #444; color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; font-weight: bold; }

/* COPY OF DOJO STYLES FOR PREVIEW */
.scene { 
  width: 100%; 
  max-width: 320px; 
  height: 60vh; /* Slightly smaller for preview */
  perspective: 1000px; 
}
.flashcard { width: 100%; height: 100%; position: relative; transition: transform 0.6s; transform-style: preserve-3d; cursor: pointer; }
.flashcard.is-flipped { transform: rotateY(180deg); }
.card-face { position: absolute; width: 100%; height: 100%; backface-visibility: hidden; border-radius: 20px; background: white; color: #333; box-shadow: 0 10px 25px rgba(0,0,0,0.5); display: flex; flex-direction: column; padding: 25px; box-sizing: border-box; }
.front { z-index: 2; transform: rotateY(0deg); align-items: center; justify-content: center; text-align: center; }
.card-content { font-size: 1.8rem; font-weight: bold; line-height: 1.4; word-wrap: break-word; }
.hint { position: absolute; bottom: 20px; color: #aaa; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; }
.back { transform: rotateY(180deg); justify-content: center; }
.scroll-content { flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; overflow-y: auto; text-align: center; }
.card-img { max-width: 100%; max-height: 150px; border-radius: 8px; margin-bottom: 15px; object-fit: contain; }
.answer { font-size: 1.4rem; font-weight: bold; color: #222; margin-bottom: 15px; word-wrap: break-word; }
</style>