import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { nanoid } from "nanoid";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import multer from "multer";

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  const PORT = 3000;

  app.use(express.json());

  // --- Real-time RPS Logic ---
  const rpsRooms = new Map<string, { players: string[], moves: Record<string, string> }>();
  const tttRooms = new Map<string, { players: string[], board: (string | null)[], isXNext: boolean }>();

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // RPS Events
    socket.on("join-room", ({ roomId }) => {
      socket.join(roomId);
      if (!rpsRooms.has(roomId)) {
        rpsRooms.set(roomId, { players: [], moves: {} });
      }
      const room = rpsRooms.get(roomId)!;
      if (room.players.length < 2 && !room.players.includes(socket.id)) {
        room.players.push(socket.id);
      }
      io.to(roomId).emit("room-joined", { players: room.players });
    });

    socket.on("make-move", ({ roomId, move }) => {
      const room = rpsRooms.get(roomId);
      if (!room) return;
      room.moves[socket.id] = move;
      if (Object.keys(room.moves).length === 2) {
        let winner = "draw";
        const pIds = Object.keys(room.moves);
        const m1 = room.moves[pIds[0]];
        const m2 = room.moves[pIds[1]];
        if (m1 !== m2) {
          if ((m1 === "rock" && m2 === "scissors") || (m1 === "paper" && m2 === "rock") || (m1 === "scissors" && m2 === "paper")) {
            winner = pIds[0];
          } else {
            winner = pIds[1];
          }
        }
        io.to(roomId).emit("game-result", { winner, moves: room.moves });
        room.moves = {};
      } else {
        socket.to(roomId).emit("opponent-moved");
      }
    });

    // Tic-Tac-Toe Events
    socket.on("ttt-join-room", ({ roomId }) => {
      socket.join(roomId);
      if (!tttRooms.has(roomId)) {
        tttRooms.set(roomId, { players: [], board: Array(9).fill(null), isXNext: true });
      }
      const room = tttRooms.get(roomId)!;
      if (room.players.length < 2 && !room.players.includes(socket.id)) {
        room.players.push(socket.id);
      }
      io.to(roomId).emit("ttt-room-joined", { 
        players: room.players, 
        board: room.board, 
        isXNext: room.isXNext 
      });
    });

    socket.on("ttt-make-move", ({ roomId, index, symbol }) => {
      const room = tttRooms.get(roomId);
      if (!room) return;
      if (room.board[index] === null) {
        room.board[index] = symbol;
        room.isXNext = !room.isXNext;
        io.to(roomId).emit("ttt-move-made", { 
          board: room.board, 
          isXNext: room.isXNext 
        });
      }
    });

    socket.on("ttt-reset", ({ roomId }) => {
      const room = tttRooms.get(roomId);
      if (!room) return;
      room.board = Array(9).fill(null);
      room.isXNext = true;
      io.to(roomId).emit("ttt-game-reset", { 
        board: room.board, 
        isXNext: room.isXNext 
      });
    });

    socket.on("disconnect", () => {
      rpsRooms.forEach((room, roomId) => {
        if (room.players.includes(socket.id)) {
          room.players = room.players.filter(id => id !== socket.id);
          delete room.moves[socket.id];
          io.to(roomId).emit("player-disconnected", { players: room.players });
        }
      });
      tttRooms.forEach((room, roomId) => {
        if (room.players.includes(socket.id)) {
          room.players = room.players.filter(id => id !== socket.id);
          io.to(roomId).emit("ttt-player-disconnected", { players: room.players });
        }
      });
    });
  });

  // --- Data storage (simple JSON file for notes) ---
  const DATA_DIR = path.join(process.cwd(), "data");
  const NOTES_FILE = path.join(DATA_DIR, "notes.json");
  const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
  const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
  }
  if (!fs.existsSync(NOTES_FILE)) {
    fs.writeFileSync(NOTES_FILE, JSON.stringify({}));
  }
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ background: null }));
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  // Serve static files from public/uploads
  app.use("/uploads", express.static(UPLOADS_DIR));

  // Multer setup for background upload
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `background-${Date.now()}${ext}`);
    }
  });
  const upload = multer({ storage });

  // Settings Routes
  app.get("/api/settings", (req, res) => {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    res.json(settings);
  });

  app.post("/api/settings/background", upload.single("background"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const backgroundUrl = `/uploads/${req.file.filename}`;
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    settings.background = backgroundUrl;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    res.json({ background: backgroundUrl });
  });

  app.post("/api/settings/reset-background", (req, res) => {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    settings.background = null;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    res.json({ background: null });
  });

  // Notes Routes
  app.post("/api/notes", (req, res) => {
    const { content, password } = req.body;
    const id = nanoid(10);
    const notes = JSON.parse(fs.readFileSync(NOTES_FILE, "utf-8"));
    notes[id] = { content, password, createdAt: new Date().toISOString() };
    fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
    res.json({ id });
  });

  app.get("/api/notes/:id", (req, res) => {
    const { id } = req.params;
    const notes = JSON.parse(fs.readFileSync(NOTES_FILE, "utf-8"));
    const note = notes[id];
    if (!note) {
      return res.status(404).json({ error: "Note not found" });
    }
    res.json({ 
      hasPassword: !!note.password,
      createdAt: note.createdAt
    });
  });

  app.post("/api/notes/:id/unlock", (req, res) => {
    const { id } = req.params;
    const { password } = req.body;
    const notes = JSON.parse(fs.readFileSync(NOTES_FILE, "utf-8"));
    const note = notes[id];
    
    if (!note) {
      return res.status(404).json({ error: "Note not found" });
    }

    if (note.password && note.password !== password) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    res.json({ content: note.content });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
