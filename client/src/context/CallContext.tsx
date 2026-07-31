
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { socket } from "../lib/socket";
import { useChat } from "./ChatContext";
import type { CallStatus } from "../types";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

interface CallContextValue {
  status: CallStatus;
  peerName: string | null;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isSpeakerSupported: boolean;
  callDurationSec: number;
  startCall: (peerId: string, peerName: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  incomingCall: { fromUserId: string; fromName: string } | null;
}

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useChat();
  const [status, setStatus] = useState<CallStatus>("idle");
  const [peerName, setPeerName] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isSpeakerSupported, setIsSpeakerSupported] = useState(false);
  const [callDurationSec, setCallDurationSec] = useState(0);
  const [incomingCall, setIncomingCall] = useState<{
    fromUserId: string;
    fromName: string;
  } | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const durationTimerRef = useRef<number | null>(null);
  const statusRef = useRef<CallStatus>("idle");
  statusRef.current = status;

  useEffect(() => {
    const el = remoteAudioRef.current;
    setIsSpeakerSupported(!!el && typeof (el as any).setSinkId === "function");
  }, []);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    peerIdRef.current = null;
    pendingOfferRef.current = null;
    setStatus("idle");
    setPeerName(null);
    setIsMuted(false);
    setIsSpeakerOn(false);
    setIncomingCall(null);
    setCallDurationSec(0);
    if (durationTimerRef.current) {
      window.clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  }, []);

  const createPeerConnection = useCallback((toUserId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("call:ice-candidate", { toUserId, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setStatus("connected");
        if (!durationTimerRef.current) {
          durationTimerRef.current = window.setInterval(() => {
            setCallDurationSec((s) => s + 1);
          }, 1000);
        }
      }
    };

    return pc;
  }, []);

  const startCall = useCallback(
    async (peerId: string, name: string) => {
      if (!currentUser || statusRef.current !== "idle") return;
      setStatus("calling");
      setPeerName(name);
      peerIdRef.current = peerId;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = createPeerConnection(peerId);
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit(
        "call:invite",
        { toUserId: peerId, offer },
        (res: { ok: boolean; error?: string }) => {
          if (!res.ok) {
            alert(res.error || "Call failed.");
            cleanup();
          }
        }
      );
    },
    [currentUser, createPeerConnection, cleanup]
  );

  const acceptCall = useCallback(async () => {
    if (!incomingCall || !pendingOfferRef.current) return;
    const { fromUserId, fromName } = incomingCall;
    setPeerName(fromName);
    peerIdRef.current = fromUserId;
    setIncomingCall(null);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreamRef.current = stream;

    const pc = createPeerConnection(fromUserId);
    pcRef.current = pc;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("call:accept", { toUserId: fromUserId, answer });
    pendingOfferRef.current = null;
  }, [incomingCall, createPeerConnection]);

  const rejectCall = useCallback(() => {
    if (!incomingCall) return;
    socket.emit("call:reject", { toUserId: incomingCall.fromUserId });
    setIncomingCall(null);
    pendingOfferRef.current = null;
    setStatus("idle");
  }, [incomingCall]);

  const endCall = useCallback(() => {
    if (peerIdRef.current) {
      socket.emit("call:end", { toUserId: peerIdRef.current });
    }
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !isMuted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !nextMuted));
    setIsMuted(nextMuted);
  }, [isMuted]);

  const toggleSpeaker = useCallback(async () => {
    const audioEl = remoteAudioRef.current as any;
    if (!audioEl || typeof audioEl.setSinkId !== "function") return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter((d) => d.kind === "audiooutput");
      const nextOn = !isSpeakerOn;
      let targetId = "default";
      if (nextOn) {
        const speaker = outputs.find((d) => /speaker/i.test(d.label));
        if (speaker) targetId = speaker.deviceId;
      } else {
        const earpiece = outputs.find((d) => /earpiece|receiver/i.test(d.label));
        targetId = earpiece ? earpiece.deviceId : "default";
      }
      await audioEl.setSinkId(targetId);
      setIsSpeakerOn(nextOn);
    } catch {
      // Output device selection can be unavailable depending on browser
      // support/permissions; fail silently rather than breaking the call.
    }
  }, [isSpeakerOn]);

  useEffect(() => {
    function handleIncoming({
      fromUserId,
      fromName,
      offer,
    }: {
      fromUserId: string;
      fromName: string;
      offer: RTCSessionDescriptionInit;
    }) {
      if (statusRef.current !== "idle") return;
      pendingOfferRef.current = offer;
      setIncomingCall({ fromUserId, fromName });
      setStatus("ringing");
    }

    async function handleAccepted({ answer }: { answer: RTCSessionDescriptionInit }) {
      if (!pcRef.current) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      setStatus("connected");
    }

    function handleRejected() {
      cleanup();
    }

    function handleEnded() {
      cleanup();
    }

    async function handleIceCandidate({ candidate }: { candidate: RTCIceCandidateInit }) {
      if (!pcRef.current) return;
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Safe to ignore stray candidates arriving out of order.
      }
    }

    socket.on("call:incoming", handleIncoming);
    socket.on("call:accepted", handleAccepted);
    socket.on("call:rejected", handleRejected);
    socket.on("call:ended", handleEnded);
    socket.on("call:ice-candidate", handleIceCandidate);

    return () => {
      socket.off("call:incoming", handleIncoming);
      socket.off("call:accepted", handleAccepted);
      socket.off("call:rejected", handleRejected);
      socket.off("call:ended", handleEnded);
      socket.off("call:ice-candidate", handleIceCandidate);
    };
  }, [cleanup]);

  return (
    <CallContext.Provider
      value={{
        status,
        peerName,
        isMuted,
        isSpeakerOn,
        isSpeakerSupported,
        callDurationSec,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleSpeaker,
        incomingCall,
      }}
    >
      {children}
      <audio ref={remoteAudioRef} autoPlay />
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
}
