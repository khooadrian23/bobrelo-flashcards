<template>
  <div class="manager-eval">

    <div v-if="stage === 'select'" class="selection-view">
      <h3>Who are we testing?</h3>
      <div v-if="loading" class="loading">Loading Team...</div>
      
      <div v-else class="staff-grid">
        <button 
          v-for="user in staffList" 
          :key="user.id" 
          class="staff-card"
          @click="startSetup(user)"
        >
          <img :src="getAvatarUrl(user)" class="avatar" />
          <div class="name">{{ user.name }}</div>
          <div class="streak">🔥 {{ user.current_streak }}</div>
        </button>
      </div>
    </div>

    <div v-else-if="stage === 'testing'" class="testing-view">
      
      <div class="test-header">
        <div class="test-info">
          Testing: <strong>{{ targetUser.name }}</strong>
          <span class="counter">{{ currentIndex + 1 }} / {{ deck.length }}</span>
        </div>
        <button class="btn-abort" @click="stage = 'select'">Abort</button>
      </div>

      <div class="eval-card">
        
        <div class="question-section">
          <span class="label">Ask Them:</span>
          <div class="text-large" v-html="currentCard.front_text"></div>
        </div>

        <div v-if="isRevealed" class="answer-section">
          <hr />
          <span class="label">Answer:</span>
          
          <div class="answer-content">
             <img v-if="currentCard.image" :src="getCardImg(currentCard)" class="answer-img" />
             <div class="text-medium" v-html="currentCard.back_text"></div>
          </div>
        </div>

      </div>

      <div class="controls">
        <button v-if="!isRevealed" class="btn-reveal" @click="isRevealed = true">
          👁️ Reveal Answer
        </button>
        
        <div v-else class="grading-btns">
          <button class="btn-fail" @click="submitGrade(false)">❌ Fail</button>
          <button class="btn-pass" @click="submitGrade(true)">✅ Pass</button>
        </div>
      </div>

    </div>

    <div v-else-if="stage === 'summary'" class="summary-view">
      <div class="summary-card">
        <h2>Evaluation Complete</h2>
        <div class="score-display">
          {{ score }} / {{ deck.length }}
        </div>
        
        <p v-if="score === deck.length">Perfect Score! 🎉</p>
        <p v-else>Streak has been reset.</p>

        <button class="btn-done" @click="stage = 'select'">Back to Team</button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import pb from '../pocketbase';

const props = defineProps(['outletId', 'managerId']);

// STATE
const stage = ref('select'); // select, testing, summary
const staffList = ref([]);
const loading = ref(true);

// TEST STATE
const targetUser = ref(null);
const deck = ref([]);
const currentIndex = ref(0);
const isRevealed = ref(false);
const score = ref(0);

// LOAD STAFF
onMounted(async () => {
  try {
    staffList.value = await pb.collection('users').getFullList({
      filter: `outlet = "${props.outletId}" && position = "staff"`,
      sort: 'name'
    });
  } catch (err) {
    console.error("Error loading staff", err);
  } finally {
    loading.value = false;
  }
});

const currentCard = computed(() => deck.value[currentIndex.value]);

// HELPERS
const getAvatarUrl = (user) => {
  if (user.avatar) return pb.files.getUrl(user, user.avatar, { thumb: '100x100' });
  return `https://ui-avatars.com/api/?name=${user.name}&background=random`;
};

const getCardImg = (card) => pb.files.getUrl(card, card.image, { thumb: '100x100' });

// LOGIC
const startSetup = async (user) => {
  targetUser.value = user;
  
  // 1. Fetch 5 Random active cards for this outlet
  try {
    // Note: PocketBase uses '@random' sort to shuffle server-side
    const result = await pb.collection('cards').getList(1, 5, {
      filter: `is_active = true && (outlet = "${props.outletId}" || outlet = "")`,
      sort: '@random'
    });
    
    if (result.items.length === 0) {
      alert("No active cards found for this outlet!");
      return;
    }

    deck.value = result.items;
    currentIndex.value = 0;
    score.value = 0;
    isRevealed.value = false;
    stage.value = 'testing';

  } catch (err) {
    console.error("Error starting test", err);
  }
};

