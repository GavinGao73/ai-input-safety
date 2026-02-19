
# Extended Description

本文件用于对外说明 Filter 的定位、边界与关键技术约束。它不是用户操作手册，也不是法律或合规承诺文件。

---

## 🇬🇧 English

### 1. What This Document Is (and Is Not)

This document explains Filter’s product intent, security boundaries, and stability-critical engineering constraints.

It is not:

A user manual
A legal/compliance certification statement
A guarantee of perfect detection or perfect redaction

Filter is best understood as:

A local-first AI input safety layer
A visual redaction pipeline for safer sharing and submission

---

### 2. Project Positioning

Filter’s goal is to help users reduce unintended sensitive data exposure before content is submitted to AI systems, translators, or online platforms.

Filter is not:

An OCR system
A PDF editor
A document reconstruction tool

Filter is:

A tool that produces safer representations of text and documents
A tool that prioritizes privacy, predictability, and reduced machine-readable exposure

---

### 3. Product Philosophy

Filter follows these core principles:

**Readability First**
Outputs should remain readable for humans and usable for downstream workflows.

**Minimal Destruction**
Reduce exposure of sensitive values while preserving surrounding context whenever feasible.

**Local-First & Ephemeral**
No server processing by design. All operations run locally within the browser session.

**Risk Reduction, Not Perfection**
Filter reduces common risks but does not guarantee complete detection or absolute safety.

---

### 4. Document Processing Model (Two Paths)

Filter supports two document-handling paths depending on the user’s objective.

---

#### A) Readable PDF Path (machine-readable PDF)

Input: PDF with a text layer

Pipeline (high-level):

PDF is parsed locally using PDF.js
Sensitive regions are identified by a rule-based detection engine
Visual redaction rectangles are rendered

Output characteristics:

Designed to preserve visual readability and reviewability
Exported PDFs do **not** preserve a machine-readable text layer
Outputs are image-based by design to reduce text recovery risks

Best suited when users require readable context and manual verification.

Typical use cases:

Pre-submission review
Internal workflows
Safer copy preparation

---

#### B) Raster Secure PDF Path (high-safety export)

Input: PDF or image

Pipeline (high-level):

Render pages into high-DPI raster images
Apply fully opaque pixel-level redaction
Rebuild an image-only PDF

Output characteristics:

Reduces risks of recovering machine-readable text objects
Not intended for text search or editing
Emphasizes recovery resistance over file size

Typical use cases:

High-sensitivity external sharing
Legal or administrative documents
Scenarios where text extraction is a concern

Important note:

Raster Secure reduces common recovery vectors (text extraction, hidden text objects).
It does not claim elimination of all theoretical attack vectors.

---

### 5. Why PDF.js Is Used

PDF.js enables deterministic, browser-local PDF processing, including:

Access to text content items
Transform matrices and viewport scaling
Predictable rendering under stable configuration

This aligns with Filter’s local-first architecture.

---

### 6. Fonts, CMaps, and Same-Origin Deployment (Stability-Critical)

Rendering accuracy depends on:

Standard font data
CMaps for CID fonts
Worker execution and asset loading

If assets are missing or blocked, issues may include:

Missing glyphs (especially CJK)
Blank table cells
Geometry drift
Redaction misalignment

Engineering constraint:
Worker, CMaps, and standard fonts must be served same-origin.

---

### 7. Redaction Strategy (What Is Covered)

Filter aims to cover **values**, not labels.

Examples:

Phone numbers → cover numeric value
Accounts / IDs → cover sensitive digits
Amounts → cover values while preserving context

Filter avoids:

Deleting entire lines by default
Rewriting PDF structure as an editor
Injecting excessive warning text

---

### 8. Security Boundary (What Filter Does and Does Not Promise)

Filter is designed to:

Process locally
Avoid persistent storage
Reduce common exposure risks

Filter does not promise:

Perfect detection
Legal compliance guarantees
Protection against compromised devices
Protection against screenshots or photography

Users should always review outputs.

---

### 9. Common Failure Modes & Debug Priorities

If problems occur:

Missing text
Font warnings
Overlay misalignment

Check:

Worker paths
cMapUrl
standardFontDataUrl
Same-origin deployment
PDF.js version consistency

---

### 10. Maintenance Rules (Do Not Change Lightly)

High-risk changes:

PDF.js upgrades
Worker/font configuration changes
Viewport/DPI logic changes
Geometry alignment logic

---

### 11. Versioning Constraint

PDF.js is version-locked for stability.

Upgrades may alter:

Font fallback
Glyph positioning
Transform behavior
Export consistency

---

### 12. Final Note

Filter is a practical risk-reduction tool.

It is not a guarantee system.
It is not a compliance certificate.
It is a deterministic local pipeline.

---

---

## 🇨🇳 中文

### 1. 本文件是什么（以及不是什么）

本文档用于说明 Filter 的产品定位、安全边界与工程约束。

它不是：

用户手册
法律或合规认证声明
完美识别保证

Filter 可以理解为：

