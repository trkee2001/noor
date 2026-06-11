/* =====================================================================
   لوحة تحكم مجمع الزبير — dashboard.js (SPA مستقل)
   ===================================================================== */

const DESKTOP_BP = 769;
const AUTH_SESSION_KEY = 'qmza_session';
const SUPABASE_URL = 'https://fdgbvwdfoqtlqgrdqkkm.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_vzX7qivLBBjHlvHwpK5Cbw_nBxL_lop';
const SUPABASE_TABLE_STUDENTS = 'students';
const SUPABASE_TABLE_NEW_REQUESTS = 'new_students_requests';
const SUPABASE_TABLE_ARCHIVED = 'archived_student_requests';
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) ?? null;

const REQUESTS_CHUNK_SIZE = 10;
const REQUESTS_INITIAL_SKELETON_MS = 70;
const REQUESTS_LOAD_DELAY_MS = 120;
let pendingVisibleCount = REQUESTS_CHUNK_SIZE;
let archivedVisibleCount = REQUESTS_CHUNK_SIZE;
let pendingLoadingMore = false;
let archivedLoadingMore = false;
let pendingRevealToken = 0;
let archivedRevealToken = 0;
let pendingScrollObserver = null;
let archivedScrollObserver = null;
let pendingPresentationPromise = null;

const DASH_ACTIVE_TAB_KEY = 'dash_active_tab';
const DASH_REQUESTS_VIEW_KEY = 'dash_requests_view';
const DASH_VALID_TABS = [
    'overview',
    'students',
    'halaqat',
    'new-requests',
    'parents',
    'teachers',
    'content',
    'ads'
];

let requestsCache = null;
let studentsCache = null;
let archivedRequestsCache = null;
let bannerAdsCache = null;
let bannerOverlayCache = null;

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

function getStudentsLocal() {
    try {
        const primary = JSON.parse(localStorage.getItem('dash_students') || '[]');
        if (Array.isArray(primary) && primary.length) return primary;
        const legacy = JSON.parse(localStorage.getItem('approved_students') || '[]');
        return Array.isArray(legacy) ? legacy : [];
    } catch { return []; }
}

function getStudents() {
    if (studentsCache !== null) return studentsCache;
    return getStudentsLocal();
}

function saveStudents(list) {
    localStorage.setItem('dash_students', JSON.stringify(list));
    localStorage.setItem('approved_students', JSON.stringify(list));
    studentsCache = list;
}

function studentRecordKey(student) {
    if (student?.id) return `id:${student.id}`;
    if (student?.code) return `code:${student.code}`;
    return `name:${student?.name || ''}`;
}

function mergeStudentRecords(existing, incoming) {
    return {
        ...existing,
        ...incoming,
        id: incoming.id || existing.id,
        code: incoming.code || existing.code,
        memorization: incoming.memorization || existing.memorization || '',
        age: incoming.age ?? existing.age ?? null,
        password: extractRecordPassword(incoming) || extractRecordPassword(existing),
        level: incoming.level || existing.level || memorizationToLevel(incoming.memorization || existing.memorization)
    };
}

function mergeStudentsLists(local, remote) {
    const map = new Map();
    [...(remote || []), ...(local || [])].forEach((student) => {
        const key = studentRecordKey(student);
        const prev = map.get(key);
        map.set(key, prev ? mergeStudentRecords(prev, student) : student);
    });
    return [...map.values()];
}

function buildApprovedStudentRecord({
    name,
    phone,
    password,
    memorization = '',
    age = null,
    halaqa = 'fajr',
    fromRequestId = null,
    now = new Date()
}) {
    return {
        id: createStudentRecordId(),
        name,
        code: generateStudentCode(),
        phone,
        password: password || DEFAULT_STUDENT_PASSWORD,
        memorization,
        level: memorizationToLevel(memorization),
        age,
        halaqa,
        approvedAt: now.toISOString(),
        approvedLabel: formatApprovedLabel(now),
        fromRequestId
    };
}

function studentToDbPayload(student) {
    return {
        name: student.name,
        code: student.code,
        phone: student.phone,
        password: resolveStudentPassword(student),
        halaqa: student.halaqa || '',
        level: student.level || memorizationToLevel(student.memorization),
        age: student.age ?? null,
        approved_at: student.approvedAt || new Date().toISOString()
    };
}

function upsertStudentLocal(student) {
    const students = getStudentsLocal();
    const key = studentRecordKey(student);
    const index = students.findIndex((item) => studentRecordKey(item) === key);
    if (index >= 0) students[index] = mergeStudentRecords(students[index], student);
    else students.push(student);
    saveStudents(students);
    return student;
}

async function persistStudentRecord(student) {
    upsertStudentLocal(student);
    if (!supabaseClient) return { ok: true, local: true };

    const { error } = await supabaseClient
        .from(SUPABASE_TABLE_STUDENTS)
        .insert(studentToDbPayload(student));

    if (error) {
        console.error('Supabase student insert failed:', error);
        return { ok: false, local: true, error };
    }
    return { ok: true, local: true, remote: true };
}

const STUDENT_PASS_REGEX = /^(?=.*[a-z])(?=.*[0-9])[a-z0-9]{8,}$/;
const DEFAULT_STUDENT_COUNTRY_CODE = '967';
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
const ARCHIVED_REQUESTS_KEY = 'archived_student_requests';
const ARCHIVE_RETENTION_DAYS = 30;
const ARCHIVE_RETENTION_MS = ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const BANNER_ADS_KEY = 'qmza_banner_ads';
const BANNER_OVERLAY_KEY = 'qmza_banner_overlay';
const TOP_BAR_ADS_KEY = 'qmza_top_bar_ads';
const TOP_BAR_ADS_MAX = 3;
const TOP_BAR_TEXT_MAX = 100;
const TOP_BAR_TAG_MAX = 12;

const DEFAULT_TOP_BAR_ADS = [
    { tag: 'جديد', text: 'بدء التسجيل في الدورة القرآنية الصيفية المكثفة.' },
    { tag: 'تكريم', text: 'تكريم الطلاب المتميزين يوم الخميس بعد صلاة العصر.' },
    { tag: 'رحلة', text: 'رحلة ترفيهية للطلاب الملتزمين يوم السبت القادم.' }
];
const TEACHERS_KEY = 'teacher_accounts';
const DEFAULT_BANNER_IMAGE = 'watermarked_img_14204941598938561939.png';
const HALAQA_LABELS = {
    fajr: 'حلقة الفجر',
    duha: 'حلقة الضحى',
    asr: 'حلقة العصر',
    maghrib: 'حلقة المغرب'
};
const MEMORIZATION_LABELS = {
    none: 'مبتدئ — لا يحفظ',
    juz30: 'جزء عمّ',
    'juz1-5': 'من 1 إلى 5 أجزاء',
    'juz6-10': 'من 6 إلى 10 أجزاء',
    'juz11-20': 'من 11 إلى 20 جزءاً',
    full: 'حافظ للقرآن كاملاً'
};
const HALAQA_KEYS = Object.keys(HALAQA_LABELS);

function normalizeStudentHalaqaKey(halaqa) {
    const raw = String(halaqa || '').trim();
    if (!raw) return '';
    if (HALAQA_LABELS[raw]) return raw;
    const byLabel = HALAQA_KEYS.find((key) => HALAQA_LABELS[key] === raw);
    if (byLabel) return byLabel;
    const short = raw.replace(/^حلقة\s+/u, '');
    return HALAQA_KEYS.find((key) => HALAQA_LABELS[key].includes(short)) || '';
}

function getTeachersForHalaqa(key) {
    return getTeacherAccounts().filter((teacher) => (
        Array.isArray(teacher.halaqat) && teacher.halaqat.includes(key)
    ));
}

function renderHalaqatOverview() {
    const grid = document.getElementById('halaqat-overview-grid');
    if (!grid) return;

    const students = getStudentsNormalized();
    grid.innerHTML = HALAQA_KEYS.map((key) => {
        const count = students.filter((st) => normalizeStudentHalaqaKey(st.halaqa) === key).length;
        const teachers = getTeachersForHalaqa(key);
        const teacherNames = teachers.length
            ? teachers.map((teacher) => teacher.name).join('، ')
            : 'لم يُعيَّن مدرس';

        return `
        <article class="dash-kpi">
            <div class="dash-kpi-label">${escapeHtml(HALAQA_LABELS[key])}</div>
            <div class="dash-kpi-value">${count}</div>
            <div class="dash-kpi-trend">${escapeHtml(teacherNames)}</div>
        </article>
        `;
    }).join('');
}

function renderHalaqatPanel() {
    renderHalaqatOverview();
}

function getNewStudentRequestsLocal() {
    try { return JSON.parse(localStorage.getItem(NEW_REQUESTS_KEY) || '[]'); }
    catch { return []; }
}

function getNewStudentRequests() {
    if (requestsCache !== null) return requestsCache;
    return getNewStudentRequestsLocal();
}

function saveNewStudentRequests(list) {
    localStorage.setItem(NEW_REQUESTS_KEY, JSON.stringify(list));
    requestsCache = list;
}

const PROCESSED_REQUESTS_KEY = 'dash_processed_request_ids';

function getProcessedRequestIds() {
    try {
        return new Set(JSON.parse(localStorage.getItem(PROCESSED_REQUESTS_KEY) || '[]').map(String));
    } catch {
        return new Set();
    }
}

function markRequestsProcessed(ids) {
    if (!ids?.length) return;
    const set = getProcessedRequestIds();
    ids.forEach((id) => set.add(String(normalizeRequestId(id))));
    localStorage.setItem(PROCESSED_REQUESTS_KEY, JSON.stringify([...set]));
}

function unmarkRequestsProcessed(ids) {
    if (!ids?.length) return;
    const set = getProcessedRequestIds();
    ids.forEach((id) => set.delete(String(normalizeRequestId(id))));
    localStorage.setItem(PROCESSED_REQUESTS_KEY, JSON.stringify([...set]));
}

function filterProcessedRequests(list) {
    const processed = getProcessedRequestIds();
    return (list || []).filter((req) => !processed.has(String(req.id)));
}

function syncProcessedRequestsFromStudents() {
    const students = getStudentsLocal();
    const ids = students.map((st) => st.fromRequestId).filter(Boolean);
    if (ids.length) markRequestsProcessed(ids);
}

function mergeRequestRecords(remote, local) {
    if (!remote) return local;
    if (!local) return remote;
    return {
        ...remote,
        ...local,
        age: local.age ?? remote.age,
        memorization: local.memorization || remote.memorization
    };
}

function mergeRequestsLists(local, remote) {
    const byId = new Map();
    (remote || []).forEach((req) => byId.set(String(req.id), req));
    (local || []).forEach((req) => {
        const id = String(req.id);
        byId.set(id, mergeRequestRecords(byId.get(id), req));
    });
    return filterProcessedRequests([...byId.values()]);
}

async function deleteRequestsFromDb(ids) {
    if (!supabaseClient || !ids?.length) return;
    await Promise.all([...ids].map(async (id) => {
        const normalizedId = normalizeRequestId(id);
        const { error } = await supabaseClient
            .from(SUPABASE_TABLE_NEW_REQUESTS)
            .delete()
            .eq('id', normalizedId);
        if (error) console.error('Supabase request delete failed:', normalizedId, error);
    }));
}

const REQUEST_META_SEP = ' || ';
const REQUEST_META_CACHE_KEY = 'qmza_request_meta_by_id';

function getRequestMetaCache() {
    try {
        return JSON.parse(localStorage.getItem(REQUEST_META_CACHE_KEY) || '{}');
    } catch {
        return {};
    }
}

function applyRequestMetaCache(requests) {
    const cache = getRequestMetaCache();
    return requests.map((req) => {
        const cached = cache[String(req.id)];
        const hasAge = req.age != null && req.age !== '';
        const hasMem = Boolean(req.memorization);
        if (!cached || (hasAge && hasMem)) return req;
        return {
            ...req,
            age: hasAge ? req.age : (cached.age ?? req.age),
            memorization: hasMem ? req.memorization : (cached.memorization || req.memorization)
        };
    });
}

function parseRequestMetaFromLabel(submittedLabel, row = {}) {
    const ageFromRow = row.age ?? null;
    const memFromRow = row.memorization || '';
    if ((ageFromRow != null && ageFromRow !== '') || memFromRow) {
        const display = String(submittedLabel || '').split(REQUEST_META_SEP)[0];
        return {
            submittedLabel: display || submittedLabel || '',
            age: ageFromRow,
            memorization: memFromRow
        };
    }

    const raw = String(submittedLabel || '');
    let parts = raw.split(REQUEST_META_SEP);
    if (parts.length < 3 && raw.includes('\x1E')) {
        parts = raw.split('\x1E');
    }
    if (parts.length >= 3) {
        const parsedAge = parts[1] !== '' ? parseInt(parts[1], 10) : null;
        return {
            submittedLabel: parts[0],
            age: Number.isFinite(parsedAge) ? parsedAge : null,
            memorization: parts[2] || ''
        };
    }

    return {
        submittedLabel: submittedLabel || '',
        age: null,
        memorization: ''
    };
}

function mapRequestFromDb(row) {
    const meta = parseRequestMetaFromLabel(row.submitted_label || row.submitted_at || '', row);
    return {
        id: row.id,
        name: row.name || '',
        phone: row.phone || '',
        countryCode: row.country_code || '+967',
        password: row.password || '',
        age: meta.age,
        memorization: meta.memorization,
        submittedAt: row.submitted_at || '',
        submittedLabel: meta.submittedLabel || row.submitted_at || ''
    };
}

