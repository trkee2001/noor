/* =====================================================================
   لوحة تحكم مجمع الزبير — dashboard.js (SPA مستقل)
   ===================================================================== */

const DESKTOP_BP = 769;
const AUTH_SESSION_KEY = 'qmza_session';

function getAuthSession() {
    try { return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY)); }
    catch { return null; }
}

function requireAuth() {
    const session = getAuthSession();
    if (!session?.loggedIn || !session?.authToken) {
        window.location.replace('dashboard-login.html');
        return false;
    }
    if (session.role === 'teacher') {
        window.location.replace('teacher-dashboard.html');
        return false;
    }
    return true;
}

const CHART_DATA = {
    daily:   { labels: ['8ص', '10ص', '12م', '2م', '4م', '6م'], values: [45, 62, 78, 55, 88, 70] },
    weekly:  { labels: ['أحد', 'إثن', 'ثلا', 'أرب', 'خم', 'جمع', 'سب'], values: [72, 85, 68, 90, 77, 82, 95] },
    monthly: { labels: ['1', '5', '10', '15', '20', '25', '30'], values: [60, 75, 80, 72, 88, 91, 86] },
    yearly:  { labels: ['ين', 'فبر', 'مار', 'أبر', 'ماي', 'يون', 'يول', 'أغ', 'سب', 'أكت', 'نوف', 'ديس'], values: [55, 62, 70, 75, 80, 85, 88, 90, 87, 92, 94, 96] }
};

function isDesktop() {
    return window.innerWidth >= DESKTOP_BP;
}

function generateStudentCode() {
    const year = new Date().getFullYear();
    const key = 'dash_student_seq';
    const seq = parseInt(localStorage.getItem(key) || '0', 10) + 1;
    localStorage.setItem(key, String(seq));
    return `${year}${String(seq).padStart(2, '0')}`;
}

function previewStudentCode() {
    const year = new Date().getFullYear();
    const seq = parseInt(localStorage.getItem('dash_student_seq') || '0', 10) + 1;
    return `${year}${String(seq).padStart(2, '0')}`;
}

function getStudents() {
    try { return JSON.parse(localStorage.getItem('dash_students') || '[]'); }
    catch { return []; }
}

function saveStudents(list) {
    localStorage.setItem('dash_students', JSON.stringify(list));
    localStorage.setItem('approved_students', JSON.stringify(list));
}

const STUDENT_PASS_REGEX = /^(?=.*[a-z])(?=.*[0-9])[a-z0-9]{8,}$/;
const DEFAULT_STUDENT_PASSWORD = '1234567a';

function extractRecordPassword(record) {
    const raw = record?.password ?? record?.pass ?? record?.studentPassword ?? '';
    return String(raw).trim();
}

function resolveStudentPassword(student) {
    return extractRecordPassword(student) || DEFAULT_STUDENT_PASSWORD;
}

function ensureStudentPasswords(students) {
    let changed = false;
    students.forEach((st) => {
        const pass = extractRecordPassword(st);
        if (!pass) {
            st.password = DEFAULT_STUDENT_PASSWORD;
            changed = true;
        } else if (st.password !== pass) {
            st.password = pass;
            changed = true;
        }
    });
    if (changed) saveStudents(students);
    return students;
}

