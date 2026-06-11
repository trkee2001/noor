/* انضمام كضيف / ولي أمر — الصفحة الرئيسية */
(function () {
    const GUEST_REQUESTS_KEY = 'guest_join_requests';
    const APPROVED_GUESTS_KEY = 'dash_approved_guests';
    const CURRENT_GUEST_KEY = 'current_logged_in_guest';
    const GUEST_WIZARD_TOTAL = 4;
    const GUEST_WIZARD_LABELS = ['الاسم', 'البريد', 'الابن', 'كلمة السر'];
    let guestWizardStep = 1;
    let loginMode = 'student';

    function normalizeGuestEmail(raw) {
        return String(raw ?? '').trim().toLowerCase();
    }

    function stripInvalidGuestEmailChars(raw) {
        return String(raw ?? '')
            .replace(/\s/g, '')
            .replace(/[^a-z0-9@._+-]/gi, '')
            .toLowerCase();
    }

    function sanitizeGuestEmailInput(raw) {
        return stripInvalidGuestEmailChars(raw);
    }

    function guestEmailHasRejectedChars(raw) {
        return /[^\sa-z0-9@._+-]/i.test(String(raw ?? ''));
    }

    function getGuestEmailValidation(email) {
        const e = normalizeGuestEmail(email);
        const parts = e.split('@');
        const localPart = parts[0] || '';
        const domainPart = parts.slice(1).join('@') || '';
        return {
            hasAt: e.includes('@') && parts.length === 2,
            hasLocal: localPart.length >= 1,
            hasDomain: /^[^\s@]+\.[^\s@]{2,}$/.test(e),
            validChars: e.length === 0 || /^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e),
            minLength: e.length >= 6
        };
    }

    function isValidGuestEmail(email) {
        const v = getGuestEmailValidation(email);
        return v.hasAt && v.hasLocal && v.hasDomain && v.validChars && v.minLength;
    }

    function getGuestEmailErrorId(inputId) {
        return inputId === 'guest-email' ? 'err-guest-email' : 'err-guest-login-email';
    }

    function getGuestEmailWrapId(inputId) {
        return inputId === 'guest-email' ? 'guest-email-wrap' : 'guest-login-email-wrap';
    }

    function detectGuestEmailMascotMode(email) {
        const v = getGuestEmailValidation(email);
        if (!email.length) return 'emailFocus';
        if (isValidGuestEmail(email)) return 'emailValid';
        if (!v.hasAt) return 'emailMissingAt';
        if (!v.minLength) return 'emailTooShort';
        if (!v.validChars) return 'emailBadFormat';
        if (!v.hasDomain) return 'emailBadDomain';
        return 'emailFocus';
    }

    function getGuestEmailErrorMessage(email) {
        const mode = detectGuestEmailMascotMode(email);
        if (typeof MASCOT_SPEECH !== 'undefined' && MASCOT_SPEECH[mode]) {
            return MASCOT_SPEECH[mode];
        }
        return 'أدخل بريداً إلكترونياً صحيحاً.';
    }

    function showGuestEmailMascotMessage(email, { autoHideMs = 4500 } = {}) {
        const mode = detectGuestEmailMascotMode(email);
        if (typeof showMascotMessage === 'function') {
            showMascotMessage(mode, { autoHideMs });
        } else if (typeof setMascotSpeech === 'function') {
            setMascotSpeech(mode);
        }
    }

    function syncMascotGuestEmailSpeech(inputId) {
        if (inputId === 'guest-login-email' && loginMode !== 'guest') return;
        const input = document.getElementById(inputId);
        if (!input || document.activeElement?.id !== inputId) return;

        const email = input.value ?? '';
        const mode = detectGuestEmailMascotMode(email);
        if (inputId === 'guest-login-email' && typeof setMascotSpeech === 'function') {
            if (email.length === 0) {
                setMascotSpeech('emailFocus');
            } else {
                setMascotSpeech(mode);
            }
        }
    }

    window.syncMascotGuestEmailSpeech = syncMascotGuestEmailSpeech;

    function updateGuestEmailValidation(inputId, onBlur = false) {
        const input = document.getElementById(inputId);
        const errorId = getGuestEmailErrorId(inputId);
        const email = input?.value ?? '';

        if (isValidGuestEmail(email)) {
            showError(errorId, false);
            return;
        }

        if (onBlur && email.length > 0) {
            showError(errorId, true);
            if (inputId === 'guest-login-email') {
                showGuestEmailMascotMessage(email);
            }
        } else {
            showError(errorId, false);
        }
    }

    function bindGuestEmailInput(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;
        const wrapId = getGuestEmailWrapId(inputId);

        const rejectInvalid = (rejectedRaw = '') => {
            triggerInputReject(input, wrapId, rejectedRaw);
            if (inputId === 'guest-login-email') {
                showGuestEmailMascotMessage(input.value || rejectedRaw);
            }
        };

        const applyValue = (raw) => {
            const rawStr = String(raw ?? '');
            const cleaned = stripInvalidGuestEmailChars(rawStr);
            if (input.value !== cleaned) input.value = cleaned;
            if (guestEmailHasRejectedChars(rawStr)) rejectInvalid(rawStr);
            updateGuestEmailValidation(inputId, false);
            syncMascotGuestEmailSpeech(inputId);
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
            if (e.data && guestEmailHasRejectedChars(e.data)) {
                e.preventDefault();
                rejectInvalid(e.data);
            }
        });

        input.addEventListener('input', () => applyValue(input.value));

        input.addEventListener('paste', (e) => {
            e.preventDefault();
            applyValue((input.value ?? '') + (e.clipboardData?.getData('text') ?? ''));
        });

        input.addEventListener('focus', () => {
            if (inputId === 'guest-login-email') syncMascotGuestEmailSpeech(inputId);
        });
        input.addEventListener('blur', () => updateGuestEmailValidation(inputId, true));
    }

    function normalizePhoneDigits(raw) {
        return String(raw ?? '').replace(/\D/g, '');
    }

    function phonesMatch(a, b) {
        const da = normalizePhoneDigits(a);
        const db = normalizePhoneDigits(b);
        if (!da || !db) return false;
        if (da === db) return true;
        if (da.length >= 9 && db.endsWith(da.slice(-9))) return true;
        if (db.length >= 9 && da.endsWith(db.slice(-9))) return true;
        return false;
    }

    function emailsMatch(a, b) {
        const ea = normalizeGuestEmail(a);
        const eb = normalizeGuestEmail(b);
        return Boolean(ea && eb && ea === eb);
    }

    function getGuestStoredLoginId(guest) {
        return guest.email || guest.phone || '';
    }

    function saveNewGuestRequest(data) {
        try {
            const list = JSON.parse(localStorage.getItem(GUEST_REQUESTS_KEY) || '[]');
            const now = new Date();
            list.unshift({
                id: `guest_req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                name: data.name,
                email: normalizeGuestEmail(data.email),
                childName: data.childName,
                password: data.password,
                submittedAt: now.toISOString(),
                submittedLabel: now.toLocaleString('ar-SA', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                })
            });
            localStorage.setItem(GUEST_REQUESTS_KEY, JSON.stringify(list));
            return { ok: true };
        } catch {
            return { ok: false };
        }
    }

    function getApprovedGuestsLocal() {
        try {
            return JSON.parse(localStorage.getItem(APPROVED_GUESTS_KEY) || '[]');
        } catch {
            return [];
        }
    }

    function findApprovedGuest(emailOrLegacy, password) {
        const pass = String(password ?? '').trim();
        if (!pass) return null;
        const loginId = normalizeGuestEmail(emailOrLegacy) || String(emailOrLegacy ?? '').trim();
        return getApprovedGuestsLocal().find((g) => {
            const stored = getGuestStoredLoginId(g);
            const emailOk = emailsMatch(stored, loginId);
            const phoneOk = !emailOk && phonesMatch(stored, emailOrLegacy);
            return (emailOk || phoneOk) && String(g.password ?? '').trim() === pass;
        }) || null;
    }

    function saveCurrentLoggedInGuest(guest) {
        localStorage.setItem(CURRENT_GUEST_KEY, JSON.stringify({
            id: guest.id,
            name: guest.name,
            email: getGuestStoredLoginId(guest),
            childName: guest.childName || guest.studentName || '',
            studentId: guest.studentId || '',
            studentName: guest.studentName || guest.childName || '',
            loggedInAt: new Date().toISOString()
        }));
    }

    function validateGuestWizardStep(step) {
        if (step === 1) {
            const name = document.getElementById('guest-name')?.value.trim() ?? '';
            const ok = name.length >= 3;
            showError('err-guest-name', !ok);
            if (!ok) showToast('أدخل اسم ولي الأمر.', 'error');
            return ok;
        }
        if (step === 2) {
            const email = document.getElementById('guest-email')?.value ?? '';
            const ok = isValidGuestEmail(email);
            showError('err-guest-email', !ok);
            if (!ok) showToast(getGuestEmailErrorMessage(email), 'error');
            return ok;
        }
        if (step === 3) {
            const child = document.getElementById('guest-child')?.value.trim() ?? '';
            const ok = child.length >= 3;
            showError('err-guest-child', !ok);
            if (!ok) showToast('أدخل اسم الابن.', 'error');
            return ok;
        }
        if (step === 4) {
            const pass = document.getElementById('guest-pass')?.value ?? '';
            const ok = isValidPassword(pass);
            showError('err-guest-pass', !ok);
            updatePasswordRules('guest-pass', !ok);
            if (!ok) showToast('كلمة السر: 8 خانات، أحرف صغيرة إنجليزية وأرقام فقط.', 'error');
            return ok;
        }
        return true;
    }

    function updateGuestWizardProgress(step) {
        const fill = document.getElementById('guest-progress-fill');
        const label = document.getElementById('guest-step-label');
        const pct = Math.round(((step - 1) / GUEST_WIZARD_TOTAL) * 100);
        if (fill) fill.style.width = `${pct}%`;
        if (label) label.textContent = `الخطوة ${step} من ${GUEST_WIZARD_TOTAL} — ${GUEST_WIZARD_LABELS[step - 1]}`;
    }

    function showGuestWizardStep(step, focusInput = true) {
        guestWizardStep = Math.max(1, Math.min(GUEST_WIZARD_TOTAL, step));
        document.querySelectorAll('#guest-register-form .reg-wizard-step').forEach((panel) => {
            const n = Number(panel.dataset.step);
            panel.hidden = n !== guestWizardStep;
            panel.classList.toggle('is-active', n === guestWizardStep);
        });
        updateGuestWizardProgress(guestWizardStep);
        const backBtn = document.getElementById('guest-wizard-back');
        const nextBtn = document.getElementById('guest-wizard-next');
        const submitBtn = document.getElementById('guest-register-submit-btn');
        const nav = document.getElementById('guest-wizard-nav');
        backBtn?.toggleAttribute('hidden', guestWizardStep === 1);
        nextBtn?.toggleAttribute('hidden', guestWizardStep === GUEST_WIZARD_TOTAL);
        submitBtn?.toggleAttribute('hidden', guestWizardStep !== GUEST_WIZARD_TOTAL);
        nav?.classList.toggle('reg-wizard-nav--single', guestWizardStep === 1);
        if (focusInput) {
            const map = { 1: '#guest-name', 2: '#guest-email', 3: '#guest-child', 4: '#guest-pass' };
            const el = document.querySelector(map[guestWizardStep]);
            if (el) setTimeout(() => el.focus(), 80);
        }
    }

    function resetGuestWizard(focusFirst = true) {
        guestWizardStep = 1;
        document.getElementById('guest-register-form')?.reset();
        ['err-guest-name', 'err-guest-email', 'err-guest-child', 'err-guest-pass'].forEach((id) => showError(id, false));
        showGuestWizardStep(1, focusFirst);
    }

    function goGuestWizardNext() {
        if (!validateGuestWizardStep(guestWizardStep)) return;
        if (guestWizardStep < GUEST_WIZARD_TOTAL) showGuestWizardStep(guestWizardStep + 1);
    }

    function goGuestWizardBack() {
        if (guestWizardStep > 1) showGuestWizardStep(guestWizardStep - 1);
    }

    function setLoginMode(mode) {
        loginMode = mode === 'guest' ? 'guest' : 'student';

        ['student', 'guest'].forEach((m) => {
            const btn = document.getElementById(`login-mode-${m}`);
            const active = loginMode === m;
            btn?.classList.toggle('is-active', active);
            btn?.setAttribute('aria-checked', active ? 'true' : 'false');
            if (active) {
                const check = btn?.querySelector('.login-role-check');
                if (check) {
                    check.style.animation = 'none';
                    void check.offsetWidth;
                    check.style.removeProperty('animation');
                }
            }
        });

        document.getElementById('login-student-fields')?.toggleAttribute('hidden', loginMode !== 'student');
        document.getElementById('login-guest-fields')?.toggleAttribute('hidden', loginMode !== 'guest');

        const hint = document.getElementById('login-mode-hint');
        if (hint) {
            hint.textContent = loginMode === 'guest'
                ? 'ضيف أو ولي أمر: ادخل بالبريد الإلكتروني وكلمة السر — بدون كود أكاديمي.'
                : 'استخدم الكود الأكاديمي وكلمة السر — للطلاب فقط.';
        }

        clearLoginFailureState();
        if (loginMode === 'guest' && typeof setMascotSpeech === 'function') {
            setMascotSpeech('emailFocus');
        }
    }

    async function attemptGuestLogin(rawEmail, rawPass) {
        const email = rawEmail.trim();
        const pass = rawPass;
        if (!isValidGuestEmail(email) || !isValidPassword(pass)) {
            triggerFieldShake(getGuestEmailWrapId('guest-login-email'));
            triggerFieldShake('guest-login-pass-wrap');
            updateGuestEmailValidation('guest-login-email', true);
            if (!isValidGuestEmail(email)) {
                showGuestEmailMascotMessage(email);
            } else {
                showToast('بيانات الدخول غير صحيحة أو لم تُقبل بعد.', 'error');
            }
            return false;
        }
        const guest = findApprovedGuest(email, pass);
        if (!guest) {
            triggerFieldShake(getGuestEmailWrapId('guest-login-email'));
            triggerFieldShake('guest-login-pass-wrap');
            if (typeof showMascotMessage === 'function') {
                showMascotMessage('emailNotFound', { autoHideMs: 5000 });
            }
            showToast('بيانات الدخول غير صحيحة أو لم تُقبل طلبك بعد.', 'error');
            return false;
        }
        saveCurrentLoggedInGuest(guest);
        window.location.assign('parent-dashboard.html');
        return true;
    }

    function patchShowView() {
        const baseShowView = window.showView;
        if (typeof baseShowView !== 'function') return;

        window.showView = function showViewWithGuest(viewId) {
            baseShowView(viewId);
            const isGuestReg = viewId === 'guest-register-view';
            const isLogin = viewId === 'login-view';

            if (isGuestReg) resetGuestWizard(true);
            if (isLogin) setLoginMode(loginMode);
        };
    }

    function initGuestAuth() {
        patchShowView();

        document.getElementById('login-alt-join-guest')?.addEventListener('click', () => showView('guest-register-view'));
        document.getElementById('guest-back-login')?.addEventListener('click', () => showView('login-view'));
        document.querySelectorAll('.login-role-option[data-login-mode]').forEach((btn) => {
            btn.addEventListener('click', () => setLoginMode(btn.dataset.loginMode));
        });

        document.getElementById('guest-wizard-next')?.addEventListener('click', goGuestWizardNext);
        document.getElementById('guest-wizard-back')?.addEventListener('click', goGuestWizardBack);

        bindGuestEmailInput('guest-email');
        bindGuestEmailInput('guest-login-email');

        const guestPass = document.getElementById('guest-pass');
        guestPass?.addEventListener('input', () => {
            guestPass.value = sanitizePasswordChars(guestPass.value);
            updatePasswordRules('guest-pass', false);
        });
        guestPass?.addEventListener('blur', () => updatePasswordRules('guest-pass', true));

        document.querySelectorAll('#guest-register-form .reg-wizard-step input').forEach((input) => {
            input.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const step = Number(input.closest('.reg-wizard-step')?.dataset.step);
                if (!step || step >= GUEST_WIZARD_TOTAL) return;
                goGuestWizardNext();
            });
        });

        document.getElementById('guest-register-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (guestWizardStep !== GUEST_WIZARD_TOTAL) {
                goGuestWizardNext();
                return;
            }
            if (!validateGuestWizardStep(4)) return;
            const result = saveNewGuestRequest({
                name: document.getElementById('guest-name')?.value.trim() ?? '',
                email: document.getElementById('guest-email')?.value ?? '',
                childName: document.getElementById('guest-child')?.value.trim() ?? '',
                password: document.getElementById('guest-pass')?.value ?? ''
            });
            if (!result.ok) {
                showToast('تعذر إرسال الطلب. حاول مرة أخرى.', 'error');
                return;
            }
            showToast('تم إرسال طلب الانضمام كضيف — بانتظار موافقة الإدارة.', 'success');
            resetGuestWizard(false);
            showView('login-view');
            setLoginMode('guest');
        });

        const loginForm = document.getElementById('login-form');
        if (loginForm && !loginForm.dataset.guestPatched) {
            loginForm.dataset.guestPatched = '1';
            loginForm.addEventListener('submit', async (e) => {
                if (loginMode === 'student') return;
                e.preventDefault();
                e.stopImmediatePropagation();
                const submitBtn = document.getElementById('login-submit-btn');
                submitBtn?.setAttribute('disabled', 'disabled');
                try {
                    await attemptGuestLogin(
                        document.getElementById('guest-login-email')?.value ?? '',
                        document.getElementById('guest-login-pass')?.value ?? ''
                    );
                } finally {
                    submitBtn?.removeAttribute('disabled');
                }
            }, true);
        }

        setLoginMode('student');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGuestAuth);
    } else {
        initGuestAuth();
    }
})();