function getArchivedRequestsLocal() {
    try {
        const list = JSON.parse(localStorage.getItem(ARCHIVED_REQUESTS_KEY) || '[]');
        return Array.isArray(list) ? list : [];
    } catch { return []; }
}

function saveArchivedRequestsLocal(list) {
    localStorage.setItem(ARCHIVED_REQUESTS_KEY, JSON.stringify(list));
    archivedRequestsCache = list;
}

function getArchivedRequests() {
    if (archivedRequestsCache !== null) return archivedRequestsCache;
    return getArchivedRequestsLocal();
}

function mapArchivedFromDb(row) {
    const base = mapRequestFromDb(row);
    const deleteAfter = row.delete_after || '';
    return {
        ...base,
        rejectedAt: row.rejected_at || '',
        rejectedLabel: row.rejected_label || row.rejected_at || '',
        deleteAfter,
        deleteAfterLabel: deleteAfter
            ? new Date(deleteAfter).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })
            : ''
    };
}

function mapArchivedToDb(record) {
    const storageLabel = `${record.submittedLabel || ''}${REQUEST_META_SEP}${record.age ?? ''}${REQUEST_META_SEP}${record.memorization ?? ''}`;
    return {
        id: normalizeRequestId(record.id),
        name: record.name || '',
        phone: record.phone || '',
        country_code: record.countryCode || '+967',
        password: record.password || '',
        age: record.age ?? null,
        memorization: record.memorization || '',
        submitted_at: record.submittedAt || null,
        submitted_label: storageLabel,
        rejected_at: record.rejectedAt,
        delete_after: record.deleteAfter
    };
}

function buildArchiveRecord(req) {
    const now = new Date();
    const deleteAfter = new Date(now.getTime() + ARCHIVE_RETENTION_MS);
    return {
        ...req,
        rejectedAt: now.toISOString(),
        rejectedLabel: formatApprovedLabel(now),
        deleteAfter: deleteAfter.toISOString(),
        deleteAfterLabel: deleteAfter.toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    };
}

async function fetchArchivedFromDb() {
    if (!supabaseClient) return getArchivedRequestsLocal();

    const { data, error } = await supabaseClient
        .from(SUPABASE_TABLE_ARCHIVED)
        .select('*')
        .order('rejected_at', { ascending: false });

    if (error) {
        console.error('Supabase archived requests fetch failed:', error);
        return getArchivedRequestsLocal();
    }

    const list = (data || []).map(mapArchivedFromDb);
    saveArchivedRequestsLocal(list);
    return list;
}

async function purgeExpiredArchives() {
    const now = Date.now();
    const list = getArchivedRequests();
    const expired = list.filter((item) => new Date(item.deleteAfter).getTime() <= now);
    if (!expired.length) return;

    if (supabaseClient) {
        for (const item of expired) {
            const { error } = await supabaseClient
                .from(SUPABASE_TABLE_ARCHIVED)
                .delete()
                .eq('id', normalizeRequestId(item.id));
            if (error) console.error('Supabase archive purge failed:', error);
        }
    }

    const remaining = list.filter((item) => new Date(item.deleteAfter).getTime() > now);
    saveArchivedRequestsLocal(remaining);
}

async function loadArchivedData() {
    if (supabaseClient) {
        archivedRequestsCache = await fetchArchivedFromDb();
    } else {
        archivedRequestsCache = getArchivedRequestsLocal();
    }
    await purgeExpiredArchives();
}

async function saveArchivedRequest(record) {
    let syncedToDb = !supabaseClient;

    if (supabaseClient) {
        const { error } = await supabaseClient
            .from(SUPABASE_TABLE_ARCHIVED)
            .insert(mapArchivedToDb(record));

        if (error) {
            console.error('Supabase archive insert failed:', error);
            syncedToDb = false;
        } else {
            syncedToDb = true;
        }
    }

    const list = getArchivedRequests();
    if (!list.some((item) => String(item.id) === String(record.id))) {
        list.unshift(record);
        saveArchivedRequestsLocal(list);
    }

    return { saved: true, syncedToDb };
}

function isSupabaseMissingColumnError(error) {
    const code = String(error?.code || '');
    const msg = String(error?.message || error?.details || '').toLowerCase();
    return code === 'PGRST204' || msg.includes('column') || msg.includes('schema cache');
}

function stripArchiveFields(record) {
    const {
        rejectedAt,
        rejectedLabel,
        deleteAfter,
        deleteAfterLabel,
        ...rest
    } = record;
    return rest;
}

function buildRestoreRequestPayload(record) {
    const storageLabel = `${record.submittedLabel || ''}${REQUEST_META_SEP}${record.age ?? ''}${REQUEST_META_SEP}${record.memorization ?? ''}`;
    const basePayload = {
        id: normalizeRequestId(record.id),
        name: record.name || '',
        phone: record.phone || '',
        country_code: record.countryCode || '+967',
        password: record.password || '',
        submitted_label: storageLabel
    };
    return {
        basePayload,
        fullPayload: {
            ...basePayload,
            age: record.age ?? null,
            memorization: record.memorization || null
        }
    };
}

async function deleteArchivedRequestsByIds(ids) {
    const normalizedIds = ids.map((id) => normalizeRequestId(id));
    if (supabaseClient) {
        for (const id of normalizedIds) {
            const { error } = await supabaseClient
                .from(SUPABASE_TABLE_ARCHIVED)
                .delete()
                .eq('id', id);
            if (error) console.error('Supabase archive delete failed:', error);
        }
    }
    const remaining = getArchivedRequests().filter(
        (item) => !normalizedIds.some((id) => String(id) === String(item.id))
    );
    saveArchivedRequestsLocal(remaining);
}

async function insertRestoredRequest(record) {
    const { basePayload, fullPayload } = buildRestoreRequestPayload(record);

    if (supabaseClient) {
        let { error } = await supabaseClient
            .from(SUPABASE_TABLE_NEW_REQUESTS)
            .insert(fullPayload);

        if (error && isSupabaseMissingColumnError(error)) {
            ({ error } = await supabaseClient
                .from(SUPABASE_TABLE_NEW_REQUESTS)
                .insert(basePayload));
        }

        if (error) {
            console.error('Supabase restore insert failed:', error);
            return false;
        }
        return true;
    }

    const requests = getNewStudentRequests();
    if (requests.some((item) => String(item.id) === String(record.id))) return false;
    requests.unshift(stripArchiveFields(record));
    saveNewStudentRequests(requests);
    return true;
}

async function restoreArchivedRequest(archivedId, { skipToast = false } = {}) {
    const normalizedId = normalizeRequestId(archivedId);
    const archived = getArchivedRequests().find((item) => String(item.id) === String(normalizedId));
    if (!archived) return false;

    const inserted = await insertRestoredRequest(archived);
    if (!inserted) {
        if (!skipToast) showToast(`تعذر إرجاع "${archived.name}" إلى طلبات جديدة`);
        return false;
    }

    await deleteArchivedRequestsByIds([normalizedId]);
    if (!skipToast) {
        await loadDashboardData();
        showToast(`تم إرجاع "${archived.name}" إلى طلبات جديدة`);
    }
    return true;
}

async function permanentDeleteArchivedRequest(archivedId, { skipConfirm = false, skipToast = false } = {}) {
    const normalizedId = normalizeRequestId(archivedId);
    const archived = getArchivedRequests().find((item) => String(item.id) === String(normalizedId));
    if (!archived) return false;

    if (!skipConfirm) {
        const ok = window.confirm(
            `⚠️ حذف نهائي\n\nهل تريد حذف "${archived.name}" نهائياً من الأرشيف؟\n\nلا يمكن التراجع عن هذا الإجراء.`
        );
        if (!ok) return false;
    }

    await deleteArchivedRequestsByIds([normalizedId]);
    if (!skipToast) {
        await loadArchivedData();
        renderArchivedRequestsTable();
        updateArchiveBulkBar();
        showToast(`تم حذف "${archived.name}" نهائياً`);
    }
    return true;
}

function clampVisibleCount(count, total, chunkSize = REQUESTS_CHUNK_SIZE) {
    if (!total) return chunkSize;
    return Math.min(Math.max(chunkSize, count), total);
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSkeletonLine(width = '100%') {
    return `<span class="dash-skeleton-line" style="width:${width}"></span>`;
}

function buildPendingSkeletonRow() {
    return `
        <tr class="dash-skeleton-row" aria-hidden="true">
            <td class="dash-check-col"><span class="dash-skeleton-box"></span></td>
            <td>${buildSkeletonLine('74%')}</td>
            <td>${buildSkeletonLine('38%')}</td>
            <td>${buildSkeletonLine('86%')}</td>
            <td>${buildSkeletonLine('58%')}</td>
            <td>${buildSkeletonLine('46%')}</td>
            <td>${buildSkeletonLine('78%')}</td>
            <td>${buildSkeletonLine('68%')}</td>
        </tr>
    `;
}

function buildArchivedSkeletonRow() {
    return `
        <tr class="dash-skeleton-row" aria-hidden="true">
            <td class="dash-check-col"><span class="dash-skeleton-box"></span></td>
            <td>${buildSkeletonLine('74%')}</td>
            <td>${buildSkeletonLine('38%')}</td>
            <td>${buildSkeletonLine('86%')}</td>
            <td>${buildSkeletonLine('58%')}</td>
            <td>${buildSkeletonLine('62%')}</td>
            <td>${buildSkeletonLine('56%')}</td>
            <td>${buildSkeletonLine('68%')}</td>
        </tr>
    `;
}

function buildPendingSkeletonRows(count) {
    return Array.from({ length: count }, () => buildPendingSkeletonRow()).join('');
}

function paintPendingTableSkeletonInstantly(requests = null) {
    const tbody = document.getElementById('new-requests-table-body');
    const panel = document.getElementById('requests-view-pending');
    if (!tbody) return;

    const list = requests ?? getNewStudentRequests();
    const skeletonCount = list.length
        ? Math.min(REQUESTS_CHUNK_SIZE, list.length)
        : REQUESTS_CHUNK_SIZE;
    tbody.innerHTML = buildPendingSkeletonRows(skeletonCount);
    panel?.setAttribute('data-loading', 'true');
}

function buildArchivedSkeletonRows(count) {
    return Array.from({ length: count }, () => buildArchivedSkeletonRow()).join('');
}

function removeSkeletonRows(tbody) {
    tbody?.querySelectorAll('.dash-skeleton-row').forEach((row) => row.remove());
}

function animateRevealedRows(tbody, count = null) {
    if (!tbody) return;
    const rows = count
        ? [...tbody.querySelectorAll('tr:not(.dash-skeleton-row)')].slice(-count)
        : [...tbody.querySelectorAll('tr:not(.dash-skeleton-row)')];
    rows.forEach((row, index) => {
        row.classList.add('dash-row-reveal');
        row.style.animationDelay = `${Math.min(index * 0.035, 0.28)}s`;
    });
}

function getSkeletonDelay(initial = false) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
    return initial ? REQUESTS_INITIAL_SKELETON_MS : REQUESTS_LOAD_DELAY_MS;
}

function buildPendingRequestRow(req) {
    return `
        <tr data-request-id="${escapeHtml(req.id)}">
            <td class="dash-check-col">
                <input type="checkbox" class="dash-row-check pending-request-check" data-id="${escapeHtml(req.id)}" aria-label="تحديد ${escapeHtml(req.name)}">
            </td>
            <td class="dash-name-cell"><strong>${escapeHtml(req.name)}</strong></td>
            <td>${escapeHtml(req.age != null && req.age !== '' ? `${req.age} سنة` : '—')}</td>
            <td>${escapeHtml(formatMemorizationLabel(req.memorization))}</td>
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
    `;
}

function buildArchivedRequestRow(req) {
    return `
        <tr data-archived-id="${escapeHtml(req.id)}">
            <td class="dash-check-col">
                <input type="checkbox" class="dash-row-check archived-request-check" data-id="${escapeHtml(req.id)}" aria-label="تحديد ${escapeHtml(req.name)}">
            </td>
            <td class="dash-name-cell"><strong>${escapeHtml(req.name)}</strong></td>
            <td>${escapeHtml(req.age != null && req.age !== '' ? `${req.age} سنة` : '—')}</td>
            <td>${escapeHtml(formatMemorizationLabel(req.memorization))}</td>
            <td class="dash-phone-cell" dir="ltr">${escapeHtml(formatPhoneDisplay(req.countryCode, req.phone))}</td>
            <td class="dash-date-cell">${escapeHtml(req.rejectedLabel || req.rejectedAt || '—')}</td>
            <td class="dash-date-cell">${escapeHtml(req.deleteAfterLabel || req.deleteAfter || '—')}</td>
            <td class="dash-actions-cell">
                <div class="dash-action-btns">
                    <button type="button" class="dash-btn dash-btn-sm dash-btn-restore" data-action="restore-archived" data-id="${escapeHtml(req.id)}">إرجاع ↩️</button>
                    <button type="button" class="dash-btn dash-btn-sm dash-btn-reject" data-action="delete-archived" data-id="${escapeHtml(req.id)}">حذف نهائي 🗑️</button>
                </div>
            </td>
        </tr>
    `;
}

