#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

function printHelp() {
    console.log(`openclaw-model-dashboard skill

用法:
  node index.js <command> [options]

命令:
  export-usage    导出模型用量
  save-api        启动模型保存API服务
  setup-nginx     自动配置 nginx 虚拟目录 /models-manager
  help            显示帮助

示例:
  node index.js export-usage
  node index.js save-api
  node index.js setup-nginx
`);
}

function setupNginx() {
    try {
        // 检查 nginx 是否安装
        execSync("nginx -v", { stdio: "ignore" });
    } catch (e) {
        console.error("未检测到 nginx，请先安装 nginx。");
        process.exit(1);
    }

function installSkill() {
    // 自动安装 Node.js 依赖
    try {
        console.log('Installing Node.js dependencies...');
        execSync('npm install', { stdio: 'inherit' });
        console.log('Node.js dependencies installed.');
    } catch (e) {
        console.error('npm install failed. Please check your environment.');
        process.exit(1);
    }

    // 检查 nginx 是否安装
    let nginxInstalled = false;
    try {
        execSync('nginx -v', { stdio: 'ignore' });
        nginxInstalled = true;
        console.log('nginx is installed. Proceeding to configure /models-manager virtual directory...');
    } catch (e) {
        console.warn('nginx is not installed. Please install nginx for web access.');
    }

    if (nginxInstalled) {
        setupNginx();
        console.log('Skill installation complete. Web access is ready at /models-manager.');
    } else {
        console.log('Skill installation complete. Web access is NOT ready. Please install nginx and rerun install.');
    }
}
    // 生成 nginx 配置内容
    const projectDir = process.cwd();
    const confPath = "/etc/nginx/conf.d/models-manager.conf";
    const staticPath = path.join(projectDir);
    const confContent = `
location /models-manager/ {
    alias ${staticPath}/;
    index index.html;
    try_files $uri $uri/ /index.html;
}
`;

    try {
        fs.writeFileSync(confPath, confContent);
        console.log("nginx 配置已写入:", confPath);
    } catch (e) {
        console.error("写入 nginx 配置失败，请检查权限（建议 sudo）。");
        process.exit(1);
    }

    try {
        execSync("nginx -s reload");
        console.log("nginx 已重载。");
        console.log("请访问：http://<服务器地址>/models-manager");
    } catch (e) {
        console.error("nginx 重载失败，请手动执行 nginx -s reload。");
    }
}

const cmd = process.argv[2];

switch (cmd) {
    case "export-usage":
        execSync("node ./scripts/models-usage-export.mjs", {
            stdio: "inherit",
        });
        break;
    case "save-api":
        execSync("node ./scripts/models-save-api.mjs", { stdio: "inherit" });
        break;
    case "setup-nginx":
        setupNginx();
        break;
        case "install":
            installSkill();
            break;
    case "help":
    case undefined:
        printHelp();
        break;
    default:
        console.error("未知命令:", cmd);
        printHelp();
        process.exit(1);
}
