const WebSocket = require('ws');
const http = require('http');

// Create a basic HTTP server (Required for health checks by cloud providers)
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Sentinel Server Active');
});

// Attach WebSocket Server
const wss = new WebSocket.Server({ server });

// In-memory store (Use Redis for persistence if scaling >1000 agents)
let agents = {};

function heartbeat() {
    this.isAlive = true;
}

wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', heartbeat);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // HANDLE AGENT HEARTBEAT
            if (data.type === 'AGENT_REPORT') {
                agents[data.agentId] = {
                    ...data.payload,
                    lastSeen: Date.now()
                };
            }

            // HANDLE DASHBOARD REQUEST
            if (data.type === 'DASHBOARD_REQ') {
                // Prune agents not seen in 60 seconds
                const now = Date.now();
                Object.keys(agents).forEach(key => {
                    if (now - agents[key].lastSeen > 60000) {
                        delete agents[key];
                    }
                });
                
                ws.send(JSON.stringify({
                    type: 'DASHBOARD_DATA',
                    data: agents
                }));
            }

        } catch (e) {
            console.error("Parse Error:", e);
        }
    });
});

// Interval to check for broken connections
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => clearInterval(interval));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
