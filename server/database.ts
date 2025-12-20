/**
 * 数据库抽象层
 * 支持内存存储（开发）和 PostgreSQL（生产）
 */

export interface User {
  id: string;
  openId?: string;
  unionId?: string;
  nickname: string;
  avatar?: string;
  coins: number;
  diamonds: number;
  level: number;
  exp: number;
  totalGames: number;
  wins: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface GameRecord {
  id: string;
  roomId: string;
  players: Array<{ id: string; name: string; score: number }>;
  winnerId: string;
  multiplier: number;
  gameData?: any;
  createdAt: Date;
}

export interface Friendship {
  userId: string;
  friendId: string;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: Date;
}

// 数据库接口
export interface Database {
  // 用户操作
  findUserById(id: string): Promise<User | null>;
  findUserByOpenId(openId: string): Promise<User | null>;
  createUser(user: User): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | null>;
  
  // 游戏记录
  createGameRecord(record: GameRecord): Promise<GameRecord>;
  getGameRecords(userId: string, limit?: number): Promise<GameRecord[]>;
  
  // 好友
  addFriend(userId: string, friendId: string): Promise<void>;
  getFriends(userId: string): Promise<User[]>;
  updateFriendship(userId: string, friendId: string, status: Friendship['status']): Promise<void>;
  
  // 排行榜
  getLeaderboard(type: 'coins' | 'wins' | 'level', limit?: number): Promise<User[]>;
}

// 内存数据库实现（开发用）
export class MemoryDatabase implements Database {
  private users: Map<string, User> = new Map();
  private usersByOpenId: Map<string, string> = new Map();
  private gameRecords: GameRecord[] = [];
  private friendships: Friendship[] = [];

  async findUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findUserByOpenId(openId: string): Promise<User | null> {
    const userId = this.usersByOpenId.get(openId);
    return userId ? this.users.get(userId) || null : null;
  }

  async createUser(user: User): Promise<User> {
    this.users.set(user.id, user);
    if (user.openId) {
      this.usersByOpenId.set(user.openId, user.id);
    }
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;
    
    const updated = { ...user, ...data, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  async createGameRecord(record: GameRecord): Promise<GameRecord> {
    this.gameRecords.push(record);
    
    // 更新玩家统计
    for (const player of record.players) {
      const user = this.users.get(player.id);
      if (user) {
        user.totalGames++;
        user.coins += player.score;
        if (player.id === record.winnerId) {
          user.wins++;
        }
        // 经验值
        user.exp += Math.abs(player.score) / 10;
        // 升级检查
        const expNeeded = user.level * 1000;
        if (user.exp >= expNeeded) {
          user.level++;
          user.exp -= expNeeded;
        }
      }
    }
    
    return record;
  }

  async getGameRecords(userId: string, limit = 20): Promise<GameRecord[]> {
    return this.gameRecords
      .filter(r => r.players.some(p => p.id === userId))
      .slice(-limit)
      .reverse();
  }

  async addFriend(userId: string, friendId: string): Promise<void> {
    const existing = this.friendships.find(
      f => f.userId === userId && f.friendId === friendId
    );
    if (!existing) {
      this.friendships.push({
        userId,
        friendId,
        status: 'pending',
        createdAt: new Date()
      });
    }
  }

  async getFriends(userId: string): Promise<User[]> {
    const friendIds = this.friendships
      .filter(f => 
        (f.userId === userId || f.friendId === userId) && 
        f.status === 'accepted'
      )
      .map(f => f.userId === userId ? f.friendId : f.userId);
    
    return friendIds
      .map(id => this.users.get(id))
      .filter((u): u is User => u !== undefined);
  }

  async updateFriendship(userId: string, friendId: string, status: Friendship['status']): Promise<void> {
    const friendship = this.friendships.find(
      f => (f.userId === userId && f.friendId === friendId) ||
           (f.userId === friendId && f.friendId === userId)
    );
    if (friendship) {
      friendship.status = status;
    }
  }

  async getLeaderboard(type: 'coins' | 'wins' | 'level', limit = 100): Promise<User[]> {
    const users = Array.from(this.users.values());
    
    switch (type) {
      case 'coins':
        users.sort((a, b) => b.coins - a.coins);
        break;
      case 'wins':
        users.sort((a, b) => b.wins - a.wins);
        break;
      case 'level':
        users.sort((a, b) => b.level - a.level || b.exp - a.exp);
        break;
    }
    
    return users.slice(0, limit);
  }
}

// PostgreSQL 实现（生产用）
// 需要安装 pg 包: npm install pg @types/pg
export class PostgresDatabase implements Database {
  private pool: any;

  constructor(connectionString: string) {
    // 延迟加载 pg 模块
    const { Pool } = require('pg');
    this.pool = new Pool({ connectionString });
  }

  async findUserById(id: string): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.mapUser(result.rows[0]) : null;
  }

  async findUserByOpenId(openId: string): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE open_id = $1',
      [openId]
    );
    return result.rows[0] ? this.mapUser(result.rows[0]) : null;
  }

