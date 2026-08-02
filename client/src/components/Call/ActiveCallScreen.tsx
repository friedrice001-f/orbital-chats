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
    callType,
    peerName,
    isMuted,
    isCameraOff,
    isSpeakerOn,
    isSpeakerSupported,
    callDurationSec,
    localStream,
    remoteStream,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
    endCall,
    registerRemoteMediaElement,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const isVideoCall = callType === "video";
  const showAvatarFallback = !isVideoCall || !remoteStream;

  // Local preview: always muted via the DOM property (not the JSX attribute,
  // which React doesn't reliably sync), and only play once metadata is ready.
  // Depends on `status` too, so it re-attaches once the call screen actually
  // mounts (the stream can be captured before this component exists).
  useEffect(() => {
    const el = localVideoRef.current;
    if (!el) return;
    el.muted = true;
    el.srcObject = localStream;
    if (localStream) {
      const tryPlay = () => el.play().catch(() => {});
      if (el.readyState >= 1) tryPlay();
      else el.onloadedmetadata = tryPlay;
    }
  }, [localStream, status]);

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el) return;
    el.srcObject = remoteStream;
    if (remoteStream) {
      const tryPlay = () => el.play().catch(() => {});
      if (el.readyState >= 1) tryPlay();
      else el.onloadedmetadata = tryPlay;
    }
  }, [remoteStream, status]);

  useEffect(() => {
    registerRemoteMediaElement(remoteVideoRef.current);
    return () => registerRemoteMediaElement(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status !== "calling" && status !== "connected") return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-dark">
      {/* Always mounted — never conditionally created/destroyed */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="absolute inset-0 h-full w-full object-cover bg-black"
        style={{ visibility: isVideoCall ? "visible" : "hidden" }}
      />

      {showAvatarFallback && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <Avatar name={peerName || "?"} size={96} showStatus={false} />
          <p className="text-xl font-semibold text-text-dark">{peerName}</p>
          {!isVideoCall && (
            <p className="text-sm text-text-dark/60">
              {status === "calling" ? "Calling…" : formatDuration(callDurationSec)}
            </p>
          )}
        </div>
      )}

      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className="absolute top-6 right-6 w-28 h-40 rounded-xl object-cover bg-black/50 border border-white/10"
        style={{
          visibility: isVideoCall && !isCameraOff ? "visible" : "hidden",
        }}
      />

      {isVideoCall && (
        <div className="absolute top-6 left-6 text-text-dark">
          <p className="text-sm font-medium">{peerName}</p>
          <p className="text-xs text-text-dark/60">
            {status === "calling" ? "Calling…" : formatDuration(callDurationSec)}
          </p>
        </div>
      )}

      <div className="absolute bottom-10 inset-x-0 z-10 flex items-center justify-center gap-6">
        <button
          onClick={toggleMute}
          aria-label={isMuted ? "Unmute" : "Mute"}
          className="w-14 h-14 rounded-full bg-white/10 text-text-dark flex items-center justify-center"
        >
          {isMuted ? <MicOffIcon className="w-6 h-6" /> : <MicIcon className="w-6 h-6" />}
        </button>

        {isVideoCall && (
          <button
            onClick={toggleCamera}
            aria-label={isCameraOff ? "Turn camera on" : "Turn camera off"}
            className={
              isCameraOff
                ? "w-14 h-14 rounded-full bg-glow-cyan text-surface-dark flex items-center justify-center"
                : "w-14 h-14 rounded-full bg-white/10 text-text-dark flex items-center justify-center"
            }
          >
            📷
          </button>
        )}

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