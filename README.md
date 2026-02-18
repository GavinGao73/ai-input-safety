# Filter

---

## 🇬🇧 English

Filter is a lightweight, privacy-first safety layer designed to reduce unintended sensitive data exposure before text or documents are submitted to AI systems, translators, or online platforms.

### Purpose

Help users generate a safer version of content without altering its meaning or readability.

### Core Guarantees

- No login required  
- No data storage  
- No content tracking  
- All processing happens locally in the browser  
- Refreshing or closing the page clears all data  

### Design Philosophy

- Preserve human and AI readability  
- Only mitigate genuinely sensitive elements  
- Avoid unnecessary annotations or markers  
- Prioritize privacy and predictability  

### Security Model

Filter primarily targets **machine / automated extraction risks**, not human visual inspection.

When handling documents, the system prioritizes:

**Security > Editability > File Size**

### PDF Safety Strategy

Documents are processed using a Raster Secure Model:

Document page → High-DPI rasterization → Opaque redaction → Rebuilt PDF

Exported files:

- Contain no extractable text layer  
- Preserve no hidden strings or PDF text objects  
- Do not rely on viewer-side masking  
- Use fully opaque redaction  

### Privacy Principles

Filter does NOT:

- Store user input or output  
- Upload content to servers  
- Maintain history or accounts  
- Modify original files  

All processing is ephemeral and in-memory only.

---

## 🇨🇳 中文说明

Filter 是一个轻量级、隐私优先的安全过滤层，用于在文本或文档被提交给 AI 系统、翻译工具或在线平台之前，降低无意的敏感信息暴露风险。

### 产品目标

在 **不影响内容可读性与语义** 的前提下，帮助用户生成更安全的输入版本。

### 核心保证

- 无需登录  
- 不存储数据  
- 不跟踪内容  
- 所有处理均在浏览器本地完成  
- 关闭或刷新页面即清除全部数据  

### 设计理念

- 保持内容对人类与 AI 可理解  
- 仅处理真正的敏感信息  
- 不引入多余标记或提示文本  
- 完全本地运行  

### 安全模型

Filter 主要关注：

✔ 防止机器 / AI / 自动化系统提取敏感信息  

而不是：

- 人类视觉匿名化  
- 文档编辑或恢复  
- 文件大小优化  

在文档处理场景中，优先级为：

**安全性 > 可编辑性 > 文件大小**

### PDF 安全处理策略

文档采用 Raster Secure Model：

页面 → 高 DPI 光栅化 → 不透明覆盖 → 重建 PDF

导出文件：

- 不包含可提取文本层  
- 不保留隐藏文本对象  
- 不依赖阅读器遮盖机制  
- 遮盖区域为完全不透明像素  

### 隐私原则

Filter 不会：

- 存储输入或输出内容  
- 上传用户文件  
- 建立用户身份关联  
- 修改原始文档  

所有处理均为浏览器内存级临时操作。

---

## 🇩🇪 Deutsch

Filter ist eine leichtgewichtige, datenschutzorientierte Sicherheits-Zwischenschicht, die unbeabsichtigte Offenlegung sensibler Informationen reduziert, bevor Inhalte an KI-Systeme, Übersetzer oder Online-Plattformen übermittelt werden.

### Zielsetzung

Erstellung einer sichereren Inhaltsversion ohne Veränderung von Bedeutung oder Lesbarkeit.

### Grundgarantien

- Keine Anmeldung erforderlich  
- Keine Datenspeicherung  
- Kein Content-Tracking  
- Vollständig lokale Verarbeitung im Browser  
- Schließen oder Neuladen löscht alle Daten  

### Entwurfsprinzipien

- Verständlichkeit für Menschen und KI bewahren  
- Nur tatsächlich sensible Elemente behandeln  
- Keine unnötigen Markierungen einführen  
- Vorhersagbares Verhalten sicherstellen  

### Sicherheitsmodell

Der Fokus liegt auf der Reduktion von Risiken durch **maschinelle / automatisierte Extraktion**, nicht auf visueller Anonymisierung.

Prioritäten bei Dokumenten:

**Sicherheit > Bearbeitbarkeit > Dateigröße**

### PDF-Sicherheitsstrategie

Dokumente werden als Raster Secure PDF exportiert:

Seite → Hochauflösende Rasterung → Opake Schwärzung → Neues PDF

Exportierte Dateien:

- Enthalten keine extrahierbaren Textobjekte  
- Bewahren keine versteckten Zeichenketten  
- Verwenden keine transparenten Masken  
- Sind strukturell nicht rekonstruierbar  

### Datenschutzprinzipien

Filter speichert keine Inhalte, lädt nichts hoch und verändert keine Originaldateien.  
Alle Operationen erfolgen flüchtig im Arbeitsspeicher des Browsers.
