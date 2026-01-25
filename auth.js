/**
 * MindSpace - Simple Authentication Module
 * No complex dependencies - Just works
 */

// Global variables
let supabaseClient = null;
let currentUser = null;

// Initialize Supabase
function initSupabase() {
    if (window.supabase && !supabaseClient) {
        const SUPABASE_URL = 'https://hviqxpfnvjsqbdjfbttm.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2aXF4cGZudmpzcWJkamZidHRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NDM0NzIsImV4cCI6MjA4NDQxOTQ3Mn0.P3UWgbYx4MLMJktsXjFsAEtsNpTjqPnO31s2Oyy0BFs';
        
        try {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log('Supabase initialized successfully');
            return supabaseClient;
        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
            return null;
        }
    }
    return supabaseClient;
}

// Check if user is logged in
async function checkAuth() {
    const client = initSupabase();
    if (!client) return false;
    
    try {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        
        if (data.session) {
            currentUser = data.session.user;
            localStorage.setItem('userLoggedIn', 'true');
            localStorage.setItem('userEmail', currentUser.email);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Auth check failed:', error);
        return false;
    }
}

// Login function
async function loginUser(email, password) {
    const client = initSupabase();
    if (!client) {
        throw new Error('Authentication service unavailable');
    }
    
    try {
        const { data, error } = await client.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        currentUser = data.user;
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userEmail', data.user.email);
        localStorage.setItem('userId', data.user.id);
        
        return {
            success: true,
            user: data.user
        };
    } catch (error) {
        console.error('Login error:', error);
        return {
            success: false,
            error: getErrorMessage(error)
        };
    }
}

// Signup function
async function signupUser(email, password, fullName) {
    const client = initSupabase();
    if (!client) {
        throw new Error('Authentication service unavailable');
    }
    
    try {
        const { data, error } = await client.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });
        
        if (error) throw error;
        
        // Create profile if signup successful
        if (data.user) {
            const { error: profileError } = await client
                .from('profiles')
                .insert([
                    {
                        id: data.user.id,
                        email: email,
                        full_name: fullName,
                        created_at: new Date().toISOString()
                    }
                ]);
            
            if (profileError) {
                console.warn('Profile creation warning:', profileError);
            }
        }
        
        return {
            success: true,
            needsConfirmation: !data.session
        };
    } catch (error) {
        console.error('Signup error:', error);
        return {
            success: false,
            error: getErrorMessage(error)
        };
    }
}

// Logout function
async function logoutUser() {
    const client = initSupabase();
    if (!client) return false;
    
    try {
        const { error } = await client.auth.signOut();
        if (error) throw error;
        
        currentUser = null;
        localStorage.removeItem('userLoggedIn');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userId');
        
        return true;
    } catch (error) {
        console.error('Logout error:', error);
        return false;
    }
}

// Get current user
function getCurrentUser() {
    return currentUser;
}

// Error message helper
function getErrorMessage(error) {
    if (error.message.includes('Invalid login credentials')) {
        return 'Invalid email or password. Please try again.';
    } else if (error.message.includes('User not found')) {
        return 'No account found with this email.';
    } else if (error.message.includes('Email not confirmed')) {
        return 'Please confirm your email before logging in.';
    } else if (error.message.includes('Email rate limit exceeded')) {
        return 'Too many attempts. Please try again later.';
    } else {
        return 'An error occurred. Please try again.';
    }
}

// Auto-check auth on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Only run on pages that need auth check
    const authPages = ['user-dashboard.html', 'login.html', 'signup.html'];
    const currentPage = window.location.pathname;
    
    if (authPages.some(page => currentPage.includes(page))) {
        const isAuthenticated = await checkAuth();
        
        // Redirect logic
        if (isAuthenticated && currentPage.includes('login.html')) {
            window.location.href = 'user-dashboard.html';
        } else if (isAuthenticated && currentPage.includes('signup.html')) {
            window.location.href = 'user-dashboard.html';
        } else if (!isAuthenticated && currentPage.includes('user-dashboard.html')) {
            window.location.href = 'login.html';
        }
    }
});

// Export functions to global scope
window.loginUser = loginUser;
window.signupUser = signupUser;
window.logoutUser = logoutUser;
window.getCurrentUser = getCurrentUser;
window.checkAuth = checkAuth;
