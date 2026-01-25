// MindSpace - Main Application JavaScript

// Supabase Configuration
const SUPABASEURL = "https://hviqxpfnvjsqbdjfbttm.supabase.co";
const SUPABASEKEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2aXF4cGZudmpzcWJkamZidHRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NDM0NzIsImV4cCI6MjA4NDQxOTQ3Mn0.P3UWgbYx4MLMJktsXjFsAEtsNpTjqPnO31s2Oyy0BFs";

// Create Supabase client
const supabase = window.supabase.createClient(SUPABASEURL, SUPABASEKEY);
window.supabaseClient = supabase; // Global access for debugging

// Application State Management
const AppState = {
  currentUser: null,
  therapists: [],
  bookings: [],
  isLoading: false,
  error: null,
};

// DOM Elements Cache
const DOM = {
  // Will be initialized when needed
};

// Utility Functions
const Utils = {
  // Show loading state
  showLoader: (elementId) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = `
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      `;
    }
  },

  // Show error message
  showError: (elementId, message) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = `
        <div class="error-message">
          <div class="error-icon">⚠</div>
          <h3>Something went wrong</h3>
          <p>${message}</p>
          <button onclick="location.reload()" class="btn-retry">Try Again</button>
        </div>
      `;
    }
  },

  // Show success notification
  showNotification: (message, type = "success") => {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${
          type === "success" ? "✓" : type === "error" ? "✗" : "ℹ"
        }</span>
        <span class="notification-text">${message}</span>
        <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    // Add to DOM
    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  },

  // Format date for display
  formatDate: (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  },

  // Format time for display
  formatTime: (timeString) => {
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${minutes} ${ampm}`;
  },

  // Generate time slots
  generateTimeSlots: () => {
    const slots = [];
    const startHour = 9; // 9 AM
    const endHour = 19; // 7 PM

    for (let hour = startHour; hour <= endHour; hour++) {
      const hour12 = hour > 12 ? hour - 12 : hour;
      const ampm = hour >= 12 ? "PM" : "AM";
      const timeString = `${hour.toString().padStart(2, "0")}:00`;
      const displayString = `${hour12}:00 ${ampm}`;

      slots.push({
        value: timeString,
        display: displayString,
        disabled: false,
      });
    }
    return slots;
  },

  // Validate email
  validateEmail: (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  // Debounce function for search
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
};

// Authentication Management
const Auth = {
  // Check if user is authenticated
  checkAuth: async () => {
    try {
      const { data: session, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Auth check error:", error);
        return null;
      }

      if (session && session.session) {
        AppState.currentUser = session.session.user;
        await Auth.updateUserProfile(session.session.user);
        return session.session.user;
      }
      return null;
    } catch (error) {
      console.error("Auth check failed:", error);
      return null;
    }
  },

  // Update user profile in state
  updateUserProfile: async (user) => {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!error && profile) {
        AppState.currentUser = { ...user, ...profile };
      }
    } catch (error) {
      console.error("Profile update error:", error);
    }
  },

  // Login user
  login: async (email, password) => {
    if (!email || !password) {
      Utils.showNotification("Please enter email and password", "error");
      return null;
    }

    if (!Utils.validateEmail(email)) {
      Utils.showNotification("Please enter a valid email address", "error");
      return null;
    }

    try {
      Utils.showLoader("loginForm");

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        Utils.showNotification("Login failed: " + error.message, "error");
        return null;
      }

      Utils.showNotification("Login successful! Redirecting...", "success");

      // Update app state
      AppState.currentUser = data.user;

      // Redirect based on role (FIXED: removed dashboard.html)
      setTimeout(() => {
        const role = (data.user && data.user.role) || "";
        if (role === "admin") {
          window.location.href = "admin-dashboard.html";
        } else if (role === "therapist") {
          window.location.href = "therapist-dashboard.html";
        } else {
          window.location.href = "user-dashboard.html";
        }
      }, 1500);

      return data.user;
    } catch (error) {
      console.error("Login error:", error);
      Utils.showNotification(
        "An unexpected error occurred. Please try again.",
        "error"
      );
      return null;
    }
  },

  // Logout user
  logout: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Logout error:", error);
        return false;
      }

      // Clear app state
      AppState.currentUser = null;
      AppState.therapists = [];
      AppState.bookings = [];

      Utils.showNotification("Logged out successfully", "success");

      // Redirect to login page
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1000);

      return true;
    } catch (error) {
      console.error("Logout failed:", error);
      Utils.showNotification("Error during logout", "error");
      return false;
    }
  },

  // Register new user
  register: async (email, password, fullName, phone, role = "user") => {
    if (!email || !password || !fullName) {
      Utils.showNotification("Please fill in all required fields", "error");
      return null;
    }

    if (!Utils.validateEmail(email)) {
      Utils.showNotification("Please enter a valid email address", "error");
      return null;
    }

    if (password.length < 6) {
      Utils.showNotification("Password must be at least 6 characters long", "error");
      return null;
    }

    try {
      Utils.showLoader("registerForm");

      // 1. Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            fullname: fullName.trim(),
            phone: phone || null,
            role: role,
          },
        },
      });

      if (authError) {
        if (authError.message && authError.message.includes("already registered")) {
          Utils.showNotification(
            "This email is already registered. Please try logging in.",
            "error"
          );
        } else {
          Utils.showNotification("Registration failed: " + authError.message, "error");
        }
        return null;
      }

      // 2. Create profile in profiles table
      if (authData.user) {
        const { error: profileError } = await supabase.from("profiles").insert({
          id: authData.user.id,
          email: email.trim(),
          fullname: fullName.trim(),
          phone: phone || null,
          role: role,
          createdat: new Date().toISOString(),
        });

        if (profileError) {
          console.error("Profile creation error:", profileError);
        }
      }

      Utils.showNotification("Registration successful! You can now login.", "success");

      setTimeout(() => {
        window.location.href = "login.html";
      }, 2000);

      return authData.user;
    } catch (error) {
      console.error("Registration error:", error);
      Utils.showNotification("An unexpected error occurred during registration.", "error");
      return null;
    }
  },
};

// Therapist Management
const Therapists = {
  // Load all approved therapists
  loadAll: async () => {
    try {
      AppState.isLoading = true;
      Utils.showLoader("therapist-list");

      const { data, error } = await supabase
        .from("Therapists")
        .select("*")
        .eq("approvalstatus", "approved")
        .eq("Active", true)
        .order("Name", { ascending: true });

      if (error) {
        console.error("Error loading therapists:", error);
        Utils.showError("therapist-list", "Failed to load therapists. Please try again.");
        return;
      }

      AppState.therapists = data || [];
      AppState.isLoading = false;
      return data;
    } catch (error) {
      console.error("Therapist load error:", error);
      AppState.isLoading = false;
      return;
    }
  },

  // Render therapists list
  renderList: (therapists, containerId = "therapist-list") => {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!therapists || therapists.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👥</div>
          <h3>No Therapists Available</h3>
          <p>There are currently no therapists available for booking.</p>
          <p><small>Please check back later or contact support.</small></p>
        </div>
      `;
      return;
    }

    const timeSlots = Utils.generateTimeSlots();
    const today = new Date().toISOString().split("T")[0];
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    const maxDateStr = maxDate.toISOString().split("T")[0];

    container.innerHTML = therapists
      .map(
        (therapist) => `
      <div class="therapist-card" data-therapist-id="${therapist.id}">
        <div class="therapist-header">
          <div class="therapist-avatar">${(therapist.Name || "T").charAt(0)}</div>
          <div class="therapist-info">
            <h3 class="therapist-name">Dr. ${therapist.Name || "Unknown"}</h3>
            <p class="therapist-specialization">${
              therapist.Specialization || "General Therapy"
            }</p>
          </div>
        </div>

        <div class="therapist-details">
          <p class="therapist-bio">${therapist.bio || "No bio available."}</p>
          <div class="therapist-stats">
            <span class="stat-item">
              <span class="stat-label">Experience</span>
              <span class="stat-value">${therapist.experience || "N/A"} years</span>
            </span>
            <span class="stat-item">
              <span class="stat-label">Qualifications</span>
              <span class="stat-value">${therapist.qualifications || "Not specified"}</span>
            </span>
          </div>
        </div>

        <div class="booking-form">
          <h4>Book a Session</h4>

          <div class="form-group">
            <label for="date-${therapist.id}">
              <span class="label-icon">📅</span>
              Select Date
            </label>
            <input type="date" id="date-${therapist.id}" class="date-input"
                   min="${today}" max="${maxDateStr}" required>
          </div>

          <div class="form-group">
            <label for="time-${therapist.id}">
              <span class="label-icon">⏰</span>
              Select Time
            </label>
            <select id="time-${therapist.id}" class="time-select" required>
              <option value="">Choose a time slot</option>
              ${timeSlots
                .map((slot) => `<option value="${slot.value}">${slot.display}</option>`)
                .join("")}
            </select>
          </div>

          <button class="btn-book"
                  onclick="Booking.bookSession('${therapist.id}', '${therapist.Name || ""}')"
                  data-therapist-id="${therapist.id}">
            <span class="btn-icon">📋</span>
            Book Session
          </button>

          <div class="booking-note">
            <small>Sessions are 60 minutes long</small><br>
            <small>Standard fee: ₹500 per session</small>
          </div>
        </div>
      </div>
    `
      )
      .join("");
  },

  // Search therapists
  search: async (query) => {
    try {
      const { data, error } = await supabase
        .from("Therapists")
        .select("*")
        .or(`Name.ilike.%${query}%,Specialization.ilike.%${query}%,bio.ilike.%${query}%`)
        .eq("approvalstatus", "approved")
        .eq("Active", true);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Search error:", error);
      return [];
    }
  },
};

