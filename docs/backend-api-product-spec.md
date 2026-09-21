# 永庆发音学习：后端接口与产品功能规格

> 文档版本：1.0  
> 更新时间：2026-09-13  
> 目标后端：Java 21 + Spring Boot 3  
> 接口前缀：`/api/v1`  
> 本文以当前前端产品和交互为准，作为后端实现、联调和验收依据。资料包中的旧 NestJS 技术方案仅作历史参考，不再作为后端技术选型。

## 1. 文档目标

本文用于让后端开发者在不重新猜测产品含义的情况下完成以下工作：

1. 理解产品解决的问题、用户学习路径和关键业务规则。
2. 明确每个前端页面需要的数据及操作接口。
3. 建立统一、稳定、可替换前端 Mock 数据的 API 契约。
4. 明确 Java 后端的模块、数据模型、事务、异步任务和外部服务调用。
5. 为后续接入微信登录、腾讯云口语评测、对象存储和大模型留下清晰边界。

本文不要求后端照搬前端当前 Mock 字段，但最终返回数据必须能覆盖本文定义的页面能力。字段名如需调整，应同步更新 OpenAPI 和前端类型。

## 2. 产品理解

### 2.1 产品定位

“永庆发音学习”是一款面向中文母语成人，尤其是程序员和互联网从业者的移动端英语发音学习产品。它不是完整的背单词或综合英语课程，而是解决一条更聚焦的问题链：

`认识音标 → 听辨音素 → 理解音节 → 根据音标拼读 → 拆读陌生单词 → 跟读评测与纠正`

最终目标是让用户看到陌生单词时，能够结合音标主动读出来，并通过听辨和评测形成反馈闭环。

### 2.2 核心学习原则

- 学习流程可配置：用户可以重复添加某个功能、调整顺序或删除非必要节点。
- 内容与流程分离：功能模板是系统能力；用户流程节点是模板在个人流程中的实例。
- 同一模板可以重复出现，因此进度必须绑定“流程节点实例 ID”，不能只绑定模板编码。
- 切换题目或步骤时，上一题的选择、答案状态、录音计时必须清理。
- 已学内容允许回顾，但回顾不应错误推进当前正式学习进度。
- 修改学习流程只重置当前流程位置，不删除历史学习、词库或评测记录。
- 音标总览是查阅型工具，可以加入流程，但默认流程中不是必需节点。

### 2.3 默认学习流程

当前默认流程如下：

1. 认识音标 `phoneme`
2. 易混对比 `phoneme-compare`
3. 听音辨认 `phoneme-quiz`
4. 音素音节 `syllable`
5. 音标拼读 `ipa-decoding`
6. 单词拼读 `word-decoding`
7. AI评测 `evaluation`

可选功能模板：

- 音标总览 `phoneme-overview`

后端不得把顺序硬编码到页面接口中。模板由系统维护，用户保存的流程决定首页当前任务和“完成本阶段”后的下一页面。

### 2.4 一次学习的基本闭环

1. 首页读取用户当前流程和当前节点，展示“今日学习”。
2. 用户进入当前节点，完成节点内若干学习内容或题目。
3. 页面只提交当前内容进度；到达节点末尾时调用全局“完成当前阶段”接口。
4. 后端以用户当前流程为准原子推进位置，并返回下一节点。
5. 如果已经是最后一个节点，返回流程完成状态；前端提示完成并回到首页。

## 3. 页面及功能总览

| 页面 | 路由 | 产品作用 | 主要后端数据/操作 |
| --- | --- | --- | --- |
| 首页 | `/pages/home/index` | 展示问候、今日学习、动态学习路径和常用功能 | 首页聚合、当前流程、当前任务、统计 |
| 认识音标 | `/pages/phoneme/detail` | 学习单个音标的发音、口型、步骤和例词 | 阶段内容、音频、内容进度、阶段完成 |
| 易混对比 | `/pages/phoneme/compare` | 对比易混音标的口型、声音与例词 | 对比课程、成对音频、阶段完成 |
| 听音辨认 | `/pages/phoneme/quiz` | 听音频后从 A/B/C/D 中辨认音标 | 题目、提交答案、反馈、阶段完成 |
| 音标总览 | `/pages/phoneme/overview` | 快速查阅全部元音和辅音并播放 | 音标列表和音频；不展示掌握进度 |
| 音素音节 | `/pages/syllable/index` | 理解音素、音节和分节规则，并通过选择题练习 | 阶段课程、题目答题、进度 |
| 音标拼读 | `/pages/decoding/ipa` | 看音标尝试读词，按需揭示单词并播放 | 拼读练习、揭示事件、音频、进度 |
| 单词拼读 | `/pages/decoding/word` | 将单词字母块与音标片段对应，学习拆读规则 | 单词拆分、音标映射、通用/特殊提示 |
| 专业词库 | `/pages/word-list/index` | 管理“我的词库”，进入学习或查看单词 | 我的词库、删除词库、学习入口 |
| 词库单词 | `/pages/word-list/detail` | 浏览词库中的单词、音标、释义和读音 | 词库详情、分页单词、播放资源 |
| 添加词库 | `/pages/word-list/add` | 从系统或已解析的 AI 词库中多选添加 | 可添加列表、批量添加 |
| AI 定制词库 | `/pages/word-list/custom` | 输入名称和逗号分隔单词，异步解析成词库 | 创建解析任务、查询任务状态 |
| AI评测 | `/pages/evaluation/index` | 录制最多 4 秒语音，给出评分、识别问题和建议 | 上传录音、异步评测、AI建议、历史结果 |
| 我的 | `/pages/profile/index` | 展示个人资料、统计、词库/流程入口和发音偏好 | 用户资料、统计、偏好、退出登录 |
| 学习流程 | `/pages/profile/learning-flow` | 从功能模板拖入节点、重复添加、排序、删除并保存 | 模板列表、当前配置、保存配置 |
| 404 | `/pages/error/404` | 页面或资源不存在的兜底页 | 通常无业务接口 |
| 500 | `/pages/error/500` | 服务异常的兜底页 | 通常无业务接口 |

