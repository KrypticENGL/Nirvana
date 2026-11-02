"use client";

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import type { Track } from "@/components/player";

// Liked songs and playlists live in this browser's localStorage, one entry per signed-in account.
// shortcut: browser-only, so a library doesn't follow the user to other devices; move to the API + DB for sync.

export type Playlist = { id: string; name: string; tracks: Track[] };
type Data = { likes: Track[]; playlists: Playlist[] };

const PREFIX = "nirvana-library:";
const EMPTY: Data = { likes: [], playlists: [] };

// --- tiny localStorage store (useSyncExternalStore needs a stable snapshot per stored value) ---
let cache: { key: string; raw: string | null; data: Data } | null = null;
const listeners = new Set<() => void>();

function rawFor(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage blocked (private mode, disabled site data)
  }
}

function read(key: string): Data {
  const raw = rawFor(key);
  if (cache?.key === key && cache.raw === raw) return cache.data;
  let data = EMPTY;
  try {
    const parsed = JSON.parse(raw ?? "null");
    if (Array.isArray(parsed?.likes) && Array.isArray(parsed?.playlists)) data = parsed;
  } catch {} // corrupt entry: start empty rather than crash
  cache = { key, raw, data };
  return data;
}

/** Returns false if the browser refused to save (quota or blocked storage); data is kept in memory. */
function write(key: string, data: Data) {
  let saved = true;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    saved = false;
  }
  cache = { key, raw: rawFor(key), data };
  listeners.forEach((l) => l());
  return saved;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Another tab changed the library: re-read.
  const onStorage = (e: StorageEvent) => (e.key === null || e.key.startsWith(PREFIX)) && onChange();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

// --- context ---------------------------------------------------------------------------
type Library = {
  signedIn: boolean;
  error: string | null;
  likes: Track[];
  playlists: Playlist[];
  isLiked: (id: string) => boolean;
  toggleLike: (t: Track) => void;
  /** Returns the new playlist's id. `first` is added in the same save (a second save would see stale data). */
  createPlaylist: (name: string, first?: Track) => string;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (playlistId: string, t: Track) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
};

const LibraryContext = createContext<Library | null>(null);
export const useLibrary = () => useContext(LibraryContext)!;

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const clerk = useClerk();
  const key = userId ? PREFIX + userId : null;
  const data = useSyncExternalStore(
    subscribe,
    () => (key ? read(key) : EMPTY),
    () => EMPTY, // server render: nothing stored
  );
  const [error, setError] = useState<string | null>(null);

  const save = (next: Data) => {
    if (!key) return;
    setError(write(key, next) ? null : "Couldn't save: this browser's storage is full or blocked.");
  };
  const playlistsWith = (id: string, change: (p: Playlist) => Playlist) =>
    data.playlists.map((p) => (p.id === id ? change(p) : p));

  const lib: Library = {
    signedIn: !!key,
    error,
    likes: data.likes,
    playlists: data.playlists,
    isLiked: (id) => data.likes.some((t) => t.id === id),
    toggleLike: (t) => {
      if (!key) return clerk.openSignIn();
      const liked = data.likes.some((x) => x.id === t.id);
      save({ ...data, likes: liked ? data.likes.filter((x) => x.id !== t.id) : [t, ...data.likes] });
    },
    createPlaylist: (name, first) => {
      const id = crypto.randomUUID();
      save({
        ...data,
        playlists: [...data.playlists, { id, name: name.slice(0, 100), tracks: first ? [first] : [] }],
      });
      return id;
    },
    deletePlaylist: (id) => save({ ...data, playlists: data.playlists.filter((p) => p.id !== id) }),
    addToPlaylist: (playlistId, t) =>
      save({
        ...data,
        playlists: playlistsWith(playlistId, (p) =>
          p.tracks.some((x) => x.id === t.id) ? p : { ...p, tracks: [...p.tracks, t] },
        ),
      }),
    removeFromPlaylist: (playlistId, trackId) =>
      save({
        ...data,
        playlists: playlistsWith(playlistId, (p) => ({ ...p, tracks: p.tracks.filter((x) => x.id !== trackId) })),
      }),
  };

  return <LibraryContext.Provider value={lib}>{children}</LibraryContext.Provider>;
}
