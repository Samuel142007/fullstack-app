import React, { useState, useEffect } from "react";
import io from "socket.io-client";

const socket = io("https://samuel-app.onrender.com");

const App = () => {
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [username, setUsername] = useState(sessionStorage.getItem("username") || "");
  const [inputName, setInputName] = useState("");
  const [loginError, setLoginError] = useState("");
  const [typingUser, setTypingUser] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingSend, setLoadingSend] = useState(false);
  const [userStatus, setUserStatus] = useState({});  // New state for user online/lastSeen

  // Request notification permission on load
  useEffect(() => {
    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  // Sync messages from localStorage and set up socket listeners
  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === "messages") {
        const updatedMessages = JSON.parse(event.newValue) || [];
        setMessages(updatedMessages);

        const latest = updatedMessages[updatedMessages.length - 1];
        if (
          latest &&
          latest.sender !== username &&
          document.hidden &&
          Notification.permission === "granted"
        ) {
          showNotification(latest);
        }
      }
    };

    window.addEventListener("storage", handleStorage);

    socket.on("typing", (username) => {
      setTypingUser(username);
    });

    socket.on("stopTyping", () => {
      setTypingUser("");
    });

    socket.on("messageRead", (messageId) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === messageId ? { ...msg, read: true } : msg
        )
      );
    });

    socket.on("newMessage", (message) => {
  setMessages((prev) => {
    // Check if the message is already in the state to avoid duplicates
    const messageExists = prev.some((msg) => msg.id === message.id);
    if (messageExists) return prev;

    const updated = [...prev, message];
    localStorage.setItem("messages", JSON.stringify(updated));
    return updated;
  });
});


    // Listen for user status updates
    socket.on("userStatusUpdate", (status) => {
      setUserStatus(status);
    });

    return () => {
      window.removeEventListener("storage", handleStorage);
      socket.off("typing");
      socket.off("stopTyping");
      socket.off("messageRead");
      socket.off("newMessage");
      socket.off("userStatusUpdate");
    };
  }, [username]);

  // Emit login event to server for status tracking
  useEffect(() => {
    if (username) {
      socket.emit("login", username);
    }
  }, [username]);

  const showNotification = (message) => {
    new Notification(`${message.sender} says:`, {
      body: message.text,
      icon: "https://cdn-icons-png.flaticon.com/512/1384/1384031.png",
    });
  };

  const handleLogin = async () => {
    if (!inputName.trim()) {
      setLoginError("Please enter a username.");
      return;
    }
    setLoadingLogin(true);
    try {
const response = await fetch("https://samuel-app.onrender.com/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: inputName }),
      });

      const data = await response.json();

      if (!response.ok) {
        setLoginError(data.error || "Login failed.");
        setLoadingLogin(false);
        return;
      }

      sessionStorage.setItem("username", data.username);
      setUsername(data.username);
      setLoginError("");
    } catch (err) {
      console.error(err);
      setLoginError("Server error. Try again later.");
    }
    setLoadingLogin(false);
  };

  const sendMessage = () => {
    if (currentMessage.trim() === "") return;
    setLoadingSend(true);

    const newMessage = {
      id: Date.now(),
      text: currentMessage,
      sender: username,
      read: false,
    };

    socket.emit("sendMessage", newMessage);  // Send to backend

    setMessages((prev) => {
      const updated = [...prev, newMessage];
      localStorage.setItem("messages", JSON.stringify(updated));
      return updated;
    });

    setCurrentMessage("");
    socket.emit("stopTyping");
    socket.emit("messageRead", newMessage.id);
    setLoadingSend(false);
  };

  const handleTyping = (e) => {
    setCurrentMessage(e.target.value);
    socket.emit("typing", username);
    if (e.target.value === "") {
      socket.emit("stopTyping");
    }
  };

  const clearMessages = () => {
    setMessages([]);
    localStorage.setItem("messages", JSON.stringify([]));
  };

  const logout = () => {
    sessionStorage.clear();
    window.location.reload();
  };

  const handleEmojiSelect = (emoji) => {
    setCurrentMessage((prev) => prev + emoji);
  };

  // Helper to format last seen time
  const formatLastSeen = (timestamp) => {
    if (!timestamp) return "Never";
    const diff = Date.now() - timestamp;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return Math.floor(diff / 60000) + " minutes ago";
    if (diff < 86400000) return Math.floor(diff / 3600000) + " hours ago";
    return new Date(timestamp).toLocaleString();
  };

  if (!username) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <div className="bg-white p-6 rounded shadow w-full max-w-sm">
          <h2 className="text-xl font-bold text-center mb-4">Login to Chat</h2>
          <input
            type="text"
            placeholder="Enter username"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loadingLogin && handleLogin()}
            className="w-full p-2 border rounded mb-2"
            disabled={loadingLogin}
          />
          {loginError && <p className="text-red-500 text-sm mb-2">{loginError}</p>}
          <button
            onClick={handleLogin}
            className={`w-full py-2 rounded text-white ${
              loadingLogin
                ? "bg-blue-300 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
            disabled={loadingLogin}
          >
            {loadingLogin ? "Logging in..." : "Login"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100 p-4">
      {/* User Status Panel */}
      <div className="mb-4 w-full max-w-2xl bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">User Status</h2>
        <ul>
          {Object.entries(userStatus).map(([user, status]) => (
            <li key={user} className="flex justify-between border-b py-1">
              <span>{user}</span>
              <span className="text-sm text-gray-600">
                {status.online ? (
                  <span className="text-green-600 font-semibold">Online</span>
                ) : (
                  <>Last seen: {formatLastSeen(status.lastSeen)}</>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="w-full max-w-2xl bg-white shadow rounded-lg flex flex-col h-full max-h-[90vh]">
        <div className="flex justify-between items-center px-4 py-3 border-b">
          <h1 className="text-lg font-semibold">Chat as {username}</h1>
          <button
            onClick={logout}
            className="text-sm bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
          >
            Logout
          </button>
        </div>

        <div className="flex flex-col flex-grow overflow-y-auto px-4 py-2 space-y-3 bg-gray-50">
          {messages.length === 0 ? (
            <p className="text-gray-500 text-center mt-10">Start chatting!</p>
          ) : (
            messages.map((msg, index) => {
              const isOwnMessage = msg.sender === username;
              return (
                <div
                  key={index}
                  className={`flex items-end ${
                    isOwnMessage ? "justify-end" : "justify-start"
                  }`}
                >
                  {!isOwnMessage && (
                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center mr-2 text-xs font-bold">
                      {msg.sender.charAt(0)}
                    </div>
                  )}
                  <div
                    className={`max-w-xs px-4 py-2 rounded-2xl text-sm shadow ${
                      isOwnMessage
                        ? "bg-blue-500 text-white rounded-br-none"
                        : "bg-gray-300 text-black rounded-bl-none"
                    }`}
                  >
                    <p className="font-medium text-xs mb-1">{msg.sender}</p>
                    <p>{msg.text}</p>
                    {msg.read && <span className="text-xs text-gray-400"> (Read)</span>}
                  </div>
                  {isOwnMessage && (
                    <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center ml-2 text-xs font-bold">
                      {msg.sender.charAt(0)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {typingUser && (
          <div className="text-sm text-gray-500 px-4 py-2">{typingUser} is typing...</div>
        )}

        <div className="px-4 py-3 border-t bg-white">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => handleEmojiSelect("😊")} className="text-xl">
              😊
            </button>
            <button onClick={() => handleEmojiSelect("😂")} className="text-xl">
              😂
            </button>
            <button onClick={() => handleEmojiSelect("❤️")} className="text-xl">
              ❤️
            </button>
            <input
              type="text"
              value={currentMessage}
              onChange={handleTyping}
              placeholder="Type a message..."
              onKeyDown={(e) => e.key === "Enter" && !loadingSend && sendMessage()}
              className="flex-grow border rounded-full px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              disabled={loadingSend}
            />
            <button
              onClick={sendMessage}
              className={`px-4 py-2 rounded-full text-white ${
                loadingSend
                  ? "bg-blue-300 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600"
              }`}
              disabled={loadingSend}
            >
              {loadingSend ? "Sending..." : "Send"}
            </button>
            <button
              onClick={clearMessages}
              className="bg-red-500 text-white px-4 py-2 rounded-full hover:bg-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
