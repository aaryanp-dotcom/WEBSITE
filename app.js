// ========================================
// MINDSPACE - UNIFIED JAVASCRIPT FILE
// All Supabase functionality in one place
// ========================================

// Supabase Configuration
const SUPABASE_URL = 'https://hviqxpfnvjsqbdjfbttm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2aXF4cGZudmpzcWJkamZidHRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NDM0NzIsImV4cCI6MjA4NDQxOTQ3Mn0.P3UWgbYx4MLMJktsXjFsAEtsNpTjqPnO31s2Oyy0BFs';

// Create Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Make it available globally
window.supabase = supabase;
window.supabaseClient = supabase;

// ========================================
// AUTHENTICATION FUNCTIONS
// ========================================

async function login(email, password) {
    try {
        console.log('Attempting login for:', email);
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (authError) {
            console.error('Auth error:', authError);
            alert('Login failed: ' + authError.message);
            return;
        }

        console.log('Auth successful:', authData);
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();

        if (profileError) {
            console.error('Profile error:', profileError);
            alert('Error loading profile: ' + profileError.message);
            return;
        }

        console.log('Profile loaded:', profile);

        // Check therapist approval status
        if (profile.role === 'therapist') {
            const { data: therapist, error: therapistError } = await supabase
                .from('Therapists')
                .select('approval_status')
                .eq('user_id', profile.id)
                .single();

            if (therapistError) {
                console.error('Therapist check error:', therapistError);
                alert('Error checking therapist status');
                return;
            }

            if (therapist.approval_status !== 'approved') {
                alert('Your therapist account is pending approval. Please wait for admin approval.');
                await supabase.auth.signOut();
                return;
            }
        }

        // Store user data
        const userData = {
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            role: profile.role
        };

        localStorage.setItem('user', JSON.stringify(userData));
        console.log('User stored in localStorage:', userData);

        // Redirect based on role
        if (profile.role === 'admin') {
            window.location.href = 'admin-dashboard.html';
        } else if (profile.role === 'therapist') {
            window.location.href = 'therapist-dashboard.html';
        } else if (profile.role === 'user') {
            window.location.href = 'user-dashboard.html';
        } else {
            alert('Invalid user role');
            await supabase.auth.signOut();
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('An error occurred during login: ' + error.message);
    }
}

async function signupUser(email, password, fullName, phone) {
    try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password
        });

        if (authError) {
            alert('Signup failed: ' + authError.message);
            return;
        }

        const { error: profileError } = await supabase
            .from('profiles')
            .insert([{
                id: authData.user.id,
                email: email,
                full_name: fullName,
                phone: phone,
                role: 'user',
                status: 'active',
                approved: true
            }]);

        if (profileError) {
            console.error('Profile creation error:', profileError);
            alert('Error creating profile: ' + profileError.message);
            return;
        }

        alert('Account created successfully! Please login.');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Signup error:', error);
        alert('An error occurred during signup: ' + error.message);
    }
}

async function signupTherapist(email, password, name, phone, specialization, qualifications, bio) {
    try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password
        });

        if (authError) {
            alert('Signup failed: ' + authError.message);
            return;
        }

        // Create profile
        const { error: profileError } = await supabase
            .from('profiles')
            .insert([{
                id: authData.user.id,
                email: email,
                full_name: name,
                phone: phone,
                role: 'therapist',
                status: 'active',
                approved: false
            }]);

        if (profileError) {
            console.error('Profile creation error:', profileError);
            alert('Error creating profile: ' + profileError.message);
            return;
        }

        // Create therapist record
        const { error: therapistError } = await supabase
            .from('Therapists')
            .insert([{
                user_id: authData.user.id,
                Name: name,
                email: email,
                phone: phone,
                Specialization: specialization,
                qualifications: qualifications,
                bio: bio,
                approval_status: 'pending',
                Active: true
            }]);

        if (therapistError) {
            console.error('Therapist creation error:', therapistError);
            alert('Error creating therapist profile: ' + therapistError.message);
            return;
        }

        alert('Therapist account created! Please wait for admin approval before logging in.');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Therapist signup error:', error);
        alert('An error occurred during signup: ' + error.message);
    }
}

function logout() {
    localStorage.removeItem('user');
    supabase.auth.signOut();
    window.location.href = 'index.html';
}

// ========================================
// DASHBOARD FUNCTIONS
// ========================================

async function checkAuth() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!user || error) {
            window.location.href = 'login.html';
            return null;
        }
        return user;
    } catch (err) {
        console.error('Auth check error:', err);
        window.location.href = 'login.html';
        return null;
    }
}