function createStudentRecordId() {
    return `st_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function ensureStudentIds(students) {
    let changed = false;
    students.forEach((st) => {
        if (!st.id) {
            st.id = createStudentRecordId();
            changed = true;
        }
    });
    if (changed) saveStudents(students);
    return students;
}

function getStudentsNormalized() {
    const students = ensureStudentIds(getStudents());
    return ensureStudentPasswords(students);
}

const NEW_REQUESTS_KEY = 'new_students_requests';
const BANNER_ADS_KEY = 'qmza_banner_ads';
const BANNER_OVERLAY_KEY = 'qmza_banner_overlay';
const TEACHERS_KEY = 'teacher_accounts';
const DEFAULT_BANNER_IMAGE = 'watermarked_img_14204941598938561939.png';
const HALAQA_LABELS = {
    fajr: 'حلقة الفجر',
    duha: 'حلقة الضحى',
    asr: 'حلقة العصر',
    maghrib: 'حلقة المغرب'
};

function getNewStudentRequests() {
    try { return JSON.parse(localStorage.getItem(NEW_REQUESTS_KEY) || '[]'); }
    catch { return []; }
}

function saveNewStudentRequests(list) {
    localStorage.setItem(NEW_REQUESTS_KEY, JSON.stringify(list));
}

function getTeacherAccounts() {
    try {
        const list = JSON.parse(localStorage.getItem(TEACHERS_KEY) || '[]');
        return Array.isArray(list) ? list : [];
    } catch { return []; }
}

function saveTeacherAccounts(list) {
    localStorage.setItem(TEACHERS_KEY, JSON.stringify(list));
}

function createTeacherId() {
    return `teacher_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatHalaqaList(halaqat = []) {
    if (!Array.isArray(halaqat) || !halaqat.length) return 'لا توجد حلقات';
    return halaqat.map((key) => HALAQA_LABELS[key] || key).join('، ');
}

function formatPhoneDisplay(countryCode, phone) {
    const code = String(countryCode || '+967').trim();
    const num = String(phone || '').trim();
    if (!num) return code;
    return `${code} ${num}`;
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function updateNewRequestsBadge() {
    const count = getNewStudentRequests().length;
    const badge = document.getElementById('new-requests-badge');
    const label = document.getElementById('new-requests-count');
    if (badge) {
        badge.textContent = String(count);
        badge.hidden = count === 0;
    }
    if (label) label.textContent = count === 1 ? '1 طلب' : `${count} طلب`;
}

function renderApprovedStudentsTable(smooth = false) {
    const tbody = document.getElementById('approved-students-body');
    const wrap = document.getElementById('approved-students-wrap');
    if (!tbody) return;

    if (smooth && wrap) {
        wrap.classList.remove('is-refreshing');
        void wrap.offsetWidth;
        wrap.classList.add('is-refreshing');
    }

    const students = getStudentsNormalized();
    if (!students.length) {
        tbody.innerHTML = '<tr class="dash-table-empty"><td colspan="6">لا يوجد طلاب معتمدون بعد.</td></tr>';
        return;
    }

    tbody.innerHTML = students.map((st) => {
        const plainPassword = resolveStudentPassword(st);
        return `
        <tr data-student-id="${escapeHtml(st.id)}">
            <td class="dash-name-cell"><strong>${escapeHtml(st.name)}</strong></td>
            <td><span class="dash-code-chip">${escapeHtml(st.code || '—')}</span></td>
            <td class="dash-phone-cell" dir="ltr">${escapeHtml(st.phone || '—')}</td>
            <td class="dash-pass-cell"><span class="dash-pass-plain" dir="ltr">${escapeHtml(plainPassword)}</span></td>
            <td class="dash-date-cell">${escapeHtml(st.approvedLabel || st.approvedAt || '—')}</td>
            <td class="dash-actions-cell">
                <button type="button" class="dash-btn dash-btn-sm dash-btn-change-pass"
                    data-action="change-pass" data-id="${escapeHtml(st.id)}" data-name="${escapeHtml(st.name)}">
                    تغيير كلمة السر 🔑
                </button>
            </td>
        </tr>
    `;
    }).join('');

    if (smooth && wrap) {
        setTimeout(() => wrap.classList.remove('is-refreshing'), 360);
    }
}

function removeRequestRow(row, done) {
    if (!row) {
        done?.();
        return;
    }
    row.classList.add('dash-row-leaving');
    row.addEventListener('animationend', () => {
        row.remove();
        done?.();
    }, { once: true });
}

function renderNewRequestsTable() {
    const tbody = document.getElementById('new-requests-table-body');
    if (!tbody) return;

    const requests = getNewStudentRequests();
    updateNewRequestsBadge();

    if (!requests.length) {
        tbody.innerHTML = '<tr class="dash-table-empty"><td colspan="5">لا توجد طلبات جديدة حالياً.</td></tr>';
        return;
    }

    tbody.innerHTML = requests.map((req) => `
        <tr data-request-id="${escapeHtml(req.id)}">
            <td class="dash-name-cell"><strong>${escapeHtml(req.name)}</strong></td>
            <td class="dash-phone-cell" dir="ltr">${escapeHtml(formatPhoneDisplay(req.countryCode, req.phone))}</td>
            <td class="dash-pass-cell"><code class="dash-pass-plain">${escapeHtml(req.password || '—')}</code></td>
            <td class="dash-date-cell">${escapeHtml(req.submittedLabel || req.submittedAt || '—')}</td>
            <td class="dash-actions-cell">
                <div class="dash-action-btns">
                    <button type="button" class="dash-btn dash-btn-sm dash-btn-accept" data-action="accept" data-id="${escapeHtml(req.id)}">قبول ✅</button>
                    <button type="button" class="dash-btn dash-btn-sm dash-btn-reject" data-action="reject" data-id="${escapeHtml(req.id)}">رفض ❌</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderTeachersTable() {
    const tbody = document.getElementById('teachers-table-body');
    if (!tbody) return;

    const teachers = getTeacherAccounts();
    if (!teachers.length) {
        tbody.innerHTML = '<tr class="dash-table-empty"><td colspan="4">لا يوجد مدرسون بعد.</td></tr>';
        return;
    }

    tbody.innerHTML = teachers.map((teacher) => `
        <tr data-teacher-id="${escapeHtml(teacher.id)}">
            <td class="dash-name-cell"><strong>${escapeHtml(teacher.name)}</strong></td>
            <td><span class="dash-code-chip">${escapeHtml(teacher.code)}</span></td>
            <td>${escapeHtml(formatHalaqaList(teacher.halaqat))}</td>
            <td>
                <button type="button" class="dash-btn dash-btn-sm dash-btn-outline"
                    data-action="remove-teacher" data-id="${escapeHtml(teacher.id)}">
                    حذف
                </button>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('[data-action="remove-teacher"]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            saveTeacherAccounts(getTeacherAccounts().filter((teacher) => teacher.id !== id));
            renderTeachersTable();
            showToast('تم حذف المدرس');
        });
    });
}