// Booking Management
const Booking = {
  // Book a new session
  bookSession: async (therapistId, therapistName) => {
    // Check authentication
    if (!AppState.currentUser) {
      Utils.showNotification("Please login to book a session", "error");
      window.location.href = "login.html";
      return;
    }

    // Get form values
    const dateInput = document.getElementById(`date-${therapistId}`);
    const timeSelect = document.getElementById(`time-${therapistId}`);

    if (!dateInput || !timeSelect) {
      Utils.showNotification("Booking form not found. Please refresh the page.", "error");
      return;
    }

    const sessionDate = dateInput.value;
    const startTime = timeSelect.value;

    // Validation
    if (!sessionDate) {
      Utils.showNotification("Please select a date for your session", "error");
      dateInput.focus();
      return;
    }

    if (!startTime) {
      Utils.showNotification("Please select a time for your session", "error");
      timeSelect.focus();
      return;
    }

    // Check if date is in the past
    const selectedDate = new Date(sessionDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      Utils.showNotification("Please select a future date", "error");
      return;
    }

    // Confirm booking
    const confirmation = await Booking.confirmBooking(therapistName, sessionDate, startTime);
    if (!confirmation) return;

    try {
      // Check for existing bookings on the same date
      const { data: existingBookings, error: checkError } = await supabase
        .from("Bookings")
        .select("id")
        .eq("userid", AppState.currentUser.id)
        .eq("sessiondate", sessionDate)
        .eq("status", "confirmed");

      if (checkError) throw checkError;

      if (existingBookings && existingBookings.length > 0) {
        Utils.showNotification(
          "You already have a confirmed booking on this date. Please choose a different date.",
          "error"
        );
        return;
      }

      // Create booking data
      const bookingData = {
        userid: AppState.currentUser.id,
        therapistid: therapistId,
        sessiondate: sessionDate,
        starttime: startTime,
        status: "confirmed",
        createdat: new Date().toISOString(),
        amount: 500, // Standard fee in INR
      };

      // Insert booking
      const { data, error } = await supabase.from("Bookings").insert(bookingData).select().single();

      if (error) {
        if (error.code === "23505") {
          Utils.showNotification("You already have a booking on this date and time", "error");
        } else {
          throw error;
        }
        return;
      }

      // Success
      Utils.showNotification(
        `Session booked successfully with Dr. ${therapistName} on ${Utils.formatDate(
          sessionDate
        )} at ${Utils.formatTime(startTime)}!`,
        "success"
      );

      // Clear form
      dateInput.value = "";
      timeSelect.value = "";

      // Refresh bookings list if on dashboard
      Booking.loadUserBookings();

      console.log("Booking successful:", data);
    } catch (error) {
      console.error("Booking error:", error);
      Utils.showNotification("Error creating booking. Please try again.", "error");
    }
  },

  // Confirm booking with user
  confirmBooking: (therapistName, date, time) => {
    return new Promise((resolve) => {
      const formattedDate = Utils.formatDate(date);
      const formattedTime = Utils.formatTime(time);

      const confirmation = `
        <div class="confirmation-dialog">
          <h3>Confirm Your Booking</h3>
          <p>You are about to book a session with:</p>
          <div class="booking-details">
            <p><strong>Therapist:</strong> Dr. ${therapistName}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Time:</strong> ${formattedTime}</p>
            <p><strong>Duration:</strong> 60 minutes</p>
            <p><strong>Fee:</strong> ₹500</p>
          </div>
          <p>Would you like to proceed?</p>
          <div class="confirmation-actions">
            <button onclick="this.closest('.modal-overlay').remove(); window.__bookingConfirm(true)" class="btn-confirm">Confirm Booking</button>
            <button onclick="this.closest('.modal-overlay').remove(); window.__bookingConfirm(false)" class="btn-cancel">Cancel</button>
          </div>
        </div>
      `;

      window.__bookingConfirm = (val) => resolve(val);

      const dialog = document.createElement("div");
      dialog.className = "modal-overlay";
      dialog.innerHTML = confirmation;
      document.body.appendChild(dialog);
    });
  },

  // Load user's bookings
  loadUserBookings: async () => {
    if (!AppState.currentUser) return;

    try {
      Utils.showLoader("booking-list");

      const { data, error } = await supabase
        .from("Bookings")
        .select("*, Therapists ( Name, Specialization )")
        .eq("userid", AppState.currentUser.id)
        .order("sessiondate", { ascending: true })
        .order("starttime", { ascending: true });

      if (error) throw error;

      AppState.bookings = data || [];
      Booking.renderList(data || []);
    } catch (error) {
      console.error("Error loading bookings:", error);
      Utils.showError("booking-list", "Failed to load your bookings. Please try refreshing.");
    }
  },

  // Render bookings list
  renderList: (bookings, containerId = "booking-list") => {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!bookings || bookings.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <h3>No Bookings Yet</h3>
          <p>You haven't booked any sessions yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = bookings
      .map((booking) => {
        const therapist = booking.Therapists || {};
        const date = Utils.formatDate(booking.sessiondate);
        const time = Utils.formatTime(booking.starttime);

        // Determine status badge class
        let statusClass = "status-pending";
        if (booking.status === "confirmed") statusClass = "status-confirmed";
        else if (booking.status === "completed") statusClass = "status-completed";
        else if (booking.status === "cancelled") statusClass = "status-cancelled";

        return `
          <div class="booking-card" data-booking-id="${booking.id}">
            <div class="booking-header">
              <div class="booking-therapist">
                <div class="therapist-avatar-small">${therapist.Name ? therapist.Name.charAt(0) : "T"}</div>
                <div>
                  <h4 class="booking-title">Dr. ${therapist.Name || "Unknown Therapist"}</h4>
                  <p class="booking-specialization">${therapist.Specialization || "General Therapy"}</p>
                </div>
              </div>
              <span class="status-badge ${statusClass}">${String(booking.status || "").toUpperCase()}</span>
            </div>

            <div class="booking-details">
              <div class="detail-row">
                <span class="detail-label">Date</span>
                <span class="detail-value">${date}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Time</span>
                <span class="detail-value">${time}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Duration</span>
                <span class="detail-value">60 minutes</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Fee</span>
                <span class="detail-value">₹${booking.amount || 500}</span>
              </div>
            </div>

            <div class="booking-actions">
              ${
                booking.status === "confirmed"
                  ? `<button class="btn-cancel-booking" onclick="Booking.cancelBooking('${booking.id}')">Cancel Booking</button>`
                  : ""
              }
              ${
                booking.status === "completed"
                  ? `<button class="btn-feedback" onclick="Booking.submitFeedback('${booking.id}')">Leave Feedback</button>`
                  : ""
              }
              ${
                booking.status === "cancelled"
                  ? `<button class="btn-book-again" onclick="location.href='user-dashboard.html'">Book New Session</button>`
                  : ""
              }
            </div>
          </div>
        `;
      })
      .join("");
  },

  // Cancel a booking
  cancelBooking: async (bookingId) => {
    if (!bookingId) return;

    if (
      !confirm("Are you sure you want to cancel this booking? This action cannot be undone.")
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from("Bookings")
        .update({ status: "cancelled", cancelledat: new Date().toISOString() })
        .eq("id", bookingId);

      if (error) throw error;

      Utils.showNotification("Booking cancelled successfully", "success");
      Booking.loadUserBookings();
    } catch (error) {
      console.error("Cancel booking error:", error);
      Utils.showNotification("Error cancelling booking. Please try again.", "error");
    }
  },

  // Reschedule a booking
  rescheduleBooking: async () => {
    Utils.showNotification("Reschedule functionality coming soon!", "info");
  },

  // Submit feedback for completed session
  submitFeedback: async () => {
    Utils.showNotification("Feedback functionality coming soon!", "info");
  },
};