function updateLoadMoreUI(prefix, { visible, total, loading = false }) {
    const wrap = document.getElementById(`${prefix}-load-more`);
    const info = document.getElementById(`${prefix}-load-info`);
    const end = document.getElementById(`${prefix}-load-end`);
    const sentinel = document.getElementById(`${prefix}-load-sentinel`);
    const hasMore = total > visible;

    if (wrap) wrap.hidden = !total;
    if (info) {
        if (loading && hasMore) {
            info.textContent = 'جاري تحميل المزيد...';
        } else if (total) {
            info.textContent = `معروض ${visible} من ${total}`;
        } else {
            info.textContent = '';
        }
    }
    if (end) end.hidden = hasMore || loading || !total;
    if (sentinel) sentinel.hidden = !hasMore || loading;
}

async function revealPendingRequestsWithSkeleton(requests, { resetVisible = false } = {}) {
    const tbody = document.getElementById('new-requests-table-body');
    const panel = document.getElementById('requests-view-pending');
    if (!tbody) return;

    const run = async () => {
        const token = ++pendingRevealToken;
        if (resetVisible) pendingVisibleCount = REQUESTS_CHUNK_SIZE;

        paintPendingTableSkeletonInstantly(requests);
        updateNewRequestsBadge();
        updateLoadMoreUI('pending', { visible: 0, total: requests.length, loading: true });
        updatePendingBulkBar();

        await delay(getSkeletonDelay(true));
        if (token !== pendingRevealToken) return;

        panel?.removeAttribute('data-loading');

        if (!requests.length) {
            tbody.innerHTML = '<tr class="dash-table-empty dash-row-reveal"><td colspan="8">لا توجد طلبات جديدة حالياً.</td></tr>';
            updateLoadMoreUI('pending', { visible: 0, total: 0 });
            updateNewRequestsBadge();
            updatePendingBulkBar();
            return;
        }

        pendingVisibleCount = clampVisibleCount(
            resetVisible ? REQUESTS_CHUNK_SIZE : pendingVisibleCount,
            requests.length
        );
        const visibleItems = requests.slice(0, pendingVisibleCount);
        tbody.innerHTML = visibleItems.map(buildPendingRequestRow).join('');
        animateRevealedRows(tbody);

        updateLoadMoreUI('pending', { visible: pendingVisibleCount, total: requests.length });
        updateNewRequestsBadge();
        updatePendingBulkBar();
        queuePendingLoadIfNeeded();
    };

    pendingPresentationPromise = run();
    try {
        await pendingPresentationPromise;
    } finally {
        pendingPresentationPromise = null;
    }
}

async function revealArchivedRequestsWithSkeleton(archived, { resetVisible = false } = {}) {
    const tbody = document.getElementById('archived-requests-table-body');
    if (!tbody) return;

    const token = ++archivedRevealToken;
    if (resetVisible) archivedVisibleCount = REQUESTS_CHUNK_SIZE;

    const skeletonCount = Math.min(REQUESTS_CHUNK_SIZE, archived.length);
    tbody.innerHTML = buildArchivedSkeletonRows(skeletonCount);
    updateLoadMoreUI('archive', { visible: 0, total: archived.length, loading: true });
    updateArchiveBulkBar();

    await delay(getSkeletonDelay(true));
    if (token !== archivedRevealToken) return;

    archivedVisibleCount = clampVisibleCount(
        resetVisible ? REQUESTS_CHUNK_SIZE : archivedVisibleCount,
        archived.length
    );
    const visibleItems = archived.slice(0, archivedVisibleCount);
    tbody.innerHTML = visibleItems.map(buildArchivedRequestRow).join('');
    animateRevealedRows(tbody);

    updateLoadMoreUI('archive', { visible: archivedVisibleCount, total: archived.length });
    updateArchiveBulkBar();
    queueArchivedLoadIfNeeded();
}

async function loadMorePendingRows() {
    const requests = getNewStudentRequests();
    if (pendingLoadingMore || pendingVisibleCount >= requests.length) return;

    pendingLoadingMore = true;
    const prevCount = pendingVisibleCount;
    const nextCount = Math.min(pendingVisibleCount + REQUESTS_CHUNK_SIZE, requests.length);
    const skeletonCount = nextCount - prevCount;
    const tbody = document.getElementById('new-requests-table-body');

    if (tbody && skeletonCount > 0) {
        tbody.insertAdjacentHTML('beforeend', buildPendingSkeletonRows(skeletonCount));
    }
    updateLoadMoreUI('pending', {
        visible: pendingVisibleCount,
        total: requests.length,
        loading: true
    });

    await delay(getSkeletonDelay(false));

    removeSkeletonRows(tbody);
    pendingVisibleCount = nextCount;
    const newItems = requests.slice(prevCount, pendingVisibleCount);
    if (tbody && newItems.length) {
        tbody.insertAdjacentHTML('beforeend', newItems.map(buildPendingRequestRow).join(''));
        animateRevealedRows(tbody, newItems.length);
    }

    pendingLoadingMore = false;
    updateLoadMoreUI('pending', { visible: pendingVisibleCount, total: requests.length });
    updatePendingBulkBar();
    queuePendingLoadIfNeeded();
}

async function loadMoreArchivedRows() {
    const archived = getArchivedRequests();
    if (archivedLoadingMore || archivedVisibleCount >= archived.length) return;

    archivedLoadingMore = true;
    const prevCount = archivedVisibleCount;
    const nextCount = Math.min(archivedVisibleCount + REQUESTS_CHUNK_SIZE, archived.length);
    const skeletonCount = nextCount - prevCount;
    const tbody = document.getElementById('archived-requests-table-body');

    if (tbody && skeletonCount > 0) {
        tbody.insertAdjacentHTML('beforeend', buildArchivedSkeletonRows(skeletonCount));
    }
    updateLoadMoreUI('archive', {
        visible: archivedVisibleCount,
        total: archived.length,
        loading: true
    });

    await delay(getSkeletonDelay(false));

    removeSkeletonRows(tbody);
    archivedVisibleCount = nextCount;
    const newItems = archived.slice(prevCount, archivedVisibleCount);
    if (tbody && newItems.length) {
        tbody.insertAdjacentHTML('beforeend', newItems.map(buildArchivedRequestRow).join(''));
        animateRevealedRows(tbody, newItems.length);
    }

    archivedLoadingMore = false;
    updateLoadMoreUI('archive', { visible: archivedVisibleCount, total: archived.length });
    updateArchiveBulkBar();
    queueArchivedLoadIfNeeded();
}

function queuePendingLoadIfNeeded() {
    const requests = getNewStudentRequests();
    const sentinel = document.getElementById('pending-load-sentinel');
    if (!sentinel || sentinel.hidden || pendingLoadingMore || pendingVisibleCount >= requests.length) return;
    const rect = sentinel.getBoundingClientRect();
    if (rect.top <= window.innerHeight + 160) loadMorePendingRows();
}

function queueArchivedLoadIfNeeded() {
    const archived = getArchivedRequests();
    const sentinel = document.getElementById('archive-load-sentinel');
    if (!sentinel || sentinel.hidden || archivedLoadingMore || archivedVisibleCount >= archived.length) return;
    const rect = sentinel.getBoundingClientRect();
    if (rect.top <= window.innerHeight + 160) loadMoreArchivedRows();
}

function initRequestsInfiniteScroll() {
    pendingScrollObserver?.disconnect();
    archivedScrollObserver?.disconnect();

    const pendingSentinel = document.getElementById('pending-load-sentinel');
    if (pendingSentinel) {
        pendingScrollObserver = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) loadMorePendingRows();
        }, { root: null, rootMargin: '160px 0px', threshold: 0 });
        pendingScrollObserver.observe(pendingSentinel);
    }

    const archiveSentinel = document.getElementById('archive-load-sentinel');
    if (archiveSentinel) {
        archivedScrollObserver = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) loadMoreArchivedRows();
        }, { root: null, rootMargin: '160px 0px', threshold: 0 });
        archivedScrollObserver.observe(archiveSentinel);
    }
}

function getCheckedRowIds(checkboxClass) {
    return [...document.querySelectorAll(`${checkboxClass}:checked`)].map((input) => input.dataset.id);
}

function syncSelectAllCheckbox(selectAllId, checkboxClass) {
    const selectAll = document.getElementById(selectAllId);
    if (!selectAll) return;
    const checks = [...document.querySelectorAll(checkboxClass)];
    const checkedCount = checks.filter((input) => input.checked).length;
    selectAll.checked = checks.length > 0 && checkedCount === checks.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < checks.length;
}

function updatePendingBulkBar() {
    const bar = document.getElementById('pending-bulk-bar');
    const countEl = document.getElementById('pending-selected-count');
    const count = getCheckedRowIds('.pending-request-check').length;
    if (countEl) countEl.textContent = count === 1 ? '1 محدد' : `${count} محدد`;
    if (bar) bar.hidden = count === 0;
    syncSelectAllCheckbox('pending-select-all', '.pending-request-check');
}

function updateArchiveBulkBar() {
    const bar = document.getElementById('archive-bulk-bar');
    const countEl = document.getElementById('archive-selected-count');
    const count = getCheckedRowIds('.archived-request-check').length;
    if (countEl) countEl.textContent = count === 1 ? '1 محدد' : `${count} محدد`;
    if (bar) bar.hidden = count === 0;
    syncSelectAllCheckbox('archive-select-all', '.archived-request-check');
}

function mapStudentFromDb(row) {
    return {
        id: row.id,
        name: row.name || '',
        code: row.code || '',
        phone: row.phone || '',
        password: row.password || '',
        halaqa: row.halaqa || '',
        level: row.level || 'beginner',
        avatar: row.avatar || '',
        memorization: row.memorization || '',
        approvedAt: row.approved_at || '',
        approvedLabel: row.approved_at || '',
        age: row.age ?? null
    };
}

function formatStudentAgeLabel(age) {
    if (age == null || age === '') return '—';
    const n = Number(age);
    if (!Number.isFinite(n)) return '—';
    return `${n} سنة`;
}

