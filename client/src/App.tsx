import { ThemeProvider } from "./context/ThemeContext";
import { ChatProvider, useChat } from "./context/ChatContext";
import { CallProvider } from "./context/CallContext";
import { LoginScreen } from "./components/Login/LoginScreen";
import { AppShell } from "./components/Layout/AppShell";
import { ActiveCallScreen } from "./components/Call/ActiveCallScreen";
import { IncomingCallModal } from "./components/Call/IncomingCallModal";

function Root() {
  const { currentUser } = useChat();
  return currentUser ? <AppShell /> : <LoginScreen />;
}
export default function App() {
  return (
    <ThemeProvider>
      <ChatProvider>
        <CallProvider>
          <Root />
          <ActiveCallScreen />
          <IncomingCallModal />
        </CallProvider>
      </ChatProvider>
    </ThemeProvider>
  );
}
