(() => {
  try {
    const mode = localStorage.getItem("navixa-appearance-mode") || "system";
    const palette = localStorage.getItem("navixa-appearance-palette") || "oasis";
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = mode === "system" ? (prefersDark ? "dark" : "light") : (mode === "dark" ? "dark" : "light");

    document.documentElement.dataset.navixaTheme = theme;
    document.documentElement.dataset.navixaPalette = ["oasis", "lilac", "midnight", "sand"].includes(palette)
      ? palette
      : "oasis";
    document.documentElement.style.colorScheme = theme;
  } catch {}
})();
