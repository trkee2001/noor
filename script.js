'use strict';
/* =======================================================================
   حلقات مجمع الزبير ابن العوام — Script.js
   نظيف، آمن، وفعّال
   ======================================================================= */

/* -----------------------------------------------------------------------
   الثوابت والبيانات
   ----------------------------------------------------------------------- */
const PRAYERS = [
    { name: 'صلاة الفجر',   time: '04:15' },
    { name: 'شروق الشمس',  time: '05:35' },
    { name: 'صلاة الظهر',  time: '12:20' },
    { name: 'صلاة العصر',  time: '15:40' },
    { name: 'صلاة المغرب', time: '18:50' },
    { name: 'صلاة العشاء', time: '20:20' },
];

const ANNOUNCEMENTS = [
    {
        tag: 'جديد',
        short: 'بدء التسجيل في الدورة القرآنية الصيفية المكثفة.',
        date: '9 يونيو 2026',
        detail: 'تعلن إدارة الحلقات بمجمع الزبير ابن العوام عن بدء التسجيل في دورة حفظ وتجويد القرآن الكريم خلال الفترة الصيفية. الدورة تشمل حفظ المراجعة وحفظ الجديد مع جوائز قيّمة للخاتمين والمتميزين.'
    },
    {
        tag: 'تكريم',
        short: 'تكريم الطلاب المتميزين يوم الخميس بعد صلاة العصر.',
        date: '8 يونيو 2026',
        detail: 'يسر الإدارة دعوة أولياء الأمور الكرام لحضور حفل تكريم الطلاب المتميزين الذين حققوا درجات كاملة في اختبارات الأجزاء لهذا الفصل الدراسي.'
    },
    {
        tag: 'رحلة',
        short: 'رحلة ترفيهية للطلاب الملتزمين يوم السبت القادم.',
        date: '5 يونيو 2026',
        detail: 'رحلة ترفيهية ثقافية لجميع الطلاب الملتزمين بالحضور والواجبات اليومية، تتضمن أنشطة رياضية ومسابقات ثقافية ووجبة غداء جماعية.'
    },
];

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23e2f7f3'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23004d5a'/%3E%3Cellipse cx='50' cy='82' rx='28' ry='22' fill='%23004d5a'/%3E%3C/svg%3E";

const SESSION_KEY = 'qmza_session';
const APPROVED_STUDENTS_KEY = 'dash_students';
const APPROVED_STUDENTS_LEGACY_KEY = 'approved_students';
const APPROVED_STUDENTS_KEYS = [APPROVED_STUDENTS_KEY, APPROVED_STUDENTS_LEGACY_KEY];
const CURRENT_STUDENT_KEY = 'current_logged_in_student';
const DEFAULT_STUDENT_PASSWORD = '1234567a';
const SUPABASE_URL = 'https://fdgbvwdfoqtlqgrdqkkm.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_vzX7qivLBBjHlvHwpK5Cbw_nBxL_lop';
const SUPABASE_TABLE_STUDENTS = 'students';
const SUPABASE_TABLE_NEW_REQUESTS = 'new_students_requests';
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) ?? null;

window.schoolSupabase = supabaseClient;

/* -----------------------------------------------------------------------
   تعقيم المدخلات — الحماية من XSS
   ----------------------------------------------------------------------- */
function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .trim();
}

/* -----------------------------------------------------------------------
   الإشعار العائم (Toast)
   ----------------------------------------------------------------------- */
function showToast(msg, type = 'default') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = sanitize(msg);
    toast.className = `toast ${type} show`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.classList.remove('show'); }, 3800);
}

/* -----------------------------------------------------------------------
   فتح / إغلاق Modal
   ----------------------------------------------------------------------- */
function openModal(overlayId) {
    const el = document.getElementById(overlayId);
    if (!el) return;
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeModal(overlayId) {
    const el = document.getElementById(overlayId);
    if (!el) return;
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
        m.classList.remove('open');
        m.setAttribute('aria-hidden', 'true');
    });
    document.body.style.overflow = '';
}

/* -----------------------------------------------------------------------
   Local Storage — إدارة الجلسة
   ----------------------------------------------------------------------- */
function getSession() {
    try {
        return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
    } catch { return null; }
}

function saveSession(data) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

function updateHeaderProfile() {
    const session  = getSession();
    const btn      = document.getElementById('profile-btn');
    if (!btn) return;

    if (session?.loggedIn && session?.avatar && session.avatar !== DEFAULT_AVATAR) {
        btn.innerHTML = `<img src="${session.avatar}" alt="صورتك الشخصية" style="width:100%;height:100%;border-radius:50%;object-fit:cover;border:2px solid var(--emerald-200)">`;
        btn.classList.add('profile-active');
    } else {
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        btn.classList.remove('profile-active');
    }
}

function showView(viewId) {
    document.querySelectorAll('.form-view').forEach(v => {
        if (v.id === viewId) {
            v.classList.remove('hidden');
            v.style.animation = 'none';
            void v.offsetWidth;
            v.style.animation = '';
        } else {
            v.classList.add('hidden');
        }
    });

    const isLogin = viewId === 'login-view';
    const joinTab = document.getElementById('go-join-btn');
    const loginTab = document.getElementById('go-login-tab');
    joinTab?.classList.toggle('auth-tab-active', !isLogin);
    joinTab?.classList.toggle('auth-tab-outline', isLogin);
    loginTab?.classList.toggle('auth-tab-active', isLogin);
    loginTab?.classList.toggle('auth-tab-outline', !isLogin);

    mountMascotToView(viewId);
    updateMascotPose();
    resetMascotPeek();
    setMascotSpeech(null);
}