function acceptNewStudentRequest(requestId) {
    const requests = getNewStudentRequests();
    const index = requests.findIndex((r) => r.id === requestId);
    if (index === -1) return;

    const req = requests[index];
    const copiedPassword = extractRecordPassword(req) || DEFAULT_STUDENT_PASSWORD;
    const students = getStudents();
    const now = new Date();
    students.push({
        id: createStudentRecordId(),
        name: req.name,
        code: generateStudentCode(),
        phone: formatPhoneDisplay(req.countryCode, req.phone),
        password: copiedPassword,
        halaqa: '',
        level: 'beginner',
        approvedAt: now.toISOString(),
        approvedLabel: now.toLocaleString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }),
        fromRequestId: req.id
    });
    saveStudents(students);

    requests.splice(index, 1);
    saveNewStudentRequests(requests);

    showToast(`تم قبول "${req.name}" وإضافته للطلاب المعتمدين`);
    renderApprovedStudentsTable();
    renderNewRequestsTable();
}

function rejectNewStudentRequest(requestId) {
    const requests = getNewStudentRequests();
    const req = requests.find((r) => r.id === requestId);
    if (!req) return;

    saveNewStudentRequests(requests.filter((r) => r.id !== requestId));
    showToast(`تم رفض طلب "${req.name}"`);
    renderNewRequestsTable();
}

function initNewStudentRequests() {
    renderNewRequestsTable();
    renderApprovedStudentsTable();

    const tbody = document.getElementById('new-requests-table-body');
    tbody?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const requestId = btn.dataset.id;
        const row = btn.closest('tr');
        const action = btn.dataset.action;

        if (action === 'accept') {
            removeRequestRow(row, () => acceptNewStudentRequest(requestId));
        } else if (action === 'reject') {
            removeRequestRow(row, () => rejectNewStudentRequest(requestId));
        }
    });
}

let activeChangePassStudentId = null;

function openChangePasswordModal(studentId, studentName) {
    activeChangePassStudentId = studentId;
    const overlay = document.getElementById('change-pass-modal');
    const input = document.getElementById('change-pass-input');
    const error = document.getElementById('change-pass-error');
    const nameEl = document.getElementById('change-pass-student-name');
    if (nameEl) nameEl.textContent = `الطالب: ${studentName}`;
    if (input) input.value = '';
    if (error) {
        error.hidden = true;
        error.textContent = '';
    }
    overlay?.classList.add('open');
    overlay?.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    input?.focus();
}

function closeChangePasswordModal() {
    activeChangePassStudentId = null;
    const overlay = document.getElementById('change-pass-modal');
    overlay?.classList.remove('open');
    overlay?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function sanitizeStudentPasswordInput(raw) {
    return String(raw ?? '').replace(/[^a-z0-9]/g, '');
}

function initChangePasswordModal() {
    const overlay = document.getElementById('change-pass-modal');
    const input = document.getElementById('change-pass-input');
    const error = document.getElementById('change-pass-error');

    document.getElementById('approved-students-body')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="change-pass"]');
        if (!btn) return;
        openChangePasswordModal(btn.dataset.id, btn.dataset.name || 'طالب');
    });

    document.getElementById('change-pass-cancel')?.addEventListener('click', closeChangePasswordModal);
    document.getElementById('change-pass-close')?.addEventListener('click', closeChangePasswordModal);

    overlay?.addEventListener('click', (e) => {
        if (e.target === overlay) closeChangePasswordModal();
    });

    input?.addEventListener('input', () => {
        if (!input) return;
        input.value = sanitizeStudentPasswordInput(input.value);
        if (error) error.hidden = true;
    });

    input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('change-pass-save')?.click();
    });

    document.getElementById('change-pass-save')?.addEventListener('click', () => {
        const pass = input?.value ?? '';
        if (!STUDENT_PASS_REGEX.test(pass)) {
            if (error) {
                error.hidden = false;
                error.textContent = 'كلمة السر: 8 خانات، أحرف صغيرة إنجليزية وأرقام فقط.';
            }
            return;
        }

        const students = getStudentsNormalized();
        const student = students.find((s) => s.id === activeChangePassStudentId);
        if (!student) {
            showToast('تعذر العثور على الطالب');
            closeChangePasswordModal();
            return;
        }

        student.password = pass;
        saveStudents(students);
        closeChangePasswordModal();
        renderApprovedStudentsTable(true);
        showToast(`تم تحديث كلمة سر "${student.name}" بنجاح`);
    });
}

