/**
 * 匹配系统
 * 支持快速匹配、好友邀请、段位匹配
 */

interface QueuedPlayer {
  socketId: string;
  userId: string;
  nickname: string;
  level: number;
  queuedAt: number;
  preferredPlayers: number; // 偏好人数 3 or 4
}

interface MatchResult {
  players: QueuedPlayer[];
  roomId: string;
}

export class MatchMaker {
  private queue: QueuedPlayer[] = [];
  private matchCallbacks: Map<string, (result: MatchResult) => void> = new Map();
  private matchInterval: NodeJS.Timer | null = null;

  constructor() {
    // 每秒检查一次匹配
    this.matchInterval = setInterval(() => this.processQueue(), 1000);
  }

  // 加入匹配队列
  joinQueue(player: QueuedPlayer, callback: (result: MatchResult) => void): void {
    // 检查是否已在队列中
    const existing = this.queue.findIndex(p => p.socketId === player.socketId);
    if (existing !== -1) {
      this.queue.splice(existing, 1);
    }

    this.queue.push(player);
    this.matchCallbacks.set(player.socketId, callback);
    
    console.log(`Player ${player.nickname} joined queue. Queue size: ${this.queue.length}`);
  }

  // 离开匹配队列
  leaveQueue(socketId: string): void {
    const index = this.queue.findIndex(p => p.socketId === socketId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.matchCallbacks.delete(socketId);
      console.log(`Player left queue. Queue size: ${this.queue.length}`);
    }
  }

  // 处理匹配队列
  private processQueue(): void {
    if (this.queue.length < 3) return;

    const now = Date.now();
    
    // 按等待时间和段位分组匹配
    // 优先匹配等待时间长的玩家
    const sortedQueue = [...this.queue].sort((a, b) => a.queuedAt - b.queuedAt);

    // 尝试匹配4人局
    const match4 = this.tryMatch(sortedQueue, 4, now);
    if (match4) {
      this.executeMatch(match4);
      return;
    }

    // 等待超过15秒后尝试3人局
    const longWaiting = sortedQueue.filter(p => now - p.queuedAt > 15000);
    if (longWaiting.length >= 3) {
      const match3 = this.tryMatch(longWaiting, 3, now);
      if (match3) {
        this.executeMatch(match3);
        return;
      }
    }
  }

  // 尝试匹配指定人数
  private tryMatch(candidates: QueuedPlayer[], count: number, now: number): QueuedPlayer[] | null {
    if (candidates.length < count) return null;

    // 简单匹配：取前count个玩家
    // 生产环境可以加入段位匹配逻辑
    const matched = candidates.slice(0, count);

    // 检查段位差距（可选）
    const levels = matched.map(p => p.level);
    const maxDiff = Math.max(...levels) - Math.min(...levels);
    
    // 等待时间长的玩家放宽段位限制
    const avgWaitTime = matched.reduce((sum, p) => sum + (now - p.queuedAt), 0) / matched.length;
    const allowedDiff = Math.min(10, 3 + Math.floor(avgWaitTime / 5000));

    if (maxDiff <= allowedDiff) {
      return matched;
    }

    return null;
  }

  // 执行匹配
  private executeMatch(players: QueuedPlayer[]): void {
    const roomId = this.generateRoomId();
    
    const result: MatchResult = {
      players,
      roomId
    };

    console.log(`Match found! Room: ${roomId}, Players: ${players.map(p => p.nickname).join(', ')}`);

    // 从队列中移除匹配的玩家
    for (const player of players) {
      const index = this.queue.findIndex(p => p.socketId === player.socketId);
      if (index !== -1) {
        this.queue.splice(index, 1);
      }

      // 通知玩家
      const callback = this.matchCallbacks.get(player.socketId);
      if (callback) {
        callback(result);
        this.matchCallbacks.delete(player.socketId);
      }
    }
  }

  // 生成房间ID
  private generateRoomId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // 获取队列状态
  getQueueStatus(): { total: number; waiting: QueuedPlayer[] } {
    return {
      total: this.queue.length,
      waiting: this.queue.map(p => ({
        ...p,
        waitTime: Math.floor((Date.now() - p.queuedAt) / 1000)
      }))
    };
  }

  // 清理
  destroy(): void {
    if (this.matchInterval) {
      clearInterval(this.matchInterval);
      this.matchInterval = null;
    }
    this.queue = [];
    this.matchCallbacks.clear();
  }
}

// 单例
let matchMaker: MatchMaker | null = null;

export function getMatchMaker(): MatchMaker {
  if (!matchMaker) {
    matchMaker = new MatchMaker();
  }
  return matchMaker;
}
