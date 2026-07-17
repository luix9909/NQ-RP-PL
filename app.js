// ===== إعدادات نظام الرتب المسموحة داخل اللعبة =====
const ALLOWED_IN_GAME_RANKS = ["رئيس الهيئة", "وزير الداخلية", "ضابط عمليات", "ملازم أول", "نقيب", "ملازم"]; 

// الـ Client ID الخاص بك من لوحة تحكم روبلوكس
const ROBLOX_CLIENT_ID = "2210294996016219388";
const REDIRECT_URI = window.location.origin; 

// ===== حالة النظام =====
const state = {
    user: null,
    robloxUserId: null,
    currentFrequency: 1,
    serverId: null,
    isPolice: false,
    userName: null,
    userRank: null,
    userTeam: null,
    audioContext: null,
    speechSynthesis: window.speechSynthesis
};

// ===== عناصر واجهة المستخدم =====
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

// ===== التهيئة =====
// ===== التهيئة =====
// ===== التهيئة =====
document.addEventListener('DOMContentLoaded', () => {
    // كود وهمي لتخطي تسجيل الدخول وتجربة الصوت فوراً
    state.user = { id: 12345 };
    state.robloxUserId = 1; 
    state.userName = "سلمان_المطور";
    state.userRank = "وزير الداخلية"; 
    state.serverId = "TEST_SERVER_123"; 
    state.isPolice = true;
    
    updateUI(); // يفتح لك لوحة التحكم والشات فوراً
    
    initializeEventListeners();
    initializeAudioContext();
    
    // تشغيل مستمع الشات التجريبي
    if (window.supabaseClient) {
        initializeChatListener();
        initializeDispatchListener();
    }
});

// ===== 1. نظام المصادقة (Roblox OAuth) =====
function checkUrlForAuthCode() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
        window.history.replaceState({}, document.title, window.location.pathname);
        exchangeCodeForToken(code);
    }
}

