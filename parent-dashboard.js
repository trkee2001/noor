const CURRENT_GUEST_KEY = 'current_logged_in_guest';

function requireGuestAuth() {
    try {
        const raw = localStorage.getItem(CURRENT_GUEST_KEY);
        if (!raw) {
            window.location.replace('index.html#login');
            return null;
        }
        return JSON.parse(raw);
    } catch {
        window.location.replace('index.html#login');
        return null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const guest = requireGuestAuth();
    if (!guest) return;

    document.getElementById('par-welcome-name').textContent = `مرحباً، ${guest.name || 'ولي الأمر'}`;
    document.getElementById('par-child-name').textContent = guest.studentName || guest.childName || '—';
    document.getElementById('par-email').textContent = guest.email || guest.phone || '—';

    document.getElementById('par-logout-btn')?.addEventListener('click', () => {
        localStorage.removeItem(CURRENT_GUEST_KEY);
        window.location.assign('index.html');
    });
});
