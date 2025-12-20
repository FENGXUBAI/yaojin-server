/**
 * 用户认证模块
 * 支持微信登录、游客登录、Token验证
 */
import crypto from 'crypto';

// JWT 简单实现（生产环境建议使用 jsonwebtoken 库）
const JWT_SECRET = process.env.JWT_SECRET || 'yaojin_secret_key_change_in_production';

interface JWTPayload {
  userId: string;
  openId?: string;
  nickname: string;
  avatar?: string;
  iat: number;
  exp: number;
}

export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + 7 * 24 * 60 * 60 // 7天过期
  };
  
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [header, body, signature] = parts;
    
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    
    if (signature !== expectedSig) return null;
    
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as JWTPayload;
    
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Token过期
    }
    
    return payload;
  } catch {
    return null;
  }
}

// 生成唯一用户ID
export function generateUserId(): string {
  return `u_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

// 游客登录
export function guestLogin(nickname?: string): { token: string; userInfo: any } {
  const userId = generateUserId();
  const userInfo = {
    userId,
    nickname: nickname || `游客${Math.floor(Math.random() * 10000)}`,
    avatar: '',
    coins: 10000,
    diamonds: 0,
    level: 1,
    isGuest: true
  };
  
  const token = generateToken({
    userId,
    nickname: userInfo.nickname
  });
  
  return { token, userInfo };
}

// 微信登录 (需要配合服务器端调用微信API)
export async function wxLogin(code: string, db: any): Promise<{ token: string; userInfo: any }> {
  // 调用微信接口获取 openid 和 session_key
  // 这里需要配置 AppID 和 AppSecret
  const APPID = process.env.WX_APPID || '';
  const SECRET = process.env.WX_SECRET || '';
  
  if (!APPID || !SECRET) {
    throw new Error('微信配置未设置');
  }
  
  const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}&secret=${SECRET}&js_code=${code}&grant_type=authorization_code`;
  
  // 使用 fetch 或其他HTTP客户端请求
  const response = await fetch(wxUrl);
  const wxData = await response.json();
  
  if (wxData.errcode) {
    throw new Error(`微信登录失败: ${wxData.errmsg}`);
  }
  
  const { openid, unionid } = wxData;
  
  // 查找或创建用户
  let user = await db.findUserByOpenId(openid);
  
  if (!user) {
    // 新用户
    user = {
      id: generateUserId(),
      openId: openid,
      unionId: unionid,
      nickname: `玩家${Math.floor(Math.random() * 10000)}`,
      avatar: '',
      coins: 10000,
      diamonds: 0,
      level: 1,
      exp: 0,
      totalGames: 0,
      wins: 0,
      createdAt: new Date()
    };
    await db.createUser(user);
  }
  
  const token = generateToken({
    userId: user.id,
    openId: openid,
    nickname: user.nickname,
    avatar: user.avatar
  });
  
  return {
    token,
    userInfo: {
      userId: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      coins: user.coins,
      diamonds: user.diamonds,
      level: user.level
    }
  };
}

// Socket.IO 认证中间件
export function socketAuthMiddleware(socket: any, next: Function) {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  
  if (!token) {
    // 允许无token连接（游客模式）
    socket.data.user = null;
    return next();
  }
  
  const payload = verifyToken(token);
  if (!payload) {
    return next(new Error('无效的认证Token'));
  }
  
  socket.data.user = payload;
  next();
}
