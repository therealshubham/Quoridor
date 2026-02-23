# Quoridor Game

A 2-player Quoridor board game with cute comic-style UI, built with Node.js and WebSocket.

## Features

- 9x9 grid board
- 2 players with 10 walls each
- Real-time multiplayer via WebSocket
- Cute comic-style interface
- Turn indicator and wall counter
- Valid move and wall placement checking
- Path validation (ensures players can always reach goal)

## How to Run Locally

```bash
npm install
npm start
```

Open two browser windows to `http://localhost:3000` to play.

## Game Rules

- **Objective**: Be the first to reach the opposite side
- **Movement**: Move 1 space orthogonally (not diagonally)
- **Jumping**: Jump over opponent to space behind them
- **Walls**: Place walls to block movement (must leave at least one path to goal)
- **Win**: First player to reach opposite side wins

## Deployment Options

### Option 1: Railway
1. Create account at railway.app
2. Click "New Project" → "Deploy from GitHub"
3. Connect your repo
4. Railway auto-detects Node.js and deploys

### Option 2: Render
1. Create account at render.com
2. Click "New Web Service"
3. Connect your repo
4. Set build command: `npm install`
5. Set start command: `npm start`

### Option 3: Heroku
```bash
heroku create your-app-name
git push heroku main
```

### Option 4: AWS (EC2)
1. Launch EC2 instance
2. SSH into instance
3. Install Node.js
4. Clone repo and run `npm install && npm start`
5. Configure security group to allow port 3000

## Environment Variables

- `PORT`: Server port (default: 3000)
