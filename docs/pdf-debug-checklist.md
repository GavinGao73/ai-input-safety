# PDF Debug Checklist

Raster / PDF.js / Redaction Pipeline 故障排查清单

> 目的：快速定位问题属于 **资源路径 / 字体 / PDF.js / 文档类型 / 覆盖逻辑 / CMap / Worker / Canvas** 中的哪一类。
> 使用方式：按顺序检查，避免同时改多处导致误判。

---

## ① 先判断 PDF 类型（这是最高优先级）

### ✅ 可搜索 / 可选中文本 PDF（Text-based PDF）

特征：

* 可以鼠标选中文字
* `getTextContent()` 返回 items
* 通常体积较小
* 规则匹配 / 精确遮盖可用

验证方式：

```js
const text = await page.getTextContent();
console.log(text.items.length);
```

✔ 大于 0 → 文本 PDF
❌ 等于 0 → 扫描 / 图片 PDF

---

### ❌ 扫描 PDF / 图片 PDF（Image-based PDF）

特征：

* 无法选中文字
* getTextContent() 几乎为空
* 必须使用视觉坐标规则

👉 结论：

* 文字规则失效是**正常现象**
* 不属于 bug

---

## ② 资源路径检查（GitHub Pages 最常见问题）

### 必须能单独访问这些 URL：

```
/pdfjs/<version>/pdf.min.js
/pdfjs/<version>/pdf.worker.min.js
/pdfjs/<version>/cmaps/UniGB-UCS2-H.bcmap
/pdfjs/<version>/standard_fonts/STSongStd-Light.ttf
```

验证原则：

✔ 直接浏览器打开
✔ 返回 200
❌ 404 = 路径问题，不是代码问题

---

### ⚠ GitHub Pages 特殊规则

项目页不是根路径：

```
https://用户名.github.io/仓库名/
```

因此正确基准必须是：

```js
new URL("./pdfjs/3.11.174/", window.location.href)
```

而不是：

```js
"/pdfjs/3.11.174/"
```

---

## ③ Worker 故障（隐性渲染异常核心来源）

症状：

* 控制台出现 fake worker
* 渲染慢 / 字体错乱 / 丢字

检查：

```js
pdfjsLib.GlobalWorkerOptions.workerSrc
```

必须指向：

✔ 同源 worker
❌ CDN worker（容易被跨域限制）

---

## ④ 字体问题（中文 PDF 高发）

典型警告：

```
Warning: Cannot load system font: STSongStd-Light
```

解释：

✔ 不影响逻辑
✔ 只影响字形精度 / 边界盒估算

只有当出现：

* 丢字
* 字宽异常
* 表格文字消失

才需要处理。

---

## ⑤ CMap 问题（比字体更关键）

严重症状：

* 中文完全不显示
* 大量 `getPathGenerator` 警告
* 文本层存在但画布无字

检查：

```
cMapUrl 是否可访问
bcmap 文件是否真实存在
cMapPacked 是否匹配资源
```

标准写法：

```js
cMapUrl: BASE + "cmaps/",
cMapPacked: true
```

---

## ⑥ disableFontFace 的影响（经常误改）

| 设置    | 影响             |
| ----- | -------------- |
| true  | 使用路径字形，稳定、安全   |
| false | 依赖浏览器字体，容易跨域异常 |

策略建议：

✔ 保持 true（生产环境更稳）

---

## ⑦ Canvas 渲染异常

症状：

* 页面空白
* 文字偏移
* 比例错误

检查 DPI 与 scale：

```js
const scale = dpi / 72;
page.getViewport({ scale });
```

错误 DPI 会直接导致遮盖错位。

---

## ⑧ 遮盖框错位（常见真实原因）

优先排查顺序：

1️⃣ viewport transform 是否正确
2️⃣ bbox 高度是否被字体影响
3️⃣ padding 是否过大
4️⃣ 是否误触发行合并逻辑

**绝大多数不是规则错，而是宽度估算问题。**

---

## ⑨ 表格类 PDF 特殊性

PDF.js 中：

* 单元格文本常被拆分为多个 items
* 宽度字段极不稳定
* 必须限制 max width（护栏）

典型修复方向：

✔ key-aware padding
✔ width clamp
✔ same-line merge 限制

---

## ⑩ 如果问题“看似随机”

通常属于：

✔ 字体 fallback 差异
✔ PDF 内嵌字体差异
✔ 浏览器差异
✔ worker 加载时序

**不是算法随机性。**

---

## ⑪ 严禁的调试方式（会制造幻觉）

❌ 同时修改 DPI + padding + regex
❌ 同时切换 CDN / 本地资源
❌ 用不同 PDF 混合验证

必须：

✔ 固定变量 → 单点验证

---

## ⑫ 最小化隔离测试法（推荐）

始终保留一个：

✔ 极小 PDF
✔ 单页
✔ 单一规则命中

作为基准验证文件。

---

## ⑬ 判断优先级原则

当多个问题同时出现：

**始终优先检查：**

① 资源路径
② Worker
③ CMap
④ 字体
⑤ 规则逻辑

顺序不可颠倒。

---

## ⑭ 一句话经验法则

> **PDF 显示异常，90% 不是规则错，而是资源 / 字体 / CMap / Worker。**

---

## ⑮ 本项目调试黄金流程

✔ 先确保 PDF.js 渲染完全正确
✔ 再验证 textContent
✔ 再验证匹配
✔ 最后调整遮盖框

**绝不反向调试。**

---

**END OF CHECKLIST**

---
