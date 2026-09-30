# 配置化教学内容：审核与验收

## 先看这三个入口

1. **专业词库 → 添加词库 → AI 定制词库**：批量填词并查看生成进度；校验成功后直接进入词库。
2. **我的 → 内容维护**：搜索并修改自己的 AI 单词；管理员还可以切换到公共音标。
3. **我的词库 → 开始学习**：展示当前配置，答题后更新词库学习进度。

复杂配置目前用分组 JSON 编辑，基础字段有独立表单。保存修改或词库成员变化会清空该词库的答题和学习进度，下次进入读取最新内容。

## 按职责审核代码

| 位置 | 这次的变化 |
| --- | --- |
| `client/components/WordImportPanel` | 导入表单、幂等提交、任务进度和失败重试 |
| `client/components/ContentCatalog`、`ContentEditor` | 当前内容列表与单次保存编辑 |
| `client/components/ContentPreview`、`LibraryStudy` | 配置展示、选择题交互、后端判分和学习完成 |
| `client/src/config/content-types.uts` | 完整配置对象的领域类型 |
| `client/pages/content/*`、`word-list/custom.uvue`、`study.uvue` | 薄页面，只传入路由参数并组合组件 |
| `client/pages.json`、个人页、词库页 | 新页面入口和实际词库学习入口 |
| 现有音标、拆读、评测页面 | 优先读取 teachingConfig，兼容尚未迁移的旧课程结构 |
| `MouthShape`、`PhonemeDisplay`、相关口型组件 | 图片配置、闭口示意、独立 bold 配置 |
| `pronunciation.uts`、对应测试 | Web 单词优先美式浏览器朗读，不可用时回退录音；音标和听辨题只播放资源 |

所有请求继续使用已有公共请求层，页面不单独写 token 或鉴权头。新增内容组件局部引用，未改全局注册方式。后端契约、六张新表的职责和环境变量见 `read-java/docs/content-catalog.md`。

## 手工验收顺序

1. 配置后端私有 `DEEPSEEK_API_KEY`。没有密钥时入口应显示未配置。
2. 输入少量单词，包含重复词，确认去重、任务可离开再打开。
3. 生成成功后确认词库已有单词，不需要逐条发布。
4. 打开一个生成结果修改释义；故意把 IPA 片段或正确选项 ID 改错，保存应提示校验失败。
5. 在词库开始学习，页面不应预先显示答案；答错后显示解释，答对后才能完成单词。
6. 保存单词修改后重新进入词库，确认该词库回到未学习状态并读取最新内容。
7. 用另一个账号验证不能修改或读取别人的内容；未授权账号不能编辑公共音标。
8. 管理员修改音标加粗、口型与示意图，在新课程或音标详情核对展示。

## 尚未接入

- 真实 DeepSeek 账号调用和教学准确率抽查、真实 MySQL V4 迁移。
- 用户待提供的官方音标资源；有道语音与 COS 上传。
- 微信小程序真机验证与语音评测。
- 原有阶段测验的后台编辑页；原有测验仍使用既有数据库题目和接口。

主体功能已有提交：前端 b79c353、后端 c8f56ad。本轮保留历史，仅追加复查修复和交接文档；未执行推送。临时日志、浏览器资料目录、测试服务和凭据均不纳入提交。

## 本轮验证结果（2026-09-29）

- 后端复查后完整验证 22 项通过，打包与 Spotless 检查通过。
- 前端 24 项请求层/朗读测试通过，ESLint、H5 构建通过。保留原有 7 条模板索引类型警告，新增组件没有新增构建警告。
- 原版本曾完成 390×844 浏览器验收；V8 简化后的自动入库与单次保存流程需以本轮最新验证为准。
- 已修复验收发现的分类切换时旧列表仍可点击问题。
- 浏览器使用独立 H2 和本机 AI 固定样本，不代表真实 DeepSeek、MySQL 或微信真机验收。

## 本轮功能涉及的文件

以下清单记录本轮功能范围，主体已提交；补充提交以两个仓库的 git log 为准。新窗口先读 read-java/docs/next-session-handoff.md。

### 后端（18 个文件）

- `docs/content-catalog.md`
- `docs/next-session-handoff.md`
- `src/main/java/com/readenglish/content/ContentConfig.java`
- `src/main/java/com/readenglish/content/ContentController.java`
- `src/main/java/com/readenglish/content/ContentJobs.java`
- `src/main/java/com/readenglish/content/ContentProjection.java`
- `src/main/java/com/readenglish/content/ContentService.java`
- `src/main/java/com/readenglish/content/DeepSeekWordGenerator.java`
- `src/main/java/com/readenglish/content/WordGenerator.java`
- `src/main/java/com/readenglish/learningcontent/LearningStageService.java`
- `src/main/java/com/readenglish/library/WordLibraryModels.java`
- `src/main/java/com/readenglish/library/WordLibraryService.java`
- `src/main/java/com/readenglish/phoneme/PhonemeModels.java`
- `src/main/java/com/readenglish/phoneme/PhonemeService.java`
- `src/main/resources/application.properties`
- `src/main/resources/db/migration/V4__content_catalog.sql`
- `src/test/java/com/readenglish/content/ContentApiTests.java`
- `src/test/java/com/readenglish/content/DeepSeekWordGeneratorTests.java`

### 前端（30 个文件）

- `client/components/ContentCatalog/index.uvue`
- `client/components/ContentEditor/index.uvue`
- `client/components/ContentPreview/index.uvue`
- `client/components/LibraryStudy/index.uvue`
- `client/components/MouthShape/index.uvue`
- `client/components/PhonemeComparison/index.uvue`
- `client/components/PhonemeDisplay/index.uvue`
- `client/components/PronunciationGuide/index.uvue`
- `client/components/WordImportPanel/index.uvue`
- `client/pages.json`
- `client/pages/content/edit.uvue`
- `client/pages/content/index.uvue`
- `client/pages/decoding/ipa.uvue`
- `client/pages/decoding/word.uvue`
- `client/pages/evaluation/index.uvue`
- `client/pages/phoneme/compare.uvue`
- `client/pages/phoneme/detail.uvue`
- `client/pages/profile/index.uvue`
- `client/pages/word-list/custom.uvue`
- `client/pages/word-list/detail.uvue`
- `client/pages/word-list/index.uvue`
- `client/pages/word-list/study.uvue`
- `client/scripts/test-pronunciation.mjs`
- `client/src/config/api-types.uts`
- `client/src/config/content-types.uts`
- `client/src/config/types.uts`
- `client/src/services/pronunciation.uts`
- `client/static/images/mouth-closed.svg`
- `docs/backend-api-product-spec.md`
- `docs/content-catalog-review.md`

## 提交前复查补充

- 修复生成完成后历史任务状态滞后，以及切换任务期间的重复请求问题。
- 修复学习配置卡片未占满内容宽度，浏览器验证根容器与卡片实际宽度一致。
- 后端拒绝超过数据库字段上限或非字符串的内容音频地址。
- 不同大小写再次导入仍复用人工词条及其当前内容，不重复生成。
- 后续顺序：真实 MySQL / DeepSeek 少量联调 → 经确认后完善可视化编辑 → 音标资源与 COS / 有道 → 部署和微信真机。
