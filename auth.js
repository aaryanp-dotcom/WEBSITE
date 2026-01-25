/**
 * MindSpace - Authentication Module
 * Handles all authentication-related functionality
 */

(function() {
    'use strict';

    // Wait for Supabase client to be available
    function waitForSupabase() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max wait
            
            const checkInterval = setInterval(() => {
                attempts++;
                
                if (window.supabaseClient) {
                    clearInterval(checkInterval);
                    resolve(window.supabaseClient);
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    reject(new Error('Supabase client not available after timeout'));
                }
            }, 100);
        });
    }

    // Authentication Class
    class MindSpaceAuth {
        constructor() {
            this.client = null;
            this.currentUser = null;
            this.initialized = false;
            this.init();
        }

        async init() {
            try {
                this.client = await waitForSupabase();
                await this.checkExistingSession();
                this.initialized = true;
                console.log('Auth module initialized');
            } catch (error) {
                console.error('Auth initialization failed:', error);
                this.showError('Authentication system failed to initialize. Please refresh the page.');
            }
        }

        async checkExistingSession() {
            try {
                const { data: { session }, error } = await this.client.auth.getSession();
                
                if (error) throw error;
                
                if (session) {
                    this.currentUser = session.user;
                    this.dispatchAuthEvent('session_restored', session);
                    
                    // Redirect to dashboard if not already there
                    if (!window.location.pathname.includes('dashboard')) {
                        setTimeout(() => {
                            window.location.href = 'user-dashboard.html';
                        }, 100);
                    }
                }
            } catch (error) {
                console.error('Session check failed:', error);
            }
        }

        async signIn(email, password) {
            try {
                this.validateEmail(email);
                this.validatePassword(password);

                const { data, error } = await this.client.auth.signInWithPassword({
                    email: email.trim(),
                    password: password
                });

                if (error) throw error;

                this.currentUser = data.user;
                this.dispatchAuthEvent('signin', data);
                
                return {
                    success: true,
                    user: data.user,
                    session: data.session
                };

            } catch (error) {
                console.error('Sign in error:', error);
                return {
                    success: false,
                    error: this.getErrorMessage(error)
                };
            }
        }

        async signUp(email, password, fullName) {
            try {
                this.validateEmail(email);
                this.validatePassword(password);
                this.validateName(fullName);

                const { data, error } = await this.client.auth.signUp({
                    email: email.trim(),
                    password: password,
                    options: {
                        data: {
                            full_name: fullName.trim(),
                            created_at: new Date().toISOString()
                        }
                    }
                });

                if (error) throw error;

                // Create user profile
                if (data.user) {
                    const { error: profileError } = await this.client
                        .from('profiles')
                        .insert([
                            {
                                id: data.user.id,
                                email: email.trim(),
                                full_name: fullName.trim(),
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            }
                        ]);

                    if (profileError) {
                        console.error('Profile creation failed:', profileError);
                        // Continue anyway - profile can be created later
                    }
                }

                return {
                    success: true,
                    user: data.user,
                    needsConfirmation: !data.session
                };

            } catch (error) {
                console.error('Sign up error:', error);
                return {
                    success: false,
                    error: this.getErrorMessage(error)
                };
            }
        }

        async signOut() {
            try {
                const { error } = await this.client.auth.signOut();
                
                if (error) throw error;

                this.currentUser = null;
                this.dispatchAuthEvent('signout');
                
                return { success: true };
            } catch (error) {
                console.error('Sign out error:', error);
                return {
                    success: false,
                    error: this.getErrorMessage(error)
                };
            }
        }

        getCurrentUser() {
            return this.currentUser;
        }

        isAuthenticated() {
            return !!this.currentUser;
        }

        // Validation methods
        validateEmail(email) {
            if (!email || typeof email !== 'string') {
                throw new Error('Email is required');
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                throw new Error('Please enter a valid email address');
            }
        }

        validatePassword(password) {
            if (!password || typeof password !== 'string') {
                throw new Error('Password is required');
            }

            if (password.length < 6) {
                throw new Error('Password must be at least 6 characters');
            }
        }

        validateName(name) {
            if (!name || typeof name !== 'string' || name.trim().length < 2) {
                throw new Error('Full name must be at least 2 characters');
            }
        }

        // Error handling
        getErrorMessage(error) {
            const messages = {
                'Invalid login credentials': 'Invalid email or password. Please try again.',
                'Email not confirmed': 'Please confirm your email address before logging in.',
                'User not found': 'No account found with this email. Please sign up first.',
                'Email rate limit exceeded': 'Too many attempts. Please try again later.',
                'Weak password': 'Password is too weak. Please use a stronger password.',
                'User already registered': 'An account with this email already exists.'
            };

            return messages[error.message] || 
                   error.message || 
                   'An unexpected error occurred. Please try again.';
        }

        // Event dispatching
        dispatchAuthEvent(type, data = null) {
            const event = new CustomEvent('mindsapce:auth', {
                detail: { type, data, timestamp: new Date() }
            });
            document.dispatchEvent(event);
        }

        // Utility methods
        showError(message, elementId = 'authError') {
            const errorElement = document.getElementById(elementId);
            if (errorElement) {
                errorElement.textContent = message;
                errorElement.style.display = 'block';
                
                setTimeout(() => {
                    errorElement.style.display = 'none';
                }, 5000);
            }
        }

        showSuccess(message, elementId = 'authSuccess') {
            const successElement = document.getElementById(elementId);
            if (successElement) {
                successElement.textContent = message;
                successElement.style.display = 'block';
                
                setTimeout(() => {
                    successElement.style.display = 'none';
                }, 5000);
            }
        }
    }

    // Initialize and expose globally
    window.MindSpaceAuth = new MindSpaceAuth();

    // Expose utility functions
    window.logout = async function() {
        const result = await window.MindSpaceAuth.signOut();
        if (result.success) {
            window.location.href = 'login.html';
        } else {
            alert('Logout failed: ' + result.error);
        }
    };

    // Auto-redirect if authenticated and on login/signup pages
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
            const auth = window.MindSpaceAuth;
            if (auth.isAuthenticated()) {
                const currentPage = window.location.pathname;
                const authPages = ['login.html', 'signup.html', 'index.html'];
                
                if (authPages.some(page => currentPage.includes(page))) {
                    window.location.href = 'user-dashboard.html';
                }
            }
        }, 100);
    });

})();