function scrollToJoinRegister() {
    showView('register-view');
    document.getElementById('auth-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function mountMascotToView(viewId) {
    const mascot = document.getElementById('login-mascot');
    const loginAnchor = document.getElementById('login-mascot-anchor');
    if (!mascot || !loginAnchor) return;

    if (mascot.parentElement !== loginAnchor) {
        loginAnchor.appendChild(mascot);
    }

    if (viewId !== 'login-view') {
        resetMascotPeek();
        setMascotSpeech(null);
    }
}

/* -----------------------------------------------------------------------
   المساعد الأكاديمي الذكي (Head + Eyes + Speech + Tracking)
   ----------------------------------------------------------------------- */
const mascotState = {
    tilt: 0,
    targetTilt: 0,
    rafId: null,
    mouseBound: false,
    speechTimer: null,
    peekRevealed: false,
    trackingEnabled: false,
    peekWelcomeTimer: null,
    waving: false,
    waveHoverCount: 0
};

const MASCOT_SPEECH = {
    initialWelcome: 'ها يا بطل حاب تسجل الدخول؟ 😉✨',
    hoverHint: 'إذا أنت طالب سجل من هنا! ✨',
    codeArabic: 'يا بطل، كود الطالب يتكون من أرقام فقط (مثل: 202601) وليس حروفاً! 🔢💡',
    codeSymbol: 'الرموز أخذت لفة بالغلط 😅 هذا الحقل للأرقام فقط يا نجم 🔢',
    codeUpper: 'حرف كبير! بس هذا الحقل أكاديمي رقمي 100% يا بطل 🔢',
    codeLower: 'حتى الحروف الصغيرة ما تنفع هنا، نبغى أرقام فقط ✍️🔢',
    passFocus: 'أدخل كلمة السر بعناية، وتأكد من لغة لوحة المفاتيح! 🔐👀',
    passCapital: 'يا بطل لا تقم بتسجيل كلمة السر بالحرف الكبير لا يصح',
    passArabic: 'عزيزي لا تقم بكتابة احرف غير الانجليزية',
    passSymbol: 'يا هذا لا تقم بكتابة اي رمز كلمة السر لا تقبل بذلك',
    passLower: 'ممتاز! الحروف الصغيرة تمام، أضف رقم/أرقام وكمل 👌',
    passValid: 'بطل! كلمة السر الآن صارت مطابقة للشروط ✅',
    passPeekConfirm: 'كفو، تأكدت من كلمة السر؟ الحين وضعك في السليم! 👍🔥',
    emptySubmit: 'أفا! نسيت تعبئة البيانات؟ عبّها وبانتظارك يا ذكي! 📄🚀',
    loginNotFound: 'هذا الحساب غير موجود هل انت متاكد من كلمة السر والكود ؟ او قم بأنشاء حساب اذ لم تنشى',
    joinSuccess: 'تم إرسال طلبك بنجاح يا بطل! انتظر موافقة المشرف 🥳🎉'
};

const MASCOT_SPEECH_ERROR_MODES = new Set([
    'codeArabic',
    'codeSymbol',
    'codeUpper',
    'codeLower',
    'passCapital',
    'passArabic',
    'passSymbol',
    'emptySubmit',
    'loginNotFound'
]);
const MASCOT_SPEECH_SUCCESS_MODES = new Set(['passLower', 'passValid', 'passPeekConfirm', 'joinSuccess']);

function isMascotPeekMode() {
    const loginView = document.getElementById('login-view');
    const mascot = document.getElementById('login-mascot');
    return Boolean(
        loginView &&
            !loginView.classList.contains('hidden') &&
            mascot?.classList.contains('is-peek-slot') &&
            mascot.classList.contains('is-login-mode')
    );
}

function ensureMascotSpeechBubble() {
    const mascot = document.getElementById('login-mascot');
    const stage = mascot?.querySelector('.mascot-stage');
    if (!stage) return null;

    let bubble = document.getElementById('mascot-speech');
    let text = document.getElementById('mascot-speech-text');

    if (!bubble) {
        bubble = document.createElement('div');
        bubble.className = 'mascot-speech speech-bubble';
        bubble.id = 'mascot-speech';
        bubble.setAttribute('aria-live', 'polite');
        stage.appendChild(bubble);
    } else {
        bubble.classList.add('speech-bubble');
    }

    if (!text) {
        text = document.createElement('p');
        text.className = 'mascot-speech-text';
        text.id = 'mascot-speech-text';
        bubble.appendChild(text);
    }

    return { bubble, text };
}

function showMascotMessage(mode, { autoHideMs = 0, wave = false } = {}) {
    if (!isMascotPeekMode()) return;

    const card = document.getElementById('auth-card');
    const mascot = document.getElementById('login-mascot');
    const avatar = document.querySelector('.character-container');
    ensureMascotSpeechBubble();

    card?.classList.add(wave ? 'is-mascot-waving' : 'is-mascot-revealed');
    card?.classList.toggle('is-mascot-waving', wave);
    mascot?.classList.toggle('is-peeking', mode === 'initialWelcome');
    mascot?.classList.toggle('is-waving', wave);
    mascot?.classList.add('is-revealed-mascot');
    mascot?.setAttribute('aria-hidden', 'false');
    avatar?.classList.add('pop-up-reveal');
    mascotState.peekRevealed = !wave;
    mascotState.waving = wave;
    mascotState.trackingEnabled = true;
    setMascotSpeech(mode);

    if (mascotState.peekWelcomeTimer) {
        clearTimeout(mascotState.peekWelcomeTimer);
        mascotState.peekWelcomeTimer = null;
    }

    if (autoHideMs > 0) {
        mascotState.peekWelcomeTimer = setTimeout(() => {
            setMascotSpeech(null);
            mascotState.peekWelcomeTimer = null;
        }, autoHideMs);
    }
}

function resetMascotPeek() {
    const card = document.getElementById('auth-card');
    const mascot = document.getElementById('login-mascot');
    card?.classList.remove('is-mascot-revealed', 'is-mascot-waving');
    mascot?.classList.remove('is-waving', 'is-revealed-mascot');
    mascot?.setAttribute('aria-hidden', 'false');
    mascotState.peekRevealed = false;
    mascotState.trackingEnabled = false;
    mascotState.waving = false;
    mascotState.waveHoverCount = 0;
    if (mascotState.peekWelcomeTimer) {
        clearTimeout(mascotState.peekWelcomeTimer);
        mascotState.peekWelcomeTimer = null;
    }
}

function revealMascotCard(mode = 'passFocus') {
    if (!isMascotPeekMode()) return;

    const card = document.getElementById('auth-card');
    const mascot = document.getElementById('login-mascot');
    const avatar = document.querySelector('.character-container');
    ensureMascotSpeechBubble();
    card?.classList.add('is-mascot-revealed');
    mascot?.classList.add('is-revealed-mascot');
    mascot?.setAttribute('aria-hidden', 'false');
    avatar?.classList.add('pop-up-reveal');
    mascotState.peekRevealed = true;
    mascotState.trackingEnabled = false;

    setMascotSpeech(mode);

    if (mascotState.peekWelcomeTimer) {
        clearTimeout(mascotState.peekWelcomeTimer);
    }
    mascotState.peekWelcomeTimer = setTimeout(() => {
        setMascotSpeech(null);
        mascotState.trackingEnabled = true;
        mascotState.peekWelcomeTimer = null;
    }, 4000);
}

function startMascotWave() {
    if (!isMascotPeekMode() || mascotState.peekRevealed) return;

    mascotState.waveHoverCount += 1;
    const card = document.getElementById('auth-card');
    const mascot = document.getElementById('login-mascot');
    const avatar = document.querySelector('.character-container');
    ensureMascotSpeechBubble();
    card?.classList.add('is-mascot-waving');
    mascot?.classList.add('is-waving');
    mascot?.setAttribute('aria-hidden', 'false');
    avatar?.classList.add('pop-up-reveal');
    mascotState.waving = true;
    setMascotSpeech('hoverHint');
}

function stopMascotWave() {
    if (!isMascotPeekMode()) return;

    mascotState.waveHoverCount = Math.max(0, mascotState.waveHoverCount - 1);
    if (mascotState.waveHoverCount > 0) return;

    const card = document.getElementById('auth-card');
    const mascot = document.getElementById('login-mascot');
    const avatar = document.querySelector('.character-container');
    card?.classList.remove('is-mascot-waving');
    mascot?.classList.remove('is-waving');
    if (!mascotState.peekRevealed) {
        mascot?.setAttribute('aria-hidden', 'true');
        avatar?.classList.remove('pop-up-reveal');
    }
    mascotState.waving = false;

    const text = document.getElementById('mascot-speech-text');
    if (!mascotState.peekRevealed && text?.textContent === MASCOT_SPEECH.hoverHint) {
        setMascotSpeech(null);
    }
}

function setMascotSpeech(mode) {
    const mascot = document.getElementById('login-mascot');
    const speech = ensureMascotSpeechBubble();
    const bubble = speech?.bubble;
    const text = speech?.text;
    if (!mascot || !bubble || !text) return;

    if (mascotState.speechTimer) {
        clearTimeout(mascotState.speechTimer);
        mascotState.speechTimer = null;
    }

    if (!mode || !MASCOT_SPEECH[mode]) {
        bubble.classList.remove('is-visible', 'is-error', 'is-success', 'is-updating');
        mascot.classList.remove('is-speech-error', 'is-speech-success');
        text.textContent = '';
        bubble.setAttribute('hidden', '');
        bubble.style.display = 'none';
        return;
    }

    const nextText = MASCOT_SPEECH[mode];
    if (text.textContent !== nextText) {
        bubble.classList.add('is-updating');
        text.textContent = nextText;
        requestAnimationFrame(() => bubble.classList.remove('is-updating'));
    }

    bubble.classList.remove('is-error', 'is-success');
    mascot.classList.remove('is-speech-error', 'is-speech-success');

    if (MASCOT_SPEECH_ERROR_MODES.has(mode)) {
        bubble.classList.add('is-error');
        mascot.classList.add('is-speech-error');
    } else if (MASCOT_SPEECH_SUCCESS_MODES.has(mode)) {
        bubble.classList.add('is-success');
        mascot.classList.add('is-speech-success');
    }

    bubble.removeAttribute('hidden');
    bubble.style.display = 'block';
    bubble.classList.add('is-visible');
}

function cleanLoginInputFields() {
    ['login-id', 'login-pass'].forEach((id) => {
        const input = document.getElementById(id);
        if (!input) return;
        input.removeAttribute('placeholder');
        input.removeAttribute('value');
        input.placeholder = '';
        input.value = '';
        if (input.defaultValue) input.defaultValue = '';
    });
}

function showLoginMascotBubble(mode, autoHideMs = 5200) {
    const message = MASCOT_SPEECH[mode];
    const mascot = document.getElementById('login-mascot');
    const card = document.getElementById('auth-card');
    const avatar = document.getElementById('login-mascot-peek-wrap');
    const speech = ensureMascotSpeechBubble();
    if (!message || !mascot || !speech?.bubble || !speech?.text) return;

    if (mascotState.peekWelcomeTimer) {
        clearTimeout(mascotState.peekWelcomeTimer);
        mascotState.peekWelcomeTimer = null;
    }
    if (mascotState.speechTimer) {
        clearTimeout(mascotState.speechTimer);
        mascotState.speechTimer = null;
    }

    card?.classList.add('is-mascot-revealed');
    mascot.classList.toggle('is-peeking', mode === 'initialWelcome');
    mascot.classList.add('is-revealed-mascot');
    mascot.setAttribute('aria-hidden', 'false');
    avatar?.classList.add('pop-up-reveal');

    speech.text.textContent = message;
    speech.bubble.classList.remove('is-error', 'is-success', 'is-updating');
    mascot.classList.remove('is-speech-error', 'is-speech-success');

    if (MASCOT_SPEECH_ERROR_MODES.has(mode)) {
        speech.bubble.classList.add('is-error');
        mascot.classList.add('is-speech-error');
    } else if (MASCOT_SPEECH_SUCCESS_MODES.has(mode)) {
        speech.bubble.classList.add('is-success');
        mascot.classList.add('is-speech-success');
    }

    speech.bubble.removeAttribute('hidden');
    speech.bubble.style.display = 'block';
    speech.bubble.style.opacity = '1';
    speech.bubble.style.visibility = 'visible';
    speech.bubble.classList.add('is-visible');

    if (autoHideMs > 0) {
        mascotState.peekWelcomeTimer = setTimeout(() => {
            speech.bubble.classList.remove('is-visible', 'is-error', 'is-success');
            speech.bubble.style.display = 'none';
            speech.bubble.style.opacity = '';
            speech.bubble.style.visibility = '';
            speech.bubble.setAttribute('hidden', '');
            speech.text.textContent = '';
            mascot.classList.remove('is-speech-error', 'is-speech-success');
            mascotState.peekWelcomeTimer = null;
        }, autoHideMs);
    }
}

function initDirectLoginMascotMessages() {
    const loginView = document.getElementById('login-view');
    const loginId = document.getElementById('login-id');
    const loginPass = document.getElementById('login-pass');
    const loginForm = document.getElementById('login-form');
    const passToggle = document.getElementById('login-pass-toggle');
    if (!loginView || !loginId || !loginPass || loginView.dataset.directMascotMessages === '1') return;
    loginView.dataset.directMascotMessages = '1';

    setTimeout(() => {
        if (!loginView.classList.contains('hidden')) {
            showLoginMascotBubble('initialWelcome', 4000);
        }
    }, 2000);

    const showCodeMessage = (raw) => {
        document.getElementById('login-mascot')?.classList.remove('is-peeking');
        const mode = detectLoginCodeMessage(raw);
        if (mode) showLoginMascotBubble(mode, 4000);
    };

    loginId.addEventListener('beforeinput', (e) => {
        if (e.data) showCodeMessage(e.data);
    }, true);
    loginId.addEventListener('focus', () => {
        document.getElementById('login-mascot')?.classList.remove('is-peeking');
    });
    loginId.addEventListener('paste', (e) => {
        showCodeMessage(e.clipboardData?.getData('text') ?? '');
    }, true);
    loginId.addEventListener('input', () => {
        document.getElementById('login-mascot')?.classList.remove('is-peeking');
        showCodeMessage(loginId.value);
    }, true);

    loginPass.addEventListener('focus', () => {
        document.getElementById('login-mascot')?.classList.remove('is-peeking');
        showLoginMascotBubble('passFocus', 4000);
    });
    const showPasswordMessage = (raw) => {
        document.getElementById('login-mascot')?.classList.remove('is-peeking');
        const value = String(raw ?? '');
        if (!value) return;
        if (/[\u0600-\u06FF]/.test(value)) {
            showLoginMascotBubble('passArabic', 5000);
            return;
        }
        if (/[A-Z]/.test(value)) {
            showLoginMascotBubble('passCapital', 5000);
            return;
        }
        if (/[^a-z0-9]/.test(value)) {
            showLoginMascotBubble('passSymbol', 5000);
        }
    };
    loginPass.addEventListener('beforeinput', (e) => {
        if (e.data) showPasswordMessage(e.data);
    }, true);
    loginPass.addEventListener('keydown', (e) => {
        if (e.key.length === 1) showPasswordMessage(e.key);
    }, true);
    loginPass.addEventListener('paste', (e) => {
        showPasswordMessage(e.clipboardData?.getData('text') ?? '');
    }, true);

    passToggle?.addEventListener('click', () => {
        document.getElementById('login-mascot')?.classList.remove('is-peeking');
        showLoginMascotBubble('passPeekConfirm', 4000);
    });

    loginForm?.addEventListener('submit', (e) => {
        if (loginId.value.trim() && loginPass.value.trim()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        showLoginMascotBubble('emptySubmit', 4000);
    }, true);
}

function notifyMascotSpeech(mode, revertMs = 0) {
    setMascotSpeech(mode);
    if (revertMs <= 0) return;
    mascotState.speechTimer = setTimeout(() => {
        refreshMascotSpeechFromFocus();
        mascotState.speechTimer = null;
    }, revertMs);
}

function detectLoginCodeMessage(raw) {
    const value = String(raw ?? '');
    if (!value) return null;
    if (/[a-zA-Z\u0600-\u06FF]/.test(value)) return 'codeArabic';
    return null;
}

function notifyLoginCodeMessage(raw) {
    const mode = detectLoginCodeMessage(raw);
    if (!mode) return;
    showMascotMessage(mode, { autoHideMs: 4000 });
}

function syncMascotPasswordSpeech(inputId, flags = {}) {
    const input = document.getElementById(inputId);
    if (!input || document.activeElement?.id !== inputId) return;

    if (inputId === 'login-pass') return;

    const pass = input.value ?? '';
    const onlyAllowed = /^[a-z0-9]*$/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasDigit = /[0-9]/.test(pass);
    const hasUpper = /[A-Z]/.test(pass);

    if (flags.forceCapital || hasUpper) {
        setMascotSpeech('passCapital');
        return;
    }
    if (flags.forceSymbol || (pass.length > 0 && !onlyAllowed)) {
        setMascotSpeech('passSymbol');
        return;
    }
    if (pass.length === 0) {
        setMascotSpeech(inputId === 'login-pass' ? 'passFocus' : null);
        return;
    }
    if (hasLower && !hasDigit) {
        setMascotSpeech('passLower');
        return;
    }
    if (isValidPassword(pass)) {
        setMascotSpeech('passValid');
        return;
    }
    setMascotSpeech('passFocus');
}

function refreshMascotSpeechFromFocus() {
    const active = document.activeElement;
    if (active?.id === 'login-id') {
        return;
    } else if (active?.id === 'login-pass' || active?.id === 'reg-pass') {
        syncMascotPasswordSpeech(active.id, {});
    } else {
        setMascotSpeech(null);
    }
}

function notifyMascotFieldShake() {
    const mode = detectLoginCodeMessage(document.getElementById('login-id')?.value ?? '') || 'codeSymbol';
    showMascotMessage(mode, { autoHideMs: 4000 });
}

function setMascotEyeShift(x, y) {
    const eyes = document.getElementById('mascot-eyes');
    if (!eyes) return;
    eyes.style.setProperty('--eye-x', `${x}px`);
    eyes.style.setProperty('--eye-y', `${y}px`);
}

function applyMascotHeadTilt() {
    const track = document.getElementById('mascot-head-track');
    if (!track) return;
    mascotState.tilt += (mascotState.targetTilt - mascotState.tilt) * 0.14;
    track.style.transform = `rotate(${mascotState.tilt.toFixed(2)}deg) translateX(${(
        mascotState.tilt * 0.35
    ).toFixed(2)}px)`;
    if (Math.abs(mascotState.targetTilt - mascotState.tilt) > 0.04) {
        mascotState.rafId = requestAnimationFrame(applyMascotHeadTilt);
    } else {
        mascotState.rafId = null;
    }
}

function setMascotTargetTilt(value) {
    mascotState.targetTilt = Math.max(-9, Math.min(9, value));
    if (!mascotState.rafId) mascotState.rafId = requestAnimationFrame(applyMascotHeadTilt);
}

function mascotTrackFromMouse(e) {
    const mascot = document.getElementById('login-mascot');
    const loginId = document.getElementById('login-id');
    if (!mascot || mascot.classList.contains('is-hidden')) return;
    if (isMascotPeekMode() && !mascotState.trackingEnabled) return;
    if (loginId && document.activeElement === loginId) return;

    const rect = mascot.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const ratioX = (e.clientX - centerX) / Math.max(window.innerWidth * 0.22, 180);
    const ratioY = (e.clientY - centerY) / 140;
    setMascotTargetTilt(ratioX * 9);
    setMascotEyeShift(
        (ratioX * 2.5).toFixed(1),
        Math.max(-2, Math.min(2, ratioY * 1.8)).toFixed(1)
    );
}

function mascotTrackFromLoginId() {
    const mascot = document.getElementById('login-mascot');
    const loginId = document.getElementById('login-id');
    if (!mascot || mascot.classList.contains('is-hidden') || !loginId) return;
    if (document.activeElement !== loginId) return;

    mascot.classList.add('is-typing');
    const len = loginId.value.length;
    const last = parseInt(loginId.value.slice(-1), 10);
    const nudge = Number.isFinite(last) ? ((last % 3) - 1) * 4 : 0;
    setMascotTargetTilt(nudge + (len % 2 === 0 ? 2 : -2));
    setMascotEyeShift(nudge * 0.4, 0);
}

function updateMascotPose() {
    const mascot = document.getElementById('login-mascot');
    const loginView = document.getElementById('login-view');
    if (!mascot || !loginView || loginView.classList.contains('hidden')) return;

    mascot.classList.remove('is-covering', 'is-attentive', 'is-typing');

    const pass = document.getElementById('login-pass');
    if (!pass) return;

    const passVisible = pass.type === 'text';
    const passFocused = document.activeElement === pass;

    if (passVisible) {
        mascot.classList.add('is-attentive');
        setMascotTargetTilt(0);
    } else if (passFocused) {
        mascot.classList.add('is-covering');
        setMascotTargetTilt(0);
    }
}

function initAuthCardMascotPeek() {
    const card = document.getElementById('auth-card');
    const loginForm = document.getElementById('login-form');
    if (!card || card.dataset.mascotPeekBound === '1') return;
    card.dataset.mascotPeekBound = '1';

    const loginId = document.getElementById('login-id');
    const loginPass = document.getElementById('login-pass');
    const submitBtn = document.getElementById('login-submit-btn');
    const passToggle = document.getElementById('login-pass-toggle');

    setTimeout(() => {
        if (isMascotPeekMode()) {
            showMascotMessage('initialWelcome', { autoHideMs: 4000 });
        }
    }, 2000);

    loginId?.addEventListener('beforeinput', (e) => {
        if (e.data) notifyLoginCodeMessage(e.data);
    });

    loginId?.addEventListener('paste', (e) => {
        const pasted = e.clipboardData?.getData('text') ?? '';
        notifyLoginCodeMessage(pasted);
    });

    loginId?.addEventListener('input', () => {
        notifyLoginCodeMessage(loginId.value);
    });

    loginPass?.addEventListener('focus', () => {
        showMascotMessage('passFocus', { autoHideMs: 4000 });
    });

    loginForm?.addEventListener('submit', (e) => {
        const codeEmpty = !loginId?.value.trim();
        const passEmpty = !loginPass?.value.trim();
        if (!codeEmpty && !passEmpty) return;

        e.preventDefault();
        e.stopImmediatePropagation();
        showMascotMessage('emptySubmit', { autoHideMs: 4000 });
    }, true);

    passToggle?.addEventListener('click', () => {
        showMascotMessage('passPeekConfirm', { autoHideMs: 4000 });
    });
}

function initLoginMascot() {
    const pass = document.getElementById('login-pass');
    const regPass = document.getElementById('reg-pass');
    const toggle = document.getElementById('login-pass-toggle');
    const regToggle = document.getElementById('reg-pass-toggle');
    const loginId = document.getElementById('login-id');
    if (!pass) return;

    const bindPassFocus = (inputId) => {
        const input = document.getElementById(inputId);
        if (!input) return;
        input.addEventListener('focus', () => {
            updateMascotPose();
            syncMascotPasswordSpeech(inputId, {});
        });
        input.addEventListener('blur', () => {
            setTimeout(() => {
                updateMascotPose();
                refreshMascotSpeechFromFocus();
            }, 0);
        });
    };

    bindPassFocus('login-pass');
    bindPassFocus('reg-pass');

    toggle?.addEventListener('click', () => setTimeout(updateMascotPose, 0));
    regToggle?.addEventListener('click', () => setTimeout(updateMascotPose, 0));

    loginId?.addEventListener('focus', () => {
        mascotTrackFromLoginId();
    });
    loginId?.addEventListener('blur', () => {
        document.getElementById('login-mascot')?.classList.remove('is-typing');
        setMascotTargetTilt(0);
        setMascotEyeShift(0, 0);
        setTimeout(refreshMascotSpeechFromFocus, 0);
    });
    loginId?.addEventListener('input', mascotTrackFromLoginId);

    if (!mascotState.mouseBound) {
        document.addEventListener('mousemove', mascotTrackFromMouse, { passive: true });
        mascotState.mouseBound = true;
    }

    cleanLoginInputFields();
    mountMascotToView('login-view');
    initAuthCardMascotPeek();
    updateMascotPose();
    resetMascotPeek();
    setMascotSpeech(null);
}

/* -----------------------------------------------------------------------
   التحقق الصارم من النماذج (Validation)
   ----------------------------------------------------------------------- */
function showError(id, show = true) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = show ? 'flex' : 'none';
}

/* ── قفل الحقول الرقمية (أرقام فقط) ── */
const inputRejectTimers = new WeakMap();

function sanitizeDigitsOnly(raw, maxLen = Infinity) {
    return String(raw ?? '').replace(/\D/g, '').slice(0, maxLen);
}

function maybeNotifyMascotShake(containerId, rejectedRaw = '') {
    if (containerId === 'reg-phone-wrap' || containerId === 'reg-country-code-wrap') {
        return;
    }
    if (containerId === 'login-id-wrap') {
        const mode = detectLoginCodeMessage(rejectedRaw) ||
            detectLoginCodeMessage(document.getElementById('login-id')?.value ?? '') ||
            'codeSymbol';
        showLoginMascotBubble(mode, 4000);
        return;
    }
    if (containerId === 'login-pass-wrap' || containerId === 'reg-pass-wrap') {
        return;
    }
}

function triggerInputReject(input, containerId, rejectedRaw = '') {
    const container = containerId ? document.getElementById(containerId) : null;

    if (input) {
        input.classList.remove('is-rejected');
        void input.offsetWidth;
        input.classList.add('is-rejected');
        const prev = inputRejectTimers.get(input);
        if (prev) clearTimeout(prev);
        inputRejectTimers.set(input, setTimeout(() => {
            input.classList.remove('is-rejected');
        }, 650));
    }

    if (container) {
        container.classList.remove('is-shaking');
        void container.offsetWidth;
        container.classList.add('is-shaking');
        container.addEventListener('animationend', () => container.classList.remove('is-shaking'), { once: true });
        maybeNotifyMascotShake(containerId, rejectedRaw);
    }
}

function triggerFieldShake(targetId, rejectedRaw = '') {
    triggerInputReject(null, targetId, rejectedRaw);
}

function bindDigitsOnlyInput(input, options = {}) {
    if (!input) return;

    const maxLength = options.maxLength ?? 15;
    const containerId = options.shakeTarget ?? null;
    const alertOnReject = options.alertOnReject !== false;
    const transform = typeof options.transform === 'function'
        ? options.transform
        : (digits) => digits;

    const reject = (rejectedRaw = '') => {
        if (!containerId) return;
        if (alertOnReject) triggerInputReject(input, containerId, rejectedRaw);
        else triggerFieldShake(containerId, rejectedRaw);
    };

    const applyValue = (raw) => {
        const rawStr = String(raw ?? '');
        const hadInvalidChars = /[^\d]/.test(rawStr);
        const digits = sanitizeDigitsOnly(rawStr, maxLength);
        const transformed = transform(digits);
        const modeRejected = transformed !== digits && digits.length > 0;

        if (input.value !== transformed) input.value = transformed;

        if (hadInvalidChars || modeRejected) reject(rawStr);

        options.onValue?.(transformed);
        return transformed;
    };

    input.addEventListener('beforeinput', (e) => {
        const blockedTypes = [
            'insertText',
            'insertReplacementText',
            'insertFromPaste',
            'insertFromDrop',
            'insertCompositionText'
        ];
        if (!blockedTypes.includes(e.inputType)) return;
        if (e.data && /[^\d]/.test(e.data)) {
            e.preventDefault();
            reject(e.data);
        }
    });

    input.addEventListener('input', () => applyValue(input.value));

    input.addEventListener('keydown', (e) => {
        const navKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (navKeys.includes(e.key) || e.ctrlKey || e.metaKey) return;
        if (e.key.length === 1 && !/^\d$/.test(e.key)) {
            e.preventDefault();
            reject(e.key);
        }
    });

    input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = e.clipboardData?.getData('text') ?? '';
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        applyValue(`${input.value.slice(0, start)}${pasted}${input.value.slice(end)}`);
    });

    input.addEventListener('drop', (e) => {
        e.preventDefault();
        reject();
    });

    input.addEventListener('compositionupdate', (e) => {
        if (e.data && /[^\d]/.test(e.data)) {
            reject(e.data);
        }
    });

    input.addEventListener('compositionend', () => applyValue(input.value));
}

