<template>
  <div class="dojo">
    <div class="mode-badge" :class="modeType">
      {{ modeType === 'study' ? '📖 Study Mode' : '🔥 Self Assessment' }}
    </div>

    <div v-if="stage === 'select'" class="category-select">
      <h2>Pick a Topic</h2>
      <div class="category-grid">
        <button 
          v-for="cat in categories" 
          :key="cat.id" 
          class="cat-btn" 
          @click="startSession(cat.id)"
        >
          {{ cat.name }}
        </button>
      </div>
      <button class="back-btn" @click="$emit('exit')">Back to Dashboard</button>
    </div>

    <div v-else-if="stage === 'train' && currentCard" class="card-display">
      <div class="progress-bar">Card {{ currentIndex + 1 }} / {{ deck.length }}</div>

      <div class="scene">
        <div class="flashcard" :class="{ 'is-flipped': isFlipped }" @click="flipCard">
          
          <div class="card-face front">
            
            <div v-if="showHint" class="hint-overlay">
              <img :src="getCardImg(currentCard)" />
            </div>

            <div class="card-content" v-html="currentCard.front_text"></div>
            
            <div class="front-actions">
              <button class="speak-btn-mini" @click.stop="speak(currentCard.front_text)">🔊</button>
              
              <button 
                v-if="currentCard.image" 
                class="btn-peek" 
                @click.stop="peekImage"
              >
                👁️ Peek (3s)
              </button>
            </div>

            <p class="hint">Tap to flip ↻</p>
          </div>

          <div class="card-face back">
            <div class="scroll-content">
              <img v-if="currentCard.image" :src="getCardImg(currentCard)" class="card-img" />
              <div class="answer" v-html="currentCard.back_text"></div>
              <button class="speak-btn" @click.stop="speak(currentCard.back_text)">🔊 Listen</button>
            </div>
            
            <div class="actions">
              <template v-if="modeType === 'assessment'">
                <button class="btn-miss" @click.stop="handleResult(false)">Missed it 😬</button>
                <button class="btn-got" @click.stop="handleResult(true)">Got it! 😎</button>
              </template>

              <template v-else>
                 <button class="btn-next" @click.stop="nextCard">Next Card ➔</button>
              </template>
            </div>
          </div>
        </div>
      </div>
      <button class="quit-btn" @click="quitSession">Quit Session</button>
    </div>

    <div v-else class="complete">
      <h2>Session Complete! 🎉</h2>
      <p v-if="modeType === 'assessment'">Streak Updated.</p>
      <button @click="stage = 'select'" class="cat-btn">Study Something Else</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import pb from '../pocketbase';

const props = defineProps(['user', 'modeType']);
const emit = defineEmits(['exit', 'updateUser']);

const stage = ref('select'); 
const allCards = ref([]);
const deck = ref([]);
const currentIndex = ref(0);
const isFlipped = ref(false);

// Hint Logic
const showHint = ref(false);
let hintTimer = null;

onMounted(async () => {
  try {
    const userOutletId = props.user.outlet;
    const filterString = `is_active = true && (outlet = "${userOutletId}" || outlet = "")`;

    // UPDATE: Added expand: 'category' to fetch the names
    allCards.value = await pb.collection('cards').getFullList({ 
      filter: filterString,
      expand: 'category' 
    });
  } catch (err) { console.error("Error loading cards:", err); }
});

// UPDATE: COMPUTED CATEGORIES to map ID -> Name
const categories = computed(() => {
  const uniqueMap = new Map();
  
  allCards.value.forEach(card => {
    // Check if relation exists
    const catId = card.category;
    const catData = card.expand?.category;
    
    if (catId && catData) {
      // Use the field 'category' from the relation (as verified in ManagerMenu)
      // Fallback to 'name' or 'Unknown' just in case
      const catName = catData.category || catData.name || 'Unknown';
      
      if (!uniqueMap.has(catId)) {
        uniqueMap.set(catId, catName);
      }
    }
  });

  // Return array of objects for the template: [{id: '...', name: '...'}, ...]
  return Array.from(uniqueMap.entries()).map(([id, name]) => ({ id, name }));
});

const currentCard = computed(() => deck.value[currentIndex.value]);

const startSession = (categoryId) => {
  // Filter by the ID passed from the button
  let selected = allCards.value.filter(c => c.category === categoryId);
  deck.value = selected.sort(() => Math.random() - 0.5);
  currentIndex.value = 0;
  isFlipped.value = false;
  showHint.value = false;
  stage.value = 'train';
};

const getCardImg = (card) => {
  if (!card.image) return '';
  return pb.files.getUrl(card, card.image);
};

// --- HINT (PEEK) LOGIC ---
const peekImage = () => {
  if (!currentCard.value.image) return;
  showHint.value = true;
  if (hintTimer) clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { showHint.value = false; }, 3000);
};

// --- TTS LOGIC ---
const synth = window.speechSynthesis;
const speak = (rawHtml) => {
  synth.cancel();
  const cleanText = rawHtml.replace(/<[^>]*>?/gm, '');
  const utterance = new SpeechSynthesisUtterance(cleanText);
  synth.speak(utterance);
};
const stopSpeaking = () => synth.cancel();

// --- NAVIGATION LOGIC ---
const flipCard = () => {
  stopSpeaking();
  showHint.value = false;
  if (hintTimer) clearTimeout(hintTimer);
  isFlipped.value = !isFlipped.value;
}

const quitSession = () => {
  stopSpeaking();
  stage.value = 'select';
}

