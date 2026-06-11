'use strict';
/* =======================================================================
   حلقات مجمع الزبير ابن العوام — Script.js
   نظيف، آمن، وفعّال
   ======================================================================= */

/* -----------------------------------------------------------------------
   الثوابت والبيانات
   ----------------------------------------------------------------------- */
const TOP_BAR_ADS_KEY = 'qmza_top_bar_ads';
const TOP_BAR_ADS_MAX = 3;
const TOP_BAR_TEXT_MAX = 100;
const TOP_BAR_TAG_MAX = 12;

const DEFAULT_TOP_BAR_ADS = [
    { tag: 'جديد', text: 'بدء التسجيل في الدورة القرآنية الصيفية المكثفة.' },
    { tag: 'تكريم', text: 'تكريم الطلاب المتميزين يوم الخميس بعد صلاة العصر.' },
    { tag: 'رحلة', text: 'رحلة ترفيهية للطلاب الملتزمين يوم السبت القادم.' }
];

const TOP_BAR_DISMISSED_KEY = 'qmza_top_bar_dismissed';

function getTopBarAds() {
    try {
        const raw = JSON.parse(localStorage.getItem(TOP_BAR_ADS_KEY) || 'null');
        if (Array.isArray(raw) && raw.length) {
            return raw
                .slice(0, TOP_BAR_ADS_MAX)
                .map((ad) => ({
                    tag: String(ad?.tag ?? '').trim().slice(0, TOP_BAR_TAG_MAX) || 'إعلان',
                    text: String(ad?.text ?? '').trim().slice(0, TOP_BAR_TEXT_MAX)
                }))
                .filter((ad) => ad.text);
        }
    } catch { /* ignore */ }
    return DEFAULT_TOP_BAR_ADS.map((ad) => ({ ...ad }));
}

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

    mountMascotToView(viewId);
    updateMascotPose();
    resetMascotPeek();
    setMascotSpeech(null);

    if (viewId === 'register-view') {
        resetRegisterWizard(true);
    }
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
    joinSuccess: 'تم إرسال طلبك بنجاح يا بطل! انتظر موافقة المشرف 🥳🎉',
    emailFocus: 'أدخل بريدك الإلكتروني بشكل صحيح 📧',
    emailMissingAt: 'البريد لازم يحتوي على @!',
    emailBadDomain: 'تأكد من النطاق، مثل example@mail.com',
    emailBadFormat: 'البريد: أحرف إنجليزية وأرقام فقط',
    emailTooShort: 'البريد قصير! 6 خانات على الأقل',
    emailValid: 'تمام! البريد يبدو صحيحاً ✅',
    emailNotFound: 'البريد أو كلمة السر غير صحيحة، أو لم تُقبل طلبك بعد'
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
    'loginNotFound',
    'emailMissingAt',
    'emailBadDomain',
    'emailBadFormat',
    'emailTooShort',
    'emailNotFound'
]);
const MASCOT_SPEECH_SUCCESS_MODES = new Set(['passLower', 'passValid', 'passPeekConfirm', 'joinSuccess', 'emailValid']);

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
    } else if (active?.id === 'guest-login-email' && typeof window.syncMascotGuestEmailSpeech === 'function') {
        window.syncMascotGuestEmailSpeech('guest-login-email');
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
    if (inputId === 'login-pass') return 'login-pass-wrap';
    if (inputId === 'guest-pass') return 'guest-pass-wrap';
    return 'reg-pass-wrap';
}