  async createUser(user: User): Promise<User> {
    const result = await this.pool.query(
      `INSERT INTO users (id, open_id, union_id, nickname, avatar_url, coins, diamonds, level, exp, total_games, wins, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [user.id, user.openId, user.unionId, user.nickname, user.avatar, 
       user.coins, user.diamonds, user.level, user.exp, user.totalGames, user.wins, user.createdAt]
    );
    return this.mapUser(result.rows[0]);
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (data.nickname !== undefined) { fields.push(`nickname = $${i++}`); values.push(data.nickname); }
    if (data.avatar !== undefined) { fields.push(`avatar_url = $${i++}`); values.push(data.avatar); }
    if (data.coins !== undefined) { fields.push(`coins = $${i++}`); values.push(data.coins); }
    if (data.diamonds !== undefined) { fields.push(`diamonds = $${i++}`); values.push(data.diamonds); }
    if (data.level !== undefined) { fields.push(`level = $${i++}`); values.push(data.level); }
    if (data.exp !== undefined) { fields.push(`exp = $${i++}`); values.push(data.exp); }
    if (data.totalGames !== undefined) { fields.push(`total_games = $${i++}`); values.push(data.totalGames); }
    if (data.wins !== undefined) { fields.push(`wins = $${i++}`); values.push(data.wins); }

    if (fields.length === 0) return this.findUserById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0] ? this.mapUser(result.rows[0]) : null;
  }

  async createGameRecord(record: GameRecord): Promise<GameRecord> {
    await this.pool.query(
      `INSERT INTO game_records (id, room_id, players, winner_id, multiplier, game_data, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [record.id, record.roomId, JSON.stringify(record.players), record.winnerId, 
       record.multiplier, record.gameData ? JSON.stringify(record.gameData) : null, record.createdAt]
    );

    // 更新玩家统计
    for (const player of record.players) {
      await this.pool.query(
        `UPDATE users SET 
          total_games = total_games + 1,
          coins = coins + $1,
          wins = wins + $2,
          exp = exp + $3,
          updated_at = NOW()
        WHERE id = $4`,
        [player.score, player.id === record.winnerId ? 1 : 0, Math.abs(player.score) / 10, player.id]
      );
    }

    return record;
  }

  async getGameRecords(userId: string, limit = 20): Promise<GameRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM game_records 
       WHERE players @> $1::jsonb
       ORDER BY created_at DESC
       LIMIT $2`,
      [JSON.stringify([{ id: userId }]), limit]
    );
    return result.rows.map(this.mapGameRecord);
  }

  async addFriend(userId: string, friendId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO friendships (user_id, friend_id, status, created_at)
       VALUES ($1, $2, 'pending', NOW())
       ON CONFLICT (user_id, friend_id) DO NOTHING`,
      [userId, friendId]
    );
  }

  async getFriends(userId: string): Promise<User[]> {
    const result = await this.pool.query(
      `SELECT u.* FROM users u
       JOIN friendships f ON (f.friend_id = u.id OR f.user_id = u.id)
       WHERE (f.user_id = $1 OR f.friend_id = $1) 
         AND f.status = 'accepted'
         AND u.id != $1`,
      [userId]
    );
    return result.rows.map(this.mapUser);
  }

  async updateFriendship(userId: string, friendId: string, status: Friendship['status']): Promise<void> {
    await this.pool.query(
      `UPDATE friendships SET status = $1 
       WHERE (user_id = $2 AND friend_id = $3) OR (user_id = $3 AND friend_id = $2)`,
      [status, userId, friendId]
    );
  }

  async getLeaderboard(type: 'coins' | 'wins' | 'level', limit = 100): Promise<User[]> {
    const orderBy = type === 'level' ? 'level DESC, exp DESC' : `${type} DESC`;
    const result = await this.pool.query(
      `SELECT * FROM users ORDER BY ${orderBy} LIMIT $1`,
      [limit]
    );
    return result.rows.map(this.mapUser);
  }

  private mapUser(row: any): User {
    return {
      id: row.id,
      openId: row.open_id,
      unionId: row.union_id,
      nickname: row.nickname,
      avatar: row.avatar_url,
      coins: row.coins,
      diamonds: row.diamonds,
      level: row.level,
      exp: row.exp,
      totalGames: row.total_games,
      wins: row.wins,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapGameRecord(row: any): GameRecord {
    return {
      id: row.id,
      roomId: row.room_id,
      players: row.players,
      winnerId: row.winner_id,
      multiplier: row.multiplier,
      gameData: row.game_data,
      createdAt: row.created_at
    };
  }
}

// 创建数据库实例
export function createDatabase(): Database {
  const dbUrl = process.env.DATABASE_URL;
  
  if (dbUrl) {
    console.log('Using PostgreSQL database');
    return new PostgresDatabase(dbUrl);
  }
  
  console.log('Using in-memory database (development mode)');
  return new MemoryDatabase();
}