function formatApprovedLabel(date = new Date()) {
    return date.toLocaleString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function normalizeRequestId(id) {
    const numeric = Number(id);
    return Number.isFinite(numeric) ? numeric : id;
}

async function fetchNewStudentRequestsFromDb() {
    if (!supabaseClient) return getNewStudentRequestsLocal();

    const { data, error } = await supabaseClient
        .from(SUPABASE_TABLE_NEW_REQUESTS)
        .select('*')
        .order('submitted_at', { ascending: false });

    if (error) {
        console.error('Supabase requests fetch failed:', error);
        return getNewStudentRequestsLocal();
    }

    return applyRequestMetaCache((data || []).map(mapRequestFromDb));
}

async function fetchNewStudentRequestsFromDbSafe() {
    syncProcessedRequestsFromStudents();
    const local = filterProcessedRequests(getNewStudentRequestsLocal());
    if (!supabaseClient) {
        saveNewStudentRequests(local);
        return local;
    }

    const remote = filterProcessedRequests(await fetchNewStudentRequestsFromDb());
    const merged = mergeRequestsLists(local, remote);
    saveNewStudentRequests(merged);
    return merged;
}

async function fetchStudentsFromDbSafe() {
    const local = getStudentsLocal();
    if (!supabaseClient) return local;

    const { data, error } = await supabaseClient
        .from(SUPABASE_TABLE_STUDENTS)
        .select('*')
        .order('approved_at', { ascending: false });

    if (error) {
        console.error('Supabase students fetch failed:', error);
        return local;
    }

    const remote = (data || []).map(mapStudentFromDb);
    const merged = mergeStudentsLists(local, remote);
    saveStudents(merged);
    return merged;
}

async function loadDashboardData() {
    await refreshDashboardFromLocal();

    if (!supabaseClient) return;

    syncDashboardDataFromRemote().catch((error) => {
        console.error('Dashboard remote sync failed:', error);
    });
}

async function syncDashboardDataFromRemote({ skipIfUnchanged = false } = {}) {
    if (pendingPresentationPromise) {
        await pendingPresentationPromise;
    }

    const prevSnapshot = getRequestsSnapshot(getNewStudentRequests());

    try {
        const [requests, students] = await Promise.all([
            fetchNewStudentRequestsFromDbSafe(),
            fetchStudentsFromDbSafe()
        ]);
        await loadArchivedData();
        requestsCache = requests;
        studentsCache = students;

        const nextSnapshot = getRequestsSnapshot(requests);
        const unchanged = prevSnapshot === nextSnapshot;
        const onPendingView = isNewRequestsPendingViewActive();

        if (skipIfUnchanged && unchanged) {
            renderArchivedRequestsTable();
            renderApprovedStudentsTable();
            return;
        }

        if (onPendingView) {
            updateNewRequestsBadge();
            renderNewRequestsTable({ resetVisible: true, skeleton: false });
            renderArchivedRequestsTable();
            renderApprovedStudentsTable();
            return;
        }

        updateNewRequestsBadge();
        renderNewRequestsTable();
        renderArchivedRequestsTable();
        renderApprovedStudentsTable();
    } catch (error) {
        console.error('Dashboard remote sync failed:', error);
    }
}

async function refreshDashboardFromLocal() {
    archivedRequestsCache = getArchivedRequestsLocal();
    await purgeExpiredArchives();
    requestsCache = getNewStudentRequestsLocal();
    studentsCache = getStudentsLocal();
    updateNewRequestsBadge();
    renderNewRequestsTable();
    renderArchivedRequestsTable();
    renderApprovedStudentsTable();
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

function formatMemorizationLabel(value) {
    if (!value) return '—';
    return MEMORIZATION_LABELS[value] || value;
}

function memorizationToLevel(value) {
    const map = {
        none: 'beginner',
        juz30: 'beginner',
        'juz1-5': 'beginner',
        'juz6-10': 'intermediate',
        'juz11-20': 'advanced',
        full: 'advanced'
    };
    return map[value] || 'beginner';
}

function formatPhoneDisplay(countryCode, phone) {
    const code = String(countryCode || '+967').trim();
    const num = String(phone || '').trim();
    if (!num) return code;
    return `${code} ${num}`;
}

function getRequestsSnapshot(list) {
    return (list || []).map((item) => String(item.id)).join('|');
}

function isNewRequestsPendingViewActive() {
    return getPersistedTabId() === 'new-requests'
        && localStorage.getItem(DASH_REQUESTS_VIEW_KEY) !== 'archive';
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatNewRequestsBadgeCount(value) {
    return String(Math.max(0, Math.round(value)));
}

function formatNewRequestsLabelCount(value) {
    const count = Math.max(0, Math.round(value));
    return count === 1 ? '1 طلب' : `${count} طلب`;
}

function setNewRequestsBadgeDisplay(count, { showSidebarBadge = count > 0 } = {}) {
    const badge = document.getElementById('new-requests-badge');
    const label = document.getElementById('new-requests-count');
    if (badge) {
        badge.textContent = formatNewRequestsBadgeCount(count);
        badge.hidden = !showSidebarBadge && count === 0;
    }
    if (label) label.textContent = formatNewRequestsLabelCount(count);
}

function updateNewRequestsBadge() {
    setNewRequestsBadgeDisplay(getNewStudentRequests().length);
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
            <td><span class="dash-code-chip">${escapeHtml(st.code || '—')}</span></td>
            <td class="dash-name-cell"><strong>${escapeHtml(st.name)}</strong></td>
            <td class="dash-phone-cell" dir="ltr">${escapeHtml(st.phone || '—')}</td>
            <td class="dash-age-cell">${escapeHtml(formatStudentAgeLabel(st.age))}</td>
            <td class="dash-pass-cell"><span class="dash-pass-plain" dir="ltr">${escapeHtml(plainPassword)}</span></td>
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

async function renderNewRequestsTable({ resetVisible = false, skeleton = false } = {}) {
    const tbody = document.getElementById('new-requests-table-body');
    if (!tbody) return;

    const requests = getNewStudentRequests();

    if (skeleton) {
        paintPendingTableSkeletonInstantly(requests);
        await revealPendingRequestsWithSkeleton(requests, { resetVisible });
        return;
    }

    if (!requests.length) {
        updateNewRequestsBadge();
        pendingRevealToken += 1;
        tbody.innerHTML = '<tr class="dash-table-empty"><td colspan="8">لا توجد طلبات جديدة حالياً.</td></tr>';
        updateLoadMoreUI('pending', { visible: 0, total: 0 });
        updatePendingBulkBar();
        return;
    }

    updateNewRequestsBadge();

    if (resetVisible) pendingVisibleCount = REQUESTS_CHUNK_SIZE;
    pendingVisibleCount = clampVisibleCount(pendingVisibleCount, requests.length);

    const visibleItems = requests.slice(0, pendingVisibleCount);
    tbody.innerHTML = visibleItems.map(buildPendingRequestRow).join('');
    updateLoadMoreUI('pending', { visible: pendingVisibleCount, total: requests.length });
    updatePendingBulkBar();
    queuePendingLoadIfNeeded();
}

async function renderArchivedRequestsTable({ resetVisible = false, skeleton = false } = {}) {
    const tbody = document.getElementById('archived-requests-table-body');
    const countEl = document.getElementById('archived-requests-count');
    if (!tbody) return;

    const archived = getArchivedRequests();
    if (countEl) {
        countEl.textContent = archived.length === 1 ? '1 مؤرشف' : `${archived.length} مؤرشف`;
    }

    if (!archived.length) {
        archivedRevealToken += 1;
        tbody.innerHTML = '<tr class="dash-table-empty"><td colspan="8">لا يوجد طلاب في الأرشيف.</td></tr>';
        updateLoadMoreUI('archive', { visible: 0, total: 0 });
        updateArchiveBulkBar();
        return;
    }

    if (skeleton) {
        await revealArchivedRequestsWithSkeleton(archived, { resetVisible });
        return;
    }

    if (resetVisible) archivedVisibleCount = REQUESTS_CHUNK_SIZE;
    archivedVisibleCount = clampVisibleCount(archivedVisibleCount, archived.length);

    const visibleItems = archived.slice(0, archivedVisibleCount);
    tbody.innerHTML = visibleItems.map(buildArchivedRequestRow).join('');
    updateLoadMoreUI('archive', { visible: archivedVisibleCount, total: archived.length });
    updateArchiveBulkBar();
    queueArchivedLoadIfNeeded();
}

function applyRequestsSubviewUi(view) {
    const safeView = view === 'archive' ? 'archive' : 'pending';
    localStorage.setItem(DASH_REQUESTS_VIEW_KEY, safeView);
    document.querySelectorAll('[data-requests-view]').forEach((tab) => {
        const active = tab.dataset.requestsView === safeView;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.getElementById('requests-view-pending')?.toggleAttribute('hidden', safeView !== 'pending');
    document.getElementById('requests-view-archive')?.toggleAttribute('hidden', safeView !== 'archive');
    return safeView;
}

async function switchNewRequestsSubview(view, { skeleton = false } = {}) {
    const safeView = applyRequestsSubviewUi(view);
    if (safeView === 'archive') {
        await renderArchivedRequestsTable({ resetVisible: true, skeleton });
    } else {
        await renderNewRequestsTable({ resetVisible: true, skeleton });
    }
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
            renderHalaqatPanel();
            showToast('تم حذف المدرس');
        });
    });
}

async function acceptNewStudentRequest(requestId) {
    const normalizedId = normalizeRequestId(requestId);
    const requests = getNewStudentRequests();
    const index = requests.findIndex((r) => String(r.id) === String(normalizedId));
    if (index === -1) return;

    const req = requests[index];
    const copiedPassword = extractRecordPassword(req) || DEFAULT_STUDENT_PASSWORD;
    const now = new Date();
    const student = buildApprovedStudentRecord({
        name: req.name,
        phone: formatPhoneDisplay(req.countryCode, req.phone),
        password: copiedPassword,
        memorization: req.memorization || '',
        age: req.age ?? null,
        halaqa: '',
        fromRequestId: req.id,
        now
    });

    const saved = await persistStudentRecord(student);
    if (!saved.ok && saved.error) {
        showToast('تعذر حفظ الطالب. تم الاحتفاظ به محلياً.');
    }

    if (supabaseClient) {
        await deleteRequestsFromDb([normalizedId]);
    }

    markRequestsProcessed([normalizedId]);
    saveNewStudentRequests(requests.filter((r) => String(r.id) !== String(normalizedId)));
    await refreshDashboardFromLocal();
    renderHalaqatPanel();
    showToast(`تم قبول "${req.name}" وإضافته للطلاب المعتمدين`);
}

async function acceptNewStudentRequestsBulk(ids) {
    if (!ids.length) return 0;

    const idSet = new Set(ids.map((id) => String(normalizeRequestId(id))));
    const requests = getNewStudentRequests();
    const toAccept = requests.filter((r) => idSet.has(String(normalizeRequestId(r.id))));
    if (!toAccept.length) return 0;

    const acceptIdSet = new Set(toAccept.map((r) => String(normalizeRequestId(r.id))));
    const now = new Date();

    for (const req of toAccept) {
        const student = buildApprovedStudentRecord({
            name: req.name,
            phone: formatPhoneDisplay(req.countryCode, req.phone),
            password: extractRecordPassword(req) || DEFAULT_STUDENT_PASSWORD,
            memorization: req.memorization || '',
            age: req.age ?? null,
            halaqa: '',
            fromRequestId: req.id,
            now
        });
        await persistStudentRecord(student);
    }

    if (supabaseClient) {
        await deleteRequestsFromDb([...acceptIdSet]);
    }

    markRequestsProcessed([...acceptIdSet]);
    saveNewStudentRequests(requests.filter((r) => !acceptIdSet.has(String(normalizeRequestId(r.id)))));
    await refreshDashboardFromLocal();
    renderHalaqatPanel();
    updatePendingBulkBar();

    const count = toAccept.length;
    if (count === 1) {
        showToast(`تم قبول "${toAccept[0].name}" وإضافته للطلاب المعتمدين`);
    } else {
        showToast(`تم قبول ${count} طلاب وإضافتهم للطلاب المعتمدين`);
    }
    return count;
}

async function rejectNewStudentRequest(requestId) {
    const normalizedId = normalizeRequestId(requestId);
    const requests = getNewStudentRequests();
    const req = requests.find((r) => String(r.id) === String(normalizedId));
    if (!req) return;

    const archiveRecord = buildArchiveRecord(req);
    await saveArchivedRequest(archiveRecord);

    if (supabaseClient) {
        await deleteRequestsFromDb([normalizedId]);
    }

    markRequestsProcessed([normalizedId]);
    saveNewStudentRequests(requests.filter((r) => String(r.id) !== String(normalizedId)));
    await refreshDashboardFromLocal();
    showToast(`تم رفض "${req.name}" ونقله إلى الأرشيف (${ARCHIVE_RETENTION_DAYS} يوماً)`);
}

async function rejectNewStudentRequestsBulk(ids) {
    if (!ids.length) return 0;

    const idSet = new Set(ids.map((id) => String(normalizeRequestId(id))));
    const requests = getNewStudentRequests();
    const toReject = requests.filter((r) => idSet.has(String(normalizeRequestId(r.id))));
    if (!toReject.length) return 0;

    const rejectIdSet = new Set(toReject.map((r) => String(normalizeRequestId(r.id))));
    const archiveRecords = toReject.map(buildArchiveRecord);
    const archived = getArchivedRequestsLocal();
    const existingIds = new Set(archived.map((item) => String(item.id)));
    const newRecords = archiveRecords.filter((r) => !existingIds.has(String(r.id)));
    saveArchivedRequestsLocal([...newRecords, ...archived]);

    if (supabaseClient) {
        await deleteRequestsFromDb([...rejectIdSet]);
    }

    markRequestsProcessed([...rejectIdSet]);
    saveNewStudentRequests(requests.filter((r) => !rejectIdSet.has(String(normalizeRequestId(r.id)))));

    await refreshDashboardFromLocal();
    updatePendingBulkBar();

    const count = toReject.length;
    if (count === 1) {
        showToast(`تم رفض "${toReject[0].name}" ونقله إلى الأرشيف (${ARCHIVE_RETENTION_DAYS} يوماً)`);
    } else {
        showToast(`تم رفض ${count} طلبات ونقلها إلى الأرشيف (${ARCHIVE_RETENTION_DAYS} يوماً)`);
    }
    return count;
}

async function restoreArchivedRequestsBulk(ids) {
    if (!ids.length) return 0;

    const idSet = new Set(ids.map((id) => String(normalizeRequestId(id))));
    const archived = getArchivedRequestsLocal();
    const toRestore = archived.filter((item) => idSet.has(String(normalizeRequestId(item.id))));
    if (!toRestore.length) return 0;

    const requests = getNewStudentRequestsLocal();
    const existingIds = new Set(requests.map((r) => String(r.id)));
    const restored = toRestore.filter((record) => !existingIds.has(String(record.id)));
    if (!restored.length) return 0;

    for (const record of restored) {
        requests.unshift(stripArchiveFields(record));
    }
    unmarkRequestsProcessed(restored.map((r) => r.id));
    saveNewStudentRequests(requests);

    const restoredIds = new Set(restored.map((r) => String(r.id)));
    saveArchivedRequestsLocal(archived.filter((item) => !restoredIds.has(String(item.id))));

    await refreshDashboardFromLocal();
    updateArchiveBulkBar();
    return restored.length;
}

function initNewStudentRequests() {
    pendingVisibleCount = REQUESTS_CHUNK_SIZE;
    archivedVisibleCount = REQUESTS_CHUNK_SIZE;
    initRequestsInfiniteScroll();
    document.querySelectorAll('[data-requests-view]').forEach((tab) => {
        tab.addEventListener('click', () => {
            switchNewRequestsSubview(tab.dataset.requestsView || 'pending', { skeleton: true });
        });
    });

    document.getElementById('pending-select-all')?.addEventListener('change', (e) => {
        document.querySelectorAll('.pending-request-check').forEach((input) => {
            input.checked = e.target.checked;
        });
        updatePendingBulkBar();
    });

    document.getElementById('archive-select-all')?.addEventListener('change', (e) => {
        document.querySelectorAll('.archived-request-check').forEach((input) => {
            input.checked = e.target.checked;
        });
        updateArchiveBulkBar();
    });

    document.getElementById('requests-view-pending')?.addEventListener('change', (e) => {
        if (e.target.matches('.pending-request-check')) updatePendingBulkBar();
    });

    document.getElementById('requests-view-archive')?.addEventListener('change', (e) => {
        if (e.target.matches('.archived-request-check')) updateArchiveBulkBar();
    });

    document.getElementById('pending-bulk-bar')?.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-bulk-pending]');
        if (!btn) return;
        const ids = getCheckedRowIds('.pending-request-check');
        if (!ids.length) return;

        if (btn.dataset.bulkPending === 'accept') {
            await acceptNewStudentRequestsBulk(ids);
            return;
        }

        if (btn.dataset.bulkPending === 'reject') {
            await rejectNewStudentRequestsBulk(ids);
        }
    });

    document.getElementById('archive-bulk-bar')?.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-bulk-archive]');
        if (!btn) return;
        const ids = getCheckedRowIds('.archived-request-check');
        if (!ids.length) return;

        if (btn.dataset.bulkArchive === 'restore') {
            const count = await restoreArchivedRequestsBulk(ids);
            if (count) {
                showToast(count === 1 ? 'تم إرجاع طالب واحد إلى طلبات جديدة' : `تم إرجاع ${count} طلاب إلى طلبات جديدة`);
            }
            return;
        }

        if (btn.dataset.bulkArchive === 'delete') {
            const label = ids.length === 1 ? 'طالب واحد' : `${ids.length} طلاب`;
            const ok = window.confirm(
                `⚠️ حذف نهائي\n\nهل تريد حذف ${label} نهائياً من الأرشيف؟\n\nلا يمكن التراجع عن هذا الإجراء.`
            );
            if (!ok) return;
            await deleteArchivedRequestsByIds(ids);
            await refreshDashboardFromLocal();
            updateArchiveBulkBar();
            showToast(ids.length === 1 ? 'تم الحذف النهائي لطالب واحد' : `تم الحذف النهائي لـ ${ids.length} طلاب`);
        }
    });

    const pendingTbody = document.getElementById('new-requests-table-body');
    pendingTbody?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const requestId = btn.dataset.id;
        const row = btn.closest('tr');
        const action = btn.dataset.action;

        if (action === 'accept') {
            removeRequestRow(row, () => { acceptNewStudentRequest(requestId); });
        } else if (action === 'reject') {
            removeRequestRow(row, () => { rejectNewStudentRequest(requestId); });
        }
    });

    const archiveTbody = document.getElementById('archived-requests-table-body');
    archiveTbody?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const archivedId = btn.dataset.id;
        const action = btn.dataset.action;

        if (action === 'restore-archived') {
            restoreArchivedRequest(archivedId);
        } else if (action === 'delete-archived') {
            permanentDeleteArchivedRequest(archivedId);
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

const stInputRejectTimers = new WeakMap();

function stShowFieldError(id, show = true) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = show ? 'flex' : 'none';
}