function getPasswordRulesId(inputId) {
    if (inputId === 'login-pass') return 'rules-login-pass';
    if (inputId === 'guest-pass') return 'rules-guest-pass';
    return 'rules-reg-pass';
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

    const memorization = document.getElementById('reg-memorization')?.value ?? '';
    if (!memorization) { showError('err-reg-memorization', true); ok = false; }
    else { showError('err-reg-memorization', false); }

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

const REG_WIZARD_TOTAL = 5;
const REG_WIZARD_LABELS = ['الاسم', 'العمر', 'الهاتف', 'مستوى الحفظ', 'كلمة السر'];
let regWizardStep = 1;

function validateRegWizardStep(step) {
    if (step === 1) {
        const name = sanitize(document.getElementById('reg-name')?.value ?? '');
        const arabicWords = name.split(/\s+/).filter((w) => /^[\u0600-\u06FF]+$/.test(w));
        const ok = name.length >= 10 && arabicWords.length >= 4;
        showError('err-reg-name', !ok);
        if (!ok) showToast('أدخل اسماً رباعياً كاملاً بالعربية.', 'error');
        return ok;
    }
    if (step === 2) {
        const age = parseInt(document.getElementById('reg-age')?.value ?? '', 10);
        const ok = Number.isFinite(age) && age >= 5 && age <= 25;
        showError('err-reg-age', !ok);
        if (!ok) showToast('أدخل عمراً صحيحاً بين 5 و 25 سنة.', 'error');
        return ok;
    }
    if (step === 3) {
        const phone = sanitize(document.getElementById('reg-phone')?.value.trim() ?? '');
        const intl = isPhoneIntlMode();
        setPhoneErrorMessage(intl);
        const ok = intl
            ? isInternationalPhone(phone, getCountryCodeValue())
            : isYemeniPhone(phone);
        showError('err-reg-phone', !ok);
        if (!ok) {
            showToast(intl ? 'تحقق من رمز الدولة ورقم الهاتف الدولي.' : 'أدخل رقم يمني صحيح: 9 أرقام ويبدأ بـ 7.', 'error');
        }
        return ok;
    }
    if (step === 4) {
        const memorization = document.getElementById('reg-memorization')?.value ?? '';
        const ok = Boolean(memorization);
        showError('err-reg-memorization', !ok);
        if (!ok) showToast('يرجى اختيار مستوى الحفظ.', 'error');
        return ok;
    }
    if (step === 5) {
        const pass = document.getElementById('reg-pass')?.value ?? '';
        const ok = isValidPassword(pass);
        showError('err-reg-pass', !ok);
        updatePasswordRules('reg-pass', !ok);
        if (!ok) showToast('كلمة السر: 8 خانات، أحرف صغيرة إنجليزية وأرقام فقط.', 'error');
        return ok;
    }
    return true;
}

function updateRegWizardProgress(step) {
    const fill = document.getElementById('reg-progress-fill');
    const label = document.getElementById('reg-step-label');
    const pct = Math.round(((step - 1) / REG_WIZARD_TOTAL) * 100);
    if (fill) fill.style.width = `${pct}%`;
    if (label) {
        label.textContent = step <= REG_WIZARD_TOTAL
            ? `الخطوة ${step} من ${REG_WIZARD_TOTAL} — ${REG_WIZARD_LABELS[step - 1]}`
            : 'اكتمل التسجيل بنجاح!';
    }
}

function focusRegWizardStepInput(step) {
    const map = {
        1: '#reg-name',
        2: '#reg-age',
        3: '#reg-phone',
        4: '#reg-memorization',
        5: '#reg-pass'
    };
    const el = document.querySelector(map[step]);
    if (el) setTimeout(() => el.focus(), 80);
}

function showRegWizardStep(step, focusInput = true) {
    regWizardStep = Math.max(1, Math.min(REG_WIZARD_TOTAL, step));
    document.querySelectorAll('.reg-wizard-step').forEach((panel) => {
        const n = Number(panel.dataset.step);
        panel.hidden = n !== regWizardStep;
        panel.classList.toggle('is-active', n === regWizardStep);
    });

    updateRegWizardProgress(regWizardStep);

    const backBtn = document.getElementById('reg-wizard-back');
    const nextBtn = document.getElementById('reg-wizard-next');
    const submitBtn = document.getElementById('register-submit-btn');
    const nav = document.getElementById('reg-wizard-nav');
    backBtn?.toggleAttribute('hidden', regWizardStep === 1);
    nextBtn?.toggleAttribute('hidden', regWizardStep === REG_WIZARD_TOTAL);
    submitBtn?.toggleAttribute('hidden', regWizardStep !== REG_WIZARD_TOTAL);
    nav?.classList.toggle('reg-wizard-nav--single', regWizardStep === 1);

    if (focusInput) focusRegWizardStepInput(regWizardStep);
}

function goRegWizardNext() {
    if (!validateRegWizardStep(regWizardStep)) return;
    if (regWizardStep < REG_WIZARD_TOTAL) showRegWizardStep(regWizardStep + 1);
}

function goRegWizardBack() {
    if (regWizardStep > 1) showRegWizardStep(regWizardStep - 1);
}

function clearRegSuccessBubbles() {
    document.getElementById('reg-success-bubbles')?.replaceChildren();
    document.getElementById('reg-success-confetti')?.replaceChildren();
    document.getElementById('reg-success-sparkles')?.replaceChildren();
}

function spawnRegSuccessBubbles() {
    const container = document.getElementById('reg-success-bubbles');
    if (!container) return;
    for (let i = 0; i < 90; i += 1) {
        const bubble = document.createElement('span');
        bubble.className = 'reg-bubble';
        const size = 6 + Math.random() * 28;
        bubble.style.width = `${size}px`;
        bubble.style.height = `${size}px`;
        bubble.style.left = `${Math.random() * 100}%`;
        bubble.style.animationDuration = `${4 + Math.random() * 4.5}s`;
        bubble.style.animationDelay = `${Math.random() * 4}s`;
        container.appendChild(bubble);
    }
}

function spawnRegSuccessConfetti() {
    const container = document.getElementById('reg-success-confetti');
    if (!container) return;
    const colors = ['#004d5a', '#a7ebd8', '#ffffff', '#6dd4b8', '#ffd166', '#ff6b6b', '#3db89a'];
    for (let i = 0; i < 85; i += 1) {
        const piece = document.createElement('span');
        piece.className = 'reg-confetti-piece';
        const w = 4 + Math.random() * 9;
        const h = 4 + Math.random() * 12;
        piece.style.width = `${w}px`;
        piece.style.height = `${h}px`;
        piece.style.left = `${Math.random() * 100}%`;
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDuration = `${2.5 + Math.random() * 3.5}s`;
        piece.style.animationDelay = `${Math.random() * 3}s`;
        container.appendChild(piece);
    }
}

function spawnRegSuccessSparkles() {
    const container = document.getElementById('reg-success-sparkles');
    if (!container) return;
    const icons = ['✨', '🎉', '🎊', '⭐', '🌟', '💫'];
    for (let i = 0; i < 36; i += 1) {
        const spark = document.createElement('span');
        spark.className = 'reg-sparkle';
        spark.textContent = icons[Math.floor(Math.random() * icons.length)];
        spark.style.left = `${Math.random() * 100}%`;
        spark.style.top = `${Math.random() * 100}%`;
        spark.style.fontSize = `${0.85 + Math.random() * 1.4}rem`;
        spark.style.animationDuration = `${3.5 + Math.random() * 4}s`;
        spark.style.animationDelay = `${Math.random() * 3}s`;
        container.appendChild(spark);
    }
}

function showRegisterSuccessScreen() {
    const form = document.getElementById('register-form');
    form?.classList.add('is-success');
    document.getElementById('reg-wizard-body')?.setAttribute('hidden', '');
    document.getElementById('reg-wizard-nav')?.setAttribute('hidden', '');
    document.getElementById('reg-wizard-progress')?.setAttribute('hidden', '');
    document.body.classList.add('reg-success-open');
    document.getElementById('reg-success-screen')?.removeAttribute('hidden');
    clearRegSuccessBubbles();
    spawnRegSuccessBubbles();
    spawnRegSuccessConfetti();
    spawnRegSuccessSparkles();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetRegisterWizard(focusFirst = true) {
    regWizardStep = 1;
    clearRegSuccessBubbles();
    document.body.classList.remove('reg-success-open');
    document.getElementById('register-form')?.classList.remove('is-success');
    document.getElementById('register-form')?.reset();
    resetPhoneIntlMode();
    resetPasswordField('reg-pass');
    document.getElementById('reg-success-screen')?.setAttribute('hidden', '');
    document.getElementById('reg-wizard-body')?.removeAttribute('hidden');
    document.getElementById('reg-wizard-nav')?.removeAttribute('hidden');
    document.getElementById('reg-wizard-progress')?.removeAttribute('hidden');
    showRegWizardStep(1, focusFirst);
}

function initRegisterWizard() {
    document.getElementById('reg-wizard-next')?.addEventListener('click', goRegWizardNext);
    document.getElementById('reg-wizard-back')?.addEventListener('click', goRegWizardBack);

    document.getElementById('reg-success-done')?.addEventListener('click', () => {
        resetRegisterWizard(false);
        showView('login-view');
    });

    document.querySelectorAll('.reg-wizard-step input, .reg-wizard-step select').forEach((input) => {
        input.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            const step = Number(input.closest('.reg-wizard-step')?.dataset.step);
            if (!step || step >= REG_WIZARD_TOTAL) return;
            e.preventDefault();
            goRegWizardNext();
        });
    });

    showRegWizardStep(1, false);
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

const REQUEST_META_SEP = ' || ';

function buildSubmittedLabelWithMeta(data, date = new Date()) {
    const label = buildSubmittedLabel(date);
    const age = data.age ?? '';
    const memorization = data.memorization ?? '';
    return `${label}${REQUEST_META_SEP}${age}${REQUEST_META_SEP}${memorization}`;
}

const REQUEST_META_CACHE_KEY = 'qmza_request_meta_by_id';

function cacheRequestMeta(id, data) {
    try {
        const map = JSON.parse(localStorage.getItem(REQUEST_META_CACHE_KEY) || '{}');
        map[String(id)] = {
            age: data.age ?? null,
            memorization: data.memorization ?? ''
        };
        localStorage.setItem(REQUEST_META_CACHE_KEY, JSON.stringify(map));
    } catch { /* ignore */ }
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
            age: data.age ?? null,
            memorization: data.memorization ?? '',
            submittedAt: submittedAt.toISOString(),
            submittedLabel
        });
        localStorage.setItem('new_students_requests', JSON.stringify(list));
        return true;
    } catch {
        return false;
    }
}

