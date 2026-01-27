/**
 * MindSpace - Authentication Module
 * Centralized authentication and Supabase initialization
 */

// Global Supabase client - SINGLE SOURCE OF TRUTH
let supabaseClient = null;

// Configuration
const SUPABASE_CONFIG = {
    URL: 'https://hviqxpfnvjsqbdjfbttm.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2aXF4cGZudmpzcWJkamZidHRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NDM0NzIsImV4cCI6MjA4NDQxOTQ3Mn0.P3UWgbYx4MLMJktsXjFsAEtsNpTjqPnO31s2Oyy0BFs'
};

// Initialize Supabase client (only once)
function initSupabaseClient() {
    if (window.supabase && !supabaseClient) {
        try {
            supabaseClient = supabase.createClient(
                SUPABASE_CONFIG.URL,
                SUPABASE_CONFIG.ANON_KEY,
                {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true
                    }
                }
            );
            console.log('Supabase client initialized');
            return supabaseClient;
        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
            return null;
        }
    }
    return supabaseClient;
}

// Get Supabase client (use this everywhere)
window.getSupabaseClient = function() {
    return supabaseClient || initSupabaseClient();
};

// Check authentication status
window.checkAuthStatus = async function() {
    const client = getSupabaseClient();
    if (!client) return { authenticated: false, user: null };
    
    try {
        const { data: { session }, error } = await client.auth.getSession();
        if (error) throw error;
        
        return {
            authenticated: !!session,
            user: session?.user || null,
            session: session
        };
    } catch (error) {
        console.error('Auth check failed:', error);
        return { authenticated: false, user: null };
    }
};

// Login function
window.loginUser = async function(email, password) {
    const client = getSupabaseClient();
    if (!client) {
        return {
            success: false,
            error: 'Authentication service not available'
        };
    }
    
    try {
        // Validate inputs
        if (!email || !password) {
            return {
                success: false,
                error: 'Email and password are required'
            };
        }
        
        // Perform login
        const { data, error } = await client.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });
        
        if (error) throw error;
        
        // Store user info
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('userEmail', data.user.email);
        localStorage.setItem('userId', data.user.id);
        
        // Get user role
        let userRole = 'user';
        try {
            const { data: profile } = await client
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single();
            
            if (profile && profile.role) {
                userRole = profile.role;
                localStorage.setItem('userRole', userRole);
            }
        } catch (profileError) {
            console.warn('Could not fetch user role:', profileError);
        }
        
        return {
            success: true,
            user: data.user,
            role: userRole
        };
        
    } catch (error) {
        console.error('Login error:', error);
        
        // User-friendly error messages
        let errorMessage = 'Login failed. Please try again.';
        if (error.message.includes('Invalid login credentials')) {
            errorMessage = 'Invalid email or password';
        } else if (error.message.includes('Email not confirmed')) {
            errorMessage = 'Please confirm your email address first';
        } else if (error.message.includes('User not found')) {
            errorMessage = 'No account found with this email';
        }
        
        return {
            success: false,
            error: errorMessage
        };
    }
};

// Signup function
window.signupUser = async function(email, password, fullName) {
    const client = getSupabaseClient();
    if (!client) {
        return {
            success: false,
            error: 'Authentication service not available'
        };
    }
    
    try {
        // Validate inputs
        if (!email || !password || !fullName) {
            return {
                success: false,
                error: 'All fields are required'
            };
        }
        
        if (password.length < 6) {
            return {
                success: false,
                error: 'Password must be at least 6 characters'
            };
        }
        
        // Perform signup
        const { data, error } = await client.auth.signUp({
            email: email.trim(),
            password: password,
            options: {
                data: {
                    full_name: fullName.trim()
                }
            }
        });
        
        if (error) throw error;
        
        // Create profile if user was created
        if (data.user) {
            try {
                const { error: profileError } = await client
                    .from('profiles')
                    .insert([
                        {
                            id: data.user.id,
                            email: email.trim(),
                            full_name: fullName.trim(),
                            created_at: new Date().toISOString(),
                            role: 'user'
                        }
                    ]);
                
                if (profileError) {
                    console.warn('Profile creation warning:', profileError);
                    // Continue anyway - profile might be created by trigger
                }
            } catch (profileError) {
                console.warn('Profile creation error:', profileError);
            }
        }
        
        return {
            success: true,
            needsConfirmation: !data.session,
            user: data.user
        };
        
    } catch (error) {
        console.error('Signup error:', error);
        
        let errorMessage = 'Signup failed. Please try again.';
        if (error.message.includes('User already registered')) {
            errorMessage = 'An account with this email already exists';
        } else if (error.message.includes('Password should be at least')) {
            errorMessage = 'Password must be at least 6 characters';
        }
        
        return {
            success: false,
            error: errorMessage
        };
    }
};

