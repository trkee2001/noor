const SESSION_KEY = 'qmza_session';
const STUDENTS_KEY = 'dash_students';
const RECITATION_KEY = 'recitation_records';
const KHATMA_PAGES = 604;

const HALAQA_LABELS = {
    fajr: 'حلقة الفجر',
    duha: 'حلقة الضحى',
    asr: 'حلقة العصر',
    maghrib: 'حلقة المغرب'
};

const GRADE_LABELS = {
    excellent: 'ممتاز',
    'very-good': 'جيد جداً',
    'needs-review': 'يحتاج مراجعة'
};

const QURAN_SURAHS = [
    { number: 1, name: 'الفاتحة', ayahs: 7 },
    { number: 2, name: 'البقرة', ayahs: 286 },
    { number: 3, name: 'آل عمران', ayahs: 200 },
    { number: 4, name: 'النساء', ayahs: 176 },
    { number: 5, name: 'المائدة', ayahs: 120 },
    { number: 6, name: 'الأنعام', ayahs: 165 },
    { number: 7, name: 'الأعراف', ayahs: 206 },
    { number: 8, name: 'الأنفال', ayahs: 75 },
    { number: 9, name: 'التوبة', ayahs: 129 },
    { number: 10, name: 'يونس', ayahs: 109 },
    { number: 11, name: 'هود', ayahs: 123 },
    { number: 12, name: 'يوسف', ayahs: 111 },
    { number: 13, name: 'الرعد', ayahs: 43 },
    { number: 14, name: 'إبراهيم', ayahs: 52 },
    { number: 15, name: 'الحجر', ayahs: 99 },
    { number: 16, name: 'النحل', ayahs: 128 },
    { number: 17, name: 'الإسراء', ayahs: 111 },
    { number: 18, name: 'الكهف', ayahs: 110 },
    { number: 19, name: 'مريم', ayahs: 98 },
    { number: 20, name: 'طه', ayahs: 135 },
    { number: 21, name: 'الأنبياء', ayahs: 112 },
    { number: 22, name: 'الحج', ayahs: 78 },
    { number: 23, name: 'المؤمنون', ayahs: 118 },
    { number: 24, name: 'النور', ayahs: 64 },
    { number: 25, name: 'الفرقان', ayahs: 77 },
    { number: 26, name: 'الشعراء', ayahs: 227 },
    { number: 27, name: 'النمل', ayahs: 93 },
    { number: 28, name: 'القصص', ayahs: 88 },
    { number: 29, name: 'العنكبوت', ayahs: 69 },
    { number: 30, name: 'الروم', ayahs: 60 },
    { number: 31, name: 'لقمان', ayahs: 34 },
    { number: 32, name: 'السجدة', ayahs: 30 },
    { number: 33, name: 'الأحزاب', ayahs: 73 },
    { number: 34, name: 'سبأ', ayahs: 54 },
    { number: 35, name: 'فاطر', ayahs: 45 },
    { number: 36, name: 'يس', ayahs: 83 },
    { number: 37, name: 'الصافات', ayahs: 182 },
    { number: 38, name: 'ص', ayahs: 88 },
    { number: 39, name: 'الزمر', ayahs: 75 },
    { number: 40, name: 'غافر', ayahs: 85 },
    { number: 41, name: 'فصلت', ayahs: 54 },
    { number: 42, name: 'الشورى', ayahs: 53 },
    { number: 43, name: 'الزخرف', ayahs: 89 },
    { number: 44, name: 'الدخان', ayahs: 59 },
    { number: 45, name: 'الجاثية', ayahs: 37 },
    { number: 46, name: 'الأحقاف', ayahs: 35 },
    { number: 47, name: 'محمد', ayahs: 38 },
    { number: 48, name: 'الفتح', ayahs: 29 },
    { number: 49, name: 'الحجرات', ayahs: 18 },
    { number: 50, name: 'ق', ayahs: 45 },
    { number: 51, name: 'الذاريات', ayahs: 60 },
    { number: 52, name: 'الطور', ayahs: 49 },
    { number: 53, name: 'النجم', ayahs: 62 },
    { number: 54, name: 'القمر', ayahs: 55 },
    { number: 55, name: 'الرحمن', ayahs: 78 },
    { number: 56, name: 'الواقعة', ayahs: 96 },
    { number: 57, name: 'الحديد', ayahs: 29 },
    { number: 58, name: 'المجادلة', ayahs: 22 },
    { number: 59, name: 'الحشر', ayahs: 24 },
    { number: 60, name: 'الممتحنة', ayahs: 13 },
    { number: 61, name: 'الصف', ayahs: 14 },
    { number: 62, name: 'الجمعة', ayahs: 11 },
    { number: 63, name: 'المنافقون', ayahs: 11 },
    { number: 64, name: 'التغابن', ayahs: 18 },
    { number: 65, name: 'الطلاق', ayahs: 12 },
    { number: 66, name: 'التحريم', ayahs: 12 },
    { number: 67, name: 'الملك', ayahs: 30 },
    { number: 68, name: 'القلم', ayahs: 52 },
    { number: 69, name: 'الحاقة', ayahs: 52 },
    { number: 70, name: 'المعارج', ayahs: 44 },
    { number: 71, name: 'نوح', ayahs: 28 },
    { number: 72, name: 'الجن', ayahs: 28 },
    { number: 73, name: 'المزمل', ayahs: 20 },
    { number: 74, name: 'المدثر', ayahs: 56 },
    { number: 75, name: 'القيامة', ayahs: 40 },
    { number: 76, name: 'الإنسان', ayahs: 31 },
    { number: 77, name: 'المرسلات', ayahs: 50 },
    { number: 78, name: 'النبأ', ayahs: 40 },
    { number: 79, name: 'النازعات', ayahs: 46 },
    { number: 80, name: 'عبس', ayahs: 42 },
    { number: 81, name: 'التكوير', ayahs: 29 },
    { number: 82, name: 'الانفطار', ayahs: 19 },
    { number: 83, name: 'المطففين', ayahs: 36 },
    { number: 84, name: 'الانشقاق', ayahs: 25 },
    { number: 85, name: 'البروج', ayahs: 22 },
    { number: 86, name: 'الطارق', ayahs: 17 },
    { number: 87, name: 'الأعلى', ayahs: 19 },
    { number: 88, name: 'الغاشية', ayahs: 26 },
    { number: 89, name: 'الفجر', ayahs: 30 },
    { number: 90, name: 'البلد', ayahs: 20 },
    { number: 91, name: 'الشمس', ayahs: 15 },
    { number: 92, name: 'الليل', ayahs: 21 },
    { number: 93, name: 'الضحى', ayahs: 11 },
    { number: 94, name: 'الشرح', ayahs: 8 },
    { number: 95, name: 'التين', ayahs: 8 },
    { number: 96, name: 'العلق', ayahs: 19 },
    { number: 97, name: 'القدر', ayahs: 5 },
    { number: 98, name: 'البينة', ayahs: 8 },
    { number: 99, name: 'الزلزلة', ayahs: 8 },
    { number: 100, name: 'العاديات', ayahs: 11 },
    { number: 101, name: 'القارعة', ayahs: 11 },
    { number: 102, name: 'التكاثر', ayahs: 8 },
    { number: 103, name: 'العصر', ayahs: 3 },
    { number: 104, name: 'الهمزة', ayahs: 9 },
    { number: 105, name: 'الفيل', ayahs: 5 },
    { number: 106, name: 'قريش', ayahs: 4 },
    { number: 107, name: 'الماعون', ayahs: 7 },
    { number: 108, name: 'الكوثر', ayahs: 3 },
    { number: 109, name: 'الكافرون', ayahs: 6 },
    { number: 110, name: 'النصر', ayahs: 3 },
    { number: 111, name: 'المسد', ayahs: 5 },
    { number: 112, name: 'الإخلاص', ayahs: 4 },
    { number: 113, name: 'الفلق', ayahs: 5 },
    { number: 114, name: 'الناس', ayahs: 6 }
];

