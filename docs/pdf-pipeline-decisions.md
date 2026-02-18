# PDF 管线工程决策（严禁随意修改）

本文件记录 PDF 处理 / 覆盖（redaction）管线中**非直觉但极度关键的工程约束**。

这些不是优化建议，而是**稳定性不变量**。  
随意变更可能导致：

• 渲染异常  
• 覆盖矩形错位  
• 字符丢失  
• 静默数据损坏

---

## 1️⃣ PDF.js 版本锁定（HARD LOCK）

版本：3.11.174  
状态：强制锁定

原因：

• 覆盖矩形的几何计算已针对该版本验证  
• 文本层坐标与 transform 行为依赖该构建  
• 后续版本调整了内部矩阵与字体机制  
• 即使小版本升级也可能改变 glyph 定位

潜在后果：

• 覆盖框漂移  
• 字符位置偏移  
• 先前正常的 PDF 出现字符丢失  
• 多语言文档渲染不一致

规则：

除非执行完整回归测试，否则**禁止升级 PDF.js**

必须验证：

• 文本提取（text extraction）  
• bounding box 坐标  
• 栅格导出（raster export）  
• 字体渲染  
• 多语言 PDF（德语 + 中文）

---

## 2️⃣ 部署模型（Same-Origin 强制）

PDF.js 资源必须同源加载。

允许：

./pdfjs/3.11.174/

禁止：

https://cdnjs.cloudflare.com/...  
https://unpkg.com/...  

原因：

• Worker 受跨域严格限制  
• CMap 在 CORS 下经常加载失败  
• 标准字体可能静默加载失败  
• Fake worker fallback 会破坏性能与一致性

典型症状：

• 字符不可见  
• 中文文本消失  
• 表格内容为空  
• 大量 warning  
• 覆盖矩形错位

规则：

worker / cmaps / standard_fonts **必须同域部署**

生产环境**禁止依赖 CDN**

---

## 3️⃣ 必需资源结构（REQUIRED）

目录结构不可改变：

/pdfjs/3.11.174/pdf.min.js  
/pdfjs/3.11.174/pdf.worker.min.js  
/pdfjs/3.11.174/cmaps/  
/pdfjs/3.11.174/standard_fonts/

注意：

• cmaps/ 必须包含全部 bcmap 文件  
• standard_fonts/ 必须包含全部字体文件  
• 空目录是无效配置

缺失时的表现：

• 中文字符丢失  
• 表格局部空白  
• 控制台 warning 激增  
• 覆盖框漂移

---

## 4️⃣ Base URL 解析规则（GitHub Pages 安全）

Base URL 必须动态计算。

正确：

function pdfjsBaseUrl() {
  return new URL(`./pdfjs/3.11.174/`, window.location.href).toString();
}

错误：

const base = "/pdfjs/3.11.174/";  
const base = "https://gavingao73.github.io/pdfjs/3.11.174/";

原因：

GitHub Pages 项目站点路径包含仓库名。

硬编码根路径在以下场景必然失效：

• 仓库改名  
• 本地测试  
• 子目录部署

规则：

**严禁硬编码绝对路径**

---

## 5️⃣ Worker 配置不变量

Worker 必须同源。

正确：

pdfjsLib.GlobalWorkerOptions.workerSrc =
  pdfjsBaseUrl() + "pdf.worker.min.js";

原因：

跨域 worker → Fake worker fallback → 不稳定行为

---

## 6️⃣ CMap 与字体配置（关键）

必须同时提供：

cMapUrl: base + "cmaps/"  
cMapPacked: true  
standardFontDataUrl: base + "standard_fonts/"

原因：

缺失将导致：

• 亚洲字体映射失败  
• glyph 错误  
• 字符被静默跳过  
• 表面渲染正常但文本层错误

---

## 7️⃣ 字体处理策略（LOCKED）

当前稳定配置：

disableFontFace: true  
useSystemFonts: false

目标：

• 避免浏览器字体注入差异  
• 防止操作系统依赖行为  
• 保持栅格化确定性

严禁：

• 调试时随意切换这些参数  
• 启用系统字体来“修复文本缺失”

后果：

这会掩盖真实问题并破坏几何一致性。

---

## 8️⃣ 常见 Warning 的正确解读

### STSongStd-Light Warning

示例：

Warning: Cannot load system font: STSongStd-Light

含义：

• 信息性提示  
• 非致命错误  
• 不代表渲染失败

处理：

若文本显示正常 → 直接忽略

---

### getPathGenerator / ignoring character

含义：

• 字体程序解析时序问题  
• 通常无影响

处理：

仅当字符可见缺失时才排查

---

## 9️⃣ 覆盖几何不变量

覆盖矩形依赖：

• 文本层坐标  
• viewport transform  
• 版本相关 glyph metrics

推论：

PDF.js 升级 = 必须执行几何回归测试

视觉正确**不等于**几何正确。

必须验证：

✔ 覆盖位置  
✔ 多行文本  
✔ 表格单元格  
✔ 旋转文本  
✔ 混合字体

---

## 🔟 回归测试规则

以下任意变更均需测试：

• PDF.js 版本  
• Worker 配置  
• 字体参数  
• CMap 机制  
• viewport scaling 逻辑

最低验证：

• 多语言 PDF 加载  
• 文本长度一致  
• 覆盖矩形对齐  
• 栅格导出一致性

---

## 1️⃣1️⃣ 仓库编码规则（强制）

所有文件必须 UTF-8 编码。

适用：

• js  
• md  
• json  
• 测试文件

原因：

Regex 与 Unicode 行为依赖编码稳定。

错误表现：

• 乱码  
• 匹配失败  
• 不可见文本异常

---

# 最终规则（极重要）

若出现视觉异常：

❌ 不要立即修改 PDF.js 参数  
❌ 不要盲目升级库  
❌ 不要将 warning 视为根因  

优先排查：

✔ 资源路径  
✔ 同源加载  
✔ cmaps 完整性  
✔ standard_fonts 完整性  

绝大多数 PDF 管线问题源自**部署错误，而非算法错误**。
