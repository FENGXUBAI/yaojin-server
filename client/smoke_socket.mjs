import { io } from 'socket.io-client';

const baseUrl = process.env.YAOJIN_BASE_URL || 'http://localhost:3000';

async function postJson(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`${path} ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  const nickname = `smoke_${Math.floor(Math.random() * 1000)}`;
  console.log('[smoke] baseUrl =', baseUrl);

  const login = await postJson('/api/auth/guest', { nickname });
  console.log('[smoke] guest login ok:', login?.user?.nickname, login?.user?.id);

  const match = await postJson('/api/match/quick', { playerCount: 3, playerName: nickname });
  console.log('[smoke] quick match ok:', match.roomId, 'clientKey?', !!match.clientKey);

  const socket = io(baseUrl, {
    transports: ['websocket'],
    timeout: 20000,
    reconnection: false,
  });

  const timer = setTimeout(() => {
    console.error('[smoke] TIMEOUT waiting for roomState/joinAck');
    socket.close();
    process.exit(2);
  }, 10000);

  socket.on('connect', () => {
    console.log('[smoke] socket connected:', socket.id);
    socket.emit('join', { room: match.roomId, name: nickname, clientKey: match.clientKey });
  });

  socket.on('joinAck', (payload) => {
    console.log('[smoke] joinAck:', payload);
  });

  socket.on('roomState', (payload) => {
    console.log('[smoke] roomState players=', payload?.players?.length, 'owner=', payload?.owner);
    clearTimeout(timer);
    setTimeout(() => {
      socket.close();
      console.log('[smoke] done');
      process.exit(0);
    }, 500);
  });

  socket.on('disconnect', (reason) => {
    console.log('[smoke] socket disconnected reason=', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[smoke] connect_error:', err?.message || err);
  });
}

main().catch((e) => {
  console.error('[smoke] FAIL:', e);
  process.exit(1);
});
