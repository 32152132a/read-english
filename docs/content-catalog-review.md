# 配置化教学内容：审核与验收

## 先看这三个入口

1. **专业词库 → 添加词库 → AI 定制词库**：批量填词、查看生成进度、进入人工审核。
2. **我的 → 内容维护**：搜索自己的单词草稿；管理员还可以切换到公共音标。
3. **我的词库 → 开始学习**：展示已发布配置，答题后更新词库学习进度。

复杂配置目前用分组 JSON 编辑，便于先整理内容格式；不是完整的可视化编辑器。基础字段有独立表单。保存为草稿不会影响学习，发布才会生效。

## 按职责审核代码

| 位置 | 这次的变化 |
| --- | --- |
| `client/components/WordImportPanel` | 导入表单、幂等提交、任务进度和失败重试 |
| `client/components/ContentCatalog`、`ContentEditor` | 可维护内容列表、校验预览、草稿/发布、历史版本 |
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
3. 打开生成结果，修改释义；故意把 IPA 片段或正确选项 ID 改错，预览/保存应提示校验失败。
4. 保存草稿，确认不会自动发布；审核后发布，再添加词库。
5. 在词库开始学习，页面不应预先显示答案；答错后显示解释，答对后才能完成单词。
6. 学习中编辑并发布新版，当前练习应继续使用旧快照，新练习使用新版。
7. 用另一个账号验证不能修改或读取别人的草稿；未授权账号不能编辑公共音标。
8. 管理员修改音标加粗、口型与示意图，在新课程或音标详情核对展示。

## 尚未接入

- 真实 DeepSeek 账号调用和教学准确率抽查、真实 MySQL V4 迁移。
- 用户待提供的官方音标资源；有道语音与 COS 上传。
- 微信小程序真机验证与语音评测。
- 原有阶段测验的后台编辑页；原有测验仍使用既有数据库题目和接口。

本次没有提交或推送。临时日志、浏览器资料目录、测试服务和凭据均不纳入提交。

## 本轮验证结果（2026-09-29）

- 后端最终完整验证 20 项通过，打包与 Spotless 检查通过。
- 前端 24 项请求层/朗读测试通过，ESLint、H5 构建通过。保留原有 7 条模板索引类型警告，新增组件没有新增构建警告。
- 390×844 独立浏览器四项流程通过：生成草稿、编辑并发布、答题更新进度、管理员音标维护；没有捕获运行时异常。
- 已修复验收发现的分类切换时旧列表仍可点击问题。
- 浏览器使用独立 H2 和本机 AI 固定样本，不代表真实 DeepSeek、MySQL 或微信真机验收。

## 待提交文件清单

以下清单只记录本次任务改动，未执行提交或推送。

### 后端（17 个文件）

- `docs/content-catalog.md`
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
