# Shared agent context

Codex 与 DeepSeek Harness 共用本地规则、技能和项目记忆。读取桥在新一轮请求中读取最新文件，并把文件正文及来源交给当前助手。它不调用模型 API，也不运行后台服务。

## 文件布局

共享根目录包含 `RULES.md`、只追加的 `HANDOFF.md`、`skills/` 和本项目目录 `bridge/`。每个项目继续维护自己的 `MEMORY.md` 或 `docs/project-memory.md`。双方处理同一项目时应打开同一项目目录。

`src/shared-context.cjs` 是公共读取实现。`src/codex-hook.cjs` 对接 Codex `UserPromptSubmit`；`src/dsh-plugin.mjs` 注册 DSH 的必需动态上下文提供者；`src/read-context.cjs` 是人工核查和指令兜底入口。

读取根目录依次取显式参数、`AGENT_SHARED_ROOT` 环境变量、本地 `config.local.json` 或本项目的父目录。不要把真实规则、个人配置、交接日志、读取回执或备份放进代码仓库。

## 运行与安装

需要 Node.js 20 或更新版本；无第三方依赖。以实际项目为当前目录，运行：

```powershell
node <bridge-directory>/src/read-context.cjs --client Codex
node <bridge-directory>/src/read-context.cjs --client DSH
```

复制 `config.example.json` 为 `config.local.json` 并设置共享根。Codex 用户配置目录的 `hooks.json` 中，为 `UserPromptSubmit` 添加调用 Node 与 `src/codex-hook.cjs` 的命令处理器。使用可读取实际项目的执行环境，设置合理超时，并允许完整上下文长度；处理器命令必须引用绝对路径。通过 Codex 的 `/hooks` 页面审核并信任本条钩子。修改钩子定义后需要重新审核。

DSH profile 中把本项目以本地 `link:` 依赖注册为 `dsh-shared-context`，再在 `cordis.patch.yml` 中添加：

```yaml
- id: shared-agent-context
  name: dsh-shared-context
```

安装时保存并核对原配置备份，不覆盖既有插件或钩子。已有会话是否重新加载配置由宿主决定；重新打开会话或重启应用后核查实际回执。宿主尚未加载时，共享规则应要求助手执行上述读取命令。

当前安装版的 `codex exec` 实测没有触发 UserPromptSubmit，不能依靠该钩子在 headless 路径拦截请求。云端编排也不能假定支持本地命令钩子。原生钩子是否受信任、是否登记为启用、是否在某条执行路径实际触发，是不同的检查项。全局每轮读取约定及命令兜底覆盖缺少原生调用的路径，执行效果仍依赖助手遵守该约定。

## 行为与边界

- 每次调用都从磁盘读取规则、最近七天的交接条目和当前项目记忆；原生适配器每次都附上规则全文。
- 技能指纹覆盖正文、脚本和资源。检测到变更时提示重新读取技能；不自动运行技能，不替另一端授予工具权限。
- Git 工作目录向上定位最近的 `.git`；非 Git 目录优先寻找最近的既有记忆目录。不同项目的记忆不会批量注入当前请求。
- 大文件放不进上下文时提供明确的完整补读要求，保持待处理状态；不会声称已传递全文。
- 缺少规则或交接文件时明确失败；Codex 返回阻止继续的结构化结果，DSH 停止该次上下文组装。
- 助手仍负责在有产出的工作结束前更新项目记忆，并追加事实、验证与下一步。文件指纹不能代替语义记录。
- 原始会话数据库、登录状态、插件授权和正在思考的上下文均不参与同步。没有配置跨设备同步。

本地 `.bridge-state` 为不同工具、会话及项目分别保存文件指纹与读取时间，不保存完整聊天。状态可重新生成，应用是否真正运行了提供者仍需结合实际请求或日志核验。

## 验证

```powershell
node --test test/context.test.cjs
```

测试覆盖双向更新、技能脚本变化与移除、大文件处理、项目隔离、北京时间范围、读取失败和 DSH 提供者重新读取。宿主注册验证与真实用户请求验收应分开记录，不能仅凭测试通过宣称应用已热加载。

设计与当前验证记录见 [项目记忆](docs/project-memory.md)。本机回滚入口为 `scripts/restore-local.ps1`，依赖未上传的 `installation.local.json` 和实际备份。回滚前校验文件仍与安装时一致，遇到后续修改时停止并合并；不会删除本项目目录。

## 参考

- [Codex skills](https://learn.chatgpt.com/docs/build-skills)
- [Codex hooks](https://learn.chatgpt.com/docs/hooks)
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- [sync-agents](https://github.com/zhiqiangme/sync-agents)：检索于北京时间 2026-10-19，MIT，零 Star，最近实质提交为北京时间 2026-10-11 13:11。其配置链接思路与本项目相符；本项目没有引入其代码或安装程序，以保留现有专属配置并增加每轮项目记忆读取。