## 4. 通用 API 约定

### 4.1 协议与认证

- 基础地址由前端环境变量 `VITE_API_BASE_URL` 提供，默认 `/api/v1`。
- 除登录、刷新令牌和公开资源外，统一使用 `Authorization: Bearer <accessToken>`。
- 时间统一使用带时区 ISO 8601，例如 `2026-09-13T10:20:30+08:00`。
- 数据库 `BIGINT` ID 在 JSON 中统一返回字符串，避免 JavaScript 精度丢失。
- 所有写操作使用 JSON；录音上传使用 `multipart/form-data`。
- 客户端可发送 `X-Request-Id`；服务端无论是否收到都应返回唯一 `requestId`。

### 4.2 统一响应

成功：

```json
{
  "code": "OK",
  "message": "success",
  "data": {},
  "requestId": "01J7..."
}
```

失败：

```json
{
  "code": "FLOW_VERSION_CONFLICT",
  "message": "学习流程已在其他设备更新，请刷新后重试",
  "data": null,
  "requestId": "01J7..."
}
```

HTTP 状态码仍表达协议语义，业务 `code` 用于前端给出稳定提示。不得所有错误都返回 HTTP 200。

### 4.3 分页

移动端列表优先使用游标分页：

```json
{
  "items": [],
  "nextCursor": "opaque-cursor",
  "hasMore": true
}
```

默认 `size=20`，最大 `size=100`。词库详情等存在稳定排序的列表必须返回排序字段或固定排序规则。

### 4.4 幂等与并发

- 阶段完成、录音评测、创建 AI 词库任务必须支持 `Idempotency-Key`。
- 学习流程配置使用 `version` 乐观锁。保存时版本不一致返回 `409 FLOW_VERSION_CONFLICT`。
- 同一幂等键、用户和接口在有效期内必须返回同一业务结果，不能重复推进或重复扣费调用第三方。
- “完成当前阶段”必须校验提交的 `flowNodeId` 就是当前节点，避免旧页面推进新流程。

### 4.5 前端 Loading 约定

前端请求层已经维护并发请求计数和全局 Loading：

- 普通页面请求默认计入全局 Loading。
- 轮询、静默刷新、音频地址刷新等请求传 `showLoading: false`。
- 后端不需要返回 Loading 标识，只需保证异步任务有明确 `status`。

## 5. 核心数据类型

### 5.1 功能模板

```text
phoneme           认识音标
phoneme-overview  音标总览
phoneme-compare   易混对比
phoneme-quiz      听音辨认
syllable          音素音节
ipa-decoding      音标拼读
word-decoding     单词拼读
evaluation        AI评测
```

模板返回建议结构：

```json
{
  "code": "phoneme",
  "name": "认识音标",
  "shortName": "认识\n音标",
  "route": "/pages/phoneme/detail",
  "icon": "phoneme",
  "enabled": true,
  "repeatable": true
}
```

`route` 当前可由后端返回，方便运营调整入口；后端业务逻辑只依赖 `code`，不能依赖前端路由字符串。

### 5.2 状态枚举

- 流程运行状态：`NOT_STARTED`、`IN_PROGRESS`、`COMPLETED`。
- 单元进度：`NOT_STARTED`、`IN_PROGRESS`、`COMPLETED`。
- 词库类型：`BASE`、`SYSTEM`、`AI_CUSTOM`。
- 词库解析状态：`PENDING`、`PROCESSING`、`SUCCEEDED`、`FAILED`。
- 评测状态：`PENDING`、`PROCESSING`、`SUCCEEDED`、`FAILED`。
- 发音偏好：当前仅 `US`；`UK` 预留但不要在前端提供选择。

## 6. 详细接口设计

### 6.1 登录与用户

#### `POST /auth/wechat/login`

微信小程序登录。无需 Bearer Token。

请求：

```json
{ "code": "wx.login 返回的临时 code" }
```

响应：

```json
{
  "accessToken": "jwt",
  "refreshToken": "opaque-token",
  "expiresIn": 7200,
  "user": {
    "id": "10001",
    "nickname": "永庆",
    "avatarUrl": null,
    "accentPreference": "US"
  },
  "newUser": false
}
```

后端内部使用微信 `code2Session` 换取 `openid/session_key`，只保存必要字段。`session_key` 不返回客户端。

#### `POST /auth/refresh`

以 refresh token 换取新 token。建议 refresh token 轮换并在数据库保存哈希值。

#### `POST /auth/logout`

撤销当前 refresh token。access token 可保持短有效期；如需要即时失效可增加 Redis 黑名单。

#### `GET /users/me`

返回个人资料及偏好。

#### `PATCH /users/me/preferences`

请求示例：

```json
{ "accentPreference": "US" }
```

当前仅允许 `US`，传入未开放值返回 `PREFERENCE_NOT_SUPPORTED`。

#### `GET /users/me/stats`

```json
{
  "learnedUnits": 8,
  "totalUnits": 20,
  "streakDays": 3,
  "completedStages": 2,
  "evaluationCount": 5
}
```

统计口径必须在后端固定，不让前端自行拼接。

### 6.2 首页

#### `GET /home`

推荐使用首页聚合接口，减少小程序首屏请求数。内部由用户、流程、进度和常用功能服务组合，不复制业务数据。