async function loadTherapists(userId) {
    try {
        const { data, error } = await supabase
            .from('Therapists')
            .select('*')
            .eq('Active', true)
            .eq('approval_status', 'approved');

        if (error) {
            console.error('Error loading therapists:', error);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('Load therapists error:', err);
        return [];
    }
}

async function bookSession(therapistId, userId, sessionDate, startTime) {
    try {
        const bookingData = {
            user_id: userId,
            therapist_id: therapistId,
            session_date: sessionDate,
            start_time: startTime,
            status: 'pending'
        };

        const { data, error } = await supabase
            .from('Bookings')
            .insert([bookingData]);

        if (error) {
            console.error('Booking error:', error);
            if (error.code === '23505') {
                alert('You already have a booking on this date. Please choose a different date or cancel your existing booking first.');
            } else {
                alert('Error creating booking: ' + error.message);
            }
            return false;
        }

        alert('Booking successful!');
        return true;
    } catch (err) {
        console.error('Book session error:', err);
        alert('An error occurred while booking');
        return false;
    }
}

async function loadUserBookings(userId) {
    try {
        const { data, error } = await supabase
            .from('Bookings')
            .select('*, Therapists(*)')
            .eq('user_id', userId)
            .order('session_date', { ascending: true });

        if (error) {
            console.error('Error loading bookings:', error);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('Load bookings error:', err);
        return [];
    }
}

async function cancelBooking(bookingId) {
    try {
        const { error } = await supabase
            .from('Bookings')
            .delete()
            .eq('id', bookingId);

        if (error) {
            console.error('Cancel error:', error);
            alert('Error cancelling booking');
            return false;
        }

        alert('Booking cancelled');
        return true;
    } catch (err) {
        console.error('Cancel booking error:', err);
        alert('An error occurred while cancelling');
        return false;
    }
}

// ========================================
// ADMIN FUNCTIONS
// ========================================

async function loadStatistics() {
    try {
        const stats = {};
        
        // Total Users
        const { count: usersCount } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'user');
        stats.totalUsers = usersCount || 0;

        // Total Therapists
        const { count: therapistsCount } = await supabase
            .from('Therapists')
            .select('*', { count: 'exact', head: true });
        stats.totalTherapists = therapistsCount || 0;

        // Pending Applications
        const { count: pendingCount } = await supabase
            .from('Therapists')
            .select('*', { count: 'exact', head: true })
            .eq('approval_status', 'pending');
        stats.pendingApplications = pendingCount || 0;

        // Total Bookings
        const { count: bookingsCount } = await supabase
            .from('Bookings')
            .select('*', { count: 'exact', head: true });
        stats.totalBookings = bookingsCount || 0;

        return stats;
    } catch (error) {
        console.error('Error loading statistics:', error);
        return null;
    }
}

async function approveApplication(therapistId) {
    try {
        const { error } = await supabase
            .from('Therapists')
            .update({ approval_status: 'approved', Active: true })
            .eq('id', therapistId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error approving:', error);
        return false;
    }
}

async function rejectApplication(therapistId) {
    try {
        const { error } = await supabase
            .from('Therapists')
            .update({ approval_status: 'rejected', Active: false })
            .eq('id', therapistId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error rejecting:', error);
        return false;
    }
}

// ========================================
// THERAPIST FUNCTIONS
// ========================================

async function loadTherapistBookings(therapistId, status = null) {
    try {
        let query = supabase
            .from('Bookings')
            .select('*, profiles(full_name)')
            .eq('therapist_id', therapistId);

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query.order('session_date', { ascending: false });

        if (error) {
            console.error('Error loading therapist bookings:', error);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('Load therapist bookings error:', err);
        return [];
    }
}

async function updateBookingStatus(bookingId, status, meetingLink = null) {
    try {
        const updateData = { status: status };
        if (meetingLink) {
            updateData.meeting_link = meetingLink;
        }

        const { error } = await supabase
            .from('Bookings')
            .update(updateData)
            .eq('id', bookingId);

        if (error) throw error;
        return true;
    } catch (err) {
        console.error('Update booking status error:', err);
        return false;
    }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhone(phone) {
    const re = /^[\+]?[1-9][\d]{0,15}$/;
    return re.test(phone.replace(/\D/g, ''));
}

// ========================================
// DOM READY FUNCTIONS
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    // Add active class to current page in navigation
    const currentPage = window.location.pathname.split('/').pop();
    const navLinks = document.querySelectorAll('.nav-links a');
    
    navLinks.forEach(link => {
        const linkPage = link.getAttribute('href');
        if (linkPage === currentPage || (currentPage === '' && linkPage === 'index.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Handle smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if(targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if(targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });
});
