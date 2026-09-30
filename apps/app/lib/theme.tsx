import { atom, useAtom, useAtomValue } from "jotai";
import { atomWithLazy, atomWithStorage, createJSONStorage } from "jotai/utils";
import { useLayoutEffect } from "react";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

/**
 * Shared with the inline bootstrap script in `index.html`, which applies the
 * theme before first paint. Keep the key and its JSON encoding in sync.
 */
const STORAGE_KEY = "theme";

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

const jsonStorage = createJSONStorage<ThemePreference>();

function toPreference(
  value: unknown,
  fallback: ThemePreference,
): ThemePreference {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : fallback;
}

/**
 * Persisted preference, mirrored across tabs by `atomWithStorage`.
 *
 * The three overrides exist because anything can end up in `localStorage`:
 * both read paths are validated (the storage-event path bypasses `getItem`),
 * and both directions swallow failures. The read especially – `getOnInit` runs
 * it while this module evaluates, so a browser that denies storage access would
 * otherwise take down the bundle before anything renders.
 */
const themePreferenceAtom = atomWithStorage<ThemePreference>(
  STORAGE_KEY,
  "system",
  {
    ...jsonStorage,
    getItem: (key, initialValue) => {
      try {
        return toPreference(
          jsonStorage.getItem(key, initialValue),
          initialValue,
        );
      } catch {
        return initialValue;
      }
    },
    setItem: (key, value) => {
      try {
        jsonStorage.setItem(key, value);
      } catch {
        // Persistence is best-effort; the choice still applies this session.
      }
    },
    subscribe: (key, callback, initialValue) =>
      jsonStorage.subscribe?.(
        key,
        (value) => callback(toPreference(value, initialValue)),
        initialValue,
      ),
  },
  { getOnInit: true },
);

/**
 * OS color scheme, kept current while any subscriber is mounted. Lazy so the
 * first read happens during render – seeding it with a guess would repaint the
 * document a frame after the bootstrap script already got it right.
 */
const systemThemeAtom = atomWithLazy<Theme>(() =>
  window.matchMedia(COLOR_SCHEME_QUERY).matches ? "dark" : "light",
);

systemThemeAtom.onMount = (set) => {
  const media = window.matchMedia(COLOR_SCHEME_QUERY);
  // Re-read: a change between the lazy init and this subscription is missed.
  set(media.matches ? "dark" : "light");

  const onChange = (event: MediaQueryListEvent) => {
    set(event.matches ? "dark" : "light");
  };

  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};

const themeAtom = atom<Theme>((get) => {
  const preference = get(themePreferenceAtom);
  return preference === "system" ? get(systemThemeAtom) : preference;
});

/**
 * Keeps `<html>` in sync with the resolved theme: the `dark` class drives
 * Tailwind's dark variant, `color-scheme` drives native UI (scrollbars, form
 * controls), and `theme-color` drives mobile browser chrome.
 *
 * Mount near the root. The bootstrap script in `index.html` settles all three
 * before first paint; this keeps them current afterwards, and catches an OS or
 * cross-tab change that landed between that script and React starting.
 */
export function ThemeSync() {
  const theme = useAtomValue(themeAtom);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;

    // Derived from CSS rather than repeated here. `index.html` and
    // `site.manifest` do have to repeat it – they load before any stylesheet –
    // so `--theme-color` in `globals.css` is the value they must track.
    const color = getComputedStyle(root)
      .getPropertyValue("--theme-color")
      .trim();

    if (color) {
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", color);
    }
  }, [theme]);

  return null;
}

/**
 * The return type is written out to keep the atoms an implementation detail:
 * Jotai's own setter also accepts updater functions and `RESET`, which are
 * persistence mechanics callers shouldn't reach for.
 */
export function useTheme(): {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
} {
  const [preference, setPreference] = useAtom(themePreferenceAtom);
  return { theme: useAtomValue(themeAtom), preference, setPreference };
}