```json
{
  "user": { "nickname": "永庆" },
  "greeting": "下午好，永庆",
  "subtitle": "看到陌生单词，也能试着读出来",
  "todayTask": {
    "flowNodeId": "fn_103",
    "templateCode": "phoneme-quiz",
    "title": "听音辨认 · 第 3 课",
    "description": "听声音，辨认正确的音标",
    "estimatedMinutes": 6,
    "route": "/pages/phoneme/quiz",
    "current": 8,
    "total": 20
  },
  "learningPath": [
    {
      "nodeId": "fn_101",
      "templateCode": "phoneme",
      "name": "认识音标",
      "position": 0,
      "status": "COMPLETED",
      "reviewable": true,
      "route": "/pages/phoneme/detail"
    }
  ],
  "quickActions": [
    { "code": "phoneme-overview", "name": "音标总览", "route": "/pages/phoneme/overview" },
    { "code": "word-library", "name": "专业词库", "route": "/pages/word-list/index" }
  ],
  "flowCompleted": false
}
```

规则：

- `todayTask` 必须来自当前用户的活动流程节点，不能使用固定页面顺序。
- 只有已完成的路径节点允许首页快速回顾；当前节点通过“继续学习”进入。
- 流程完成时 `todayTask` 可为空，并返回完成后的提示信息或重新学习入口。

### 6.3 学习流程

#### `GET /learning-flow/templates`

返回当前启用的所有功能模板。上方模板拖入后不会消失，可重复使用。

#### `GET /learning-flow`

```json
{
  "id": "flow_1",
  "version": 4,
  "currentNodeIndex": 2,
  "status": "IN_PROGRESS",
  "nodes": [
    {
      "id": "fn_101",
      "templateCode": "phoneme",
      "name": "认识音标",
      "position": 0,
      "route": "/pages/phoneme/detail"
    },
    {
      "id": "fn_102",
      "templateCode": "phoneme",
      "name": "认识音标",
      "position": 1,
      "route": "/pages/phoneme/detail"
    }
  ]
}
```

#### `PUT /learning-flow`

保存拖拽后的流程。

```json
{
  "version": 4,
  "nodes": [
    { "clientNodeId": "tmp-1", "templateCode": "phoneme" },
    { "clientNodeId": "tmp-2", "templateCode": "evaluation" }
  ]
}
```

服务端规则：

- 至少保留一个节点，模板必须启用。
- 按数组顺序生成 `position`，不要相信客户端传入的位置数字。
- 每个节点生成独立后端 ID；相同 `templateCode` 可以出现多次。
- 保存后 `version + 1`，当前位置重置为第 0 个节点。
- 弹窗文案应说明“将从新流程的第一步开始，历史学习和评测记录不会删除”。
- 使用事务保存配置和运行快照；历史流程运行记录不得覆盖。

#### `POST /learning-flow/current/complete`

完成当前阶段并获取下一页面，是所有学习页面末尾调用的统一接口。

```json
{
  "flowNodeId": "fn_103",
  "lastUnitId": "unit_20"
}
```

响应：

```json
{
  "completedNodeId": "fn_103",
  "flowCompleted": false,
  "currentNodeIndex": 3,
  "nextNode": {
    "id": "fn_104",
    "templateCode": "syllable",
    "name": "音素音节",
    "route": "/pages/syllable/index"
  }
}
```

最后一步返回 `flowCompleted: true`、`nextNode: null`。接口必须事务化、加幂等保护，并校验节点、用户和当前流程版本。

### 6.4 统一阶段内容与进度

为了避免七个学习页面分别设计完全不同的翻页接口，建议使用统一外壳和类型化 `content`。

#### `GET /learning-stages/{templateCode}/session`

查询参数：

- `flowNodeId`：正式学习时必传。
- `review=true`：从首页回顾已完成节点时传入；回顾不会推进活动流程。

通用响应：

```json
{
  "sessionId": "session_1",
  "flowNodeId": "fn_101",
  "templateCode": "phoneme",
  "reviewMode": false,
  "currentUnitIndex": 0,
  "total": 3,
  "units": [
    {
      "id": "unit_1",
      "title": "短元音 · 第 1 课",
      "contentType": "PHONEME_DETAIL",
      "content": {}
    }
  ]
}
```

当前课程量较小时可以一次返回全部单元，方便前端本地上一步/下一步；内容增大后可增加单元详情接口，但不能改变外壳语义。

#### `PUT /learning-stages/sessions/{sessionId}/position`

```json
{ "unitId": "unit_2", "unitIndex": 1 }
```

用于保存节点内部当前位置。此接口只更新内容位置，不推进到下一流程节点。建议防抖或只在切换时调用。

#### 各 `contentType` 的内容结构

##### `PHONEME_DETAIL`：认识音标

```json
{
  "category": "短元音",
  "ipa": "/ɪ/",
  "description": "发音短促，嘴角自然放松",
  "audioUrl": "https://cdn.example.com/phoneme/i.mp3",
  "mouth": { "type": "relaxed", "color": "#3154ff" },
  "pronunciationSteps": ["舌尖轻触下齿", "嘴唇自然放松", "快速发出短音"],
  "exampleWords": [
    { "wordId": "w_1", "word": "sit", "ipa": "/sɪt/", "meaning": "坐", "audioUrl": "..." }
  ],
  "memoryTip": "声音短而轻，不要拖长。"
}
```

##### `PHONEME_COMPARE`：易混对比

```json
{
  "category": "短元音与长元音",
  "title": "/ɪ/ 和 /iː/",
  "description": "注意时长和嘴角变化",
  "phonemes": [
    {
      "phonemeId": "p_1",
      "ipa": "/ɪ/",
      "description": "短而放松",
      "mouth": { "type": "relaxed" },
      "audioUrl": "...",
      "examples": ["sit", "ship"]
    }
  ],
  "audioPairs": [
    {
      "left": { "word": "ship", "audioUrl": "..." },
      "right": { "word": "sheep", "audioUrl": "..." }
    }
  ],
  "memoryTip": "先听长度，再看嘴角。"
}
```

