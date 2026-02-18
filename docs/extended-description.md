# Extended Description

本文件用于对外说明 **Filter 的定位、边界与关键技术约束**。它不是用户操作手册，也不是法律或合规承诺文件。

---

## 🇬🇧 English

### 1. What This Document Is (and Is Not)

This document explains **Filter’s product intent, security boundaries, and stability-critical engineering constraints**.

It is **not**:

* A user manual
* A legal/compliance certification statement
* A guarantee of perfect detection or perfect redaction

Filter is best understood as:

* A **local-first AI input safety layer**
* A **visual redaction pipeline** for safer sharing and submission

---

### 2. Project Positioning

Filter’s goal is to help users **reduce unintended sensitive data exposure** before content is submitted to AI systems, translators, or online platforms.

Filter is **not**:

* An OCR system
* A PDF editor
* A document “reconstruction” tool

Filter is:

* A tool that produces **safer representations** of text and documents
* A tool that prioritizes **privacy, predictability, and reduced machine-readable exposure**

---

### 3. Product Philosophy

Filter follows these core principles:

1. **Readability First**
   Outputs should remain readable for humans, and usable for downstream workflows.

2. **Minimal Destruction**
   Reduce exposure of sensitive values while preserving surrounding context when possible.

3. **Local-First & Ephemeral**
   No server processing by design. Processing happens locally in the browser session.

4. **Risk Reduction, Not Perfection**
   Filter reduces common risks but does not guarantee complete detection or absolute safety.

---

### 4. Document Processing Model (Two Paths)

Filter supports two document-handling paths depending on the user’s goal.

#### A) Readable PDF Path (machine-readable PDF)

Input: PDF with a text layer
Pipeline (high-level):

* PDF is parsed locally with PDF.js
* Sensitive regions are identified using a rule-based engine
* Visual redaction rectangles are rendered

Output characteristics:

* Intended to preserve readability and workflow utility
* May keep a text layer depending on mode and output choice
* Best suited when the user needs readable context and reviewability

Typical use cases:

* Reviewing before AI submission
* Internal review workflows
* Draft “safer copy” preparation

#### B) Raster Secure PDF Path (high-safety export)

Input: PDF or image
Pipeline (high-level):

* Render each page to a high-DPI raster image
* Apply **fully opaque** pixel-based redaction
* Rebuild an image-only PDF export

Output characteristics:

* Designed to reduce risks of recovering machine-readable text objects
* Not intended to be searchable or editable as text
* Emphasizes recovery resistance over file size or editability

Typical use cases:

* High-sensitivity external sharing
* Legal/administrative documents (where you want to minimize extractability)
* Distribution where text-layer recovery is a concern

Important note:

* Raster Secure reduces common recovery paths (text extraction, hidden text objects).
  It does **not** claim to eliminate all theoretical attack vectors.

---

### 5. Why PDF.js Is Used

PDF.js is used because it enables browser-local PDF processing, including:

* Access to text content items
* Transform matrices and viewport scaling
* Deterministic rendering when configuration is stable

This supports the local-first model and avoids server-side processing.

---

### 6. Fonts, CMaps, and Same-Origin Deployment (Stability-Critical)

PDF rendering and text geometry depend on:

* Standard fonts (PDF.js standard font data)
* CMaps for CID fonts and character mapping
* Worker execution and asset loading

If these assets are missing or cross-origin blocked, symptoms may include:

* Missing characters (especially CJK)
* Blank table cells or partially missing text
* Console warnings
* Geometry drift (misaligned redaction boxes)

**Engineering constraint:**
PDF.js assets (worker, cmaps, standard fonts) must be served **same-origin** for stable behavior.

---

### 7. Redaction Strategy (What Is Covered)

Filter aims to cover **values**, not labels.

Examples:

* Phone numbers: cover the number, keep surrounding words when safe
* IDs / account numbers: cover the sensitive digits, keep context when useful
* Amounts: may cover values while preserving non-sensitive context

Filter avoids:

* Deleting entire lines by default
* Rewriting PDF structure as a “PDF editor”
* Adding excessive warning text into exported documents

(Actual behavior depends on mode and user actions.)

---

### 8. Security Boundary (What Filter Does and Does Not Promise)

Filter is designed to:

* Process locally in the browser
* Avoid storing user content by default
* Reduce common machine-readable exposure risks

Filter does **not** promise:

* Perfect detection of all sensitive information
* Legal compliance guarantees for any jurisdiction
* Protection against compromised devices or malicious browser extensions
* Protection against screen capture/photography

Users should always review outputs before sharing.

---