function isSupabaseMissingColumnError(error) {
    const code = String(error?.code || '');
    const msg = String(error?.message || error?.details || '').toLowerCase();
    return code === 'PGRST204' || msg.includes('column') || msg.includes('schema cache');
}

async function saveNewStudentRequest(data) {
    const now = new Date();
    const displayLabel = buildSubmittedLabel(now);
    const storageLabel = buildSubmittedLabelWithMeta(data, now);

    if (supabaseClient) {
        const basePayload = {
            name: data.name,
            phone: data.phone,
            country_code: data.countryCode,
            password: data.password ?? '',
            submitted_label: storageLabel
        };
        const fullPayload = {
            ...basePayload,
            age: data.age ?? null,
            memorization: data.memorization || null
        };

        let { data: inserted, error } = await supabaseClient
            .from(SUPABASE_TABLE_NEW_REQUESTS)
            .insert(fullPayload)
            .select('id')
            .single();

        if (error && isSupabaseMissingColumnError(error)) {
            ({ data: inserted, error } = await supabaseClient
                .from(SUPABASE_TABLE_NEW_REQUESTS)
                .insert(basePayload)
                .select('id')
                .single());
        }

        if (!error && inserted?.id != null) {
            cacheRequestMeta(inserted.id, data);
            return { ok: true, source: 'supabase' };
        }
        if (error) console.error('Supabase request insert failed:', error);
    }

    const savedLocally = saveNewStudentRequestLocal(data, now, displayLabel);
    return savedLocally
        ? { ok: true, source: 'local' }
        : { ok: false, source: 'none' };
}

/* -----------------------------------------------------------------------
   شريط الإعلانات العلوي المتحرك
   ----------------------------------------------------------------------- */