##### `PHONEME_QUIZ`：听音辨认

```json
{
  "questionId": "q_1",
  "title": "听一听，选出正确音标",
  "description": "点击播放按钮可重复播放",
  "audioUrls": ["https://cdn.example.com/q1.mp3"],
  "options": [
    { "id": "A", "label": "/ɪ/" },
    { "id": "B", "label": "/iː/" },
    { "id": "C", "label": "/e/" },
    { "id": "D", "label": "/æ/" }
  ]
}
```

初次返回不得包含正确答案。提交答案后再返回正确项和解释。

##### `SYLLABLE`：音素音节

```json
{
  "lessonTitle": "音节是什么",
  "description": "一个音节通常围绕一个元音核心形成",
  "segments": ["com", "pu", "ter"],
  "rules": ["先找元音声音", "围绕元音划分音节"],
  "memoryTip": "数元音声音，不是简单数字母。",
  "question": {
    "questionId": "sq_1",
    "prompt": "computer 有几个音节？",
    "options": [
      { "id": "A", "label": "1" },
      { "id": "B", "label": "2" },
      { "id": "C", "label": "3" },
      { "id": "D", "label": "4" }
    ]
  }
}
```

##### `IPA_DECODING`：音标拼读

```json
{
  "wordId": "w_1",
  "word": "teacher",
  "hiddenWord": true,
  "ipa": "/ˈtiːtʃər/",
  "audioUrl": "...",
  "syllables": ["/tiː/", "/tʃər/"],
  "tip": "先按重音和音节读，再揭晓单词。"
}
```

“查看单词”是学习交互，不需要单独后端接口；可在进度埋点中记录是否揭示。

##### `WORD_DECODING`：单词拼读

```json
{
  "wordId": "w_2",
  "word": "computer",
  "ipa": "/kəmˈpjuːtər/",
  "audioUrl": "...",
  "parts": [
    { "letters": "com", "ipa": "/kəm/" },
    { "letters": "pu", "ipa": "/pjuː/" },
    { "letters": "ter", "ipa": "/tər/" }
  ],
  "commonTips": [
    "先听元音声音：每个音节通常有一个元音核心。",
    "两个辅音相邻时，通常从中间尝试拆开。",
    "词尾 -le 常和前面的辅音组成一个音节。"
  ],
  "specialTips": ["这个词的重音落在第二个音节。"]
}
```

通用规则可由内容配置统一提供；单词特殊规则由词条返回。前端合并展示，但后端必须区分来源便于维护。

##### `EVALUATION`：AI评测题目

```json
{
  "wordId": "w_3",
  "word": "development",
  "ipa": "/dɪˈveləpmənt/",
  "stressParts": ["de", "VEL", "op", "ment"],
  "standardAudioUrl": "...",
  "recordingMaxSeconds": 4,
  "prompt": "点击开始录音，4 秒后会自动结束"
}
```

录音计时和销毁清理由前端录音组件维护；后端只验证时长和音频。

#### `POST /quiz-questions/{questionId}/answers`

统一处理听音辨认和音素音节的选择题。

```json
{ "selectedOptionId": "B", "sessionId": "session_1" }
```

响应：

```json
{
  "correct": false,
  "selectedOptionId": "B",
  "correctOptionId": "C",
  "explanation": "computer 包含三个元音声音，因此有三个音节。"
}
```

点击错误答案时，前端同时标红错误项、标绿正确项。后端必须在提交后返回正确项；下一题前端清空状态。

### 6.5 音标总览

#### `GET /phonemes`

查询参数：`group=VOWEL|CONSONANT` 可选。不传返回全部分组。

```json
{
  "groups": [
    {
      "code": "VOWEL",
      "name": "元音",
      "items": [
        { "id": "p_1", "ipa": "/ɪ/", "audioUrl": "...", "order": 1 }
      ]
    },
    {
      "code": "CONSONANT",
      "name": "辅音",
      "items": []
    }
  ]
}
```

页面只用于查阅和试听，不返回“已掌握”对号或进度条。

#### `GET /phonemes/{id}`

可供认识音标详情或后台管理复用，返回音标、口型、步骤、例词和媒体。

### 6.6 专业词库

#### `GET /word-libraries/mine`

返回用户已经添加的词库。新用户默认拥有基础词库。

```json
{
  "items": [
    {
      "id": "lib_base",
      "name": "基础词库",
      "type": "BASE",
      "description": "高频基础发音练习",
      "wordCount": 20,
      "learnedCount": 8,
      "removable": false,
      "lastPosition": 8
    }
  ]
}
```

#### `GET /word-libraries/available`

返回可添加且当前未拥有的系统词库，以及解析成功但尚未添加的个人 AI 词库。已经添加的词库不重复显示。

#### `POST /word-libraries/mine`

```json
{ "libraryIds": ["lib_frontend", "lib_ai_100"] }
```

批量添加且幂等。已拥有的 ID 可忽略，非法或无权访问的 ID 返回明确错误。

#### `DELETE /word-libraries/mine/{libraryId}`

删除前由前端二次确认，提示“删除后将清除该词库的学习记录”。后端必须再次执行权限和类型校验：

- 基础词库不可删除，返回 `LIBRARY_BASE_NOT_REMOVABLE`。
- 只删除用户与词库的关联及该用户在该词库下的学习记录。
- 不删除系统词库实体，也不影响其他用户。
- AI 个人词库是否连同实体删除：建议先仅移出“我的词库”，保留在“可添加”中，另设永久删除能力后再处理。

响应返回清理数量：

```json
{ "libraryId": "lib_frontend", "clearedProgressCount": 12 }
```

#### `GET /word-libraries/{libraryId}`

