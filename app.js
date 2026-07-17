import { 
    database, auth, ref, onValue, push, set, remove, update,
    signInWithPopup, onAuthStateChanged, signOut 
} from './firebase-config.js';

// ===== State Management =====
const state = {
    user: null,
    currentFrequency: 1,
    serverId: null,
    isPolice: false,
    userName: null,
    userRank: null,
    userTeam: null,
    audioContext: null,
    speechSynthesis: window.speechSynthesis,
    messages: [],
    dispatches: []
};

// ===== DOM Elements =====
const elements = {
    loginBtn: document.getElementById('loginBtn'),
    authSection: document.getElementById('authSection'),
    userSection: document.getElementById('userSection'),
    userAvatar: document.getElementById('userAvatar'),
    userName: document.getElementById('userName'),
    userRank: document.getElementById('userRank'),
    userTeam: document.getElementById('userTeam'),
    serverId: document.getElementById('serverId'),
    chatMessages: document.getElementById('chatMessages'),
    chatInput: document.getElementById('chatInput'),
    sendBtn: document.getElementById('sendBtn'),
    lockOverlay: document.getElementById('lockOverlay'),
    chatStatus: document.getElementById('chatStatus'),
    dispatchList: document.getElementById('dispatchList'),
    dispatchCount: document.getElementById('dispatchCount'),
    toastContainer: document.getElementById('toastContainer')
};

// ===== Configuration =====
const ROBLOX_GROUP_ID = 12345678; // Replace with your group ID
const POLICE_TEAM_RANKS = [250, 251, 252, 253, 254, 255];

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
    initializeEventListeners();
    initializeAudioContext();
    initializeParticles();
    showToast('System initialized', 'info');
});

