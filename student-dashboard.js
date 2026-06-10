/* =====================================================================
   لوحة تحكم الطالب — student-dashboard.js
   ===================================================================== */

const CURRENT_STUDENT_KEY = 'current_logged_in_student';
const APPROVED_STUDENTS_KEY = 'dash_students';
const RECITATION_KEY = 'recitation_records';
const STD_DARK_KEY = 'std_dark';
const KHATMA_PAGES = 604;

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23e2f7f3'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23004d5a'/%3E%3Cellipse cx='50' cy='82' rx='28' ry='22' fill='%23004d5a'/%3E%3C/svg%3E";

const SCHEDULE_SURAHS = [
    { name: 'الكهف', from: 1, to: 10 },
    { name: 'مريم', from: 1, to: 12 },
    { name: 'يس', from: 1, to: 15 },
    { name: 'الملك', from: 1, to: 8 },
    { name: 'الواقعة', from: 1, to: 20 }
];

const RANK_MEDALS = ['🥇', '🥈', '🥉'];
const RANK_WORDS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'];

let currentStudent = null;

function requireStudentAuth() {
    try {
        const raw = localStorage.getItem(CURRENT_STUDENT_KEY);
        if (!raw) {
            window.location.replace('index.html#login');
            return false;
        }
        currentStudent = JSON.parse(raw);
        if (!currentStudent?.code) {
            window.location.replace('index.html#login');
            return false;
        }
        return true;
    } catch {
        window.location.replace('index.html#login');
        return false;
    }
}

function saveCurrentStudent() {
    localStorage.setItem(CURRENT_STUDENT_KEY, JSON.stringify(currentStudent));
}

function hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i += 1) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h);
}

function ensureStudentStats() {
    if (currentStudent.stats && typeof currentStudent.stats === 'object') return;

    const seed = hashCode(String(currentStudent.code || currentStudent.id || 'student'));
    const pagesMemorized = 18 + (seed % 120);
    const weeklyProgress = 55 + (seed % 40);
    const monthlyProgress = 48 + (seed % 45);
    const weeklyAttendance = 80 + (seed % 21);
    const monthlyAttendance = 75 + (seed % 23);
    const schedule = SCHEDULE_SURAHS[seed % SCHEDULE_SURAHS.length];

    currentStudent.stats = {
        pagesMemorized,
        weeklyProgress,
        monthlyProgress,
        weeklyAttendance,
        monthlyAttendance,
        tomorrowSurah: schedule.name,
        tomorrowFrom: schedule.from,
        tomorrowTo: schedule.to,
        score: 600 + (seed % 350)
    };
    saveCurrentStudent();
}

function getApprovedStudents() {
    try { return JSON.parse(localStorage.getItem(APPROVED_STUDENTS_KEY) || '[]'); }
    catch { return []; }
}

function getRecitationRecords() {
    try {
        const list = JSON.parse(localStorage.getItem(RECITATION_KEY) || '[]');
        return Array.isArray(list) ? list : [];
    } catch { return []; }
}

function getLatestStudentRecord() {
    return getRecitationRecords()
        .filter((record) => String(record.studentCode) === String(currentStudent.code))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
}

function syncCurrentStudentFromApprovedList() {
    const approved = getApprovedStudents();
    const latest = approved.find((st) => String(st.code) === String(currentStudent.code));
    if (!latest) return;
    currentStudent = {
        ...currentStudent,
        name: latest.name || currentStudent.name,
        phone: latest.phone || currentStudent.phone,
        halaqa: latest.halaqa || currentStudent.halaqa,
        avatar: latest.avatar || currentStudent.avatar,
        lastRecitation: latest.lastRecitation || currentStudent.lastRecitation,
        tomorrowAssignment: latest.tomorrowAssignment || currentStudent.tomorrowAssignment,
        teacherNote: latest.teacherNote || currentStudent.teacherNote,
        stats: {
            ...(currentStudent.stats || {}),
            ...(latest.stats || {})
        }
    };
    saveCurrentStudent();
}

