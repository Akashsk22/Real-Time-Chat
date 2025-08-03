import React, { useEffect, useRef, useState } from 'react';
import './App.css';

const WS_URL = 'ws://localhost:4000';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [username, setUsername] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [showLogin, setShowLogin] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  
  const ws = useRef(null);
  const chatEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const userId = useRef(null);

  const emojis = ['😊', '👍', '❤️', '😂', '😮', '😢', '🎉', '🔥'];

  useEffect(() => {
    if (!showLogin) {
      connectWebSocket();
    }
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [showLogin]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const connectWebSocket = () => {
    ws.current = new WebSocket(WS_URL);
    
    ws.current.onopen = () => {
      setIsConnected(true);
      userId.current = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      ws.current.send(JSON.stringify({
        type: 'join',
        userId: userId.current,
        username: username
      }));
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'history':
          setMessages(data.messages);
          setOnlineUsers(data.users);
          break;
        case 'message':
          setMessages((prev) => [...prev, data.message]);
          break;
        case 'delete_message':
          setMessages((prev) => prev.filter(msg => msg.id !== data.messageId));
          break;
        case 'user_joined':
          setOnlineUsers((prev) => [...prev, data.username]);
          setMessages((prev) => [...prev, {
            id: `system_${Date.now()}`,
            text: `${data.username} joined the chat`,
            timestamp: Date.now(),
            isSystem: true
          }]);
          break;
        case 'user_left':
          setOnlineUsers((prev) => prev.filter(user => user !== data.username));
          setMessages((prev) => [...prev, {
            id: `system_${Date.now()}`,
            text: `${data.username} left the chat`,
            timestamp: Date.now(),
            isSystem: true
          }]);
          break;
        case 'typing_start':
          setTypingUsers((prev) => [...prev.filter(user => user !== data.username), data.username]);
          break;
        case 'typing_stop':
          setTypingUsers((prev) => prev.filter(user => user !== data.username));
          break;
        case 'reaction':
          setMessages((prev) => prev.map(msg => 
            msg.id === data.messageId 
              ? { ...msg, reactions: { ...msg.reactions, [data.reaction]: [...(msg.reactions?.[data.reaction] || []), data.username] } }
              : msg
          ));
          break;
      }
    };

    ws.current.onclose = () => {
      setIsConnected(false);
    };
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (username.trim()) {
      setShowLogin(false);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (input.trim() && ws.current?.readyState === 1) {
      ws.current.send(JSON.stringify({
        type: 'new_message',
        text: input
      }));
      setInput('');
      setShowEmojiPicker(false);
    }
  };

  const deleteMessage = (messageId) => {
    if (ws.current?.readyState === 1) {
      ws.current.send(JSON.stringify({
        type: 'delete_message',
        messageId: messageId
      }));
    }
  };

  const handleTyping = (e) => {
    setInput(e.target.value);
    
    if (ws.current?.readyState === 1) {
      ws.current.send(JSON.stringify({ type: 'typing_start' }));
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        ws.current.send(JSON.stringify({ type: 'typing_stop' }));
      }, 1000);
    }
  };

  const addReaction = (messageId, reaction) => {
    if (ws.current?.readyState === 1) {
      ws.current.send(JSON.stringify({
        type: 'reaction',
        messageId: messageId,
        reaction: reaction
      }));
    }
    setSelectedMessage(null);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (showLogin) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h1>Welcome to ChatApp</h1>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-input"
              required
            />
            <button type="submit" className="login-btn">Join Chat</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h3>Online Users ({onlineUsers.length})</h3>
        </div>
        <div className="user-list">
          {onlineUsers.map((user, index) => (
            <div key={index} className="user-item">
              <div className="user-avatar">{user[0].toUpperCase()}</div>
              <span className="user-name">{user}</span>
              <div className="online-indicator"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat */}
      <div className="chat-container">
        <div className="chat-header">
          <div className="header-info">
            <h2>Real-Time Chat</h2>
            <div className="connection-status">
              <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          <div className="user-info">
            <span>Welcome, {username}!</span>
          </div>
        </div>

        <div className="chat-messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`message-wrapper ${msg.isSystem ? 'system-message' : ''}`}>
              {msg.isSystem ? (
                <div className="system-message">
                  <span>{msg.text}</span>
                  <span className="message-time">{formatTime(msg.timestamp)}</span>
                </div>
              ) : (
                <div className={`message ${msg.username === username ? 'own-message' : 'other-message'}`}>
                  <div className="message-header">
                    <span className="message-author">{msg.username}</span>
                    <span className="message-time">{formatTime(msg.timestamp)}</span>
                  </div>
                  <div className="message-content">
                    <p>{msg.text}</p>
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="message-reactions">
                        {Object.entries(msg.reactions).map(([reaction, users]) => (
                          <span key={reaction} className="reaction">
                            {reaction} {users.length}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="message-actions">
                    <button 
                      className="reaction-btn"
                      onClick={() => setSelectedMessage(selectedMessage === msg.id ? null : msg.id)}
                    >
                      😊
                    </button>
                    {msg.username === username && (
                      <button 
                        className="delete-btn"
                        onClick={() => deleteMessage(msg.id)}
                        title="Delete message"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                  {selectedMessage === msg.id && (
                    <div className="emoji-picker">
                      {emojis.map((emoji) => (
                        <button
                          key={emoji}
                          className="emoji-option"
                          onClick={() => addReaction(msg.id, emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {typingUsers.length > 0 && (
            <div className="typing-indicator">
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form className="chat-input-container" onSubmit={sendMessage}>
          <div className="input-wrapper">
            <input
              type="text"
              value={input}
              onChange={handleTyping}
              placeholder="Type your message..."
              className="chat-input"
              disabled={!isConnected}
            />
            <button 
              type="button" 
              className="emoji-toggle"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              😊
            </button>
          </div>
          {showEmojiPicker && (
            <div className="emoji-picker-input">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="emoji-option"
                  onClick={() => {
                    setInput(prev => prev + emoji);
                    setShowEmojiPicker(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          <button type="submit" className="send-btn" disabled={!isConnected || !input.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
