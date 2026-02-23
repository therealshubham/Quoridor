const ws = new WebSocket(`ws://${location.host}`);
let playerId = null;
let gameState = null;
let wallMode = false;
let wallOrientation = 'h';
let pathToHighlight = null;

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log('Received message:', msg);
  
  if (msg.type === 'init') {
    playerId = msg.playerId;
    gameState = msg.state;
    render();
  } else if (msg.type === 'start' || msg.type === 'update') {
    gameState = msg.state;
    pathToHighlight = null;
    render();
  } else if (msg.type === 'error') {
    showError(msg.message);
  } else if (msg.type === 'show-path') {
    console.log('Showing path for player:', msg.playerId);
    pathToHighlight = findPath(gameState.board, msg.playerId);
    console.log('Path to highlight:', pathToHighlight);
    render();
    setTimeout(() => {
      pathToHighlight = null;
      render();
    }, 2000);
  }
};

function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 2000);
}

function findPath(board, playerId) {
  const start = board.pawns[playerId];
  const goalY = playerId === 0 ? 8 : 0;
  const visited = new Map();
  const queue = [[start, [start]]];
  
  while (queue.length > 0) {
    const [pos, path] = queue.shift();
    const key = `${pos.x},${pos.y}`;
    if (visited.has(key)) continue;
    visited.set(key, true);
    if (pos.y === goalY) return path;
    
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = pos.x + dx, ny = pos.y + dy;
      if (nx < 0 || nx > 8 || ny < 0 || ny > 8) continue;
      if (isWallBlocking(board.walls, pos.x, pos.y, nx, ny)) continue;
      queue.push([{ x: nx, y: ny }, [...path, { x: nx, y: ny }]]);
    }
  }
  return [];
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

function render() {
  document.getElementById('walls0').textContent = gameState.wallsLeft[0];
  document.getElementById('walls1').textContent = gameState.wallsLeft[1];
  
  document.getElementById('player0-info').classList.toggle('active', gameState.currentPlayer === 0);
  document.getElementById('player1-info').classList.toggle('active', gameState.currentPlayer === 1);
  
  if (gameState.winner !== null) {
    document.getElementById('turn-indicator').textContent = 'Game Over!';
    document.getElementById('winner-message').textContent = `🎉 Player ${gameState.winner + 1} Wins! 🎉`;
  } else if (gameState.players.length < 2) {
    document.getElementById('turn-indicator').textContent = 'Waiting for players...';
  } else {
    const current = gameState.currentPlayer === playerId ? 'Your' : `Player ${gameState.currentPlayer + 1}'s`;
    document.getElementById('turn-indicator').textContent = `${current} Turn`;
  }
  
  renderBoard();
}

function renderBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  
  for (let row = 0; row < 17; row++) {
    for (let col = 0; col < 17; col++) {
      const isEvenRow = row % 2 === 0;
      const isEvenCol = col % 2 === 0;
      
      if (isEvenRow && isEvenCol) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        const x = col / 2, y = row / 2;
        
        if (pathToHighlight && pathToHighlight.some(p => p.x === x && p.y === y)) {
          cell.classList.add('path-highlight');
        }
        
        if (gameState.board.pawns[0].x === x && gameState.board.pawns[0].y === y) {
          cell.classList.add('pawn0');
          cell.textContent = '🔵';
        } else if (gameState.board.pawns[1].x === x && gameState.board.pawns[1].y === y) {
          cell.classList.add('pawn1');
          cell.textContent = '🔴';
        }
        
        cell.onclick = () => {
          if (!wallMode && playerId === gameState.currentPlayer && !gameState.winner) {
            ws.send(JSON.stringify({ type: 'move', x, y }));
          }
        };
        board.appendChild(cell);
      } else if (isEvenRow && !isEvenCol) {
        const slot = document.createElement('div');
        slot.className = 'wall-slot v';
        const x = Math.ceil(col / 2), y = row / 2;
        
        const hasWall = gameState.board.walls.some(w => w.x === x && w.y === y && w.orientation === 'v');
        const hasWallAbove = gameState.board.walls.some(w => w.x === x && w.y === y - 1 && w.orientation === 'v');
        
        if (hasWall || hasWallAbove) {
          slot.classList.add('wall');
          if (hasWallAbove) slot.classList.add('wall-end');
        }
        
        slot.onmouseenter = () => {
          if (wallMode && wallOrientation === 'v' && playerId === gameState.currentPlayer && !gameState.winner && !hasWall && !hasWallAbove) {
            showWallPreview(x, y, 'v');
          }
        };
        
        slot.onmouseleave = () => {
          clearWallPreview();
        };
        
        slot.onclick = () => {
          if (wallMode && wallOrientation === 'v' && playerId === gameState.currentPlayer && !gameState.winner) {
            ws.send(JSON.stringify({ type: 'wall', x, y, orientation: 'v' }));
            clearWallPreview();
          }
        };
        board.appendChild(slot);
      } else if (!isEvenRow && isEvenCol) {
        const slot = document.createElement('div');
        slot.className = 'wall-slot h';
        const x = col / 2, y = Math.ceil(row / 2);
        
        const hasWall = gameState.board.walls.some(w => w.x === x && w.y === y && w.orientation === 'h');
        const hasWallLeft = gameState.board.walls.some(w => w.x === x - 1 && w.y === y && w.orientation === 'h');
        
        if (hasWall || hasWallLeft) {
          slot.classList.add('wall');
          if (hasWallLeft) slot.classList.add('wall-end');
        }
        
        slot.onmouseenter = () => {
          if (wallMode && wallOrientation === 'h' && playerId === gameState.currentPlayer && !gameState.winner && !hasWall && !hasWallLeft) {
            showWallPreview(x, y, 'h');
          }
        };
        
        slot.onmouseleave = () => {
          clearWallPreview();
        };
        
        slot.onclick = () => {
          if (wallMode && wallOrientation === 'h' && playerId === gameState.currentPlayer && !gameState.winner) {
            ws.send(JSON.stringify({ type: 'wall', x, y, orientation: 'h' }));
            clearWallPreview();
          }
        };
        board.appendChild(slot);
      } else {
        const intersection = document.createElement('div');
        intersection.className = 'intersection';
        
        const intX = Math.ceil(col / 2), intY = Math.ceil(row / 2);
        const hasHWall = gameState.board.walls.some(w => w.orientation === 'h' && w.x === intX - 1 && w.y === intY);
        const hasVWall = gameState.board.walls.some(w => w.orientation === 'v' && w.x === intX && w.y === intY - 1);
        
        if (hasHWall || hasVWall) {
          intersection.classList.add('wall-connector');
        }
        
        board.appendChild(intersection);
      }
    }
  }
}

document.getElementById('wall-mode-btn').onclick = () => {
  wallMode = !wallMode;
  const btn = document.getElementById('wall-mode-btn');
  const orientBtn = document.getElementById('orientation-btn');
  btn.textContent = `Place Wall Mode: ${wallMode ? 'ON' : 'OFF'}`;
  btn.classList.toggle('active', wallMode);
  orientBtn.disabled = !wallMode;
};

document.getElementById('orientation-btn').onclick = () => {
  wallOrientation = wallOrientation === 'h' ? 'v' : 'h';
  document.getElementById('orientation-btn').textContent = `Orientation: ${wallOrientation === 'h' ? 'Horizontal' : 'Vertical'}`;
  clearWallPreview();
};

function showWallPreview(x, y, orientation) {
  clearWallPreview();
  const slots = document.querySelectorAll('.wall-slot, .intersection');
  
  slots.forEach(slot => {
    const rect = slot.getBoundingClientRect();
    const boardRect = document.getElementById('board').getBoundingClientRect();
    const col = Math.round((rect.left - boardRect.left - 10) / 30);
    const row = Math.round((rect.top - boardRect.top - 10) / 30);
    
    if (orientation === 'h' && row % 2 === 1 && col % 2 === 0) {
      const slotX = col / 2, slotY = Math.ceil(row / 2);
      if ((slotX === x && slotY === y) || (slotX === x + 1 && slotY === y)) {
        slot.classList.add('preview');
      }
    } else if (orientation === 'v' && row % 2 === 0 && col % 2 === 1) {
      const slotX = Math.ceil(col / 2), slotY = row / 2;
      if ((slotX === x && slotY === y) || (slotX === x && slotY === y + 1)) {
        slot.classList.add('preview');
      }
    } else if (row % 2 === 1 && col % 2 === 1) {
      const intX = Math.ceil(col / 2), intY = Math.ceil(row / 2);
      if (orientation === 'h' && intX === x + 1 && intY === y) {
        slot.classList.add('preview-connector');
      } else if (orientation === 'v' && intX === x && intY === y + 1) {
        slot.classList.add('preview-connector');
      }
    }
  });
}

function clearWallPreview() {
  document.querySelectorAll('.preview').forEach(slot => slot.classList.remove('preview'));
  document.querySelectorAll('.preview-connector').forEach(slot => slot.classList.remove('preview-connector'));
}
