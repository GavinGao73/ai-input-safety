
# MVP Scope (v1)

---

## 🇬🇧 English

### What Filter v1 Includes

Filter v1 is intentionally minimal. The first release focuses on reducing common forms of unintended sensitive data exposure before content is submitted to external AI / translation / online systems.

Core capabilities:

* Single-page web application (browser-only)
* Paste / type text input
* Generate a safer representation of text
* Highlight detected sensitive elements
* Copy safer output

Optional document safety mode:

* Local PDF input (no upload)
* Automatic detection when a machine-readable text layer exists
* Raster Secure PDF export (high DPI)

Design emphasis:

* Predictability over feature richness
* Risk reduction over automation complexity
* Privacy guarantees over convenience

---

### What Filter v1 Explicitly Does NOT Include

To avoid ambiguity, the following are out of scope for v1:

* Cloud processing or server-side analysis
* Persistent storage of user data
* User accounts, login, or identity systems
* History or conversation hosting
* OCR-based reconstruction or document “rebuilding”
* Semantic interpretation of document meaning
* Guarantees of legal or regulatory compliance

Filter v1 is **not** designed as a full compliance system or enterprise DLP solution.

---

### Rationale for Scope Constraints

Strict scope boundaries are necessary to preserve:

* Deterministic behavior
* Stable rendering and geometry
* Clear privacy guarantees
* Reduced attack surface

Adding OCR or remote processing would introduce:

* Privacy ambiguity
* Higher false positives / false negatives
* Non-deterministic output behavior
* Increased legal interpretation risk

---

### Intended Usage Model

Appropriate scenarios:

* Preparing text before submitting to AI systems
* Reducing machine-readable exposure in documents
* Creating safer intermediary copies for sharing or processing

Not intended for:

* Legal certification workflows
* Enterprise compliance automation
* Forensic-grade anonymization or adversarial threat models

---

## 🇨🇳 中文说明

### Filter v1 包含的功能

Filter v1 刻意保持极简，首个版本聚焦于在内容提交给外部 AI / 翻译 / 在线平台之前，降低常见的敏感信息误暴露风险。

基础能力：

* 浏览器本地运行的单页应用
* 文本粘贴 / 输入
* 生成更安全的文本表示形式
* 高亮识别出的敏感元素
* 复制输出内容

可选文档安全模式：

* 本地 PDF 文件输入（不上传）
* 自动检测是否存在可解析文本层
* Raster Secure PDF 导出（高 DPI）

设计侧重点：

* 可预测性优先于功能数量
* 风险降低优先于自动化复杂度
* 隐私边界优先于便利性

---

### Filter v1 明确不包含的能力

为避免误解，以下能力**不在 v1 范围内**：

* 云端处理 / 服务器端分析
* 用户数据的持久化存储
* 用户账户 / 登录 / 身份系统
* 历史记录或对话托管
* OCR 文本重建或“文档恢复”
* 文档语义理解或深度解析
* 法律或合规保证

Filter v1 **不是**完整的合规系统，也不是企业级 DLP 解决方案。

---

### 范围限制的设计原因

严格的范围边界用于确保：

* 行为稳定且可重复
* 渲染与几何坐标一致
* 隐私承诺清晰且可验证
* 攻击面最小化

引入 OCR 或远程处理会带来：

* 隐私模型不再清晰
* 误判（漏判 / 误判）显著增加
* 输出不可预测
* 法律解释与责任边界风险扩大

---

### 典型适用场景

适合用于：

* 在提交给 AI 系统前预处理文本
* 在分享文档前降低机器可读暴露
* 生成更安全的“中间版本”用于外部处理

不适合用于：

* 法律意义上的正式认证 / 审计流程
* 企业级自动化合规体系
* 高强度对抗或取证级匿名化需求

---

## 🇩🇪 Deutsch

### Was Filter v1 Enthält

Filter v1 ist bewusst minimal gehalten. Die erste Version konzentriert sich darauf, typische Risiken unbeabsichtigter Offenlegung sensibler Informationen zu reduzieren, bevor Inhalte an externe KI-/Übersetzungs-/Online-Systeme übermittelt werden.

Kernfunktionen:

* Browserbasierte Single-Page-Anwendung
* Texteingabe per Einfügen oder Tippen
* Erzeugung einer sichereren Textdarstellung
* Hervorhebung erkannter sensibler Elemente
* Kopierbare Ausgabe

Optionaler Dokumentmodus:

* Lokale PDF-Eingabe (kein Upload)
* Automatische Erkennung, wenn eine maschinenlesbare Textebene vorhanden ist
* Raster Secure PDF Export (hohe DPI)

Design-Schwerpunkte:

* Vorhersagbarkeit statt Funktionsvielfalt
* Risikoreduktion statt Automatisierungstiefe
* Datenschutzgarantien statt Komfortfunktionen

---

### Was Filter v1 Ausdrücklich NICHT Enthält

Um Missverständnisse zu vermeiden, ist Folgendes in v1 **nicht** enthalten:

* Cloud- oder Serververarbeitung
* Dauerhafte Speicherung von Nutzerdaten
* Benutzerkonten, Login oder Identitätssysteme
* Historie oder Conversation-Hosting
* OCR-basierte Rekonstruktion oder „Wiederaufbau“ von Dokumenten
* Semantische Interpretation von Dokumentinhalten
* Garantien zur rechtlichen oder regulatorischen Konformität

Filter v1 ist **kein** vollständiges Compliance-System und keine Enterprise-DLP-Lösung.

---

### Begründung der Umfangsgrenzen

Strikte Grenzen sind erforderlich, um Folgendes zu gewährleisten:

* Deterministisches Verhalten
* Stabiles Rendering und konsistente Geometrie
* Klare Datenschutzgarantien
* Reduzierte Angriffsfläche

OCR oder Remote-Verarbeitung würde verursachen:

* Unklare Datenschutzannahmen
* Mehr False Positives / False Negatives
* Nicht-deterministische Ergebnisse
* Höheres Risiko juristischer Fehlinterpretation

---

### Typisches Einsatzmodell

Geeignet für:

* Vorbereitung von Text vor der Nutzung von KI-Systemen
* Reduktion maschinenlesbarer Exposition in Dokumenten
* Erstellung sichererer Zwischenversionen für externe Verarbeitung

Nicht vorgesehen für:

* Rechts-/Zertifizierungsprozesse
* Enterprise-Compliance-Automatisierung
* Forensische Anonymisierung oder adversariale Bedrohungsmodelle

---

