# 声芽登录页

- 首次进入未登录时显示独立登录页；已有登录凭证时进入首页，由现有请求层处理凭证刷新。
- 微信小程序复用 `uni.login` 和现有后端登录接口，失败在页面显示提示，可以重试。
- 网页及其他平台仅预留禁用的用户名、密码输入区域，未接入账号密码认证。
- 目前使用可阅读的登录说明，不冒用尚未提供的用户协议、隐私政策链接。
- “声”保持标准字形，“芽”叠加绿色嫩芽装饰；文字、登录按钮均为真实组件。

## 插画来源

使用内置 image_gen 生成书本插画，参考已确认的浅蓝登录页设计。
项目素材：`client/static/images/login-book.png`。
标识、嫩芽及微信图标为本地 SVG。

生成提示原文：

```text
Generate a project UI illustration asset using the referenced login design ONLY for the book illustration art direction. Output wide landscape illustration, approximately 3:2 composition. ONLY an open white book resting near lower center, delicate flowing icy blue and mint sound-wave ribbons arching gently above book, two or three restrained floating phonetic glyphs /æ/ and /iː/ as illustration accents. Background uniformly extremely pale icy blue #F1F8FF, softly fades at every edge into that exact pale blue so this image can blend into same solid UI background. Book visible in entirety, horizontal at bottom, fine paper pages, soft blue understated shadows, airy translucent ribbons; preserve original reference's soft book style but reduce shine and decorative clutter. No text except small phonetic glyphs, no Chinese characters, no logo, no branding, no buttons, no interface, no phone, no status bar, no photography scenery, no plants. Entire book and ribbons fully inside canvas with generous side margin. This is a reusable hero illustration only, NOT a full screen or mockup. Finely art-directed blue-white educational illustration, restrained luminous pastel colors.
```

## 本地验证

```powershell
cd D:\works\trae\read-english\client
npm run lint
node --experimental-vm-modules --test --test-isolation=none scripts/test-login.mjs scripts/test-http.mjs
```

微信生产产物位于 `client/unpackage/dist/build/mp-weixin`。实际微信身份登录仍需要在微信开发者工具或手机上完成；单元测试不会访问微信或创建线上用户。
