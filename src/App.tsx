import React, { useState, useEffect, useRef, MouseEvent, TouchEvent, ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import { 
  FileText, 
  Palette, 
  Gamepad2, 
  Settings, 
  X, 
  Minus, 
  Square, 
  Maximize2,
  Trash2,
  Save,
  Share2,
  Lock,
  Unlock,
  Scissors,
  Hand,
  Circle,
  Hash,
  User,
  Cpu,
  RefreshCw,
  Eraser,
  Image as ImageIcon
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type AppType = 'notepad' | 'drawing' | 'tictactoe' | 'rps' | 'settings';

interface WindowState {
  id: string;
  type: AppType;
  title: string;
  isOpen: boolean;
  isMinimized: boolean;
  isLocked: boolean;
  zIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// --- Components ---

const TaskbarIcon = ({ icon: Icon, label, onClick, isActive }: { icon: any, label: string, onClick: () => void, isActive?: boolean }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 group relative",
      isActive ? "bg-white/20 shadow-lg" : "hover:bg-white/10"
    )}
  >
    <Icon className="w-8 h-8 text-white drop-shadow-md" />
    <span className="text-[10px] text-white mt-1 font-medium opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-black/50 px-2 py-1 rounded whitespace-nowrap">
      {label}
    </span>
    {isActive && <div className="absolute -bottom-1 w-1 h-1 bg-white rounded-full" />}
  </button>
);

interface WindowProps {
  window: WindowState;
  onClose: () => void;
  onMinimize: () => void;
  onToggleLock: () => void;
  onFocus: () => void;
  children: ReactNode;
  key?: string | number;
}

const Window = ({ 
  window, 
  onClose, 
  onMinimize, 
  onToggleLock,
  onFocus, 
  children 
}: WindowProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [pos, setPos] = useState({ x: window.x, y: window.y });

  if (!window.isOpen) return null;

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ 
        scale: window.isMinimized ? 0.8 : 1, 
        opacity: window.isMinimized ? 0 : 1,
        y: window.isMinimized ? 100 : 0,
        pointerEvents: window.isMinimized ? 'none' : 'auto'
      }}
      transition={{ duration: 0.2 }}
      drag={!window.isLocked && !window.isMinimized}
      dragMomentum={false}
      onDragStart={() => {
        setIsDragging(true);
        onFocus();
      }}
      onDragEnd={(_, info) => {
        setIsDragging(false);
        setPos(prev => ({ x: prev.x + info.offset.x, y: prev.y + info.offset.y }));
      }}
      style={{ 
        zIndex: window.zIndex,
        width: window.width,
        height: window.height,
        position: 'absolute',
        left: pos.x,
        top: pos.y
      }}
      className={cn(
        "bg-white/90 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 flex flex-col overflow-hidden",
        isDragging ? "cursor-grabbing" : "cursor-default"
      )}
      onMouseDown={onFocus}
    >
      {/* Title Bar */}
      <div className={cn(
        "h-10 bg-white/50 border-bottom border-black/5 flex items-center justify-between px-4 select-none",
        window.isLocked ? "cursor-default" : "cursor-grab active:cursor-grabbing"
      )}>
        <div className="flex items-center gap-2">
          {window.type === 'notepad' && <FileText className="w-4 h-4 text-blue-500" />}
          {window.type === 'drawing' && <Palette className="w-4 h-4 text-purple-500" />}
          {window.type === 'tictactoe' && <Hash className="w-4 h-4 text-green-500" />}
          {window.type === 'rps' && <Scissors className="w-4 h-4 text-red-500" />}
          {window.type === 'settings' && <Settings className="w-4 h-4 text-gray-500" />}
          <span className="text-sm font-semibold text-gray-700">{window.title}</span>
          {window.isLocked && <Lock className="w-3 h-3 text-gray-400" />}
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onToggleLock(); }} 
            className={cn(
              "p-1.5 rounded-md transition-colors",
              window.isLocked ? "bg-blue-100 text-blue-600" : "hover:bg-black/5 text-gray-500"
            )}
            title={window.isLocked ? "Unlock Window" : "Lock Window"}
          >
            {window.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onMinimize(); }} className="p-1.5 hover:bg-black/5 rounded-md transition-colors">
            <Minus className="w-4 h-4 text-gray-500" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-1.5 hover:bg-red-500 hover:text-white rounded-md transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto bg-white/50 p-4">
        {children}
      </div>
    </motion.div>
  );
};

