import { useEffect, useState } from "react";
import { PixelIcon } from "@/components/term/PixelIcon";
import backgroundAudioUrl from "@/assets/backgroundAudio.mp3";

const CLICK_AUDIO_URL = `${import.meta.env.BASE_URL}templates/stake-mines/sounds/click.mp3`;
const AUDIO_TOGGLE_EVENT = "dogegame:background-audio-toggle";
const AUDIO_STATE_EVENT = "dogegame:background-audio-state";

function publishAudioState(playing: boolean) {
  window.dispatchEvent(new CustomEvent(AUDIO_STATE_EVENT, { detail: { playing } }));
}

export function BackgroundAudioToggle() {
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const updateState = (event: Event) => {
      setPlaying(Boolean((event as CustomEvent<{ playing: boolean }>).detail?.playing));
    };
    window.addEventListener(AUDIO_STATE_EVENT, updateState);
    return () => window.removeEventListener(AUDIO_STATE_EVENT, updateState);
  }, []);

  return (
    <button
      type="button"
      data-background-audio-toggle
      onClick={() => window.dispatchEvent(new Event(AUDIO_TOGGLE_EVENT))}
      aria-label={playing ? "Mute background music" : "Play background music"}
      title={playing ? "Mute background music" : "Play background music"}
      className={`px-btn ${playing ? "text-phos" : "text-text-3"}`}
      data-variant="ghost"
      data-size="icon"
    >
      <PixelIcon name={playing ? "sound" : "mute"} size={15} />
    </button>
  );
}

function isEnabledButton(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  const button = target.closest("button, [role='button']");
  if (!button) return false;

  return !(
    (button instanceof HTMLButtonElement && button.disabled) ||
    button.getAttribute("aria-disabled") === "true"
  );
}

/** App-wide intro and button feedback sounds. */
export function GlobalAudioEffects() {
  useEffect(() => {
    const introAudio = new Audio(backgroundAudioUrl);
    const clickAudio = new Audio(CLICK_AUDIO_URL);
    introAudio.preload = "auto";
    introAudio.volume = 1;
    introAudio.loop = true;
    clickAudio.preload = "auto";
    clickAudio.volume = 0.55;

    let musicWanted = true;

    const stopIntro = (reset = true) => {
      musicWanted = false;
      introAudio.pause();
      if (reset) introAudio.currentTime = 0;
      document.removeEventListener("keydown", startIntro, true);
      publishAudioState(false);
    };

    async function startIntro() {
      musicWanted = true;
      try {
        await introAudio.play();
        if (!musicWanted) {
          introAudio.pause();
          introAudio.currentTime = 0;
          return;
        }
        publishAudioState(true);
      } catch {
        publishAudioState(false);
        // Browsers commonly block audio until a permitted user interaction.
      }
    }

    const stopOnFirstClick = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-background-audio-toggle]")
      ) {
        return;
      }
      stopIntro();
    };

    const toggleIntro = () => {
      if (introAudio.paused) void startIntro();
      else stopIntro(false);
    };

    const playButtonClick = (event: MouseEvent) => {
      if (!isEnabledButton(event.target)) return;
      const sound = clickAudio.cloneNode(true) as HTMLAudioElement;
      sound.volume = clickAudio.volume;
      void sound.play().catch(() => undefined);
    };

    void startIntro();
    document.addEventListener("keydown", startIntro, true);
    document.addEventListener("click", stopOnFirstClick, true);
    document.addEventListener("click", playButtonClick, true);
    window.addEventListener(AUDIO_TOGGLE_EVENT, toggleIntro);

    return () => {
      document.removeEventListener("keydown", startIntro, true);
      document.removeEventListener("click", stopOnFirstClick, true);
      document.removeEventListener("click", playButtonClick, true);
      window.removeEventListener(AUDIO_TOGGLE_EVENT, toggleIntro);
      introAudio.pause();
      clickAudio.pause();
    };
  }, []);

  return null;
}
