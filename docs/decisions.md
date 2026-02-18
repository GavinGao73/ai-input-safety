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
