# 系统级设计决策（LOCKED）

本文件记录 Filter 项目的不可随意变更的系统决策。

这些不是讨论意见，而是**稳定性 / 安全性约束**。

---

## D1 产品形态（LOCKED）

单页 Web 工具（PWA-ready）。

不开发原生 App v1。

原因：

• 降低隐私复杂度  
• 避免平台权限问题  
• 保持本地处理模型一致

---

## D2 产品边界（HARD BOUNDARY）

Filter 不是对话平台。

不托管对话  
不存储内容  
不参与 AI 调用

职责：

仅生成“更安全的副本”。

D2.1：MVP 阶段边界（v1）

状态：Accepted / Locked（产品演进约束）

v1 包含的能力

第一阶段产品仅实现最小可行安全模型：

• 单页 Web 应用（PWA-ready）
• 粘贴文本输入
• 生成更安全版本
• 高亮显示变更
• 复制安全文本

可选文档安全模式

在不引入服务器与存储的前提下，支持基础文档处理能力：

• 本地 PDF 输入（local only）
• 自动检测可解析文本层（machine-readable）
• Raster Secure Export（高 DPI 光栅化导出）

v1 明确排除的能力

为避免安全语义混乱与工程复杂度膨胀，以下能力在 v1 被硬性排除：

• 云端处理（Cloud processing）
• 持久化存储（Persistent storage）
• 用户账户体系（User accounts）
• 历史记录（History）
• 服务器端分析（Server-side analysis）
• OCR 重建 / OCR-based reconstruction

决策理由

MVP 的核心目标是验证：

✔ 本地优先安全模型是否可用
✔ 用户是否理解“先过滤再上传”的交互逻辑
✔ Raster Secure 导出是否满足真实隐私需求

而非构建完整平台或文档管理系统。

---

## D3 无存储原则（SECURITY INVARIANT）

禁止：

• 登录系统  
• 历史记录  
• 数据库存储  
• 持久化内容缓存

数据生命周期：

浏览器内存级  
刷新 / 关闭即清除

---

## D4 不调用 AI（LOCKED）

v1 不代表用户调用 AI。

原因：

• 隐私责任复杂化  
• 误解产品角色  
• 风险边界不清晰

---

## D5 核心使用场景（PRIMARY UX）

移动优先：

“在上传前粘贴一段文本 / 材料”。

目标：

减少误提交敏感信息。

---

## D6 指标模型（MINIMAL METRICS）

允许：

• 页面打开  
• 按钮点击计数  
• 可选 👍 / 👎

禁止：

• 内容记录  
• 用户识别  
• 文本采集

---

## D7 威胁模型（CLARIFICATION）

主要风险对象：

机器 / AI / 自动化解析系统

不是：

人类肉眼阅读

设计目标：

降低结构化可恢复性，而非视觉隐藏。

---

## D8 文档安全策略（LOCKED）

所有文档输出使用：

Raster Secure Model

处理模型：

页面 → 高 DPI 栅格化 → 像素级覆盖 → 重建 PDF

---

## D9 OCR 策略（LOCKED）

不引入 OCR。

原因：

• 隐私歧义  
• 误识别风险  
• 重建不稳定

---

## D10 文档输出模型（HARD LOCK）

唯一允许输出：

Raster Secure PDF

安全属性：

MUST NOT 包含 text layer  
MUST NOT 包含 PDF text objects  
MUST NOT 可提取字符串  
MUST NOT 保留原始对象结构  
MUST NOT 使用透明遮罩  
MUST NOT 使用向量覆盖

默认参数：

DPI = 600（固定）  
覆盖 = 100% 不透明  
优先级 = 安全性 > 文件体积

---

## D11 输入模式分类（LOCKED）

Mode A：可解析 PDF（存在 text layer）

允许输出：

• 文本安全副本  
• Raster Secure PDF

Mode B：视觉型文档（无 text layer / 图像）

系统行为：

仅人工标记 → 栅格输出

禁止自动推断。

---

## D12 占位符策略（RASTER ONLY）

占位符是像素，而不是 PDF 文本对象。

默认语言：

English（渲染风险最低）

---

## D13 可逆性策略（LOCKED）

Raster Secure 输出不可逆。

允许撤销范围：

当前会话内存级

禁止：

重建原文 / OCR 反推

---

## D14 工程约束（HARD RULES）

禁止默认持久化：

• localStorage  
• indexedDB  
• 原文日志  
• 命中内容缓存

全部处理必须：

浏览器内存级完成。

---

## D15 Stage 3 所属模块

关键文件：

pdf.js  
raster-export.js  
rules.js  
app.js

任何修改必须进行回归验证。

---

## D16 Rule Engine Responsibility Boundary（HARD LOCK）

状态：Accepted / Locked（架构稳定性约束）

### Context

随着多语种扩展，规则系统存在天然的“复杂度爆炸风险”：

• engine.js 持续膨胀  
• 语言规则相互污染（cross-language contamination）  
• 修改引发非目标语种误伤（regression across packs）  
• 调试成本指数级上升  

Filter 的安全模型依赖 **可预测性（predictability）** 与 **隔离性（isolation）**，  
因此必须明确规则引擎的职责边界。

---

### Decision