// Logout function
window.logoutUser = async function() {
    const client = getSupabaseClient();
    if (!client) return false;
    
    try {
        const { error } = await client.auth.signOut();
        if (error) throw error;
        
        // Clear localStorage
        localStorage.removeItem('userLoggedIn');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userId');
        localStorage.removeItem('userRole');
        
        return true;
    } catch (error) {
        console.error('Logout error:', error);
        return false;
    }
};

// Get current user
window.getCurrentUser = function() {
    return {
        email: localStorage.getItem('userEmail'),
        id: localStorage.getItem('userId'),
        role: localStorage.getItem('userRole') || 'user',
        isLoggedIn: localStorage.getItem('userLoggedIn') === 'true'
    };
};

// Redirect based on role
window.redirectToDashboard = async function() {
    const authStatus = await checkAuthStatus();
    
    if (!authStatus.authenticated) {
        window.location.href = 'login.html';
        return;
    }
    
    // Get user role
    let userRole = 'user';
    try {
        const client = getSupabaseClient();
        const { data: profile } = await client
            .from('profiles')
            .select('role')
            .eq('id', authStatus.user.id)
            .single();
        
        if (profile && profile.role) {
            userRole = profile.role;
            localStorage.setItem('userRole', userRole);
        }
    } catch (error) {
        console.warn('Could not fetch user role:', error);
    }
    
    // Redirect to appropriate dashboard
    const currentPage = window.location.pathname.split('/').pop();
    const targetDashboard = {
        'admin': 'admin-dashboard.html',
        'therapist': 'therapist-dashboard.html',
        'user': 'user-dashboard.html'
    }[userRole] || 'user-dashboard.html';
    
    // Don't redirect if already on correct dashboard
    if (!currentPage.includes(targetDashboard)) {
        window.location.href = targetDashboard;
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Auto-initialize Supabase
    initSupabaseClient();
    
    // Auto-redirect logic for auth pages
    const currentPage = window.location.pathname.split('/').pop();
    const authPages = ['login.html', 'signup-user.html', 'signup-therapist.html'];
    
    if (authPages.includes(currentPage)) {
        setTimeout(async () => {
            const authStatus = await checkAuthStatus();
            if (authStatus.authenticated) {
                redirectToDashboard();
            }
        }, 100);
    }
});

// Helper function for showing alerts
window.showAuthAlert = function(message, type = 'error') {
    // Create alert container if it doesn't exist
    let alertContainer = document.getElementById('authAlertContainer');
    if (!alertContainer) {
        alertContainer = document.createElement('div');
        alertContainer.id = 'authAlertContainer';
        alertContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
        `;
        document.body.appendChild(alertContainer);
    }
    
    // Create alert element
    const alert = document.createElement('div');
    alert.style.cssText = `
        background: ${type === 'error' ? '#FEF2F2' : '#F0FDF4'};
        border: 1px solid ${type === 'error' ? '#FECACA' : '#BBF7D0'};
        color: ${type === 'error' ? '#DC2626' : '#16A34A'};
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease;
    `;
    
    alert.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : 'check-circle'}"></i>
        <span>${message}</span>
    `;
    
    alertContainer.appendChild(alert);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 5000);
    
    return alert;
};
