# Read English 发音学习

面向微信小程序的英语发音学习产品。仓库采用前后端分离结构：

- `client`：UniApp X + Vue 3 + UTS + Pinia
- `server`：历史 NestJS 实现；当前联调使用相邻 `read-java` 仓库
- `deploy`：Docker Compose + Nginx
- `Read English 发音学习产品资料包`：产品文档、技术文档与 UI 参考图

## 本地开发

### Java 前后端联调（当前入口）

后端运行相邻 `read-java` 仓库，默认 HTTP 端口 `8080`；通过 SSH 隧道连接 MySQL 时，先确认 `127.0.0.1:3307` 可用，再执行该仓库的 `scripts/start-local.ps1`（可先加 `-CheckOnly` 检查）。密码仅保存在被忽略的本地配置中。

前端使用现有 HBuilderX 编译器，无需启动本仓库的历史 NestJS 服务：

```powershell
cd client
.\scripts\web.ps1
# 后端使用其他端口时显式指定：
.\scripts\web.ps1 -ApiBaseUrl http://127.0.0.1:18080/api/v1
# 校验与生产构建：
npm run lint
npm run test:http
.\scripts\web.ps1 -Build
```

默认前端地址 `http://127.0.0.1:15173`。HBuilderX 安装目录不同可传 `-HBuilderXDirectory`。脚本只设置当前进程环境，不修改 HBuilderX 安装或系统配置。

Web 开发环境首页提供本地联调登录，通过后端 Fake WeChat Gateway 建立独立身份；生产 Web 不启用 Fake 登录，微信小程序使用 `uni.login`。后端 MySQL 本地配置需显式启用已有 Fake Gateway。详细范围、缺口和验收结果见 [前后端联调记录](docs/frontend-backend-integration.md)。

### 接口错误提示约定

- 普通请求失败默认在当前页面弹出提示，接口 404/500 不再跳转错误页。
- 两秒内的连续错误合并提示；同一个错误对象在页面 catch 中再次调用 `showRequestError` 不会重复提示。每个请求仍独立 reject，保留错误码、响应数据及 requestId。
- 首次加载由页面的 `RequestState` 展示错误和重试时，使用 `request({ url, showError: false })`；该开关只关闭公共提示，不吞掉错误。保存、删除、答题等操作保持默认提示并保留当前页面状态。
- 登录凭据失效会先尝试刷新；确认失效后统一清理凭据、提示一次，并返回首页登录入口。`showError: false` 不关闭此认证处理；刷新时断网不会清空登录凭据。
- 提示等待公共 Loading 关闭后显示，避免被 Loading 遮掉；登录失效提示优先于普通错误。

### 单词播放与系统朗读

公共入口为 `PlayButton`，通过 `src` 接收音频地址；单词入口额外传入 `word`。优先播放音频；仅在地址为空时，Web 才根据用户偏好尝试美式或英式系统朗读，并显示“系统朗读”。没有匹配声线时交由浏览器选择英语声线；浏览器不支持时提示不可用。音频加载失败只提示重试，不切换朗读来源。

音标播放按当前口音优先选择 `audioUsUrl` 或 `audioGbUrl`，没有对应口音资源时使用通用 `audioUrl`。三者都为空时，Web 朗读配套例词并显示“听例词”，不会直接合成 IPA 字符。听辨题仍只播放标准音频。微信小程序保持音频播放方式，没有音频时提示缺失。切换播放、页面隐藏、组件卸载或输入变化会停止原播放；不同按钮不会同时排队朗读。

播放回归测试（在 client 目录）：`node --experimental-vm-modules --test scripts/test-pronunciation.mjs`。浏览器声线由用户设备提供，可能使用远程服务；系统朗读不等同于经过校对的标准音频。

### 历史 NestJS 服务端

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