function syncNameToApprovedList(name) {
    const students = getApprovedStudents();
    const idx = students.findIndex((st) => String(st.code) === String(currentStudent.code));
    if (idx === -1) return;
    students[idx].name = name;
    localStorage.setItem(APPROVED_STUDENTS_KEY, JSON.stringify(students));
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function showToast(msg) {
    const el = document.getElementById('std-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => el.classList.remove('show'), 3200);
}

function renderProfile() {
    const name = currentStudent.name || 'طالب مجمع الزبير';
    const code = currentStudent.code || '—';
    const avatar = currentStudent.avatar || DEFAULT_AVATAR;
    const halaqa = currentStudent.halaqa || 'حلقة الفجر';

    document.getElementById('std-welcome-name').textContent = name;
    document.getElementById('std-profile-name').textContent = name;
    document.getElementById('std-profile-code').textContent = code;
    document.getElementById('std-name-input').value = name;
    document.getElementById('std-avatar-img').src = avatar;
    document.getElementById('std-halaqa-label').textContent = halaqa;

    document.getElementById('std-header-avatar').src = avatar;
    document.getElementById('std-dropdown-avatar').src = avatar;
    document.getElementById('std-dropdown-name').textContent = name;
    document.getElementById('std-dropdown-code').textContent = `الكود: ${code}`;

    const phoneEl = document.getElementById('std-profile-phone');
    if (phoneEl && currentStudent.phone) {
        phoneEl.textContent = `جوال ولي الأمر: ${currentStudent.phone}`;
        phoneEl.hidden = false;
    }
}

function renderProgress() {
    const stats = currentStudent.stats;
    const memorized = stats.pagesMemorized;
    const remaining = Math.max(0, KHATMA_PAGES - memorized);
    const percent = Math.min(100, Math.round((memorized / KHATMA_PAGES) * 100));

    document.getElementById('std-memorized-label').textContent = `${memorized} صفحة`;
    document.getElementById('std-remaining-label').textContent = `${remaining} صفحة`;
    document.getElementById('std-memorized-bar').style.width = `${percent}%`;
    document.getElementById('std-remaining-bar').style.width = `${100 - percent}%`;
    document.getElementById('std-khatma-percent').textContent = `${percent}%`;

    const ring = document.getElementById('std-khatma-ring');
    if (ring) ring.style.setProperty('--ring-deg', `${percent * 3.6}deg`);
}

function renderSchedule() {
    const stats = currentStudent.stats;
    const el = document.getElementById('std-tomorrow-schedule');
    if (!el) return;
    const latest = getLatestStudentRecord();
    const tomorrow = latest?.tomorrow || currentStudent.tomorrowAssignment || stats.tomorrowText;
    const last = latest?.recited || currentStudent.lastRecitation || '';
    if (tomorrow) {
        el.textContent = `تسميعك القادم: ${tomorrow}${last ? ` — آخر تسميع: ${last}` : ''} 📖`;
        return;
    }
    el.textContent = `جدولك لغدٍ: سورة ${stats.tomorrowSurah} من آية ${stats.tomorrowFrom} إلى آية ${stats.tomorrowTo} 📖`;
}

function renderReports() {
    const s = currentStudent.stats;
    const latest = getLatestStudentRecord();
    document.getElementById('std-weekly-progress').textContent = `${s.weeklyProgress}%`;
    document.getElementById('std-monthly-progress').textContent = `${s.monthlyProgress}%`;
    document.getElementById('std-weekly-attendance').textContent = `${s.weeklyAttendance}%`;
    document.getElementById('std-monthly-attendance').textContent = `${s.monthlyAttendance}%`;
    document.getElementById('std-weekly-bar').style.width = `${s.weeklyProgress}%`;
    document.getElementById('std-monthly-bar').style.width = `${s.monthlyProgress}%`;
    document.getElementById('std-weekly-att-bar').style.width = `${s.weeklyAttendance}%`;
    document.getElementById('std-monthly-att-bar').style.width = `${s.monthlyAttendance}%`;

    if (latest) {
        document.getElementById('std-weekly-progress').textContent = latest.grade === 'needs-review' ? 'مراجعة' : 'محدث';
        document.getElementById('std-monthly-progress').textContent = latest.recited;
    }
}

function buildLeaderboardEntries() {
    const approved = getApprovedStudents();
    const halaqa = currentStudent.halaqa || '';
    const pool = approved.length
        ? approved.filter((st) => !halaqa || !st.halaqa || st.halaqa === halaqa)
        : [];

    const entries = (pool.length ? pool : [
        { name: currentStudent.name, code: currentStudent.code },
        { name: 'أحمد عبد الله', code: 'demo1' },
        { name: 'محمد سعد', code: 'demo2' },
        { name: 'عبد الرحمن فيصل', code: 'demo3' },
        { name: 'خالد ناصر', code: 'demo4' }
    ]).map((st, index) => {
        const seed = hashCode(String(st.code || st.id || index));
        const score = st.code === currentStudent.code
            ? (currentStudent.stats?.score ?? 600 + (seed % 350))
            : 520 + (seed % 420);
        return {
            name: st.name || `طالب ${index + 1}`,
            code: String(st.code || ''),
            score,
            isMe: String(st.code) === String(currentStudent.code)
        };
    });

    if (!entries.some((e) => e.isMe)) {
        entries.push({
            name: currentStudent.name,
            code: currentStudent.code,
            score: currentStudent.stats.score,
            isMe: true
        });
    }

    entries.sort((a, b) => b.score - a.score);
    return entries.map((entry, i) => ({ ...entry, rank: i + 1 }));
}

function renderLeaderboard() {
    const entries = buildLeaderboardEntries();
    const myEntry = entries.find((e) => e.isMe) || entries[0];
    const total = entries.length;
    const rankWord = RANK_WORDS[myEntry.rank - 1] || `ال${myEntry.rank}`;
    const medal = RANK_MEDALS[myEntry.rank - 1] || '🎯';

    document.getElementById('std-rank-pill').textContent = `ترتيبك: ${rankWord} ${medal}`;
    document.getElementById('std-rank-summary').textContent =
        `ترتيبك الحالي: ${rankWord} ${medal} من بين ${total} طالباً`;

    const podium = document.getElementById('std-podium');
    if (podium) {
        const top3 = entries.slice(0, 3);
        podium.innerHTML = top3.map((entry, i) => `
            <div class="std-podium-item${i === 0 ? ' is-first' : ''}${entry.isMe ? ' is-me' : ''}">
                <span class="std-podium-medal">${RANK_MEDALS[i] || '🏅'}</span>
                <div class="std-podium-name">${escapeHtml(entry.name)}${entry.isMe ? ' (أنت)' : ''}</div>
                <div class="std-podium-score">${entry.score} نقطة</div>
            </div>
        `).join('');
    }

    const tbody = document.getElementById('std-leaderboard-body');
    if (!tbody) return;
    tbody.innerHTML = entries.map((entry) => `
        <tr class="${entry.isMe ? 'is-me' : ''}">
            <td>${entry.rank}</td>
            <td>${escapeHtml(entry.name)}${entry.isMe ? ' ⭐' : ''}</td>
            <td>${entry.score >= 850 ? 'ممتاز' : entry.score >= 700 ? 'جيد جداً' : 'جيد'}</td>
            <td>${entry.score}</td>
        </tr>
    `).join('');
}

function scrollToSection(sectionId) {
    closeUserDropdown();
    closeMobileSheet();
    const el = document.getElementById(sectionId);
    if (!el) return;
    setActiveSidebarLink(sectionId);
    el.classList.remove('is-section-focus');
    void el.offsetWidth;
    el.classList.add('is-section-focus');
    const headerH = document.getElementById('std-header')?.offsetHeight ?? 64;
    const top = el.getBoundingClientRect().top + window.scrollY - headerH - 16;
    window.scrollTo({ top, behavior: 'smooth' });
    setTimeout(() => el.classList.remove('is-section-focus'), 1400);
}

function setActiveSidebarLink(sectionId) {
    const map = {
        'student-home': 'std-nav-home',
        'std-profile-section': 'std-nav-profile',
        'std-progress-section': 'std-nav-progress',
        'std-schedule-section': 'std-nav-schedule',
        'std-leaderboard-section': 'std-nav-leaderboard'
    };
    document.querySelectorAll('.sidebar-navigation .std-icon-btn').forEach((btn) => {
        btn.classList.toggle('is-active', btn.id === map[sectionId]);
    });
}

function goStudentHome() {
    closeUserDropdown();
    closeMobileSheet();
    setActiveSidebarLink('student-home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeMobileSheet() {
    const sheet = document.getElementById('std-mobile-sheet');
    const btn = document.getElementById('std-mobile-nav-btn');
    sheet?.classList.remove('open');
    sheet?.setAttribute('aria-hidden', 'true');
    btn?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
}

function openMobileSheet() {
    closeUserDropdown();
    const sheet = document.getElementById('std-mobile-sheet');
    const btn = document.getElementById('std-mobile-nav-btn');
    sheet?.classList.add('open');
    sheet?.setAttribute('aria-hidden', 'false');
    btn?.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
}

function toggleMobileSheet() {
    const sheet = document.getElementById('std-mobile-sheet');
    if (sheet?.classList.contains('open')) closeMobileSheet();
    else openMobileSheet();
}

function closeUserDropdown() {
    const menu = document.getElementById('std-user-menu');
    const btn = document.getElementById('std-user-menu-btn');
    const dropdown = document.getElementById('std-user-dropdown');
    menu?.classList.remove('is-open');
    btn?.setAttribute('aria-expanded', 'false');
    if (dropdown) dropdown.hidden = true;
}

function openUserDropdown() {
    const menu = document.getElementById('std-user-menu');
    const btn = document.getElementById('std-user-menu-btn');
    const dropdown = document.getElementById('std-user-dropdown');
    menu?.classList.add('is-open');
    btn?.setAttribute('aria-expanded', 'true');
    if (dropdown) dropdown.hidden = false;
}

function toggleUserDropdown() {
    const menu = document.getElementById('std-user-menu');
    if (menu?.classList.contains('is-open')) closeUserDropdown();
    else openUserDropdown();
}

function applyStdDarkMode(dark) {
    document.body.classList.toggle('std-dark', dark);
    localStorage.setItem(STD_DARK_KEY, dark ? '1' : '0');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    const label = document.getElementById('std-theme-label');
    if (label) label.textContent = dark ? 'الوضع الصباحي' : 'الوضع الداكن';
}

function toggleStdDarkMode() {
    applyStdDarkMode(!document.body.classList.contains('std-dark'));
    showToast(document.body.classList.contains('std-dark') ? 'تم تفعيل الوضع الداكن' : 'تم تفعيل الوضع الصباحي');
}

function handleThemeToggle() {
    closeUserDropdown();
    toggleStdDarkMode();
}

function logoutStudent() {
    localStorage.removeItem(CURRENT_STUDENT_KEY);
    window.location.assign('index.html');
}

function initStudentHeader() {
    if (localStorage.getItem(STD_DARK_KEY) === '1') applyStdDarkMode(true);

    document.getElementById('std-brand-home')?.addEventListener('click', (e) => {
        e.preventDefault();
        goStudentHome();
    });

    document.getElementById('std-nav-home')?.addEventListener('click', goStudentHome);

    document.getElementById('std-user-menu-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMobileSheet();
        toggleUserDropdown();
    });

    document.getElementById('std-theme-toggle')?.addEventListener('click', handleThemeToggle);

    document.getElementById('std-settings-btn')?.addEventListener('click', () => {
        scrollToSection('std-profile-section');
    });

    document.getElementById('std-logout-btn')?.addEventListener('click', logoutStudent);

    document.getElementById('std-nav-profile')?.addEventListener('click', () => scrollToSection('std-profile-section'));
    document.getElementById('std-nav-progress')?.addEventListener('click', () => scrollToSection('std-progress-section'));
    document.getElementById('std-nav-schedule')?.addEventListener('click', () => scrollToSection('std-schedule-section'));
    document.getElementById('std-nav-leaderboard')?.addEventListener('click', () => scrollToSection('std-leaderboard-section'));
    setActiveSidebarLink('student-home');

    document.getElementById('std-mobile-nav-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMobileSheet();
    });

    document.getElementById('std-mobile-sheet-close')?.addEventListener('click', closeMobileSheet);

    document.getElementById('std-mobile-sheet')?.addEventListener('click', (e) => {
        if (e.target.id === 'std-mobile-sheet') closeMobileSheet();
    });

    document.querySelectorAll('.std-mobile-sheet-link').forEach((link) => {
        link.addEventListener('click', () => scrollToSection(link.dataset.target));
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#std-user-menu')) closeUserDropdown();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeUserDropdown();
            closeMobileSheet();
        }
    });
}