function showToast(msg) {
    const el = document.getElementById('dash-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.remove('show'), 2800);
}

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

function saveBannerOverlaySettings(settings) {
    localStorage.setItem(BANNER_OVERLAY_KEY, JSON.stringify(settings));
}

function applyBannerOverlaySettings(settings = getBannerOverlaySettings()) {
    const preview = document.getElementById('dash-ad-glass-preview');
    const targets = [document.documentElement, preview].filter(Boolean);
    const color = resolveBannerOverlayColor(settings.overlayColorTheme);

    targets.forEach((el) => {
        el.style.setProperty('--blur-amount', `${settings.blurAmount}px`);
        el.style.setProperty('--overlay-height', `${settings.overlayHeight}%`);
        el.style.setProperty('--overlay-color', color);
        el.style.setProperty('--edge-smoothness', `${settings.edgeSmoothness}%`);
    });
}

function syncOverlayControlsFromStore() {
    const settings = getBannerOverlaySettings();
    const blurRange = document.getElementById('overlay-blur-range');
    const heightRange = document.getElementById('overlay-height-range');
    const edgeRange = document.getElementById('overlay-edge-range');
    const colorSelect = document.getElementById('overlay-color-select');
    const blurVal = document.getElementById('overlay-blur-val');
    const heightVal = document.getElementById('overlay-height-val');
    const edgeVal = document.getElementById('overlay-edge-val');

    if (blurRange) blurRange.value = String(settings.blurAmount);
    if (heightRange) heightRange.value = String(settings.overlayHeight);
    if (edgeRange) edgeRange.value = String(settings.edgeSmoothness);
    if (colorSelect) colorSelect.value = settings.overlayColorTheme;
    if (blurVal) blurVal.textContent = `${settings.blurAmount}px`;
    if (heightVal) heightVal.textContent = `${settings.overlayHeight}%`;
    if (edgeVal) edgeVal.textContent = `${settings.edgeSmoothness}%`;
    applyBannerOverlaySettings(settings);
}

function normalizeBannerAdsList(list) {
    return (list || []).map((ad) => ({
        ...ad,
        archived: ad.archived === true
    }));
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
        return Array.isArray(list) ? normalizeBannerAdsList(list) : null;
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

function createBannerAdId() {
    return `ad_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatAdLinkLabel(ad) {
    if (ad.linkType === 'join' || ad.link === '#register') return 'طلب انضمام';
    return ad.link || '—';
}

function formatAdArchivedDate(ad) {
    if (!ad.archivedAt) return '—';
    try {
        return new Date(ad.archivedAt).toLocaleDateString('ar-SA', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    } catch {
        return '—';
    }
}

function renderAdsTable() {
    const tbody = document.getElementById('ads-table-body');
    const countEl = document.getElementById('ads-active-count');
    if (!tbody) return;

    const ads = ensureBannerAdsStore().filter((ad) => ad.archived !== true);
    const activeCount = ads.filter((ad) => ad.active !== false).length;
    if (countEl) countEl.textContent = `${activeCount} نشط`;

    if (!ads.length) {
        tbody.innerHTML = '<tr class="dash-table-empty"><td colspan="5">لا توجد إعلانات بعد.</td></tr>';
        return;
    }

    tbody.innerHTML = ads.map((ad) => {
        const isActive = ad.active !== false;
        return `
        <tr data-ad-id="${escapeHtml(ad.id)}">
            <td class="dash-name-cell"><strong>${escapeHtml(ad.name || 'إعلان')}</strong></td>
            <td>
                <img class="dash-ad-thumb" src="${escapeHtml(ad.image)}" alt="${escapeHtml(ad.name || 'إعلان')}">
            </td>
            <td>${escapeHtml(formatAdLinkLabel(ad))}</td>
            <td>
                <span class="dash-ad-status ${isActive ? 'is-active' : 'is-hidden'}">${isActive ? 'نشط' : 'مخفي'}</span>
            </td>
            <td class="dash-actions-cell">
                <button type="button" class="dash-btn dash-btn-sm dash-btn-toggle-ad"
                    data-action="toggle-ad" data-id="${escapeHtml(ad.id)}">
                    ${isActive ? 'إخفاء العرض' : 'إظهار العرض'}
                </button>
                <button type="button" class="dash-btn dash-btn-sm dash-btn-danger"
                    data-action="archive-ad" data-id="${escapeHtml(ad.id)}">حذف الإعلان</button>
            </td>
        </tr>
    `;
    }).join('');
}

function renderAdsArchiveTable() {
    const tbody = document.getElementById('ads-archive-body');
    const countEl = document.getElementById('ads-archive-count');
    if (!tbody) return;

    const archived = ensureBannerAdsStore().filter((ad) => ad.archived === true);
    if (countEl) countEl.textContent = `${archived.length} مؤرشف`;

    if (!archived.length) {
        tbody.innerHTML = '<tr class="dash-table-empty"><td colspan="4">لا توجد إعلانات مؤرشفة.</td></tr>';
        return;
    }

    tbody.innerHTML = archived.map((ad) => `
        <tr data-ad-id="${escapeHtml(ad.id)}">
            <td class="dash-name-cell"><strong>${escapeHtml(ad.name || 'إعلان')}</strong></td>
            <td>
                <img class="dash-ad-thumb" src="${escapeHtml(ad.image)}" alt="${escapeHtml(ad.name || 'إعلان')}">
            </td>
            <td>${escapeHtml(formatAdArchivedDate(ad))}</td>
            <td class="dash-actions-cell">
                <button type="button" class="dash-btn dash-btn-sm dash-btn-toggle-ad"
                    data-action="restore-ad" data-id="${escapeHtml(ad.id)}">استعادة الإعلان</button>
                <button type="button" class="dash-btn dash-btn-sm dash-btn-danger"
                    data-action="purge-ad" data-id="${escapeHtml(ad.id)}">حذف نهائي</button>
            </td>
        </tr>
    `).join('');
}

function renderAdsManagementViews() {
    renderAdsTable();
    renderAdsArchiveTable();
}

function switchAdsSubview(view) {
    document.querySelectorAll('.dash-ads-subtab').forEach((tab) => {
        const active = tab.dataset.adsView === view;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.getElementById('ads-view-active')?.toggleAttribute('hidden', view !== 'active');
    document.getElementById('ads-view-archive')?.toggleAttribute('hidden', view !== 'archive');
}

let pendingAdImageData = '';

function openAddAdModal() {
    pendingAdImageData = '';
    const overlay = document.getElementById('add-ad-modal');
    document.getElementById('ad-name-input').value = '';
    document.getElementById('ad-caption-input').value = '';
    document.getElementById('ad-link-type').value = 'join';
    document.getElementById('ad-link-input').value = '';
    document.getElementById('ad-image-input').value = '';
    document.getElementById('add-ad-error').hidden = true;
    document.getElementById('ad-url-field').hidden = true;
    document.getElementById('ad-image-preview').hidden = true;
    overlay?.classList.add('open');
    overlay?.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeAddAdModal() {
    pendingAdImageData = '';
    const overlay = document.getElementById('add-ad-modal');
    overlay?.classList.remove('open');
    overlay?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function toggleBannerAdVisibility(adId) {
    const ads = ensureBannerAdsStore();
    const ad = ads.find((item) => item.id === adId);
    if (!ad || ad.archived === true) return;
    ad.active = !(ad.active !== false);
    saveBannerAds(ads);
    renderAdsManagementViews();
    showToast(ad.active !== false ? `تم إظهار "${ad.name}" في الرئيسية` : `تم إخفاء "${ad.name}" من الرئيسية`);
}

function archiveBannerAd(adId) {
    const ads = ensureBannerAdsStore();
    const ad = ads.find((item) => item.id === adId);
    if (!ad || ad.archived === true) return;
    ad.archived = true;
    ad.active = false;
    ad.archivedAt = new Date().toISOString();
    saveBannerAds(ads);
    renderAdsManagementViews();
    switchAdsSubview('archive');
    showToast(`تم نقل "${ad.name}" إلى الأرشيف`);
}

function restoreBannerAd(adId) {
    const ads = ensureBannerAdsStore();
    const ad = ads.find((item) => item.id === adId);
    if (!ad || ad.archived !== true) return;
    ad.archived = false;
    ad.active = true;
    ad.archivedAt = null;
    saveBannerAds(ads);
    renderAdsManagementViews();
    switchAdsSubview('active');
    showToast(`تمت استعادة "${ad.name}" إلى السلايدر`);
}

function permanentDeleteBannerAd(adId) {
    const ads = ensureBannerAdsStore();
    const ad = ads.find((item) => item.id === adId);
    if (!ad || ad.archived !== true) return;
    const ok = window.confirm(`حذف "${ad.name}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`);
    if (!ok) return;
    saveBannerAds(ads.filter((item) => item.id !== adId));
    renderAdsManagementViews();
    showToast('تم حذف الإعلان نهائياً');
}

function saveNewBannerAd() {
    const name = document.getElementById('ad-name-input')?.value.trim() ?? '';
    const caption = document.getElementById('ad-caption-input')?.value.trim() ?? '';
    const linkType = document.getElementById('ad-link-type')?.value ?? 'join';
    const link = document.getElementById('ad-link-input')?.value.trim() ?? '';
    const error = document.getElementById('add-ad-error');

    if (!name) {
        if (error) {
            error.hidden = false;
            error.textContent = 'أدخل اسماً للإعلان.';
        }
        return;
    }

    if (!pendingAdImageData) {
        if (error) {
            error.hidden = false;
            error.textContent = 'ارفع صورة الإعلان أولاً.';
        }
        return;
    }

    if (linkType === 'url' && !/^https?:\/\/.+/i.test(link)) {
        if (error) {
            error.hidden = false;
            error.textContent = 'أدخل رابطاً خارجياً صالحاً يبدأ بـ http أو https.';
        }
        return;
    }

    const ads = ensureBannerAdsStore();
    ads.push({
        id: createBannerAdId(),
        name,
        image: pendingAdImageData,
        linkType,
        link: linkType === 'join' ? '#register' : link,
        caption,
        active: true,
        archived: false,
        archivedAt: null,
        createdAt: new Date().toISOString()
    });
    saveBannerAds(ads);
    closeAddAdModal();
    renderAdsManagementViews();
    showToast('تمت إضافة الإعلان بنجاح');
}

function persistOverlayFromControls() {
    const settings = {
        blurAmount: parseInt(document.getElementById('overlay-blur-range')?.value ?? '15', 10),
        overlayHeight: parseInt(document.getElementById('overlay-height-range')?.value ?? '30', 10),
        overlayColorTheme: document.getElementById('overlay-color-select')?.value ?? 'white',
        edgeSmoothness: parseInt(document.getElementById('overlay-edge-range')?.value ?? '20', 10)
    };
    saveBannerOverlaySettings(settings);
    applyBannerOverlaySettings(settings);
}

function initBannerOverlayControls() {
    syncOverlayControlsFromStore();

    const blurRange = document.getElementById('overlay-blur-range');
    const heightRange = document.getElementById('overlay-height-range');
    const edgeRange = document.getElementById('overlay-edge-range');
    const colorSelect = document.getElementById('overlay-color-select');

    blurRange?.addEventListener('input', () => {
        document.getElementById('overlay-blur-val').textContent = `${blurRange.value}px`;
        persistOverlayFromControls();
    });
    heightRange?.addEventListener('input', () => {
        document.getElementById('overlay-height-val').textContent = `${heightRange.value}%`;
        persistOverlayFromControls();
    });
    edgeRange?.addEventListener('input', () => {
        document.getElementById('overlay-edge-val').textContent = `${edgeRange.value}%`;
        persistOverlayFromControls();
    });
    colorSelect?.addEventListener('change', persistOverlayFromControls);
}

function initBannerAdsManagement() {
    renderAdsManagementViews();
    initBannerOverlayControls();
    switchAdsSubview('active');

    document.querySelectorAll('.dash-ads-subtab').forEach((tab) => {
        tab.addEventListener('click', () => switchAdsSubview(tab.dataset.adsView || 'active'));
    });

    document.getElementById('ads-add-btn')?.addEventListener('click', openAddAdModal);
    document.getElementById('add-ad-cancel')?.addEventListener('click', closeAddAdModal);
    document.getElementById('add-ad-close')?.addEventListener('click', closeAddAdModal);

    document.getElementById('add-ad-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'add-ad-modal') closeAddAdModal();
    });

    document.getElementById('ad-link-type')?.addEventListener('change', (e) => {
        const urlField = document.getElementById('ad-url-field');
        if (urlField) urlField.hidden = e.target.value !== 'url';
    });

    document.getElementById('ad-image-input')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        const preview = document.getElementById('ad-image-preview');
        const previewImg = document.getElementById('ad-image-preview-img');
        const error = document.getElementById('add-ad-error');
        if (!file || !file.type.startsWith('image/')) {
            pendingAdImageData = '';
            if (preview) preview.hidden = true;
            return;
        }
        if (file.size > 3 * 1024 * 1024) {
            pendingAdImageData = '';
            if (error) {
                error.hidden = false;
                error.textContent = 'حجم الصورة كبير — الحد 3 ميجابايت.';
            }
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            pendingAdImageData = reader.result;
            if (previewImg) previewImg.src = pendingAdImageData;
            if (preview) preview.hidden = false;
            if (error) error.hidden = true;
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('add-ad-save')?.addEventListener('click', saveNewBannerAd);

    document.getElementById('ads-table-body')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.dataset.action === 'toggle-ad') toggleBannerAdVisibility(id);
        if (btn.dataset.action === 'archive-ad') archiveBannerAd(id);
    });

    document.getElementById('ads-archive-body')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.dataset.action === 'restore-ad') restoreBannerAd(id);
        if (btn.dataset.action === 'purge-ad') permanentDeleteBannerAd(id);
    });
}

