/**
 * MindSpace - Core Application Module
 * Comprehensive utilities, event handling, and application lifecycle management
 * Version: 2.0.0
 */

(function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION & CONSTANTS
    // ============================================
    
    const CONFIG = {
        APP_NAME: 'MindSpace',
        APP_VERSION: '2.0.0',
        API_BASE_URL: '',
        DEBUG_MODE: true,
        SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
        AUTO_SAVE_INTERVAL: 60000, // 1 minute
        MAX_UPLOAD_SIZE: 10 * 1024 * 1024, // 10MB
        SUPPORTED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
        DEFAULT_LANGUAGE: 'en',
        SUPPORTED_LANGUAGES: ['en', 'es', 'fr', 'de'],
        DATE_FORMAT: 'YYYY-MM-DD',
        TIME_FORMAT: 'HH:mm',
        CURRENCY: 'USD',
        TIMEZONE: 'UTC',
        GOOGLE_MAPS_API_KEY: '',
        RECAPTCHA_SITE_KEY: '',
        ANALYTICS_ID: ''
    };
    
    // ============================================
    // APPLICATION STATE MANAGEMENT
    // ============================================
    
    class AppState {
        constructor() {
            this.state = {
                user: null,
                session: null,
                notifications: [],
                loading: false,
                errors: [],
                theme: 'light',
                language: CONFIG.DEFAULT_LANGUAGE,
                sidebarCollapsed: false,
                modals: {
                    active: null,
                    data: null
                },
                forms: {},
                cache: {},
                preferences: this.loadPreferences()
            };
            
            this.subscribers = [];
            this.init();
        }
        
        init() {
            // Load saved state from localStorage
            const savedState = localStorage.getItem('mindspace_app_state');
            if (savedState) {
                try {
                    const parsed = JSON.parse(savedState);
                    this.state = { ...this.state, ...parsed };
                } catch (e) {
                    console.warn('Failed to load app state:', e);
                }
            }
            
            // Auto-save state
            setInterval(() => this.save(), CONFIG.AUTO_SAVE_INTERVAL);
        }
        
        get(key, defaultValue = null) {
            return key.split('.').reduce((obj, k) => (obj || {})[k], this.state) || defaultValue;
        }
        
        set(key, value) {
            const keys = key.split('.');
            const lastKey = keys.pop();
            const target = keys.reduce((obj, k) => obj[k] = obj[k] || {}, this.state);
            target[lastKey] = value;
            this.notify(key, value);
            return this;
        }
        
        update(updates) {
            Object.assign(this.state, updates);
            this.notify('*', updates);
            return this;
        }
        
        subscribe(key, callback) {
            this.subscribers.push({ key, callback });
            return () => {
                this.subscribers = this.subscribers.filter(sub => 
                    sub.key !== key || sub.callback !== callback
                );
            };
        }
        
        notify(changedKey, value) {
            this.subscribers.forEach(({ key, callback }) => {
                if (key === changedKey || key === '*') {
                    callback(value, changedKey, this.state);
                }
            });
        }
        
        loadPreferences() {
            const defaults = {
                notifications: true,
                emailUpdates: true,
                darkMode: false,
                autoSave: true,
                fontSize: 'medium',
                reduceAnimations: false,
                highContrast: false,
                language: CONFIG.DEFAULT_LANGUAGE,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            };
            
            try {
                const saved = localStorage.getItem('mindspace_preferences');
                return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
            } catch (e) {
                return defaults;
            }
        }
        
        savePreferences() {
            localStorage.setItem('mindspace_preferences', JSON.stringify(this.state.preferences));
        }
        
        save() {
            if (this.state.preferences.autoSave) {
                try {
                    localStorage.setItem('mindspace_app_state', JSON.stringify({
                        theme: this.state.theme,
                        language: this.state.language,
                        sidebarCollapsed: this.state.sidebarCollapsed,
                        preferences: this.state.preferences
                    }));
                } catch (e) {
                    console.warn('Failed to save app state:', e);
                }
            }
        }
        
        reset() {
            this.state = {
                user: null,
                session: null,
                notifications: [],
                loading: false,
                errors: [],
                theme: 'light',
                language: CONFIG.DEFAULT_LANGUAGE,
                sidebarCollapsed: false,
                modals: { active: null, data: null },
                forms: {},
                cache: {},
                preferences: this.loadPreferences()
            };
            localStorage.removeItem('mindspace_app_state');
            this.notify('*', this.state);
        }
    }
    
    // ============================================
    // EVENT BUS SYSTEM
    // ============================================
    
    class EventBus {
        constructor() {
            this.events = new Map();
            this.globalHandlers = [];
        }
        
        on(event, handler) {
            if (!this.events.has(event)) {
                this.events.set(event, new Set());
            }
            this.events.get(event).add(handler);
            return () => this.off(event, handler);
        }
        
        off(event, handler) {
            if (this.events.has(event)) {
                this.events.get(event).delete(handler);
            }
        }
        
        emit(event, data = null) {
            // Global handlers
            this.globalHandlers.forEach(handler => {
                try {
                    handler(event, data);
                } catch (e) {
                    console.error('Global event handler error:', e);
                }
            });
            
            // Specific event handlers
            if (this.events.has(event)) {
                this.events.get(event).forEach(handler => {
                    try {
                        handler(data, event);
                    } catch (e) {
                        console.error(`Event handler error for "${event}":`, e);
                    }
                });
            }
        }
        
        once(event, handler) {
            const onceHandler = (data) => {
                handler(data);
                this.off(event, onceHandler);
            };
            this.on(event, onceHandler);
            return () => this.off(event, onceHandler);
        }
        
        addGlobalHandler(handler) {
            this.globalHandlers.push(handler);
            return () => {
                this.globalHandlers = this.globalHandlers.filter(h => h !== handler);
            };
        }
        
        removeAll(event = null) {
            if (event) {
                this.events.delete(event);
            } else {
                this.events.clear();
                this.globalHandlers = [];
            }
        }
    }
    
    // ============================================
    // NOTIFICATION SYSTEM
    // ============================================
    
    class NotificationSystem {
        constructor() {
            this.notifications = [];
            this.container = null;
            this.maxNotifications = 5;
            this.autoHideDuration = 5000;
            this.position = 'top-right';
            this.init();
        }
        
        init() {
            // Create notification container
            this.container = document.createElement('div');
            this.container.id = 'mindspace-notifications';
            this.container.style.cssText = `
                position: fixed;
                z-index: 99999;
                max-width: 400px;
                pointer-events: none;
            `;
            
            // Set position
            this.updatePosition();
            
            // Add to DOM
            document.body.appendChild(this.container);
            
            // Listen for system events
            window.addEventListener('online', () => this.show('You are back online', 'success'));
            window.addEventListener('offline', () => this.show('You are offline', 'warning'));
        }
        
        updatePosition() {
            switch (this.position) {
                case 'top-left':
                    this.container.style.top = '20px';
                    this.container.style.left = '20px';
                    this.container.style.right = 'auto';
                    this.container.style.bottom = 'auto';
                    break;
                case 'top-right':
                    this.container.style.top = '20px';
                    this.container.style.right = '20px';
                    this.container.style.left = 'auto';
                    this.container.style.bottom = 'auto';
                    break;
                case 'bottom-left':
                    this.container.style.bottom = '20px';
                    this.container.style.left = '20px';
                    this.container.style.top = 'auto';
                    this.container.style.right = 'auto';
                    break;
                case 'bottom-right':
                    this.container.style.bottom = '20px';
                    this.container.style.right = '20px';
                    this.container.style.top = 'auto';
                    this.container.style.left = 'auto';
                    break;
                case 'top-center':
                    this.container.style.top = '20px';
                    this.container.style.left = '50%';
                    this.container.style.right = 'auto';
                    this.container.style.bottom = 'auto';
                    this.container.style.transform = 'translateX(-50%)';
                    break;
                case 'bottom-center':
                    this.container.style.bottom = '20px';
                    this.container.style.left = '50%';
                    this.container.style.top = 'auto';
                    this.container.style.right = 'auto';
                    this.container.style.transform = 'translateX(-50%)';
                    break;
            }
        }
        
        show(message, type = 'info', options = {}) {
            const id = Date.now() + Math.random();
            const notification = {
                id,
                message,
                type,
                timestamp: new Date(),
                duration: options.duration || this.autoHideDuration,
                action: options.action,
                persistent: options.persistent || false
            };
            
            // Add to array
            this.notifications.unshift(notification);
            
            // Limit notifications
            if (this.notifications.length > this.maxNotifications) {
                const removed = this.notifications.pop();
                this.removeFromDOM(removed.id);
            }
            
            // Create DOM element
            this.createNotificationElement(notification);
            
            // Auto-remove if not persistent
            if (!notification.persistent && notification.duration > 0) {
                setTimeout(() => this.remove(id), notification.duration);
            }
            
            // Emit event
            window.dispatchEvent(new CustomEvent('mindspace:notification', {
                detail: notification
            }));
            
            return id;
        }
        
        createNotificationElement(notification) {
            const element = document.createElement('div');
            element.id = `notification-${notification.id}`;
            element.className = `notification notification-${notification.type}`;
            element.style.cssText = `
                background: ${this.getBackgroundColor(notification.type)};
                color: white;
                padding: 16px 20px;
                border-radius: 12px;
                margin-bottom: 12px;
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
                display: flex;
                align-items: flex-start;
                gap: 12px;
                animation: slideIn 0.3s ease;
                pointer-events: auto;
                max-width: 400px;
                border-left: 4px solid ${this.getBorderColor(notification.type)};
                transition: transform 0.3s ease, opacity 0.3s ease;
            `;
            
            // Icon based on type
            const icon = this.getIcon(notification.type);
            
            // Action button if provided
            let actionButton = '';
            if (notification.action) {
                actionButton = `
                    <button class="notification-action" 
                            onclick="${notification.action.handler}"
                            style="
                                background: rgba(255, 255, 255, 0.2);
                                border: none;
                                color: white;
                                padding: 6px 12px;
                                border-radius: 6px;
                                font-weight: 600;
                                cursor: pointer;
                                transition: background 0.2s;
                                margin-left: auto;
                                white-space: nowrap;
                            "
                            onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'"
                            onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'">
                        ${notification.action.label}
                    </button>
                `;
            }
            
            element.innerHTML = `
                <i class="fas ${icon}" style="font-size: 1.2rem; margin-top: 2px;"></i>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; margin-bottom: 4px;">${this.getTitle(notification.type)}</div>
                    <div style="font-size: 0.95rem; line-height: 1.5;">${notification.message}</div>
                </div>
                ${actionButton}
                <button class="notification-close" 
                        onclick="window.MindSpace.Notifications.remove('${notification.id}')"
                        style="
                            background: none;
                            border: none;
                            color: white;
                            font-size: 1.2rem;
                            cursor: pointer;
                            padding: 4px;
                            margin-left: 8px;
                            opacity: 0.7;
                            transition: opacity 0.2s;
                        "
                        onmouseover="this.style.opacity='1'"
                        onmouseout="this.style.opacity='0.7'">
                    &times;
                </button>
            `;
            
            // Add to container
            if (this.container.firstChild) {
                this.container.insertBefore(element, this.container.firstChild);
            } else {
                this.container.appendChild(element);
            }
            
            // Add animation
            setTimeout(() => {
                element.style.animation = 'none';
            }, 300);
        }
        
        getIcon(type) {
            switch(type) {
                case 'success': return 'fa-check-circle';
                case 'error': return 'fa-exclamation-triangle';
                case 'warning': return 'fa-exclamation-circle';
                case 'info': return 'fa-info-circle';
                default: return 'fa-bell';
            }
        }
        
        getTitle(type) {
            switch(type) {
                case 'success': return 'Success';
                case 'error': return 'Error';
                case 'warning': return 'Warning';
                case 'info': return 'Info';
                default: return 'Notification';
            }
        }
        
        getBackgroundColor(type) {
            switch(type) {
                case 'success': return 'linear-gradient(135deg, #10B981 0%, #059669 100%)';
                case 'error': return 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)';
                case 'warning': return 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)';
                case 'info': return 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)';
                default: return 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)';
            }
        }
        
        getBorderColor(type) {
            switch(type) {
                case 'success': return '#059669';
                case 'error': return '#B91C1C';
                case 'warning': return '#D97706';
                case 'info': return '#2563EB';
                default: return '#4B5563';
            }
        }
        
        remove(id) {
            const index = this.notifications.findIndex(n => n.id === id);
            if (index !== -1) {
                this.notifications.splice(index, 1);
                this.removeFromDOM(id);
            }
        }
        
        removeFromDOM(id) {
            const element = document.getElementById(`notification-${id}`);
            if (element) {
                element.style.transform = 'translateX(100%)';
                element.style.opacity = '0';
                setTimeout(() => {
                    if (element.parentNode) {
                        element.parentNode.removeChild(element);
                    }
                }, 300);
            }
        }
        
        clear() {
            this.notifications = [];
            while (this.container.firstChild) {
                this.container.removeChild(this.container.firstChild);
            }
        }
        
        setPosition(position) {
            this.position = position;
            this.updatePosition();
        }
        
        setMaxNotifications(max) {
            this.maxNotifications = max;
            while (this.notifications.length > max) {
                const removed = this.notifications.pop();
                this.removeFromDOM(removed.id);
            }
        }
        
        setAutoHideDuration(duration) {
            this.autoHideDuration = duration;
        }
    }
    
    // ============================================
    // MODAL SYSTEM
    // ============================================
    
    class ModalSystem {
        constructor() {
            this.modals = new Map();
            this.activeModal = null;
            this.history = [];
            this.container = null;
            this.init();
        }
        
        init() {
            // Create modal container
            this.container = document.createElement('div');
            this.container.id = 'mindspace-modal-container';
            this.container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 20px;
                box-sizing: border-box;
            `;
            
            // Create backdrop
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop';
            backdrop.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                animation: fadeIn 0.3s ease;
            `;
            
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    this.close();
                }
            });
            
            this.container.appendChild(backdrop);
            document.body.appendChild(this.container);
            
            // Add keyboard events
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.activeModal) {
                    this.close();
                }
            });
            
            // Prevent body scroll when modal is open
            this.preventScroll();
        }
        
        preventScroll() {
            let preventScroll = false;
            
            this.container.addEventListener('mouseenter', () => {
                preventScroll = true;
            });
            
            this.container.addEventListener('mouseleave', () => {
                preventScroll = false;
            });
            
            document.addEventListener('wheel', (e) => {
                if (preventScroll) {
                    e.preventDefault();
                }
            }, { passive: false });
        }
        
        register(name, options = {}) {
            const modal = {
                name,
                title: options.title || '',
                content: options.content || '',
                size: options.size || 'medium', // small, medium, large, xlarge, full
                showClose: options.showClose !== false,
                closeOnBackdrop: options.closeOnBackdrop !== false,
                closeOnEsc: options.closeOnEsc !== false,
                showHeader: options.showHeader !== false,
                showFooter: options.showFooter !== false,
                buttons: options.buttons || [],
                onOpen: options.onOpen || null,
                onClose: options.onClose || null,
                onConfirm: options.onConfirm || null,
                className: options.className || '',
                style: options.style || {},
                data: options.data || null,
                template: options.template || null
            };
            
            this.modals.set(name, modal);
            return this;
        }
        
        open(name, data = null) {
            if (!this.modals.has(name)) {
                console.error(`Modal "${name}" not registered`);
                return;
            }
            
            // Close current modal
            if (this.activeModal) {
                this.close();
            }
            
            const modal = this.modals.get(name);
            
            // Update data if provided
            if (data !== null) {
                modal.data = data;
            }
            
            // Add to history
            this.history.push(name);
            this.activeModal = modal;
            
            // Create modal element
            this.createModalElement(modal);
            
            // Show container
            this.container.style.display = 'flex';
            
            // Call onOpen callback
            if (modal.onOpen) {
                setTimeout(() => modal.onOpen(modal.data), 10);
            }
            
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
            
            // Emit event
            window.dispatchEvent(new CustomEvent('mindspace:modal:open', {
                detail: { name, data: modal.data }
            }));
            
            return this;
        }
        
        createModalElement(modal) {
            // Remove existing modal
            const existing = this.container.querySelector('.modal');
            if (existing) {
                existing.remove();
            }
            
            // Create modal element
            const modalEl = document.createElement('div');
            modalEl.className = `modal modal-${modal.size} ${modal.className}`;
            modalEl.style.cssText = `
                background: white;
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                z-index: 10001;
                animation: slideUp 0.3s ease;
                max-width: 95%;
                max-height: 95%;
                display: flex;
                flex-direction: column;
                ${this.getModalSize(modal.size)}
            `;
            
            // Apply custom styles
            Object.assign(modalEl.style, modal.style);
            
            // Create content based on template or default
            if (modal.template) {
                modalEl.innerHTML = modal.template(modal.data);
            } else {
                modalEl.innerHTML = this.createDefaultTemplate(modal);
            }
            
            this.container.appendChild(modalEl);
            
            // Add event listeners to buttons
            setTimeout(() => {
                modal.buttons.forEach(button => {
                    const btn = modalEl.querySelector(`[data-action="${button.action}"]`);
                    if (btn) {
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            if (button.handler) {
                                button.handler(modal.data);
                            }
                            if (button.close !== false) {
                                this.close();
                            }
                        });
                    }
                });
                
                // Close button
                const closeBtn = modalEl.querySelector('.modal-close');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => this.close());
                }
            }, 10);
        }
        
        createDefaultTemplate(modal) {
            let template = '';
            
            // Header
            if (modal.showHeader) {
                template += `
                    <div class="modal-header" style="
                        padding: 24px 30px;
                        border-bottom: 1px solid #E5E7EB;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                    ">
                        <h2 class="modal-title" style="
                            margin: 0;
                            font-size: 1.5rem;
                            color: #2C3E50;
                            font-weight: 700;
                        ">${modal.title}</h2>
                        ${modal.showClose ? `
                            <button class="modal-close" style="
                                background: none;
                                border: none;
                                font-size: 1.8rem;
                                color: #6B7280;
                                cursor: pointer;
                                padding: 4px;
                                border-radius: 50%;
                                width: 40px;
                                height: 40px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                transition: background 0.2s;
                            " onmouseover="this.style.background='#F3F4F6'" onmouseout="this.style.background='transparent'">
                                &times;
                            </button>
                        ` : ''}
                    </div>
                `;
            }
            
            // Body
            template += `
                <div class="modal-body" style="
                    padding: 30px;
                    flex: 1;
                    overflow-y: auto;
                ">
                    ${typeof modal.content === 'function' ? modal.content(modal.data) : modal.content}
                </div>
            `;
            
            // Footer
            if (modal.showFooter && modal.buttons.length > 0) {
                template += `
                    <div class="modal-footer" style="
                        padding: 20px 30px;
                        border-top: 1px solid #E5E7EB;
                        display: flex;
                        justify-content: ${modal.buttons.length === 1 ? 'flex-end' : 'space-between'};
                        gap: 12px;
                    ">
                        ${modal.buttons.map(button => `
                            <button type="button" 
                                    class="modal-btn modal-btn-${button.type || 'secondary'}"
                                    data-action="${button.action}"
                                    style="
                                        padding: 12px 24px;
                                        border: ${button.type === 'primary' ? 'none' : '2px solid #E5E7EB'};
                                        border-radius: 10px;
                                        background: ${button.type === 'primary' ? '#5A9B8E' : 'white'};
                                        color: ${button.type === 'primary' ? 'white' : '#2C3E50'};
                                        font-weight: 600;
                                        cursor: pointer;
                                        transition: all 0.2s;
                                        font-size: 1rem;
                                    "
                                    onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'"
                                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                                ${button.label}
                            </button>
                        `).join('')}
                    </div>
                `;
            }
            
            return template;
        }
        
        getModalSize(size) {
            switch(size) {
                case 'small':
                    return 'width: 400px;';
                case 'medium':
                    return 'width: 600px;';
                case 'large':
                    return 'width: 800px;';
                case 'xlarge':
                    return 'width: 1000px;';
                case 'full':
                    return 'width: 95vw; height: 95vh;';
                default:
                    return 'width: 600px;';
            }
        }
        
        close() {
            if (!this.activeModal) return;
            
            const modalName = this.activeModal.name;
            
            // Call onClose callback
            if (this.activeModal.onClose) {
                this.activeModal.onClose(this.activeModal.data);
            }
            
            // Remove modal element
            const modalEl = this.container.querySelector('.modal');
            if (modalEl) {
                modalEl.style.animation = 'slideDown 0.3s ease';
                setTimeout(() => modalEl.remove(), 300);
            }
            
            // Hide container after animation
            setTimeout(() => {
                this.container.style.display = 'none';
                document.body.style.overflow = '';
            }, 300);
            
            // Update state
            this.activeModal = null;
            
            // Emit event
            window.dispatchEvent(new CustomEvent('mindspace:modal:close', {
                detail: { name: modalName }
            }));
        }
        
        closeAll() {
            while (this.history.length > 0) {
                this.close();
            }
        }
        
        getActiveModal() {
            return this.activeModal;
        }
        
        isOpen() {
            return !!this.activeModal;
        }
        
        confirm(options) {
            return new Promise((resolve) => {
                this.register('confirm', {
                    title: options.title || 'Confirm',
                    content: options.message || 'Are you sure?',
                    size: 'small',
                    buttons: [
                        {
                            label: options.cancelLabel || 'Cancel',
                            action: 'cancel',
                            type: 'secondary',
                            handler: () => resolve(false),
                            close: true
                        },
                        {
                            label: options.confirmLabel || 'Confirm',
                            action: 'confirm',
                            type: 'primary',
                            handler: () => resolve(true),
                            close: true
                        }
                    ]
                });
                
                this.open('confirm');
            });
        }
        
        alert(options) {
            this.register('alert', {
                title: options.title || 'Alert',
                content: options.message || '',
                size: 'small',
                buttons: [
                    {
                        label: options.buttonLabel || 'OK',
                        action: 'ok',
                        type: 'primary',
                        close: true
                    }
                ]
            });
            
            this.open('alert');
        }
        
        prompt(options) {
            return new Promise((resolve) => {
                const template = (data) => `
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <p style="margin: 0; color: #6B7280;">${options.message || 'Please enter a value:'}</p>
                        <input type="${options.type || 'text'}" 
                               id="prompt-input"
                               value="${options.defaultValue || ''}"
                               placeholder="${options.placeholder || ''}"
                               style="
                                   padding: 12px 16px;
                                   border: 2px solid #E5E7EB;
                                   border-radius: 10px;
                                   font-size: 1rem;
                                   transition: border-color 0.2s;
                               "
                               onfocus="this.style.borderColor='#5A9B8E'"
                               onblur="this.style.borderColor='#E5E7EB'">
                        ${options.validation ? `
                            <div id="prompt-error" style="color: #DC2626; font-size: 0.9rem; display: none;"></div>
                        ` : ''}
                    </div>
                `;
                
                this.register('prompt', {
                    title: options.title || 'Prompt',
                    template,
                    size: 'small',
                    buttons: [
                        {
                            label: options.cancelLabel || 'Cancel',
                            action: 'cancel',
                            type: 'secondary',
                            handler: () => resolve(null),
                            close: true
                        },
                        {
                            label: options.confirmLabel || 'OK',
                            action: 'confirm',
                            type: 'primary',
                            handler: () => {
                                const input = document.getElementById('prompt-input');
                                const value = input.value;
                                
                                if (options.validation) {
                                    const error = options.validation(value);
                                    if (error) {
                                        const errorEl = document.getElementById('prompt-error');
                                        errorEl.textContent = error;
                                        errorEl.style.display = 'block';
                                        return;
                                    }
                                }
                                
                                resolve(value);
                            },
                            close: true
                        }
                    ],
                    onOpen: () => {
                        setTimeout(() => {
                            const input = document.getElementById('prompt-input');
                            if (input) {
                                input.focus();
                                input.select();
                            }
                        }, 100);
                    }
                });
                
                this.open('prompt');
            });
        }
    }
    
    // ============================================
    // FORM VALIDATION SYSTEM
    // ============================================
    
    class FormValidator {
        constructor() {
            this.rules = new Map();
            this.messages = {
                required: 'This field is required',
                email: 'Please enter a valid email address',
                minLength: 'Must be at least {min} characters',
                maxLength: 'Must be at most {max} characters',
                match: 'Values do not match',
                pattern: 'Invalid format',
                number: 'Must be a number',
                min: 'Must be at least {min}',
                max: 'Must be at most {max}',
                url: 'Please enter a valid URL',
                phone: 'Please enter a valid phone number',
                date: 'Please enter a valid date',
                time: 'Please enter a valid time',
                custom: 'Invalid value'
            };
            this.init();
        }
        
        init() {
            // Default validation rules
            this.addRule('required', (value) => {
                if (value === undefined || value === null) return false;
                if (typeof value === 'string') return value.trim().length > 0;
                if (Array.isArray(value)) return value.length > 0;
                return true;
            });
            
            this.addRule('email', (value) => {
                if (!value) return true;
                const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return re.test(value);
            });
            
            this.addRule('minLength', (value, min) => {
                if (!value) return true;
                return String(value).length >= min;
            });
            
            this.addRule('maxLength', (value, max) => {
                if (!value) return true;
                return String(value).length <= max;
            });
            
            this.addRule('match', (value, fieldName, formData) => {
                return value === formData[fieldName];
            });
            
            this.addRule('pattern', (value, pattern) => {
                if (!value) return true;
                const re = new RegExp(pattern);
                return re.test(value);
            });
            
            this.addRule('number', (value) => {
                if (!value) return true;
                return !isNaN(parseFloat(value)) && isFinite(value);
            });
            
            this.addRule('min', (value, min) => {
                if (!value) return true;
                const num = parseFloat(value);
                return !isNaN(num) && num >= min;
            });
            
            this.addRule('max', (value, max) => {
                if (!value) return true;
                const num = parseFloat(value);
                return !isNaN(num) && num <= max;
            });
            
            this.addRule('url', (value) => {
                if (!value) return true;
                try {
                    new URL(value);
                    return true;
                } catch {
                    return false;
                }
            });
            
            this.addRule('phone', (value) => {
                if (!value) return true;
                const re = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
                return re.test(value.replace(/\s/g, ''));
            });
        }
        
        addRule(name, validator, message = null) {
            this.rules.set(name, { validator, message: message || this.messages[name] || 'Invalid value' });
        }
        
        validate(formData, rules) {
            const errors = {};
            let isValid = true;
            
            for (const [fieldName, fieldRules] of Object.entries(rules)) {
                const value = formData[fieldName];
                const fieldErrors = [];
                
                for (const rule of fieldRules) {
                    const [ruleName, ...ruleParams] = Array.isArray(rule) ? rule : [rule];
                    
                    if (!this.rules.has(ruleName)) {
                        console.warn(`Validation rule "${ruleName}" not found`);
                        continue;
                    }
                    
                    const { validator, message } = this.rules.get(ruleName);
                    
                    // Special handling for match rule
                    let params = ruleParams;
                    if (ruleName === 'match') {
                        params = [params[0], formData];
                    }
                    
                    if (!validator(value, ...params)) {
                        let errorMessage = message;
                        
                        // Replace placeholders in error message
                        if (ruleParams.length > 0) {
                            for (let i = 0; i < ruleParams.length; i++) {
                                errorMessage = errorMessage.replace(`{${i}}`, ruleParams[i]);
                            }
                        }
                        
                        // Replace named placeholders
                        errorMessage = errorMessage.replace('{min}', ruleParams[0])
                                                  .replace('{max}', ruleParams[0])
                                                  .replace('{field}', fieldName);
                        
                        fieldErrors.push(errorMessage);
                        isValid = false;
                    }
                }
                
                if (fieldErrors.length > 0) {
                    errors[fieldName] = fieldErrors;
                }
            }
            
            return { isValid, errors };
        }
        
        validateField(value, rules) {
            const errors = [];
            
            for (const rule of rules) {
                const [ruleName, ...ruleParams] = Array.isArray(rule) ? rule : [rule];
                
                if (!this.rules.has(ruleName)) {
                    console.warn(`Validation rule "${ruleName}" not found`);
                    continue;
                }
                
                const { validator, message } = this.rules.get(ruleName);
                
                if (!validator(value, ...ruleParams)) {
                    let errorMessage = message;
                    
                    if (ruleParams.length > 0) {
                        for (let i = 0; i < ruleParams.length; i++) {
                            errorMessage = errorMessage.replace(`{${i}}`, ruleParams[i]);
                        }
                    }
                    
                    errorMessage = errorMessage.replace('{min}', ruleParams[0])
                                              .replace('{max}', ruleParams[0]);
                    
                    errors.push(errorMessage);
                }
            }
            
            return errors;
        }
        
        setMessages(messages) {
            Object.assign(this.messages, messages);
        }
        
        createFormValidator(formElement) {
            const form = formElement;
            const fields = {};
            
            // Find all fields with data-validation attribute
            const inputs = form.querySelectorAll('[data-validation]');
            
            inputs.forEach(input => {
                const fieldName = input.name || input.id;
                const validationRules = input.getAttribute('data-validation');
                
                try {
                    const rules = JSON.parse(validationRules);
                    fields[fieldName] = rules;
                } catch (e) {
                    console.error(`Invalid validation rules for ${fieldName}:`, e);
                }
                
                // Add validation on blur
                input.addEventListener('blur', () => {
                    this.validateFieldOnBlur(input);
                });
                
                // Add validation on input (for real-time feedback)
                input.addEventListener('input', () => {
                    this.validateFieldOnInput(input);
                });
            });
            
            // Form submit handler
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());
                
                const { isValid, errors } = this.validate(data, fields);
                
                if (isValid) {
                    form.submit();
                } else {
                    this.displayFormErrors(form, errors);
                }
            });
            
            return {
                validate: () => {
                    const formData = new FormData(form);
                    const data = Object.fromEntries(formData.entries());
                    return this.validate(data, fields);
                },
                clearErrors: () => this.clearFormErrors(form),
                getData: () => {
                    const formData = new FormData(form);
                    return Object.fromEntries(formData.entries());
                }
            };
        }
        
        validateFieldOnBlur(input) {
            const fieldName = input.name || input.id;
            const validationRules = input.getAttribute('data-validation');
            
            if (!validationRules) return;
            
            try {
                const rules = JSON.parse(validationRules);
                const errors = this.validateField(input.value, rules);
                
                this.displayFieldErrors(input, errors);
            } catch (e) {
                console.error('Validation error:', e);
            }
        }
        
        validateFieldOnInput(input) {
            const fieldName = input.name || input.id;
            const validationRules = input.getAttribute('data-validation');
            
            if (!validationRules) return;
            
            try {
                const rules = JSON.parse(validationRules);
                const errors = this.validateField(input.value, rules);
                
                if (errors.length === 0) {
                    this.clearFieldErrors(input);
                }
            } catch (e) {
                console.error('Validation error:', e);
            }
        }
        
        displayFieldErrors(input, errors) {
            // Remove existing error messages
            this.clearFieldErrors(input);
            
            if (errors.length === 0) return;
            
            // Add error class to input
            input.classList.add('error');
            
            // Create error container
            const errorContainer = document.createElement('div');
            errorContainer.className = 'field-error-container';
            errorContainer.style.cssText = `
                margin-top: 6px;
                animation: fadeIn 0.3s ease;
            `;
            
            // Add error messages
            errors.forEach(error => {
                const errorEl = document.createElement('div');
                errorEl.className = 'field-error';
                errorEl.style.cssText = `
                    color: #DC2626;
                    font-size: 0.85rem;
                    margin-top: 4px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                `;
                errorEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${error}`;
                errorContainer.appendChild(errorEl);
            });
            
            // Insert after input
            input.parentNode.insertBefore(errorContainer, input.nextSibling);
        }
        
        clearFieldErrors(input) {
            input.classList.remove('error');
            
            const errorContainer = input.parentNode.querySelector('.field-error-container');
            if (errorContainer) {
                errorContainer.remove();
            }
        }
        
        displayFormErrors(form, errors) {
            // Clear all existing errors first
            this.clearFormErrors(form);
            
            // Display new errors
            Object.entries(errors).forEach(([fieldName, fieldErrors]) => {
                const input = form.querySelector(`[name="${fieldName}"]`) || 
                             form.querySelector(`#${fieldName}`);
                
                if (input) {
                    this.displayFieldErrors(input, fieldErrors);
                }
            });
            
            // Scroll to first error
            const firstError = form.querySelector('.error');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstError.focus();
            }
        }
        
        clearFormErrors(form) {
            const errorInputs = form.querySelectorAll('.error');
            errorInputs.forEach(input => {
                input.classList.remove('error');
            });
            
            const errorContainers = form.querySelectorAll('.field-error-container');
            errorContainers.forEach(container => {
                container.remove();
            });
        }
    }
    
    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    
    const Utils = {
        // String utilities
        capitalize: function(str) {
            return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        },
        
        truncate: function(str, length = 100, suffix = '...') {
            if (str.length <= length) return str;
            return str.substring(0, length - suffix.length) + suffix;
        },
        
        slugify: function(str) {
            return str.toLowerCase()
                .replace(/[^\w\s-]/g, '')
                .replace(/[\s_-]+/g, '-')
                .replace(/^-+|-+$/g, '');
        },
        
        // Number utilities
        formatNumber: function(num, decimals = 2) {
            return new Intl.NumberFormat(CONFIG.DEFAULT_LANGUAGE, {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            }).format(num);
        },
        
        formatCurrency: function(amount, currency = CONFIG.CURRENCY) {
            return new Intl.NumberFormat(CONFIG.DEFAULT_LANGUAGE, {
                style: 'currency',
                currency: currency
            }).format(amount);
        },
        
        formatPercentage: function(value, decimals = 1) {
            return new Intl.NumberFormat(CONFIG.DEFAULT_LANGUAGE, {
                style: 'percent',
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            }).format(value / 100);
        },
        
        // Date and time utilities
        formatDate: function(date, format = CONFIG.DATE_FORMAT) {
            const d = new Date(date);
            
            if (format === 'relative') {
                return this.formatRelativeDate(d);
            }
            
            const options = {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
            };
            
            return d.toLocaleDateString(CONFIG.DEFAULT_LANGUAGE, options);
        },
        
        formatTime: function(date, format = CONFIG.TIME_FORMAT) {
            const d = new Date(date);
            return d.toLocaleTimeString(CONFIG.DEFAULT_LANGUAGE, {
                hour: '2-digit',
                minute: '2-digit'
            });
        },
        
        formatDateTime: function(date) {
            return `${this.formatDate(date)} at ${this.formatTime(date)}`;
        },
        
        formatRelativeDate: function(date) {
            const now = new Date();
            const diffMs = now - new Date(date);
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);
            const diffDay = Math.floor(diffHour / 24);
            
            if (diffSec < 60) return 'just now';
            if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
            if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
            if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
            
            return this.formatDate(date);
        },
        
        // Array utilities
        unique: function(arr) {
            return [...new Set(arr)];
        },
        
        chunk: function(arr, size) {
            const chunks = [];
            for (let i = 0; i < arr.length; i += size) {
                chunks.push(arr.slice(i, i + size));
            }
            return chunks;
        },
        
        groupBy: function(arr, key) {
            return arr.reduce((groups, item) => {
                const groupKey = typeof key === 'function' ? key(item) : item[key];
                if (!groups[groupKey]) groups[groupKey] = [];
                groups[groupKey].push(item);
                return groups;
            }, {});
        },
        
        // Object utilities
        deepClone: function(obj) {
            return JSON.parse(JSON.stringify(obj));
        },
        
        merge: function(target, ...sources) {
            sources.forEach(source => {
                for (const key in source) {
                    if (source[key] !== undefined) {
                        if (this.isObject(source[key]) && this.isObject(target[key])) {
                            target[key] = this.merge(target[key], source[key]);
                        } else {
                            target[key] = source[key];
                        }
                    }
                }
            });
            return target;
        },
        
        pick: function(obj, keys) {
            return keys.reduce((result, key) => {
                if (obj.hasOwnProperty(key)) {
                    result[key] = obj[key];
                }
                return result;
            }, {});
        },
        
        omit: function(obj, keys) {
            const result = { ...obj };
            keys.forEach(key => delete result[key]);
            return result;
        },
        
        // DOM utilities
        createElement: function(tag, attributes = {}, children = []) {
            const element = document.createElement(tag);
            
            Object.entries(attributes).forEach(([key, value]) => {
                if (key === 'style' && typeof value === 'object') {
                    Object.assign(element.style, value);
                } else if (key === 'className') {
                    element.className = value;
                } else if (key === 'textContent') {
                    element.textContent = value;
                } else if (key === 'innerHTML') {
                    element.innerHTML = value;
                } else if (key.startsWith('on') && typeof value === 'function') {
                    element.addEventListener(key.substring(2).toLowerCase(), value);
                } else {
                    element.setAttribute(key, value);
                }
            });
            
            children.forEach(child => {
                if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                } else if (child instanceof Node) {
                    element.appendChild(child);
                }
            });
            
            return element;
        },
        
        removeElement: function(selector) {
            const element = typeof selector === 'string' ? 
                document.querySelector(selector) : selector;
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        },
        
        toggleClass: function(element, className, force) {
            if (typeof element === 'string') {
                element = document.querySelector(element);
            }
            
            if (element) {
                element.classList.toggle(className, force);
            }
        },
        
        // Storage utilities
        storage: {
            set: function(key, value, ttl = null) {
                const item = {
                    value: value,
                    expiry: ttl ? Date.now() + ttl : null
                };
                localStorage.setItem(key, JSON.stringify(item));
            },
            
            get: function(key) {
                const itemStr = localStorage.getItem(key);
                if (!itemStr) return null;
                
                try {
                    const item = JSON.parse(itemStr);
                    if (item.expiry && Date.now() > item.expiry) {
                        localStorage.removeItem(key);
                        return null;
                    }
                    return item.value;
                } catch (e) {
                    return null;
                }
            },
            
            remove: function(key) {
                localStorage.removeItem(key);
            },
            
            clear: function() {
                localStorage.clear();
            }
        },
        
        // Network utilities
        fetchJSON: async function(url, options = {}) {
            const defaultOptions = {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include'
            };
            
            const response = await fetch(url, { ...defaultOptions, ...options });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response.json();
        },
        
        postJSON: async function(url, data, options = {}) {
            return this.fetchJSON(url, {
                method: 'POST',
                body: JSON.stringify(data),
                ...options
            });
        },
        
        putJSON: async function(url, data, options = {}) {
            return this.fetchJSON(url, {
                method: 'PUT',
                body: JSON.stringify(data),
                ...options
            });
        },
        
        deleteJSON: async function(url, options = {}) {
            return this.fetchJSON(url, {
                method: 'DELETE',
                ...options
            });
        },
        
        // Validation utilities
        isEmail: function(email) {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
        },
        
        isURL: function(url) {
            try {
                new URL(url);
                return true;
            } catch {
                return false;
            }
        },
        
        isPhone: function(phone) {
            const re = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
            return re.test(phone.replace(/\s/g, ''));
        },
        
        isObject: function(value) {
            return value !== null && typeof value === 'object' && !Array.isArray(value);
        },
        
        isEmpty: function(value) {
            if (value === null || value === undefined) return true;
            if (typeof value === 'string') return value.trim().length === 0;
            if (Array.isArray(value)) return value.length === 0;
            if (this.isObject(value)) return Object.keys(value).length === 0;
            return false;
        },
        
        // Misc utilities
        debounce: function(func, wait, immediate = false) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    timeout = null;
                    if (!immediate) func(...args);
                };
                const callNow = immediate && !timeout;
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
                if (callNow) func(...args);
            };
        },
        
        throttle: function(func, limit) {
            let inThrottle;
            return function executedFunction(...args) {
                if (!inThrottle) {
                    func(...args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },
        
        generateId: function(length = 8) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let result = '';
            for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        },
        
        generateUUID: function() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },
        
        parseQueryString: function(query) {
            return new URLSearchParams(query);
        },
        
        buildQueryString: function(params) {
            const searchParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    searchParams.append(key, String(value));
                }
            });
            return searchParams.toString();
        }
    };
    
    // ============================================
    // INITIALIZATION & EXPORT
    // ============================================
    
    // Initialize systems
    const appState = new AppState();
    const eventBus = new EventBus();
    const notifications = new NotificationSystem();
    const modals = new ModalSystem();
    const formValidator = new FormValidator();
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        // Initialize common features
        initializeCommonFeatures();
        
        // Initialize page-specific features
        initializePageFeatures();
        
        // Start application
        startApplication();
        
        console.log(`🚀 ${CONFIG.APP_NAME} v${CONFIG.APP_VERSION} initialized`);
    });
    
    function initializeCommonFeatures() {
        // Set up global error handling
        window.addEventListener('error', handleGlobalError);
        window.addEventListener('unhandledrejection', handlePromiseRejection);
        
        // Initialize tooltips
        initializeTooltips();
        
        // Initialize dropdowns
        initializeDropdowns();
        
        // Initialize tabs
        initializeTabs();
        
        // Initialize accordions
        initializeAccordions();
        
        // Initialize loading indicators
        initializeLoadingIndicators();
    }
    
    function initializePageFeatures() {
        const page = document.body.dataset.page || 
                    window.location.pathname.split('/').pop().replace('.html', '');
        
        switch(page) {
            case 'index':
                initializeHomePage();
                break;
            case 'login':
            case 'signup-user':
            case 'signup-therapist':
                initializeAuthPage();
                break;
            case 'user-dashboard':
            case 'therapist-dashboard':
            case 'admin-dashboard':
                initializeDashboardPage();
                break;
            case 'about':
                initializeAboutPage();
                break;
            case 'contact':
                initializeContactPage();
                break;
            default:
                initializeGenericPage();
        }
    }
    
    function startApplication() {
        // Start analytics
        startAnalytics();
        
        // Start performance monitoring
        startPerformanceMonitoring();
        
        // Start session management
        startSessionManagement();
        
        // Start auto-save
        startAutoSave();
        
        // Emit app started event
        eventBus.emit('app:started', {
            timestamp: new Date(),
            version: CONFIG.APP_VERSION
        });
    }
    
    function handleGlobalError(event) {
        if (CONFIG.DEBUG_MODE) {
            console.error('Global error:', event.error);
        }
        
        notifications.show(
            'An unexpected error occurred. Please refresh the page.',
            'error',
            { persistent: false }
        );
        
        eventBus.emit('app:error', {
            error: event.error,
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        });
    }
    
    function handlePromiseRejection(event) {
        if (CONFIG.DEBUG_MODE) {
            console.error('Unhandled promise rejection:', event.reason);
        }
        
        notifications.show(
            'An operation failed. Please try again.',
            'error',
            { persistent: false }
        );
        
        eventBus.emit('app:promise-rejection', {
            reason: event.reason,
            promise: event.promise
        });
    }
    
    function initializeTooltips() {
        // Tooltip implementation
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        
        tooltipElements.forEach(element => {
            let tooltip = null;
            let timeout = null;
            
            element.addEventListener('mouseenter', (e) => {
                timeout = setTimeout(() => {
                    const text = element.getAttribute('data-tooltip');
                    if (!text) return;
                    
                    tooltip = document.createElement('div');
                    tooltip.className = 'mindspace-tooltip';
                    tooltip.textContent = text;
                    tooltip.style.cssText = `
                        position: absolute;
                        background: rgba(0, 0, 0, 0.8);
                        color: white;
                        padding: 8px 12px;
                        border-radius: 6px;
                        font-size: 0.85rem;
                        z-index: 1000;
                        white-space: nowrap;
                        pointer-events: none;
                        animation: fadeIn 0.2s ease;
                        max-width: 300px;
                        word-wrap: break-word;
                        white-space: normal;
                    `;
                    
                    document.body.appendChild(tooltip);
                    
                    const rect = element.getBoundingClientRect();
                    const tooltipRect = tooltip.getBoundingClientRect();
                    
                    let top = rect.top - tooltipRect.height - 8;
                    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
                    
                    // Adjust if going off screen
                    if (top < 0) top = rect.bottom + 8;
                    if (left < 0) left = 0;
                    if (left + tooltipRect.width > window.innerWidth) {
                        left = window.innerWidth - tooltipRect.width;
                    }
                    
                    tooltip.style.top = top + 'px';
                    tooltip.style.left = left + 'px';
                }, 300);
            });
            
            element.addEventListener('mouseleave', () => {
                clearTimeout(timeout);
                if (tooltip && tooltip.parentNode) {
                    tooltip.parentNode.removeChild(tooltip);
                    tooltip = null;
                }
            });
        });
    }
    
    function initializeDropdowns() {
        // Dropdown implementation
        const dropdowns = document.querySelectorAll('.dropdown');
        
        dropdowns.forEach(dropdown => {
            const toggle = dropdown.querySelector('.dropdown-toggle');
            const menu = dropdown.querySelector('.dropdown-menu');
            
            if (!toggle || !menu) return;
            
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const isOpen = menu.style.display === 'block';
                
                // Close all other dropdowns
                document.querySelectorAll('.dropdown-menu').forEach(m => {
                    m.style.display = 'none';
                });
                
                menu.style.display = isOpen ? 'none' : 'block';
            });
        });
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                menu.style.display = 'none';
            });
        });
    }
    
    function initializeTabs() {
        // Tab implementation
        const tabContainers = document.querySelectorAll('.tabs');
        
        tabContainers.forEach(container => {
            const tabs = container.querySelectorAll('.tab');
            const contents = container.querySelectorAll('.tab-content');
            
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const tabId = tab.getAttribute('data-tab');
                    
                    // Update active tab
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    
                    // Show corresponding content
                    contents.forEach(content => {
                        content.style.display = content.id === tabId ? 'block' : 'none';
                    });
                });
            });
        });
    }
    
    function initializeAccordions() {
        // Accordion implementation
        const accordions = document.querySelectorAll('.accordion');
        
        accordions.forEach(accordion => {
            const header = accordion.querySelector('.accordion-header');
            const content = accordion.querySelector('.accordion-content');
            
            if (!header || !content) return;
            
            header.addEventListener('click', () => {
                const isOpen = content.style.display === 'block';
                
                content.style.display = isOpen ? 'none' : 'block';
                header.classList.toggle('active', !isOpen);
            });
        });
    }
    
    function initializeLoadingIndicators() {
        // Global loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'global-loading';
        loadingIndicator.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 3px;
            background: linear-gradient(90deg, #5A9B8E 0%, #4A8B7E 100%);
            z-index: 99999;
            transform: translateX(-100%);
            transition: transform 0.3s ease;
        `;
        
        document.body.appendChild(loadingIndicator);
        
        // Show/hide loading indicator
        eventBus.on('app:loading:start', () => {
            loadingIndicator.style.transition = 'transform 0.3s ease';
            loadingIndicator.style.transform = 'translateX(-30%)';
            
            setTimeout(() => {
                loadingIndicator.style.transition = 'transform 2s ease';
                loadingIndicator.style.transform = 'translateX(100%)';
            }, 100);
        });
        
        eventBus.on('app:loading:end', () => {
            setTimeout(() => {
                loadingIndicator.style.transition = 'transform 0.3s ease';
                loadingIndicator.style.transform = 'translateX(-100%)';
            }, 500);
        });
    }
    
    function initializeHomePage() {
        // Home page specific initialization
        console.log('Initializing home page...');
    }
    
    function initializeAuthPage() {
        // Auth page specific initialization
        console.log('Initializing auth page...');
    }
    
    function initializeDashboardPage() {
        // Dashboard page specific initialization
        console.log('Initializing dashboard page...');
    }
    
    function initializeAboutPage() {
        // About page specific initialization
        console.log('Initializing about page...');
    }
    
    function initializeContactPage() {
        // Contact page specific initialization
        console.log('Initializing contact page...');
    }
    
    function initializeGenericPage() {
        // Generic page initialization
        console.log('Initializing generic page...');
    }
    
    function startAnalytics() {
        if (CONFIG.ANALYTICS_ID) {
            console.log('Analytics started with ID:', CONFIG.ANALYTICS_ID);
        }
    }
    
    function startPerformanceMonitoring() {
        // Performance monitoring logic
        if ('performance' in window) {
            const perfObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    eventBus.emit('app:performance', entry);
                });
            });
            
            perfObserver.observe({ entryTypes: ['navigation', 'resource', 'paint'] });
        }
    }
    
    function startSessionManagement() {
        // Session timeout handling
        let timeout;
        
        function resetTimeout() {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                notifications.show('Your session will expire soon', 'warning');
                
                // Logout after additional warning
                setTimeout(() => {
                    if (typeof logoutUser === 'function') {
                        logoutUser();
                    }
                }, 60000);
            }, CONFIG.SESSION_TIMEOUT);
        }
        
        // Reset timeout on user activity
        ['click', 'mousemove', 'keypress', 'scroll'].forEach(event => {
            document.addEventListener(event, resetTimeout);
        });
        
        resetTimeout();
    }
    
    function startAutoSave() {
        setInterval(() => {
            if (appState.get('preferences.autoSave')) {
                appState.save();
                eventBus.emit('app:autosave');
            }
        }, CONFIG.AUTO_SAVE_INTERVAL);
    }
    
    // ============================================
    // GLOBAL EXPORTS
    // ============================================
    
    window.MindSpace = {
        // Core systems
        State: appState,
        Events: eventBus,
        Notifications: notifications,
        Modals: modals,
        Validator: formValidator,
        Utils: Utils,
        Config: CONFIG,
        
        // Methods
        init: function() {
            console.log(`${CONFIG.APP_NAME} initialized`);
        },
        
        // Page-specific methods
        Pages: {
            home: initializeHomePage,
            auth: initializeAuthPage,
            dashboard: initializeDashboardPage,
            about: initializeAboutPage,
            contact: initializeContactPage
        },
        
        // User methods
        User: {
            getCurrent: function() {
                return appState.get('user');
            },
            
            setCurrent: function(user) {
                appState.set('user', user);
                eventBus.emit('user:updated', user);
            },
            
            isAuthenticated: function() {
                return !!appState.get('user');
            },
            
            hasPermission: function(permission) {
                const user = appState.get('user');
                if (!user || !user.permissions) return false;
                return user.permissions.includes(permission);
            },
            
            hasRole: function(role) {
                const user = appState.get('user');
                if (!user || !user.roles) return false;
                return user.roles.includes(role);
            }
        },
        
        // Theme methods
        Theme: {
            set: function(theme) {
                document.documentElement.setAttribute('data-theme', theme);
                appState.set('theme', theme);
                localStorage.setItem('mindspace_theme', theme);
                eventBus.emit('theme:changed', theme);
            },
            
            get: function() {
                return appState.get('theme') || 'light';
            },
            
            toggle: function() {
                const current = this.get();
                const newTheme = current === 'light' ? 'dark' : 'light';
                this.set(newTheme);
                return newTheme;
            },
            
            load: function() {
                const saved = localStorage.getItem('mindspace_theme');
                const preferred = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                this.set(preferred);
            }
        },
        
        // Language methods
        Language: {
            set: function(lang) {
                if (!CONFIG.SUPPORTED_LANGUAGES.includes(lang)) {
                    console.warn(`Language "${lang}" not supported`);
                    return;
                }
                
                document.documentElement.lang = lang;
                appState.set('language', lang);
                localStorage.setItem('mindspace_language', lang);
                eventBus.emit('language:changed', lang);
            },
            
            get: function() {
                return appState.get('language') || CONFIG.DEFAULT_LANGUAGE;
            },
            
            load: function() {
                const saved = localStorage.getItem('mindspace_language');
                const browserLang = navigator.language.split('-')[0];
                const preferred = saved || (CONFIG.SUPPORTED_LANGUAGES.includes(browserLang) ? browserLang : CONFIG.DEFAULT_LANGUAGE);
                this.set(preferred);
            }
        },
        
        // Form methods
        Form: {
            create: function(formId, options = {}) {
                const form = document.getElementById(formId);
                if (!form) {
                    console.error(`Form "${formId}" not found`);
                    return null;
                }
                
                return formValidator.createFormValidator(form);
            },
            
            validate: function(formData, rules) {
                return formValidator.validate(formData, rules);
            }
        },
        
        // API methods
        API: {
            call: async function(endpoint, options = {}) {
                const url = CONFIG.API_BASE_URL + endpoint;
                eventBus.emit('api:call:start', { endpoint, options });
                
                try {
                    const response = await Utils.fetchJSON(url, options);
                    eventBus.emit('api:call:success', { endpoint, response });
                    return response;
                } catch (error) {
                    eventBus.emit('api:call:error', { endpoint, error });
                    throw error;
                } finally {
                    eventBus.emit('api:call:end', { endpoint });
                }
            },
            
            get: function(endpoint, options = {}) {
                return this.call(endpoint, { method: 'GET', ...options });
            },
            
            post: function(endpoint, data, options = {}) {
                return this.call(endpoint, { 
                    method: 'POST', 
                    body: JSON.stringify(data), 
                    ...options 
                });
            },
            
            put: function(endpoint, data, options = {}) {
                return this.call(endpoint, { 
                    method: 'PUT', 
                    body: JSON.stringify(data), 
                    ...options 
                });
            },
            
            delete: function(endpoint, options = {}) {
                return this.call(endpoint, { method: 'DELETE', ...options });
            }
        },
        
        // Storage methods
        Storage: {
            set: Utils.storage.set,
            get: Utils.storage.get,
            remove: Utils.storage.remove,
            clear: Utils.storage.clear
        },
        
        // Navigation methods
        Navigation: {
            goTo: function(url, options = {}) {
                const { replace = false, state = null } = options;
                
                if (replace) {
                    window.location.replace(url);
                } else {
                    window.location.href = url;
                }
            },
            
            back: function() {
                window.history.back();
            },
            
            forward: function() {
                window.history.forward();
            },
            
            reload: function() {
                window.location.reload();
            }
        },
        
        // Debug methods
        Debug: {
            log: function(...args) {
                if (CONFIG.DEBUG_MODE) {
                    console.log(`[${CONFIG.APP_NAME}]`, ...args);
                }
            },
            
            warn: function(...args) {
                if (CONFIG.DEBUG_MODE) {
                    console.warn(`[${CONFIG.APP_NAME}]`, ...args);
                }
            },
            
            error: function(...args) {
                if (CONFIG.DEBUG_MODE) {
                    console.error(`[${CONFIG.APP_NAME}]`, ...args);
                }
            },
            
            time: function(label) {
                if (CONFIG.DEBUG_MODE) {
                    console.time(`[${CONFIG.APP_NAME}] ${label}`);
                }
            },
            
            timeEnd: function(label) {
                if (CONFIG.DEBUG_MODE) {
                    console.timeEnd(`[${CONFIG.APP_NAME}] ${label}`);
                }
            }
        },
        
        // Utility methods
        debounce: Utils.debounce,
        throttle: Utils.throttle,
        generateId: Utils.generateId,
        formatDate: Utils.formatDate,
        formatTime: Utils.formatTime,
        formatCurrency: Utils.formatCurrency,
        isEmail: Utils.isEmail,
        isEmpty: Utils.isEmpty
    };
    
    // Initialize theme and language
    MindSpace.Theme.load();
    MindSpace.Language.load();
    
    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideUp {
            from { transform: translateY(50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes slideDown {
            from { transform: translateY(0); opacity: 1; }
            to { transform: translateY(50px); opacity: 0; }
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .mindspace-loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(90, 155, 142, 0.3);
            border-radius: 50%;
            border-top-color: #5A9B8E;
            animation: spin 1s linear infinite;
        }
        
        [data-theme="dark"] {
            color-scheme: dark;
        }
        
        [data-theme="light"] {
            color-scheme: light;
        }
        
        .sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
        }
        
        .print-only {
            display: none;
        }
        
        @media print {
            .no-print {
                display: none !important;
            }
            
            .print-only {
                display: block !important;
            }
        }
        
        @media (prefers-reduced-motion: reduce) {
            *,
            *::before,
            *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
                scroll-behavior: auto !important;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Global error handler for MindSpace
    window.addEventListener('error', function(event) {
        if (event.message && event.message.includes('MindSpace')) {
            event.preventDefault();
            MindSpace.Debug.error('Uncaught error:', event.error);
        }
    });
    
    console.log(`🌟 ${CONFIG.APP_NAME} v${CONFIG.APP_VERSION} - Application Framework Loaded`);
})();