let teacherSession = null;

function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
}

function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function requireTeacherAuth() {
    const session = getSession();
    if (!session?.loggedIn || !session?.authToken) {
        window.location.replace('dashboard-login.html');
        return false;
    }
    if (session.role === 'teacher') {
        teacherSession = session;
        return true;
    }
    if (session.role === 'admin' || !session.role) {
        teacherSession = {
            ...session,
            role: 'admin-preview',
            teacherId: 'admin-preview',
            name: session.name || 'مشرف النظام',
            halaqat: []
        };
        return true;
    }
    window.location.replace('dashboard-login.html');
    return false;
}

function getStudents() {
    try {
        const list = JSON.parse(localStorage.getItem(STUDENTS_KEY) || '[]');
        return Array.isArray(list) ? list : [];
    } catch { return []; }
}

function saveStudents(students) {
    localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));
    localStorage.setItem('approved_students', JSON.stringify(students));
}

function getRecords() {
    try {
        const list = JSON.parse(localStorage.getItem(RECITATION_KEY) || '[]');
        return Array.isArray(list) ? list : [];
    } catch { return []; }
}

function saveRecords(records) {
    localStorage.setItem(RECITATION_KEY, JSON.stringify(records));
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getSurahByNumber(number) {
    return QURAN_SURAHS.find((surah) => String(surah.number) === String(number)) || QURAN_SURAHS[0];
}

function populateSurahSelect(selectId, defaultNumber = 18) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = QURAN_SURAHS.map((surah) => (
        `<option value="${surah.number}">${surah.number}. ${escapeHtml(surah.name)} (${surah.ayahs} آية)</option>`
    )).join('');
    select.value = String(defaultNumber);
}

