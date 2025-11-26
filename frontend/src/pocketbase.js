import PocketBase from 'pocketbase';

// Replace with your actual Fly.io URL
const pb = new PocketBase('https://restuarant-flashcards.fly.dev');

// This disables auto-cancellation so we don't get errors if the user clicks fast
pb.autoCancellation(false);

export default pb;