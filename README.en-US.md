# ClawGoal

[English](README.en-US.md) | [简体中文](README.md)

> An OKR-driven AI Agent workspace that keeps AI work aligned with clear goals, structured plans, and trackable execution. 🚀

ClawGoal uses OKRs to connect goals, projects, tasks, knowledge, automation, and multi-agent collaboration into one execution loop, turning AI from one-off chat into goal-driven progress.

## 🖼️ Screenshots

![ClawGoal Office](demo/image/claw-office.png)

<table width="100%">
  <thead>
    <tr>
      <th width="50%">Agents</th>
      <th width="50%">Projects / OKRs</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><img width="100%" src="demo/image/claw-agent.png" alt="Agent management" /></td>
      <td><img width="100%" src="demo/image/claw-project.png" alt="Project management" /></td>
    </tr>
  </tbody>
</table>

<table width="100%">
  <thead>
    <tr>
      <th width="50%">Cron</th>
      <th width="50%">Resources</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><img width="100%" src="demo/image/claw-cron.png" alt="Cron jobs" /></td>
      <td><img width="100%" src="demo/image/claw-resource.png" alt="Resource management" /></td>
    </tr>
  </tbody>
</table>

<table width="100%">
  <thead>
    <tr>
      <th width="50%">Configuration</th>
      <th width="50%">Settings</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><img width="100%" src="demo/image/claw-config.png" alt="Configuration" /></td>
      <td><img width="100%" src="demo/image/claw-setting.png" alt="Settings" /></td>
    </tr>
  </tbody>
</table>

## 🎯 Why OKR-Driven?

Without goal structure, AI work can become scattered conversations. ClawGoal organizes work through `Objective → Key Results → Project → Task → Agent`, keeping goals, execution, logs, and review aligned.

## ✨ Highlights

### 🎯 OKR, Projects, and Task Loops

- Manage Objectives, Key Results, projects, task trees, and backlog.
- Connect events, notes, wiki pages, and metrics to projects.
- Track OKR progress with metrics, charts, and execution records.

### 🤖 Goal-Aligned Agent Workspace

- Manage multiple agents with built-in or custom roles and project bindings.
- Track sessions, logs, tool calls, workflow messages, and long-term memory.
- Review agent output with diffs, approval, and rejection.

### 🧠 Knowledge, Notes, and Memory

- Manage wiki pages, notes, project knowledge, and sync history.
- Sync knowledge from web pages or Markdown files.
- Support agent memory and semantic search.

### ⏱️ Cron and Automation

- Create cron jobs with enable/disable, manual trigger, history, and logs.
- Trigger agents, shell commands, or runtime tasks.
- Generate model-based execution summaries.

### 🔌 Resources, Runtimes, and MCP

- Manage local and remote runtimes.
- Connect Codex, Claude Code, OpenCode, ACP, and other execution environments.
- Configure MCP servers and skills to extend agent tools.

### 💬 Channels and Webhooks

- Configure Telegram, Slack, Discord, Feishu, DingTalk, WeCom, and more.
- Receive external messages through webhooks.
- Track channel health, ownership, and enabled status.

### 📊 Metrics, Events, and Sharing

- Manage project metrics, data points, charts, and summaries.
- Record events and share public notes or event pages.
- Use the 3D Office workspace as the visual entry point.

## 🧭 Running Modes

| Mode | Best For | Data Location |
| --- | --- | --- |
| Browser Mode | Server, NAS, intranet, or cloud deployment with browser access | Server-side data directory |
| Desktop Mode | Personal offline use with the desktop App | Local machine data directory |

## 🚀 Quick Start

### Option 1: Browser Mode

Download the **ClawGoal Server binary release** for your operating system, extract it, and run:

```bash
./clawgoal serve
```

Windows users can run:

```powershell
.\clawgoal.exe serve
```

After startup, open your browser:

```text
http://localhost:53001
```

### Option 2: Desktop Mode

Download the **ClawGoal desktop App installer** for your operating system, install it, and open the application directly.

Desktop mode starts the bundled local service on your machine, and all data is stored locally by default.

## 🔧 Configuration

The example config is available at:

```text
packages/backend/src/config/config.example.yaml
```

At runtime, ClawGoal reads `~/.clawgoal/data/config.yaml` by default. You can override the data directory with the `DATA_PATH` environment variable.

Key configuration sections include:

- `port`: backend HTTP port.
- `timezone`: UTC offset for cron scheduling and model time injection.
- `lang`: default language, `en-US` or `zh-CN`.
- `database`: currently only `sqlite` is supported.
- `auth` / `jwt`: login mode, default user, and JWT secret.
- `upload`: upload backend and file limits.
- `proxy`: proxy entries for model calls.
- `modelProviders`: model providers and model lists.
- `embeddingModel`: embedding backend for knowledge memory and semantic search.
- `model`: logical model aliases and fallback chains.
- `agent`: agent concurrency and task data paths.
- `claw.skillDirs`: additional custom skill directories.

> ⚠️ For production, change the default username, password, JWT secret, model API keys, and upload settings.

## 📚 User Guide

### Installation

ClawGoal supports two installation modes:

- **Browser Mode**: download the Server binary, deploy it, and access it from a browser.
- **Desktop Mode**: download the desktop App installer and open the App directly.

Before installation, prepare:

- The ClawGoal release package for your operating system
- A secure login password
- A data directory
- An available AI model API key

### Browser Mode Installation

Browser Mode is suitable for servers, NAS, intranet machines, or cloud hosts.

1. Download the **ClawGoal Server binary release** for your operating system.
2. Extract it to a fixed directory.
3. Run `clawgoal` for the first time and follow the prompts to set the data directory, port, account, and password.
4. Start the service:

```bash
./clawgoal serve
```

Windows users can run:

```powershell
.\clawgoal.exe serve
```

Then open:

```text
http://localhost:53001
```

For server deployment, allow the port through the firewall or configure a reverse proxy.

### Desktop Mode Installation

Desktop Mode is suitable for personal local/offline use.

1. Download the **ClawGoal desktop App installer** for your operating system.
2. Install it normally.
3. On first launch, choose a data directory and create an account.
4. After login, open configuration and set your model API key.

Desktop Mode starts the bundled local service on your machine, and data is stored locally by default.

### FAQ

**Browser page cannot open?**

Check whether the service is running, the port is occupied, and the firewall or security group allows access.

**Desktop App cannot open?**

Check system security policy, antivirus blocking, execution permissions, and data directory write permissions.

**Agent does not respond?**

Check the model API key, API base, model name, network connection, and model service balance.

**What should I back up?**

Back up the full data directory, including `config.yaml`, SQLite database, uploaded files, logs, and agent task data.

## 🤝 Contributing

Issues, ideas, and pull requests are welcome. Before contributing, please run:

```bash
pnpm install
pnpm check
pnpm build
```

When adding product features, try to update bilingual copy, config examples, and API documentation where relevant.

## Join the Community

> Please mention ClawGoal when adding a contact.

<table width="100%">
  <thead>
    <tr>
      <th width="50%">WeChat Group</th>
      <th width="50%">QQ Group</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <img style="width:100%;" src="https://open.tecmz.com/code_dynamic/wx" alt="WeChat Group" />
      </td>
      <td>
        <img style="width:100%;" src="https://open.tecmz.com/code_dynamic/qq" alt="QQ Group" />
      </td>
    </tr>
  </tbody>
</table>

## 📄 License

This project is released under the Apache License 2.0. See [LICENSE](/Users/mz/data/project/clawgoal/clawgoal-pro/LICENSE) for details.
