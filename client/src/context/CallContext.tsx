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
import type { CallStatus, CallType, IncomingCallInfo } from "../types";

interface CallContextValue {
  status: CallStatus;
  callType: CallType | null;
  peerName: string | null;
  incomingCall: IncomingCallInfo | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeakerOn: boolean;
  isSpeakerSupported: boolean;
  callDurationSec: number;
  errorMessage: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  startCall: (peerId: string, peerName: string, callType: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleSpeaker: () => void;
  registerRemoteMediaElement: (el: HTMLVideoElement | null) => void;
}
const CallContext = createContext<CallContextValue | null>(null);

   const ICE_SERVERS: RTCConfiguration = {
  iceTransportPolicy: "relay",
  iceServers: [
    {
      urls: "turn:global.relay.metered.ca:80?transport=tcp",
      username: "ea791fc601b5a9a0521404a8",
      credential: "y83LlUrGQehWPEgL",
    },
    {
      urls: "turn:global.relay.metered.ca:443?transport=tcp",
      username: "ea791fc601b5a9a0521404a8",
      credential: "y83LlUrGQehWPEgL",
    },
    {
      urls: "turns:global.relay.metered.ca:443?transport=tcp",
      username: "ea791fc601b5a9a0521404a8",
      credential: "y83LlUrGQehWPEgL",
    },
  ],
};

export function CallProvider({ children }: { children: ReactNode }) {
  console.log("CALLPROVIDER VERSION: v2");
  const { currentUser } = useChat();

  const [status, setStatus] = useState<CallStatus>("idle");
  const [callType, setCallType] = useState<CallType | null>(null);
  const [peerName, setPeerName] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isSpeakerSupported, setIsSpeakerSupported] = useState(false);
  const [callDurationSec, setCallDurationSec] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remoteMediaElRef = useRef<HTMLVideoElement | null>(null);

  const statusRef = useRef<CallStatus>("idle");
  statusRef.current = status;
  const incomingCallRef = useRef<IncomingCallInfo | null>(null);
  incomingCallRef.current = incomingCall;
  const peerNameRef = useRef<string | null>(null);
  peerNameRef.current = peerName;

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
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    peerIdRef.current = null;
    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];
    stopTimer();
    setStatus("idle");
    setCallType(null);
    setPeerName(null);
    setIncomingCall(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsSpeakerOn(false);
    setCallDurationSec(0);
  }, [stopTimer]);

  const teardownRef = useRef(teardown);
  teardownRef.current = teardown;

  const createPeerConnection = useCallback((toUserId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("call:ice-candidate", { toUserId, candidate: event.candidate.toJSON() });
      }
    };

    pc.ontrack = (event) => {
      console.log("TRACK RECEIVED:", event.track.kind, event.streams[0]?.id);
      setRemoteStream(event.streams[0] ?? null);
    };
