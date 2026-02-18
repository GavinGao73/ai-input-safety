
# PDF Pipeline – Known Issues & Non-Bugs

> 目的：
> 记录 **已经验证不是代码缺陷** 的问题，避免未来重复排查与误判。

---

## ✅ GitHub Pages 相关

### 1️⃣ 目录访问 404 是正常现象

**现象**

访问：

```
/pdfjs/3.11.174/cmaps/
/pdfjs/3.11.174/standard_fonts/
```

浏览器显示 404。

**原因**

GitHub Pages 默认 **禁止目录列表（directory listing）**。
这 **不代表文件不存在**。

**验证方式**

直接访问具体文件：

```
/pdfjs/3.11.174/cmaps/UniGB-UCS2-H.bcmap
/pdfjs/3.11.174/standard_fonts/LiberationSans-Regular.ttf
```

能下载 = 正常。

**结论**

✔ 不是部署错误
✔ 不是路径错误
✔ 不需要修复

---

### 2️⃣ 路径大小写敏感（非常常见）

GitHub Pages = Linux 文件系统规则：

```
pdf.worker.min.js ≠ PDF.Worker.Min.js
cmaps ≠ CMaps
```

大小写不一致 → 必然 404。

---

### 3️⃣ 仓库名必须包含在 URL 中

项目页地址结构：

```
https://<user>.github.io/<repo-name>/...
```

漏掉 `<repo-name>` → 全部资源 404。

---

### 4️⃣ Pages 缓存延迟

更新文件后旧资源仍加载：

✔ 强制刷新（Ctrl + F5）
✔ 等待 CDN 缓存同步

---

## ✅ PDF.js 相关

---

### 5️⃣ STSongStd-Light Warning 可忽略

**典型日志**

```
Warning: Cannot load system font: STSongStd-Light
```

**原因**

PDF.js 尝试使用系统字体但浏览器环境不可用。

**影响**

✔ 不影响 text layer
✔ 不影响渲染正确性（已有 CMap / 标准字体时）

**结论**

无需处理。

---

### 6️⃣ Fake Worker Warning

**典型日志**

```
Warning: Setting up fake worker
```

**原因**

workerSrc 未正确加载（路径 / 跨域）。

**关键事实**

Fake worker = 性能问题，**不是功能错误**。

**最佳实践**

始终使用 **同源 worker**：

```js
pdfjsLib.GlobalWorkerOptions.workerSrc = BASE + "pdf.worker.min.js";
```

---

### 7️⃣ Scanned PDF 没有 textContent（不是 bug）

**现象**

```
page.getTextContent() → items = []
```

**原因**

扫描 PDF = 纯图片，无 text layer。

**结论**

✔ PDF 本身特性
✔ 任何规则 / regex 都不会生效

---

### 8️⃣ PDF.js 字宽不可靠（设计限制）

PDF 内部没有稳定“字符宽度”概念：

✔ 表格类 PDF 偏差最大
✔ 中文 PDF 偏差更明显
✔ 不同字体误差不同

**后果**

遮盖框轻微偏移 = 正常现象。

---

### 9️⃣ getPathGenerator Warnings 可忽略

**典型日志**

```
getPathGenerator - ignoring character ...
Requesting object that isn't resolved yet
```

**原因**

字体路径 / glyph 数据延迟解析。

**影响**

✔ 不影响 textContent
✔ 通常不影响最终位图

---

## ✅ cmaps / standard_fonts 相关

---

### 🔟 不能创建空文件夹

空目录不会触发 PDF.js 正常工作：

✔ 必须包含真实 bcmap / ttf / pfb 文件

---

### 1️⃣1️⃣ `.bcmap` 文件无法用记事本打开是正常的

bcmap = 二进制压缩格式。

✔ 不可读 ≠ 文件损坏
✔ 能被 PDF.js 使用即可

---

### 1️⃣2️⃣ cMapPacked 必须为 true

使用官方 bcmap 数据时：

```js
cMapPacked: true
```

改为 false → 字体映射失效 / 中文乱码。

---

## ✅ 参数相关（常见误改点）

---

### 1️⃣3️⃣ disableFontFace = true 是刻意设计

目的：

✔ 避免浏览器字体加载差异
✔ 避免跨域字体问题
✔ 提高一致性

不是“功能受限”。

---

### 1️⃣4️⃣ DPI 与 scale 关系不是 bug

PDF 基准单位：

```
1 inch = 72 PDF points
```

换算：

```js
scale = dpi / 72
```

视觉尺寸变化 = 数学结果。

---

### 1️⃣5️⃣ worker / cmaps / fonts 必须同源（稳定性关键）

跨域资源经常被：

✔ CORS 拦截
✔ CSP 拦截
✔ 浏览器策略限制

同源始终最稳。

---

## ✅ 红删 / 遮盖相关

---

### 1️⃣6️⃣ 遮盖轻微偏移是 PDF 结构问题

不是规则错误，常见来源：

✔ 字宽估算
✔ transform matrix 精度
✔ 字体差异
✔ 表格布局

只能 **通过护栏 / padding 调优**，无法完全消除。

---

### 1️⃣7️⃣ “部分命中失败”常见原因

✔ 文本被拆分成多个 text item
✔ PDF 内部换行 / kerning
✔ 字体编码异常

并非 regex 失败。

---

---

# ✅ 总体原则

遇到问题优先判断：

1️⃣ 是 PDF 文件特性？
2️⃣ 是 GitHub Pages 行为？
3️⃣ 是 PDF.js 已知限制？

**不要默认是代码 bug。**

---

**最后更新**：2026-02
**适用版本**：PDF.js 3.11.174

---

