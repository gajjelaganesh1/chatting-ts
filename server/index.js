const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

app.use(cors({ origin: "*"}));

app.get("/", (req, res) => {
  res.send("OK");
});


const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    transports: ["websocket"],
  },
});

// socket.id -> username
const users = {};

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("typing", (username) => {
    socket.broadcast.emit("typing", username);
  });

  socket.on("stop_typing", (username) => {
    socket.broadcast.emit("stop_typing", username);
  });

  socket.on("join", (username) => {
    users[socket.id] = username;
    io.emit("users", Object.values(users));
  });

  socket.on("send_message", (data) => {
    io.emit("receive_message", data);
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("users", Object.values(users));
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, "0.0.0.0", () => {
  console.log("✅ Server running on port", PORT);
});