function transformPhoneDigits(digits) {
    if (!digits) return '';
    if (isPhoneIntlMode()) return digits.slice(0, 15);
    if (digits[0] !== '7') return '';
    return digits.slice(0, 9);
}

function updatePhoneInputConstraints() {
    const phone = document.getElementById('reg-phone');
    if (!phone) return;
    const intl = isPhoneIntlMode();
    phone.maxLength = intl ? 15 : 9;
    phone.placeholder = intl
        ? 'أدخل رقم الهاتف الدولي'
        : '7XXXXXXXX (مثال: 777123456)';
    phone.value = transformPhoneDigits(sanitizeDigitsOnly(phone.value, 15));
}

function initPhoneInput() {
    const phone = document.getElementById('reg-phone');
    bindDigitsOnlyInput(phone, {
        maxLength: 15,
        shakeTarget: 'reg-phone-wrap',
        alertOnReject: true,
        transform: transformPhoneDigits,
        onValue: () => showError('err-reg-phone', false)
    });
    updatePhoneInputConstraints();
}

function initCountryCodeInput() {
    bindDigitsOnlyInput(document.getElementById('reg-country-code'), {
        maxLength: 3,
        shakeTarget: 'reg-country-code-wrap',
        alertOnReject: true
    });
}

function initLoginIdInput() {
    bindDigitsOnlyInput(document.getElementById('login-id'), {
        maxLength: 10,
        shakeTarget: 'login-id-wrap',
        alertOnReject: false
    });
}

