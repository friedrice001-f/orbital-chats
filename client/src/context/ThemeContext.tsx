import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ThemeMode = "bright" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  toggleMode: () => void;
  wallpaper: string | null; // base64 data URL or null
  setWallpaper: (dataUrl: string | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const MODE_KEY = "orbital-chat:theme-mode";
const WALLPAPER_KEY = "orbital-chat:wallpaper";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(MODE_KEY);
    return saved === "dark" || saved === "bright" ? saved : "dark";
  });

  const [wallpaper, setWallpaperState] = useState<string | null>(() => {
    return localStorage.getItem(WALLPAPER_KEY);
  });

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode);
    document.documentElement.classList.toggle("dark", mode === "dark");
  }, [mode]);

  function setWallpaper(dataUrl: string | null) {
    setWallpaperState(dataUrl);
    if (dataUrl) {
      try {
        localStorage.setItem(WALLPAPER_KEY, dataUrl);
      } catch {
        // Quota exceeded (very large image) — keep it in-memory for this
        // session only, rather than crashing the app.
        console.warn("Wallpaper too large to persist; using it for this session only.");
      }
    } else {
      localStorage.removeItem(WALLPAPER_KEY);
    }
  }

  const value = useMemo(
    () => ({
      mode,
      toggleMode: () => setMode((m) => (m === "dark" ? "bright" : "dark")),
      wallpaper,
      setWallpaper,
    }),
    [mode, wallpaper]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
