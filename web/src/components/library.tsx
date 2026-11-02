"use client";

import { useState } from "react";
import { SignInButton } from "@clerk/nextjs";
import { Heart, ListMusic, Play, Plus, Trash2, X } from "lucide-react";
import { useLibrary } from "@/components/library-context";
import { TrackRow } from "@/components/music-player";
import { NowPlaying, usePlayer, type Track } from "@/components/player";

const LIKED = "liked";
const songs = (n: number) => `${n} ${n === 1 ? "song" : "songs"}`;

export function Library() {
  const lib = useLibrary();
  const player = usePlayer();
  const [selected, setSelected] = useState(LIKED);
  const [newName, setNewName] = useState("");

  const playlist = lib.playlists.find((p) => p.id === selected);

  if (!lib.signedIn)
    return (
      <div className="neu flex flex-1 flex-col items-center justify-center gap-4 rounded-3xl p-8 text-center">
        <Heart className="size-10 text-primary" />
        <h1 className="text-2xl font-semibold">Your library</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Sign in to like songs and build playlists. They&apos;re saved in this browser for your account.
        </p>
        <SignInButton mode="modal">
          <button className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_4px_14px_rgb(242_107_29/0.4)]">
            Sign in
          </button>
        </SignInButton>
      </div>
    );

  // A deleted playlist falls back to Liked Songs.
  const showingLiked = !playlist;
  const tracks = showingLiked ? lib.likes : playlist.tracks;
  const title = showingLiked ? "Liked Songs" : playlist.name;

  const remove = (t: Track) => playlist && lib.removeFromPlaylist(playlist.id, t.id);

  return (
    <div className="flex min-h-0 flex-1 gap-6">
      <aside className="neu flex w-64 shrink-0 flex-col gap-3 rounded-3xl p-5">
        <h1 className="text-xl font-semibold">Your library</h1>
        <ul className="surface-scroll -mx-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2">
          <li>
            <button
              onClick={() => setSelected(LIKED)}
              aria-current={showingLiked}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${
                showingLiked ? "neu-inset text-primary" : "hover:bg-black/[0.03]"
              }`}
            >
              <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-panel text-white">
                <Heart className="size-4" fill="currentColor" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">Liked Songs</span>
                <span className="block text-xs text-muted-foreground">{songs(lib.likes.length)}</span>
              </span>
            </button>
          </li>
          {lib.playlists.map((p) => (
            <li key={p.id} className="group flex items-center">
              <button
                onClick={() => setSelected(p.id)}
                aria-current={selected === p.id}
                className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${
                  selected === p.id ? "neu-inset text-primary" : "hover:bg-black/[0.03]"
                }`}
              >
                <span className="grid size-9 place-items-center rounded-xl bg-panel text-panel-foreground">
                  <ListMusic className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">{songs(p.tracks.length)}</span>
                </span>
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete playlist "${p.name}"?`)) lib.deletePlaylist(p.id);
                }}
                aria-label={`Delete playlist ${p.name}`}
                className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            setSelected(lib.createPlaylist(newName.trim())); // open the new playlist
            setNewName("");
          }}
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New playlist"
            aria-label="New playlist name"
            maxLength={100}
            className="neu-inset min-w-0 flex-1 rounded-full bg-transparent px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <button
            aria-label="Create playlist"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
          >
            <Plus className="size-4" />
          </button>
        </form>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <section className="neu flex min-h-0 flex-1 flex-col rounded-3xl p-5">
          <header className="mb-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-semibold">{title}</h2>
              <p className="text-xs text-muted-foreground">
                {showingLiked ? "Every song you like lands here automatically." : songs(tracks.length)}
              </p>
            </div>
            <button
              onClick={() => tracks.length && player.playTrack(tracks, tracks[0])}
              disabled={!tracks.length}
              className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-[0_4px_14px_rgb(242_107_29/0.4)] disabled:opacity-40"
            >
              <Play className="size-4" /> Play all
            </button>
          </header>
          {lib.error && (
            <p className="mb-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{lib.error}</p>
          )}
          <ul className="surface-scroll -mx-2 min-h-0 flex-1 overflow-y-auto px-2">
            {!tracks.length && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                {showingLiked
                  ? "Tap the heart on any song to add it here."
                  : "Add songs with the playlist button on any track."}
              </li>
            )}
            {tracks.map((t) => (
              <TrackRow
                key={t.id}
                track={t}
                list={tracks}
                extra={
                  !showingLiked && (
                    <button
                      onClick={() => remove(t)}
                      aria-label={`Remove ${t.title} from ${title}`}
                      className="grid size-8 shrink-0 place-items-center rounded-full opacity-60 hover:text-destructive hover:opacity-100"
                    >
                      <X className="size-4" />
                    </button>
                  )
                }
              />
            ))}
          </ul>
        </section>
        <NowPlaying fallback={tracks} />
      </div>
    </div>
  );
}