function updateAyahLimits(prefix) {
    const surah = getSurahByNumber(document.getElementById(`${prefix}-surah-select`)?.value);
    const fromInput = document.getElementById(`${prefix}-from-input`);
    const toInput = document.getElementById(`${prefix}-to-input`);
    if (!fromInput || !toInput || !surah) return;

    [fromInput, toInput].forEach((input) => {
        input.max = String(surah.ayahs);
        input.min = '1';
        if (!input.value || Number(input.value) < 1) input.value = '1';
        if (Number(input.value) > surah.ayahs) input.value = String(surah.ayahs);
    });

    if (Number(fromInput.value) > Number(toInput.value)) {
        toInput.value = fromInput.value;
    }
}

function setFullSurah(prefix) {
    const surah = getSurahByNumber(document.getElementById(`${prefix}-surah-select`)?.value);
    const fromInput = document.getElementById(`${prefix}-from-input`);
    const toInput = document.getElementById(`${prefix}-to-input`);
    if (!fromInput || !toInput || !surah) return;
    fromInput.value = '1';
    toInput.value = String(surah.ayahs);
}

function buildSurahRange(prefix) {
    const surah = getSurahByNumber(document.getElementById(`${prefix}-surah-select`)?.value);
    const from = Number(document.getElementById(`${prefix}-from-input`)?.value || 1);
    const to = Number(document.getElementById(`${prefix}-to-input`)?.value || 1);
    if (!surah || from < 1 || to < from || to > surah.ayahs) return '';
    if (from === 1 && to === surah.ayahs) return `سورة ${surah.name} كاملة (${surah.ayahs} آية)`;
    return `سورة ${surah.name} من آية ${from} إلى آية ${to}`;
}

function teacherHalaqat() {
    return Array.isArray(teacherSession?.halaqat) ? teacherSession.halaqat : [];
}

function normalizeHalaqa(value) {
    return String(value || '').trim();
}

function getTeacherStudents() {
    const allowed = teacherHalaqat();
    const students = getStudents();
    if (!allowed.length) return students;
    return students.filter((student) => {
        const halaqa = normalizeHalaqa(student.halaqa);
        return !halaqa || allowed.includes(halaqa);
    });
}

