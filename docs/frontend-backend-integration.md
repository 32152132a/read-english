# 前后端联调记录

日期：2026-09-23 至 2026-09-27。验收依据：`docs/backend-api-product-spec.md`。

## 先看这里：进度与审核导航

本次目标是把已实现的 Java 接口接到现有前端。此前前端多处直接读取 Mock 数据，所以改动分散在页面和公共请求层；多数页面差异是删除内嵌示例数据，再映射后端返回值。未增加数据库迁移，未重做界面，未升级 Node、Java 或项目依赖，也未提交、推送或部署。

当前阶段：真实接口接入和已实现能力的本地联调已完成，进入人工审核。尚未实现的能力仍明确显示未开放，不能视为整个产品已经完成。前端默认使用 http://127.0.0.1:15173 ，后端优先使用 http://127.0.0.1:8080 。

### 建议按这四组审核

| 顺序 | 先读哪些文件 | 改了什么、重点看什么 |
| --- | --- | --- |
| 1. 请求与登录 | [http.uts](../client/src/services/http.uts)、[auth.uts](../client/src/services/auth.uts)、[token.uts](../client/src/services/token.uts)、[请求层测试](../client/scripts/test-http.mjs) | 解包统一响应；并发 401 只刷新一次；重试保留请求体和幂等键；退出撤销最新刷新令牌。Web Fake 登录只用于本地开发。 |
| 2. 学习流程 | [流程 store](../client/src/stores/learning-flow.uts)、[课程 session](../client/src/composables/use-learning-session.uts)、[阶段导航](../client/src/composables/use-learning-flow-navigation.uts)、[答题状态](../client/src/composables/use-quiz-answer.uts) | 模板、节点和内容来自后端；保存携带版本；完成使用节点 ID 和稳定幂等键；回顾不推进；先提交答案再展示结果。保存流程会开始新一轮，历史统计保留。 |
| 3. 页面与组件 | 先抽看 [首页](../client/pages/home/index.uvue)、[听辨页](../client/pages/phoneme/quiz.uvue)、[词库详情](../client/pages/word-list/detail.uvue)，再看其他页面差异 | 15 个页面从 Mock 改为真实 API。ChoiceGroup/SyllableQuiz 防止提交中或答题后重复修改；PlayButton 不再播放占位音频；RequestState 展示加载失败和重试。 |
| 4. 后端与启动 | read-java 的 UserService/UserRepository、HomeService/LearningStageService、IntegrationRegressionTests；[Web 配置](../client/vite.config.mjs)、[启动脚本](../client/scripts/web.ps1) | 后端只修两类业务问题：改流程后历史统计丢失、首页固定显示第 1 项。Web 配置对齐 HBuilderX 自带运行时辅助库；启动脚本修复路径空格、PowerShell 编码和 API 端口。 |

文件数量：前端 **38 个**（15 个页面、11 个公共类型/请求/状态文件、4 个组件、6 个构建/环境/脚本文件、2 个文档）；后端 **7 个**（4 个业务文件、1 个测试、1 个启动脚本、1 个文档）；FRP **1 个**启动文件。共 **46 个待审核文件**，完整列表在本文后半部分。FRP 原有日志变动不属于本次提交范围。

### 先做一次页面验收

1. 打开首页，使用“登录并开始学习（本地联调）”，确认出现真实用户和当前任务。
2. 顺序进入认识音标、易混对比、听辨；选择错误项并确认，检查所选项标红、正确项标绿。
3. 回到首页回顾已完成节点，检查当前学习位置没有被推进。
4. 添加一个系统词库、查看单词，再移除，检查基础词库不可删除。
5. 保存学习流程，检查新流程从头开始且累计统计保留；退出后应回到登录入口。

注意：种子内容很少，发音音频为空；这些检查验证数据、答题和进度交互，不代表真实听辨、录音评测或微信真机登录已经验收。

### 提交安排

建议后续按“前端真实接口接入”“后端两项业务修复”“本地启动与构建兼容”分组审查，再决定是否分批提交。这里只给审核分组，不自动暂存、拆分或提交；先保留全部工作区改动，避免依赖尚未就绪时单独上线。


## 范围与启动