// ===== Particles Animation =====
function initializeParticles() {
    const particles = document.querySelector('.particles');
    if (!particles) return;

    // Create floating particles
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: ${Math.random() * 3 + 1}px;
            height: ${Math.random() * 3 + 1}px;
            background: rgba(0, 212, 255, ${Math.random() * 0.5 + 0.2});
            border-radius: 50%;
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            animation: particleFloat ${Math.random() * 20 + 10}s linear infinite;
            pointer-events: none;
        `;
        particles.appendChild(particle);
    }

    // Add particle animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes particleFloat {
            0% { transform: translate(0, 0) scale(1); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translate(${Math.random() * 200 - 100}px, ${Math.random() * 200 - 100}px) scale(0); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// ===== Toast Notifications =====
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'toastSlideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ===== Authentication =====
function initializeAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            state.user = user;
            showToast('Welcome back, Officer!', 'success');
            await checkUserPermissions(user);
        } else {
            state.user = null;
            state.isPolice = false;
            updateUI();
        }
    });
}

async function checkUserPermissions(user) {
    try {
        const robloxUserId = user.providerData[0]?.uid;
        
        if (!robloxUserId) {
            showToast('Authentication error', 'error');
            return;
        }

        // Fetch user data (mock for demo)
        const userData = await fetchRobloxUserData(robloxUserId);
        const groupData = await fetchRobloxGroupData(robloxUserId);

        state.userName = userData.name;
        state.userRank = groupData.role?.name || 'Guest';
        
        const rankId = groupData.role?.rank || 0;
        state.isPolice = POLICE_TEAM_RANKS.includes(rankId);

        const avatarUrl = await fetchRobloxAvatar(robloxUserId);
        elements.userAvatar.src = avatarUrl;

        listenForServerUpdates(robloxUserId);
        updateUI();

        if (state.isPolice) {
            showToast('Access granted - Police MDT active', 'success');
        } else {
            showToast('Access denied - Not authorized', 'error');
        }
    } catch (error) {
        console.error('Permission check error:', error);
        showToast('Failed to verify permissions', 'error');
    }
}

async function fetchRobloxUserData(userId) {
    // Mock implementation - replace with actual API call
    return { name: 'Officer_' + userId.substring(0, 6) };
}

async function fetchRobloxGroupData(userId) {
    // Mock implementation
    return { role: { name: 'State Trooper', rank: 252 } };
}

async function fetchRobloxAvatar(userId) {
    // Mock implementation
    return `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`;
}

function listenForServerUpdates(userId) {
    const sessionRef = ref(database, `sessions/${userId}`);
    onValue(sessionRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            state.serverId = data.jobId;
            state.userTeam = data.team;
            elements.serverId.innerHTML = `<span class="server-id-text">${state.serverId}</span>`;
            updateUI();
            
            if (state.isPolice && state.serverId) {
                initializeChatListener();
                initializeDispatchListener();
            }
        }
    });
}

// ===== UI Updates =====
function updateUI() {
    const isLoggedIn = !!state.user;
    const hasAccess = isLoggedIn && state.isPolice && state.serverId;

    // Auth section
    if (isLoggedIn) {
        elements.authSection.classList.add('hidden');
        elements.userSection.classList.remove('hidden');
        elements.userName.textContent = state.userName || 'Unknown';
        elements.userRank.textContent = state.userRank || 'Unknown';
        elements.userTeam.textContent = state.userTeam || 'Not in game';
    } else {
        elements.authSection.classList.remove('hidden');
        elements.userSection.classList.add('hidden');
    }

    // Chat access
    if (hasAccess) {
        elements.lockOverlay.classList.add('hidden');
        elements.chatInput.disabled = false;
        elements.sendBtn.disabled = false;
        elements.chatStatus.innerHTML = `
            <span class="status-indicator">
                <span class="status-dot online"></span>
                <span class="status-text online">ONLINE</span>
            </span>
        `;
    } else {
        elements.lockOverlay.classList.remove('hidden');
        elements.chatInput.disabled = true;
        elements.sendBtn.disabled = true;
        elements.chatStatus.innerHTML = `
            <span class="status-indicator">
                <span class="status-dot"></span>
                <span class="status-text">LOCKED</span>
            </span>
        `;
    }
}

// ===== Event Listeners =====
function initializeEventListeners() {
    elements.loginBtn.addEventListener('click', handleLogin);

    // Frequency buttons with animation
    document.querySelectorAll('.freq-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const freq = parseInt(e.currentTarget.dataset.freq);
            switchFrequency(freq);
            
            // Add click animation
            btn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                btn.style.transform = '';
            }, 150);
        });
    });

    // Chat
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Quick commands with animation
    document.querySelectorAll('.cmd-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cmd = e.currentTarget.dataset.cmd;
            
            // Add click animation
            btn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                btn.style.transform = '';
            }, 150);
            
            sendQuickCommand(cmd);
        });
    });
}

async function handleLogin() {
    try {
        showToast('Connecting to Roblox...', 'info');
        // Implement actual Roblox OAuth
        // const provider = new OAuthProvider('roblox.com');
        // await signInWithPopup(auth, provider);
        showToast('Login system requires backend configuration', 'info');
    } catch (error) {
        console.error('Login error:', error);
        showToast('Login failed', 'error');
    }
}

// ===== Frequency Management =====
function switchFrequency(freq) {
    state.currentFrequency = freq;
    
    document.querySelectorAll('.freq-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-freq="${freq}"]`).classList.add('active');

    playRadioClick();

    const freqNames = { 1: 'PATROL', 2: 'SWAT', 3: 'AIR SUPPORT' };
    showToast(`Switched to Wave ${freq} - ${freqNames[freq]}`, 'info');
    announceToRadio(`Switching to Wave ${freq} - ${freqNames[freq]}`);

    // Reinitialize chat listener for new frequency
    if (state.isPolice && state.serverId) {
        initializeChatListener();
    }
}

// ===== Chat System =====
function initializeChatListener() {
    const chatRef = ref(database, `chat/${state.serverId}/${state.currentFrequency}`);
    
    onValue(chatRef, (snapshot) => {
        const messages = snapshot.val();
        renderMessages(messages || {});
    });
}