// Dashboard Management
const Dashboard = {
  // Initialize user dashboard
  init: async () => {
    try {
      // Check authentication
      const user = await Auth.checkAuth();
      if (!user) {
        window.location.href = "login.html";
        return;
      }

      // Update UI with user info
      Dashboard.updateUserInfo(user);

      // Load data
      await Promise.all([
        Therapists.loadAll().then((therapists) => Therapists.renderList(therapists || [])),
        Booking.loadUserBookings(),
      ]);

      // Initialize event listeners
      Dashboard.initEventListeners();
    } catch (error) {
      console.error("Dashboard init error:", error);
      Utils.showNotification("Error loading dashboard. Please refresh.", "error");
    }
  },

  // Update user info in UI
  updateUserInfo: (user) => {
    const welcomeElement = document.getElementById("welcome-message");
    const userInfoElement = document.getElementById("user-info");

    if (welcomeElement && user.fullname) {
      welcomeElement.textContent = `Welcome back, ${user.fullname.split(" ")[0]}!`;
    }

    if (userInfoElement) {
      userInfoElement.innerHTML = `
        <div class="user-profile">
          <div class="user-avatar">${user.fullname ? user.fullname.charAt(0).toUpperCase() : "U"}</div>
          <div class="user-details">
            <h3>${user.fullname || "User"}</h3>
            <p>${user.email || ""}</p>
            ${user.phone ? `<p>${user.phone}</p>` : ""}
          </div>
        </div>
      `;
    }
  },

  // Initialize event listeners
  initEventListeners: () => {
    // Search functionality
    const searchInput = document.getElementById("therapist-search");
    if (searchInput) {
      searchInput.addEventListener(
        "input",
        Utils.debounce(async (e) => {
          const query = e.target.value.trim();
          if (query.length >= 2) {
            const results = await Therapists.search(query);
            Therapists.renderList(results || []);
          } else if (query.length === 0) {
            Therapists.renderList(AppState.therapists || []);
          }
        }, 300)
      );
    }

    // Logout button
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        await Auth.logout();
      });
    }

    // Refresh buttons
    const refreshButtons = document.querySelectorAll(".btn-refresh");
    refreshButtons.forEach((btn) => btn.addEventListener("click", Dashboard.init));
  },
};

