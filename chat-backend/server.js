import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Restrict to your domain in production
  },
});

app.use(cors());
app.use(express.json());

let users = ["SAMUEL", "ANJOLA"];
let messages = [];
const userStatus = users.reduce((acc, user) => {
  acc[user] = { online: false, lastSeen: null };
  return acc;
}, {});

app.post("/login", (req, res) => {
  const { username } = req.body;
  if (!username || !users.includes(username)) {
    return res.status(400).json({ error: "Invalid username. Only authorized usernames allowed." });
  }
  res.status(200).json({ username });
});

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("login", (username) => {
    if (users.includes(username)) {
      socket.username = username;
      userStatus[username].online = true;
      userStatus[username].lastSeen = null;
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
      io.emit("userStatusUpdate", userStatus);
      console.log(`${socket.username} went offline`);
    }
  });
});

// Static Files and Health Check
app.use(express.static(path.join(__dirname, "../client/dist")));
app.get("/render-health", (req, res) => res.status(200).send("OK"));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
