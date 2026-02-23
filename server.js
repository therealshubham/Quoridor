import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readFileSync } from 'fs';

const server = createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(readFileSync('./index.html'));
  } else if (req.url === '/style.css') {
    res.writeHead(200, { 'Content-Type': 'text/css' });
    res.end(readFileSync('./style.css'));
  } else if (req.url === '/client.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(readFileSync('./client.js'));
  }
});

const wss = new WebSocketServer({ server });
let game = null;

function createGame() {
  return {
    players: [],
    board: { pawns: { 0: { x: 4, y: 0 }, 1: { x: 4, y: 8 } }, walls: [] },
    currentPlayer: 0,
    wallsLeft: [10, 10],
    winner: null
  };
}

function canReachGoal(board, playerId) {
  const start = board.pawns[playerId];
  const goalY = playerId === 0 ? 8 : 0;
  const visited = new Set();
  const queue = [start];
  
  while (queue.length > 0) {
    const pos = queue.shift();
    const key = `${pos.x},${pos.y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (pos.y === goalY) return true;
    
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = pos.x + dx, ny = pos.y + dy;
      if (nx < 0 || nx > 8 || ny < 0 || ny > 8) continue;
      if (isWallBlocking(board.walls, pos.x, pos.y, nx, ny)) continue;
      queue.push({ x: nx, y: ny });
    }
  }
  return false;
}

function isWallBlocking(walls, x1, y1, x2, y2) {
  for (const w of walls) {
    if (w.orientation === 'h') {
      if (y1 < y2 && w.y === y2 && (w.x === x1 || w.x === x1 - 1)) return true;
      if (y1 > y2 && w.y === y1 && (w.x === x1 || w.x === x1 - 1)) return true;
    } else {
      if (x1 < x2 && w.x === x2 && (w.y === y1 || w.y === y1 - 1)) return true;
      if (x1 > x2 && w.x === x1 && (w.y === y1 || w.y === y1 - 1)) return true;
    }
  }
  return false;
}

function wallsOverlap(w1, w2) {
  if (w1.orientation !== w2.orientation) {
    if (w1.orientation === 'h' && w2.orientation === 'v') {
      return w1.x === w2.x - 1 && w1.y === w2.y + 1;
    } else {
      return w2.x === w1.x - 1 && w2.y === w1.y + 1;
    }
  }
  if (w1.orientation === 'h') {
    return w1.y === w2.y && Math.abs(w1.x - w2.x) <= 1;
  } else {
    return w1.x === w2.x && Math.abs(w1.y - w2.y) <= 1;
  }
}

function isValidMove(board, playerId, toX, toY) {
  const from = board.pawns[playerId];
  const dx = Math.abs(toX - from.x), dy = Math.abs(toY - from.y);
  
  if (toX < 0 || toX > 8 || toY < 0 || toY > 8) return false;
  
  const other = board.pawns[1 - playerId];
  if (other.x === toX && other.y === toY) return false;
  
  if (dx + dy === 1) {
    return !isWallBlocking(board.walls, from.x, from.y, toX, toY);
  }
  
  if (dx + dy === 2) {
    const midX = (from.x + toX) / 2, midY = (from.y + toY) / 2;
    if (other.x === midX && other.y === midY) {
      if (!isWallBlocking(board.walls, from.x, from.y, midX, midY)) {
        return !isWallBlocking(board.walls, midX, midY, toX, toY);
      }
    }
    if ((dx === 1 && dy === 1) && (other.x === from.x && other.y === toY || other.x === toX && other.y === from.y)) {
      const jumpX = other.x, jumpY = other.y;
      if (!isWallBlocking(board.walls, from.x, from.y, jumpX, jumpY)) {
        const behindX = jumpX + (jumpX - from.x), behindY = jumpY + (jumpY - from.y);
        if (behindX < 0 || behindX > 8 || behindY < 0 || behindY > 8 || isWallBlocking(board.walls, jumpX, jumpY, behindX, behindY)) {
          return !isWallBlocking(board.walls, jumpX, jumpY, toX, toY);
        }
      }
    }
  }
  return false;
}

function isValidWall(board, x, y, orientation) {
  if (orientation === 'h' && (x < 0 || x > 7 || y < 1 || y > 8)) return { valid: false, reason: 'Wall out of bounds' };
  if (orientation === 'v' && (x < 1 || x > 8 || y < 0 || y > 7)) return { valid: false, reason: 'Wall out of bounds' };
  
  const newWall = { x, y, orientation };
  for (const w of board.walls) {
    if (wallsOverlap(w, newWall)) return { valid: false, reason: 'Wall overlaps with existing wall' };
  }
  
  const testWalls = [...board.walls, newWall];
  const canReach0 = canReachGoal({ ...board, walls: testWalls }, 0);
  const canReach1 = canReachGoal({ ...board, walls: testWalls }, 1);
  
  if (!canReach0) return { valid: false, reason: 'Wall blocks path to goal', blockedPlayer: 0 };
  if (!canReach1) return { valid: false, reason: 'Wall blocks path to goal', blockedPlayer: 1 };
  
  return { valid: true };
}

wss.on('connection', (ws) => {
  if (!game) game = createGame();
  
  if (game.players.length >= 2) {
    ws.send(JSON.stringify({ type: 'error', message: 'Game full' }));
    ws.close();
    return;
  }
  
  const playerId = game.players.length;
  game.players.push(ws);
  ws.playerId = playerId;
  
  ws.send(JSON.stringify({ type: 'init', playerId, state: game }));
  
  if (game.players.length === 2) {
    game.players.forEach(p => p.send(JSON.stringify({ type: 'start', state: game })));
  }
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    
    if (game.winner || ws.playerId !== game.currentPlayer) return;
    
    if (msg.type === 'move') {
      if (isValidMove(game.board, ws.playerId, msg.x, msg.y)) {
        game.board.pawns[ws.playerId] = { x: msg.x, y: msg.y };
        const goalY = ws.playerId === 0 ? 8 : 0;
        if (msg.y === goalY) game.winner = ws.playerId;
        game.currentPlayer = 1 - game.currentPlayer;
        game.players.forEach(p => p.send(JSON.stringify({ type: 'update', state: game })));
      }
    } else if (msg.type === 'wall') {
      if (game.wallsLeft[ws.playerId] === 0) {
        ws.send(JSON.stringify({ type: 'error', message: 'No walls left!' }));
      } else {
        const validation = isValidWall(game.board, msg.x, msg.y, msg.orientation);
        console.log('Wall validation:', validation);
        if (validation.valid) {
          game.board.walls.push({ x: msg.x, y: msg.y, orientation: msg.orientation });
          game.wallsLeft[ws.playerId]--;
          game.currentPlayer = 1 - game.currentPlayer;
          game.players.forEach(p => p.send(JSON.stringify({ type: 'update', state: game })));
        } else {
          console.log('Sending error to player:', ws.playerId);
          ws.send(JSON.stringify({ type: 'error', message: validation.reason }));
          if (validation.blockedPlayer !== undefined) {
            console.log('Sending show-path for blocked player:', validation.blockedPlayer);
            ws.send(JSON.stringify({ type: 'show-path', playerId: validation.blockedPlayer }));
          }
        }
      }
    }
  });
  
  ws.on('close', () => {
    game = null;
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
