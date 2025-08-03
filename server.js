const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let messageHistory = [];
let messageIdCounter = 0;
let connectedUsers = new Map(); // Store user info
let typingUsers = new Set(); // Track who's typing

wss.on('connection', (ws) => {
  let userId = null;
  let username = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'join') {
        // User joining the chat
        userId = data.userId;
        username = data.username;
        connectedUsers.set(userId, { username, ws });
        
        // Send message history and user list to new client
        ws.send(JSON.stringify({ 
          type: 'history', 
          messages: messageHistory,
          users: Array.from(connectedUsers.values()).map(u => u.username)
        }));
        
        // Notify others about new user
        broadcastToOthers(ws, { type: 'user_joined', username });
        
      } else if (data.type === 'new_message') {
        // Save and broadcast new message
        messageIdCounter++;
        const msgObj = { 
          id: `msg_${messageIdCounter}_${Date.now()}`, 
          text: data.text, 
          timestamp: Date.now(),
          userId: userId,
          username: username
        };
        messageHistory.push(msgObj);
        broadcastToAll({ type: 'message', message: msgObj });
        
      } else if (data.type === 'delete_message') {
        // Remove message from history
        const index = messageHistory.findIndex(msg => msg.id === data.messageId);
        if (index !== -1) {
          messageHistory.splice(index, 1);
          broadcastToAll({ type: 'delete_message', messageId: data.messageId });
        }
        
      } else if (data.type === 'typing_start') {
        typingUsers.add(username);
        broadcastToOthers(ws, { type: 'typing_start', username });
        
      } else if (data.type === 'typing_stop') {
        typingUsers.delete(username);
        broadcastToOthers(ws, { type: 'typing_stop', username });
        
      } else if (data.type === 'reaction') {
        // Add reaction to message
        const messageIndex = messageHistory.findIndex(msg => msg.id === data.messageId);
        if (messageIndex !== -1) {
          if (!messageHistory[messageIndex].reactions) {
            messageHistory[messageIndex].reactions = {};
          }
          if (!messageHistory[messageIndex].reactions[data.reaction]) {
            messageHistory[messageIndex].reactions[data.reaction] = [];
          }
          messageHistory[messageIndex].reactions[data.reaction].push(username);
          broadcastToAll({ type: 'reaction', messageId: data.messageId, reaction: data.reaction, username });
        }
      }
          } catch (error) {
        // Handle plain text messages (backward compatibility)
        messageIdCounter++;
        const msgObj = { 
          id: `msg_${messageIdCounter}_${Date.now()}`, 
          text: message.toString(), 
          timestamp: Date.now(),
          userId: userId,
          username: username || 'Anonymous'
        };
        messageHistory.push(msgObj);
        broadcastToAll({ type: 'message', message: msgObj });
      }
    });

    ws.on('close', () => {
      if (userId && connectedUsers.has(userId)) {
        const user = connectedUsers.get(userId);
        connectedUsers.delete(userId);
        typingUsers.delete(user.username);
        broadcastToAll({ type: 'user_left', username: user.username });
      }
    });
  });

  // Helper functions
  function broadcastToAll(data) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }

  function broadcastToOthers(excludeWs, data) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
        client.send(JSON.stringify(data));
      }
    });
  }

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
}); 