### 9. Common Failure Modes & Debug Priorities

If you see issues such as:

* Text disappearing
* Missing glyphs in tables
* Unexpected console font warnings
* Redaction overlay drifting/misalignment

Check these first:

1. Worker path correctness
2. `cMapUrl` configuration and asset presence
3. `standardFontDataUrl` configuration and asset presence
4. Same-origin deployment (especially on GitHub Pages project sites)
5. PDF.js version consistency

Most “missing text” failures come from asset loading and deployment paths, not rule logic.

---

### 10. Maintenance Rules (Do Not Change Lightly)

Changes that require careful regression testing:

* PDF.js version upgrades
* Worker/CMap/font configuration changes
* Viewport scaling / DPI rendering changes
* Any change that affects text geometry alignment

---

### 11. Versioning Constraint

PDF.js is version-locked for stability (current validated version in this project).

Upgrades are considered **high-risk** because they may alter:

* Font handling
* Transform behavior
* Glyph positioning and bounding boxes
* Raster export output consistency

---

### 12. Final Note

Filter is a practical, local-first tool for **risk reduction**.

It is not a guarantee system.
It is not a compliance certificate.
It is a pipeline designed for predictable behavior and reduced machine-readable exposure.

---

## 🇨🇳 中文

### 1. 本文件是什么（以及不是什么）

本文档用于对外说明 **Filter 的产品定位、安全边界与关键工程约束**。

它**不是**：

* 用户操作说明书
* 法律/合规认证声明
* “100% 识别/100% 安全”的保证书

你可以把 Filter 理解为：

* **本地优先的 AI 输入安全层**
* **面向对外提交/分享的视觉遮盖管线**

---

### 2. 项目定位

Filter 的目标是在内容提交给 AI、翻译工具或在线平台之前，帮助用户**降低无意的敏感信息暴露风险**。

Filter 不是：

* OCR 工具
* PDF 编辑器
* 文档“结构重建”系统

Filter 是：

* 生成更安全“中间版本”的工具
* 以**隐私、可预测性、降低机器可读暴露面**为优先级的工具

---

### 3. 核心产品哲学

Filter 的原则包括：

1. **可读性优先**
   输出内容仍应对人类可读，并尽量保持工作流可用。

2. **最小破坏**
   优先处理敏感值（value），尽量保留上下文语义。

3. **本地优先与临时性**
   设计上不依赖服务器处理；数据主要在浏览器会话内完成。

4. **降低风险，而非保证完美**
   Filter 用于降低常见风险，但不承诺“完全识别/绝对安全”。

---

### 4. 文档处理模型（双路径）

Filter 根据目标提供两种文档处理路径。

#### A）Readable PDF 路径（机器可读 PDF）

输入：带文本层的 PDF
处理（高层逻辑）：

* 使用 PDF.js 在本地解析
* 规则引擎识别敏感区域
* 渲染遮盖矩形进行视觉遮盖

输出特性：

* 目标是保留可读性与可审查性
* 是否保留文本层取决于模式与输出选择
* 适合需要“可读上下文 + 可复核”的场景

典型场景：

* AI 提交前自查
* 内部审阅
* 生成“更安全的文本版本”

#### B）Raster Secure 路径（高安全导出）

输入：PDF 或图片
处理（高层逻辑）：

* 将页面高 DPI 光栅化
* 使用**完全不透明**的像素级遮盖
* 重建为仅包含图像的 PDF

输出特性：

* 重点降低可恢复文本对象的风险
* 不以可检索/可编辑为目标
* 安全性优先于文件大小与可编辑性

典型场景：

* 高敏感对外分享
* 法务/行政材料（希望尽量降低可提取性）
* 担心文本层恢复的分发场景

重要说明：

* Raster Secure 主要降低常见恢复路径（文本提取、隐藏文本对象等）。
  它**不**宣称消除所有理论攻击途径。

---

### 5. 为什么使用 PDF.js

选择 PDF.js 的原因在于它支持浏览器本地处理，并提供：

* textContent 等文本项访问能力
* transform / viewport 等几何与缩放能力
* 在配置稳定时更可预测的渲染行为

从而实现“本地优先”，避免服务器端处理。

---

### 6. 字体、CMap 与同源部署（稳定性关键约束）

PDF 渲染与几何对齐依赖：

* PDF.js 标准字体数据（standard fonts）
* CMaps（CID 字体映射）
* Worker 执行与资产加载

若这些资源缺失或跨域被拦截，常见现象包括：

* 字符缺失（尤其中文/日文等）
* 表格内容空白或部分缺失
* 控制台大量字体/渲染警告
* 遮盖框偏移（几何漂移）