/* ── التبويبات (SPA) ── */
function switchTab(tabId) {
    document.querySelectorAll('.dash-nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.tab === tabId);
    });
    document.querySelectorAll('.dash-panel').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.panel === tabId);
    });
    if (!isDesktop()) closeMobileSidebar();
    history.replaceState(null, '', `#${tabId}`);
    if (tabId === 'new-requests') renderNewRequestsTable();
    if (tabId === 'students') renderApprovedStudentsTable();
    if (tabId === 'ads') {
        renderAdsManagementViews();
        syncOverlayControlsFromStore();
    }
}

/* ── القائمة الجانبية ── */
function toggleSidebarCollapse() {
    if (!isDesktop()) {
        toggleMobileSidebar();
        return;
    }
    const collapsed = document.body.classList.toggle('dash-collapsed');
    localStorage.setItem('dash_sidebar_collapsed', collapsed ? '1' : '0');
    document.getElementById('dash-sidebar-toggle')?.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
}

function openMobileSidebar() {
    document.getElementById('dash-sidebar')?.classList.add('open');
    document.getElementById('dash-overlay')?.classList.add('open');
}

function closeMobileSidebar() {
    document.getElementById('dash-sidebar')?.classList.remove('open');
    document.getElementById('dash-overlay')?.classList.remove('open');
}

