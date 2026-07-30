import { ThemeProvider } from "./context/ThemeContext";
import { ChatProvider, useChat } from "./context/ChatContext";
import { LoginScreen } from "./components/Login/LoginScreen";
import { AppShell } from "./components/Layout/AppShell";

function Root() {
  const { currentUser } = useChat();
  return currentUser ? <AppShell /> : <LoginScreen />;
}

export default function App() {
  return (
    <ThemeProvider>
      <ChatProvider>
        <Root />
      </ChatProvider>
    </ThemeProvider>
  );
}