function buildTopBarMarqueeItems(ads = getTopBarAds()) {
    return ads.map((ad) => `
        <span class="top-bar-marquee-item">
            <span class="top-bar-marquee-badge">${sanitize(ad.tag)}</span>
            <span class="top-bar-marquee-text">${sanitize(ad.text)}</span>
        </span>`).join('<span class="top-bar-marquee-sep" aria-hidden="true">◆</span>');
}

function buildTopBarMarquee(ads = getTopBarAds()) {
    const track = document.getElementById('top-bar-marquee-track');
    const bar = document.getElementById('top-bar');
    if (!track || !bar) return;

    if (!ads.length) {
        bar.remove();
        return;
    }

    const items = buildTopBarMarqueeItems(ads);
    track.innerHTML = `${items}<span class="top-bar-marquee-sep" aria-hidden="true">◆</span>${items}`;
    track.style.setProperty('--top-bar-marquee-duration', `${Math.max(24, ads.length * 10)}s`);
}

function dismissTopBar() {
    const bar = document.getElementById('top-bar');
    if (!bar) return;
    localStorage.setItem(TOP_BAR_DISMISSED_KEY, '1');
    bar.style.transition = 'opacity 0.3s ease, max-height 0.35s ease';
    bar.style.opacity = '0';
    bar.style.maxHeight = `${bar.offsetHeight}px`;
    requestAnimationFrame(() => {
        bar.style.maxHeight = '0';
        bar.style.paddingTop = '0';
        bar.style.paddingBottom = '0';
        bar.style.border = 'none';
    });
    setTimeout(() => bar.remove(), 350);
}