function toggleMobileSidebar() {
    const sb = document.getElementById('dash-sidebar');
    if (sb?.classList.contains('open')) closeMobileSidebar();
    else openMobileSidebar();
}

function initSidebar() {
    if (localStorage.getItem('dash_sidebar_collapsed') === '1' && isDesktop()) {
        document.body.classList.add('dash-collapsed');
        document.getElementById('dash-sidebar-toggle')?.setAttribute('aria-expanded', 'false');
    }
}

/* ── الوضع الداكن ── */
function applyDarkMode(dark) {
    document.body.classList.toggle('dash-dark', dark);
    localStorage.setItem('dash_dark', dark ? '1' : '0');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

function toggleDarkMode() {
    applyDarkMode(!document.body.classList.contains('dash-dark'));
    showToast(document.body.classList.contains('dash-dark') ? 'الوضع الداكن مفعّل' : 'الوضع الفاتح مفعّل');
}

/* ── الرسم البياني ── */
function renderChart(period) {
    const data = CHART_DATA[period] || CHART_DATA.weekly;
    const chart = document.getElementById('dash-chart');
    if (!chart) return;

    const max = Math.max(...data.values, 1);
    chart.innerHTML = data.labels.map((label, i) => {
        const h = Math.round((data.values[i] / max) * 100);
        return `<div class="dash-bar-wrap" title="${data.values[i]}%">
            <div class="dash-bar" style="height:${h}%"></div>
            <span class="dash-bar-label">${label}</span>
        </div>`;
    }).join('');
}

function initChartTabs() {
    document.querySelectorAll('.dash-period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.dash-period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderChart(btn.dataset.period);
        });
    });
    renderChart('weekly');
}