/** كلمة سر: 8+ خانات، أحرف صغيرة [a-z] وأرقام فقط */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[0-9])[a-z0-9]{8,}$/;

function isValidPassword(pass) {
    if (typeof pass !== 'string' || pass.length === 0) return false;
    return PASSWORD_REGEX.test(pass);
}

function normalizePassFlags(flags) {
    if (flags === true) return { forceSymbol: true, forceCapital: false };
    if (!flags || typeof flags !== 'object') return { forceSymbol: false, forceCapital: false };
    return {
        forceSymbol: Boolean(flags.forceSymbol || flags.forceLatinInvalid),
        forceCapital: Boolean(flags.forceCapital)
    };
}

function sanitizePasswordChars(pass) {
    return String(pass ?? '').replace(/[^a-z0-9]/g, '');
}

function handlePasswordInputReject(inputId, flags = {}) {
    triggerPassShake(inputId);
    updatePasswordRules(inputId, false, flags);
}

function getPasswordErrorId(inputId) {
    return inputId === 'login-pass' ? 'err-login-pass' : 'err-reg-pass';
}

function getPasswordWrapId(inputId) {
    return inputId === 'login-pass' ? 'login-pass-wrap' : 'reg-pass-wrap';
}

function getPasswordRulesId(inputId) {
    return inputId === 'login-pass' ? 'rules-login-pass' : 'rules-reg-pass';
}

function getPasswordToggleId(inputId) {
    return inputId === 'login-pass' ? 'login-pass-toggle' : 'reg-pass-toggle';
}

function setPassRuleState(rulesEl, ruleName, state) {
    const el = rulesEl?.querySelector(`.pass-rule[data-rule="${ruleName}"]`);
    if (!el) return;
    el.classList.remove('is-valid', 'is-invalid');
    if (state === 'valid') el.classList.add('is-valid');
    if (state === 'invalid') el.classList.add('is-invalid');
}

function triggerPassShake(inputId) {
    triggerFieldShake(getPasswordWrapId(inputId));
}

function updatePasswordRules(inputId, onBlur = false, flags = {}) {
    const { forceSymbol, forceCapital } = normalizePassFlags(flags);
    const input = document.getElementById(inputId);
    const rulesEl = document.getElementById(getPasswordRulesId(inputId));
    const errorId = getPasswordErrorId(inputId);
    const pass = input?.value ?? '';
    if (!rulesEl) return;

    const hasLength = pass.length >= 8;
    const hasDigit = /[0-9]/.test(pass);
    const onlyAllowed = /^[a-z0-9]*$/.test(pass);
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);

    setPassRuleState(rulesEl, 'length', pass.length > 0 && hasLength ? 'valid' : 'idle');
    setPassRuleState(rulesEl, 'digit', pass.length > 0 && hasDigit ? 'valid' : 'idle');

    if (forceSymbol || (pass.length > 0 && !onlyAllowed)) {
        setPassRuleState(rulesEl, 'latin', 'invalid');
    } else if (pass.length > 0 && onlyAllowed) {
        setPassRuleState(rulesEl, 'latin', 'valid');
    } else {
        setPassRuleState(rulesEl, 'latin', 'idle');
    }

    if (forceCapital || hasUpper) {
        setPassRuleState(rulesEl, 'lowercase', 'invalid');
    } else if (pass.length > 0 && hasLower) {
        setPassRuleState(rulesEl, 'lowercase', 'valid');
    } else {
        setPassRuleState(rulesEl, 'lowercase', 'idle');
    }

    if (isValidPassword(pass)) {
        showError(errorId, false);
    } else if (onBlur && pass.length > 0) {
        showError(errorId, true);
    } else {
        showError(errorId, false);
    }

    if (inputId === 'login-pass' || inputId === 'reg-pass') {
        syncMascotPasswordSpeech(inputId, { forceSymbol, forceCapital });
    }
}

function resetPasswordField(inputId) {
    resetPasswordToggle(inputId);
    const rulesEl = document.getElementById(getPasswordRulesId(inputId));
    rulesEl?.querySelectorAll('.pass-rule').forEach((el) => {
        el.classList.remove('is-valid', 'is-invalid');
    });
    showError(getPasswordErrorId(inputId), false);
}

function resetPasswordToggle(inputId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(getPasswordToggleId(inputId));
    if (!input || !btn) return;
    input.type = 'password';
    btn.classList.remove('is-visible');
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', 'إظهار كلمة السر');
}

function initPasswordToggle(inputId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(getPasswordToggleId(inputId));
    if (!input || !btn) return;

    btn.addEventListener('click', () => {
        const visible = input.type === 'password';
        input.type = visible ? 'text' : 'password';
        btn.classList.toggle('is-visible', visible);
        btn.setAttribute('aria-pressed', visible ? 'true' : 'false');
        btn.setAttribute('aria-label', visible ? 'إخفاء كلمة السر' : 'إظهار كلمة السر');
        if (inputId !== 'login-pass' && inputId !== 'reg-pass') return;

        updateMascotPose();
        if (visible && inputId === 'login-pass') {
            showMascotMessage('passPeekConfirm', { autoHideMs: 4000 });
        } else if (visible) {
            setMascotSpeech(null);
        } else if (document.activeElement === input) {
            syncMascotPasswordSpeech(inputId, {});
        }
    });
}

function initPasswordFields() {
    ['login-pass', 'reg-pass'].forEach((inputId) => {
        const input = document.getElementById(inputId);
        if (!input) return;

        initPasswordToggle(inputId);

        input.addEventListener('beforeinput', (e) => {
            if (e.isComposing) return;
            const types = ['insertText', 'insertReplacementText', 'insertFromPaste', 'insertFromDrop'];
            if (!types.includes(e.inputType) || !e.data) return;

            if (/[A-Z]/.test(e.data)) {
                e.preventDefault();
                handlePasswordInputReject(inputId, { forceCapital: true });
                return;
            }
            if (/[^a-z0-9]/.test(e.data)) {
                e.preventDefault();
                handlePasswordInputReject(inputId, { forceSymbol: true });
            }
        });

        input.addEventListener('input', () => {
            const raw = input.value;
            if (/[A-Z]/.test(raw)) {
                input.value = raw.replace(/[A-Z]/g, '');
                handlePasswordInputReject(inputId, { forceCapital: true });
                return;
            }
            const cleaned = sanitizePasswordChars(raw);
            if (raw !== cleaned) {
                input.value = cleaned;
                handlePasswordInputReject(inputId, { forceSymbol: true });
                return;
            }
            updatePasswordRules(inputId, false, {});
        });

        input.addEventListener('blur', () => updatePasswordRules(inputId, true, {}));

        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasted = e.clipboardData?.getData('text') ?? '';
            if (/[A-Z]/.test(pasted)) {
                input.value = sanitizePasswordChars(pasted.replace(/[A-Z]/g, ''));
                handlePasswordInputReject(inputId, { forceCapital: true });
                return;
            }
            const cleaned = sanitizePasswordChars(pasted);
            input.value = cleaned;
            if (pasted !== cleaned) handlePasswordInputReject(inputId, { forceSymbol: true });
            else updatePasswordRules(inputId, false, {});
        });
    });
}

