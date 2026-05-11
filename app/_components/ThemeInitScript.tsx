import { STORAGE_KEY, THEME_IDS, DEFAULT_THEME } from "../_variants/themes";

const script = `
(function() {
  try {
    var ids = ${JSON.stringify(THEME_IDS)};
    var params = new URLSearchParams(window.location.search);
    var urlTheme = params.get('theme');
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var theme;
    if (urlTheme && ids.indexOf(urlTheme) !== -1) {
      theme = urlTheme;
      localStorage.setItem('${STORAGE_KEY}', theme);
    } else if (stored && ids.indexOf(stored) !== -1) {
      theme = stored;
    } else {
      theme = ids[Math.floor(Math.random() * ids.length)];
      localStorage.setItem('${STORAGE_KEY}', theme);
    }
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    document.documentElement.dataset.theme = '${DEFAULT_THEME}';
  }
})();
`.trim();

export default function ThemeInitScript() {
  return (
    <script
      // Inline, blocking, before paint — prevents theme flash
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