/* ── التسميع اليومي ── */
function initRecitation() {
    document.querySelectorAll('#recitation-table .dash-grade-btns').forEach(group => {
        group.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const row = btn.closest('tr');
                const status = row?.querySelector('.recite-status');
                const surah = document.getElementById('recite-surah')?.value.trim() || '—';
                const ayah = document.getElementById('recite-ayah')?.value.trim() || '—';
                const grade = btn.dataset.grade;
                const name = row?.dataset.student ?? '';
                if (status) status.textContent = `${grade} | ${surah} (${ayah})`;
                showToast(`تم رصد "${grade}" للطالب ${name}`);
            });
        });
    });
}

/* ── النماذج ── */
function initForms() {
    const codePreview = document.getElementById('st-code');
    if (codePreview) codePreview.value = previewStudentCode();

    document.getElementById('add-student-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('st-name')?.value.trim();
        const pass = sanitizeStudentPasswordInput(document.getElementById('st-pass')?.value ?? '');
        const code = generateStudentCode();
        if (!name || !STUDENT_PASS_REGEX.test(pass)) {
            showToast('أكمل البيانات — كلمة سر: 8 خانات، أحرف صغيرة وأرقام');
            return;
        }
        const students = getStudents();
        const now = new Date();
        students.push({
            id: createStudentRecordId(),
            name,
            code,
            password: pass,
            halaqa: document.getElementById('st-halaqa')?.value,
            phone: document.getElementById('st-phone')?.value,
            level: document.getElementById('st-level')?.value,
            approvedAt: now.toISOString(),
            approvedLabel: now.toLocaleString('ar-SA', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
        });
        saveStudents(students);
        showToast(`تمت إضافة "${name}" — الكود: ${code}`);
        e.target.reset();
        if (codePreview) codePreview.value = previewStudentCode();
        renderApprovedStudentsTable();
    });

    document.getElementById('parent-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('par-name')?.value.trim();
        showToast(`تم ربط ولي الأمر "${name}" بالابن`);
        e.target.reset();
    });

    document.querySelectorAll('.send-report-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const parent = btn.closest('tr')?.cells[0]?.textContent ?? 'ولي الأمر';
            showToast(`تم إرسال تقرير الأداء إلى ${parent}`);
        });
    });

    document.getElementById('news-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        showToast('تم حفظ الخبر وتحديث العرض للعملاء');
    });

    document.getElementById('support-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        showToast('تم حفظ بيانات الدعم والتواصل');
    });

    document.getElementById('teacher-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('teacher-name')?.value.trim();
        const code = document.getElementById('teacher-code')?.value.trim();
        const password = document.getElementById('teacher-pass')?.value ?? '';
        const halaqat = Array.from(document.querySelectorAll('input[name="teacher-halaqa"]:checked'))
            .map((input) => input.value);

        if (!name || !/^\d{4,10}$/.test(code) || !STUDENT_PASS_REGEX.test(password) || !halaqat.length) {
            showToast('أكمل بيانات المدرس: كود أرقام، كلمة سر صحيحة، وحلقة واحدة على الأقل');
            return;
        }

        const teachers = getTeacherAccounts();
        if (teachers.some((teacher) => String(teacher.code) === String(code))) {
            showToast('كود المدرس مستخدم مسبقاً');
            return;
        }

        teachers.push({
            id: createTeacherId(),
            name,
            code,
            password,
            halaqat,
            createdAt: new Date().toISOString()
        });
        saveTeacherAccounts(teachers);
        e.target.reset();
        renderTeachersTable();
        showToast(`تم حفظ المدرس "${name}"`);
    });
}