// Application Initialization
const App = {
  init: () => {
    App.injectStyles();

    // Global error handler
    window.addEventListener("error", (event) => {
      console.error("Global error:", event.error);
      Utils.showNotification("An unexpected error occurred. Please refresh the page.", "error");
    });

    // Handle unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      console.error("Unhandled rejection:", event.reason);
      Utils.showNotification("An unexpected error occurred. Please refresh the page.", "error");
    });

    console.log("MindSpace Application initialized");
  },

  injectStyles: () => {
    const styles = `
      .loading-container { text-align: center; padding: 40px 20px; }
      .loading-spinner { display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #5A9B8E; border-radius: 50%; animation: spin 1s linear infinite; }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

      .error-message { text-align: center; padding: 40px 20px; background: #FEF2F2; border-radius: 12px; border: 1px solid #FECACA; }
      .error-icon { font-size: 3rem; margin-bottom: 20px; }
      .btn-retry { background: #5A9B8E; color: white; padding: 10px 20px; border: none; border-radius: 8px; margin-top: 20px; cursor: pointer; }

      .notification { position: fixed; top: 20px; right: 20px; padding: 0; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); z-index: 1000; max-width: 400px; animation: slideIn 0.3s ease; }
      .notification-success { border-left: 4px solid #4CAF50; }
      .notification-error { border-left: 4px solid #F44336; }
      .notification-info { border-left: 4px solid #2196F3; }
      .notification-content { padding: 15px 20px; display: flex; align-items: center; gap: 15px; }
      .notification-icon { font-size: 1.5rem; }
      .notification-text { flex: 1; }
      .notification-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #666; }
      @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

      .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1001; padding: 20px; }
      .confirmation-dialog { background: white; padding: 30px; border-radius: 16px; max-width: 500px; width: 100%; box-shadow: 0 8px 30px rgba(0,0,0,0.2); }
      .confirmation-actions { display: flex; gap: 15px; margin-top: 25px; }
      .btn-confirm { background: #5A9B8E; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; flex: 1; }
      .btn-cancel { background: #F5F9F8; color: #666; padding: 12px 24px; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; flex: 1; }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  },
};

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", App.init);

// Make key functions globally available
window.Auth = Auth;
window.Therapists = Therapists;
window.Booking = Booking;
window.Dashboard = Dashboard;
window.Utils = Utils;

// Legacy compatibility functions
window.loadDashboard = Dashboard.init;
window.login = Auth.login;
window.logout = Auth.logout;
window.bookSession = Booking.bookSession;
window.cancelBooking = Booking.cancelBooking;
