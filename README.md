# Agent Context Bridge

让 **Codex 与 DeepSeek Harness 共用最新规则、技能和项目记忆**的本地读取桥。每轮从文件读取上下文，保留来源、项目边界和最近七天交接；Node.js 20+，无第三方运行依赖。

## 能做什么

- 两个助手读取同一份 `RULES.md`、只追加的 `HANDOFF.md` 与项目自己的 `MEMORY.md`。
- 对技能正文、脚本和资源计算指纹，提示助手重新读取变更的技能。
- 按当前工作目录定位项目，避免把相邻项目记忆混入请求。
- 文本超出预算时返回明确的完整补读要求；读取失败明确报错。

它不迁移原始聊天数据库、登录态或工具权限，不自动写总结，也不提供跨设备同步。规则与记忆会进入所接入助手的请求上下文，示例和真实资料请分开管理。

## 一分钟体验

```sh
git clone https://github.com/S4kuzy0/agent-context-bridge.git
cd agent-context-bridge
npm test
npm run demo
```

`demo` 只复制 [examples](examples/) 中的虚构资料到本仓库 `work/demo-*`，输出读取结果；不会接入宿主或读取你的助手资料。`work/` 不纳入版本控制。

## 接入自己的文件

将共享目录组织为：

```text
shared/
  RULES.md
  HANDOFF.md
  skills/              # 可选
your-project/
  MEMORY.md            # 或 docs/project-memory.md
```

将 `config.example.json` 复制为 `config.local.json`，把 `sharedRoot` 改为共享目录的绝对路径；也可设置 `AGENT_SHARED_ROOT`。在实际项目目录运行：

```sh
node /absolute/path/to/agent-context-bridge/src/read-context.cjs --client Codex
```

命令参数可使用 `--root`、`--cwd`、`--session`；`--json` 返回结构化结果，`--no-record` 不写读取回执。配置优先级为显式参数、环境变量、本地配置和默认父目录。真实规则、交接、配置与回执不属于本源码仓库。

## 自动加载

| 宿主 | 入口 | 安装后必须核验 |
| --- | --- | --- |
| Codex | `src/codex-hook.cjs`，`UserPromptSubmit` | 钩子受信任，且目标入口的真实请求包含新上下文 |
| DeepSeek Harness | `src/dsh-plugin.mjs`，动态 `systemPrompt.context` | profile 加载本地包，patch 使用 `insert` |
| 手工或无头流程 | `src/read-context.cjs` | 每轮显式调用，并处理读取失败 |

详细配置、Windows shell 引号和恢复方式见 [安装指南](docs/installation.md)。不要覆盖宿主既有的插件或 hooks。历史实测覆盖 DSH 桌面 Host 和 Codex 原生 TUI；`codex exec` 的该次实测未触发提交钩子，不能据此承诺所有桌面、无头或云端入口自动加载。

## 验证与维护

```sh
node --test test/context.test.cjs
```

现有八项测试覆盖双向更新、技能变化、过长文本补读、项目隔离、北京时间交接范围及失败处理。宿主集成须另外实测；单元测试不代表配置已经在你的宿主生效。[项目记忆](docs/project-memory.md) 记录实现与历史验证范围。

## 许可与来源

原创代码采用 [MIT](LICENSE)。实现使用 Node.js 标准库；宿主产品各自遵循其许可与账号条款。接入参考：[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)、[Codex hooks](https://learn.chatgpt.com/docs/hooks)。