**工程约束：**
worker、cmaps、standard fonts 必须 **same-origin（同源）** 部署，才能获得稳定行为。

---

### 7. 遮盖策略（覆盖什么）

Filter 的默认思路是遮盖：

✅ 值（value）
尽量不遮盖：
❌ 标签（label）

例如：

* 电话号码：遮盖号码本体，尽量保留上下文
* 身份号/账号：遮盖关键数字，保留必要语境
* 金额：可遮盖数值，尽量保留非敏感描述

Filter 通常避免：

* 直接删除整行文本（除非用户明确这样做）
* 以“PDF 编辑器”方式重写结构
* 在导出文档中加入大量提示性文字

（最终行为取决于模式与用户操作。）

---

### 8. 安全边界（能做什么/不承诺什么）

Filter 的设计目标是：

* 本地处理
* 默认不存储用户内容
* 降低常见机器可读暴露风险

Filter **不承诺**：

* 识别所有敏感信息的完美准确率
* 任何司法辖区的法律/合规保证
* 对被入侵设备、恶意浏览器插件的防护
* 防止截屏/拍照/录屏

分享前请用户自行核验输出结果。

---

### 9. 典型失败模式与排查优先级

如果出现：

* 文本消失
* 表格丢字
* 控制台字体警告异常多
* 遮盖框偏移

优先检查：

1. worker 路径是否正确
2. `cMapUrl` 是否正确且资源完整
3. `standardFontDataUrl` 是否正确且资源完整
4. 是否同源部署（尤其 GitHub Pages 项目站点）
5. PDF.js 版本是否一致

多数“文字丢失”问题来自**部署与资源路径**，而不是规则逻辑。

---

### 10. 维护规则（不要轻易修改）

以下改动需要严格回归测试：

* 升级 PDF.js
* 修改 worker / cmaps / fonts 配置
* 修改 viewport scaling / DPI 渲染逻辑
* 任何影响文字几何对齐的变更

---

### 11. 版本控制约束

为稳定性，项目对 PDF.js 版本做锁定（当前版本已在项目内验证）。

升级属于**高风险操作**，可能改变：

* 字体处理与回退逻辑
* transform 行为
* 字符定位与边界框
* 光栅导出一致性

---

### 12. 最终说明

Filter 是一个面向现实使用的**风险降低工具**：

* 不是安全保证系统
* 不是合规认证工具
* 也不是“万能脱敏器”

它的价值在于：本地优先、行为可预测、降低机器可读暴露面。

---

## 🇩🇪 Deutsch

### 1. Was Dieses Dokument Ist (und Nicht Ist)

Dieses Dokument beschreibt **Positionierung, Sicherheitsgrenzen und technische Stabilitätsregeln** von Filter.

Es ist **kein**:

* Benutzerhandbuch
* Rechts- oder Compliance-Zertifikat
* Versprechen perfekter Erkennung oder perfekter Schwärzung

Filter ist am besten zu verstehen als:

* **Local-first Sicherheits-Layer** für KI-Eingaben
* **Visuelle Schwärzungs-Pipeline** für sicherere Weitergabe

---

### 2. Projektpositionierung

Filter hilft dabei, **unbeabsichtigte Offenlegung sensibler Informationen zu reduzieren**, bevor Inhalte an KI-, Übersetzungs- oder Online-Systeme übermittelt werden.

Filter ist **kein**:

* OCR-System
* PDF-Editor
* System zur strukturellen Dokument-Rekonstruktion

Filter ist:

* Ein Werkzeug zur Erstellung **sichererer Zwischenversionen**
* Ein Werkzeug mit Priorität auf **Datenschutz, Vorhersagbarkeit und reduzierte maschinenlesbare Exposition**

---

### 3. Produktphilosophie

Grundprinzipien:

1. **Lesbarkeit zuerst**
   Ausgaben sollen für Menschen lesbar bleiben und Workflows unterstützen.

2. **Minimale Zerstörung**
   Sensible Werte reduzieren, Kontext möglichst bewahren.

3. **Local-first & flüchtig**
   Verarbeitung lokal im Browser, ohne serverseitige Abhängigkeit.

4. **Risikominderung statt Perfektion**
   Reduziert typische Risiken, garantiert aber keine vollständige Erkennung.

---

### 4. Dokumentverarbeitung (Zwei Pfade)

#### A) Readable PDF Pfad (maschinenlesbares PDF)

Eingabe: PDF mit Textebene
Pipeline (hochlevel):

