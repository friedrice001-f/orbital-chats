import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { socket } from "../lib/socket";
import { useChat } from "./ChatContext";
import type {
  CallInviteResult,
  CallKind,
  CallSignalData,
  CallSignalPayload,
  IncomingCallPayload,
  PublicUser,
  RoomSummary,
} from "../types";

export type CallStatus = "idle" | "outgoing" | "incoming" | "connecting" | "active";

interface CallContextValue {
  status: CallStatus;
  kind: CallKind | null;
  peer: PublicUser | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeakerOn: boolean;
  isSpeakerSupported: boolean;
  errorMessage: string | null;
  durationSeconds: number;
  startCall: (room: RoomSummary, peer: PublicUser, kind: CallKind) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleSpeaker: () => void;
  // CallOverlay owns the actual <audio>/<video> element that plays the
  // remote stream (it swaps between the two depending on call kind), so it
  // registers whichever one is currently mounted here. That's the element
  // toggleSpeaker calls setSinkId on.
  registerRemoteMediaElement: (el: HTMLMediaElement | null) => void;
}

const CallContext = createContext<CallContextValue | null>(null);

// Public STUN servers only — good enough for most direct connections but
// there's no TURN relay configured, so calls between two peers both behind
// restrictive/symmetric NATs may fail to connect. Adding a TURN server
// (e.g. Twilio, Cloudflare) would close that gap.
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function CallProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useChat();

  const [status, setStatus] = useState<CallStatus>("idle");
  const [kind, setKind] = useState<CallKind | null>(null);
  const [peer, setPeer] = useState<PublicUser | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isSpeakerSupported, setIsSpeakerSupported] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);

  // Whichever <audio>/<video> element CallOverlay currently has mounted for
  // the remote stream. Browsers don't have a fully standardized way to force
  // "loudspeaker vs earpiece" the way a native phone app does — setSinkId is
  // the best available API. It works on Android Chrome but isn't guaranteed
  // on every browser, so isSpeakerSupported gates showing the button at all.
  const remoteMediaElRef = useRef<HTMLMediaElement | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const callIdRef = useRef<string | null>(null);
  const roleRef = useRef<"caller" | "callee" | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const incomingRef = useRef<IncomingCallPayload | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const teardown = useCallback(() => {
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStream?.getTracks().forEach((t) => t.stop());
    callIdRef.current = null;
    roleRef.current = null;
    incomingRef.current = null;
    pendingCandidatesRef.current = [];
    stopTimer();
    setStatus("idle");
    setKind(null);
    setPeer(null);
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsSpeakerOn(false);
    setDurationSeconds(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream, stopTimer]);

  const sendSignal = useCallback((data: CallSignalData) => {
    if (!callIdRef.current) return;
    socket.emit("call:signal", { callId: callIdRef.current, data });
  }, []);

  const createPeerConnection = useCallback(
    (stream: MediaStream) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({ type: "ice-candidate", candidate: event.candidate.toJSON() });
        }
      };

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0] ?? null);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setStatus("active");
        } else if (pc.connectionState === "failed") {
          setErrorMessage("Call connection failed.");
          endCallRef.current?.();
        }
      };

      pcRef.current = pc;
      return pc;
    },
    [sendSignal]
  );

  const getMedia = useCallback(async (callKind: CallKind) => {
    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callKind === "video" ? { facingMode: "user" } : false,
    });
  }, []);

  const startCall = useCallback(
    async (room: RoomSummary, callPeer: PublicUser, callKind: CallKind) => {
      setErrorMessage(null);
      let stream: MediaStream;
      try {
        stream = await getMedia(callKind);
      } catch {
        setErrorMessage("Couldn't access microphone/camera. Check permissions.");
        return;
      }

      socket.emit(
        "call:invite",
        { roomId: room.id, kind: callKind },
        (result: CallInviteResult) => {
          if (!result.ok || !result.callId) {
            stream.getTracks().forEach((t) => t.stop());
            setErrorMessage(result.error || "Couldn't start the call.");
            return;
          }
          callIdRef.current = result.callId;
          roleRef.current = "caller";
          setKind(callKind);
          setPeer(callPeer);
          setLocalStream(stream);
          setStatus("outgoing");
        }
      );
    },
    [getMedia]
  );

  const acceptCall = useCallback(async () => {
    const incoming = incomingRef.current;
    if (!incoming) return;
    setErrorMessage(null);

    let stream: MediaStream;
    try {
      stream = await getMedia(incoming.kind);
    } catch {
      setErrorMessage("Couldn't access microphone/camera. Check permissions.");
      socket.emit("call:answer", { callId: incoming.callId, accept: false });
      return;
    }

    roleRef.current = "callee";
    setLocalStream(stream);
    setStatus("connecting");
    createPeerConnection(stream);

    socket.emit("call:answer", { callId: incoming.callId, accept: true });
  }, [createPeerConnection, getMedia]);

  const declineCall = useCallback(() => {
    const incoming = incomingRef.current;
    if (!incoming) return;
    socket.emit("call:answer", { callId: incoming.callId, accept: false });
    incomingRef.current = null;
    setStatus("idle");
    setKind(null);
    setPeer(null);
  }, []);

  const endCall = useCallback(() => {
    if (callIdRef.current) {
      socket.emit("call:end", { callId: callIdRef.current });
    }
    teardown();
  }, [teardown]);

  // Keep a stable ref to endCall for use inside the peer connection's
  // event handlers (registered once per call, shouldn't go stale).
  const endCallRef = useRef(endCall);
  endCallRef.current = endCall;

  const toggleMute = useCallback(() => {
    if (!localStream) return;
    const nextMuted = !isMuted;
    localStream.getAudioTracks().forEach((t) => (t.enabled = !nextMuted));
    setIsMuted(nextMuted);
  }, [localStream, isMuted]);

  const toggleCamera = useCallback(() => {
    if (!localStream) return;
    const nextOff = !isCameraOff;
    localStream.getVideoTracks().forEach((t) => (t.enabled = !nextOff));
    setIsCameraOff(nextOff);
  }, [localStream, isCameraOff]);

  const registerRemoteMediaElement = useCallback((el: HTMLMediaElement | null) => {
    remoteMediaElRef.current = el;
    setIsSpeakerSupported(!!el && typeof (el as any).setSinkId === "function");
  }, []);

  const toggleSpeaker = useCallback(async () => {
    const el = remoteMediaElRef.current as any;
    if (!el || typeof el.setSinkId !== "function") return;
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
      await el.setSinkId(targetId);
      setIsSpeakerOn(nextOn);
    } catch {
      // Output device selection can be unavailable depending on browser
      // support/permissions; fail silently rather than breaking the call.
    }
  }, [isSpeakerOn]);

  useEffect(() => {
    if (status === "active" && !timerRef.current) {
      timerRef.current = setInterval(() => setDurationSeconds((d) => d + 1), 1000);
    }
    if (status !== "active") stopTimer();
  }, [status, stopTimer]);

  useEffect(() => {
    function handleIncoming(payload: IncomingCallPayload) {
      // Busy with another call — the server already prevents this in the
      // common case, but guard here too against races.
      if (statusRef.current !== "idle") return;
      incomingRef.current = payload;
      setKind(payload.kind);
      setPeer(payload.from);
      setStatus("incoming");
    }

    async function handleAccepted({ callId }: { callId: string }) {
      if (callId !== callIdRef.current || roleRef.current !== "caller" || !localStream) return;
      setStatus("connecting");
      const pc = createPeerConnection(localStream);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal({ type: "offer", sdp: offer });
      } catch {
        setErrorMessage("Couldn't set up the call.");
        endCallRef.current?.();
      }
    }

    function handleRejected({ callId }: { callId: string }) {
      if (callId !== callIdRef.current) return;
      setErrorMessage(`${peerRef.current?.displayName || "They"} declined the call.`);
      teardown();
    }

    function handleCancelled({ callId }: { callId: string }) {
      if (callId !== incomingRef.current?.callId && callId !== callIdRef.current) return;
      teardown();
    }

    function handleEnded({ callId }: { callId: string }) {
      if (callId !== callIdRef.current && callId !== incomingRef.current?.callId) return;
      teardown();
    }

    async function handleSignal({ callId, data }: CallSignalPayload) {
      if (callId !== callIdRef.current) return;
      const pc = pcRef.current;
      if (!pc) return;

      if (data.type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        for (const candidate of pendingCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidatesRef.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: "answer", sdp: answer });
      } else if (data.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        for (const candidate of pendingCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidatesRef.current = [];
      } else if (data.type === "ice-candidate") {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else {
          pendingCandidatesRef.current.push(data.candidate);
        }
      }
    }

    socket.on("call:incoming", handleIncoming);
    socket.on("call:accepted", handleAccepted);
    socket.on("call:rejected", handleRejected);
    socket.on("call:cancelled", handleCancelled);
    socket.on("call:ended", handleEnded);
    socket.on("call:signal", handleSignal);

    return () => {
      socket.off("call:incoming", handleIncoming);
      socket.off("call:accepted", handleAccepted);
      socket.off("call:rejected", handleRejected);
      socket.off("call:cancelled", handleCancelled);
      socket.off("call:ended", handleEnded);
      socket.off("call:signal", handleSignal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream, createPeerConnection, sendSignal, teardown]);

  // Stable refs for values read inside the socket handlers above.
  const statusRef = useRef<CallStatus>("idle");
  statusRef.current = status;
  const peerRef = useRef<PublicUser | null>(null);
  peerRef.current = peer;

  // If the caller cancels while still ringing (outgoing → idle before
  // acceptance), notify the callee side too.
  useEffect(() => {
    return () => {
      if (callIdRef.current && roleRef.current === "caller" && statusRef.current === "outgoing") {
        socket.emit("call:cancel", { callId: callIdRef.current });
      }
    };
  }, []);

  const cancelOutgoing = useCallback(() => {
    if (callIdRef.current) {
      socket.emit("call:cancel", { callId: callIdRef.current });
    }
    teardown();
  }, [teardown]);

  const value = useMemo<CallContextValue>(
    () => ({
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
      startCall,
      acceptCall,
      declineCall,
      // While ringing outward, "end" means cancel the invite.
      endCall: status === "outgoing" ? cancelOutgoing : endCall,
      toggleMute,
      toggleCamera,
      toggleSpeaker,
      registerRemoteMediaElement,
    }),
    [
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
      startCall,
      acceptCall,
      declineCall,
      endCall,
      cancelOutgoing,
      toggleMute,
      toggleCamera,
      toggleSpeaker,
      registerRemoteMediaElement,
    ]
  );

  useEffect(() => {
    if (!currentUser) teardown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
}