- 前端 `read-english/client`，后端 `read-java`。初始前端 `master`、后端 `main`，两个工作区均干净。
- 后端优先 `8080`，前端 `15173`；前端开发默认 API 为 `http://127.0.0.1:8080/api/v1`，可通过启动脚本 `-ApiBaseUrl` 覆盖。
- 指定的 `D:\works\trae\frp\start\_all.bat` 不存在。实际 `D:\works\trae\frp\start_all.bat` 会强制结束所有 Node 进程、尝试启动 MongoDB、修改私钥 ACL、启动多个无关项目并把 Java 服务设置为 `18080`，用户已选择手动建立隧道；9 月 27 日 MySQL 握手与真实接口验证通过。
- 不修改远程服务器代码、MySQL 结构或系统配置；本次后端修复不包含数据库迁移。无提交或推送。

## 接入与修复归属

| 能力 | 处理位置 | 结果 |
| --- | --- | --- |
| 登录与刷新 | 前端 HTTP、token、auth | 解包 `{code,message,data,requestId}`；并发 401 共用一次刷新；保留错误码和 requestId；退出撤销轮换后的 refresh token |
| 首页与资料 | 前端页面 | 加载 `/home`、`/users/me`、`/users/me/stats`；不使用固定用户和固定统计 |
| 学习流程 | 前端 service/store/编辑页 | 模板与活动流程来自后端；保存携带 version；409 后重新加载；编辑草稿不会提前覆盖活动流程 |
| 阶段完成和回顾 | 前端导航与 session composable | 请求携带独立节点 ID；同节点重试沿用幂等键；回顾不调用完成接口；切换内容先保存位置 |
| 课程与答题 | 前端课程页 | 使用后端 session 内容；答案提交后才展示正确项和解释；切题重置答案与揭词状态 |
| 音标 | 前端总览与详情 | 使用实际分组与详情；查阅入口与正式学习分离；音频为空时提示未提供音频 |
| 词库 | 前端 store/列表/详情 | 真实查询、添加、删除与游标加载；删除后重新获取列表 |
| 历史统计 | 后端 UserService/UserRepository | 改流程不再清空历史累计；已学单元去重；连续天数按阶段完成日期计算，具体口径见后端 README |
| 首页当前位置 | 后端 HomeService/LearningStageService | 从正式 session 读取当前位置，替代固定第 1 项 |
| CORS | 后端测试 | 配置允许 15173 的 localhost/127.0.0.1 来源，已验证预检与未知来源拒绝 |

## 尚未实现及数据缺口

1. `POST/GET /word-libraries/custom-jobs`、任务重试尚未实现。前端展示暂未开放，不再本地直接伪造解析成功。
2. 录音上传、评测任务、查询及历史尚未实现。前端可展示真实评测目标，但不录制、不伪造分数、不自动完成评测阶段。
3. `libraryId` 驱动的专项学习 session 未实现。词库页面可查看单词，学习入口提示后转至词库详情，不推进正式流程。
4. 现有种子数据只有 3 个音标、各学习模板 1 个单元，标准发音 URL 为空、听辨音频数组为空。已去掉占位发音；真实播放和听辨体验需补充授权音频与课程数据。
5. 微信真实登录 Gateway 未接入。Web 本地联调使用独立 Fake 身份；生产和小程序真机认证仍需后续验证。
6. 后端实际为 Spring Boot 4.1.1，规格目标为 3；本次保留现有技术版本，不做框架迁移。
7. 当前统计按“阶段完成”计数，并非逐单元完成记录；阶段内位置保存已接入，更细统计需要补齐进度模型。

## 校验