const nextCard = () => {
  stopSpeaking();
  if (currentIndex.value < deck.value.length - 1) {
    currentIndex.value++;
    isFlipped.value = false;
    showHint.value = false;
  } else {
    stage.value = 'done';
  }
};

const handleResult = async (success) => {
  stopSpeaking();
  const card = currentCard.value;
  
  await pb.collection('activity_logs').create({
    user: props.user.id,
    card: card.id,
    result: success ? 'pass' : 'fail'
  });

  let newStreak = props.user.current_streak;
  if (success) newStreak++;
  else newStreak = 0; 

  try {
    const updatedUser = await pb.collection('users').update(props.user.id, { current_streak: newStreak });
    emit('updateUser', updatedUser);
  } catch (err) { console.error(err); }

  nextCard();
};

onUnmounted(() => {
  stopSpeaking();
  if (hintTimer) clearTimeout(hintTimer);
});
</script>

<style scoped>
.dojo { display: flex; flex-direction: column; align-items: center; width: 100%; }

.mode-badge {
  background: #333; color: #fff; padding: 5px 15px; border-radius: 20px; font-size: 0.8rem; margin-bottom: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;
}
.mode-badge.study { color: #a29bfe; border: 1px solid #a29bfe; }
.mode-badge.assessment { color: #fab1a0; border: 1px solid #fab1a0; }

.category-select h2 { color: white; margin-bottom: 20px; }
.category-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; width: 100%; max-width: 400px; }
.cat-btn { padding: 20px; background: #3d3d4a; color: white; border: 2px solid #3d3d4a; border-radius: 12px; font-size: 1.1rem; cursor: pointer; transition: 0.2s; word-wrap: break-word;}
.cat-btn:hover { border-color: #4a90e2; background: #444; }
.back-btn { background: transparent; border: none; color: #888; text-decoration: underline; cursor: pointer; margin-top: 20px;}

.progress-bar { color: #888; margin-bottom: 15px; font-weight: bold; letter-spacing: 1px; }

/* 3D SCENE - RESPONSIVE FIX */
.scene {
  width: 85vw; max-width: 340px; min-width: 280px;
  height: 60vh; min-height: 450px;
  perspective: 1000px; margin: 20px auto;
}
.flashcard { width: 100%; height: 100%; position: relative; transition: transform 0.6s; transform-style: preserve-3d; cursor: pointer; }
.flashcard.is-flipped { transform: rotateY(180deg); }

.card-face { position: absolute; width: 100%; height: 100%; backface-visibility: hidden; border-radius: 20px; background: white; color: #333; box-shadow: 0 10px 25px rgba(0,0,0,0.5); display: flex; flex-direction: column; padding: 25px; box-sizing: border-box; }

.front { z-index: 2; transform: rotateY(0deg); align-items: center; justify-content: center; text-align: center; }
.card-content { font-size: 1.8rem; font-weight: bold; line-height: 1.4; word-wrap: break-word; }
.hint { position: absolute; bottom: 20px; color: #aaa; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; }

.front-actions { display: flex; gap: 15px; align-items: center; margin-top: 20px; z-index: 10; }
.btn-peek { background: #ff9f43; color: white; border: none; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-size: 0.9rem; font-weight: bold; box-shadow: 0 4px 0 #e58e26; transition: 0.2s; }
.btn-peek:active { transform: translateY(4px); box-shadow: none; }

.hint-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: white; border-radius: 20px; display: flex; align-items: center; justify-content: center; z-index: 20; padding: 10px; box-sizing: border-box; animation: fadeIn 0.3s ease; }
.hint-overlay img { max-width: 100%; max-height: 100%; border-radius: 10px; object-fit: contain; box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
@keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

.back { transform: rotateY(180deg); justify-content: space-between; }
.scroll-content { flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; overflow-y: auto; text-align: center; }
.card-img { max-width: 100%; max-height: 25vh; border-radius: 8px; margin-bottom: 15px; object-fit: contain; }
.answer { font-size: 1.4rem; font-weight: bold; color: #222; margin-bottom: 15px; word-wrap: break-word; }
.speak-btn { background: #eee; border: 1px solid #ccc; border-radius: 20px; padding: 8px 16px; font-size: 0.9rem; cursor: pointer; margin-top: 10px; display: inline-flex; align-items: center; gap: 5px; transition: 0.2s; }
.speak-btn:active { background: #ddd; transform: scale(0.95); }
.speak-btn-mini { background: transparent; border: none; font-size: 1.5rem; cursor: pointer; opacity: 0.5; }
.speak-btn-mini:hover { opacity: 1; }

.actions { display: flex; gap: 15px; width: 100%; margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; }
.btn-miss { flex: 1; background: #ff5252; color: white; border: none; padding: 12px; border-radius: 12px; font-weight: bold; font-size: 1rem; cursor: pointer; box-shadow: 0 4px 0 #c62828; }
.btn-got { flex: 1; background: #4caf50; color: white; border: none; padding: 12px; border-radius: 12px; font-weight: bold; font-size: 1rem; cursor: pointer; box-shadow: 0 4px 0 #2e7d32; }
.btn-miss:active, .btn-got:active { transform: translateY(4px); box-shadow: none; }
.quit-btn { background: transparent; color: #666; border: 1px solid #444; padding: 8px 16px; border-radius: 20px; margin-top: 20px; cursor: pointer; }

.btn-next { width: 100%; background: #6c5ce7; color: white; border: none; padding: 15px; border-radius: 12px; font-weight: bold; font-size: 1.1rem; cursor: pointer; box-shadow: 0 4px 0 #4834d4; }
.btn-next:active { transform: translateY(4px); box-shadow: none; }
</style>