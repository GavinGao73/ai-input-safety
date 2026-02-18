# SECURITY / 安全说明 / SICHERHEIT

## EN

Filter is a privacy-oriented, client-side utility.

Security goal: reduce risks associated with automated or machine-based extraction of sensitive data before users share content with AI systems or online platforms.

This project does **not** claim to eliminate all threats or guarantee compliance.

### Design priorities

- Local-only processing (in browser)
- No persistent storage by default
- No content logging by default
- Deterministic document export behavior where possible

### Important limitations

- Output safety depends on the input document, fonts, rendering behavior, and user selections.
- Filter cannot guarantee that all sensitive information is removed in all cases.
- Users remain responsible for validating whether outputs meet their legal, regulatory, or organizational requirements.

### Reporting security issues

If you discover a reproducible security issue or an unintended exposure scenario, please report it responsibly via the repository issue tracker (avoid posting real sensitive data).

---

## 中文

Filter 是一个隐私优先的本地工具（浏览器内运行）。

安全目标：在用户把内容提交给 AI / 翻译工具 / 在线平台之前，降低敏感信息被自动化或机器化提取的风险。

本项目**不**承诺“绝对安全”，也**不**保证满足任何合规要求。

### 设计优先级

- 全流程本地处理（浏览器内）
- 默认不做持久化存储
- 默认不记录内容日志
- 尽量保持导出行为可预期、可复现

### 重要限制

- 输出安全性受输入文档、字体、渲染差异、用户选择区域等影响。
- Filter 无法保证在所有情况下都能去除全部敏感信息。
- 用户需自行评估输出是否满足法律、监管或组织内部要求。

### 漏洞/问题反馈

如发现可复现的安全问题或意外暴露场景，请通过仓库 Issue 进行负责任披露（避免上传真实敏感数据）。

---

## DE

Filter ist ein datenschutzorientiertes Client-Side-Tool (lokal im Browser).

Sicherheitsziel: Reduzierung der Risiken automatisierter bzw. maschineller Extraktion sensibler Daten, bevor Inhalte an KI-Systeme oder Online-Plattformen übermittelt werden.

Dieses Projekt erhebt **keinen** Anspruch auf vollständige Bedrohungsabdeckung oder Compliance-Garantien.

### Design-Prioritäten

- Lokale Verarbeitung im Browser
- Standardmäßig keine dauerhafte Speicherung
- Standardmäßig kein Content-Logging
- Möglichst deterministisches Export-Verhalten

### Wichtige Einschränkungen

- Die Sicherheit des Outputs hängt u. a. von Dokument, Fonts, Rendering und Nutzer-Auswahl ab.
- Filter kann nicht garantieren, dass alle sensiblen Daten in jedem Fall entfernt werden.
- Nutzer sind verantwortlich für die Prüfung rechtlicher/regulatorischer Anforderungen.

### Sicherheitsmeldungen

Bitte melde reproduzierbare Sicherheitsprobleme verantwortungsvoll über den Issue-Tracker (keine echten sensiblen Daten posten).