本地优先 AI 输入安全层
视觉遮盖与安全导出管线

---

### 2. 项目定位

Filter 用于在提交给 AI 或在线平台前降低敏感信息暴露风险。

Filter 不是：

OCR 工具
PDF 编辑器
结构重建工具

Filter 是：

生成更安全表示形式的工具
优先考虑隐私与可预测性

---

### 3. 产品哲学

可读性优先
最小破坏
本地优先与临时性
降低风险而非保证完美

---

### 4. 文档处理模型（双路径）

---

#### A）Readable PDF 路径

输入：带文本层 PDF

处理逻辑：

本地 PDF.js 解析
规则引擎识别区域
渲染遮盖矩形

输出特性：

保持视觉可读性
导出的 PDF 不保留机器可读文本层
输出采用图像化结构以降低恢复风险

适用场景：

提交前检查
内部流转
生成安全副本

---

#### B）Raster Secure 路径

输入：PDF / 图片

处理逻辑：

高 DPI 光栅化
像素级不透明遮盖
重建图像 PDF

输出特性：

降低文本恢复风险
不用于检索或编辑
安全性优先

---

### 5. 为什么使用 PDF.js

PDF.js 支持浏览器本地解析与几何计算，避免服务器处理。

---

### 6. 字体 / CMap / 同源部署

worker / cmaps / standard_fonts 必须同源部署，否则可能出现丢字或漂移。

---

### 7. 遮盖策略

优先遮盖 value，尽量不破坏 label 与语境。

---

### 8. 安全边界

不承诺完美识别，不防截屏或被入侵设备。

---

### 9. 排查优先级

worker → cmaps → fonts → 同源 → 版本一致性

---

### 10. 维护规则

PDF.js / DPI / viewport 变更需严格回归测试。

---

### 11. 版本锁定

PDF.js 升级属于高风险操作。

---

### 12. 最终说明

Filter 是风险降低工具，而非安全保证系统。

---

---

## 🇩🇪 Deutsch

### 1. Was Dieses Dokument Ist (und Nicht Ist)

Dieses Dokument beschreibt Produktpositionierung, Sicherheitsgrenzen und technische Stabilitätsregeln von Filter.

Es ist kein:

Benutzerhandbuch
Rechts- oder Compliance-Zertifikat
Versprechen perfekter Erkennung

Filter ist zu verstehen als:

Local-first Sicherheitslayer für KI-Eingaben
Visuelle Schwärzungs-Pipeline

---

### 2. Projektpositionierung

Filter reduziert unbeabsichtigte Offenlegung sensibler Informationen vor Übermittlung an KI- oder Online-Systeme.

Filter ist kein:

OCR-System
PDF-Editor
Rekonstruktionswerkzeug

Filter ist:

Werkzeug zur Erstellung sichererer Zwischenversionen
Werkzeug mit Fokus auf Datenschutz und Vorhersagbarkeit

---

### 3. Produktphilosophie

Lesbarkeit zuerst
Minimale Zerstörung
Local-first & flüchtig
Risikominderung statt Perfektion

---

### 4. Dokumentverarbeitung (Zwei Pfade)

---

#### A) Readable PDF Pfad

Eingabe: PDF mit Textebene

Pipeline (hochlevel):

Lokale Verarbeitung mit PDF.js
Regelbasierte Erkennung sensibler Bereiche
Rendering visueller Schwärzungen

Ausgabe:

Visuell lesbar und prüfbar
Exportierte PDFs enthalten **keine maschinenlesbare Textebene**
Ausgaben sind bildbasiert zur Reduzierung von Wiederherstellungsrisiken

Geeignet für Review- und Prüf-Szenarien.

---

#### B) Raster Secure Pfad

Eingabe: PDF oder Bild

Pipeline:

High-DPI Rasterung
Pixelbasierte opake Schwärzung
Rebuild als image-only PDF

Ausgabe:

Reduzierte Wiederherstellbarkeit von Textobjekten
Nicht für Textsuche gedacht
Sicherheit vor Dateigröße

---

### 5. Warum PDF.js

PDF.js ermöglicht browserlokale Verarbeitung ohne Serverabhängigkeit.

---

### 6. Fonts / CMaps / Same-Origin

Worker, CMaps und Standard-Fonts müssen same-origin ausgeliefert werden.

---

### 7. Schwärzungsstrategie

Abdeckung primär von Werten (value), nicht von Labels (label).

---

### 8. Sicherheitsgrenze

Keine Garantie perfekter Erkennung oder Schutz gegen kompromittierte Geräte.

---

### 9. Debug-Priorität

Workerpfad → CMaps → Fonts → Same-Origin → Versionskonsistenz

---

### 10. Wartungsregeln

PDF.js-Upgrades und DPI-Änderungen sind High-Risk.

---

### 11. Versionsbindung

PDF.js ist versionsgebunden für Stabilität.

---

### 12. Abschließender Hinweis

Filter ist ein praktisches Tool zur Risikominderung, kein Garantiesystem.

---

