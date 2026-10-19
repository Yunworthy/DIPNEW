const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dip-platform-secret-key-2026',
  jwtExpiresIn: '24h',
  // 免登录开关: 生产环境部署时设置 AUTH_BYPASS=false 启用真实登录鉴权
  authBypass: process.env.AUTH_BYPASS ? process.env.AUTH_BYPASS === 'true' : true,
  dbPath: path.join(__dirname, 'database', 'platform.db'),
  uploadsDir: path.join(__dirname, 'uploads'),
  publicDir: path.join(__dirname, 'public'),
  resourceBaseDir: process.env.RESOURCE_DIR || 'E:\\学校\\课程教学资料\\数字图像处理\\考试课',
  aiChat: {
    apiUrl: process.env.AI_API_URL || 'https://api.deepseek.com/chat/completions',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'deepseek-v4-flash',
    maxTokens: 4096,
    temperature: 0.7,
  },
};
