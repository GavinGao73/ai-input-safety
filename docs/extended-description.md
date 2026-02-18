很好，这一步是**非常正确的工程决策**，而且能明显降低你以后维护成本。

我直接给你**可粘贴进仓库的完整版本**，采用下面的规则：

✅ 中文为主（便于长期维护）
✅ 所有技术对象保留英文原词（避免调试断层）
✅ 内容是“工程决策文档”，不是说明书
✅ 可直接放入 GitHub Pages 项目

---

# ✅ `docs/extended-description.md`（中文版）

```markdown
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

```

/ai-input-safety/pdfjs/3.11.174/

```

目的：

✔ 避免 CORS 阻断  
✔ 避免字体 fetch 失败  
✔ 避免 fake worker 模式  
✔ 避免 glyph 丢失  

---

## 七、遮盖策略（Redaction Strategy）

系统遮盖的是：

✅ 值（value）  
❌ 标签（label）  

示例：

✔ 电话：138****8888  
✔ 银行账号：6222 **** **** 1234  
✔ 公司名称：遮盖主体词，保留地区 / 类型  

绝不：

❌ 删除整行文本  
❌ 改写 PDF 结构  
❌ 插入提示文字  

---

## 八、安全边界（Security Boundary）

系统保证：

- 不上传文件
- 不记录文档内容
- 不持久化数据
- 所有处理在内存完成

不保证：

❌ 文档真实性  
❌ OCR 正确率  
❌ 外部 AI 行为  

---

## 九、典型失败模式（Failure Modes）

若出现：

- 文本消失
- 表格丢字
- 控制台字体错误
- 覆盖偏移

优先检查：

1. pdf.worker 路径
2. cMapUrl 路径
3. standardFontDataUrl 路径
4. GitHub Pages 实际访问路径

---

## 十、维护策略（Maintenance Strategy）

任何修改必须遵守：

✅ 不破坏 PDF.js 加载模型  
✅ 不改变 same-origin 规则  
✅ 不引入自动日志系统  
✅ 不改变 DPI / viewport 逻辑  

---

## 十一、版本控制原则（Versioning）

PDF.js 版本锁定：

```

3.11.174

```

原因：

✔ 行为稳定  
✔ 字体模型已验证  
✔ 避免跨版本坐标漂移  

升级属于**高风险操作**。

---

## 十二、最终工程结论（Final Engineering Conclusions）

本系统是：

> 一个**视觉安全重建系统（Visual Reconstruction System）**，而不是 PDF 编辑器。

核心价值：

✔ AI 可读  
✔ 人类可读  
✔ 敏感信息不可恢复  
✔ 行为可预测  
```

---
