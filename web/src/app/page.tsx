"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Library as LibraryIcon, LogIn, Music, Radio, SlidersVertical, UserPlus } from "lucide-react";
import { Equalizer } from "@/components/equalizer";
import { Library } from "@/components/library";
import { LibraryProvider } from "@/components/library-context";
import { PlayerProvider } from "@/components/player";
import { MusicPlayer } from "@/components/music-player";
import { RadioPlayer } from "@/components/radio-player";

const tabs = [
  { id: "radio", label: "Radio", icon: Radio },
  { id: "music", label: "Music", icon: Music },
  { id: "library", label: "Library", icon: LibraryIcon },
  { id: "equalizer", label: "Equalizer", icon: SlidersVertical },
] as const;
type Tab = (typeof tabs)[number]["id"];

const accountButton =
  "grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary";

export default function Home() {
  const [tab, setTab] = useState<Tab>("radio");

  return (
    // Library (likes, playlists) and the shared music player are available to every tab.
    <LibraryProvider>
      <PlayerProvider>
        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex h-screen gap-6 p-6"
        >
          <aside className="neu flex w-16 shrink-0 flex-col items-center gap-8 rounded-3xl py-6">
            <span className="font-bold text-primary">N</span>
            <nav role="tablist" aria-label="Sections" aria-orientation="vertical" className="flex flex-col gap-4">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  role="tab"
                  id={`tab-${id}`}
                  aria-selected={tab === id}
                  aria-controls={`panel-${id}`}
                  title={label}
                  onClick={() => setTab(id)}
                  className={`grid size-10 place-items-center rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                    tab === id
                      ? "bg-panel text-panel-foreground neu-panel"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-5" />
                  <span className="sr-only">{label}</span>
                </button>
              ))}
            </nav>

            {/* Account: modal sign-in/up while signed out, profile menu once signed in */}
            <div className="mt-auto flex flex-col items-center gap-3">
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button title="Sign in" className={accountButton}>
                    <LogIn className="size-5" />
                    <span className="sr-only">Sign in</span>
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button title="Sign up" className={accountButton}>
                    <UserPlus className="size-5" />
                    <span className="sr-only">Sign up</span>
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <UserButton appearance={{ elements: { avatarBox: "size-9" } }} />
              </Show>
            </div>
          </aside>

          {/* Radio stays mounted while hidden so a playing station keeps playing on the Music tab. */}
          <section
            id="panel-radio"
            role="tabpanel"
            aria-labelledby="tab-radio"
            hidden={tab !== "radio"}
            className="neu-panel flex w-80 flex-col overflow-hidden rounded-3xl bg-panel text-panel-foreground [&[hidden]]:hidden"
          >
            <RadioPlayer />
          </section>

          <section
            id="panel-music"
            role="tabpanel"
            aria-labelledby="tab-music"
            hidden={tab !== "music"}
            className="flex min-w-0 flex-1 flex-col [&[hidden]]:hidden"
          >
            <MusicPlayer />
          </section>

          {tab === "library" && (
            <section
              id="panel-library"
              role="tabpanel"
              aria-labelledby="tab-library"
              className="flex min-w-0 flex-1 flex-col"
            >
              <Library />
            </section>
          )}

          {tab === "equalizer" && (
            <section
              id="panel-equalizer"
              role="tabpanel"
              aria-labelledby="tab-equalizer"
              className="flex min-w-0 flex-1 flex-col"
            >
              <Equalizer />
            </section>
          )}
        </motion.main>
      </PlayerProvider>
    </LibraryProvider>
  );
}