function isYemeniPhone(phone) {
    const digits = sanitize(phone).replace(/\D/g, '');
    return /^7\d{8}$/.test(digits);
}

function sanitizeCountryCodeDigits(raw) {
    return sanitizeDigitsOnly(raw, 3);
}

function getCountryCodeValue() {
    const digits = sanitizeCountryCodeDigits(document.getElementById('reg-country-code')?.value);
    return digits ? `+${digits}` : '';
}

function setCountryCodeDigits(digits) {
    const input = document.getElementById('reg-country-code');
    if (input) input.value = sanitizeCountryCodeDigits(digits);
}

function isInternationalPhone(phone, countryCode) {
    const phoneDigits = sanitize(phone).replace(/\D/g, '');
    const codeDigits = sanitizeCountryCodeDigits(countryCode);
    const codeOk = codeDigits.length >= 1 && codeDigits.length <= 3;
    return codeOk && phoneDigits.length >= 6 && phoneDigits.length <= 15;
}

function setPhoneErrorMessage(intl) {
    const el = document.getElementById('err-reg-phone');
    if (!el) return;
    el.textContent = intl
        ? 'أدخل رمز الدولة (مثل 966) ورقم هاتف دولي صحيح.'
        : 'أدخل رقم يمني صحيح: 9 أرقام ويبدأ بـ 7.';
}

function isPhoneIntlMode() {
    return document.getElementById('reg-intl-toggle')?.checked === true;
}

function resetPhoneIntlMode() {
    const toggle = document.getElementById('reg-intl-toggle');
    const wrap   = document.getElementById('country-code-wrap');
    const row    = document.getElementById('phone-input-row');
    if (toggle) toggle.checked = false;
    wrap?.classList.add('hidden');
    row?.classList.remove('intl-active');
    setCountryCodeDigits('');
    setPhoneErrorMessage(false);
    updatePhoneInputConstraints();
}

function initPhoneIntlToggle() {
    const toggle = document.getElementById('reg-intl-toggle');
    const wrap   = document.getElementById('country-code-wrap');
    const row    = document.getElementById('phone-input-row');
    const code   = document.getElementById('reg-country-code');

    toggle?.addEventListener('change', () => {
        const on = toggle.checked;
        wrap?.classList.toggle('hidden', !on);
        row?.classList.toggle('intl-active', on);
        if (code) {
            const existing = sanitizeCountryCodeDigits(code.value);
            setCountryCodeDigits(on ? (existing || '966') : '');
        }
        updatePhoneInputConstraints();
        setPhoneErrorMessage(on);
        showError('err-reg-phone', false);
    });
}

function validateLoginForm() {
    const id   = document.getElementById('login-id')?.value.trim() ?? '';
    const pass = document.getElementById('login-pass')?.value ?? '';
    let ok = true;

    if (!id || !pass) {
        showError('err-login-id', !id);
        showError('err-login-pass', !pass);
        return false;
    }

    const codeOk = /^\d{4,10}$/.test(sanitize(id));
    if (!codeOk) { showError('err-login-id', true); ok = false; }
    else          { showError('err-login-id', false); }

    if (!isValidPassword(pass)) {
        showError('err-login-pass', true);
        ok = false;
    } else {
        showError('err-login-pass', false);
    }

    return ok;
}

function normalizeStudentCode(raw) {
    return sanitizeDigitsOnly(String(raw ?? ''), 10);
}

function mapStudentFromDb(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name || '',
        code: row.code || '',
        phone: row.phone || '',
        password: row.password || '',
        halaqa: row.halaqa || 'حلقة الفجر',
        level: row.level || 'beginner',
        avatar: row.avatar || DEFAULT_AVATAR,
        approvedAt: row.approved_at || '',
        approvedLabel: row.approved_at || ''
    };
}

function getApprovedStudents() {
    const byCode = new Map();

    APPROVED_STUDENTS_KEYS.forEach((key) => {
        try {
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            if (!Array.isArray(list)) return;
            list.forEach((student) => {
                const code = normalizeStudentCode(student?.code);
                if (code) byCode.set(code, student);
            });
        } catch { /* ignore parse errors */ }
    });

    return Array.from(byCode.values());
}

async function findApprovedStudentInDb(code, password) {
    const normalizedCode = normalizeStudentCode(code);
    const normalizedPass = String(password ?? '').trim();
    if (!supabaseClient || !normalizedCode || !normalizedPass) return null;

    const { data, error } = await supabaseClient
        .from(SUPABASE_TABLE_STUDENTS)
        .select('*')
        .eq('code', normalizedCode)
        .eq('password', normalizedPass)
        .maybeSingle();

    if (error) {
        console.error('Supabase student lookup failed:', error);
        return null;
    }

    return mapStudentFromDb(data);
}

function extractStudentPassword(student) {
    const raw = student?.password ?? student?.pass ?? student?.studentPassword ?? '';
    return String(raw).trim();
}

function studentPasswordMatches(student, inputPass) {
    const input = String(inputPass ?? '').trim();
    const stored = extractStudentPassword(student);
    if (stored) return stored === input;
    return input === DEFAULT_STUDENT_PASSWORD;
}

function findApprovedStudentLocal(code, password) {
    const normalizedCode = normalizeStudentCode(code);
    const normalizedPass = String(password ?? '').trim();
    if (!normalizedCode || !normalizedPass) return null;

    const students = getApprovedStudents();
    if (!students.length) return null;

    return students.find((st) => (
        normalizeStudentCode(st.code) === normalizedCode &&
        studentPasswordMatches(st, normalizedPass)
    )) || null;
}

async function findApprovedStudent(code, password) {
    const fromDb = await findApprovedStudentInDb(code, password);
    if (fromDb) return fromDb;
    return findApprovedStudentLocal(code, password);
}

function saveCurrentLoggedInStudent(student, code) {
    const normalizedCode = normalizeStudentCode(student.code ?? code);
    const payload = {
        id: student.id || createStudentSessionId(),
        name: student.name || '',
        code: normalizedCode,
        phone: student.phone || '',
        halaqa: student.halaqa || 'حلقة الفجر',
        level: student.level || 'beginner',
        avatar: student.avatar || DEFAULT_AVATAR,
        approvedAt: student.approvedAt || student.approvedLabel || '',
        loggedInAt: new Date().toISOString()
    };
    localStorage.setItem(CURRENT_STUDENT_KEY, JSON.stringify(payload));
}

