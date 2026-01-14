import { useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useChat } from './contexts/ChatContext';
import { useNotification } from './hooks/useNotification';
import LoginModal from './components/LoginModal';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';

function App() {
  const { currentUser } = useAuth();
  const { totalUnread, onNewMessageNotification } = useChat();
  const { requestPermission, showNotification, playSound } = useNotification();

  // Request notification permission when user logs in
  useEffect(() => {
    if (currentUser) {
      requestPermission();
    }
  }, [currentUser, requestPermission]);

  // Update tab title with unread count
  useEffect(() => {
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) SocketChat`;
    } else {
      document.title = 'SocketChat';
    }
  }, [totalUnread]);

  // Subscribe to new message notifications
  useEffect(() => {
    const unsubscribe = onNewMessageNotification((info) => {
      // Show browser notification
      showNotification({
        title: `${info.senderName}`,
        body: info.content.length > 50 
          ? info.content.substring(0, 50) + '...' 
          : info.content,
      });
      
      // Play notification sound
      playSound();
    });

    return unsubscribe;
  }, [onNewMessageNotification, showNotification, playSound]);

  return (
    <div className="h-screen w-full bg-gray-50 dark:bg-black overflow-hidden flex flex-col">
      {!currentUser ? (
        <LoginModal />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <Sidebar />
          <ChatWindow />
        </div>
      )}
    </div>
  );
}

export default App;
