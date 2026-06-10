/* =====================================================================
   dashboard-login.js — بوابة دخول لوحة التحكم (معزولة عن index.html)
   UTF-8
   ===================================================================== */

(function () {
    'use strict';

    if (!document.getElementById('dashboard-login-page')) return;

    const AUTH_STUDENT_CODE = '12345';
    const AUTH_PASSWORD = '1234567a';
    const SESSION_KEY = 'qmza_session';
    const TEACHERS_KEY = 'teacher_accounts';
    const DEFAULT_TEACHERS = [
        {
            id: 'teacher_default_1',
            code: '202600',
            password: 'teacher123a',
            name: 'مدرس حلقة الفجر',
            halaqat: ['fajr', 'asr']
        }
    ];
    const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[0-9])[a-z0-9]{8,}$/;

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

    function showToast(msg, type = 'default') {
        const toast = document.getElementById('dash-toast');
        if (!toast) return;
        toast.textContent = sanitize(msg);
        toast.className = `toast ${type} show`;
        clearTimeout(showToast._timer);
        showToast._timer = setTimeout(() => toast.classList.remove('show'), 3800);
    }

    function showError(id, show = true) {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = show ? 'flex' : 'none';
    }

    function getSession() {
        try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; }
        catch { return null; }
    }

    function saveSession(data) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    }

    function createAuthToken() {
        return `qmza_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    function checkLoginCredentials(code, password) {
        return code === AUTH_STUDENT_CODE && password === AUTH_PASSWORD;
    }

    function getTeacherAccounts() {
        try {
            const list = JSON.parse(localStorage.getItem(TEACHERS_KEY) || '[]');
            if (Array.isArray(list) && list.length) return list;
        } catch { /* ignore parse errors */ }
        localStorage.setItem(TEACHERS_KEY, JSON.stringify(DEFAULT_TEACHERS));
        return DEFAULT_TEACHERS;
    }

    function findTeacherAccount(code, password) {
        return getTeacherAccounts().find((teacher) => (
            String(teacher.code) === String(code) &&
            String(teacher.password) === String(password)
        )) || null;
    }

    function isValidPassword(pass) {
        return PASSWORD_REGEX.test(pass ?? '');
    }

    function sanitizePasswordChars(raw) {
        return String(raw ?? '').replace(/[^a-z0-9]/g, '');
    }

    function triggerFieldShake(wrapId) {
        const wrap = document.getElementById(wrapId);
        if (!wrap) return;
        wrap.classList.remove('is-shaking');
        void wrap.offsetWidth;
        wrap.classList.add('is-shaking');
        wrap.addEventListener('animationend', () => wrap.classList.remove('is-shaking'), { once: true });
    }

    function triggerInputReject(input, wrapId) {
        if (input) {
            input.classList.remove('is-rejected');
            void input.offsetWidth;
            input.classList.add('is-rejected');
        }
        triggerFieldShake(wrapId);
    }

    function clearLoginAuthFailure() {
        document.getElementById('dash-auth-card')?.classList.remove('is-login-failed');
        document.getElementById('dash-login-id')?.classList.remove('is-rejected');
        document.getElementById('dash-login-pass')?.classList.remove('is-rejected');
    }

    function triggerLoginFailed() {
        const loginId = document.getElementById('dash-login-id');
        const loginPass = document.getElementById('dash-login-pass');
        const authCard = document.getElementById('dash-auth-card');

        authCard?.classList.add('is-login-failed');
        triggerInputReject(loginId, 'dash-login-id-wrap');
        triggerInputReject(loginPass, 'dash-login-pass-wrap');

        if (authCard) {
            authCard.classList.remove('is-shaking-strong');
            void authCard.offsetWidth;
            authCard.classList.add('is-shaking-strong');
            authCard.addEventListener('animationend', () => authCard.classList.remove('is-shaking-strong'), { once: true });
        }

        showToast('أفـا يا بطل! الكود أو كلمة السر غلط، تأكد منها ولا تحاول تخترقنا! 🕵️‍♂️⚡', 'error');
    }

    function bindDigitsOnlyInput(input, wrapId) {
        if (!input) return;

        const apply = (raw) => {
            const hadInvalid = /[^\d]/.test(String(raw ?? ''));
            const digits = String(raw ?? '').replace(/\D/g, '').slice(0, 10);
            if (input.value !== digits) input.value = digits;
            if (hadInvalid) triggerInputReject(input, wrapId);
            clearLoginAuthFailure();
        };

        input.addEventListener('beforeinput', (e) => {
            if (e.data && /[^\d]/.test(e.data)) {
                e.preventDefault();
                triggerInputReject(input, wrapId);
            }
        });
        input.addEventListener('input', () => apply(input.value));
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            apply(e.clipboardData?.getData('text') ?? '');
        });
    }

    function initPasswordField() {
        const input = document.getElementById('dash-login-pass');
        const btn = document.getElementById('dash-login-pass-toggle');
        if (!input || !btn) return;

        btn.addEventListener('click', () => {
            const visible = input.type === 'password';
            input.type = visible ? 'text' : 'password';
            btn.classList.toggle('is-visible', visible);
            btn.setAttribute('aria-pressed', visible ? 'true' : 'false');
            btn.setAttribute('aria-label', visible ? 'إخفاء كلمة السر' : 'إظهار كلمة السر');
        });

        input.addEventListener('beforeinput', (e) => {
            if (e.isComposing) return;
            if (!e.data) return;
            if (/[A-Z]/.test(e.data)) {
                e.preventDefault();
                triggerFieldShake('dash-login-pass-wrap');
                return;
            }
            if (/[^a-z0-9]/.test(e.data)) {
                e.preventDefault();
                triggerFieldShake('dash-login-pass-wrap');
            }
        });

        input.addEventListener('input', () => {
            clearLoginAuthFailure();
            const raw = input.value;
            if (/[A-Z]/.test(raw)) {
                input.value = raw.replace(/[A-Z]/g, '');
                triggerFieldShake('dash-login-pass-wrap');
                return;
            }
            const cleaned = sanitizePasswordChars(raw);
            if (raw !== cleaned) {
                input.value = cleaned;
                triggerFieldShake('dash-login-pass-wrap');
            }
        });
    }

    function validateLoginForm() {
        const id = document.getElementById('dash-login-id')?.value.trim() ?? '';
        const pass = document.getElementById('dash-login-pass')?.value ?? '';
        let ok = true;

        const codeOk = /^\d{4,10}$/.test(sanitize(id));
        showError('err-dash-login-id', !codeOk);
        if (!codeOk) ok = false;

        const passOk = isValidPassword(pass);
        showError('err-dash-login-pass', !passOk);
        if (!passOk) ok = false;

        return ok;
    }

    function redirectIfAlreadyAuthed() {
        const session = getSession();
        if (session?.loggedIn && session?.authToken) {
            window.location.replace(session.role === 'teacher' ? 'teacher-dashboard.html' : 'dashboard.html');
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        redirectIfAlreadyAuthed();

        if (localStorage.getItem('qmza_dark') === '1') {
            document.getElementById('dashboard-login-page')?.classList.add('dark');
        }

        bindDigitsOnlyInput(document.getElementById('dash-login-id'), 'dash-login-id-wrap');
        initPasswordField();

        document.getElementById('dash-login-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!validateLoginForm()) {
                showToast('تحقق من البيانات المدخلة.', 'error');
                return;
            }

            const identifier = sanitize(document.getElementById('dash-login-id')?.value ?? '');
            const password = document.getElementById('dash-login-pass')?.value ?? '';

            const teacher = findTeacherAccount(identifier, password);
            if (!checkLoginCredentials(identifier, password) && !teacher) {
                triggerLoginFailed();
                return;
            }

            const session = getSession() || {};
            session.loggedIn = true;
            session.authToken = createAuthToken();
            session.studentCode = identifier;
            if (teacher) {
                session.role = 'teacher';
                session.teacherId = teacher.id;
                session.name = teacher.name || `مدرس ${identifier}`;
                session.halaqat = Array.isArray(teacher.halaqat) ? teacher.halaqat : [];
            } else {
                session.role = 'admin';
                session.teacherId = '';
                session.name = `مشرف ${identifier}`;
                session.halaqat = [];
            }
            saveSession(session);

            showToast('تم التحقق! جاري فتح لوحة التحكم...', 'success');
            setTimeout(() => {
                window.location.href = teacher ? 'teacher-dashboard.html' : 'dashboard.html';
            }, 1200);
        });
    });
})();
