import { ThemeProvider } from "./context/ThemeContext";
import { ChatProvider, useChat } from "./context/ChatContext";
import { CallProvider } from "./context/CallContext";
import { LoginScreen } from "./components/Login/LoginScreen";
import { AppShell } from "./components/Layout/AppShell";
import { CallOverlay } from "./components/Call/CallOverlay";

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
          <CallOverlay />
        </CallProvider>
      </ChatProvider>
    </ThemeProvider>
  );
}
