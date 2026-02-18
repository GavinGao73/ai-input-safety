# Filter

---

## 🇬🇧 English

Filter is a lightweight, privacy-first safety layer designed to reduce unintended
exposure of sensitive information before text or documents are submitted to AI systems,
translation tools, or online platforms.

---

### Purpose

Filter helps users generate a safer version of content **without altering its meaning
or readability**.

Design philosophy:

- Preserve human and AI readability  
- Only mitigate genuinely sensitive elements  
- Avoid unnecessary annotations or warning text  
- Operate entirely locally in the browser  

---

### Core Guarantees

- No login required  
- No data storage  
- No content tracking  
- All processing occurs locally in the browser  
- Refreshing or closing the page clears all data  

Filter follows a strict local-first, ephemeral processing model.

---

### Why Filter Exists

Modern AI systems and automated platforms possess strong capabilities for:

- Text extraction  
- Structural parsing  
- Entity recognition  
- Data correlation  

Users frequently expose machine-readable sensitive information unintentionally when
copying, pasting, or uploading documents.

Filter does not modify the semantic meaning of content.

Its role is:

✔ Reduce machine-readable sensitive exposure **before external processing**

---

### Security Model

Filter primarily targets:

✔ Machine / automated extraction risks  

Filter is NOT designed to:

- Restrict human visual reading  
- Provide document editing features  
- Optimize file size  

Document processing priority:

**Security > Editability > File Size**

---

### PDF Safety Strategy

Documents are processed using the **Raster Secure Model**:

Document page → High-DPI rasterization → Opaque redaction → Rebuilt PDF

Exported files:

- Contain no extractable text layer  
- Preserve no original PDF text objects  
- Retain no hidden strings  
- Use fully opaque pixel-based redaction  

Sensitive information becomes structurally non-recoverable.

---

### Non-Targeted Use Cases

Filter is NOT intended for:

- Legal certification or compliance validation  
- Forensic-grade adversarial environments  
- OCR reconstruction workflows  
- Encryption / DRM control  
- Human-visual anonymization requirements  

Professional-grade solutions are required for those scenarios.

---

### Privacy & Data Handling

Filter does NOT:

- Store user input or output  
- Upload content to servers  
- Associate identity with content  
- Persist logs or extraction results  

All operations are in-memory only.

---

### Commercial Customization

Filter is maintained as an open, privacy-first engineering project.

For organizations or individuals requiring:

- Custom rule engines  
- Domain-specific filtering logic  
- Private deployments  
- Integration into internal workflows  

Commercial customization services may be available.

Contact:

**Gavin Gao**  
Email: 13918180626@163.com

---

### Disclaimer

Filter is a risk-reduction tool, not a security guarantee system.

Users remain responsible for verifying outputs and determining suitability for
their specific legal, technical, or operational contexts.

---

## 🇨🇳 中文说明

Filter 是一个轻量级、隐私优先的安全过滤层，用于在文本或文档被提交给
AI 系统、翻译工具或在线平台之前，降低无意的敏感信息暴露风险。

---

### 产品目标

在 **不改变内容可读性与语义** 的前提下，帮助用户生成更安全的输入版本。

设计理念：

- 保持内容对人类与 AI 可理解  
- 仅处理真正的敏感信息  
- 不引入多余标记或提示文本  
- 完全本地运行  

---

### 核心保证

- 无需登录  
- 不存储数据  
- 不跟踪内容  
- 所有处理均在浏览器本地完成  
- 关闭或刷新页面即清除全部数据  

Filter 采用严格的本地优先、内存级处理模型。

---

### 为什么需要 Filter

现代 AI 与自动化系统具备强大的：

- 文本提取能力  
- 结构解析能力  
- 实体识别能力  
- 信息关联能力  

用户在复制、粘贴或上传材料时，常常会**无意暴露可被机器解析的敏感信息**，
而这些信息原本并不希望被外部系统提取。

Filter 不改变内容含义，其核心作用是：

✔ 在进入外部系统之前降低机器可解析的敏感暴露面

---

### 安全模型

Filter 主要关注：

✔ 机器 / AI / 自动化系统的信息提取风险  

而不是：

- 人类视觉匿名化  
- 文档编辑或恢复  
- 文件大小优化  

文档处理优先级：

**安全性 > 可编辑性 > 文件大小**

---

### PDF 安全处理策略

文档采用 **Raster Secure Model**：

页面 → 高 DPI 光栅化 → 完全不透明覆盖 → 重建 PDF

导出文件：

- 不包含可提取文本层  
- 不保留原始 PDF 对象结构  
- 不包含隐藏文本对象  
- 遮盖区域为完全不透明像素  

✔ 敏感信息在结构层面不可恢复

---

### 不适用场景

Filter 并非为以下用途设计：

- 法律合规认证  
- 高强度取证对抗  
- OCR 重建 / 文档恢复  
- 内容加密 / DRM  
- 人类视觉匿名化  

如需专业级安全或合规能力，应采用更高等级解决方案。

---

### 隐私与数据原则

Filter 不会：

- 存储输入或输出内容  
- 上传用户文件  
- 建立用户身份关联  
- 记录文本或命中结果  

所有处理均在浏览器内存中完成。

---

### 商业定制

Filter 以开源工程项目形式维护。

对于需要：

- 定制识别规则  
- 行业专用过滤逻辑  
- 私有化部署  
- 系统集成  

的组织或个人，可提供商业定制支持。

联系：

**Gavin Gao**  
邮箱：13918180626@163.com

---

### 免责声明

Filter 是风险降低工具，而非安全保证系统。

用户在处理敏感信息时，应自行评估适用性与风险。

---

## 🇩🇪 Deutsch

Filter ist eine leichtgewichtige, datenschutzorientierte Sicherheits-Zwischenschicht,
die unbeabsichtigte Offenlegung sensibler Informationen reduziert, bevor Inhalte
an KI-Systeme oder Plattformen übermittelt werden.

---

### Zielsetzung

Erstellung einer sichereren Inhaltsversion ohne Veränderung von Bedeutung oder Lesbarkeit.

---

### Grundprinzipien

- Vollständig lokale Verarbeitung  
- Keine Datenspeicherung  
- Keine Nutzerverfolgung  
- Flüchtige In-Memory-Verarbeitung  

Prioritäten:

**Sicherheit > Bearbeitbarkeit > Dateigröße**

---

### PDF-Sicherheitsstrategie

Dokumente werden als Raster Secure PDF exportiert:

Seite → Hochauflösende Rasterung → Opake Schwärzung → Neues PDF

Exportierte Dateien enthalten keine extrahierbaren Textobjekte oder versteckten Inhalte.

---

### Kommerzielle Anpassung

Für individuelle oder organisatorische Anforderungen können
maßgeschneiderte Lösungen verfügbar sein.

Kontakt:

**Gavin Gao**  
E-Mail: 13918180626@163.com

---

Filter dient der Risikominderung und ersetzt keine rechtliche oder sicherheitstechnische Beratung.
