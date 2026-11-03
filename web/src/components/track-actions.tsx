"use client";

import { useId, useState } from "react";
import { Check, Heart, ListPlus, Plus } from "lucide-react";
import { useLibrary } from "@/components/library-context";
import type { Track } from "@/components/player";

export function LikeButton({ track, className = "" }: { track: Track; className?: string }) {
  const lib = useLibrary();
  const liked = lib.isLiked(track.id);
  const [pop, setPop] = useState(false);
  return (
    <button
      onClick={() => {
        if (!liked && lib.signedIn) setPop(true); // celebrate the like, not the unlike
        lib.toggleLike(track);
      }}
      onAnimationEnd={() => setPop(false)}
      aria-label={liked ? `Unlike ${track.title}` : `Like ${track.title}`}
      aria-pressed={liked}
      className={`grid size-8 shrink-0 place-items-center rounded-full transition-[color,opacity,scale] duration-(--duration-fast) hover:text-primary focus-visible:outline-2 focus-visible:outline-primary active:scale-90 ${
        liked ? "text-primary" : "opacity-60 hover:opacity-100"
      } ${className}`}
    >
      <Heart className={`size-4 ${pop ? "animate-pop" : ""}`} fill={liked ? "currentColor" : "none"} />
    </button>
  );
}

/** "Add to playlist" menu using the browser's popover (closes on outside click / Escape). */
export function AddToPlaylist({ track }: { track: Track }) {
  const lib = useLibrary();
  const menuId = useId();
  const anchor = `--add-${menuId.replace(/[^a-zA-Z0-9-]/g, "")}`;
  const [added, setAdded] = useState<string | null>(null);
  const [name, setName] = useState("");

  if (!lib.signedIn) return null; // the heart already prompts sign-in

  function add(playlistId: string) {
    lib.addToPlaylist(playlistId, track);
    setAdded(playlistId);
    setTimeout(() => (document.getElementById(menuId) as HTMLElement | null)?.hidePopover(), 600);
  }

  return (
    <>
      <button
        popoverTarget={menuId}
        aria-label={`Add ${track.title} to a playlist`}
        style={{ anchorName: anchor } as React.CSSProperties}
        onClick={() => setAdded(null)}
        className="grid size-8 shrink-0 place-items-center rounded-full opacity-60 transition-[color,opacity,scale] duration-(--duration-fast) hover:text-primary hover:opacity-100 focus-visible:outline-2 focus-visible:outline-primary active:scale-90"
      >
        <ListPlus className="size-4" />
      </button>
      <div
        id={menuId}
        popover="auto"
        // inset:auto clears the browser's centered-popover default before anchoring below the button
        style={
          {
            inset: "auto",
            positionAnchor: anchor,
            top: "anchor(bottom)",
            right: "anchor(right)",
          } as React.CSSProperties
        }
        className="surface-float m-0 mt-2 w-56 rounded-2xl p-2 text-sm text-foreground"
      >
        <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">Add to playlist</p>
        <ul className="surface-scroll max-h-48 overflow-y-auto">
          {lib.playlists.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => add(p.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.06]"
              >
                <span className="flex-1 truncate">{p.name}</span>
                {added === p.id && <Check className="size-4 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-1 flex gap-1 border-t border-border pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            // Creating from a track's menu also adds that track, then closes like picking a playlist does.
            const id = lib.createPlaylist(name.trim(), track);
            setName("");
            setAdded(id);
            setTimeout(() => (document.getElementById(menuId) as HTMLElement | null)?.hidePopover(), 600);
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New playlist with this song"
            aria-label="New playlist with this song"
            maxLength={100}
            className="neu-inset min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 outline-none"
          />
          <button aria-label="Create playlist" className="grid size-7 place-items-center rounded-lg hover:text-primary">
            <Plus className="size-4" />
          </button>
        </form>
      </div>
    </>
  );
}