function stHideAllStudentFormErrors() {
    ['err-st-name', 'err-st-age', 'err-st-phone', 'err-st-memorization', 'err-st-pass'].forEach((id) => {
        stShowFieldError(id, false);
    });
}

function stSanitizeDigitsOnly(raw, maxLen = Infinity) {
    return String(raw ?? '').replace(/\D/g, '').slice(0, maxLen);
}

function stTriggerInputReject(input, containerId) {
    const container = containerId ? document.getElementById(containerId) : null;

    if (input) {
        input.classList.remove('is-rejected');
        void input.offsetWidth;
        input.classList.add('is-rejected');
        const prev = stInputRejectTimers.get(input);
        if (prev) clearTimeout(prev);
        stInputRejectTimers.set(input, setTimeout(() => {
            input.classList.remove('is-rejected');
        }, 650));
    }

    if (container) {
        container.classList.remove('is-shaking');
        void container.offsetWidth;
        container.classList.add('is-shaking');
        container.addEventListener('animationend', () => container.classList.remove('is-shaking'), { once: true });
    }
}

function stTriggerFieldShake(containerId) {
    stTriggerInputReject(null, containerId);
}

function stBindDigitsOnlyInput(input, options = {}) {
    if (!input) return;

    const maxLength = options.maxLength ?? 15;
    const containerId = options.shakeTarget ?? null;
    const transform = typeof options.transform === 'function'
        ? options.transform
        : (digits) => digits;

    const reject = () => {
        if (containerId) stTriggerInputReject(input, containerId);
    };

    const applyValue = (raw) => {
        const rawStr = String(raw ?? '');
        const hadInvalidChars = /[^\d]/.test(rawStr);
        const digits = stSanitizeDigitsOnly(rawStr, maxLength);
        const transformed = transform(digits);
        const modeRejected = transformed !== digits && digits.length > 0;

        if (input.value !== transformed) input.value = transformed;

        if (hadInvalidChars || modeRejected) {
            reject();
            options.onReject?.(rawStr, { hadInvalidChars, modeRejected });
        }

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
            reject();
            options.onReject?.(e.data, { hadInvalidChars: true, modeRejected: false });
        }
    });

    input.addEventListener('input', () => applyValue(input.value));

    input.addEventListener('keydown', (e) => {
        const navKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (navKeys.includes(e.key) || e.ctrlKey || e.metaKey) return;
        if (e.key.length === 1 && !/^\d$/.test(e.key)) {
            e.preventDefault();
            reject();
            options.onReject?.(e.key, { hadInvalidChars: true, modeRejected: false });
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
}

function validateStudentQuadName(name) {
    const cleaned = String(name ?? '').trim();
    const arabicWords = cleaned.split(/\s+/).filter((w) => /^[\u0600-\u06FF]+$/.test(w));
    return cleaned.length >= 10 && arabicWords.length >= 4;
}

function setStudentPhoneErrorMessage(intl) {
    const el = document.getElementById('err-st-phone');
    if (!el) return;
    el.textContent = intl
        ? 'أدخل رمز الدولة (مثل 967) ورقم هاتف دولي صحيح.'
        : 'أدخل رقم يمني صحيح: 9 أرقام ويبدأ بـ 7.';
}

function stHandleStudentPassReject(flags = {}) {
    stTriggerFieldShake('st-pass-wrap');
    updateAddStudentPassRules(false, flags);
}

function resetAddStudentPassRules() {
    document.getElementById('st-pass-rules')?.querySelectorAll('.dash-pass-rule').forEach((el) => {
        el.classList.remove('is-valid', 'is-invalid');
    });
    stShowFieldError('err-st-pass', false);
}

function isStudentYemeniPhone(phone) {
    const digits = String(phone ?? '').replace(/\D/g, '');
    return /^7\d{8}$/.test(digits);
}

function isStudentIntlPhone(phone, countryCode) {
    const phoneDigits = String(phone ?? '').replace(/\D/g, '');
    const codeDigits = String(countryCode ?? '').replace(/\D/g, '').slice(0, 3);
    return codeDigits.length >= 1 && codeDigits.length <= 3
        && phoneDigits.length >= 6 && phoneDigits.length <= 15;
}

function isStudentPhoneIntlMode() {
    return document.getElementById('st-intl-toggle')?.checked === true;
}

function transformStudentPhoneDigits(digits) {
    if (!digits) return '';
    if (isStudentPhoneIntlMode()) return digits.slice(0, 15);
    if (digits[0] !== '7') return '';
    return digits.slice(0, 9);
}

function setDashPassRuleState(rulesEl, ruleName, state) {
    const el = rulesEl?.querySelector(`.dash-pass-rule[data-rule="${ruleName}"]`);
    if (!el) return;
    el.classList.remove('is-valid', 'is-invalid');
    if (state === 'valid') el.classList.add('is-valid');
    if (state === 'invalid') el.classList.add('is-invalid');
}

function updateAddStudentPhoneRules(showError = false, adviseWrongStart = false) {
    const rulesEl = document.getElementById('st-phone-rules');
    const phoneInput = document.getElementById('st-phone');
    if (!rulesEl || !phoneInput) return;

    const intl = isStudentPhoneIntlMode();
    rulesEl.querySelector('[data-rule="yemeni-start"]')?.toggleAttribute('hidden', intl);
    rulesEl.querySelector('[data-rule="yemeni-length"]')?.toggleAttribute('hidden', intl);
    rulesEl.querySelector('[data-rule="intl-code"]')?.toggleAttribute('hidden', !intl);
    rulesEl.querySelector('[data-rule="intl-phone"]')?.toggleAttribute('hidden', !intl);

    const phone = phoneInput.value.replace(/\D/g, '');
    const codeDigits = document.getElementById('st-country-code')?.value.replace(/\D/g, '') ?? '';

    let ok = false;
    if (!intl) {
        setDashPassRuleState(rulesEl, 'yemeni-start', phone.length > 0 && phone[0] === '7' ? 'valid' : 'idle');
        setDashPassRuleState(rulesEl, 'yemeni-length', phone.length === 9 ? 'valid' : (phone.length > 0 ? 'idle' : 'idle'));
        ok = isStudentYemeniPhone(phone);
        if (adviseWrongStart) {
            const el = document.getElementById('err-st-phone');
            if (el) el.textContent = 'الرقم اليمني يبدأ بالرقم 7 — مثال: 777123456';
            stShowFieldError('err-st-phone', true);
        } else {
            setStudentPhoneErrorMessage(false);
            stShowFieldError('err-st-phone', !ok && showError);
        }
    } else {
        const codeOk = codeDigits.length >= 1 && codeDigits.length <= 3;
        const phoneOk = phone.length >= 6 && phone.length <= 15;
        setDashPassRuleState(rulesEl, 'intl-code', codeDigits.length > 0 && codeOk ? 'valid' : 'idle');
        setDashPassRuleState(rulesEl, 'intl-phone', phone.length > 0 && phoneOk ? 'valid' : 'idle');
        ok = isStudentIntlPhone(phone, codeDigits);
        setStudentPhoneErrorMessage(true);
        stShowFieldError('err-st-phone', !ok && showError);
    }
    return ok;
}

function updateAddStudentPassRules(onBlur = false, flags = {}) {
    const forceSymbol = Boolean(flags.forceSymbol);
    const forceCapital = Boolean(flags.forceCapital);
    const rulesEl = document.getElementById('st-pass-rules');
    const input = document.getElementById('st-pass');
    if (!rulesEl || !input) return false;

    const pass = input.value ?? '';
    const hasLength = pass.length >= 8;
    const hasDigit = /[0-9]/.test(pass);
    const onlyAllowed = /^[a-z0-9]*$/.test(pass);
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);

    setDashPassRuleState(rulesEl, 'length', pass.length > 0 && hasLength ? 'valid' : 'idle');
    setDashPassRuleState(rulesEl, 'digit', pass.length > 0 && hasDigit ? 'valid' : 'idle');

    if (forceSymbol || (pass.length > 0 && !onlyAllowed)) {
        setDashPassRuleState(rulesEl, 'latin', 'invalid');
    } else if (pass.length > 0 && onlyAllowed) {
        setDashPassRuleState(rulesEl, 'latin', 'valid');
    } else {
        setDashPassRuleState(rulesEl, 'latin', 'idle');
    }

    if (forceCapital || hasUpper) {
        setDashPassRuleState(rulesEl, 'lowercase', 'invalid');
    } else if (pass.length > 0 && hasLower) {
        setDashPassRuleState(rulesEl, 'lowercase', 'valid');
    } else {
        setDashPassRuleState(rulesEl, 'lowercase', 'idle');
    }

    const ok = STUDENT_PASS_REGEX.test(pass);
    if (ok) {
        stShowFieldError('err-st-pass', false);
    } else if (onBlur && pass.length > 0) {
        stShowFieldError('err-st-pass', true);
    } else {
        stShowFieldError('err-st-pass', false);
    }
    return ok;
}

function formatAddStudentPhoneValue() {
    const phone = document.getElementById('st-phone')?.value.replace(/\D/g, '') ?? '';
    if (isStudentPhoneIntlMode()) {
        const code = document.getElementById('st-country-code')?.value.replace(/\D/g, '') ?? '';
        return code ? `+${code} ${phone}` : phone;
    }
    return phone;
}

function ensureDefaultStudentCountryCode() {
    const code = document.getElementById('st-country-code');
    if (code && !code.value.replace(/\D/g, '')) {
        code.value = DEFAULT_STUDENT_COUNTRY_CODE;
    }
}

function resetAddStudentPhoneMode() {
    const toggle = document.getElementById('st-intl-toggle');
    const wrap = document.getElementById('st-country-wrap');
    if (toggle) toggle.checked = false;
    wrap?.classList.add('hidden');
    const code = document.getElementById('st-country-code');
    if (code) code.value = DEFAULT_STUDENT_COUNTRY_CODE;
    setStudentPhoneErrorMessage(false);
    updateAddStudentPhoneConstraints();
}

function updateAddStudentPhoneConstraints() {
    const phone = document.getElementById('st-phone');
    if (!phone) return;
    const intl = isStudentPhoneIntlMode();
    phone.maxLength = intl ? 15 : 9;
    phone.placeholder = intl
        ? 'أدخل رقم الهاتف الدولي'
        : '7XXXXXXXX (مثال: 777123456)';
    phone.value = transformStudentPhoneDigits(stSanitizeDigitsOnly(phone.value, 15));
    updateAddStudentPhoneRules(false);
}

const ST_WIZARD_TOTAL = 5;
const ST_WIZARD_LABELS = ['الاسم', 'العمر', 'الهاتف', 'مستوى الحفظ', 'كلمة السر'];
let stWizardStep = 1;

function validateStWizardStep(step) {
    if (step === 1) {
        const name = document.getElementById('st-name')?.value.trim() ?? '';
        const ok = validateStudentQuadName(name);
        stShowFieldError('err-st-name', !ok);
        if (!ok) {
            stTriggerFieldShake('st-name-wrap');
            showToast('أدخل اسماً رباعياً كاملاً بالعربية.');
        }
        return ok;
    }
    if (step === 2) {
        const age = parseInt(document.getElementById('st-age')?.value ?? '', 10);
        const ok = Number.isFinite(age) && age >= 5 && age <= 25;
        stShowFieldError('err-st-age', !ok);
        if (!ok) {
            stTriggerFieldShake('st-age-wrap');
            showToast('أدخل عمراً صحيحاً بين 5 و 25 سنة.');
        }
        return ok;
    }
    if (step === 3) {
        const ok = updateAddStudentPhoneRules(true);
        if (!ok) {
            stTriggerFieldShake(isStudentPhoneIntlMode() ? 'st-country-code-wrap' : 'st-phone-wrap');
            showToast(isStudentPhoneIntlMode()
                ? 'تحقق من رمز الدولة ورقم الهاتف الدولي.'
                : 'أدخل رقم يمني صحيح: 9 أرقام ويبدأ بـ 7.');
        }
        return ok;
    }
    if (step === 4) {
        const memorization = document.getElementById('st-memorization')?.value ?? '';
        const ok = Boolean(memorization);
        stShowFieldError('err-st-memorization', !ok);
        if (!ok) {
            stTriggerFieldShake('st-memorization-wrap');
            showToast('يرجى اختيار مستوى الحفظ.');
        }
        return ok;
    }
    if (step === 5) {
        const ok = updateAddStudentPassRules(true);
        if (!ok) {
            stTriggerFieldShake('st-pass-wrap');
            showToast('كلمة السر: 8 خانات، أحرف صغيرة إنجليزية وأرقام فقط.');
        }
        return ok;
    }
    return true;
}

function updateStWizardProgress(step) {
    const fill = document.getElementById('st-progress-fill');
    const label = document.getElementById('st-step-label');
    const pct = Math.round(((step - 1) / ST_WIZARD_TOTAL) * 100);
    if (fill) fill.style.width = `${pct}%`;
    if (label) {
        label.textContent = `الخطوة ${step} من ${ST_WIZARD_TOTAL} — ${ST_WIZARD_LABELS[step - 1]}`;
    }
}

function focusStWizardStepInput(step) {
    const map = {
        1: '#st-name',
        2: '#st-age',
        3: '#st-phone',
        4: '#st-memorization',
        5: '#st-pass'
    };
    const el = document.querySelector(map[step]);
    if (el) setTimeout(() => el.focus(), 80);
}

function showStWizardStep(step, focusInput = true) {
    stWizardStep = Math.max(1, Math.min(ST_WIZARD_TOTAL, step));
    document.querySelectorAll('#add-student-form .st-wizard-step').forEach((panel) => {
        const n = Number(panel.dataset.step);
        panel.hidden = n !== stWizardStep;
        panel.classList.toggle('is-active', n === stWizardStep);
    });

    updateStWizardProgress(stWizardStep);

    if (stWizardStep === 5) {
        const codePreview = document.getElementById('st-code');
        if (codePreview) codePreview.value = previewStudentCode();
    }

    const backBtn = document.getElementById('st-wizard-back');
    const nextBtn = document.getElementById('st-wizard-next');
    const submitBtn = document.getElementById('st-wizard-submit');
    const nav = document.getElementById('st-wizard-nav');
    backBtn?.toggleAttribute('hidden', stWizardStep === 1);
    nextBtn?.toggleAttribute('hidden', stWizardStep === ST_WIZARD_TOTAL);
    submitBtn?.toggleAttribute('hidden', stWizardStep !== ST_WIZARD_TOTAL);
    nav?.classList.toggle('st-wizard-nav--single', stWizardStep === 1);

    if (focusInput) focusStWizardStepInput(stWizardStep);
}

function goStWizardNext() {
    if (!validateStWizardStep(stWizardStep)) return;
    if (stWizardStep < ST_WIZARD_TOTAL) showStWizardStep(stWizardStep + 1);
}

function goStWizardBack() {
    if (stWizardStep > 1) showStWizardStep(stWizardStep - 1);
}

function resetStWizard(focusFirst = true) {
    stWizardStep = 1;
    document.getElementById('add-student-form')?.reset();
    resetAddStudentPhoneMode();
    resetAddStudentPassRules();
    stHideAllStudentFormErrors();
    ensureDefaultStudentCountryCode();
    showStWizardStep(1, focusFirst);
}

function initAddStudentPassField() {
    const pass = document.getElementById('st-pass');
    if (!pass) return;

    pass.addEventListener('beforeinput', (e) => {
        if (e.isComposing) return;
        const types = ['insertText', 'insertReplacementText', 'insertFromPaste', 'insertFromDrop'];
        if (!types.includes(e.inputType) || !e.data) return;

        if (/[A-Z]/.test(e.data)) {
            e.preventDefault();
            stHandleStudentPassReject({ forceCapital: true });
            return;
        }
        if (/[^a-z0-9]/.test(e.data)) {
            e.preventDefault();
            stHandleStudentPassReject({ forceSymbol: true });
        }
    });

    pass.addEventListener('input', () => {
        const raw = pass.value;
        if (/[A-Z]/.test(raw)) {
            pass.value = raw.replace(/[A-Z]/g, '');
            stHandleStudentPassReject({ forceCapital: true });
            return;
        }
        const cleaned = sanitizeStudentPasswordInput(raw);
        if (raw !== cleaned) {
            pass.value = cleaned;
            stHandleStudentPassReject({ forceSymbol: true });
            return;
        }
        updateAddStudentPassRules(false);
    });

    pass.addEventListener('blur', () => updateAddStudentPassRules(true));
    pass.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = e.clipboardData?.getData('text') ?? '';
        if (/[A-Z]/.test(pasted)) {
            pass.value = sanitizeStudentPasswordInput(pasted.replace(/[A-Z]/g, ''));
            stHandleStudentPassReject({ forceCapital: true });
            return;
        }
        const cleaned = sanitizeStudentPasswordInput(pasted);
        pass.value = cleaned;
        if (pasted !== cleaned) stHandleStudentPassReject({ forceSymbol: true });
        else updateAddStudentPassRules(false);
    });
}