const submitGrade = async (passed) => {
  const card = currentCard.value;
  
  // 1. Log Activity
  await pb.collection('activity_logs').create({
    user: targetUser.value.id,
    card: card.id,
    result: passed ? 'manager_pass' : 'manager_fail',
    graded_by: props.managerId
  });

  // 2. Handle Logic
  if (passed) {
    score.value++;
    // Optional: Manager pass increases streak by 1
    const newStreak = targetUser.value.current_streak + 1;
    // We update local state immediately for UI snappiness
    targetUser.value.current_streak = newStreak;
    pb.collection('users').update(targetUser.value.id, { current_streak: newStreak });
  } else {
    // Fail: Reset streak
    targetUser.value.current_streak = 0;
    pb.collection('users').update(targetUser.value.id, { current_streak: 0 });
  }

  // 3. Next Card
  if (currentIndex.value < deck.value.length - 1) {
    currentIndex.value++;
    isRevealed.value = false;
  } else {
    stage.value = 'summary';
  }
};
</script>

<style scoped>
.manager-eval { padding: 10px; text-align: center; }

/* STAGE 1: STAFF GRID */
.staff-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 15px; }
.staff-card { background: #2b2b35; border: 2px solid #3d3d4a; padding: 15px; border-radius: 12px; cursor: pointer; transition: 0.2s; color: white; display: flex; flex-direction: column; align-items: center; }
.staff-card:hover { border-color: #4a90e2; transform: translateY(-3px); }
.avatar { width: 60px; height: 60px; border-radius: 50%; margin-bottom: 10px; border: 2px solid #555; object-fit: cover;}
.name { font-weight: bold; font-size: 0.9rem; margin-bottom: 5px; }
.streak { color: #ffd700; font-size: 0.8rem; }

/* STAGE 2: TESTING */
.test-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; background: #333; padding: 10px 15px; border-radius: 8px; color: white; }
.btn-abort { background: transparent; color: #ff5252; border: 1px solid #ff5252; padding: 5px 10px; border-radius: 6px; cursor: pointer; }

.eval-card { background: white; color: #333; padding: 20px; border-radius: 12px; min-height: 300px; text-align: left; margin-bottom: 20px; display: flex; flex-direction: column; }
.label { font-size: 0.75rem; color: #888; text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 5px; }
.text-large { font-size: 1.4rem; font-weight: bold; margin-bottom: 20px; }
.text-medium { font-size: 1.1rem; }

.answer-section { margin-top: 20px; animation: fadeIn 0.3s ease; border-top: 1px solid #eee; padding-top: 20px; }
.answer-content { display: flex; flex-direction: column; gap: 10px; }
.answer-img { max-width: 100%; max-height: 150px; border-radius: 8px; object-fit: contain; }

.controls { display: flex; flex-direction: column; gap: 10px; }
.btn-reveal { width: 100%; background: #333; color: white; padding: 15px; border-radius: 10px; border: none; font-size: 1.1rem; cursor: pointer; font-weight: bold; }
.grading-btns { display: flex; gap: 10px; }
.btn-fail { flex: 1; background: #ff5252; color: white; padding: 15px; border-radius: 10px; border: none; font-size: 1.1rem; cursor: pointer; font-weight: bold; }
.btn-pass { flex: 1; background: #4caf50; color: white; padding: 15px; border-radius: 10px; border: none; font-size: 1.1rem; cursor: pointer; font-weight: bold; }

/* STAGE 3: SUMMARY */
.summary-card { background: #2b2b35; padding: 40px; border-radius: 15px; color: white; }
.score-display { font-size: 3rem; font-weight: bold; color: #4a90e2; margin: 20px 0; }
.btn-done { background: #4a90e2; color: white; border: none; padding: 15px 30px; border-radius: 30px; font-size: 1.1rem; cursor: pointer; font-weight: bold; margin-top: 20px; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>