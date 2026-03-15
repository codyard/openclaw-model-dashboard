#!/usr/bin/env node
// Minimal save API for models-manager dashboard
import http from "node:http";
import fs from "node:fs";
import { execFile } from "node:child_process";

import path from "node:path";
const HOME = process.env.HOME || process.env.USERPROFILE;
const OPENCLAW_DIR = process.env.OPENCLAW_DIR || path.join(HOME, ".openclaw");
const OPENCLAW_CONFIG = process.env.OPENCLAW_CONFIG || path.join(OPENCLAW_DIR, "openclaw.json");
const PORT = 8789;

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));
const writeJson = (p, data) => fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf-8");

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.method === "POST" && req.url === "/api/set-primary") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => {
      try {
        const { primary } = JSON.parse(body);
        if (!primary || typeof primary !== "string") throw new Error("primary must be a non-empty string");
        const oc = readJson(OPENCLAW_CONFIG);
        const modelCfg = ((oc.agents ??= {}).defaults ??= {}).model ??= {};
        const old = modelCfg.primary ?? "";
        modelCfg.primary = primary;
        writeJson(OPENCLAW_CONFIG, oc);
        console.log(`[save-api] primary updated: ${old} → ${primary}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, primary, restarting: true }));
        setTimeout(() => {
          execFile("systemctl", ["--user", "restart", "openclaw-gateway.service"], (err) => {
            if (err) console.error("[save-api] restart gateway failed:", err.message);
            else console.log("[save-api] openclaw-gateway restarted");
          });
        }, 300);
      } catch (e) {
        console.error("[save-api] error:", e.message);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  if (req.method === "POST" && req.url === "/api/save-fallbacks") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => {
      try {
        const { fallbacks } = JSON.parse(body);
        if (!Array.isArray(fallbacks)) throw new Error("fallbacks must be array");
        const oc = readJson(OPENCLAW_CONFIG);
        const modelCfg = ((oc.agents ??= {}).defaults ??= {}).model ??= {};
        const old = modelCfg.fallbacks ?? [];
        modelCfg.fallbacks = fallbacks;
        writeJson(OPENCLAW_CONFIG, oc);
        console.log(`[save-api] fallbacks updated: ${old.length} → ${fallbacks.length} items`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, count: fallbacks.length, restarting: true }));
        // 重启 gateway 使配置生效
        setTimeout(() => {
          execFile("systemctl", ["--user", "restart", "openclaw-gateway.service"], (err) => {
            if (err) console.error("[save-api] restart gateway failed:", err.message);
            else console.log("[save-api] openclaw-gateway restarted");
          });
        }, 300);
      } catch (e) {
        console.error("[save-api] error:", e.message);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, "127.0.0.1", () => console.log(`[save-api] listening on 127.0.0.1:${PORT}`));