function initAddStudentForm() {
    const phone = document.getElementById('st-phone');
    const countryCode = document.getElementById('st-country-code');
    const nameInput = document.getElementById('st-name');
    const ageInput = document.getElementById('st-age');
    const memorizationInput = document.getElementById('st-memorization');

    document.getElementById('st-intl-toggle')?.addEventListener('change', (e) => {
        const on = e.target.checked;
        document.getElementById('st-country-wrap')?.classList.toggle('hidden', !on);
        if (on) ensureDefaultStudentCountryCode();
        updateAddStudentPhoneConstraints();
        setStudentPhoneErrorMessage(on);
        stShowFieldError('err-st-phone', false);
    });

    stBindDigitsOnlyInput(phone, {
        maxLength: 15,
        shakeTarget: 'st-phone-wrap',
        transform: transformStudentPhoneDigits,
        onReject: (_raw, meta) => {
            if (!isStudentPhoneIntlMode() && meta?.modeRejected) {
                updateAddStudentPhoneRules(false, true);
            }
        },
        onValue: () => {
            updateAddStudentPhoneRules(false, false);
            stShowFieldError('err-st-phone', false);
        }
    });

    stBindDigitsOnlyInput(countryCode, {
        maxLength: 3,
        shakeTarget: 'st-country-code-wrap',
        onValue: () => {
            updateAddStudentPhoneRules(false);
            stShowFieldError('err-st-phone', false);
        }
    });

    phone?.addEventListener('blur', () => updateAddStudentPhoneRules(true));
    countryCode?.addEventListener('blur', () => updateAddStudentPhoneRules(true));

    nameInput?.addEventListener('input', () => stShowFieldError('err-st-name', false));
    ageInput?.addEventListener('input', () => stShowFieldError('err-st-age', false));
    memorizationInput?.addEventListener('change', () => stShowFieldError('err-st-memorization', false));

    initAddStudentPassField();

    document.getElementById('st-wizard-next')?.addEventListener('click', goStWizardNext);
    document.getElementById('st-wizard-back')?.addEventListener('click', goStWizardBack);

    document.querySelectorAll('#add-student-form .st-wizard-step input, #add-student-form .st-wizard-step select').forEach((input) => {
        input.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const step = Number(input.closest('.st-wizard-step')?.dataset.step);
            if (!step || step >= ST_WIZARD_TOTAL) return;
            goStWizardNext();
        });
    });

    updateAddStudentPhoneConstraints();
    resetAddStudentPassRules();
    ensureDefaultStudentCountryCode();
    showStWizardStep(1, false);
}

