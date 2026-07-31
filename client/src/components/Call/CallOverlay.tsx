import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar } from "../common/Avatar";
import {
  MicIcon,
  MicOffIcon,
  PhoneIcon,
  PhoneOffIcon,
  SpeakerIcon,
  SpeakerOffIcon,
  VideoIcon,
  VideoOffIcon,
} from "../common/Icons";
import { useCall } from "../../context/CallContext";

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function CallOverlay() {
  const {
    status,
    kind,
    peer,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    isSpeakerOn,
    isSpeakerSupported,
    errorMessage,
    durationSeconds,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
    registerRemoteMediaElement,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  const isVideo = kind === "video";
  const isActive = status === "active";

  // Register whichever remote media element is currently mounted (video
  // for video calls, audio for voice calls) so toggleSpeaker can call
  // setSinkId on it. Re-runs whenever the video/audio element swaps.
  useEffect(() => {
    const el = isVideo && isActive ? remoteVideoRef.current : remoteAudioRef.current;
    registerRemoteMediaElement(el);
    return () => registerRemoteMediaElement(null);
  }, [isVideo, isActive, registerRemoteMediaElement]);

  if (status === "idle" || !peer) return null;

  const isRinging = status === "incoming";
  const isOutgoing = status === "outgoing" || status === "connecting";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col bg-surface-dark text-text-dark"
      >
        {/* Remote video fills the screen for video calls once active */}
        {isVideo && isActive && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover bg-black"
          />
        )}
        {!isVideo && <audio ref={remoteAudioRef} autoPlay />}

        {/* Dim scrim so controls/name stay legible over video */}
        <div
          className={
            isVideo && isActive
              ? "absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70"
              : "absolute inset-0 bg-gradient-to-b from-glow-violet/10 to-surface-dark"
          }
        />

        <div className="relative flex-1 flex flex-col items-center justify-center gap-4 px-6">
          {(!isVideo || !isActive) && (
            <Avatar name={peer.displayName} size={112} showStatus={false} />
          )}

          <div className="text-center">
            <p className="text-xl font-semibold">{peer.displayName}</p>
            <p className="text-sm text-text-dark/60 mt-1">
              {isRinging && `Incoming ${isVideo ? "video" : "voice"} call…`}
              {status === "outgoing" && "Calling…"}
              {status === "connecting" && "Connecting…"}
              {isActive && formatDuration(durationSeconds)}
            </p>
            {errorMessage && <p className="text-sm text-red-400 mt-2">{errorMessage}</p>}
          </div>

          {/* Local video preview (pip) for video calls */}
          {isVideo && localStream && (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute top-6 right-6 w-28 h-40 sm:w-32 sm:h-44 rounded-2xl object-cover bg-black/40 shadow-glow-violet"
            />
          )}
        </div>

        <div className="relative flex items-center justify-center gap-5 pb-10 sm:pb-12">
          {isRinging ? (
            <>
              <button
                onClick={declineCall}
                aria-label="Decline call"
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center transition-colors"
              >
                <PhoneOffIcon className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={acceptCall}
                aria-label="Accept call"
                className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center transition-colors"
              >
                <PhoneIcon className="w-6 h-6 text-white" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={toggleMute}
                aria-label={isMuted ? "Unmute" : "Mute"}
                className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                {isMuted ? <MicOffIcon className="w-5 h-5" /> : <MicIcon className="w-5 h-5" />}
              </button>
              {isVideo && (
                <button
                  onClick={toggleCamera}
                  aria-label={isCameraOff ? "Turn camera on" : "Turn camera off"}
                  className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  {isCameraOff ? (
                    <VideoOffIcon className="w-5 h-5" />
                  ) : (
                    <VideoIcon className="w-5 h-5" />
                  )}
                </button>
              )}
              {isSpeakerSupported && (
                <button
                  onClick={toggleSpeaker}
                  aria-label={isSpeakerOn ? "Turn speaker off" : "Turn speaker on"}
                  className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  {isSpeakerOn ? (
                    <SpeakerIcon className="w-5 h-5" />
                  ) : (
                    <SpeakerOffIcon className="w-5 h-5" />
                  )}
                </button>
              )}
              <button
                onClick={endCall}
                aria-label={isOutgoing ? "Cancel call" : "End call"}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center transition-colors"
              >
                <PhoneOffIcon className="w-6 h-6 text-white" />
              </button>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
