// Retire the old preference; each page now has a fixed color scheme.
function clearThemePreference() {
  try {
    document.cookie = 'al-theme=; Max-Age=0; Path=/; SameSite=Lax';
  } catch {
    // Browsers that block cookies can still use the page's static colors.
  }
}

clearThemePreference();
