const WebSocket = require('ws');
const http = require('http');

// HTTP Server for Health Checks
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Sentinel Server Active');
});

const wss = new WebSocket.Server({ server });
let agents = {};

wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => ws.isAlive = true);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // 1. AGENT REPORT
            if (data.type === 'AGENT_REPORT') {
                agents[data.agentId] = {
                    status: 'ONLINE',
                    ...data.payload,
                    lastSeen: Date.now()
                };
            }

            // 2. AGENT PAUSED
            if (data.type === 'AGENT_PAUSED') {
                if (agents[data.agentId]) {
                    agents[data.agentId].status = 'PAUSED';
                    agents[data.agentId].lastSeen = Date.now();
                }
            }

            // 3. DASHBOARD REQUEST
            if (data.type === 'DASHBOARD_REQ') {
                // Remove agents offline for > 60 seconds
                const now = Date.now();
                Object.keys(agents).forEach(k => {
                    if (now - agents[k].lastSeen > 60000) delete agents[k];
                });
                
                ws.send(JSON.stringify({ type: 'DASHBOARD_DATA', data: agents }));
            }
        } catch (e) { console.error(e); }
    });
});

// Cleanup dead connections
setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Listening on ${PORT}`));