setInterval(async () => {
      if (pc.connectionState !== "connected") return;
      const stats = await pc.getStats();
      stats.forEach((report) => {
        if (report.type === "outbound-rtp" && report.kind === "video") {
          console.log("OUTBOUND video bytes sent:", report.bytesSent);
        }
        if (report.type === "inbound-rtp" && report.kind === "video") {
          console.log("INBOUND video bytes received:", report.bytesReceived, "packets lost:", report.packetsLost);
        }
      });
    }, 3000);

   pc.onconnectionstatechange = () => {
      console.log("CONNECTION STATE:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setStatus("connected");
      } else if (pc.connectionState === "failed") {
        if (statusRef.current !== "idle") {
          setTimeout(() => {
            if (pc.connectionState === "failed" && statusRef.current !== "idle") {
              setErrorMessage("Call connection failed.");
              teardownRef.current?.();
            }
          }, 8000);
        }
      } else if (pc.connectionState === "closed") {
        if (statusRef.current !== "idle") {
          setErrorMessage("Call connection failed.");
          teardownRef.current?.();
        }
      }
    }; 

    pcRef.current = pc;
    return pc;
  }, []);

  const getMedia = useCallback(async (type: CallType) => {
    return navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
  }, []);

  const startCall = useCallback(
    async (peerId: string, name: string, type: CallType) => {
      setErrorMessage(null);
      let stream: MediaStream;
      try {
        stream = await getMedia(type);
      } catch {
        setErrorMessage(
          type === "video"
            ? "Couldn't access camera/microphone. Check permissions."
            : "Couldn't access microphone. Check permissions."
        );
        return;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      peerIdRef.current = peerId;
      setCallType(type);
      const pc = createPeerConnection(peerId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      try {
        
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const plainOffer = { type: offer.type, sdp: offer.sdp };

        socket.emit(
          "call:invite",
          { toUserId: peerId, offer: plainOffer, callType: type },
          (result: { ok: boolean; error?: string }) => {
            if (!result.ok) {
              setErrorMessage(result.error || "Couldn't start the call.");
              teardown();
              return;
            }
            setPeerName(name);
            setStatus("calling");
          }
        );
      } catch {
        setErrorMessage("Couldn't set up the call.");
        teardown();
      }
    },
    [getMedia, createPeerConnection, teardown]
  );

  const acceptCall = useCallback(async () => {
    const incoming = incomingCallRef.current;
    if (!incoming || !pendingOfferRef.current) return;
    setErrorMessage(null);

    let stream: MediaStream;
    try {
      stream = await getMedia(incoming.callType);
    } catch {
      setErrorMessage(
        incoming.callType === "video"
          ? "Couldn't access camera/microphone. Check permissions."
          : "Couldn't access microphone. Check permissions."
      );
      socket.emit("call:reject", { toUserId: incoming.fromUserId });
      setIncomingCall(null);
      pendingOfferRef.current = null;
      return;
    }

    localStreamRef.current = stream;
    setLocalStream(stream);
    peerIdRef.current = incoming.fromUserId;
    setCallType(incoming.callType);
    const pc = createPeerConnection(incoming.fromUserId);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
    for (const candidate of pendingCandidatesRef.current) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    pendingCandidatesRef.current = [];
    pendingOfferRef.current = null;

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    const plainAnswer = { type: answer.type, sdp: answer.sdp };
    socket.emit("call:accept", { toUserId: incoming.fromUserId, answer: plainAnswer });

    setPeerName(incoming.fromName);
    setIncomingCall(null);
    setStatus("connected");
  }, [getMedia, createPeerConnection]);

  const rejectCall = useCallback(() => {
    const incoming = incomingCallRef.current;
    if (!incoming) return;
    socket.emit("call:reject", { toUserId: incoming.fromUserId });
    setIncomingCall(null);
    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];
  }, []);

  const endCall = useCallback(() => {
    if (peerIdRef.current) {
      socket.emit("call:end", { toUserId: peerIdRef.current });
    }
    teardown();
  }, [teardown]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !isMuted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !nextMuted));
    setIsMuted(nextMuted);
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextOff = !isCameraOff;
    stream.getVideoTracks().forEach((t) => (t.enabled = !nextOff));
    setIsCameraOff(nextOff);
  }, [isCameraOff]);

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
      // Output device selection can be unavailable — fail silently.
    }
  }, [isSpeakerOn]);

  const registerRemoteMediaElement = useCallback((el: HTMLVideoElement | null) => {
    remoteMediaElRef.current = el;
    setIsSpeakerSupported(!!el && typeof (el as any).setSinkId === "function");
  }, []);

  useEffect(() => {
    if (status === "connected" && !timerRef.current) {
      timerRef.current = setInterval(() => setCallDurationSec((d) => d + 1), 1000);
    }
    if (status !== "connected") stopTimer();
  }, [status, stopTimer]);

  useEffect(() => {
    function handleIncoming(payload: {
      fromUserId: string;
      fromName: string;
      offer: RTCSessionDescriptionInit;
      callType: CallType;
    }) {
      if (statusRef.current !== "idle") return;
      pendingOfferRef.current = payload.offer;
      setIncomingCall({
        fromUserId: payload.fromUserId,
        fromName: payload.fromName,
        callType: payload.callType || "voice",
      });
      setStatus("ringing");
    }

    async function handleAccepted({
      fromUserId,
      answer,
    }: {
      fromUserId: string;
      answer: RTCSessionDescriptionInit;
    }) {
      if (fromUserId !== peerIdRef.current) return;
      const pc = pcRef.current;
      if (!pc || !answer || !answer.type) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));


      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];
      setStatus("connected");
    }

    function handleRejected({ fromUserId }: { fromUserId: string }) {
      if (fromUserId !== peerIdRef.current) return;
      setErrorMessage(`${peerNameRef.current || "They"} declined the call.`);
      teardownRef.current?.();
    }

    function handleEnded({ fromUserId }: { fromUserId: string }) {
      if (fromUserId !== peerIdRef.current && fromUserId !== incomingCallRef.current?.fromUserId)
        return;
      teardownRef.current?.();
    }

    async function handleIceCandidate({
      fromUserId,
      candidate,
    }: {
      fromUserId: string;
      candidate: RTCIceCandidateInit;
    }) {
      if (fromUserId !== peerIdRef.current) return;
      const pc = pcRef.current;
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        pendingCandidatesRef.current.push(candidate);
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
  }, []);

  useEffect(() => {
    if (!currentUser) teardown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const value = useMemo<CallContextValue>(
    () => ({
      status,
      callType,
      peerName,
      incomingCall,
      isMuted,
      isCameraOff,
      isSpeakerOn,
      isSpeakerSupported,
      callDurationSec,
      errorMessage,
      localStream,
      remoteStream,
      startCall,
      acceptCall,
      rejectCall,
      endCall,
      toggleMute,
      toggleCamera,
      toggleSpeaker,
      registerRemoteMediaElement,
    }),
    [
      status,
      callType,
      peerName,
      incomingCall,
      isMuted,
      isCameraOff,
      isSpeakerOn,
      isSpeakerSupported,
      callDurationSec,
      errorMessage,
      localStream,
      remoteStream,
      startCall,
      acceptCall,
      rejectCall,
      endCall,
      toggleMute,
      toggleCamera,
      toggleSpeaker,
      registerRemoteMediaElement,
    ]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
}