function createStudentSessionId() {
    return `st_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function clearLoginFailureState() {
    document.getElementById('auth-card')?.classList.remove('is-login-failed', 'is-shaking-strong');
}

function shakeLoginFields() {
    triggerFieldShake('login-id-wrap');
    triggerFieldShake('login-pass-wrap');
    document.getElementById('login-id')?.classList.add('is-rejected');
    document.getElementById('login-pass')?.classList.add('is-rejected');
    setTimeout(() => {
        document.getElementById('login-id')?.classList.remove('is-rejected');
        document.getElementById('login-pass')?.classList.remove('is-rejected');
    }, 650);
}

function shakeAuthCard() {
    const card = document.getElementById('auth-card');
    if (!card) return;
    card.classList.add('is-login-failed', 'is-shaking-strong');
    card.addEventListener('animationend', () => {
        card.classList.remove('is-shaking-strong');
    }, { once: true });
}

function rejectStudentLogin() {
    shakeLoginFields();
    shakeAuthCard();
    showLoginMascotBubble('loginNotFound', 6500);
    showToast('بيانات الدخول غير صحيحة أو لم يُقبل طلبك بعد.', 'error');
}

async function attemptStudentLogin(rawCode, rawPass) {
    if (!validateLoginForm()) {
        rejectStudentLogin();
        return false;
    }

    const student = await findApprovedStudent(rawCode, rawPass);
    if (!student) {
        rejectStudentLogin();
        return false;
    }

    clearLoginFailureState();
    saveCurrentLoggedInStudent(student, rawCode);
    window.location.assign('student-dashboard.html');
    return true;
}

function validateRegisterForm() {
    const name  = sanitize(document.getElementById('reg-name')?.value ?? '');
    const age   = parseInt(document.getElementById('reg-age')?.value ?? '', 10);
    const phone = sanitize(document.getElementById('reg-phone')?.value.trim() ?? '');
    const pass  = document.getElementById('reg-pass')?.value ?? '';
    let ok = true;

    const arabicWords = name.split(/\s+/).filter(w => /^[\u0600-\u06FF]+$/.test(w));
    if (name.length < 10 || arabicWords.length < 4) { showError('err-reg-name', true); ok = false; }
    else { showError('err-reg-name', false); }

    if (!Number.isFinite(age) || age < 5 || age > 25) { showError('err-reg-age', true); ok = false; }
    else { showError('err-reg-age', false); }

    const intl = isPhoneIntlMode();
    const countryCode = getCountryCodeValue();
    setPhoneErrorMessage(intl);
    const phoneOk = intl
        ? isInternationalPhone(phone, countryCode)
        : isYemeniPhone(phone);
    if (!phoneOk) { showError('err-reg-phone', true); ok = false; }
    else { showError('err-reg-phone', false); }

    if (!isValidPassword(pass)) {
        showError('err-reg-pass', true);
        updatePasswordRules('reg-pass', true);
        ok = false;
    } else {
        showError('err-reg-pass', false);
        updatePasswordRules('reg-pass', false);
    }

    return ok;
}

function buildSubmittedLabel(date = new Date()) {
    return date.toLocaleString('ar-SA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function saveNewStudentRequestLocal(data, submittedAt, submittedLabel) {
    try {
        const list = JSON.parse(localStorage.getItem('new_students_requests') || '[]');
        list.push({
            id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: data.name,
            phone: data.phone,
            countryCode: data.countryCode,
            password: data.password ?? '',
            submittedAt: submittedAt.toISOString(),
            submittedLabel
        });
        localStorage.setItem('new_students_requests', JSON.stringify(list));
        return true;
    } catch {
        return false;
    }
}

async function saveNewStudentRequest(data) {
    const now = new Date();
    const submittedLabel = buildSubmittedLabel(now);

    if (supabaseClient) {
        const { error } = await supabaseClient
            .from(SUPABASE_TABLE_NEW_REQUESTS)
            .insert({
                name: data.name,
                phone: data.phone,
                country_code: data.countryCode,
                password: data.password ?? '',
                submitted_label: submittedLabel
            });

        if (!error) return { ok: true, source: 'supabase' };
        console.error('Supabase request insert failed:', error);
    }

    const savedLocally = saveNewStudentRequestLocal(data, now, submittedLabel);
    return savedLocally
        ? { ok: true, source: 'local' }
        : { ok: false, source: 'none' };
}

/* -----------------------------------------------------------------------
   مواقيت الصلاة الحية
   ----------------------------------------------------------------------- */
function getPrayerCountdown() {
    const now  = new Date();
    let nearest = null;
    let minDiff = Infinity;

    PRAYERS.forEach((p) => {
        const [h, m] = p.time.split(':').map(Number);
        const target = new Date(now);
        target.setHours(h, m, 0, 0);
        if (target <= now) target.setDate(target.getDate() + 1);
        const diff = target - now;
        if (diff < minDiff) { minDiff = diff; nearest = { p, target }; }
    });
    return nearest;
}

function formatArabicTime(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'م' : 'ص';
    const h12  = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function updatePrayerWidget() {
    const data = getPrayerCountdown();
    if (!data) return;

    const nameEl  = document.getElementById('next-prayer-name');
    const timeEl  = document.getElementById('next-prayer-time');
    const countEl = document.getElementById('prayer-countdown');

    if (nameEl) nameEl.textContent = data.p.name;
    if (timeEl) timeEl.textContent = formatArabicTime(data.p.time);

    if (countEl) {
        const diff  = data.target - new Date();
        const secs  = Math.max(0, Math.floor(diff / 1000));
        const hh    = Math.floor(secs / 3600);
        const mm    = Math.floor((secs % 3600) / 60);
        const ss    = secs % 60;
        countEl.textContent = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    }
}

function buildPrayerModal() {
    const body    = document.getElementById('prayer-modal-body');
    if (!body) return;
    const nearest = getPrayerCountdown();
    body.innerHTML = '';

    PRAYERS.forEach(p => {
        const isNext = nearest && p.name === nearest.p.name;
        const row    = document.createElement('div');
        row.className = `prayer-detail-row${isNext ? ' active' : ''}`;
        row.innerHTML = `
            <span class="prayer-detail-name">${sanitize(p.name)} ${isNext ? '<small style="font-size:0.7rem;color:var(--emerald-500);">(التالية)</small>' : ''}</span>
            <span class="prayer-detail-time">${sanitize(formatArabicTime(p.time))}</span>`;
        body.appendChild(row);
    });
}

/* -----------------------------------------------------------------------
   بناء بطاقة الإعلانات (Widget + Modal)
   ----------------------------------------------------------------------- */
function buildAnnouncements() {
    // الواجهة المختصرة في البطاقة
    const listEl = document.getElementById('ann-list');
    if (listEl) {
        listEl.innerHTML = ANNOUNCEMENTS.slice(0, 2).map(a => `
            <div class="ann-item">
                <span class="ann-tag">${sanitize(a.tag)}</span>
                <span>${sanitize(a.short)}</span>
            </div>`).join('');
    }

    // المودال التفصيلي
    const bodyEl = document.getElementById('ann-modal-body');
    if (bodyEl) {
        bodyEl.innerHTML = ANNOUNCEMENTS.map(a => `
            <div style="border:1px solid var(--border-light);border-radius:var(--radius-sm);padding:16px;display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span class="ann-tag">${sanitize(a.tag)}</span>
                    <span style="font-size:0.73rem;color:var(--text-muted);">${sanitize(a.date)}</span>
                </div>
                <p style="font-weight:700;color:var(--text-heading);font-size:0.9rem;">${sanitize(a.short)}</p>
                <p style="font-size:0.83rem;color:var(--text-muted);line-height:1.55;text-align:justify;">${sanitize(a.detail)}</p>
            </div>`).join('');
    }
}

/* -----------------------------------------------------------------------
   الوضع الداكن (Dark Mode)
   ----------------------------------------------------------------------- */
function applyTheme(dark) {
    document.body.classList.toggle('dark', dark);
    localStorage.setItem('qmza_dark', dark ? '1' : '0');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

function buildSettingsModal() {
    const isDark = document.body.classList.contains('dark');
    return `
        <div style="display:flex;flex-direction:column;gap:16px;width:100%">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:14px;background:var(--bg-mint);border-radius:var(--radius-sm);">
                <div>
                    <strong style="display:block;font-size:0.9rem;color:var(--text-heading);">الوضع الداكن</strong>
                    <small style="color:var(--text-muted);">تبديل المظهر لراحة العين ليلاً</small>
                </div>
                <label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;">
                    <input type="checkbox" id="dark-toggle" ${isDark ? 'checked' : ''} style="opacity:0;width:0;height:0;">
                    <span id="dark-slider" style="position:absolute;inset:0;background:${isDark ? 'var(--emerald-700)' : 'var(--border-mint)'};border-radius:999px;transition:0.3s;"></span>
                    <span style="position:absolute;width:18px;height:18px;background:white;border-radius:50%;top:3px;right:${isDark ? '23px' : '3px'};transition:0.3s;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>
                </label>
            </div>
        </div>`;
}

/* -----------------------------------------------------------------------
   محتوى المودالات العامة (About / Dev / Support)
   ----------------------------------------------------------------------- */
const INFO_CONTENT = {
    about: {
        title: 'حول المجمع',
        body: `
            <p style="line-height:1.7;color:var(--text-body);">مجمع حلقات الزبير ابن العوام رضي الله عنه، مجمع تعليمي رائد يسعى لبناء جيل قرآني متكامل يجمع بين الحفظ الدقيق والتجويد السليم والتربية الفاضلة.</p>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:18px;text-align:center;">
                <div style="background:var(--bg-mint);padding:12px;border-radius:var(--radius-sm);">
                    <strong style="font-size:1.4rem;color:var(--emerald-700);display:block;">+١٥٠</strong>
                    <small style="color:var(--text-muted);">طالب نشط</small>
                </div>
                <div style="background:var(--bg-mint);padding:12px;border-radius:var(--radius-sm);">
                    <strong style="font-size:1.4rem;color:var(--emerald-700);display:block;">١٢</strong>
                    <small style="color:var(--text-muted);">حلقة مرخصة</small>
                </div>
                <div style="background:var(--bg-mint);padding:12px;border-radius:var(--radius-sm);">
                    <strong style="font-size:1.4rem;color:var(--emerald-700);display:block;">+٣٥</strong>
                    <small style="color:var(--text-muted);">خاتم مجاز</small>
                </div>
            </div>`
    },
    developer: {
        title: 'صفحة المطور',
        body: `
            <div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px;">
                <div style="width:64px;height:64px;background:linear-gradient(135deg,var(--emerald-700),var(--emerald-400));border-radius:16px;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-md);">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                </div>
                <strong style="font-size:1.1rem;color:var(--text-heading);">المهندس المطور</strong>
                <p style="font-size:0.85rem;color:var(--text-muted);line-height:1.6;text-align:justify;">تم تصميم وتطوير هذه المنصة بأعلى معايير جودة الكود، والأمان الصارم، والتجاوب الكامل مع جميع الأجهزة، لتلبي احتياجات حلقات المجمع بكفاءة واحترافية.</p>
                <button class="btn-block btn-primary-block" style="margin-top:8px;" onclick="showToast('شكراً لتواصلك! يمكنك إرسال استفسارك عبر الدعم الفني.','success')">تواصل مع المطور</button>
            </div>`
    },
    support: {
        title: 'الدعم الفني',
        body: `
            <form id="support-form" style="display:flex;flex-direction:column;gap:14px;width:100%" novalidate>
                <div class="field">
                    <label class="field-label" for="sup-email">البريد الإلكتروني</label>
                    <div class="input-wrap">
                        <input class="form-input" type="email" id="sup-email" placeholder="example@email.com">
                    </div>
                </div>
                <div class="field">
                    <label class="field-label" for="sup-type">نوع المشكلة</label>
                    <div class="input-wrap has-select">
                        <select class="form-input" id="sup-type">
                            <option value="login">مشكلة في تسجيل الدخول</option>
                            <option value="register">مشكلة في التسجيل الجديد</option>
                            <option value="suggest">اقتراح</option>
                            <option value="other">أخرى</option>
                        </select>
                    </div>
                </div>
                <div class="field">
                    <label class="field-label" for="sup-msg">تفاصيل الرسالة</label>
                    <div class="input-wrap">
                        <textarea class="form-input" id="sup-msg" rows="3" placeholder="اكتب مشكلتك..." style="resize:none;padding-top:10px;"></textarea>
                    </div>
                </div>
                <button type="submit" class="btn-block btn-primary-block">إرسال الرسالة</button>
            </form>`
    }
};

function openInfoModal(key) {
    const data = INFO_CONTENT[key];
    if (!data) return;
    document.getElementById('info-modal-title').textContent = data.title;
    document.getElementById('info-modal-body').innerHTML    = data.body;
    closeSidebar();
    openModal('info-modal-overlay');

    // ربط حدث نموذج الدعم الفني عند فتحه
    if (key === 'support') {
        setTimeout(() => {
            const form = document.getElementById('support-form');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const email = document.getElementById('sup-email')?.value ?? '';
                    const msg   = document.getElementById('sup-msg')?.value ?? '';
                    if (!email.includes('@') || msg.trim().length < 5) {
                        showToast('يرجى إدخال بريد صحيح ورسالة واضحة.', 'error');
                        return;
                    }
                    showToast('تم استلام رسالتك! سنرد عليك قريباً.', 'success');
                    closeModal('info-modal-overlay');
                });
            }
        }, 100);
    }

    // ربط حدث الإعدادات عند فتحها
    if (key === 'settings') {
        setTimeout(() => {
            const toggle = document.getElementById('dark-toggle');
            if (toggle) {
                toggle.addEventListener('change', (e) => {
                    applyTheme(e.target.checked);
                    // تحديث مظهر الـ toggle بعد التغيير
                    const slider = document.getElementById('dark-slider');
                    const thumb  = toggle.nextElementSibling?.nextElementSibling;
                    if (slider) slider.style.background = e.target.checked ? 'var(--emerald-700)' : 'var(--border-mint)';
                    if (thumb)  thumb.style.right = e.target.checked ? '23px' : '3px';
                });
            }
        }, 100);
    }
}

/* -----------------------------------------------------------------------
   القائمة الجانبية (Sidebar — Desktop pinned / Mobile drawer)
   ----------------------------------------------------------------------- */
const DESKTOP_BP = 769;

function isDesktopLayout() {
    return window.innerWidth >= DESKTOP_BP;
}

function setSidebarToggleState(expanded) {
    const toggle = document.getElementById('sidebar-toggle-btn');
    if (toggle) toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

function initSidebarLayout() {
    const sidebar = document.getElementById('sidebar');
    const collapsed = localStorage.getItem('qmza_sidebar_collapsed') === '1';

    if (isDesktopLayout()) {
        sidebar?.setAttribute('aria-hidden', 'false');
        if (collapsed) {
            document.body.classList.add('sidebar-collapsed');
            setSidebarToggleState(false);
        } else {
            document.body.classList.remove('sidebar-collapsed');
            setSidebarToggleState(true);
        }
    } else {
        sidebar?.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('sidebar-collapsed');
    }
}

function openSidebar() {
    if (isDesktopLayout()) return;

    document.getElementById('sidebar')?.classList.add('open');
    document.getElementById('sidebar-overlay')?.classList.add('open');
    document.getElementById('sidebar')?.setAttribute('aria-hidden', 'false');
    document.getElementById('menu-btn')?.classList.add('open');
    document.getElementById('menu-btn')?.setAttribute('aria-expanded', 'true');
    document.body.classList.add('sidebar-open');
}

function closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('open');
    document.getElementById('sidebar')?.setAttribute('aria-hidden', 'true');
    document.getElementById('menu-btn')?.classList.remove('open');
    document.getElementById('menu-btn')?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('sidebar-open');
}

function toggleSidebarDrawer() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || isDesktopLayout()) return;
    if (sidebar.classList.contains('open')) closeSidebar();
    else openSidebar();
}

function toggleSidebarCollapse() {
    if (!isDesktopLayout()) {
        toggleSidebarDrawer();
        return;
    }

    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('qmza_sidebar_collapsed', collapsed ? '1' : '0');
    setSidebarToggleState(!collapsed);
}

/* -----------------------------------------------------------------------
   الملف الشخصي (Profile Modal)
   ----------------------------------------------------------------------- */
let pendingAvatar = null;

function openProfileModal() {
    const session = getSession() || {};
    if (session.loggedIn && session.authToken && session.role === 'teacher') {
        window.location.assign('teacher-dashboard.html');
        return;
    }
    if (session.loggedIn && session.authToken && session.role === 'admin') {
        window.location.assign('dashboard.html');
        return;
    }
    const nameInput  = document.getElementById('profile-name');
    const avatarImg  = document.getElementById('modal-avatar');

    if (nameInput) nameInput.value = session.name || '';
    if (avatarImg) avatarImg.src   = session.avatar || DEFAULT_AVATAR;
    pendingAvatar = null;

    openModal('profile-modal-overlay');
}

/* -----------------------------------------------------------------------
   سلايدر الإعلانات البانورامي
   ----------------------------------------------------------------------- */
const BANNER_ADS_KEY = 'qmza_banner_ads';
const BANNER_OVERLAY_KEY = 'qmza_banner_overlay';
const DEFAULT_BANNER_IMAGE = 'watermarked_img_14204941598938561939.png';

const heroSliderState = {
    index: 0,
    ads: [],
    autoplayTimer: null
};

function getDefaultBannerOverlaySettings() {
    return { blurAmount: 15, overlayHeight: 30, overlayColorTheme: 'white', edgeSmoothness: 20 };
}

function resolveBannerOverlayColor(theme) {
    return theme === 'emerald' ? 'rgba(11, 44, 36, 0.3)' : 'rgba(255, 255, 255, 0.3)';
}

function getBannerOverlaySettings() {
    try {
        const raw = localStorage.getItem(BANNER_OVERLAY_KEY);
        if (!raw) return getDefaultBannerOverlaySettings();
        return { ...getDefaultBannerOverlaySettings(), ...JSON.parse(raw) };
    } catch {
        return getDefaultBannerOverlaySettings();
    }
}

function applyBannerOverlaySettings(settings = getBannerOverlaySettings()) {
    const wrap = document.getElementById('hero-banner-wrap');
    if (!wrap) return;
    wrap.style.setProperty('--blur-amount', `${settings.blurAmount}px`);
    wrap.style.setProperty('--overlay-height', `${settings.overlayHeight}%`);
    wrap.style.setProperty('--overlay-color', resolveBannerOverlayColor(settings.overlayColorTheme));
    wrap.style.setProperty('--edge-smoothness', `${settings.edgeSmoothness}%`);
}

function getDefaultBannerAds() {
    return [{
        id: 'ad_default_main',
        name: 'إعلان التسجيل الرئيسي',
        image: DEFAULT_BANNER_IMAGE,
        linkType: 'join',
        link: '#register',
        caption: 'حتى في بيوت الله',
        active: true,
        archived: false,
        createdAt: new Date().toISOString()
    }];
}

function getBannerAds() {
    try {
        const raw = localStorage.getItem(BANNER_ADS_KEY);
        if (!raw) return null;
        const list = JSON.parse(raw);
        return Array.isArray(list) ? list : null;
    } catch {
        return null;
    }
}

function saveBannerAds(list) {
    localStorage.setItem(BANNER_ADS_KEY, JSON.stringify(list));
}

function ensureBannerAdsStore() {
    const existing = getBannerAds();
    if (existing?.length) return existing;
    const defaults = getDefaultBannerAds();
    saveBannerAds(defaults);
    return defaults;
}

function getVisibleBannerAds() {
    return ensureBannerAdsStore().filter((ad) => ad.archived !== true && ad.active !== false);
}

function escapeBannerHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function navigateBannerAd(ad) {
    if (!ad) return;
    const linkType = ad.linkType || (String(ad.link || '').startsWith('http') ? 'url' : 'join');
    if (linkType === 'join' || ad.link === '#register' || ad.link === 'register') {
        scrollToJoinRegister();
        return;
    }
    const url = String(ad.link || '').trim();
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
}

function renderHeroSlider() {
    const wrap = document.getElementById('hero-banner-wrap');
    const track = document.getElementById('hero-slider-track');
    const dots = document.getElementById('hero-dots');
    if (!wrap || !track || !dots) return;

    heroSliderState.ads = getVisibleBannerAds();
    stopHeroAutoplay();

    if (!heroSliderState.ads.length) {
        wrap.hidden = true;
        track.innerHTML = '';
        dots.innerHTML = '';
        return;
    }

    wrap.hidden = false;
    if (heroSliderState.index >= heroSliderState.ads.length) {
        heroSliderState.index = 0;
    }

    track.innerHTML = heroSliderState.ads.map((ad, i) => {
        const caption = ad.caption
            ? `<div class="hero-slide-overlay"><div class="hero-slide-caption"><p class="hero-slide-title">${escapeBannerHtml(ad.caption)}</p></div></div>`
            : '';
        return `
            <article class="hero-slide" data-slide-index="${i}">
                <a class="hero-slide-link" href="#" data-ad-index="${i}" aria-label="${escapeBannerHtml(ad.name || 'إعلان')}">
                    <img class="hero-slide-media" src="${escapeBannerHtml(ad.image)}" alt="${escapeBannerHtml(ad.name || 'إعلان المجمع')}" loading="${i === 0 ? 'eager' : 'lazy'}">
                    <span class="glass-overlay" aria-hidden="true"></span>
                    ${caption}
                </a>
            </article>
        `;
    }).join('');

    dots.innerHTML = heroSliderState.ads.map((ad, i) => `
        <button type="button" class="hero-dot${i === heroSliderState.index ? ' is-active' : ''}"
            data-dot-index="${i}" role="tab" aria-label="الانتقال إلى ${escapeBannerHtml(ad.name || 'إعلان')}"
            aria-selected="${i === heroSliderState.index ? 'true' : 'false'}"></button>
    `).join('');

    updateHeroSlidePosition(false);

    const showNav = heroSliderState.ads.length > 1;
    document.getElementById('hero-nav-prev').hidden = !showNav;
    document.getElementById('hero-nav-next').hidden = !showNav;
    document.getElementById('hero-dots').hidden = !showNav;

    startHeroAutoplay();
}

function updateHeroSlidePosition(animate = true) {
    const track = document.getElementById('hero-slider-track');
    const dots = document.querySelectorAll('.hero-dot');
    if (!track) return;

    if (!animate) track.style.transition = 'none';
    track.style.transform = `translateX(-${heroSliderState.index * 100}%)`;
    if (!animate) {
        void track.offsetWidth;
        track.style.transition = '';
    }

    dots.forEach((dot, i) => {
        dot.classList.toggle('is-active', i === heroSliderState.index);
        dot.setAttribute('aria-selected', i === heroSliderState.index ? 'true' : 'false');
    });
}

function goHeroSlide(step) {
    const total = heroSliderState.ads.length;
    if (!total) return;
    heroSliderState.index = (heroSliderState.index + step + total) % total;
    updateHeroSlidePosition(true);
    restartHeroAutoplay();
}

function goHeroSlideTo(index) {
    const total = heroSliderState.ads.length;
    if (!total || index < 0 || index >= total) return;
    heroSliderState.index = index;
    updateHeroSlidePosition(true);
    restartHeroAutoplay();
}

function startHeroAutoplay() {
    stopHeroAutoplay();
    if (heroSliderState.ads.length <= 1) return;
    heroSliderState.autoplayTimer = setInterval(() => goHeroSlide(1), 5500);
}

function stopHeroAutoplay() {
    if (heroSliderState.autoplayTimer) {
        clearInterval(heroSliderState.autoplayTimer);
        heroSliderState.autoplayTimer = null;
    }
}

function restartHeroAutoplay() {
    stopHeroAutoplay();
    startHeroAutoplay();
}

function initHeroSlider() {
    renderHeroSlider();

    const slider = document.getElementById('hero-slider');
    const track = document.getElementById('hero-slider-track');
    const dots = document.getElementById('hero-dots');

    document.getElementById('hero-nav-prev')?.addEventListener('click', () => goHeroSlide(-1));
    document.getElementById('hero-nav-next')?.addEventListener('click', () => goHeroSlide(1));

    dots?.addEventListener('click', (e) => {
        const dot = e.target.closest('[data-dot-index]');
        if (!dot) return;
        goHeroSlideTo(parseInt(dot.dataset.dotIndex, 10));
    });

    track?.addEventListener('click', (e) => {
        const link = e.target.closest('.hero-slide-link');
        if (!link) return;
        e.preventDefault();
        const idx = parseInt(link.dataset.adIndex, 10);
        navigateBannerAd(heroSliderState.ads[idx]);
    });

    slider?.addEventListener('mouseenter', stopHeroAutoplay);
    slider?.addEventListener('mouseleave', startHeroAutoplay);

    window.addEventListener('storage', (e) => {
        if (e.key === BANNER_ADS_KEY) renderHeroSlider();
        if (e.key === BANNER_OVERLAY_KEY) applyBannerOverlaySettings();
    });
}

/* -----------------------------------------------------------------------
   تهيئة التطبيق عند التحميل
   ----------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    cleanLoginInputFields();

    // السنة في الفوتر
    const yrEl = document.getElementById('yr');
    if (yrEl) yrEl.textContent = new Date().getFullYear();

    // تطبيق الوضع الداكن المحفوظ
    const savedDark = localStorage.getItem('qmza_dark') === '1';
    if (savedDark) document.body.classList.add('dark');
    document.documentElement.style.colorScheme = savedDark ? 'dark' : 'light';

    // تهيئة الجلسة
    if (!getSession()) {
        saveSession({ loggedIn: false, name: '', avatar: DEFAULT_AVATAR });
    }
    updateHeaderProfile();

    initPasswordFields();
    initLoginMascot();
    initDirectLoginMascotMessages();
    initLoginIdInput();
    initPhoneInput();
    initPhoneIntlToggle();
    initCountryCodeInput();
    initHeroSlider();
    applyBannerOverlaySettings();

    // بناء الإعلانات
    buildAnnouncements();

    // عداد مواقيت الصلاة
    updatePrayerWidget();
    setInterval(updatePrayerWidget, 1000);

    // تهيئة القائمة الجانبية
    initSidebarLayout();
    window.addEventListener('resize', () => {
        if (isDesktopLayout()) {
            closeSidebar();
            initSidebarLayout();
        } else {
            document.body.classList.remove('sidebar-collapsed');
        }
    });

    /* --- ربط الأحداث --- */

    // شريط الإعلان العلوي
    document.getElementById('top-bar-close-btn')?.addEventListener('click', () => {
        const bar = document.getElementById('top-bar');
        if (bar) { bar.style.transition = 'opacity 0.3s'; bar.style.opacity = '0'; setTimeout(() => bar.remove(), 300); }
    });

    document.getElementById('top-bar-cta-btn')?.addEventListener('click', scrollToJoinRegister);

    // أزرار الهيدر
    document.getElementById('header-login-btn')?.addEventListener('click', () => {
        showView('login-view');
        document.getElementById('auth-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    document.getElementById('header-register-btn')?.addEventListener('click', () => {
        showView('register-view');
        document.getElementById('auth-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    // القائمة الجانبية
    document.getElementById('menu-btn')?.addEventListener('click', toggleSidebarDrawer);
    document.getElementById('sidebar-toggle-btn')?.addEventListener('click', toggleSidebarCollapse);
    document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);

    // زر تبديل الثيم في الهيدر
    document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark');
        applyTheme(!isDark);
        showToast(!isDark ? 'الوضع الداكن مفعّل' : 'الوضع المضيء مفعّل');
    });

    // الملف الشخصي
    document.getElementById('profile-btn')?.addEventListener('click', openProfileModal);
    document.getElementById('profile-modal-close')?.addEventListener('click', () => closeModal('profile-modal-overlay'));
    document.getElementById('profile-modal-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'profile-modal-overlay') closeModal('profile-modal-overlay');
    });

    // رفع الصورة الشخصية
    document.getElementById('avatar-ring')?.addEventListener('click', () => {
        document.getElementById('avatar-file')?.click();
    });

    document.getElementById('avatar-file')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { showToast('يرجى اختيار ملف صورة فقط.', 'error'); return; }
        if (file.size > 1.5 * 1024 * 1024) { showToast('حجم الصورة كبير جداً (الحد 1.5 ميغابايت).', 'error'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
            pendingAvatar = ev.target.result;
            const avatarImg = document.getElementById('modal-avatar');
            if (avatarImg) avatarImg.src = pendingAvatar;
        };
        reader.readAsDataURL(file);
    });

    // حفظ الملف الشخصي
    document.getElementById('save-profile-btn')?.addEventListener('click', () => {
        const name = sanitize(document.getElementById('profile-name')?.value ?? '');
        if (name.length < 2) { showToast('الاسم قصير جداً!', 'error'); return; }
        const session  = getSession() || {};
        session.name   = name;
        session.avatar = pendingAvatar || session.avatar || DEFAULT_AVATAR;
        session.loggedIn = true;
        saveSession(session);
        updateHeaderProfile();
        closeModal('profile-modal-overlay');
        showToast('تم حفظ بياناتك بنجاح!', 'success');
    });

    // تسجيل الخروج
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        saveSession({ loggedIn: false, name: '', avatar: DEFAULT_AVATAR, authToken: null, studentCode: '' });
        updateHeaderProfile();
        closeModal('profile-modal-overlay');
        showToast('تم تسجيل خروجك بنجاح.');
    });

    // التبديل بين واجهة الدخول والتسجيل
    document.getElementById('go-join-btn')?.addEventListener('click', () => showView('register-view'));
    document.getElementById('go-login-tab')?.addEventListener('click', () => showView('login-view'));

    // نموذج تسجيل الدخول — مصادقة صارمة ضد الطلاب المعتمدين (dash_students)
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const code = document.getElementById('login-id')?.value ?? '';
        const pass = document.getElementById('login-pass')?.value ?? '';
        const submitBtn = document.getElementById('login-submit-btn');
        submitBtn?.setAttribute('disabled', 'disabled');
        try {
            await attemptStudentLogin(code, pass);
        } finally {
            submitBtn?.removeAttribute('disabled');
        }
    });

    document.getElementById('login-id')?.addEventListener('input', clearLoginFailureState);
    document.getElementById('login-pass')?.addEventListener('input', clearLoginFailureState);

    // نموذج طلب الانضمام
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateRegisterForm()) {
            const intl = isPhoneIntlMode();
            const phone = intl
                ? isInternationalPhone(
                    sanitize(document.getElementById('reg-phone')?.value.trim() ?? ''),
                    getCountryCodeValue()
                )
                : isYemeniPhone(sanitize(document.getElementById('reg-phone')?.value.trim() ?? ''));
            const passOk = isValidPassword(document.getElementById('reg-pass')?.value ?? '');
            const msg = !phone
                ? (intl ? 'تحقق من رمز الدولة ورقم الهاتف الدولي.' : 'أدخل رقم يمني صحيح: 9 أرقام ويبدأ بـ 7.')
                : !passOk
                    ? 'كلمة السر: 8 خانات، أحرف صغيرة إنجليزية وأرقام فقط.'
                    : 'تحقق من البيانات المدخلة.';
            showToast(msg, 'error');
            return;
        }

        const submitBtn = document.getElementById('register-submit-btn');
        submitBtn?.setAttribute('disabled', 'disabled');
        try {
            const result = await saveNewStudentRequest({
                name: sanitize(document.getElementById('reg-name')?.value ?? ''),
                phone: sanitize(document.getElementById('reg-phone')?.value.trim() ?? ''),
                countryCode: isPhoneIntlMode() ? getCountryCodeValue() : '+967',
                password: document.getElementById('reg-pass')?.value ?? ''
            });

            if (!result.ok) {
                showToast('تعذر إرسال الطلب. حاول مرة أخرى.', 'error');
                return;
            }

            setMascotSpeech('joinSuccess');
            updateMascotPose();
            document.getElementById('register-form')?.reset();
            resetPhoneIntlMode();
            resetPasswordField('reg-pass');
            showToast('تم إرسال طلبك بنجاح!', 'success');
        } finally {
            submitBtn?.removeAttribute('disabled');
        }
    });

    // بطاقات الويدجت
    document.getElementById('prayer-widget')?.addEventListener('click', () => {
        buildPrayerModal();
        openModal('prayer-modal-overlay');
    });

    document.getElementById('ann-widget')?.addEventListener('click', () => openModal('ann-modal-overlay'));

    // إغلاق نوافذ الصلاة والإعلانات
    document.getElementById('prayer-modal-close')?.addEventListener('click', () => closeModal('prayer-modal-overlay'));
    document.getElementById('ann-modal-close')?.addEventListener('click', () => closeModal('ann-modal-overlay'));
    document.getElementById('info-modal-close')?.addEventListener('click', () => closeModal('info-modal-overlay'));

    document.getElementById('prayer-modal-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'prayer-modal-overlay') closeModal('prayer-modal-overlay');
    });

    document.getElementById('ann-modal-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'ann-modal-overlay') closeModal('ann-modal-overlay');
    });

    document.getElementById('info-modal-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'info-modal-overlay') closeModal('info-modal-overlay');
    });

    // روابط القائمة الجانبية
    document.getElementById('link-about')?.addEventListener('click', (e) => { e.preventDefault(); openInfoModal('about'); });

    document.getElementById('link-settings')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('info-modal-title').textContent = 'الإعدادات';
        document.getElementById('info-modal-body').innerHTML    = buildSettingsModal();
        closeSidebar();
        openModal('info-modal-overlay');
        setTimeout(() => {
            const toggle = document.getElementById('dark-toggle');
            if (toggle) {
                toggle.addEventListener('change', (ev) => {
                    applyTheme(ev.target.checked);
                    const slider = toggle.parentElement?.querySelector('span');
                    const thumb  = toggle.parentElement?.querySelectorAll('span')[1];
                    if (slider) slider.style.background = ev.target.checked ? 'var(--emerald-700)' : 'var(--border-mint)';
                    if (thumb)  thumb.style.right = ev.target.checked ? '23px' : '3px';
                    showToast(ev.target.checked ? 'الوضع الداكن مفعّل' : 'الوضع المضيء مفعّل');
                });
            }
        }, 120);
    });

    document.getElementById('link-developer')?.addEventListener('click', (e) => { e.preventDefault(); openInfoModal('developer'); });
    document.getElementById('link-support')?.addEventListener('click',  (e) => { e.preventDefault(); openInfoModal('support'); });

    // روابط الفوتر
    document.getElementById('footer-dev')?.addEventListener('click',     (e) => { e.preventDefault(); openInfoModal('developer'); });
    document.getElementById('footer-support')?.addEventListener('click', (e) => { e.preventDefault(); openInfoModal('support'); });

    // شريط التنقل السفلي (Bottom Nav)
    const bnavItems = document.querySelectorAll('.bottom-nav-item');
    bnavItems.forEach(item => {
        item.addEventListener('click', () => {
            bnavItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            const target = item.dataset.target;
            if (target === 'home') {
                showView('login-view');
                document.getElementById('auth-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (target === 'halaqat') {
                showView('register-view');
                document.getElementById('auth-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (target === 'prayer') {
                buildPrayerModal();
                openModal('prayer-modal-overlay');
            } else if (target === 'developer') {
                openInfoModal('developer');
            }
        });
    });

    // إغلاق القوائم بالـ Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closeSidebar(); closeAllModals(); }
    });

    // الـ brand link
    document.getElementById('brand-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        showView('login-view');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    if (location.hash === '#login') {
        showView('login-view');
        document.getElementById('auth-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

});
