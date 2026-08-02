import { useCall } from "../../context/CallContext";
import { Avatar } from "../common/Avatar";
import { PhoneIcon, PhoneOffIcon } from "../common/Icons";

export function IncomingCallModal() {
  const { incomingCall, acceptCall, rejectCall } = useCall();
  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-xs rounded-2xl bg-surface-bright dark:bg-surface-dark-soft p-6 text-center">
        <div className="flex justify-center">
          <Avatar name={incomingCall.fromName} size={72} showStatus={false} />
        </div>
        <p className="mt-4 text-lg font-semibold text-text-bright dark:text-text-dark">
          {incomingCall.fromName}
        </p>
        <p className="text-sm text-text-bright/60 dark:text-text-dark/60">
          {incomingCall.callType === "video" ? "Incoming video call…" : "Incoming voice call…"}
        </p>
        <div className="mt-6 flex justify-center gap-6">
          <button
            onClick={rejectCall}
            aria-label="Decline call"
            className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center"
          >
            <PhoneOffIcon className="w-6 h-6" />
          </button>
          <button
            onClick={acceptCall}
            aria-label="Accept call"
            className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center"
          >
            <PhoneIcon className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}