function showToast(msg) {
    const el = document.getElementById('teacher-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => el.classList.remove('show'), 3000);
}

function formatHalaqa(value) {
    return HALAQA_LABELS[value] || value || 'غير محددة';
}

function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function latestRecordFor(code) {
    return getRecords()
        .filter((record) => String(record.studentCode) === String(code))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
}

function renderTeacherHeader() {
    const name = teacherSession?.name || 'مدرس الحلقة';
    document.getElementById('teacher-header-name').textContent = name;
    document.getElementById('teacher-welcome').textContent = name;
    document.getElementById('teacher-halaqat-list').textContent =
        teacherHalaqat().map(formatHalaqa).join('، ') || 'كل الحلقات';
}

function renderHalaqaFilter() {
    const select = document.getElementById('teacher-halaqa-filter');
    if (!select) return;
    const halaqat = teacherHalaqat();
    const options = [
        '<option value="">كل الحلقات</option>',
        ...halaqat.map((key) => `<option value="${escapeHtml(key)}">${escapeHtml(formatHalaqa(key))}</option>`)
    ];
    select.innerHTML = options.join('');
}

function filteredStudents() {
    const selected = document.getElementById('teacher-halaqa-filter')?.value || '';
    const students = getTeacherStudents();
    return selected ? students.filter((student) => normalizeHalaqa(student.halaqa) === selected) : students;
}

function renderStudentSelect() {
    const select = document.getElementById('teacher-student-select');
    if (!select) return;
    const students = filteredStudents();
    if (!students.length) {
        select.innerHTML = '<option value="">لا يوجد طلاب</option>';
        return;
    }
    select.innerHTML = students.map((student) => (
        `<option value="${escapeHtml(student.code)}">${escapeHtml(student.name)} — ${escapeHtml(student.code)}</option>`
    )).join('');
}

function renderStudentsTable() {
    const tbody = document.getElementById('teacher-students-body');
    const count = document.getElementById('teacher-student-count');
    if (!tbody) return;
    const students = filteredStudents();
    if (count) count.textContent = `${students.length} طالب`;
    if (!students.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="teacher-empty">لا يوجد طلاب في الحلقات المحددة.</td></tr>';
        return;
    }
    tbody.innerHTML = students.map((student) => {
        const latest = latestRecordFor(student.code);
        return `
            <tr>
                <td><strong>${escapeHtml(student.name)}</strong></td>
                <td dir="ltr">${escapeHtml(student.code || '—')}</td>
                <td>${escapeHtml(formatHalaqa(student.halaqa))}</td>
                <td>${escapeHtml(latest?.recited || student.lastRecitation || 'لم يسجل بعد')}</td>
                <td>${escapeHtml(latest?.tomorrow || student.tomorrowAssignment || 'غير محدد')}</td>
            </tr>
        `;
    }).join('');
}

function renderRecordsTable() {
    const tbody = document.getElementById('teacher-records-body');
    if (!tbody) return;
    const codes = new Set(getTeacherStudents().map((student) => String(student.code)));
    const records = getRecords()
        .filter((record) => codes.has(String(record.studentCode)))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (!records.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="teacher-empty">لا توجد سجلات تسميع بعد.</td></tr>';
        return;
    }
    tbody.innerHTML = records.map((record) => `
        <tr>
            <td>${escapeHtml(formatDate(record.createdAt))}</td>
            <td>${escapeHtml(record.studentName || record.studentCode)}</td>
            <td>${escapeHtml(record.recited)}</td>
            <td>${escapeHtml(GRADE_LABELS[record.grade] || record.grade)}</td>
            <td>${escapeHtml(record.note || '—')}</td>
        </tr>
    `).join('');
}

function renderKpis() {
    const students = getTeacherStudents();
    const records = getRecords();
    const today = new Date().toISOString().slice(0, 10);
    const codes = new Set(students.map((student) => String(student.code)));
    const todayRecords = records.filter((record) => (
        codes.has(String(record.studentCode)) &&
        String(record.createdAt || '').slice(0, 10) === today
    ));
    document.getElementById('teacher-kpi-students').textContent = students.length;
    document.getElementById('teacher-kpi-halaqat').textContent = teacherHalaqat().length || 'كل';
    document.getElementById('teacher-kpi-today').textContent = todayRecords.length;
    document.getElementById('teacher-kpi-follow').textContent =
        records.filter((record) => codes.has(String(record.studentCode)) && record.grade === 'needs-review').length;
}

function updateStudentAfterRecord(record) {
    const students = getStudents();
    const index = students.findIndex((student) => String(student.code) === String(record.studentCode));
    if (index === -1) return;
    const currentStats = students[index].stats || {};
    const nextPages = Math.min(KHATMA_PAGES, Number(currentStats.pagesMemorized || 0) + 2);
    students[index] = {
        ...students[index],
        lastRecitation: record.recited,
        lastRecitationGrade: record.grade,
        lastRecitationAt: record.createdAt,
        tomorrowAssignment: record.tomorrow,
        teacherNote: record.note,
        stats: {
            ...currentStats,
            pagesMemorized: nextPages,
            tomorrowText: record.tomorrow,
            lastRecitation: record.recited,
            lastGrade: record.grade,
            lastNote: record.note
        }
    };
    saveStudents(students);
}

function initRecitationForm() {
    document.getElementById('teacher-recitation-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const code = document.getElementById('teacher-student-select')?.value;
        const recited = buildSurahRange('teacher-recited');
        const grade = document.getElementById('teacher-grade-select')?.value;
        const tomorrow = buildSurahRange('teacher-tomorrow');
        const note = document.getElementById('teacher-note-input')?.value.trim();
        const student = getTeacherStudents().find((item) => String(item.code) === String(code));
        if (!student || !recited || !tomorrow) {
            showToast('اختر الطالب وأكمل بيانات التسميع وواجب الغد');
            return;
        }
        const record = {
            id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            teacherId: teacherSession.teacherId,
            teacherName: teacherSession.name,
            studentCode: student.code,
            studentName: student.name,
            halaqa: student.halaqa,
            recited,
            grade,
            tomorrow,
            note,
            createdAt: new Date().toISOString()
        };
        const records = getRecords();
        records.push(record);
        saveRecords(records);
        updateStudentAfterRecord(record);
        e.target.reset();
        renderAll();
        showToast(`تم حفظ تسميع ${student.name}`);
    });
}

