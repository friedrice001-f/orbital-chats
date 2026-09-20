import { useEffect, useRef } from "react";
import { useCall } from "../../context/CallContext";
import { Avatar } from "../common/Avatar";
import {
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  SpeakerIcon,
  SpeakerOffIcon,
} from "../common/Icons";

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function ActiveCallScreen() {
  const {
    status,
    peerName,
    isMuted,
    isSpeakerOn,
    isSpeakerSupported,
    callDurationSec,
    remoteStream,
    toggleMute,
    toggleSpeaker,
    endCall,
    registerRemoteMediaElement,
  } = useCall();

  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Remote audio: attach the stream and play once metadata is ready.
  // Depends on `status` too, so it re-attaches once the call screen actually
  // mounts (the stream can be captured before this component exists).
  useEffect(() => {
    const el = remoteAudioRef.current;
    if (!el) return;
    el.srcObject = remoteStream;
    if (remoteStream) {
      const tryPlay = () => el.play().catch(() => {});
      if (el.readyState >= 1) tryPlay();
      else el.onloadedmetadata = tryPlay;
    }
  }, [remoteStream, status]);

  useEffect(() => {
    registerRemoteMediaElement(remoteAudioRef.current as unknown as HTMLVideoElement | null);
    return () => registerRemoteMediaElement(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status !== "calling" && status !== "connected") return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-dark">
      {/* Audio-only: no visible video element, just plays the remote stream */}
      <audio ref={remoteAudioRef} autoPlay className="hidden" />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        <Avatar name={peerName || "?"} size={96} showStatus={false} />
        <p className="text-xl font-semibold text-text-dark">{peerName}</p>
        <p className="text-sm text-text-dark/60">
          {status === "calling" ? "Calling…" : formatDuration(callDurationSec)}
        </p>
      </div>

      <div className="absolute bottom-10 inset-x-0 z-10 flex items-center justify-center gap-6">
        <button
          onClick={toggleMute}
          aria-label={isMuted ? "Unmute" : "Mute"}
          className="w-14 h-14 rounded-full bg-white/10 text-text-dark flex items-center justify-center"
        >
          {isMuted ? <MicOffIcon className="w-6 h-6" /> : <MicIcon className="w-6 h-6" />}
        </button>

        {isSpeakerSupported && (
          <button
            onClick={toggleSpeaker}
            aria-label={isSpeakerOn ? "Turn speaker off" : "Turn speaker on"}
            className={
              isSpeakerOn
                ? "w-14 h-14 rounded-full bg-glow-cyan text-surface-dark flex items-center justify-center"
                : "w-14 h-14 rounded-full bg-white/10 text-text-dark flex items-center justify-center"
            }
          >
            {isSpeakerOn ? (
              <SpeakerIcon className="w-6 h-6" />
            ) : (
              <SpeakerOffIcon className="w-6 h-6" />
            )}
          </button>
        )}

        <button
          onClick={endCall}
          aria-label="End call"
          className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center"
        >
          <PhoneOffIcon className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
}