// --- App Components ---

const Notepad = () => {
  const [content, setContent] = useState('');
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, password })
      });
      const data = await res.json();
      setShareUrl(`${window.location.origin}/note/${data.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 p-4 bg-white/80 border border-black/10 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        placeholder="Type your note here..."
      />
      <div className="flex items-center gap-4 bg-white/50 p-3 rounded-lg border border-black/5">
        <div className="flex items-center gap-2 flex-1">
          <Lock className="w-4 h-4 text-gray-400" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Set password (optional)"
            className="bg-transparent text-sm focus:outline-none w-full"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || !content}
          className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save & Share'}
        </button>
      </div>
      {shareUrl && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
          <span className="text-xs text-green-700 truncate flex-1 mr-2">{shareUrl}</span>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
              alert('Copied to clipboard!');
            }}
            className="p-1 hover:bg-green-100 rounded"
          >
            <Share2 className="w-4 h-4 text-green-600" />
          </button>
        </div>
      )}
    </div>
  );
};

const ColoringBook = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#ff0000');
  const [brushSize, setBrushSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);
  const [isEraser, setIsEraser] = useState(false);

  const pages = [
    {
      name: 'House',
      paths: [
        'M 50 150 L 150 50 L 250 150 Z', // Roof
        'M 70 150 L 230 150 L 230 250 L 70 250 Z', // Body
        'M 130 200 L 170 200 L 170 250 L 130 250 Z', // Door
        'M 90 170 L 110 170 L 110 190 L 90 190 Z', // Window 1
        'M 190 170 L 210 170 L 210 190 L 190 190 Z', // Window 2
      ]
    },
    {
      name: 'Flower',
      paths: [
        'M 150 150 C 120 120 120 180 150 150', // Petal 1
        'M 150 150 C 180 120 180 180 150 150', // Petal 2
        'M 150 150 C 120 120 180 120 150 150', // Petal 3
        'M 150 150 C 120 180 180 180 150 150', // Petal 4
        'M 150 150 L 150 250', // Stem
        'M 150 200 C 130 190 130 210 150 200', // Leaf
      ]
    },
    {
      name: 'Robot',
      paths: [
        'M 120 80 L 180 80 L 180 130 L 120 130 Z', // Head
        'M 100 130 L 200 130 L 200 220 L 100 220 Z', // Body
        'M 110 220 L 110 260 L 130 260 L 130 220 Z', // Leg 1
        'M 170 220 L 170 260 L 190 260 L 190 220 Z', // Leg 2
        'M 80 140 L 100 140 L 100 180 L 80 180 Z', // Arm 1
        'M 200 140 L 220 140 L 220 180 L 200 180 Z', // Arm 2
      ]
    }
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }
    
    drawPage();
  }, [currentPage]);

  const drawPage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPageLines();
  };

  const startDrawing = (e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? (e as any).touches[0].clientX - rect.left : (e as any).clientX - rect.left;
    const y = ('touches' in e) ? (e as any).touches[0].clientY - rect.top : (e as any).clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: MouseEvent | TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? (e as any).touches[0].clientX - rect.left : (e as any).clientX - rect.left;
    const y = ('touches' in e) ? (e as any).touches[0].clientY - rect.top : (e as any).clientY - rect.top;

    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
    
    // If erasing, redraw lines immediately so they don't look erased during the stroke
    if (isEraser) {
      drawPageLines();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    // Redraw the template lines to ensure they are always on top and not erased
    drawPageLines();
  };

  const drawPageLines = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const page = pages[currentPage];
    page.paths.forEach(pathData => {
      const p = new Path2D(pathData);
      ctx.save();
      ctx.translate(canvas.width / 2 - 150, canvas.height / 2 - 150);
      ctx.scale(1.5, 1.5);
      ctx.stroke(p);
      ctx.restore();
    });
    ctx.restore();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPageLines();
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center gap-4 bg-white/50 p-2 rounded-lg border border-black/5 flex-wrap">
        <div className="flex gap-2">
          {pages.map((page, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentPage(idx)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                currentPage === idx ? "bg-purple-500 text-white" : "bg-white hover:bg-purple-50 text-purple-600 border border-purple-200"
              )}
            >
              {page.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <button
            onClick={() => setIsEraser(!isEraser)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              isEraser ? "bg-purple-500 text-white" : "bg-white hover:bg-purple-50 text-purple-600 border border-purple-200"
            )}
            title={isEraser ? "Switch to Brush" : "Switch to Eraser"}
          >
            <Eraser className="w-5 h-5" />
          </button>
          <input 
            type="color" 
            value={color} 
            onChange={(e) => {
              setColor(e.target.value);
              setIsEraser(false);
            }}
            className="w-8 h-8 rounded cursor-pointer border-none"
          />
          <input 
            type="range" 
            min="1" 
            max="50" 
            value={brushSize} 
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="flex-1 accent-purple-500"
          />
        </div>
        <button onClick={clear} className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors" title="Clear Drawing">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 bg-white border border-black/10 rounded-lg overflow-hidden cursor-crosshair relative shadow-inner">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full"
        />
      </div>
    </div>
  );
};

const SettingsApp = ({ onBackgroundChange }: { onBackgroundChange: (url: string | null) => void }) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('background', file);

    try {
      const res = await fetch('/api/settings/background', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.background) {
        onBackgroundChange(data.background);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = async () => {
    try {
      await fetch('/api/settings/reset-background', { method: 'POST' });
      onBackgroundChange(null);
    } catch (err) {
      console.error('Reset failed:', err);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <section>
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-blue-500" />
          Appearance
        </h3>
        <div className="bg-white/50 p-4 rounded-xl border border-black/5 flex flex-col gap-4">
          <p className="text-sm text-gray-600">Change your desktop background</p>
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              Upload Image
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Reset
            </button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            accept="image/*"
            className="hidden"
          />
        </div>
      </section>

      <section>
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-gray-500" />
          System
        </h3>
        <div className="bg-white/50 p-4 rounded-xl border border-black/5">
          <p className="text-sm text-gray-600">Ari Tiger OS v1.0.0</p>
          <p className="text-[10px] text-gray-400 mt-1">Running on Antigravity Engine</p>
        </div>
      </section>
    </div>
  );
};

const TicTacToe = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [isAI, setIsAI] = useState(false);
  const winner = calculateWinner(board);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('ttt-room-joined', (data) => {
      setJoined(true);
      setPlayers(data.players);
      setBoard(data.board);
      setIsXNext(data.isXNext);
    });

    newSocket.on('ttt-move-made', (data) => {
      setBoard(data.board);
      setIsXNext(data.isXNext);
    });

    newSocket.on('ttt-game-reset', (data) => {
      setBoard(data.board);
      setIsXNext(data.isXNext);
    });

    newSocket.on('ttt-player-disconnected', (data) => {
      setPlayers(data.players);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  function calculateWinner(squares: any[]) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    return squares.every(s => s !== null) ? 'Draw' : null;
  }

  const handleClick = (i: number) => {
    if (winner || board[i]) return;

    if (isAI) {
      const newBoard = board.slice();
      newBoard[i] = isXNext ? 'X' : 'O';
      setBoard(newBoard);
      setIsXNext(!isXNext);
      
      // AI Move
      if (!calculateWinner(newBoard)) {
        setTimeout(() => {
          const emptyIndices = newBoard.map((s, idx) => s === null ? idx : null).filter(idx => idx !== null) as number[];
          if (emptyIndices.length > 0) {
            const aiMove = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
            newBoard[aiMove] = !isXNext ? 'X' : 'O';
            setBoard([...newBoard]);
            setIsXNext(true); // Player is always X in AI mode, so set it back to true
          }
        }, 500);
      }
    } else if (socket && joined) {
      const symbol = players[0] === socket.id ? 'X' : 'O';
      const currentSymbol = isXNext ? 'X' : 'O';
      if (symbol === currentSymbol) {
        socket.emit('ttt-make-move', { roomId, index: i, symbol });
      }
    }
  };

  const reset = () => {
    if (isAI) {
      setBoard(Array(9).fill(null));
      setIsXNext(true);
    } else if (socket && joined) {
      socket.emit('ttt-reset', { roomId });
    }
  };

  const joinRoom = () => {
    if (!roomId || !socket) return;
    socket.emit('ttt-join-room', { roomId });
    setIsAI(false);
  };

  const generateRoomId = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(id);
  };

  const playAI = () => {
    setIsAI(true);
    setJoined(true);
    setPlayers(['player', 'ai']);
  };

  if (!joined) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Tic-Tac-Toe</h2>
          <p className="text-gray-500">Play with a friend or against AI</p>
        </div>
        
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="flex-1 p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50"
              />
              <button 
                onClick={generateRoomId} 
                className="bg-gray-100 text-gray-600 px-3 rounded-xl hover:bg-gray-200 transition-colors" 
                title="Generate Room ID"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <button 
              onClick={joinRoom} 
              className="w-full bg-green-500 text-white p-3 rounded-xl hover:bg-green-600 transition-colors font-bold"
            >
              Join Room
            </button>
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-400">Or</span></div>
          </div>
          <button onClick={playAI} className="flex items-center justify-center gap-2 bg-gray-800 text-white p-3 rounded-xl hover:bg-gray-900 transition-colors">
            <Cpu className="w-5 h-5" />
            Play vs AI
          </button>
        </div>
      </div>
    );
  }

  const mySymbol = isAI ? 'X' : (players[0] === socket?.id ? 'X' : 'O');
  const isMyTurn = isAI ? isXNext : (isXNext ? players[0] === socket?.id : players[1] === socket?.id);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6">
      <div className="flex justify-between w-full max-w-xs mb-2">
        <div className={cn("flex flex-col items-center p-2 rounded-lg transition-colors", isXNext ? "bg-blue-50" : "")}>
          <X className={cn("w-6 h-6", isXNext ? "text-blue-500" : "text-gray-300")} />
          <span className="text-[10px] font-bold text-gray-500">{players[0] === socket?.id ? 'You (X)' : 'Player 1 (X)'}</span>
        </div>
        <div className={cn("flex flex-col items-center p-2 rounded-lg transition-colors", !isXNext ? "bg-red-50" : "")}>
          <Circle className={cn("w-6 h-6", !isXNext ? "text-red-500" : "text-gray-300")} />
          <span className="text-[10px] font-bold text-gray-500">{players[1] === socket?.id ? 'You (O)' : isAI ? 'AI (O)' : 'Player 2 (O)'}</span>
        </div>
      </div>

      <div className="text-xl font-bold text-gray-700">
        {winner ? (winner === 'Draw' ? "It's a Draw!" : `Winner: ${winner}`) : (isMyTurn ? "Your Turn!" : "Waiting...")}
      </div>

      <div className="grid grid-cols-3 gap-2 bg-gray-200 p-2 rounded-xl shadow-inner">
        {board.map((square, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            disabled={!!winner || !isMyTurn || !!board[i]}
            className="w-20 h-20 bg-white rounded-lg flex items-center justify-center text-3xl font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-100"
          >
            {square === 'X' && <X className="w-10 h-10 text-blue-500" />}
            {square === 'O' && <Circle className="w-10 h-10 text-red-500" />}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        <button
          onClick={reset}
          className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors font-semibold shadow-md"
        >
          <RefreshCw className="w-5 h-5" />
          Restart
        </button>
      </div>

      {!isAI && (
        <div className="flex items-center gap-2 text-[10px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          Room: <span className="font-mono font-bold">{roomId}</span>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(roomId);
              alert('Room ID copied!');
            }}
            className="hover:text-gray-600"
            title="Copy Room ID"
          >
            <Share2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};

const RockPaperScissors = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  const [move, setMove] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [isAI, setIsAI] = useState(false);
  const [opponentMoved, setOpponentMoved] = useState(false);
  const [aiHistory, setAiHistory] = useState<string[]>([]);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('room-joined', (data) => {
      setJoined(true);
      setPlayers(data.players);
    });

    newSocket.on('player-joined', (data) => {
      setPlayers(data.players);
    });

    newSocket.on('opponent-moved', () => {
      setOpponentMoved(true);
    });

    newSocket.on('game-result', (data) => {
      setResult(data);
      setOpponentMoved(false);
    });

    newSocket.on('player-disconnected', () => {
      setPlayers(prev => prev.slice(0, 1));
      setResult(null);
      setMove(null);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const joinRoom = () => {
    if (!roomId || !socket) return;
    socket.emit('join-room', { roomId });
    setIsAI(false);
  };

  const generateRoomId = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(id);
  };

  const playAI = () => {
    setIsAI(true);
    setJoined(true);
    setPlayers([{ id: 'player' }, { id: 'ai' }]);
  };

  const makeMove = (choice: string) => {
    setMove(choice);
    if (isAI) {
      const choices = ['rock', 'paper', 'scissors'];
      
      // Improved AI: Try to avoid long streaks to feel more "random"
      let aiChoice = choices[Math.floor(Math.random() * 3)];
      
      // If AI has picked the same thing 2 times in a row, pick something else
      if (aiHistory.length >= 2 && aiHistory[aiHistory.length - 1] === aiHistory[aiHistory.length - 2]) {
        const lastMove = aiHistory[aiHistory.length - 1];
        const otherChoices = choices.filter(c => c !== lastMove);
        aiChoice = otherChoices[Math.floor(Math.random() * 2)];
      }

      setAiHistory(prev => [...prev, aiChoice].slice(-5));
      
      let res = '';
      if (choice === aiChoice) res = 'draw';
      else if (
        (choice === 'rock' && aiChoice === 'scissors') ||
        (choice === 'paper' && aiChoice === 'rock') ||
        (choice === 'scissors' && aiChoice === 'paper')
      ) res = 'win';
      else res = 'lose';
      
      const playerId = 'player'; // Use a stable ID for AI mode
      setResult({ 
        winner: res === 'win' ? playerId : res === 'draw' ? 'draw' : 'ai', 
        moves: { [playerId]: choice, 'ai': aiChoice } 
      });
    } else if (socket) {
      socket.emit('make-move', { roomId, move: choice });
    }
  };

  const reset = () => {
    setMove(null);
    setResult(null);
    setOpponentMoved(false);
  };

  if (!joined) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Rock Paper Scissors</h2>
          <p className="text-gray-500">Play with a friend or against AI</p>
        </div>
        
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="flex-1 p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/50"
              />
              <button 
                onClick={generateRoomId} 
                className="bg-gray-100 text-gray-600 px-3 rounded-xl hover:bg-gray-200 transition-colors" 
                title="Generate Room ID"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <button 
              onClick={joinRoom} 
              className="w-full bg-red-500 text-white p-3 rounded-xl hover:bg-red-600 transition-colors font-bold"
            >
              Join Room
            </button>
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-400">Or</span></div>
          </div>
          <button onClick={playAI} className="flex items-center justify-center gap-2 bg-gray-800 text-white p-3 rounded-xl hover:bg-gray-900 transition-colors">
            <Cpu className="w-5 h-5" />
            Play vs AI
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 p-4">
      <div className="flex justify-between w-full max-w-sm">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-1">
            <User className="w-6 h-6 text-blue-500" />
          </div>
          <span className="text-xs font-bold text-gray-600">You</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-1">
            {isAI ? <Cpu className="w-6 h-6 text-red-500" /> : <User className="w-6 h-6 text-red-500" />}
          </div>
          <span className="text-xs font-bold text-gray-600">{isAI ? 'AI' : 'Opponent'}</span>
        </div>
      </div>

      {result ? (
        <div className="text-center animate-bounce">
          <h3 className="text-3xl font-black text-gray-800 mb-2">
            {result.winner === 'draw' ? "IT'S A DRAW!" : result.winner === (isAI ? 'player' : socket?.id) ? "YOU WIN!" : "YOU LOSE!"}
          </h3>
          <div className="flex gap-4 justify-center text-sm text-gray-500">
            <span>You: {result.moves[isAI ? 'player' : socket?.id || '']}</span>
            <span>Opponent: {result.moves[isAI ? 'ai' : Object.keys(result.moves).find(id => id !== socket?.id) || '']}</span>
          </div>
        </div>
      ) : (
        <div className="text-xl font-bold text-gray-700">
          {move ? (opponentMoved ? "Opponent moved!" : "Waiting for opponent...") : "Make your move!"}
        </div>
      )}

      <div className="flex gap-4">
        {[
          { id: 'rock', icon: Circle, color: 'bg-blue-500' },
          { id: 'paper', icon: Hand, color: 'bg-green-500' },
          { id: 'scissors', icon: Scissors, color: 'bg-red-500' }
        ].map((choice) => (
          <button
            key={choice.id}
            disabled={!!move}
            onClick={() => makeMove(choice.id)}
            className={cn(
              "w-20 h-20 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all shadow-lg",
              move === choice.id ? choice.color + " text-white scale-110" : "bg-white text-gray-600 hover:scale-105 active:scale-95",
              move && move !== choice.id && "opacity-50"
            )}
          >
            <choice.icon className="w-8 h-8" />
            <span className="text-[10px] font-bold uppercase">{choice.id}</span>
          </button>
        ))}
      </div>

      {result && (
        <button onClick={reset} className="flex items-center gap-2 px-8 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-900 transition-colors font-bold">
          <RefreshCw className="w-5 h-5" />
          Play Again
        </button>
      )}

      {!isAI && (
        <div className="flex items-center gap-2 text-[10px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          Room: <span className="font-mono font-bold">{roomId}</span>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(roomId);
              alert('Room ID copied!');
            }}
            className="hover:text-gray-600"
            title="Copy Room ID"
          >
            <Share2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};

// --- Shared Note Page ---

const NoteViewer = () => {
  const { id } = useParams();
  const [noteInfo, setNoteInfo] = useState<{ hasPassword?: boolean, createdAt?: string } | null>(null);
  const [content, setContent] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await fetch(`/api/notes/${id}`);
        if (!res.ok) throw new Error('Note not found');
        const data = await res.json();
        setNoteInfo(data);
        if (!data.hasPassword) {
          handleUnlock('');
        }
      } catch (err) {
        setError('Note not found');
      }
    };
    fetchInfo();
  }, [id]);

  const handleUnlock = async (pass: string) => {
    try {
      const res = await fetch(`/api/notes/${id}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass })
      });
      if (!res.ok) throw new Error('Incorrect password');
      const data = await res.json();
      setContent(data.content);
      setIsUnlocked(true);
      setError('');
    } catch (err) {
      setError('Incorrect password');
    }
  };

  if (error && !noteInfo) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
        <X className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Note Not Found</h1>
        <p className="text-gray-500">The link you followed may be broken or the note was deleted.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/20 max-w-2xl w-full"
      >
        {!isUnlocked ? (
          <div className="text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="w-10 h-10 text-blue-500" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Protected Note</h1>
            <p className="text-gray-500 mb-8">This note is encrypted. Enter the password to view it.</p>
            
            <div className="flex flex-col gap-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-center text-lg"
                onKeyDown={(e) => e.key === 'Enter' && handleUnlock(password)}
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                onClick={() => handleUnlock(password)}
                className="w-full bg-blue-500 text-white p-4 rounded-xl font-bold text-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <Unlock className="w-5 h-5" />
                Unlock Note
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-blue-500" />
                <h1 className="text-xl font-bold text-gray-800">Shared Note</h1>
              </div>
              <span className="text-xs text-gray-400">
                Created: {new Date(noteInfo?.createdAt || '').toLocaleDateString()}
              </span>
            </div>
            <div className="prose prose-blue max-w-none">
              <p className="whitespace-pre-wrap text-gray-700 leading-relaxed text-lg">
                {content}
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

// --- Desktop Environment ---

const Desktop = () => {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [nextZIndex, setNextZIndex] = useState(1);
  const [background, setBackground] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.background) setBackground(data.background);
      });
  }, []);

  const openApp = (type: AppType, title: string) => {
    const existing = windows.find(w => w.type === type);
    if (existing) {
      if (existing.isMinimized) {
        setWindows(prev => prev.map(w => w.type === type ? { ...w, isMinimized: false, zIndex: nextZIndex } : w));
      } else {
        setWindows(prev => prev.map(w => w.type === type ? { ...w, zIndex: nextZIndex } : w));
      }
      setNextZIndex(prev => prev + 1);
      return;
    }

    const newWindow: WindowState = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      title,
      isOpen: true,
      isMinimized: false,
      isLocked: false,
      zIndex: nextZIndex,
      x: 100 + (windows.length * 40),
      y: 100 + (windows.length * 40),
      width: type === 'notepad' ? 600 : type === 'drawing' ? 800 : type === 'rps' ? 500 : 400,
      height: type === 'notepad' ? 500 : type === 'drawing' ? 600 : type === 'rps' ? 600 : 500,
    };

    setWindows(prev => [...prev, newWindow]);
    setNextZIndex(prev => prev + 1);
  };

  const closeWindow = (id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
  };

  const minimizeWindow = (id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: true } : w));
  };

  const toggleLock = (id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isLocked: !w.isLocked } : w));
  };

  const focusWindow = (id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: nextZIndex } : w));
    setNextZIndex(prev => prev + 1);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const app = params.get('app');
    if (app === 'tictactoe') {
      openApp('tictactoe', 'Tic-Tac-Toe');
    } else if (app === 'rps') {
      openApp('rps', 'Rock Paper Scissors');
    }
  }, []);

  return (
    <div 
      className="h-screen w-screen overflow-hidden relative flex flex-col"
      style={{
        backgroundImage: background ? `url(${background})` : 'url("https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?auto=format&fit=crop&w=1920&q=80")',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Desktop Icons */}
      <div className="flex-1 p-6 grid grid-cols-1 grid-rows-6 gap-4 w-fit">
        <button 
          onDoubleClick={() => openApp('notepad', 'Notepad')}
          className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/10 group w-24"
        >
          <div className="w-12 h-12 bg-blue-500/80 backdrop-blur rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <span className="text-white text-xs font-medium drop-shadow-md">Notepad</span>
        </button>
        <button 
          onDoubleClick={() => openApp('drawing', 'Coloring Book')}
          className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/10 group w-24"
        >
          <div className="w-12 h-12 bg-purple-500/80 backdrop-blur rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <Palette className="w-8 h-8 text-white" />
          </div>
          <span className="text-white text-xs font-medium drop-shadow-md">Coloring</span>
        </button>
        <button 
          onDoubleClick={() => openApp('tictactoe', 'Tic-Tac-Toe')}
          className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/10 group w-24"
        >
          <div className="w-12 h-12 bg-green-500/80 backdrop-blur rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <Hash className="w-8 h-8 text-white" />
          </div>
          <span className="text-white text-xs font-medium drop-shadow-md">Tic-Tac-Toe</span>
        </button>
        <button 
          onDoubleClick={() => openApp('rps', 'Rock Paper Scissors')}
          className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/10 group w-24"
        >
          <div className="w-12 h-12 bg-red-500/80 backdrop-blur rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <Scissors className="w-8 h-8 text-white" />
          </div>
          <span className="text-white text-xs font-medium drop-shadow-md">Rock Paper Scissors</span>
        </button>

        <button 
          onDoubleClick={() => openApp('settings', 'Settings')}
          className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/10 group w-24"
        >
          <div className="w-12 h-12 bg-gray-500/80 backdrop-blur rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <Settings className="w-8 h-8 text-white" />
          </div>
          <span className="text-white text-xs font-medium drop-shadow-md">Settings</span>
        </button>
      </div>

      {/* Windows Layer */}
      <AnimatePresence>
        {windows.map(w => (
          <Window 
            key={w.id} 
            window={w} 
            onClose={() => closeWindow(w.id)}
            onMinimize={() => minimizeWindow(w.id)}
            onToggleLock={() => toggleLock(w.id)}
            onFocus={() => focusWindow(w.id)}
          >
            {w.type === 'notepad' && <Notepad />}
            {w.type === 'drawing' && <ColoringBook />}
            {w.type === 'tictactoe' && <TicTacToe />}
            {w.type === 'rps' && <RockPaperScissors />}
            {w.type === 'settings' && <SettingsApp onBackgroundChange={setBackground} />}
          </Window>
        ))}
      </AnimatePresence>

      {/* Taskbar */}
      <div className="h-16 bg-black/30 backdrop-blur-2xl border-t border-white/10 flex items-center justify-center px-4 gap-2 z-[9999]">
        <TaskbarIcon icon={FileText} label="Notepad" onClick={() => openApp('notepad', 'Notepad')} isActive={windows.some(w => w.type === 'notepad')} />
        <TaskbarIcon icon={Palette} label="Coloring" onClick={() => openApp('drawing', 'Coloring Book')} isActive={windows.some(w => w.type === 'drawing')} />
        <TaskbarIcon icon={Hash} label="Tic-Tac-Toe" onClick={() => openApp('tictactoe', 'Tic-Tac-Toe')} isActive={windows.some(w => w.type === 'tictactoe')} />
        <TaskbarIcon icon={Scissors} label="Rock Paper Scissors" onClick={() => openApp('rps', 'Rock Paper Scissors')} isActive={windows.some(w => w.type === 'rps')} />
        <TaskbarIcon icon={Settings} label="Settings" onClick={() => openApp('settings', 'Settings')} isActive={windows.some(w => w.type === 'settings')} />
        <div className="w-px h-8 bg-white/10 mx-2" />
        <div className="flex-1" />
        <div className="flex items-center gap-4 text-white/80 text-sm font-medium pr-4">
          <div className="flex flex-col items-end">
            <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="text-[10px] opacity-60">{new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Desktop />} />
        <Route path="/note/:id" element={<NoteViewer />} />
      </Routes>
    </Router>
  );
}
