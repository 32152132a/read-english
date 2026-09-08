# UniApp X CSS 兼容性待办

当前页面优先面向 H5 和小程序。若增加原生 App 目标，需要逐项处理以下兼容性问题。

- Grid：原生 App 仅可靠支持 Flex 和绝对定位，需要评估现有 Grid 布局并按组件迁移。
- 动画：`PlayButton` 使用 CSS `@keyframes`，原生 App 需要改为 UniApp X 支持的动画方式。
- 伪元素：`TodayLessonCard` 使用 `button::after`，原生 App 需要改为 class 或真实节点样式。
- 安全区：`BottomNav` 使用 `calc()` 和 `env()`，需要在各目标端验证并按平台处理。
- 尺寸计算：`DebugPageNav` 和 `TodayLessonCard` 使用 `calc()`，需要验证原生 App 兼容性。
- 样式继承：原生 App 的父子组件样式隔离，文字颜色和字号不能依赖跨组件继承。

处理原则：先确认目标平台和最低 HBuilderX 版本，再逐个组件修改并进行真机验证。
