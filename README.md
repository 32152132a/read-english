# 永庆发音学习

面向微信小程序的英语发音学习产品。仓库采用前后端分离结构：

- `client`：UniApp X + Vue 3 + UTS + Pinia
- `server`：NestJS + TypeScript + Prisma + MySQL 8.4 LTS
- `deploy`：Docker Compose + Nginx
- `永庆发音学习产品资料包`：产品文档、技术文档与 UI 参考图

## 本地开发

### 服务端

```bash
cd server
copy .env.example .env
npm install
npx prisma generate
npm run start:dev
```

服务启动后访问 `GET http://localhost:3000/api/v1/health`。

### 客户端

使用 HBuilderX 打开 `client` 目录，运行到微信开发者工具或 Web。复制
`.env.example` 为对应环境配置，并设置服务端 API 地址。

## 部署

复制根目录 `.env.example` 为 `.env`，填写数据库密码和 COS 配置后运行：

```bash
docker compose up -d --build
```

生产环境不要提交任何 `.env` 文件，也不要使用 `mysql:latest`。