- 后端 Maven `spotless:apply verify`：14 项测试通过，打包与格式检查通过，使用独立 H2 测试库。
- 前端 `npm run test:http`：6 项测试通过，覆盖真实 UTS 请求层的协议、并发刷新、错误与 Loading 行为。
- 前端 `npm run lint`：通过。
- H5 构建：9 月 27 日通过；使用 Windows PowerShell 5.1，并注入旧脚本的尾随空格环境变量验证启动修复。保留原有 7 条组件循环索引类型警告。正式 `vite.config.mjs` 配置加入后构建通过，保留 UniApp 编译插件并使用 HBuilderX 配套 @vue/shared。HBuilderX 插件存在，命令行需提前设置 `UNI_PLATFORM=h5`，已固化在 `client/scripts/web.ps1`。
- SSH 3307：已读取真实 MySQL 握手。本地 Java 21 与 Maven Wrapper 匹配，Java 后端不依赖 Node。
- 真实 MySQL 接口：9 月 27 日 10 组通过，覆盖登录、默认数据、口音校验、七阶段 session、幂等推进、回顾、重复节点、版本冲突、词库增删和分页、音标、用户隔离、刷新及退出。
- 浏览器：用户批准后已加入正式 `vite.config.mjs`，修复 HBuilderX Vue 3.4.21 与项目 @vue/shared 3.5.42 混用造成的插槽更新异常。重启前端后重新跑完 10 组页面流程，全部通过，`sharedRuntimeOverride=false`，无临时响应替换，未捕获运行时异常。包含登录、阶段跳转、答题红绿反馈、音节/音标揭词/拼读、回顾、音标查阅、词库增删、流程保存和统计保持、令牌刷新及退出。
- 用户手动重启后，18080 后端健康检查通过；前端已用 `scripts/web.ps1 -ApiBaseUrl http://127.0.0.1:18080/api/v1` 启动于 5173。使用独立浏览器配置及测试身份，先前 8080 服务已停止。
- 后端新增 `scripts/start-local.ps1`：预检 JDK 21、MySQL 握手、端口占用，默认 8080；`-CheckOnly` 检查通过，18080 占用场景按预期拒绝重复启动。仅设置当前进程环境，不修改系统配置。
- 启动修复：`frp/start_all.bat` 的前端启动行改为调用 `client/scripts/web.ps1`，API 匹配原有 Java 18080；修复 `set VAR=value && ...` 引入尾随空格导致 `client /manifest.json` 不存在的问题。`web.ps1` 使用 ASCII 文本以兼容 Windows PowerShell 5.1，并检查 manifest 文件存在。原有 FRP 日志改动保持不动。
- 部署脚本的 `uncommitted changes` 来自本地 read-java 联调改动，deploy-qyq 工作区干净；保留生产部署校验，本地启动无需提交，不自动提交或推送。

## 待提交文件

前端 `read-english`（38 个文件）：

```text
README.md
client/.env.development
client/.env.example
client/components/ChoiceGroup/index.uvue
client/components/PlayButton/index.uvue
client/components/RequestState/index.uvue
client/components/SyllableQuiz/index.uvue
client/package.json
client/pages/decoding/ipa.uvue
client/pages/decoding/word.uvue
client/pages/evaluation/index.uvue
client/pages/home/index.uvue
client/pages/phoneme/compare.uvue
client/pages/phoneme/detail.uvue
client/pages/phoneme/overview.uvue
client/pages/phoneme/quiz.uvue
client/pages/profile/index.uvue
client/pages/profile/learning-flow.uvue
client/pages/syllable/index.uvue
client/pages/word-list/add.uvue
client/pages/word-list/custom.uvue
client/pages/word-list/detail.uvue
client/pages/word-list/index.uvue
client/scripts/test-http.mjs
client/scripts/web.ps1
client/src/composables/use-learning-flow-navigation.uts
client/src/composables/use-learning-session.uts
client/src/composables/use-quiz-answer.uts
client/src/config/api-types.uts
client/src/config/types.uts
client/src/services/auth.uts
client/src/services/http.uts
client/src/services/learning-flow.uts
client/src/services/token.uts
client/src/stores/learning-flow.uts
client/src/stores/library.uts
client/vite.config.mjs
docs/frontend-backend-integration.md
```

后端 `read-java`（7 个文件）：

```text
README.md
scripts/start-local.ps1
src/main/java/com/readenglish/home/HomeService.java
src/main/java/com/readenglish/learningcontent/LearningStageService.java
src/main/java/com/readenglish/user/UserRepository.java
src/main/java/com/readenglish/user/UserService.java
src/test/java/com/readenglish/product/IntegrationRegressionTests.java
```

启动仓库 `frp`：仅 `start_all.bat` 为本次待提交文件；已有 `frpc.log`（含暂存改动）和 `ssh_tunnel.log` 不纳入本次提交清单。

私有 `.local/mysql.env`、令牌、日志、浏览器记录、`target` 和 `unpackage` 均不提交。以上文件仅列为待审查清单，尚未暂存、提交或推送。