function initTopBar() {
    if (localStorage.getItem(TOP_BAR_DISMISSED_KEY) === '1') {
        document.getElementById('top-bar')?.remove();
        return;
    }
    buildTopBarMarquee();

    window.addEventListener('storage', (e) => {
        if (e.key === TOP_BAR_ADS_KEY) buildTopBarMarquee();
    });
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
    supportAtm: {
        title: 'الدعم عبر الصراف',
        body: `
            <div style="display:flex;flex-direction:column;gap:14px;line-height:1.7;">
                <p style="margin:0;color:var(--text-body);">يمكنك دعم حلقات المجمع عبر التحويل السريع من أي صراف آلي:</p>
                <div style="background:var(--bg-mint);border:1px solid rgba(0,77,90,0.12);border-radius:12px;padding:14px;">
                    <p style="margin:0 0 8px;font-size:0.82rem;color:var(--text-muted);">رقم الحساب</p>
                    <strong style="font-size:1.05rem;color:var(--emerald-700);letter-spacing:0.04em;direction:ltr;display:block;text-align:center;">SA00 0000 0000 0000 0000 0000</strong>
                </div>
                <p style="margin:0;font-size:0.84rem;color:var(--text-muted);">اختر «تحويل / حوالة» ثم أدخل رقم الحساب أعلاه. جزاك الله خيراً.</p>
            </div>`
    },
    supportBank: {
        title: 'الدعم عبر البنك',
        body: `
            <div style="display:flex;flex-direction:column;gap:14px;line-height:1.7;">
                <p style="margin:0;color:var(--text-body);">للدعم عبر التحويل البنكي استخدم البيانات التالية:</p>
                <div style="background:var(--bg-mint);border:1px solid rgba(0,77,90,0.12);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px;">
                    <div>
                        <p style="margin:0 0 4px;font-size:0.82rem;color:var(--text-muted);">اسم البنك</p>
                        <strong style="color:var(--emerald-700);">البنك الأهلي السعودي</strong>
                    </div>
                    <div>
                        <p style="margin:0 0 4px;font-size:0.82rem;color:var(--text-muted);">رقم الآيبان (IBAN)</p>
                        <strong style="font-size:0.95rem;color:var(--emerald-700);letter-spacing:0.03em;direction:ltr;display:block;">SA00 0000 0000 0000 0000 0000</strong>
                    </div>
                    <div>
                        <p style="margin:0 0 4px;font-size:0.82rem;color:var(--text-muted);">اسم المستفيد</p>
                        <strong style="color:var(--emerald-700);">حلقات مجمع الزبير ابن العوام</strong>
                    </div>
                </div>
                <p style="margin:0;font-size:0.84rem;color:var(--text-muted);">بعد التحويل يمكنك إرسال إشعار الدفع عبر الدعم الفني. جزاك الله خيراً.</p>
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

let bannerAdsCache = null;
let bannerOverlayCache = null;

const OVERLAY_COLOR_BASES = {
    white: { r: 255, g: 255, b: 255, maxAlpha: 0.62 },
    black: { r: 0, g: 0, b: 0, maxAlpha: 0.72 },
    salla: { r: 167, g: 235, b: 216, maxAlpha: 0.95 }
};

function getDefaultBannerOverlaySettings() {
    return { blurAmount: 15, overlayHeight: 30, overlayColorTheme: 'white', edgeSmoothness: 20, colorStrength: 70 };
}

function normalizeOverlayColorTheme(theme) {
    if (theme === 'emerald') return 'black';
    if (theme === 'white' || theme === 'black' || theme === 'salla') return theme;
    return 'white';
}

function clampOverlayStrength(value, fallback = 70) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(100, Math.round(n)));
}

const OVERLAY_BLUR_MAX = 25;

function clampOverlayBlur(value, fallback = 15) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(OVERLAY_BLUR_MAX, Math.round(n)));
}

function resolveBannerOverlayColor(theme, colorStrength = 70) {
    const normalized = normalizeOverlayColorTheme(theme);
    const base = OVERLAY_COLOR_BASES[normalized] || OVERLAY_COLOR_BASES.white;
    const factor = clampOverlayStrength(colorStrength, 70) / 100;
    const alpha = (base.maxAlpha * factor).toFixed(3);
    return `rgba(${base.r}, ${base.g}, ${base.b}, ${alpha})`;
}

function mergeBannerOverlaySettings(remote) {
    const defaults = getDefaultBannerOverlaySettings();
    const local = getBannerOverlaySettingsLocal();
    const hasLocal = Boolean(localStorage.getItem(BANNER_OVERLAY_KEY));
    if (!remote) return local;
    return hasLocal ? { ...defaults, ...remote, ...local } : { ...defaults, ...remote };
}

function getBannerOverlaySettingsLocal() {
    try {
        const raw = localStorage.getItem(BANNER_OVERLAY_KEY);
        if (!raw) return getDefaultBannerOverlaySettings();
        return { ...getDefaultBannerOverlaySettings(), ...JSON.parse(raw) };
    } catch {
        return getDefaultBannerOverlaySettings();
    }
}

function getBannerOverlaySettings() {
    if (bannerOverlayCache) {
        return { ...getDefaultBannerOverlaySettings(), ...bannerOverlayCache };
    }
    return getBannerOverlaySettingsLocal();
}

function saveBannerOverlaySettingsLocal(settings) {
    localStorage.setItem(BANNER_OVERLAY_KEY, JSON.stringify(settings));
    bannerOverlayCache = settings;
}

function applyBannerOverlaySettings(settings = getBannerOverlaySettings()) {
    const wrap = document.getElementById('hero-banner-wrap');
    if (!wrap) return;
    const theme = normalizeOverlayColorTheme(settings.overlayColorTheme);
    const strength = clampOverlayStrength(settings.colorStrength, 70);
    wrap.style.setProperty('--blur-amount', `${clampOverlayBlur(settings.blurAmount)}px`);
    wrap.style.setProperty('--overlay-height', `${settings.overlayHeight}%`);
    wrap.style.setProperty('--overlay-color', resolveBannerOverlayColor(theme, strength));
    wrap.style.setProperty('--overlay-color-strength', String(strength));
    wrap.style.setProperty('--edge-smoothness', `${settings.edgeSmoothness}%`);
    wrap.dataset.overlayTheme = theme;
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

function getBannerAdsLocal() {
    try {
        const raw = localStorage.getItem(BANNER_ADS_KEY);
        if (!raw) return null;
        const list = JSON.parse(raw);
        return Array.isArray(list) ? list : null;
    } catch {
        return null;
    }
}

function saveBannerAdsLocal(list) {
    localStorage.setItem(BANNER_ADS_KEY, JSON.stringify(list));
    bannerAdsCache = list;
}

function withNetworkTimeout(promise, ms = 4500) {
    return Promise.race([
        promise,
        new Promise((resolve) => setTimeout(() => resolve(undefined), ms))
    ]);
}

async function loadBannerAdsFromStore() {
    if (window.BannerStore?.isEnabled) {
        const fromDb = await window.BannerStore.fetchBannerAds();
        if (fromDb !== null) {
            if (fromDb.length) {
                saveBannerAdsLocal(fromDb);
                return fromDb;
            }
            const local = getBannerAdsLocal();
            const toSave = local?.length ? local : getDefaultBannerAds();
            saveBannerAdsLocal(toSave);
            void window.BannerStore.replaceBannerAds(toSave);
            return toSave;
        }
    }

    const local = getBannerAdsLocal();
    if (local?.length) {
        bannerAdsCache = local;
        return local;
    }

    const defaults = getDefaultBannerAds();
    saveBannerAdsLocal(defaults);
    return defaults;
}

async function loadBannerOverlayFromStore() {
    const local = getBannerOverlaySettingsLocal();
    const hasLocal = Boolean(localStorage.getItem(BANNER_OVERLAY_KEY));

    if (window.BannerStore?.isEnabled) {
        const fromDb = await window.BannerStore.fetchBannerOverlaySettings();
        if (fromDb) {
            const merged = mergeBannerOverlaySettings(fromDb);
            if (!hasLocal) saveBannerOverlaySettingsLocal(merged);
            return merged;
        }
    }

    return local;
}

function ensureBannerAdsStore() {
    if (bannerAdsCache?.length) return bannerAdsCache;
    const local = getBannerAdsLocal();
    if (local?.length) {
        bannerAdsCache = local;
        return local;
    }
    const defaults = getDefaultBannerAds();
    bannerAdsCache = defaults;
    return defaults;
}

function getVisibleBannerAds() {
    return ensureBannerAdsStore()
        .filter((ad) => ad.archived !== true && ad.active !== false)
        .sort((a, b) => {
            const ao = Number.isFinite(a.sortOrder) ? a.sortOrder : Number.MAX_SAFE_INTEGER;
            const bo = Number.isFinite(b.sortOrder) ? b.sortOrder : Number.MAX_SAFE_INTEGER;
            if (ao !== bo) return ao - bo;
            return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
        });
}

function escapeBannerHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

let heroBannerFirstImageUrl = '';

function setHeroBannerState(state) {
    const wrap = document.getElementById('hero-banner-wrap');
    if (!wrap) return;
    wrap.classList.remove('is-loading', 'is-ready', 'is-empty');
    if (state) wrap.classList.add(state);
    wrap.setAttribute('aria-busy', state === 'is-loading' ? 'true' : 'false');
    if (state === 'is-empty') {
        wrap.setAttribute('hidden', '');
    } else {
        wrap.removeAttribute('hidden');
    }
}

function waitForHeroFirstImage(timeoutMs = 10000) {
    return new Promise((resolve) => {
        const img = document.querySelector('#hero-slider-track .hero-slide-media');
        if (!img) {
            resolve();
            return;
        }
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            resolve();
        };
        if (img.complete && img.naturalWidth > 0) {
            finish();
            return;
        }
        img.addEventListener('load', finish, { once: true });
        img.addEventListener('error', finish, { once: true });
        setTimeout(finish, timeoutMs);
    });
}

async function revealHeroBannerWhenReady() {
    const ads = getVisibleBannerAds();
    if (!ads.length) {
        setHeroBannerState('is-empty');
        heroBannerFirstImageUrl = '';
        return;
    }

    const firstUrl = String(ads[0]?.image || '');
    const wrap = document.getElementById('hero-banner-wrap');
    if (wrap?.classList.contains('is-ready') && heroBannerFirstImageUrl === firstUrl) {
        return;
    }

    setHeroBannerState('is-loading');
    await waitForHeroFirstImage();
    heroBannerFirstImageUrl = firstUrl;
    setHeroBannerState('is-ready');
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
        setHeroBannerState('is-empty');
        track.innerHTML = '';
        dots.innerHTML = '';
        return;
    }

    if (heroSliderState.index >= heroSliderState.ads.length) {
        heroSliderState.index = 0;
    }

    heroSliderState.ads.slice(0, 2).forEach((ad) => {
        if (!ad?.image) return;
        const img = new Image();
        img.src = ad.image;
    });

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
    void revealHeroBannerWhenReady();
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

let heroSliderEventsBound = false;

function bindHeroSliderEvents() {
    if (heroSliderEventsBound) return;
    heroSliderEventsBound = true;

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

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        void refreshBannerFromRemote();
    });
}

async function refreshBannerFromRemote() {
    const before = JSON.stringify(getVisibleBannerAds());
    const overlayBefore = JSON.stringify(getBannerOverlaySettings());

    const [ads, overlay] = await Promise.all([
        withNetworkTimeout(loadBannerAdsFromStore()),
        withNetworkTimeout(loadBannerOverlayFromStore())
    ]);

    if (ads === undefined && overlay === undefined) return;

    const after = JSON.stringify(getVisibleBannerAds());
    const overlayAfter = JSON.stringify(getBannerOverlaySettings());

    if (before !== after || overlayBefore !== overlayAfter) {
        applyBannerOverlaySettings();
        renderHeroSlider();
    }
}

/* -----------------------------------------------------------------------
   إنجازات التحفيظ — منصة التتويج
   ----------------------------------------------------------------------- */
const TAHFEEZ_SHOWCASE_KEY = 'qmza_tahfeez_showcase';

const DEFAULT_TAHFEEZ_SHOWCASE = {
    lastYearMemorization: {
        name: 'عبدالله محمد العتيبي',
        halaqa: 'حلقة الفجر',
        detail: 'أكمل حفظ ١٢ جزءاً خلال العام',
        image: 'assets/tahfeez/tahfeez-champion-memorization.png'
    },
    lastYearAttendance: {
        name: 'سعود فيصل الدوسري',
        halaqa: 'حلقة العصر',
        detail: '٩٨٪ حضور واجتهاد في التسميع',
        image: 'assets/tahfeez/tahfeez-champion-attendance.png'
    },
    monthlyPodium: [
        {
            rank: 2,
            name: 'يوسف أحمد الغامدي',
            halaqa: 'حلقة الضحى',
            detail: 'حفظ ٨ أجزاء جديدة',
            image: 'assets/tahfeez/tahfeez-podium-second.png'
        },
        {
            rank: 1,
            name: 'محمد سالم القحطاني',
            halaqa: 'حلقة الفجر',
            detail: 'حفظ ١٠ أجزاء — الأعلى هذا الشهر',
            image: 'assets/tahfeez/tahfeez-podium-first.png'
        },
        {
            rank: 3,
            name: 'فهد عبدالرحمن الشهراني',
            halaqa: 'حلقة المغرب',
            detail: 'حفظ ٦ أجزاء بتميز',
            image: 'assets/tahfeez/tahfeez-podium-third.png'
        }
    ],
    idealStudent: {
        name: 'عمر خالد الحربي',
        halaqa: 'حلقة الفجر',
        detail: 'حلقة الفجر — مثال في الأخلاق والحضور',
        quote: 'يجمع بين حسن التسميع والالتزام — قدوة لزملائه في الحلقة.',
        image: 'assets/tahfeez/tahfeez-ideal-student.png'
    }
};

function getTahfeezShowcaseConfig() {
    try {
        const raw = JSON.parse(localStorage.getItem(TAHFEEZ_SHOWCASE_KEY) || 'null');
        if (raw && typeof raw === 'object') {
            return {
                ...DEFAULT_TAHFEEZ_SHOWCASE,
                ...raw,
                lastYearMemorization: { ...DEFAULT_TAHFEEZ_SHOWCASE.lastYearMemorization, ...raw.lastYearMemorization },
                lastYearAttendance: { ...DEFAULT_TAHFEEZ_SHOWCASE.lastYearAttendance, ...raw.lastYearAttendance },
                idealStudent: { ...DEFAULT_TAHFEEZ_SHOWCASE.idealStudent, ...raw.idealStudent },
                monthlyPodium: Array.isArray(raw.monthlyPodium) && raw.monthlyPodium.length === 3
                    ? raw.monthlyPodium
                    : DEFAULT_TAHFEEZ_SHOWCASE.monthlyPodium
            };
        }
    } catch { /* ignore */ }
    return {
        ...DEFAULT_TAHFEEZ_SHOWCASE,
        monthlyPodium: DEFAULT_TAHFEEZ_SHOWCASE.monthlyPodium.map((item) => ({ ...item }))
    };
}

function escapeTahfeezHtml(str) {
    return escapeBannerHtml(str);
}

function renderTahfeezChampionCard(prefix, data) {
    const photo = document.getElementById(`${prefix}-photo`);
    const name = document.getElementById(`${prefix}-name`);
    const meta = document.getElementById(`${prefix}-meta`);
    if (!data) return;

    if (photo) {
        photo.src = data.image || '';
        photo.alt = data.name ? `صورة ${data.name}` : 'صورة الطالب';
    }
    if (name) name.textContent = data.name || '—';
    if (meta) {
        const parts = [data.halaqa, data.detail].filter(Boolean);
        meta.textContent = parts.join(' · ') || '—';
    }
}

function renderTahfeezPodium(podium = []) {
    const wrap = document.getElementById('tahfeez-podium');
    if (!wrap) return;

    const ordered = [2, 1, 3].map((rank) => (
        podium.find((item) => Number(item.rank) === rank)
        || DEFAULT_TAHFEEZ_SHOWCASE.monthlyPodium.find((item) => item.rank === rank)
    )).filter(Boolean);

    const rankLabels = { 1: 'الأول', 2: 'الثاني', 3: 'الثالث' };

    wrap.innerHTML = ordered.map((item) => {
        const rank = Number(item.rank) || 1;
        return `
            <article class="tahfeez-podium-slot tahfeez-podium-slot--${rank}" role="listitem">
                <div class="tahfeez-podium-photo-wrap">
                    <img class="tahfeez-podium-photo" src="${escapeTahfeezHtml(item.image)}" alt="${escapeTahfeezHtml(item.name || 'طالب')}">
                    <span class="tahfeez-podium-rank">${rank}</span>
                </div>
                <p class="tahfeez-podium-name">${escapeTahfeezHtml(item.name)}</p>
                <p class="tahfeez-podium-meta">${escapeTahfeezHtml([item.halaqa, item.detail].filter(Boolean).join(' · '))}</p>
                <div class="tahfeez-podium-stand">${rankLabels[rank] || rank}</div>
            </article>
        `;
    }).join('');
}

function renderTahfeezIdealStudent(data) {
    if (!data) return;
    const photo = document.getElementById('tahfeez-ideal-photo');
    const name = document.getElementById('tahfeez-ideal-name');
    const meta = document.getElementById('tahfeez-ideal-meta');
    const quote = document.getElementById('tahfeez-ideal-quote');

    if (photo) {
        photo.src = data.image || '';
        photo.alt = data.name ? `الطالب المثالي — ${data.name}` : 'الطالب المثالي';
    }
    if (name) name.textContent = data.name || '—';
    if (meta) meta.textContent = data.detail || data.halaqa || '—';
    if (quote) quote.textContent = data.quote ? `«${data.quote}»` : '';
}

function renderTahfeezShowcase() {
    const cfg = getTahfeezShowcaseConfig();
    renderTahfeezChampionCard('tahfeez-mem', cfg.lastYearMemorization);
    renderTahfeezChampionCard('tahfeez-att', cfg.lastYearAttendance);
    renderTahfeezPodium(cfg.monthlyPodium);
    renderTahfeezIdealStudent(cfg.idealStudent);
}

function initTahfeezShowcase() {
    renderTahfeezShowcase();
    window.addEventListener('storage', (e) => {
        if (e.key === TAHFEEZ_SHOWCASE_KEY) renderTahfeezShowcase();
    });
}

/* -----------------------------------------------------------------------
   إحصائيات المجمع العامة — عداد فخم
   ----------------------------------------------------------------------- */
const PUBLIC_STATS_KEY = 'qmza_public_stats';
const HALAQA_STAT_KEYS = ['fajr', 'duha', 'asr', 'maghrib'];

const DEFAULT_PUBLIC_STATS = {
    hafizThisYear: 12,
    hafizTenYears: 94,
    youngestHafizAge: 9,
    manualStudents: 168,
    manualHalaqat: 4
};

function getPublicStatsConfig() {
    try {
        const raw = JSON.parse(localStorage.getItem(PUBLIC_STATS_KEY) || 'null');
        if (raw && typeof raw === 'object') {
            return { ...DEFAULT_PUBLIC_STATS, ...raw };
        }
    } catch { /* ignore */ }
    return { ...DEFAULT_PUBLIC_STATS };
}

function normalizeHalaqaStatKey(halaqa) {
    const raw = String(halaqa || '').trim();
    if (!raw) return '';
    if (HALAQA_STAT_KEYS.includes(raw)) return raw;
    const labels = {
        fajr: 'حلقة الفجر',
        duha: 'حلقة الضحى',
        asr: 'حلقة العصر',
        maghrib: 'حلقة المغرب'
    };
    const byLabel = HALAQA_STAT_KEYS.find((key) => labels[key] === raw);
    if (byLabel) return byLabel;
    const short = raw.replace(/^حلقة\s+/u, '');
    return HALAQA_STAT_KEYS.find((key) => labels[key].includes(short)) || '';
}

function isFullMemorizer(student) {
    const mem = String(student?.memorization || student?.level || '').trim();
    return mem === 'full' || mem === 'حافظ للقرآن كاملاً';
}

function computePublicStats() {
    const cfg = getPublicStatsConfig();
    const students = getApprovedStudents();
    const studentCount = students.length || cfg.manualStudents;

    const activeHalaqat = new Set(
        students.map((st) => normalizeHalaqaStatKey(st.halaqa)).filter(Boolean)
    );
    const halaqatCount = activeHalaqat.size || cfg.manualHalaqat;

    const hafizStudents = students.filter(isFullMemorizer);
    const ages = hafizStudents
        .map((st) => Number(st.age))
        .filter((age) => Number.isFinite(age) && age > 0);
    const youngestAge = ages.length ? Math.min(...ages) : cfg.youngestHafizAge;

    return {
        hafizThisYear: Number(cfg.hafizThisYear) || DEFAULT_PUBLIC_STATS.hafizThisYear,
        hafizTenYears: Number(cfg.hafizTenYears) || DEFAULT_PUBLIC_STATS.hafizTenYears,
        youngestHafizAge: youngestAge,
        students: studentCount,
        halaqat: halaqatCount
    };
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function animateStatCounter(el, target, duration = 1400) {
    if (!el) return;
    const safeTarget = Math.max(0, Math.round(Number(target) || 0));
    el.dataset.statValue = String(safeTarget);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.textContent = String(safeTarget);
        return;
    }

    const start = performance.now();
    const from = 0;

    const tick = (now) => {
        const progress = Math.min(1, (now - start) / duration);
        const value = Math.round(from + (safeTarget - from) * easeOutCubic(progress));
        el.textContent = String(value);
        if (progress < 1) requestAnimationFrame(tick);
    };

    el.textContent = '0';
    requestAnimationFrame(tick);
}

function renderPublicStats() {
    const stats = computePublicStats();
    const section = document.getElementById('majma-stats');
    if (!section) return;

    animateStatCounter(document.getElementById('stat-hafiz-year'), stats.hafizThisYear);
    animateStatCounter(document.getElementById('stat-hafiz-decade'), stats.hafizTenYears);
    animateStatCounter(document.getElementById('stat-youngest-age'), stats.youngestHafizAge);
    animateStatCounter(document.getElementById('stat-students'), stats.students);
    animateStatCounter(document.getElementById('stat-halaqat'), stats.halaqat);

    const unitEl = document.getElementById('stat-youngest-unit');
    if (unitEl) {
        unitEl.textContent = stats.youngestHafizAge === 1 ? 'سنة' : 'سنوات';
    }

    section.classList.add('is-visible');
}

let publicStatsObserverStarted = false;

function initPublicStats() {
    const section = document.getElementById('majma-stats');
    if (!section || publicStatsObserverStarted) return;
    publicStatsObserverStarted = true;

    const run = () => renderPublicStats();

    if (!('IntersectionObserver' in window)) {
        run();
        return;
    }

    let played = false;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting || played) return;
            played = true;
            run();
            observer.disconnect();
        });
    }, { threshold: 0.25 });

    observer.observe(section);

    window.addEventListener('storage', (e) => {
        if (e.key === PUBLIC_STATS_KEY || APPROVED_STUDENTS_KEYS.includes(e.key)) {
            renderPublicStats();
        }
    });
}

function initHeroSlider() {
    setHeroBannerState('is-loading');
    applyBannerOverlaySettings();
    renderHeroSlider();
    bindHeroSliderEvents();
    void refreshBannerFromRemote();
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
    initTahfeezShowcase();
    initPublicStats();
    initTopBar();

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

    document.getElementById('top-bar-close-btn')?.addEventListener('click', dismissTopBar);

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
    document.getElementById('login-alt-join-student')?.addEventListener('click', () => showView('register-view'));
    document.getElementById('register-back-login')?.addEventListener('click', () => showView('login-view'));

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

    // نموذج طلب الانضمام (متعدد الخطوات)
    initRegisterWizard();

    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (regWizardStep !== REG_WIZARD_TOTAL) {
            goRegWizardNext();
            return;
        }
        if (!validateRegWizardStep(5) || !validateRegisterForm()) {
            return;
        }

        const submitBtn = document.getElementById('register-submit-btn');
        submitBtn?.setAttribute('disabled', 'disabled');
        try {
            const result = await saveNewStudentRequest({
                name: sanitize(document.getElementById('reg-name')?.value ?? ''),
                age: parseInt(document.getElementById('reg-age')?.value ?? '', 10),
                memorization: document.getElementById('reg-memorization')?.value ?? '',
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
            showRegisterSuccessScreen();
        } finally {
            submitBtn?.removeAttribute('disabled');
        }
    });

    document.getElementById('info-modal-close')?.addEventListener('click', () => closeModal('info-modal-overlay'));

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
    document.getElementById('footer-support-atm')?.addEventListener('click',  (e) => { e.preventDefault(); openInfoModal('supportAtm'); });
    document.getElementById('footer-support-bank')?.addEventListener('click', (e) => { e.preventDefault(); openInfoModal('supportBank'); });

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