**engine.js 是调度器（orchestrator），不是规则容器。**

强制约束：

• engine.js **不得包含语言特征规则**  
• engine.js **不得包含语种相关 regex / 关键词 / 语义判断**  
• engine.js 仅负责：

  – 执行顺序控制（priority resolution）  
  – pack 调用与路由（pack dispatch）  
  – policy 应用（global policy layer）  
  – 命中结果合并（hit aggregation）  

---

**语言相关逻辑必须完全内聚于语言包：**

engine.<lang>.js 承载：

• detect()  
• rules{}  
• placeholders  
• phoneGuard / formatters  
• 任何语种特有策略  

禁止将以下内容写入 engine.js：

• 德语 / 中文 / 英文关键词  
• 本地化号码格式  
• 国家证件模式  
• 语言特定误伤修复  

---

**策略层隔离：**

engine.policy.js 承载：

• 非语言安全策略（language-agnostic policy）  
• 权重 / 风险模型 / fallback  
• 全局默认行为（defaultPriority / baseAlwaysOn）  

policy 文件 **不得引入语言特征**。

---

**修改优先级（强制执行顺序）：**

pack → policy → engine

含义：

✔ 优先在 engine.<lang>.js 修复问题  
✔ 若属于产品策略，再改 engine.policy.js  
✔ 仅当执行机制错误时，才允许修改 engine.js  

---

### Consequences

✅ 优点

• 多语种扩展不会导致 engine 膨胀  
• 不同语言规则天然隔离  
• 回归范围可控  
• 调试路径清晰  
• 风险模型稳定  

---

⚠️ 代价

• 语言包文件数量增加  
• 规则重复度提高（可接受的工程冗余）  
• 需要严格遵守边界纪律  

---

D17 Language Detection & Routing Strategy（LOCKED）

状态：Accepted / Locked（架构扩展约束）

Context

随着多语种规则包（EN / DE / ZH 及未来扩展语言）的增加，
内容语言判定若依赖以下机制将产生结构性风险：

• 固定检测顺序（order bias）
• 单语言关键词短路判定
• engine 内嵌语言判断逻辑
• 检测不确定时静默 fallback

这会导致：

• 语言误判
• 规则包错误路由
• 跨语言误伤（cross-pack regression）
• 扩展新语言时复杂度指数增长

语言检测属于“路由层问题”，
不是规则层问题。

必须将语言识别机制与规则引擎解耦。

Decision

Filter 引入外部离线语言检测库：

franc（MIT License, JS-based n-gram detector）

用途：

仅用于内容语言识别（routing），
不参与规则执行。

Scope Boundary

语言检测库：

✔ 仅用于判断文本所属自然语言
✔ 不参与 PII 识别
✔ 不参与规则匹配
✔ 不参与命中逻辑
✔ 不参与优先级系统

它是路由器（router），不是规则处理器。

Detection Flow（LOCKED）
Input Text
↓
franc(text)
↓
Return top ISO language + confidence score
↓
If confidence ≥ THRESHOLD AND (top - second) ≥ MARGIN:
    ruleEngine = detected language
    mode = lock
Else:
    Trigger modal for manual selection
Confidence Policy（HARD RULE）

必须满足两个条件才允许自动锁定：

置信度 ≥ 预设阈值（例如 0.75）

第一名与第二名差值 ≥ margin（例如 0.10）

否则：

• 不自动切换
• 弹窗提示用户选择语言

禁止：

• 静默 fallback
• 自动在低置信度情况下锁定

UI Policy

为避免 UI 膨胀：

• 不设置常驻语言切换按钮
• 内容默认跟随 UI 语言
• 自动检测后显示当前内容语言状态
• 若不确定 → 弹窗选择
• 提供“Change content language”入口（非按钮堆叠）

Routing Isolation Rule（HARD BOUNDARY）

engine.js 仍不得包含语言特征逻辑。

语言检测属于独立模块（language-router）。

职责分离：

language-router.js
• 调用 franc
• 输出 { lang, confidence }
• 决策是否锁定

engine.js
• 仅执行规则调度
• 不关心语言识别算法

语言包（engine.en.js / engine.de.js）
• 不参与语言识别
• 不包含 detect 顺序控制

Legal & License

franc 使用 MIT License：

• 允许商业使用
• 允许闭源
• 无版权费用
• 需保留 LICENSE 文件

不引入服务器通信。
检测完全在浏览器内完成。

不影响无存储原则（D3）。

Security Model Compatibility

该决策：

✔ 不引入数据存储
✔ 不引入网络调用
✔ 不改变 Raster Secure 模型
✔ 不影响 Rule Engine 隔离原则（D16）

语言识别仅影响规则包选择，
不影响输出安全模型。

Long-Term Scalability

新增语言时：

添加新的语言 pack

在 language-router 中映射 ISO code

无需修改 engine.js

检测层与规则层完全解耦。

Rationale（不可变更理由）

语言检测若与规则引擎耦合：

• 会破坏 D16 边界
• 会导致跨语言污染
• 会导致顺序依赖
• 会引发不可预测行为

Filter 的核心目标是：

可预测、安全、可扩展。

因此语言识别必须：

✔ 独立
✔ 可替换
✔ 不侵入规则层

违反本决策视为架构破坏。