function switchPanel(panel) {
    document.querySelectorAll('.teacher-panel').forEach((item) => {
        item.classList.toggle('active', item.dataset.panel === panel);
    });
    document.querySelectorAll('.teacher-nav-link').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.panel === panel);
    });
}

function renderAll() {
    renderTeacherHeader();
    renderHalaqaFilter();
    renderStudentSelect();
    renderStudentsTable();
    renderRecordsTable();
    renderKpis();
}

function initSurahControls() {
    populateSurahSelect('teacher-recited-surah-select', 18);
    populateSurahSelect('teacher-tomorrow-surah-select', 19);
    updateAyahLimits('teacher-recited');
    updateAyahLimits('teacher-tomorrow');

    ['teacher-recited', 'teacher-tomorrow'].forEach((prefix) => {
        document.getElementById(`${prefix}-surah-select`)?.addEventListener('change', () => {
            updateAyahLimits(prefix);
        });
        document.getElementById(`${prefix}-from-input`)?.addEventListener('input', () => updateAyahLimits(prefix));
        document.getElementById(`${prefix}-to-input`)?.addEventListener('input', () => updateAyahLimits(prefix));
        document.getElementById(`${prefix}-full-btn`)?.addEventListener('click', () => setFullSurah(prefix));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (!requireTeacherAuth()) return;
    initSurahControls();
    renderAll();
    initRecitationForm();
    document.getElementById('teacher-halaqa-filter')?.addEventListener('change', () => {
        renderStudentSelect();
        renderStudentsTable();
    });
    document.querySelectorAll('.teacher-nav-link').forEach((btn) => {
        btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
    });
    document.getElementById('teacher-logout-btn')?.addEventListener('click', () => {
        const session = getSession() || {};
        saveSession({ ...session, loggedIn: false, authToken: '', role: '' });
        window.location.href = 'dashboard-login.html';
    });
});
