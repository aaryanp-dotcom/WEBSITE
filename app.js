/* Copy the app.js content exactly as provided */
// MindSpace - Main Application JavaScript

// Supabase Configuration
const SUPABASE_URL = 'https://hviqxpfnvjsqbdjfbttm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2aXF4cGZudmpzcWJkamZidHRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NDM0NzIsImV4cCI6MjA4NDQxOTQ3Mn0.P3UWgbYx4MLMJktsXjFsAEtsNpTjqPnO31s2Oyy0BFs';

// Create Supabase client ONCE
if (typeof window.supabase !== 'undefined' && !window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Global logout function
async function logout() {
    if (!confirm('Are you sure you want to logout?')) return;
    
    try {
        await window.supabaseClient.auth.signOut();
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out. Please try again.');
    }
}

// Make logout globally available
window.logout = logout;

console.log('✅ MindSpace app.js loaded successfully');