/* ── KPI تفاعلية ── */
function initKpiAnimation() {
    document.querySelectorAll('.dash-kpi').forEach(card => {
        card.addEventListener('mouseenter', () => {
            const val = card.querySelector('.dash-kpi-value');
            if (val) val.style.transform = 'scale(1.04)';
        });
        card.addEventListener('mouseleave', () => {
            const val = card.querySelector('.dash-kpi-value');
            if (val) val.style.transform = '';
        });
    });
}

/* ── تهيئة ── */
document.addEventListener('DOMContentLoaded', () => {
    if (!requireAuth()) return;

    if (localStorage.getItem('dash_dark') === '1') applyDarkMode(true);

    initSidebar();
    initChartTabs();
    initRecitation();
    initForms();
    initNewStudentRequests();
    initChangePasswordModal();
    initBannerAdsManagement();
    renderTeachersTable();
    initKpiAnimation();

    document.querySelectorAll('.dash-nav-link').forEach(link => {
        link.addEventListener('click', () => switchTab(link.dataset.tab));
    });

    document.getElementById('dash-sidebar-toggle')?.addEventListener('click', toggleSidebarCollapse);
    document.getElementById('dash-menu-btn')?.addEventListener('click', toggleMobileSidebar);
    document.getElementById('dash-overlay')?.addEventListener('click', closeMobileSidebar);
    document.getElementById('dash-theme-btn')?.addEventListener('click', toggleDarkMode);

    window.addEventListener('resize', () => {
        if (isDesktop()) closeMobileSidebar();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMobileSidebar();
            closeChangePasswordModal();
            closeAddAdModal();
        }
    });

    const hash = location.hash.replace('#', '');
    const valid = ['overview', 'students', 'new-requests', 'parents', 'teachers', 'content', 'ads'];
    switchTab(valid.includes(hash) ? hash : 'overview');
});
