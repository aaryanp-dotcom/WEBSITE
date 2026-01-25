/**
 * MindSpace - Supabase Configuration
 * Centralized Supabase client initialization
 * Prevents duplicate declarations and provides consistent configuration
 */

(function() {
    'use strict';
    
    // Configuration Constants
    const SUPABASE_CONFIG = {
        URL: 'https://hviqxpfnvjsqbdjfbttm.supabase.co',
        ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2aXF4cGZudmpzcWJkamZidHRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NDM0NzIsImV4cCI6MjA4NDQxOTQ3Mn0.P3UWgbYx4MLMJktsXjFsAEtsNpTjqPnO31s2Oyy0BFs'
    };

    // Check if Supabase client is already initialized
    if (window.supabase && window.supabaseClient) {
        console.log('Supabase client already initialized');
        return;
    }

    // Initialize Supabase client
    try {
        // Check if Supabase library is loaded
        if (typeof supabase === 'undefined') {
            console.error('Supabase library not loaded. Please include the Supabase CDN.');
            return;
        }

        // Create and store the client globally
        window.supabaseClient = supabase.createClient(
            SUPABASE_CONFIG.URL,
            SUPABASE_CONFIG.ANON_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                },
                global: {
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_CONFIG.ANON_KEY
                    }
                }
            }
        );

        // Store configuration
        window.supabaseConfig = SUPABASE_CONFIG;

        console.log('Supabase client initialized successfully');

    } catch (error) {
        console.error('Failed to initialize Supabase client:', error);
    }

    // Public API
    window.getSupabaseClient = function() {
        return window.supabaseClient;
    };

    window.getSupabaseConfig = function() {
        return window.supabaseConfig;
    };

    // Initialize auth state listener
    function initializeAuthListener() {
        if (!window.supabaseClient) return;

        window.supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event, session);
            
            // Store session in localStorage for persistence
            if (session) {
                localStorage.setItem('supabase.auth.token', session.access_token);
                localStorage.setItem('supabase.auth.user', JSON.stringify(session.user));
            } else {
                localStorage.removeItem('supabase.auth.token');
                localStorage.removeItem('supabase.auth.user');
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAuthListener);
    } else {
        initializeAuthListener();
    }

})();
