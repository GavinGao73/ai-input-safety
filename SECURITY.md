# Security Policy / 安全策略 / Sicherheitsrichtlinie

---

## Reporting a Vulnerability  
## 漏洞报告方式  
## Meldung von Sicherheitslücken

If you believe you have discovered a security-related issue, please report it responsibly.

如果你认为发现了与安全相关的问题，请以负责任的方式报告。

Falls Sie ein sicherheitsrelevantes Problem entdeckt haben, melden Sie es bitte verantwortungsvoll.

Preferred channels / 建议渠道 / Bevorzugte Kanäle:

- GitHub Issues (for non-sensitive reports)  
- GitHub Issues（适用于非敏感问题）  
- GitHub Issues (für nicht sensible Meldungen)

- Email / 邮件 / E-Mail: <your-contact-email>

Please avoid publicly disclosing details that could expose users to risk.  
请避免公开披露可能导致用户风险的技术细节。  
Bitte veröffentlichen Sie keine Details, die Nutzer gefährden könnten.

---

## Scope of Security Considerations  
## 安全范围说明  
## Sicherheitsumfang

Filter is a local-only, browser-based tool.

Filter 是一个完全本地运行的浏览器工具。

Filter ist ein rein lokal im Browser ausgeführtes Werkzeug.

Key properties / 核心特性 / Kerneigenschaften:

- No user accounts / 无用户账户 / Keine Benutzerkonten  
- No backend services / 无后端服务 / Keine Backend-Dienste  
- No server-side processing / 无服务器处理 / Keine Serververarbeitung  
- No persistent storage of user content / 不持久化存储内容 / Keine dauerhafte Speicherung

All data exists ephemerally in browser memory only.  
所有数据仅存在于浏览器内存中。  
Alle Daten existieren ausschließlich temporär im Browser-Speicher.

---

## Threat Model Notes  
## 威胁模型说明  
## Bedrohungsmodell

Filter primarily addresses risks related to:

Filter 主要针对以下风险：

Filter adressiert primär folgende Risiken:

- Machine-readable data extraction / 机器可读数据提取 / Maschinenlesbare Extraktion  
- Unintended sensitive data exposure / 敏感信息暴露 / Unbeabsichtigte Offenlegung  
- Recoverable document text layers / 可恢复文本层 / Wiederherstellbare Textebenen

Filter does NOT claim to provide:

Filter 不声明提供以下能力：

Filter beansprucht NICHT:

- Network security / 网络安全 / Netzwerksicherheit  
- Endpoint security / 终端安全 / Endpunktsicherheit  
- Protection against compromised environments / 恶意环境防护 / Schutz vor manipulierten Umgebungen

---

## Responsible Disclosure  
## 负责任披露  
## Verantwortungsvolle Offenlegung

Security reports are reviewed on a best-effort basis.

安全报告将尽力审查处理。

Sicherheitsmeldungen werden nach bestem Ermessen geprüft.

Please include / 请提供 / Bitte angeben:

- Reproduction steps / 复现步骤 / Reproduktionsschritte  
- Affected file/sample (if safe) / 示例文件 / Beispieldatei (falls sicher)  
- Expected vs observed behavior / 预期与实际行为 / Erwartetes vs tatsächliches Verhalten
