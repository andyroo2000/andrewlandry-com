// Runs in the head so a saved theme is applied before the page is painted.
(() => {
  const root = document.documentElement;
  const device = matchMedia('(prefers-color-scheme: dark)');
  let preference;

  function readPreference() {
    try {
      const value = document.cookie.split(';').map(part => part.trim())
        .find(part => part.startsWith('al-theme='))?.slice('al-theme='.length);
      return value === 'dark' || value === 'light' ? value : undefined;
    } catch {
      return preference;
    }
  }

  function updateControls() {
    const dark = root.dataset.theme === 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
      button.hidden = false;
    });
  }

  function applyTheme() {
    const theme = preference ?? (device.matches ? 'dark' : 'light');
    const changed = root.dataset.theme !== theme;
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101835' : '#2446ee');
    updateControls();
    if (changed) document.dispatchEvent(new CustomEvent('site-theme-change'));
  }

  function savePreference() {
    try {
      const secure = location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `al-theme=${preference}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
    } catch {
      // The switch still works for this page when cookies are blocked.
    }
  }

  function syncPreference() {
    // Keep a choice in memory if the browser silently declines the cookie.
    preference = readPreference() ?? preference;
    applyTheme();
  }

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element) || !event.target.closest('[data-theme-toggle]')) return;
    preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
    savePreference();
    applyTheme();
  });
  document.addEventListener('DOMContentLoaded', updateControls, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncPreference();
  });
  window.addEventListener('pageshow', syncPreference);
  device.addEventListener('change', applyTheme);
  preference = readPreference();
  applyTheme();
})();
