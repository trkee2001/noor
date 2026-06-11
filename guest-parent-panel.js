/* لوحة التحكم — الضيوف وأولياء الأمور */
(function () {
    const GUEST_REQUESTS_KEY = 'guest_join_requests';
    const APPROVED_GUESTS_KEY = 'dash_approved_guests';
    const PROCESSED_GUEST_REQUESTS_KEY = 'dash_processed_guest_request_ids';

    function getGuestRequestsLocal() {
        try {
            return JSON.parse(localStorage.getItem(GUEST_REQUESTS_KEY) || '[]');
        } catch {
            return [];
        }
    }

    function saveGuestRequests(list) {
        localStorage.setItem(GUEST_REQUESTS_KEY, JSON.stringify(list));
    }

    function getApprovedGuestsLocal() {
        try {
            return JSON.parse(localStorage.getItem(APPROVED_GUESTS_KEY) || '[]');
        } catch {
            return [];
        }
    }

    function saveApprovedGuests(list) {
        localStorage.setItem(APPROVED_GUESTS_KEY, JSON.stringify(list));
    }

    function getProcessedGuestRequestIds() {
        try {
            return new Set(JSON.parse(localStorage.getItem(PROCESSED_GUEST_REQUESTS_KEY) || '[]').map(String));
        } catch {
            return new Set();
        }
    }

    function markGuestRequestsProcessed(ids) {
        const set = getProcessedGuestRequestIds();
        ids.forEach((id) => set.add(String(id)));
        localStorage.setItem(PROCESSED_GUEST_REQUESTS_KEY, JSON.stringify([...set]));
    }

    function filterProcessedGuestRequests(list) {
        const processed = getProcessedGuestRequestIds();
        return (list || []).filter((req) => !processed.has(String(req.id)));
    }

    function getGuestDisplayEmail(record) {
        if (record.email) return normalizeGuestEmail(record.email);
        if (record.phone) return String(record.phone);
        return '—';
    }

    function normalizeGuestEmail(raw) {
        return String(raw ?? '').trim().toLowerCase();
    }

    function findLinkedStudent(childName) {
        const students = typeof getStudentsNormalized === 'function' ? getStudentsNormalized() : [];
        const child = String(childName || '').trim().toLowerCase();
        return students.find((st) => String(st.name || '').trim().toLowerCase() === child) || null;
    }

    function updateGuestRequestsBadge() {
        const count = filterProcessedGuestRequests(getGuestRequestsLocal()).length;
        const badge = document.getElementById('guest-requests-badge');
        const countEl = document.getElementById('guest-pending-count');
        if (countEl) countEl.textContent = String(count);
        if (badge) {
            badge.textContent = String(count);
            badge.hidden = count === 0;
        }
    }

    function renderGuestRequestsTable() {
        const tbody = document.getElementById('guest-requests-body');
        if (!tbody) return;
        const requests = filterProcessedGuestRequests(getGuestRequestsLocal());
        updateGuestRequestsBadge();

        if (!requests.length) {
            tbody.innerHTML = '<tr class="dash-table-empty"><td colspan="6">لا توجد طلبات ضيوف جديدة.</td></tr>';
            return;
        }

        tbody.innerHTML = requests.map((req) => {
            const email = getGuestDisplayEmail(req);
            const pass = escapeHtml(String(req.password || '—'));
            return `
            <tr data-guest-req-id="${escapeHtml(req.id)}">
                <td><strong>${escapeHtml(req.name)}</strong></td>
                <td dir="ltr">${escapeHtml(email)}</td>
                <td>${escapeHtml(req.childName || '—')}</td>
                <td class="dash-pass-cell"><span class="dash-pass-plain" dir="ltr">${pass}</span></td>
                <td class="dash-date-cell">${escapeHtml(req.submittedLabel || '—')}</td>
                <td class="dash-actions-cell">
                    <button type="button" class="dash-btn dash-btn-sm dash-btn-primary" data-action="accept-guest" data-id="${escapeHtml(req.id)}">قبول</button>
                    <button type="button" class="dash-btn dash-btn-sm dash-btn-outline" data-action="reject-guest" data-id="${escapeHtml(req.id)}">رفض</button>
                </td>
            </tr>`;
        }).join('');
    }

    function renderApprovedGuestsTable() {
        const tbody = document.getElementById('guest-approved-body');
        if (!tbody) return;
        const guests = getApprovedGuestsLocal();

        if (!guests.length) {
            tbody.innerHTML = '<tr class="dash-table-empty"><td colspan="6">لا يوجد ضيوف معتمدون بعد.</td></tr>';
            return;
        }

        tbody.innerHTML = guests.map((guest) => `
            <tr data-guest-id="${escapeHtml(guest.id)}">
                <td><strong>${escapeHtml(guest.name)}</strong></td>
                <td dir="ltr">${escapeHtml(getGuestDisplayEmail(guest))}</td>
                <td>${escapeHtml(guest.studentName || guest.childName || '—')}</td>
                <td class="dash-pass-cell"><span class="dash-pass-plain" dir="ltr">${escapeHtml(guest.password || '—')}</span></td>
                <td class="dash-date-cell">${escapeHtml(guest.approvedLabel || '—')}</td>
                <td class="dash-actions-cell">
                    <button type="button" class="dash-btn dash-btn-sm dash-btn-outline" data-action="remove-guest" data-id="${escapeHtml(guest.id)}">حذف</button>
                </td>
            </tr>
        `).join('');
    }

    function acceptGuestRequest(requestId) {
        const requests = getGuestRequestsLocal();
        const req = requests.find((r) => String(r.id) === String(requestId));
        if (!req) return;

        const student = findLinkedStudent(req.childName);
        const now = new Date();
        const guest = {
            id: `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: req.name,
            email: normalizeGuestEmail(req.email || req.phone || ''),
            childName: req.childName,
            studentId: student?.id || '',
            studentName: student?.name || req.childName,
            password: req.password || '',
            approvedAt: now.toISOString(),
            approvedLabel: now.toLocaleString('ar-SA', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })
        };

        const approved = getApprovedGuestsLocal();
        approved.unshift(guest);
        saveApprovedGuests(approved);

        markGuestRequestsProcessed([requestId]);
        saveGuestRequests(requests.filter((r) => String(r.id) !== String(requestId)));

        renderGuestRequestsTable();
        renderApprovedGuestsTable();
        showToast(`تم قبول "${req.name}" — بدون كود أكاديمي`);
    }

    function rejectGuestRequest(requestId) {
        const requests = getGuestRequestsLocal();
        const req = requests.find((r) => String(r.id) === String(requestId));
        if (!req) return;

        markGuestRequestsProcessed([requestId]);
        saveGuestRequests(requests.filter((r) => String(r.id) !== String(requestId)));
        renderGuestRequestsTable();
        showToast(`تم رفض طلب "${req.name}"`);
    }

    function removeApprovedGuest(guestId) {
        saveApprovedGuests(getApprovedGuestsLocal().filter((g) => String(g.id) !== String(guestId)));
        renderApprovedGuestsTable();
        showToast('تم حذف الضيف');
    }

    function applyGuestSubview(view) {
        const pending = view !== 'approved';
        document.querySelectorAll('[data-guest-view]').forEach((btn) => {
            btn.classList.toggle('is-active', btn.dataset.guestView === view);
        });
        document.getElementById('guest-view-pending')?.toggleAttribute('hidden', !pending);
        document.getElementById('guest-view-approved')?.toggleAttribute('hidden', pending);
    }

    function initGuestParentsPanel() {
        document.querySelectorAll('[data-guest-view]').forEach((btn) => {
            btn.addEventListener('click', () => applyGuestSubview(btn.dataset.guestView || 'pending'));
        });

        document.getElementById('guest-requests-body')?.addEventListener('click', (e) => {
            const acceptBtn = e.target.closest('[data-action="accept-guest"]');
            const rejectBtn = e.target.closest('[data-action="reject-guest"]');
            if (acceptBtn) acceptGuestRequest(acceptBtn.dataset.id);
            if (rejectBtn) rejectGuestRequest(rejectBtn.dataset.id);
        });

        document.getElementById('guest-approved-body')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="remove-guest"]');
            if (btn) removeApprovedGuest(btn.dataset.id);
        });

        renderGuestRequestsTable();
        renderApprovedGuestsTable();
        applyGuestSubview('pending');
    }

    window.renderGuestParentsPanel = function renderGuestParentsPanel() {
        renderGuestRequestsTable();
        renderApprovedGuestsTable();
    };

    const origSwitchTab = window.switchTab;
    if (typeof origSwitchTab === 'function') {
        window.switchTab = function switchTabWithGuests(tabId) {
            origSwitchTab(tabId);
            if (tabId === 'parents') renderGuestParentsPanel();
        };
    }

    document.addEventListener('DOMContentLoaded', () => {
        initGuestParentsPanel();
        if (getPersistedTabId?.() === 'parents') renderGuestParentsPanel();
    });
})();