返回名称、说明、类型、词数、是否已拥有等概要。

#### `GET /word-libraries/{libraryId}/words`

支持 `cursor`、`size`。单词结构：

```json
{
  "id": "w_1",
  "word": "framework",
  "ipa": "/ˈfreɪmwɜːrk/",
  "meaning": "框架",
  "audioUrl": "...",
  "order": 1,
  "learned": false
}
```

“去学习”进入单词拼读页时，可传 `libraryId`，阶段内容接口按词库创建学习 session。

### 6.7 AI 定制词库

#### `POST /word-libraries/custom-jobs`

创建异步解析任务，成功返回 HTTP 202。

```json
{
  "name": "我的产品词库",
  "wordsText": "deploy, repository, dependency, framework"
}
```

响应：

```json
{
  "jobId": "job_101",
  "status": "PENDING",
  "submittedWordCount": 4
}
```

限制建议：名称 2～40 字；一次 1～200 个词；支持中英文逗号、空格和换行；后端负责 trim、转小写去重和合法性校验。

#### `GET /word-libraries/custom-jobs/{jobId}`

轮询请求不展示全局 Loading。

```json
{
  "jobId": "job_101",
  "status": "SUCCEEDED",
  "progress": 100,
  "result": {
    "libraryId": "lib_ai_101",
    "name": "我的产品词库",
    "wordCount": 4,
    "invalidWords": []
  },
  "error": null
}
```

解析成功后词库进入“可添加词库”，不自动加入“我的词库”。失败时保留可读原因，并允许：

#### `POST /word-libraries/custom-jobs/{jobId}/retry`

只允许失败任务重试，并复用原始清洗后的输入。

未来文件上传是后续功能，本期不设计上传文件入口。

### 6.8 AI 发音评测

#### `POST /evaluations`

`multipart/form-data`：

- `wordId`：目标词 ID。
- `audio`：录音文件。
- `durationMs`：客户端录音时长。
- `sessionId`：当前学习 session。
- `clientRequestId`：客户端生成的唯一请求 ID，也可同时放入 `Idempotency-Key`。

成功返回 HTTP 202：

```json
{
  "evaluationId": "eval_101",
  "status": "PENDING"
}
```

服务端校验建议：最多 5 秒、最多 2 MB、允许格式白名单、检查真实媒体头、转为供应商要求的 16 kHz/16 bit/单声道格式。

#### `GET /evaluations/{evaluationId}`

```json
{
  "id": "eval_101",
  "status": "SUCCEEDED",
  "word": "development",
  "scores": {
    "overall": 82,
    "accuracy": 80,
    "fluency": 86,
    "integrity": 100,
    "stress": 72
  },
  "analysis": {
    "summary": "整体清晰，重音位置需要更突出。",
    "detectedIpa": "/dɪˈveləpmənt/",
    "issues": [
      {
        "target": "/ˈve/",
        "detected": "/ve/",
        "type": "STRESS",
        "message": "第二音节重音不够明显"
      }
    ],
    "suggestions": ["第二音节稍微拉长并提高响度", "先分节慢读，再连起来"],
    "encouragement": "已经很接近标准发音，再强化重音即可。"
  },
  "createdAt": "2026-09-13T10:20:30+08:00"
}
```

失败返回业务状态而非把轮询请求直接变为 500：

```json
{
  "id": "eval_101",
  "status": "FAILED",
  "error": { "code": "EVALUATION_PROVIDER_UNAVAILABLE", "message": "评测服务暂时繁忙，请稍后重试" }
}
```

前端建议每 1 秒轮询，持续约 30 秒后停止并允许用户手动重试。服务端必须缓存结果，查询接口不能再次调用收费服务。

#### `GET /evaluations?cursor=&size=&wordId=`

历史记录为后续能力。当前页面不展示“上次评测”，但保留接口便于个人统计和未来回顾。

## 7. 后端内部功能与外部 API

### 7.1 微信登录适配器

内部接口建议：

```java
public interface WechatAuthGateway {
    WechatSession exchangeCode(String code);
}
```

职责：调用微信 `code2Session`、处理供应商错误、建立/查找用户、签发本系统 token。外部返回结构不得直接泄漏到 Controller。

### 7.2 对象存储与媒体资源

内部接口建议：

```java
public interface ObjectStorageGateway {
    StoredObject put(InputStream input, MediaMetadata metadata);
    URI createReadUrl(String objectKey, Duration ttl);
    void delete(String objectKey);
}
```

MVP 推荐录音先传 Java 后端，再由后端上传腾讯云 COS，能减少 UniApp X 多端上传和临时凭证逻辑。量增大后可改为客户端使用受限临时密钥直传 COS；临时密钥必须由服务端签发并限制目录、操作和有效期。

媒体表保存 `objectKey`，数据库不要长期保存易过期的签名 URL。标准发音音频可以公开 CDN；用户录音必须私有。

### 7.3 腾讯云口语评测

采用腾讯云“智聆口语评测（新版）SOE-N”，不要基于旧版接口新增实现。内部隔离为：

```java
public interface OralEvaluationGateway {
    ProviderEvaluation evaluate(EvaluationRequest request);
}
```

后端流程：

1. 接收并校验录音，计算 SHA-256 去重。
2. 保存私有对象存储，并创建 `PENDING` 评测记录。
3. 异步 Worker 将音频转为供应商支持格式。
4. 调用 SOE-N，传入目标文本、语言和评测模式。
5. 保存原始响应（加密/受限访问）及规范化评分、音素结果。
6. 将规范化结果交给教学建议服务。
7. 更新为 `SUCCEEDED`；可重试错误按退避策略处理，永久错误标记 `FAILED`。

腾讯官方资料：