* Lokale Verarbeitung mit PDF.js
* Regelbasierte Erkennung sensibler Bereiche
* Visuelle Schwärzungsrechtecke

Ausgabe:

* Fokus auf Lesbarkeit und Prüf-/Review-Fähigkeit
* Textebene kann je nach Modus/Auswahl erhalten bleiben
* Geeignet für Review-orientierte Szenarien

#### B) Raster Secure Pfad (High-Safety Export)

Eingabe: PDF oder Bild
Pipeline (hochlevel):

* High-DPI Rasterung jeder Seite
* **Vollständig opake** pixelbasierte Schwärzung
* Rebuild als image-only PDF

Ausgabe:

* Reduziert Risiken der Wiederherstellung maschinenlesbarer Textobjekte
* Nicht für Textsuche/Bearbeitung gedacht
* Sicherheit vor Dateigröße/Bearbeitbarkeit

Wichtiger Hinweis:

* Raster Secure reduziert typische Wiederherstellungspfade,
  garantiert aber nicht die Eliminierung aller theoretischen Angriffsvektoren.

---

### 5. Warum PDF.js

PDF.js ermöglicht browserlokale Verarbeitung mit:

* Zugriff auf Textinhalte
* Transformationsmatrizen und Viewport-Skalierung
* Stabileres Verhalten bei konsistenter Konfiguration

Damit bleibt das System local-first ohne Serververarbeitung.

---

### 6. Fonts, CMaps und Same-Origin (stabilitätskritisch)

Rendering und Geometrie hängen ab von:

* Standard-Fonts (PDF.js Font-Daten)
* CMaps (CID-Mapping)
* Worker- und Asset-Ladevorgängen

Bei fehlenden oder blockierten Assets können auftreten:

* Fehlende Zeichen (insbesondere CJK)
* Leere Tabellenzellen
* Viele Konsolenwarnungen
* Geometrie-Drift (verschobene Schwärzungen)

**Technische Regel:**
Worker, CMaps und Standard-Fonts müssen **same-origin** ausgeliefert werden.

---

### 7. Schwärzungsstrategie

Filter zielt primär auf das Abdecken von:

✅ Werten (value)
und versucht, Labels möglichst zu belassen:

❌ Labels (label)

Beispiele:

* Telefonnummern: Nummer abdecken, Kontext wenn möglich behalten
* IDs/Konten: kritische Ziffern abdecken, Kontext erhalten
* Beträge: Werte abdecken, Beschreibung möglichst behalten

Filter vermeidet typischerweise:

* Ganze Zeilen standardmäßig zu löschen
* PDF-Struktur wie ein Editor umzuschreiben
* Exportdokumente mit übermäßigen Warntexten zu füllen

---

### 8. Sicherheitsgrenze

Filter ist darauf ausgelegt:

* Lokal im Browser zu verarbeiten
* Standardmäßig keine Inhalte zu speichern
* Typische Risiken maschineller Extraktion zu reduzieren

Filter garantiert **nicht**:

* Vollständige Erkennung aller sensiblen Daten
* Rechtliche Konformität in jeder Jurisdiktion
* Schutz bei kompromittierten Geräten/Erweiterungen
* Schutz gegen Screenshots/Abfotografieren

---

### 9. Häufige Fehlerbilder & Debug-Priorität

Bei Problemen wie:

* Text verschwindet
* Zeichen fehlen in Tabellen
* Viele Font-Warnungen
* Verschobene Schwärzungsboxen

Zuerst prüfen:

1. Worker-Pfad
2. `cMapUrl` und Asset-Vollständigkeit
3. `standardFontDataUrl` und Asset-Vollständigkeit
4. Same-Origin Deployment (GitHub Pages Projektseiten)
5. PDF.js Versionskonsistenz

---

### 10. Wartungsregeln

Regressionstests sind nötig bei Änderungen an:

* PDF.js Version
* Worker/CMap/Font-Konfiguration
* Viewport-/DPI-Logik
* Textgeometrie und Bounding-Box-Ausrichtung

---

### 11. Versionsbindung

PDF.js ist für Stabilität versionsgebunden (im Projekt validiert).
Upgrades sind **High-Risk** und können Font-Handling, Transform, Glyph-Positionierung und Exportkonsistenz ändern.

---

### 12. Abschließender Hinweis

Filter ist ein praktisches Tool zur **Risikominderung**:

* kein Garantiesystem
* kein Compliance-Zertifikat
* kein „Allzweck“-Anonymisierer

Stärken: local-first, vorhersehbares Verhalten, reduzierte maschinenlesbare Exposition.

---

