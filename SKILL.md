# openclaw-model-dashboard Skill

## 简介

openclaw-model-dashboard 是为 openclaw 体系设计的模型管理与用量导出 skill，支持模型用量导出与模型保存 API 服务。

## 功能点

- 导出模型用量（export-usage）
- 启动模型保存 API 服务（save-api）
- 自动配置 nginx 虚拟目录（setup-nginx）

## 使用方法

### 命令行

```sh
node index.js export-usage   # 导出模型用量
node index.js save-api       # 启动模型保存API服务
node index.js setup-nginx    # 自动配置 nginx 虚拟目录 /models-manager
```

### openclaw agent 调用

```sh
openclaw agent run-skill openclaw-model-dashboard export-usage
openclaw agent run-skill openclaw-model-dashboard save-api
openclaw agent run-skill openclaw-model-dashboard setup-nginx
```

## 参数说明

- export-usage：无参数，直接导出模型用量
- save-api：无参数，直接启动 API 服务
- setup-nginx：无参数，自动检测 nginx 并生成 /models-manager 虚拟目录配置，需有写入 /etc/nginx/conf.d/ 和 reload nginx 权限（建议 sudo）

## 依赖

- Node.js 18+
- scripts/ 目录下的 .mjs 脚本
- 系统需安装 nginx

## 维护者

- 刚