- [智聆口语评测（新版）产品文档](https://cloud.tencent.com/document/product/1774)
- [新版 API 文档](https://cloud.tencent.com/document/product/1774/107497)
- [Java SDK 使用说明](https://cloud.tencent.com/document/product/1774/107361)
- [快速入门](https://cloud.tencent.com/document/product/1774/107347)

官方新版实时接口支持中英文及 16 kHz、16 bit 单声道的多种音频格式，并能返回准确度、流利度、完整度、重音及音素粒度结果。具体评测模式和计费额度应在开发前用真实账号验证。

### 7.4 大模型教学建议

大模型不负责替代口语评测服务打分，而是把“目标词、标准音标、腾讯云结构化得分和音素错误”转换为用户易懂的中文建议。

```java
public interface AiTeachingAdviceGateway {
    TeachingAdvice createAdvice(AdviceContext context);
}
```

输入建议：

- 目标单词、标准 IPA、重音/音节信息。
- 规范化分数。
- 错误音素、漏读、多读、重音和流利度问题。
- 用户当前发音偏好。

要求大模型严格输出 JSON Schema：`summary`、`issues[]`、`suggestions[]`、`encouragement`。解析失败最多重试一次；仍失败则使用规则模板生成建议，不能让整次评测失败。不要把用户原始录音发给大模型，除非未来明确选择支持音频的模型并取得用户授权。

### 7.5 单词与音标内容补全

内部能力建议拆分：

```java
public interface DictionaryGateway {
    Optional<DictionaryEntry> find(String normalizedWord, Accent accent);
}

public interface IpaConverter {
    Optional<String> convert(String word, Accent accent);
}

public interface PronunciationAudioProvider {
    Optional<AudioSource> find(String word, Accent accent);
}
```

AI 定制词库解析优先使用已授权词典数据或自有词库：

1. 规范化和去重。
2. 查询本地 `words` 表。
3. 缺失时调用合规词典/音标转换服务。
4. 生成或获取标准音频并落 COS。
5. 大模型只补充中文释义、领域标签和特殊拆读提示，不作为标准 IPA 的唯一事实来源。
6. 单个词失败不应使整个词库失败；返回 `invalidWords`。

不要直接抓取未确认授权的在线词典或有道音频地址。第三方数据许可必须在接入前确认。

### 7.6 异步任务

MVP 可使用数据库任务表 + Spring Scheduler/受控线程池；部署为多实例或任务量增大后再接入消息队列。需要的任务类型：

- `CUSTOM_LIBRARY_PARSE`
- `PRONUNCIATION_EVALUATION`
- `MEDIA_TRANSCODE`
- `AUDIO_ENRICHMENT`

任务必须有状态、重试次数、下次执行时间、幂等业务键和最后错误。不能只放在内存队列，否则重启会丢任务。

## 8. Java 后端建议架构

### 8.1 技术栈

- Java 21、Spring Boot 3.x。
- Spring Web、Validation、Security、OAuth/JWT 支持。
- MySQL 8；Flyway 管理数据库迁移。
- MyBatis-Plus、MyBatis 或 Spring Data JPA 三选一，项目内保持统一。
- Redis 可选：缓存、幂等键、限流、短期令牌状态；MVP 也可先由数据库承担。
- springdoc-openapi 输出 OpenAPI 3 文档。
- Testcontainers + MySQL 做关键集成测试。
- Micrometer + 结构化日志记录指标与链路信息。

### 8.2 模块边界

```text
com.yongqing.pronunciation
├─ auth                 登录、Token、微信适配
├─ user                 用户、偏好、统计
├─ home                 首页聚合应用服务
├─ learningflow         模板、用户流程、推进规则
├─ learningcontent      课程单元与类型化内容
│  ├─ phoneme
│  ├─ syllable
│  └─ decoding
├─ quiz                 题目、选项、答题记录
├─ word                  单词、音标、拆读映射
├─ library               系统/个人词库与解析任务
├─ evaluation            录音评测、评分和教学建议
├─ media                 音频元数据、对象存储、转码
├─ integration
│  ├─ wechat
│  ├─ tencentsoe
│  ├─ tencentcos
│  ├─ dictionary
│  └─ llm
└─ common                响应、异常、鉴权、幂等、审计
```

每个模块建议按 `controller/application/domain/infrastructure` 分层。Controller 只处理协议和校验；业务事务放 Application Service；第三方 SDK 只能出现在 integration/infrastructure 层。

### 8.3 配置环境变量

```text
SPRING_PROFILES_ACTIVE
DB_URL / DB_USERNAME / DB_PASSWORD
JWT_ACCESS_SECRET / JWT_ACCESS_TTL / JWT_REFRESH_TTL
WECHAT_APP_ID / WECHAT_APP_SECRET
TENCENT_SECRET_ID / TENCENT_SECRET_KEY / TENCENT_REGION
TENCENT_SOE_APP_ID
COS_BUCKET / COS_REGION / COS_PUBLIC_BASE_URL
LLM_BASE_URL / LLM_API_KEY / LLM_MODEL
AUDIO_RETENTION_DAYS
```

仓库只提交 `.env.example` 或配置模板，不提交真实密钥。生产环境使用密钥管理服务和最小权限子账号。

## 9. 建议数据模型

以下为逻辑表，不强制具体字段命名；所有表包含必要的 `created_at`、`updated_at`，用户数据按需支持软删除。

| 表 | 关键字段 | 说明 |
| --- | --- | --- |
| `users` | id, wechat_openid, unionid, nickname, avatar_url, accent | 用户；openid 唯一 |
| `refresh_tokens` | id, user_id, token_hash, expires_at, revoked_at | 刷新令牌轮换 |
| `feature_templates` | code, name, route, enabled, repeatable, sort | 可拖拽功能模板 |
| `learning_flow_configs` | id, user_id, version, active | 用户当前配置 |
| `learning_flow_nodes` | id, config_id, template_code, position | 节点实例；允许模板重复 |
| `learning_flow_runs` | id, user_id, config_version, current_position, status | 一次流程运行 |
| `learning_flow_run_nodes` | id, run_id, source_node_id, template_code, position, status | 保存运行快照，防止改配置破坏历史 |
| `learning_units` | id, template_code, content_type, title, content_json, sort, enabled | 类型化课程内容；MVP 可 JSON，稳定后拆表 |
| `user_unit_progress` | user_id, run_node_id, unit_id, status, attempts | 单元进度，唯一约束三者组合 |
| `phonemes` | id, ipa, group_code, category, mouth_type, audio_asset_id | 音标基础数据 |
| `phoneme_examples` | phoneme_id, word_id, sort | 音标例词 |
| `phoneme_comparisons` | id, title, description, content_json | 易混对比配置 |
| `quiz_questions` | id, template_code, unit_id, type, prompt, explanation | 题目 |
| `quiz_options` | id, question_id, label, correct, sort | 选项；正确性绝不在出题响应暴露 |
| `quiz_submissions` | id, user_id, question_id, selected_option_id, correct | 答题记录 |
| `words` | id, normalized_word, display_word, meaning, accent | 单词主数据 |
| `word_pronunciations` | word_id, ipa, syllables_json, stress_json, audio_asset_id | 发音数据 |
| `word_decodings` | word_id, parts_json, common_tips_json, special_tips_json | 字母与音标拆读映射 |
| `word_libraries` | id, owner_user_id, type, name, description, status | 系统或个人词库 |
| `word_library_items` | library_id, word_id, sort | 词库单词 |
| `user_word_libraries` | user_id, library_id, added_at | 我的词库 |
| `user_word_progress` | user_id, library_id, word_id, status, attempts | 删除词库时定向清理 |
| `custom_library_jobs` | id, user_id, name, input_json, status, progress, error | AI 词库异步解析 |
| `media_assets` | id, owner_user_id, kind, object_key, mime, duration_ms, privacy | 标准音频与私有录音 |
| `evaluation_records` | id, user_id, word_id, media_id, status, scores_json, provider_json | 评测主记录 |
| `evaluation_advice` | evaluation_id, summary, issues_json, suggestions_json, model | AI建议及模型版本 |
| `async_jobs` | id, type, business_key, status, attempts, next_run_at, payload | 可恢复异步任务 |
| `idempotency_records` | user_id, scope, idem_key, response_json, expires_at | 关键写操作去重 |

关键约束：

- `learning_flow_nodes(config_id, position)` 唯一。
- `user_word_libraries(user_id, library_id)` 唯一。
- `quiz_submissions` 是否允许多次需按产品统计口径确定；建议保留每次尝试。
- 基础词库可以通过注册事务默认加入，也可以在查询时自动补齐，但全系统只能选一种策略。
- `content_json` 是早期快速迭代方案；查询高频、需运营检索的字段应逐步结构化，而不是永久把全部内容塞进 JSON。

## 10. 关键业务流程

### 10.1 新用户初始化

在一个事务中：创建用户 → 加入基础词库 → 创建默认学习流程配置 → 创建首个流程运行 → 返回 token。重复微信登录不能重复创建。

### 10.2 保存学习流程

校验版本和节点 → 锁定当前配置 → 旧配置保留历史 → 建立新版本与节点 → 创建新的流程运行快照 → 当前节点设为 0 → 提交事务。历史 `user_unit_progress` 和 `evaluation_records` 不删除。

### 10.3 完成当前阶段

读取活动 run 并锁定 → 校验 `flowNodeId` → 校验是否满足最低完成条件 → 幂等写入节点完成 → 推进 `current_position` → 返回下一节点或完成状态。两个并发请求只能推进一次。

### 10.4 AI 词库解析

创建任务 → 清洗/去重 → 批量查询本地单词 → 补充缺失词典数据 → 生成拆读与特殊提示 → 获取或生成音频 → 部分失败汇总 → 创建 `AI_CUSTOM` 词库 → 任务成功。词库此时只出现在可添加列表。

### 10.5 录音评测

上传校验 → 私有存储 → 创建评测任务 → 调腾讯云 SOE-N → 规范化分数 → 调大模型生成简短建议 → 保存结果 → 前端轮询读取。第三方暂时故障采用指数退避；无效音频不重试。

## 11. 错误码建议

| HTTP | code | 场景 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 字段缺失、格式错误 |
| 401 | `AUTH_TOKEN_INVALID` | Token 无效或过期 |
| 401 | `WECHAT_LOGIN_FAILED` | 微信 code 无效 |
| 403 | `RESOURCE_FORBIDDEN` | 无权访问他人资源 |
| 404 | `RESOURCE_NOT_FOUND` | 页面所需资源不存在 |
| 409 | `FLOW_VERSION_CONFLICT` | 流程被其他设备修改 |
| 409 | `FLOW_NODE_MISMATCH` | 完成的不是当前节点 |
| 400 | `FLOW_EMPTY` | 保存空流程 |
| 400 | `LIBRARY_BASE_NOT_REMOVABLE` | 删除基础词库 |
| 409 | `LIBRARY_ALREADY_ADDED` | 重复添加；也可幂等成功 |
| 400 | `CUSTOM_LIBRARY_WORDS_INVALID` | 无有效单词 |
| 429 | `CUSTOM_LIBRARY_LIMIT_EXCEEDED` | 数量或频率超限 |
| 400 | `EVALUATION_AUDIO_INVALID` | 音频格式/时长不合格 |
| 503 | `EVALUATION_PROVIDER_UNAVAILABLE` | 腾讯评测暂时不可用 |
| 500 | `AI_ADVICE_FAILED` | 建议生成失败；正常应走模板降级而非暴露 |

错误 `message` 给用户阅读，日志记录供应商原始错误和 `requestId`，但不能返回密钥、堆栈或隐私数据。

## 12. 安全、隐私与运维

- 腾讯云、微信、大模型密钥仅存在服务端，使用最小权限子账号。
- 登录、AI 词库和评测接口按用户/IP 限流，防止刷接口和产生不可控费用。
- 用户录音默认私有；建议保留 7 天后自动删除，可通过 `AUDIO_RETENTION_DAYS` 配置。
- 评测结构化结果可长期保留用于学习记录；原始供应商响应限制内部访问。
- 日志禁止记录 access token、refresh token、微信 session key、完整录音地址和大模型密钥。
- 上传做 MIME 白名单、文件头检测、大小/时长限制，不信任文件扩展名。
- 关键写操作记录用户、资源、结果和 requestId，便于排查重复推进或误删词库。
- 数据库每日备份；流程配置、评测记录和词库任务需要可恢复。
- 外部调用记录耗时、成功率、错误类型和费用相关用量，但不记录敏感输入。

腾讯云 COS 临时访问安全参考：[使用临时密钥访问 COS](https://cloud.tencent.com/document/product/436/109014)。若未来改为客户端直传，服务端必须生成随机对象键并将临时权限限制在指定目录和操作范围内。

## 13. 前端接入替换清单

后端完成后，前端按以下顺序替换 Mock，页面组件本身不应重写：

1. 保留 `client/src/services/http.uts` 的统一 Token、Loading 和异常处理。
2. 将学习流程 Mock 服务替换为 `/learning-flow/templates`、`/learning-flow` 和完成接口。
3. 首页改用 `/home`，今日学习和学习路径完全由活动流程返回。
4. 各学习页用统一阶段 session 替换页面内数组；上一步/下一步只切换 session 单元。
5. 听音辨认和音素音节正确答案改为提交后返回，页面初始数据不再包含答案。
6. 词库 Store 替换为我的词库、可添加词库、批量添加、删除和解析任务接口。
7. AI评测上传真实录音并轮询结果；前端的 4 秒录音交互保留。
8. 用户页接入资料、统计和偏好接口。
9. 移除业务数据的本地持久化 Mock；本地仅保留 token、必要的 UI 偏好和可安全恢复的临时草稿。

## 14. 实施阶段建议

### 第一阶段：可完整联调

- Spring Boot 工程、统一响应、异常、JWT、数据库迁移。
- 开发环境临时登录 + 微信登录接口外壳。
- 用户、学习流程、首页聚合。
- 课程内容、音标总览、答题与进度。
- 词库查看、添加、删除。
- OpenAPI 和核心集成测试。

### 第二阶段：异步能力

- AI 定制词库任务。
- COS 私有录音。
- 腾讯云 SOE-N 评测。
- 大模型建议和规则降级。
- 任务重试、限流和指标。

### 第三阶段：生产化

- 微信小程序真实环境联调。
- 内容管理/导入工具。
- 隐私政策、录音删除任务、审计和备份。
- 压测、告警、费用限额和灰度发布。

## 15. 验收标准

- 新用户首次登录自动拥有基础词库和默认学习流程。
- 首页当前任务随用户流程和完成位置动态变化，无固定页面跳转。
- 相同模板重复加入流程后，每个节点拥有独立 ID 和进度。
- 修改流程后从新流程第一步开始，但历史学习、词库和评测记录仍存在。
- 阶段完成接口重复调用不会跨过两个节点。
- 回顾已完成节点不会推进正式流程。
- 题目详情不泄漏正确答案，提交后能同时指出错误项与正确项。
- 基础词库不可删除；删除其他词库只清理该用户该词库的学习记录。
- AI 词库解析成功后先出现在“可添加词库”，添加后才出现在“我的词库”。
- 评测接口接受有效短录音、异步返回评分与建议；供应商异常有可重试状态。
- 所有私有接口验证资源所属用户；所有错误符合统一响应格式。
- OpenAPI 可生成客户端所需字段说明，关键业务拥有单元测试和数据库集成测试。

## 16. 后端开发前仍需确认的事项

以下不妨碍搭建主架构，但进入生产前必须确定：

1. 微信小程序 AppId、主体及登录授权范围。
2. 腾讯云 SOE-N 账号、区域、评测模式、配额与计费预算。
3. 标准音标、中文释义和发音音频的数据来源及商业许可。
4. 初始课程内容由 SQL/Flyway 种子导入、JSON 导入，还是建设后台管理。
5. 大模型供应商、模型、数据保留政策和调用预算。
6. 用户录音保留期限及隐私授权文案。
7. “完成一个阶段”的最低条件：浏览到末项即可，还是必须完成全部练习。
8. 单词拼读从专业词库进入时，是沿用主流程进度，还是创建独立词库学习 session。建议独立 session，不推进主流程。

## 17. 给后端开发会话的执行要求

后端实现时请遵循以下原则：

- 先输出模块和数据库迁移计划，再按“认证与公共层 → 学习流程 → 内容与进度 → 词库 → 评测”逐步实现。
- 当前前端字段和本文契约发生冲突时，先指出差异，不要静默改变产品规则。
- 每完成一个模块同步维护 OpenAPI、Flyway、自动化测试和 `.env.example`。
- 外部供应商全部通过 Gateway 接口隔离，并提供本地 Fake 实现，使没有腾讯云/大模型密钥时仍能完成前后端联调。
- 不把正确答案、腾讯云密钥、微信 session key 或私有 COS 地址暴露给客户端。
- 不使用内存变量保存用户流程、异步任务和评测状态；服务重启后业务必须可恢复。
- 优先实现清晰、直接的 MVP，不提前引入微服务；单体模块化 Spring Boot 足够支撑当前阶段。