function initProfileActions() {
    document.getElementById('std-save-name-btn')?.addEventListener('click', () => {
        const name = document.getElementById('std-name-input')?.value.trim() ?? '';
        if (name.length < 4) {
            showToast('الاسم قصير جداً — اكتب اسمك الكامل');
            return;
        }
        currentStudent.name = name;
        saveCurrentStudent();
        syncNameToApprovedList(name);
        renderProfile();
        renderLeaderboard();
        showToast('تم تحديث اسمك بنجاح!');
    });

    document.getElementById('std-avatar-input')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file || !file.type.startsWith('image/')) {
            showToast('اختر صورة صالحة');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            showToast('حجم الصورة كبير — الحد 2 ميجابايت');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            currentStudent.avatar = reader.result;
            saveCurrentStudent();
            renderProfile();
            showToast('تم تحديث صورتك الشخصية!');
        };
        reader.readAsDataURL(file);
    });
}

function renderDashboard() {
    syncCurrentStudentFromApprovedList();
    ensureStudentStats();
    renderProfile();
    renderProgress();
    renderSchedule();
    renderReports();
    renderLeaderboard();
}

document.addEventListener('DOMContentLoaded', () => {
    if (!requireStudentAuth()) return;
    initStudentHeader();
    initProfileActions();
    renderDashboard();
});