function renderMessages(messages) {
    elements.chatMessages.innerHTML = '';
    
    const sortedMessages = Object.entries(messages)
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);

    if (sortedMessages.length === 0) {
        elements.chatMessages.innerHTML = `
            <div class="system-message">
                <svg class="system-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <span>No messages yet</span>
            </div>
        `;
        return;
    }

    sortedMessages.forEach(([id, msg]) => {
        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message';
        messageEl.innerHTML = `
            <div class="meta">[Wave ${msg.frequency}] [${msg.rank}] ${msg.userName}</div>
            <div class="content">${escapeHtml(msg.content)}</div>
        `;
        elements.chatMessages.appendChild(messageEl);

        // Announce new messages
        if (msg.timestamp > Date.now() - 5000 && msg.userId !== state.user?.uid) {
            announceToRadio(msg.content);
        }
    });

    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

async function sendMessage() {
    const content = elements.chatInput.value.trim();
    if (!content || !state.isPolice || !state.serverId) return;

    const messageRef = push(ref(database, `chat/${state.serverId}/${state.currentFrequency}`));
    
    await set(messageRef, {
        userId: state.user.uid,
        userName: state.userName,
        rank: state.userRank,
        team: state.userTeam,
        frequency: state.currentFrequency,
        content: content,
        timestamp: Date.now()
    });

    elements.chatInput.value = '';
    showToast('Message sent', 'success');
}

async function sendQuickCommand(cmd) {
    const commands = {
        'DISPATCH': 'Dispatch, Unit standing by',
        '10-4': 'Roger that, 10-4',
        'BACKUP': 'Officer needs backup!',
        'SUSPECT FLEEING': 'Suspect is fleeing the scene!',
        'CODE 4': 'Code 4, situation under control'
    };

    const message = commands[cmd];
    if (!message) return;

    elements.chatInput.value = message;
    await sendMessage();
}

// ===== Dispatch System =====
function initializeDispatchListener() {
    const dispatchRef = ref(database, `dispatches/${state.serverId}`);
    
    onValue(dispatchRef, (snapshot) => {
        const dispatches = snapshot.val();
        renderDispatches(dispatches || {});
    });
}

function renderDispatches(dispatches) {
    const dispatchArray = Object.entries(dispatches);
    elements.dispatchCount.textContent = dispatchArray.length;

    if (dispatchArray.length === 0) {
        elements.dispatchList.innerHTML = `
            <div class="empty-state">
                <svg class="empty-icon" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <p class="empty-text">No active dispatches</p>
                <p class="empty-subtext">All units standing by</p>
            </div>
        `;
        return;
    }

    elements.dispatchList.innerHTML = '';
    dispatchArray.forEach(([id, dispatch]) => {
        const card = document.createElement('div');
        card.className = 'dispatch-card';
        card.innerHTML = `
            <div class="caller">📞 ${escapeHtml(dispatch.caller)}</div>
            <div class="type">🚨 ${escapeHtml(dispatch.type)}</div>
            <div class="location">📍 ${escapeHtml(dispatch.location)}</div>
            <button class="btn-clear" data-id="${id}">CLEAR DISPATCH</button>
        `;
        
        card.querySelector('.btn-clear').addEventListener('click', () => {
            clearDispatch(id);
            showToast('Dispatch cleared', 'success');
        });

        elements.dispatchList.appendChild(card);
    });
}

async function clearDispatch(dispatchId) {
    const dispatchRef = ref(database, `dispatches/${state.serverId}/${dispatchId}`);
    await remove(dispatchRef);
}

// ===== Audio System =====
function initializeAudioContext() {
    try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
        console.warn('Web Audio API not supported');
    }
}

function playRadioClick() {
    if (!state.audioContext) return;

    const oscillator = state.audioContext.createOscillator();
    const gainNode = state.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(state.audioContext.destination);

    oscillator.frequency.value = 1200;
    oscillator.type = 'square';

    gainNode.gain.setValueAtTime(0.2, state.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, state.audioContext.currentTime + 0.08);

    oscillator.start(state.audioContext.currentTime);
    oscillator.stop(state.audioContext.currentTime + 0.08);
}

function announceToRadio(text) {
    if (!state.speechSynthesis) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 0.9;
    utterance.volume = 0.8;

    playRadioClick();
    
    setTimeout(() => {
        state.speechSynthesis.speak(utterance);
    }, 100);

    utterance.onend = () => {
        setTimeout(() => playRadioClick(), 50);
    };
}

// ===== Utilities =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}