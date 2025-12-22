-- 要进斗地主数据库初始化脚本
-- PostgreSQL 版本

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  open_id VARCHAR(128) UNIQUE,        -- 微信OpenID
  union_id VARCHAR(128),              -- 微信UnionID
  nickname VARCHAR(64) NOT NULL,
  avatar_url TEXT,
  coins INT DEFAULT 10000,            -- 游戏币
  diamonds INT DEFAULT 0,             -- 钻石
  level INT DEFAULT 1,                -- 等级
  exp INT DEFAULT 0,                  -- 经验值
  total_games INT DEFAULT 0,          -- 总局数
  wins INT DEFAULT 0,                 -- 胜局数
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_open_id ON users(open_id);
CREATE INDEX IF NOT EXISTS idx_users_coins ON users(coins DESC);
CREATE INDEX IF NOT EXISTS idx_users_wins ON users(wins DESC);
CREATE INDEX IF NOT EXISTS idx_users_level ON users(level DESC, exp DESC);

-- 游戏记录表
CREATE TABLE IF NOT EXISTS game_records (
  id VARCHAR(64) PRIMARY KEY,
  room_id VARCHAR(64),
  players JSONB NOT NULL,             -- 玩家信息数组
  winner_id VARCHAR(64) REFERENCES users(id),
  multiplier INT DEFAULT 1,
  scores JSONB,                       -- 各玩家得分
  game_data JSONB,                    -- 完整对局数据(可选)
  created_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_game_records_winner ON game_records(winner_id);
CREATE INDEX IF NOT EXISTS idx_game_records_created ON game_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_records_players ON game_records USING GIN(players);

-- 好友关系表
CREATE TABLE IF NOT EXISTS friendships (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id),
  friend_id VARCHAR(64) REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, blocked
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);

-- 邮件/消息表
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id),
  type VARCHAR(20) DEFAULT 'system',  -- system, gift, friend
  title VARCHAR(128),
  content TEXT,
  rewards JSONB,                      -- 奖励内容 {coins: 100, diamonds: 10}
  is_read BOOLEAN DEFAULT FALSE,
  is_claimed BOOLEAN DEFAULT FALSE,   -- 奖励是否已领取
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(user_id) WHERE is_read = FALSE;

-- 每日任务表
CREATE TABLE IF NOT EXISTS daily_tasks (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id),
  task_type VARCHAR(32),              -- play_games, win_games, use_bomb
  target INT,                         -- 目标数量
  progress INT DEFAULT 0,             -- 当前进度
  rewards JSONB,                      -- 奖励内容
  is_completed BOOLEAN DEFAULT FALSE,
  is_claimed BOOLEAN DEFAULT FALSE,
  date DATE DEFAULT CURRENT_DATE,
  UNIQUE(user_id, task_type, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_date ON daily_tasks(user_id, date);

-- 充值记录表 (可选，支付功能)
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id),
  product_id VARCHAR(32),             -- 商品ID
  amount INT,                         -- 金额（分）
  currency VARCHAR(8) DEFAULT 'CNY',
  status VARCHAR(20) DEFAULT 'pending', -- pending, paid, failed, refunded
  platform VARCHAR(20),               -- wechat, alipay
  transaction_id VARCHAR(128),        -- 第三方交易号
  created_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_transaction ON orders(transaction_id);

-- 触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 初始数据：系统账号
INSERT INTO users (id, nickname, avatar_url, coins, diamonds, level)
VALUES ('system', '系统', '', 0, 0, 99)
ON CONFLICT (id) DO NOTHING;

-- 视图：排行榜
CREATE OR REPLACE VIEW leaderboard_coins AS
SELECT id, nickname, avatar_url, coins, level, wins, total_games,
       RANK() OVER (ORDER BY coins DESC) as rank
FROM users
WHERE id != 'system'
ORDER BY coins DESC
LIMIT 100;

CREATE OR REPLACE VIEW leaderboard_wins AS
SELECT id, nickname, avatar_url, coins, level, wins, total_games,
       RANK() OVER (ORDER BY wins DESC) as rank
FROM users
WHERE id != 'system'
ORDER BY wins DESC
LIMIT 100;

CREATE OR REPLACE VIEW leaderboard_level AS
SELECT id, nickname, avatar_url, coins, level, exp, wins, total_games,
       RANK() OVER (ORDER BY level DESC, exp DESC) as rank
FROM users
WHERE id != 'system'
ORDER BY level DESC, exp DESC
LIMIT 100;
