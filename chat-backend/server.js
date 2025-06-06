const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");


const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",  // Adjust this for your deployment
  },
});

app.use(cors());
app.use(express.json());

let users = ["SAMUEL", "ANJOLA"];
let messages = [];

// This object will track online users and their last seen timestamps
// Format: { username: { online: bool, lastSeen: timestamp } }
const userStatus = {};
users.forEach(user => {
  userStatus[user] = { online: false, lastSeen: null };
});

app.post("/login", (req, res) => {
  const { username } = req.body;
  if (!username || !users.includes(username)) {
    return res.status(400).json({ error: "Invalid username. Only authorised username only." });
  }
  res.status(200).json({ username });
});

io.on("connection", (socket) => {
  console.log("A user connected");

  // User will send their username after connecting
  socket.on("login", (username) => {
    if (users.includes(username)) {
      socket.username = username;
      userStatus[username].online = true;
      userStatus[username].lastSeen = null; // Clear last seen because they're online now

      // Notify everyone about updated statuses
      io.emit("userStatusUpdate", userStatus);
      console.log(`${username} is now online`);
    }
  });

  socket.on("typing", (username) => {
    socket.broadcast.emit("typing", username);
  });

  socket.on("stopTyping", () => {
    socket.broadcast.emit("stopTyping");
  });

  socket.on("sendMessage", (message) => {
    messages.push(message);
    io.emit("newMessage", message);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
    if (socket.username) {
      userStatus[socket.username].online = false;
      userStatus[socket.username].lastSeen = Date.now();

      // Notify everyone about updated statuses
      io.emit("userStatusUpdate", userStatus);
      console.log(`${socket.username} went offline`);
    }
  });
});

app.use(express.static("client/dist"));


// Add this health check route
app.get('/render-health', (req, res) => {
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  if (process.env.RENDER) {
    process.stdout.write('RENDER_PORT_ACTIVATED');
  }
});
