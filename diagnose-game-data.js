// Paste this in the browser console on klanhaboru.hu to diagnose the issue

console.log('=== TW Diagnostic ===');
console.log('URL:', window.location.href);
console.log('Hostname:', window.location.hostname);
console.log('');

// Check for game_data
console.log('window.game_data exists?', typeof window.game_data !== 'undefined');
if (window.game_data) {
  console.log('game_data keys:', Object.keys(window.game_data));
  console.log('game_data.player:', window.game_data.player);
  console.log('game_data.village:', window.game_data.village);
  console.log('game_data.world:', window.game_data.world);
}

// Check for alternative names
console.log('');
console.log('Checking alternative variable names:');
console.log('window.Game exists?', typeof window.Game !== 'undefined');
console.log('window.TribalWars exists?', typeof window.TribalWars !== 'undefined');
console.log('window.TWMap exists?', typeof window.TWMap !== 'undefined');

// Check all global variables that might contain game data
console.log('');
console.log('All window properties containing "game" or "data":');
Object.keys(window).filter(key =>
  key.toLowerCase().includes('game') ||
  key.toLowerCase().includes('data') ||
  key.toLowerCase().includes('player') ||
  key.toLowerCase().includes('village')
).forEach(key => {
  console.log(`- window.${key}:`, typeof window[key]);
});

// Wait a bit and check again
setTimeout(() => {
  console.log('');
  console.log('=== After 2 seconds ===');
  console.log('window.game_data exists now?', typeof window.game_data !== 'undefined');
  if (window.game_data) {
    console.log('game_data keys:', Object.keys(window.game_data));
  }
}, 2000);

setTimeout(() => {
  console.log('');
  console.log('=== After 5 seconds ===');
  console.log('window.game_data exists now?', typeof window.game_data !== 'undefined');
  if (window.game_data) {
    console.log('game_data keys:', Object.keys(window.game_data));
  }
}, 5000);