function validateAddStudentForm() {
    const name = document.getElementById('st-name')?.value.trim() ?? '';
    const age = parseInt(document.getElementById('st-age')?.value ?? '', 10);
    const memorization = document.getElementById('st-memorization')?.value ?? '';
    const phoneOk = updateAddStudentPhoneRules(true);
    const passOk = updateAddStudentPassRules(true);
    if (!validateStudentQuadName(name)) {
        stShowFieldError('err-st-name', true);
        stTriggerFieldShake('st-name-wrap');
        showToast('أدخل اسماً رباعياً كاملاً بالعربية.');
        return false;
    }
    if (!Number.isFinite(age) || age < 5 || age > 25) {
        stShowFieldError('err-st-age', true);
        stTriggerFieldShake('st-age-wrap');
        showToast('أدخل عمراً صحيحاً بين 5 و 25 سنة.');
        return false;
    }
    if (!memorization) {
        stShowFieldError('err-st-memorization', true);
        stTriggerFieldShake('st-memorization-wrap');
        showToast('يرجى اختيار مستوى الحفظ.');
        return false;
    }
    if (!phoneOk) {
        stTriggerFieldShake(isStudentPhoneIntlMode() ? 'st-country-code-wrap' : 'st-phone-wrap');
        showToast(isStudentPhoneIntlMode()
            ? 'تحقق من رمز الدولة ورقم الهاتف الدولي.'
            : 'أدخل رقم يمني صحيح: 9 أرقام ويبدأ بـ 7.');
        return false;
    }
    if (!passOk) {
        stTriggerFieldShake('st-pass-wrap');
        showToast('كلمة السر: 8 خانات، أحرف صغيرة إنجليزية وأرقام فقط.');
        return false;
    }
    return true;
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

async function saveBannerOverlaySettings(settings) {
    saveBannerOverlaySettingsLocal(settings);
    if (!window.BannerStore?.isEnabled) return { ok: true };
    return window.BannerStore.saveBannerOverlaySettings(settings);
}

function syncGlassPreviewBlurLayer() {
    const preview = document.getElementById('dash-ad-glass-preview');
    const blurImg = document.getElementById('dash-ad-glass-blur-img');
    if (!preview || !blurImg) return;
    blurImg.style.height = `${preview.offsetHeight}px`;
}

function applyBannerOverlaySettings(settings = getBannerOverlaySettings()) {
    const preview = document.getElementById('dash-ad-glass-preview');
    const targets = [document.documentElement, preview].filter(Boolean);
    const colorTheme = normalizeOverlayColorTheme(settings.overlayColorTheme);
    const strength = clampOverlayStrength(settings.colorStrength, 70);
    const color = resolveBannerOverlayColor(colorTheme, strength);

    const blurAmount = clampOverlayBlur(settings.blurAmount);
    targets.forEach((el) => {
        el.style.setProperty('--blur-amount', `${blurAmount}px`);
        el.style.setProperty('--overlay-height', `${settings.overlayHeight}%`);
        el.style.setProperty('--overlay-color', color);
        el.style.setProperty('--overlay-color-strength', String(strength));
        el.style.setProperty('--edge-smoothness', `${settings.edgeSmoothness}%`);
        if (el.id === 'dash-ad-glass-preview') el.dataset.overlayTheme = colorTheme;
    });
    syncGlassPreviewBlurLayer();
}

function readOverlaySettingsFromControls() {
    return {
        blurAmount: clampOverlayBlur(document.getElementById('overlay-blur-range')?.value ?? '15'),
        overlayHeight: parseInt(document.getElementById('overlay-height-range')?.value ?? '30', 10),
        overlayColorTheme: normalizeOverlayColorTheme(document.getElementById('overlay-color-select')?.value ?? 'white'),
        edgeSmoothness: parseInt(document.getElementById('overlay-edge-range')?.value ?? '20', 10),
        colorStrength: parseInt(document.getElementById('overlay-strength-range')?.value ?? '70', 10)
    };
}

let overlayRemoteSyncTimer = null;
let overlayRemoteSyncWarned = false;

function scheduleOverlayRemoteSync(settings) {
    if (overlayRemoteSyncTimer) clearTimeout(overlayRemoteSyncTimer);
    overlayRemoteSyncTimer = setTimeout(async () => {
        overlayRemoteSyncTimer = null;
        if (!window.BannerStore?.isEnabled) return;

        const result = await window.BannerStore.saveBannerOverlaySettings(settings);
        if (result?.ok === false && !overlayRemoteSyncWarned) {
            overlayRemoteSyncWarned = true;
            showToast('حُفظت الإعدادات محلياً — تعذرت المزامنة مع السحابة');
        }
    }, 700);
}

function syncOverlayDesignPicker(theme = getBannerOverlaySettings().overlayColorTheme) {
    const normalized = normalizeOverlayColorTheme(theme);
    document.querySelectorAll('.dash-glass-theme-tab').forEach((btn) => {
        const active = btn.dataset.overlayTheme === normalized;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-checked', active ? 'true' : 'false');
    });
}

function syncOverlayControlsFromStore() {
    const settings = getBannerOverlaySettings();
    const blurRange = document.getElementById('overlay-blur-range');
    const heightRange = document.getElementById('overlay-height-range');
    const edgeRange = document.getElementById('overlay-edge-range');
    const strengthRange = document.getElementById('overlay-strength-range');
    const colorSelect = document.getElementById('overlay-color-select');
    const blurVal = document.getElementById('overlay-blur-val');
    const heightVal = document.getElementById('overlay-height-val');
    const edgeVal = document.getElementById('overlay-edge-val');
    const strengthVal = document.getElementById('overlay-strength-val');

    if (blurRange) blurRange.value = String(clampOverlayBlur(settings.blurAmount));
    if (heightRange) heightRange.value = String(settings.overlayHeight);
    if (edgeRange) edgeRange.value = String(settings.edgeSmoothness);
    if (strengthRange) strengthRange.value = String(clampOverlayStrength(settings.colorStrength, 70));
    const colorTheme = normalizeOverlayColorTheme(settings.overlayColorTheme);
    if (colorSelect) colorSelect.value = colorTheme;
    if (blurVal) blurVal.textContent = `${clampOverlayBlur(settings.blurAmount)}px`;
    if (heightVal) heightVal.textContent = `${settings.overlayHeight}%`;
    if (edgeVal) edgeVal.textContent = `${settings.edgeSmoothness}%`;
    if (strengthVal) strengthVal.textContent = `${clampOverlayStrength(settings.colorStrength, 70)}%`;
    syncOverlayDesignPicker(colorTheme);
    applyBannerOverlaySettings(settings);
}

function switchAdsType(type) {
    const safeType = type === 'topbar' ? 'topbar' : 'banner';

    document.querySelectorAll('.dash-ads-type-card').forEach((card) => {
        const active = card.dataset.adsType === safeType;
        card.classList.toggle('is-active', active);
        card.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    document.getElementById('ads-section-topbar')?.toggleAttribute('hidden', safeType !== 'topbar');
    document.getElementById('ads-section-banner')?.toggleAttribute('hidden', safeType !== 'banner');
    document.getElementById('ads-section-banner')?.classList.toggle('is-active', safeType === 'banner');
}

function sortBannerAdsList(list) {
    return [...(list || [])].sort((a, b) => {
        const ao = Number.isFinite(a.sortOrder) ? a.sortOrder : Number.MAX_SAFE_INTEGER;
        const bo = Number.isFinite(b.sortOrder) ? b.sortOrder : Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });
}

function reindexActiveBannerSortOrders(ads) {
    const active = ads.filter((ad) => ad.archived !== true);
    sortBannerAdsList(active).forEach((ad, index) => {
        ad.sortOrder = index;
    });
}

function normalizeBannerAdsList(list) {
    const normalized = (list || []).map((ad) => ({
        ...ad,
        archived: ad.archived === true
    }));
    normalized.forEach((ad, index) => {
        if (!Number.isFinite(ad.sortOrder)) ad.sortOrder = index;
    });
    return sortBannerAdsList(normalized);
}

function getActiveBannerAdsSorted() {
    return sortBannerAdsList(ensureBannerAdsStore().filter((ad) => ad.archived !== true));
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
        sortOrder: 0,
        createdAt: new Date().toISOString()
    }];
}

function getBannerAdsLocal() {
    try {
        const raw = localStorage.getItem(BANNER_ADS_KEY);
        if (!raw) return null;
        const list = JSON.parse(raw);
        return Array.isArray(list) ? normalizeBannerAdsList(list) : null;
    } catch {
        return null;
    }
}

function saveBannerAdsLocal(list) {
    const normalized = normalizeBannerAdsList(list);
    localStorage.setItem(BANNER_ADS_KEY, JSON.stringify(normalized));
    bannerAdsCache = normalized;
    return normalized;
}

async function saveBannerAds(list) {
    const normalized = saveBannerAdsLocal(list);
    if (!window.BannerStore?.isEnabled) return { ok: true };
    return window.BannerStore.replaceBannerAds(normalized);
}

let bannerAdsRemoteWarned = false;

async function applyBannerAdsChange(ads, { successToast, onSuccess } = {}) {
    const normalized = saveBannerAdsLocal(ads);
    renderAdsManagementViews();
    if (successToast) showToast(successToast);
    if (typeof onSuccess === 'function') onSuccess();

    if (!window.BannerStore?.isEnabled) return true;

    const result = await window.BannerStore.replaceBannerAds(normalized);
    if (result?.ok === false && !bannerAdsRemoteWarned) {
        bannerAdsRemoteWarned = true;
        showToast('ملاحظة: التغيير محفوظ هنا — تعذرت المزامنة مع السحابة');
    }
    return result?.ok !== false;
}

async function loadBannerDataFromDb() {
    if (!window.BannerStore?.isEnabled) return;

    const [ads, overlay] = await Promise.all([
        window.BannerStore.fetchBannerAds(),
        window.BannerStore.fetchBannerOverlaySettings()
    ]);

    if (ads !== null) {
        if (ads.length) {
            saveBannerAdsLocal(ads);
        } else {
            const local = getBannerAdsLocal();
            const toSave = local?.length ? local : getDefaultBannerAds();
            saveBannerAdsLocal(toSave);
            await window.BannerStore.replaceBannerAds(toSave);
        }
    }

    if (overlay) {
        const merged = mergeBannerOverlaySettings(overlay);
        const hasLocal = Boolean(localStorage.getItem(BANNER_OVERLAY_KEY));
        if (!hasLocal) saveBannerOverlaySettingsLocal(merged);
        bannerOverlayCache = hasLocal ? getBannerOverlaySettings() : merged;
    }

    renderAdsManagementViews();
    syncOverlayControlsFromStore();
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

function updateAdsBulkBar() {
    const bar = document.getElementById('ads-bulk-bar');
    const deleteBtn = document.getElementById('ads-bulk-delete-btn');
    const countEl = document.getElementById('ads-selected-count');
    const count = getCheckedRowIds('.banner-ad-check').length;
    if (countEl) countEl.textContent = count === 1 ? '1 محدد' : `${count} محدد`;
    if (bar) bar.hidden = count === 0;
    if (deleteBtn) deleteBtn.hidden = count === 0;
    syncSelectAllCheckbox('ads-select-all', '.banner-ad-check');
}

function renderAdsTable() {
    const tbody = document.getElementById('ads-table-body');
    const countEl = document.getElementById('ads-active-count');
    if (!tbody) return;

    const ads = getActiveBannerAdsSorted();
    const activeCount = ads.filter((ad) => ad.active !== false).length;
    if (countEl) countEl.textContent = `${activeCount} نشط`;

    if (!ads.length) {
        tbody.innerHTML = '<tr class="dash-table-empty"><td colspan="7">لا توجد إعلانات بعد.</td></tr>';
        updateAdsBulkBar();
        return;
    }

    tbody.innerHTML = ads.map((ad, index) => {
        const isActive = ad.active !== false;
        const isFirst = index === 0;
        const isLast = index === ads.length - 1;
        return `
        <tr data-ad-id="${escapeHtml(ad.id)}">
            <td class="dash-check-col">
                <input type="checkbox" class="dash-row-check banner-ad-check" data-id="${escapeHtml(ad.id)}" aria-label="تحديد ${escapeHtml(ad.name || 'إعلان')}">
            </td>
            <td class="dash-order-col">
                <div class="dash-ad-order-wrap">
                    <span class="dash-ad-order-badge" title="ترتيب الظهور في الصفحة الرئيسية">${index + 1}</span>
                    <div class="dash-ad-order-btns">
                        <button type="button" class="dash-ad-order-btn" data-action="move-ad-up" data-id="${escapeHtml(ad.id)}" aria-label="رفع الترتيب" ${isFirst ? 'disabled' : ''}>▲</button>
                        <button type="button" class="dash-ad-order-btn" data-action="move-ad-down" data-id="${escapeHtml(ad.id)}" aria-label="خفض الترتيب" ${isLast ? 'disabled' : ''}>▼</button>
                    </div>
                </div>
            </td>
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
    updateAdsBulkBar();
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

async function moveBannerAdOrder(adId, direction) {
    const ads = ensureBannerAdsStore();
    const active = getActiveBannerAdsSorted();
    const index = active.findIndex((ad) => ad.id === adId);
    if (index < 0) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= active.length) return;

    const current = active[index];
    const swap = active[swapIndex];
    const currentOrder = current.sortOrder;
    current.sortOrder = swap.sortOrder;
    swap.sortOrder = currentOrder;
    reindexActiveBannerSortOrders(ads);

    await applyBannerAdsChange(ads, { successToast: 'تم تحديث ترتيب العرض' });
}

async function bulkSetBannerAdsVisibility(ids, visible) {
    const ads = ensureBannerAdsStore();
    let changed = 0;
    ids.forEach((id) => {
        const ad = ads.find((item) => item.id === id);
        if (!ad || ad.archived === true) return;
        const nextActive = visible === true;
        if ((ad.active !== false) !== nextActive) {
            ad.active = nextActive;
            changed += 1;
        }
    });
    if (!changed) return 0;

    await applyBannerAdsChange(ads);
    return changed;
}

async function bulkArchiveBannerAds(ids) {
    const ads = ensureBannerAdsStore();
    const targets = ids
        .map((id) => ads.find((item) => item.id === id))
        .filter((ad) => ad && ad.archived !== true);
    if (!targets.length) return 0;

    const ok = window.confirm(`نقل ${targets.length} إعلاناً إلى الأرشيف؟`);
    if (!ok) return 0;

    const now = new Date().toISOString();
    targets.forEach((ad) => {
        ad.archived = true;
        ad.active = false;
        ad.archivedAt = now;
    });
    reindexActiveBannerSortOrders(ads);

    await applyBannerAdsChange(ads, { onSuccess: () => switchAdsSubview('archive') });
    return targets.length;
}

async function toggleBannerAdVisibility(adId) {
    const ads = ensureBannerAdsStore();
    const ad = ads.find((item) => item.id === adId);
    if (!ad || ad.archived === true) return;
    ad.active = !(ad.active !== false);
    const isActive = ad.active !== false;
    await applyBannerAdsChange(ads, {
        successToast: isActive ? `تم إظهار "${ad.name}" في الرئيسية` : `تم إخفاء "${ad.name}" من الرئيسية`
    });
}

async function archiveBannerAd(adId) {
    const ads = ensureBannerAdsStore();
    const ad = ads.find((item) => item.id === adId);
    if (!ad || ad.archived === true) return;
    ad.archived = true;
    ad.active = false;
    ad.archivedAt = new Date().toISOString();
    reindexActiveBannerSortOrders(ads);
    await applyBannerAdsChange(ads, {
        successToast: `تم نقل "${ad.name}" إلى الأرشيف`,
        onSuccess: () => switchAdsSubview('archive')
    });
}

async function restoreBannerAd(adId) {
    const ads = ensureBannerAdsStore();
    const ad = ads.find((item) => item.id === adId);
    if (!ad || ad.archived !== true) return;
    ad.archived = false;
    ad.active = true;
    ad.archivedAt = null;
    const maxOrder = ads
        .filter((item) => item.archived !== true && item.id !== ad.id)
        .reduce((max, item) => Math.max(max, Number.isFinite(item.sortOrder) ? item.sortOrder : 0), -1);
    ad.sortOrder = maxOrder + 1;
    reindexActiveBannerSortOrders(ads);
    await applyBannerAdsChange(ads, {
        successToast: `تمت استعادة "${ad.name}" إلى السلايدر`,
        onSuccess: () => switchAdsSubview('active')
    });
}

async function permanentDeleteBannerAd(adId) {
    const ads = ensureBannerAdsStore();
    const ad = ads.find((item) => item.id === adId);
    if (!ad || ad.archived !== true) return;
    const ok = window.confirm(`حذف "${ad.name}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`);
    if (!ok) return;
    await applyBannerAdsChange(
        ads.filter((item) => item.id !== adId),
        { successToast: 'تم حذف الإعلان نهائياً' }
    );
}

async function saveNewBannerAd() {
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
    const activeAds = getActiveBannerAdsSorted();
    const nextSortOrder = activeAds.length
        ? Math.max(...activeAds.map((ad) => Number.isFinite(ad.sortOrder) ? ad.sortOrder : 0)) + 1
        : 0;
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
        sortOrder: nextSortOrder,
        createdAt: new Date().toISOString()
    });
    closeAddAdModal();
    await applyBannerAdsChange(ads, { successToast: 'تمت إضافة الإعلان بنجاح' });
}

function persistOverlayFromControls() {
    const settings = readOverlaySettingsFromControls();
    applyBannerOverlaySettings(settings);
    saveBannerOverlaySettingsLocal(settings);
    scheduleOverlayRemoteSync(settings);
}

function initBannerOverlayControls() {
    syncOverlayControlsFromStore();
    window.addEventListener('resize', syncGlassPreviewBlurLayer);
    document.getElementById('dash-ad-glass-preview-img')?.addEventListener('load', syncGlassPreviewBlurLayer);

    const blurRange = document.getElementById('overlay-blur-range');
    const heightRange = document.getElementById('overlay-height-range');
    const edgeRange = document.getElementById('overlay-edge-range');
    const strengthRange = document.getElementById('overlay-strength-range');
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
    strengthRange?.addEventListener('input', () => {
        document.getElementById('overlay-strength-val').textContent = `${strengthRange.value}%`;
        persistOverlayFromControls();
    });
    colorSelect?.addEventListener('change', () => {
        syncOverlayDesignPicker(colorSelect.value);
        persistOverlayFromControls();
    });

    document.querySelectorAll('.dash-glass-theme-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.overlayTheme;
            if (!theme || !colorSelect) return;
            colorSelect.value = theme;
            syncOverlayDesignPicker(theme);
            persistOverlayFromControls();
        });
    });
}

