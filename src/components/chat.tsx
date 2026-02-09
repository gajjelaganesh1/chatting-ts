import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
const socket = io(
  process.env.REACT_APP_SOCKET_URL || "http://localhost:3001",
   { transports: ["websocket"] }
)
interface Message {
  author: string;
  text: string;
  to: string;
}

const avatarColors = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#9333ea",
  "#f59e0b",
  "#0d9488",
];

const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
};

/* SIDEBAR  */
interface SidebarProps {
  users: string[];
  activeChat: string | null;
  conversations: Record<string, Message[]>;
  unread: Record<string, number>;
  isMobile: boolean;
  username: string;
  onSelect: (user: string) => void;
}

const Sidebar = ({
  users,
  activeChat,
  conversations,
  unread,
  username,
  onSelect,
}: SidebarProps) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">Chats</div>
      {users.map((u) => (
        <div
          key={u}
          className={`sidebar-user ${activeChat === u ? "active" : ""}`}
          onClick={() => onSelect(u)}
        >
          <div
            className="avatar"
            style={{ background: getAvatarColor(u) }}
          >
            {u[0]}
          </div>
          <div className="user-info">
            <div className="user-name">{u}</div>
            <div className="last-message">
              {conversations[u]
                ?.slice()
                .reverse()
                .find((m) => m.author !== username)?.text || ""}
            </div>
          </div>
          {unread[u] > 0 && (
            <div className="unread-badge">{unread[u]}</div>
          )}
        </div>
      ))}
    </div>
  );
};

/*  CHAT VIEW */
interface ChatViewProps {
  activeChat: string | null;
  conversations: Record<string, Message[]>;
  username: string;
  message: string;
  setMessage: (v: string) => void;
  sendMessage: () => void;
  isMobile: boolean;
  onBack: () => void;
  typingUser: string | null;
}

const ChatView = ({
  activeChat,
  conversations,
  username,
  message,
  setMessage,
  sendMessage,
  isMobile,
  typingUser,
  onBack,
}: ChatViewProps) => {
  return (
    <div className="chat">
      <div className="chat-header">
        {isMobile && (
          <button className="mobile-back" onClick={onBack}>
            ←
          </button>
        )}
        {activeChat || "Select a chat"}
      </div>

      <div className="chat-body">
        {(conversations[activeChat || ""] || []).map((m, i) => (
          <div
            key={i}
            className={`chat-row ${m.author === username ? "me" : "other"
              }`}
          >
            <div className="chat-bubble">{m.text}</div>
          </div>
        ))}
      </div>
      {typingUser && (
        <div className="typing-indicator">
          {typingUser} is typing…
        </div>
      )}
      <div className="chat-footer">
        <textarea
          value={message}
          placeholder="Type a message..."
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        <button className="send-btn" onClick={sendMessage} aria-label="Send">
          ➤
        </button>
      </div>
    </div>
  );
};

/*  MAIN  */
const Chat = () => {
  const isMobile = window.innerWidth <= 768;

  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);
  const [users, setUsers] = useState<string[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [mobileView, setMobileView] = useState<"users" | "chat">("users");
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [conversations, setConversations] = useState<
    Record<string, Message[]>
  >({});
  const [unread, setUnread] = useState<Record<string, number>>({});

  const joinChat = () => {
    if (!username.trim()) return;
    socket.emit("join", username);
    setJoined(true);
    if (isMobile) setMobileView("users");
  };

  const sendMessage = () => {
    if (!message.trim() || !activeChat) return;

    const msg: Message = {
      author: username,
      to: activeChat,
      text: message,
    };

    setConversations((prev) => ({
      ...prev,
      [activeChat]: [...(prev[activeChat] || []), msg],
    }));

    socket.emit("send_message", msg);
    setMessage("");
  };


  useEffect(() => {
    socket.on("users", (list: string[]) => {
      setUsers(list.filter((u) => u !== username));
    });

    socket.on("typing", (user: string) => {
      if (user !== username && user === activeChat) {
        setTypingUser(user);
      }
    });

    socket.on("stop_typing", (user: string) => {
      if (user === typingUser) {
        setTypingUser(null);
      }
    });

    socket.on("receive_message", (msg: Message) => {
      if (msg.to !== username) return;

      setConversations((prev) => ({
        ...prev,
        [msg.author]: [...(prev[msg.author] || []), msg],
      }));

      if (activeChat !== msg.author) {
        setUnread((prev) => ({
          ...prev,
          [msg.author]: (prev[msg.author] || 0) + 1,
        }));
      }
    });

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      socket.off();
    };
  }, [username, activeChat, typingUser]);

  /* WELCOME SCREEN */
  if (!joined) {
    return (
      <div className="welcome-wrap">
        <div className="welcome-glow" />

        <div className="welcome-box">
          <div className="welcome-badge">⚡ Live Messaging</div>

          <h1 className="welcome-heading">
            Talk in <span>Realtime</span>
          </h1>

          <p className="welcome-desc">
            Fast. Private. Minimal.
            start chatting instantly.
          </p>

          <input
            className="welcome-input"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && joinChat()}
          />

          <button className="welcome-cta" onClick={joinChat}>
            Enter Chat →
          </button>

          <div className="welcome-footer">
            No signup • No refresh • Instant sync
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="chat-layout">
      {isMobile ? (
        mobileView === "users" ? (
          <Sidebar
            users={users}
            activeChat={activeChat}
            conversations={conversations}
            unread={unread}
            username={username}
            isMobile={isMobile}
            onSelect={(u) => {
              setActiveChat(u);
              setUnread((p) => ({ ...p, [u]: 0 }));
              setMobileView("chat");
            }}
          />
        ) : (
          <ChatView
            activeChat={activeChat}
            conversations={conversations}
            username={username}
            message={message}
            setMessage={(v) => {
              setMessage(v);

              socket.emit("typing", username);

              if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
              }

              typingTimeoutRef.current = setTimeout(() => {
                socket.emit("stop_typing", username);
              }, 700);
            }}
            sendMessage={sendMessage}
            isMobile={isMobile}
            onBack={() => setMobileView("users")}
            typingUser={typingUser}
          />
        )
      ) : (
        <>
          <Sidebar
            users={users}
            activeChat={activeChat}
            conversations={conversations}
            unread={unread}
            username={username}
            isMobile={isMobile}
            onSelect={(u) => {
              setActiveChat(u);
              setUnread((p) => ({ ...p, [u]: 0 }));
            }}
          />
          <ChatView
            activeChat={activeChat}
            conversations={conversations}
            username={username}
            message={message}
            setMessage={(v) => {
              setMessage(v);

              socket.emit("typing", username);

              if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
              }

              typingTimeoutRef.current = setTimeout(() => {
                socket.emit("stop_typing", username);
              }, 700);
            }}
            sendMessage={sendMessage}
            isMobile={false}
            onBack={() => { }}
            typingUser={typingUser}
          />
        </>
      )}
    </div>
  );
};

export default Chat;
