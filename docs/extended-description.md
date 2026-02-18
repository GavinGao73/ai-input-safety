# Extended Description（扩展说明 · 中文版）

本文件不是用户说明书，而是用于**工程背景、产品策略与技术约束记录**。

目标读者：

- 项目维护者（未来的你）
- 协作者 / 开发人员
- 技术排错 / 架构回顾场景

---

## 一、项目定位（Project Positioning）

本项目的核心目标：

> 在**不改变文档可读性**的前提下，实现对敏感信息的可靠遮盖（redaction）。

系统不是：

❌ OCR 工具  
❌ PDF 编辑器  
❌ 文档结构重建系统  

系统是：

✅ **视觉安全管线（Visual Security Pipeline）**  
✅ **AI 输入前处理工具（AI Input Safety Layer）**  

---

## 二、核心产品哲学（Product Philosophy）

设计原则：

1. **可读性优先（Readability First）**  
   输出文档必须保持对人类与 AI 可理解。

2. **最小破坏原则（Minimal Destruction）**  
   仅覆盖敏感值（values），绝不删除上下文语义。

3. **不可逆原则（Irreversibility）**  
   Raster Secure PDF 不允许恢复文本层（text layer）。

4. **静默安全原则（Silent Security）**  
   不写入日志（logs）、不持久化（storage）、不留痕迹。

---

## 三、PDF 处理模型（PDF Processing Model）

系统采用双路径策略：

### ① Readable PDF 路径

输入：PDF  
处理：

- 使用 PDF.js 解析 textContent
- 通过规则引擎匹配敏感片段
- 生成覆盖矩形（rectangles）

输出：

- 保留文本层（text layer）
- 视觉遮盖（black redaction）

适用场景：

✅ AI 上传  
✅ 人工阅读  
✅ 审查 / 合规  

---

### ② Raster Secure PDF 路径

输入：PDF / Image  
处理：

- 600 DPI rasterization
- 像素级遮盖（pixel redaction）
- 重新封装为 image-only PDF

输出：

- 无 text layer
- 不可复制 / 不可检索 / 不可提取文本

适用场景：

✅ 高安全共享  
✅ 法律文档  
✅ 对外分发  

---

## 四、为何使用 PDF.js（Why PDF.js）

PDF.js 提供：

- textContent.items（文本定位能力）
- transform matrix（坐标变换）
- viewport scaling（DPI 控制）

关键原因：

✅ 浏览器内运行（client-side only）  
✅ 不依赖服务器  
✅ 可精确获得字符边界近似区域  

---

## 五、字体与 CMap 机制（Fonts & CMaps）

PDF.js 渲染依赖：

- Standard Fonts（LiberationSans / Foxit 等）
- Character Maps（CMaps）
- CID 字体映射

如果缺失：

可能出现：

- 字符不显示
- 表格内容丢失
- fake worker 启用
- getPathGenerator warnings

工程约束：

> 所有字体与 CMaps 必须 same-origin 部署。

---

## 六、同源部署原则（Same-Origin Rule）

GitHub Pages 项目站点路径结构：