function normalizeTopBarAdsList(list) {
    const source = Array.isArray(list) ? list : [];
    const slots = [];

    for (let i = 0; i < TOP_BAR_ADS_MAX; i += 1) {
        const ad = source[i] || DEFAULT_TOP_BAR_ADS[i] || { tag: '', text: '' };
        slots.push({
            tag: String(ad.tag ?? '').trim().slice(0, TOP_BAR_TAG_MAX),
            text: String(ad.text ?? '').trim().slice(0, TOP_BAR_TEXT_MAX)
        });
    }

    return slots;
}

function getTopBarAdsLocal() {
    try {
        const raw = JSON.parse(localStorage.getItem(TOP_BAR_ADS_KEY) || 'null');
        if (Array.isArray(raw)) return normalizeTopBarAdsList(raw);
    } catch { /* ignore */ }
    return normalizeTopBarAdsList(DEFAULT_TOP_BAR_ADS);
}

function saveTopBarAdsLocal(list) {
    const normalized = normalizeTopBarAdsList(list);
    localStorage.setItem(TOP_BAR_ADS_KEY, JSON.stringify(normalized));
    return normalized;
}

function collectTopBarAdsFromForm() {
    return Array.from({ length: TOP_BAR_ADS_MAX }, (_, index) => {
        const tag = document.getElementById(`topbar-ad-tag-${index}`)?.value ?? '';
        const text = document.getElementById(`topbar-ad-text-${index}`)?.value ?? '';
        return {
            tag: tag.trim().slice(0, TOP_BAR_TAG_MAX),
            text: text.trim().slice(0, TOP_BAR_TEXT_MAX)
        };
    });
}

function updateTopBarCharCounter(index) {
    const input = document.getElementById(`topbar-ad-text-${index}`);
    const counter = document.getElementById(`topbar-ad-count-${index}`);
    if (!input || !counter) return;
    const len = input.value.length;
    counter.textContent = `${len}/${TOP_BAR_TEXT_MAX}`;
    counter.classList.toggle('is-limit', len >= TOP_BAR_TEXT_MAX);
}

function renderTopBarAdsPreview(ads = getTopBarAdsLocal()) {
    const preview = document.getElementById('topbar-ads-preview');
    if (!preview) return;

    const visible = ads.filter((ad) => ad.text);
    if (!visible.length) {
        preview.innerHTML = '<span class="dash-topbar-preview-empty">لا توجد إعلانات للمعاينة — أضف نصاً في أحد الحقول.</span>';
        return;
    }

    preview.innerHTML = visible.map((ad) => `
        <span class="dash-topbar-preview-item">
            <span class="dash-topbar-preview-badge">${escapeHtml(ad.tag || 'إعلان')}</span>
            <span>${escapeHtml(ad.text)}</span>
        </span>`).join('<span class="dash-topbar-preview-sep">◆</span>');
}

function renderTopBarAdsForm() {
    const wrap = document.getElementById('topbar-ads-fields');
    if (!wrap) return;

    const ads = getTopBarAdsLocal();
    wrap.innerHTML = ads.map((ad, index) => `
        <article class="dash-topbar-ad-slot">
            <div class="dash-topbar-ad-slot-head">
                <strong>إعلان ${index + 1}</strong>
            </div>
            <div class="dash-form-grid dash-topbar-ad-grid">
                <div class="dash-field">
                    <label for="topbar-ad-tag-${index}">التصنيف (قصير)</label>
                    <input class="dash-input" type="text" id="topbar-ad-tag-${index}" maxlength="${TOP_BAR_TAG_MAX}" value="${escapeHtml(ad.tag)}" placeholder="مثال: جديد">
                </div>
                <div class="dash-field" style="grid-column: 1 / -1;">
                    <div class="dash-topbar-ad-text-head">
                        <label for="topbar-ad-text-${index}">نص الإعلان</label>
                        <span class="dash-topbar-char-count" id="topbar-ad-count-${index}">0/${TOP_BAR_TEXT_MAX}</span>
                    </div>
                    <textarea class="dash-input dash-topbar-textarea" id="topbar-ad-text-${index}" maxlength="${TOP_BAR_TEXT_MAX}" rows="2" placeholder="اكتب نص الإعلان — 100 حرف كحد أقصى">${escapeHtml(ad.text)}</textarea>
                </div>
            </div>
        </article>
    `).join('');

    ads.forEach((_, index) => {
        updateTopBarCharCounter(index);
        document.getElementById(`topbar-ad-text-${index}`)?.addEventListener('input', () => {
            updateTopBarCharCounter(index);
            renderTopBarAdsPreview(collectTopBarAdsFromForm());
        });
        document.getElementById(`topbar-ad-tag-${index}`)?.addEventListener('input', () => {
            renderTopBarAdsPreview(collectTopBarAdsFromForm());
        });
    });

    renderTopBarAdsPreview(ads);
}

function initTopBarAdsManagement() {
    renderTopBarAdsForm();

    document.getElementById('topbar-ads-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const errorEl = document.getElementById('topbar-ads-error');
        const collected = collectTopBarAdsFromForm();

        const invalid = collected.find((ad) => ad.text.length > TOP_BAR_TEXT_MAX || ad.tag.length > TOP_BAR_TAG_MAX);
        if (invalid) {
            if (errorEl) {
                errorEl.hidden = false;
                errorEl.textContent = `تجاوز أحد الحقول الحد المسموح — ${TOP_BAR_TEXT_MAX} حرف للنص و${TOP_BAR_TAG_MAX} للتصنيف.`;
            }
            return;
        }

        const hasAny = collected.some((ad) => ad.text);
        if (!hasAny) {
            if (errorEl) {
                errorEl.hidden = false;
                errorEl.textContent = 'أدخل نصاً لإعلان واحد على الأقل.';
            }
            return;
        }

        saveTopBarAdsLocal(collected);
        if (errorEl) errorEl.hidden = true;
        renderTopBarAdsPreview(collected);
        showToast('تم حفظ شريط الإعلانات العلوي');
    });
}

function initBannerAdsManagement() {
    loadBannerDataFromDb();
    initBannerOverlayControls();
    initTopBarAdsManagement();
    switchAdsType('banner');
    switchAdsSubview('active');

    document.querySelectorAll('.dash-ads-type-card').forEach((card) => {
        card.addEventListener('click', () => switchAdsType(card.dataset.adsType || 'banner'));
    });

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

    document.getElementById('ads-select-all')?.addEventListener('change', (e) => {
        document.querySelectorAll('.banner-ad-check').forEach((input) => {
            input.checked = e.target.checked;
        });
        updateAdsBulkBar();
    });

    document.getElementById('ads-table-body')?.addEventListener('change', (e) => {
        if (e.target.matches('.banner-ad-check')) updateAdsBulkBar();
    });

    async function handleAdsBulkAction(btn) {
        if (!btn) return;
        const ids = getCheckedRowIds('.banner-ad-check');
        if (!ids.length) return;

        if (btn.dataset.bulkAds === 'show') {
            const count = await bulkSetBannerAdsVisibility(ids, true);
            if (count) showToast(`تم إظهار ${count} إعلاناً`);
            return;
        }
        if (btn.dataset.bulkAds === 'hide') {
            const count = await bulkSetBannerAdsVisibility(ids, false);
            if (count) showToast(`تم إخفاء ${count} إعلاناً`);
            return;
        }
        if (btn.dataset.bulkAds === 'archive') {
            const count = await bulkArchiveBannerAds(ids);
            if (count) showToast(`تم نقل ${count} إعلاناً إلى الأرشيف`);
        }
    }

    document.getElementById('ads-bulk-bar')?.addEventListener('click', (e) => {
        handleAdsBulkAction(e.target.closest('[data-bulk-ads]'));
    });

    document.getElementById('ads-bulk-delete-btn')?.addEventListener('click', (e) => {
        handleAdsBulkAction(e.currentTarget);
    });

    document.getElementById('ads-table-body')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.dataset.action === 'toggle-ad') toggleBannerAdVisibility(id);
        if (btn.dataset.action === 'archive-ad') archiveBannerAd(id);
        if (btn.dataset.action === 'move-ad-up') moveBannerAdOrder(id, 'up');
        if (btn.dataset.action === 'move-ad-down') moveBannerAdOrder(id, 'down');
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
function getPersistedTabId() {
    const hashTab = location.hash.replace(/^#/, '').trim();
    if (DASH_VALID_TABS.includes(hashTab)) return hashTab;

    const savedTab = localStorage.getItem(DASH_ACTIVE_TAB_KEY);
    if (DASH_VALID_TABS.includes(savedTab)) return savedTab;

    return 'overview';
}

function applyTabPanels(tabId) {
    document.documentElement.setAttribute('data-dash-tab', tabId);
    document.querySelectorAll('.dash-nav-link').forEach((link) => {
        link.classList.toggle('active', link.dataset.tab === tabId);
    });
    document.querySelectorAll('.dash-panel').forEach((panel) => {
        panel.classList.toggle('active', panel.dataset.panel === tabId);
    });
}

function persistActiveTab(tabId) {
    if (!DASH_VALID_TABS.includes(tabId)) return;
    localStorage.setItem(DASH_ACTIVE_TAB_KEY, tabId);
    const targetHash = `#${tabId}`;
    if (location.hash !== targetHash) {
        history.replaceState(null, '', `${location.pathname}${location.search}${targetHash}`);
    }
}

function activateNewRequestsTab({ skeleton = true } = {}) {
    pendingVisibleCount = REQUESTS_CHUNK_SIZE;
    archivedVisibleCount = REQUESTS_CHUNK_SIZE;
    const savedView = localStorage.getItem(DASH_REQUESTS_VIEW_KEY);
    if (skeleton) {
        paintPendingTableSkeletonInstantly(getNewStudentRequests());
    }
    return switchNewRequestsSubview(savedView === 'archive' ? 'archive' : 'pending', { skeleton });
}

async function finishInitialTabActivation(tabId) {
    if (tabId === 'new-requests') {
        applyRequestsSubviewUi(localStorage.getItem(DASH_REQUESTS_VIEW_KEY) === 'archive' ? 'archive' : 'pending');
        return;
    }
    if (tabId === 'students') renderApprovedStudentsTable();
    if (tabId === 'halaqat') renderHalaqatPanel();
    if (tabId === 'ads') loadBannerDataFromDb();
}

function switchTab(tabId, { skeletonRequests = false } = {}) {
    const safeTabId = DASH_VALID_TABS.includes(tabId) ? tabId : 'overview';

    if (safeTabId === 'new-requests' && skeletonRequests) {
        paintPendingTableSkeletonInstantly(getNewStudentRequests());
    }

    applyTabPanels(safeTabId);
    persistActiveTab(safeTabId);
    if (!isDesktop()) closeMobileSidebar();

    if (safeTabId === 'new-requests') {
        activateNewRequestsTab({ skeleton: skeletonRequests });
    }
    if (safeTabId === 'students') renderApprovedStudentsTable();
    if (safeTabId === 'halaqat') renderHalaqatPanel();
    if (safeTabId === 'ads') loadBannerDataFromDb();
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

/* ── النماذج ── */
function initForms() {
    const codePreview = document.getElementById('st-code');
    if (codePreview) codePreview.value = previewStudentCode();
    initAddStudentForm();

    document.getElementById('add-student-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateAddStudentForm()) return;

        const name = document.getElementById('st-name')?.value.trim();
        const age = parseInt(document.getElementById('st-age')?.value ?? '', 10);
        const pass = sanitizeStudentPasswordInput(document.getElementById('st-pass')?.value ?? '');
        const memorization = document.getElementById('st-memorization')?.value ?? '';
        const student = buildApprovedStudentRecord({
            name,
            age,
            phone: formatAddStudentPhoneValue(),
            password: pass,
            memorization,
            halaqa: 'fajr'
        });
        const code = student.code;

        const saved = await persistStudentRecord(student);
        if (!saved.ok && saved.error) {
            showToast(`تمت إضافة "${name}" محلياً — الكود: ${code}`);
        } else {
            showToast(`تمت إضافة "${name}" — الكود: ${code}`);
        }

        resetStWizard(false);
        if (codePreview) codePreview.value = previewStudentCode();
        renderApprovedStudentsTable();
        renderHalaqatPanel();
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
        renderHalaqatPanel();
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
document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    const initialTab = getPersistedTabId();
    applyTabPanels(initialTab);
    persistActiveTab(initialTab);

    if (localStorage.getItem('dash_dark') === '1') applyDarkMode(true);

    initSidebar();
    initChartTabs();
    initForms();
    initNewStudentRequests();
    initChangePasswordModal();
    initBannerAdsManagement();
    renderTeachersTable();
    initKpiAnimation();
    initUiZoomControls();
    await loadDashboardData();

    document.querySelectorAll('.dash-nav-link').forEach(link => {
        link.addEventListener('click', () => switchTab(link.dataset.tab));
    });

    window.addEventListener('hashchange', () => {
        const hashTab = location.hash.replace(/^#/, '').trim();
        if (DASH_VALID_TABS.includes(hashTab)) switchTab(hashTab);
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

    finishInitialTabActivation(initialTab);
});