async function exchangeCodeForToken(code) {
    showToast('جاري التحقق من حساب روبلوكس...', 'info');
    
    try {
        const response = await fetch(`https://apis.roblox.com/oauth/v1/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                client_id: ROBLOX_CLIENT_ID,
                redirect_uri: REDIRECT_URI
            })
        });
        
        const data = await response.json();
        if (data.access_token) {
            await verifyRobloxUser(data.access_token);
        } else {
            throw new Error('فشل الحصول على رمز الوصول');
        }
    } catch (error) {
        console.error('OAuth Error:', error);
        showToast('فشل تسجيل الدخول. تأكد من إعدادات OAuth في روبلوكس والروابط.', 'error');
    }
}

async function verifyRobloxUser(accessToken) {
    try {
        const response = await fetch('https://users.roblox.com/v1/users/authenticated', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const userData = await response.json();
        
        state.robloxUserId = userData.id;
        state.userName = userData.name;
        
        await setupSupabaseAuth(userData.id, userData.name);
    } catch (error) {
        console.error('Verification Error:', error);
        showToast('فشل التحقق من بيانات روبلوكس', 'error');
    }
}

async function setupSupabaseAuth(userId, name) {
    const sessionData = {
        id: userId,
        email: `${userId}@roblox.placeholder.com`,
        user_metadata: { displayName: name }
    };
    
    try {
        state.user = sessionData;
        showToast(`مرحباً بك، ${name}! جاري البحث عن جلستك في اللعبة...`, 'success');
        
        if (state.robloxUserId) {
            await listenForServerUpdates(state.robloxUserId);
        }
    } catch (error) {
        console.error('Supabase Setup Error:', error);
    }
}

function initializeAuth() {
    const cachedUser = state.user;
    if (cachedUser) {
        updateUI();
        if (state.robloxUserId) {
            listenForServerUpdates(state.robloxUserId);
        }
    } else {
        state.user = null;
        state.isPolice = false;
        updateUI();
    }
}

// ===== 2. تحديث واجهة المستخدم =====
function updateUI() {
    const isLoggedIn = !!state.user;
    const hasAccess = isLoggedIn && state.isPolice && state.serverId;

    if (isLoggedIn) {
        elements.authSection.classList.add('hidden');
        elements.userSection.classList.remove('hidden');
        elements.userName.textContent = state.userName || 'مستخدم';
        elements.userRank.textContent = state.userRank || 'في انتظار دخولك للسيرفر';
        elements.userTeam.textContent = state.userTeam || 'خارج اللعبة';
        elements.userAvatar.src = `https://www.roblox.com/headshot-thumbnail/image?userId=${state.robloxUserId}&width=150&height=150&format=png`;
    } else {
        elements.authSection.classList.remove('hidden');
        elements.userSection.classList.add('hidden');
    }

    if (hasAccess) {
        elements.lockOverlay.classList.add('hidden');
        elements.chatInput.disabled = false;
        elements.sendBtn.disabled = false;
        elements.chatStatus.innerHTML = `
            <span class="status-indicator">
                <span class="status-dot online"></span>
                <span class="status-text">متصل</span>
            </span>
        `;
        initializeChatListener();
        initializeDispatchListener();
    } else {
        elements.lockOverlay.classList.remove('hidden');
        elements.chatInput.disabled = true;
        elements.sendBtn.disabled = true;
        elements.chatStatus.innerHTML = `
            <span class="status-indicator">
                <span class="status-dot"></span>
                <span class="status-text">${isLoggedIn ? 'ادخل السيرفر برتبة مصرحة' : 'يرجى تسجيل الدخول'}</span>
            </span>
        `;
    }
}

// ===== 3. الاستماع لتحديثات اللعبة والتحقق من رتبة اللعبة الممررة =====
let sessionSubscription = null;

async function listenForServerUpdates(userId) {
    if (!window.supabaseClient) return;

    const { data, error } = await window.supabaseClient
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (!error && data) {
        state.serverId = data.jobId;
        state.userTeam = data.team;
        state.userRank = data.rank_name;
        
        state.isPolice = ALLOWED_IN_GAME_RANKS.includes(state.userRank);
        elements.serverId.textContent = state.serverId || 'غير متصل';
        updateUI();
    } else {
        state.isPolice = false;
        state.userRank = "خارج اللعبة";
        updateUI();
    }

    if (sessionSubscription) {
        window.supabaseClient.removeChannel(sessionSubscription);
    }

    sessionSubscription = window.supabaseClient
        .channel(`realtime-sessions-${userId}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'sessions', filter: `user_id=eq.${userId}` },
            (payload) => {
                const updatedData = payload.new;
                if (updatedData) {
                    state.serverId = updatedData.jobId;
                    state.userTeam = updatedData.team;
                    state.userRank = updatedData.rank_name;
                    
                    state.isPolice = ALLOWED_IN_GAME_RANKS.includes(state.userRank);
                    elements.serverId.textContent = state.serverId || 'غير متصل';
                    updateUI();
                } else {
                    state.serverId = null;
                    state.userTeam = "Neutral";
                    state.userRank = "خارج اللعبة";
                    state.isPolice = false;
                    elements.serverId.textContent = 'غير متصل';
                    updateUI();
                }
            }
        )
        .subscribe();
}

// ===== 4. إدارة المحادثات =====
let chatSubscription = null;

asyncfunction initializeChatListener() {
    if (!window.supabaseClient) return;

    if (state.chatSubscription) {
        supabaseClient.removeChannel(state.chatSubscription);
    }

    state.chatSubscription = supabaseClient
        .channel('schema-db-changes')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'chat',
                filter: `server_id=eq.${state.serverId}`
            },
            (payload) => {
                const newMsg = payload.new;
                
                // 1. إذا كانت دالة إضافة الرسالة للشاشة موجودة عندك استدعها هنا، مثل:
                // if (typeof renderMessage === 'function') renderMessage(newMsg);
                
                // 2. 🚨 نطق محتوى الأمر (content) فقط وبالإنجليزية مباشرة بدون الاسم
                announceToRadio(newMsg.content);
            }
        )
        .subscribe();
}

    if (chatSubscription) {
        window.supabaseClient.removeChannel(chatSubscription);
    }

    chatSubscription = window.supabaseClient
        .channel(`realtime-chat-${state.serverId}-${state.currentFrequency}`)
        .on(
            'postgres_changes',
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'chat', 
                filter: `server_id=eq.${state.serverId}` 
            },
            (payload) => {
                const newMsg = payload.new;
                if (newMsg && parseInt(newMsg.frequency) === parseInt(state.currentFrequency)) {
                    initializeChatListener();
                }
            }
        )
        .subscribe();
}

function renderMessages(messages) {
    elements.chatMessages.innerHTML = '';
    
    const sortedMessages = Object.entries(messages)
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);

    if (sortedMessages.length === 0) {
        elements.chatMessages.innerHTML = `
            <div class="system-message">
                <svg class="system-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <span>لا توجد رسائل حالياً</span>
            </div>
        `;
        return;
    }

    sortedMessages.forEach(([id, msg]) => {
        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message';
        messageEl.innerHTML = `
            <div class="meta">[موجة ${msg.frequency}] [${msg.rank}] ${msg.userName}</div>
            <div class="content">${escapeHtml(msg.content)}</div>
        `;
        elements.chatMessages.appendChild(messageEl);

        if (msg.timestamp > Date.now() - 5000 && msg.robloxUserId !== state.robloxUserId) {
            announceToRadio(msg.content);
        }
    });

    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

async function sendMessage() {
    const content = elements.chatInput.value.trim();
    if (!content || !state.isPolice || !state.serverId || !window.supabaseClient) return;

    const { error } = await window.supabaseClient
        .from('chat')
        .insert([
            {
                server_id: state.serverId,
                roblox_user_id: state.robloxUserId,
                user_name: state.userName,
                rank: state.userRank,
                team: state.userTeam,
                frequency: state.currentFrequency,
                content: content,
                timestamp: Date.now()
            }
        ]);

    if (error) {
        console.error('Error sending message:', error);
        showToast('فشل في إرسال الرسالة', 'error');
    } else {
        elements.chatInput.value = '';
    }
}

// ===== 5. إدارة البلاغات =====
let dispatchSubscription = null;

async function initializeDispatchListener() {
    if (!state.serverId || !window.supabaseClient) return;

    const { data: dispatches, error } = await window.supabaseClient
        .from('dispatches')
        .select('*')
        .eq('server_id', state.serverId);

    if (!error && dispatches) {
        const dispatchesObj = {};
        dispatches.forEach(disp => {
            dispatchesObj[disp.id] = {
                caller: disp.caller,
                type: disp.type,
                location: disp.location
            };
        });
        renderDispatches(dispatchesObj);
    }

    if (dispatchSubscription) {
        window.supabaseClient.removeChannel(dispatchSubscription);
    }

    dispatchSubscription = window.supabaseClient
        .channel(`realtime-dispatches-${state.serverId}`)
        .on(
            'postgres_changes',
            { 
                event: '*', 
                schema: 'public', 
                table: 'dispatches', 
                filter: `server_id=eq.${state.serverId}` 
            },
            () => {
                initializeDispatchListener();
            }
        )
        .subscribe();
}

function renderDispatches(dispatches) {
    const dispatchArray = Object.entries(dispatches);
    elements.dispatchCount.textContent = dispatchArray.length;

    if (dispatchArray.length === 0) {
        elements.dispatchList.innerHTML = `
            <div class="empty-state">
                <svg class="empty-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <p class="empty-text">لا توجد بلاغات نشطة</p>
                <p class="empty-subtext">جميع الوحدات في وضع الاستعداد</p>
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
            <button class="btn-clear" data-id="${id}">إنهاء البلاغ</button>
        `;
        
        card.querySelector('.btn-clear').addEventListener('click', () => {
            clearDispatch(id);
            showToast('تم إنهاء البلاغ بنجاح', 'success');
        });

        elements.dispatchList.appendChild(card);
    });
}

async function clearDispatch(dispatchId) {
    if (!window.supabaseClient) return;
    const { error } = await window.supabaseClient
        .from('dispatches')
        .delete()
        .eq('id', dispatchId);

    if (error) {
        console.error('Error deleting dispatch:', error);
        showToast('فشل في إنهاء البلاغ', 'error');
    }
}

// ===== 6. أدوات مساعدة =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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

function initializeEventListeners() {
    elements.loginBtn.addEventListener('click', () => {
        const authUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${ROBLOX_CLIENT_ID}&response_type=code&scope=openid+profile&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
        window.location.href = authUrl;
    });

    document.querySelectorAll('.freq-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            state.currentFrequency = parseInt(e.currentTarget.dataset.freq);
            document.querySelectorAll('.freq-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            playRadioClick();
            showToast(`تم التبديل إلى الموجة ${state.currentFrequency}`, 'info');
            if (state.isPolice && state.serverId) initializeChatListener();
        });
    });

    elements.sendBtn.addEventListener('click', sendMessage);
    elements.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    document.querySelectorAll('.cmd-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const commands = {
                'DISPATCH': 'الإرسال، الوحدة جاهزة للاستقبال',
                '10-4': '١٠-٤، تم الفهم',
                'BACKUP': 'طلب دعم فوري! ضابط بحاجة لمساعدة',
                'SUSPECT FLEEING': 'المشتبه به يهرب من الموقع!',
                'CODE 4': 'كود ٤، الوضع تحت السيطرة'
            };
            elements.chatInput.value = commands[btn.dataset.cmd];
            sendMessage();
        });
    });
}

function initializeAudioContext() {
    try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { console.warn('Web Audio API not supported'); }
}

function playRadioClick() {
    if (!state.audioContext) return;
    
    // إعادة تفعيل الصوت إذا كان المتصفح قد وضعه في حالة الاستعداد (Suspended) بسبب سياسة الأمان
    if (state.audioContext.state === 'suspended') {
        state.audioContext.resume();
    }
    
    const osc = state.audioContext.createOscillator();
    const gain = state.audioContext.createGain();
    osc.connect(gain);
    gain.connect(state.audioContext.destination);
    osc.frequency.value = 1200;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.2, state.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, state.audioContext.currentTime + 0.08);
    osc.start(state.audioContext.currentTime);
    osc.stop(state.audioContext.currentTime + 0.08);
}

function announceToRadio(text) {
    if (!state.speechSynthesis) return;

    // إلغاء أي نطق معلق لضمان استمرار العمل دائماً بدون تعليق
    state.speechSynthesis.cancel();

    // تحويل الأرقام أو الكلمات الشائعة تلقائياً لإنجليزية منطوقة بشكل صحيح
    let englishText = text;
    if (text.includes("١٠-٤") || text.includes("10-4")) englishText = "Ten Four";
    if (text.includes("دعم") || text.includes("backup")) englishText = "Need Backup";

    const utterance = new SpeechSynthesisUtterance(englishText);
    
    // جلب صوت إنجليزي متوافق مع النظام
    const voices = state.speechSynthesis.getVoices();
    const englishVoice = voices.find(voice => voice.lang.includes('en-US') && voice.name.includes('Google')) || 
                        voices.find(voice => voice.lang.includes('en'));
    
    if (englishVoice) {
        utterance.voice = englishVoice;
    }
    
    utterance.lang = 'en-US';
    utterance.rate = 1.0;  // سرعة نطق طبيعية وعسكرية
    utterance.pitch = 0.9; // طبقة صوت خشنة ومناسبة للاسلكي

    // تشغيل نغمة اللاسلكي (الفتح)
    playRadioClick();
    
    // النطق الفوري للأمر بعد رشة اللاسلكي
    setTimeout(() => {
        state.speechSynthesis.speak(utterance);
    }, 150);

    // تشغيل نغمة اللاسلكي (الإغلاق) فور انتهاء النطق
    utterance.onend = () => {
        setTimeout(() => playRadioClick(), 100);
    };
}
