import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const HOME = process.env.HOME || process.env.USERPROFILE;
const OPENCLAW_DIR = process.env.OPENCLAW_DIR || path.join(HOME, ".openclaw");
const sessionsDir = path.join(OPENCLAW_DIR, "agents/main/sessions");
const openclawConfigPath = path.join(OPENCLAW_DIR, "openclaw.json");
const outputPath = process.env.MODELS_OUTPUT_PATH || "/var/www/html/models-usage/data.json";
const tmpPath = path.join(OPENCLAW_DIR, "workspace/tmp/models-usage-data.json");

const now = new Date();
const dayStart = new Date(now); dayStart.setHours(0,0,0,0);
const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 6); weekStart.setHours(0,0,0,0);
const monthStart = new Date(now); monthStart.setDate(monthStart.getDate() - 29); monthStart.setHours(0,0,0,0);

const ranges = {
  day: { startMs: dayStart.getTime(), models: new Map() },
  week: { startMs: weekStart.getTime(), models: new Map() },
  month: { startMs: monthStart.getTime(), models: new Map() }
};

const toNumber = (v) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const normalizeUsage = (raw) => {
  if (!raw || typeof raw !== "object") return;
  const input = toNumber(raw.input ?? raw.inputTokens ?? raw.input_tokens ?? raw.promptTokens ?? raw.prompt_tokens);
  const output = toNumber(raw.output ?? raw.outputTokens ?? raw.output_tokens ?? raw.completionTokens ?? raw.completion_tokens);
  const cacheRead = toNumber(raw.cacheRead ?? raw.cache_read ?? raw.cache_read_input_tokens ?? raw.cached_tokens ?? raw.prompt_tokens_details?.cached_tokens);
  const cacheWrite = toNumber(raw.cacheWrite ?? raw.cache_write ?? raw.cache_creation_input_tokens);
  const total = toNumber(raw.total ?? raw.totalTokens ?? raw.total_tokens);
  if (input === undefined && output === undefined && cacheRead === undefined && cacheWrite === undefined && total === undefined) return;
  return { input, output, cacheRead, cacheWrite, total };
};

const addUsage = (bucket, usage) => {
  bucket.input += usage.input ?? 0;
  bucket.output += usage.output ?? 0;
  bucket.cacheRead += usage.cacheRead ?? 0;
  bucket.cacheWrite += usage.cacheWrite ?? 0;
  const totalTokens = usage.total ?? (usage.input ?? 0) + (usage.output ?? 0) + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0);
  bucket.totalTokens += totalTokens;
};

const ensureModelBucket = (map, key, meta) => {
  if (!map.has(key)) {
    map.set(key, {
      key,
      provider: meta.provider ?? "unknown",
      model: meta.model ?? "unknown",
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      lastCallTime: null,
      lastCallStopReason: null,
      lastSuccessTime: null,
      lastSuccessStopReason: null,
    });
  }
  return map.get(key);
};

const parseTimestamp = (entry) => {
  if (typeof entry.timestamp === "string") {
    const d = new Date(entry.timestamp);
    if (!Number.isNaN(d.valueOf())) return d.getTime();
  }
  if (typeof entry.message?.timestamp === "number") return entry.message.timestamp;
  return undefined;
};

const processEntry = (entry) => {
  const message = entry?.message;
  if (!message || message.role !== "assistant") return;
  const usage = normalizeUsage(message.usage ?? entry.usage);
  if (!usage) return;
  const ts = parseTimestamp(entry);
  if (!ts) return;
  const provider = message.provider ?? entry.provider;
  const model = message.model ?? entry.model;
  const stopReason = message.stopReason ?? null;
  const tsIso = typeof entry.timestamp === "string" ? entry.timestamp : new Date(ts).toISOString();
  const key = `${provider ?? "unknown"}::${model ?? "unknown"}`;

  for (const [name, range] of Object.entries(ranges)) {
    if (ts < range.startMs) continue;
    const bucket = ensureModelBucket(range.models, key, { provider, model });
    addUsage(bucket, usage);
    if (bucket.lastCallTime === null || tsIso > bucket.lastCallTime) {
      bucket.lastCallTime = tsIso;
      bucket.lastCallStopReason = stopReason;
    }
    const isSuccess = stopReason && !["error", "max_tokens"].includes(stopReason);
    if (isSuccess && (bucket.lastSuccessTime === null || tsIso > bucket.lastSuccessTime)) {
      bucket.lastSuccessTime = tsIso;
      bucket.lastSuccessStopReason = stopReason;
    }
  }
};

const readJsonl = async (filePath) => {
  const fileStream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      processEntry(parsed);
    } catch {}
  }
};

const readCatalog = () => {
  try {
    const raw = fs.readFileSync(openclawConfigPath, "utf-8");
    const oc = JSON.parse(raw);
    const runtimeProviders = oc?.models?.providers ?? {};
    const authProfiles = oc?.auth?.profiles ?? {};
    const agentDefaults = oc?.agents?.defaults ?? {};

    const authModeByProvider = {};
    for (const [, profile] of Object.entries(authProfiles)) {
      if (profile?.provider) authModeByProvider[profile.provider] = profile.mode ?? "unknown";
    }

    const modelsMap = agentDefaults?.models ?? {};

    // Build per-provider model list from agents.defaults.models
    const agentModelsByProvider = {};
    for (const key of Object.keys(modelsMap)) {
      const slash = key.indexOf("/");
      if (slash === -1) continue;
      const prov = key.slice(0, slash), mid = key.slice(slash + 1);
      (agentModelsByProvider[prov] ??= []).push(mid);
    }

    const coveredProviders = new Set(Object.keys(runtimeProviders));
    const allProviderNames = new Set([...coveredProviders, ...Object.keys(agentModelsByProvider)]);

    const providers = Array.from(allProviderNames).sort().map(name => {
      const spec = runtimeProviders[name];
      const coveredIds = new Set((spec?.models ?? []).map(m => m.id ?? ""));
      const models = [
        ...(spec?.models ?? []).map(m => ({
          id: m.id ?? "",
          name: m.name ?? m.id ?? "",
          reasoning: Boolean(m.reasoning),
          input: m.input ?? ["text"],
          contextWindow: m.contextWindow ?? null,
          maxTokens: m.maxTokens ?? null,
          cost: m.cost ?? {},
        })),
        // Add agent-referenced models not in the spec
        ...(agentModelsByProvider[name] ?? [])
          .filter(mid => !coveredIds.has(mid))
          .map(mid => ({ id: mid, name: mid, reasoning: false, input: ["text"], contextWindow: null, maxTokens: null, cost: {} })),
      ];
      return {
        name,
        baseUrl: spec?.baseUrl ?? "",
        api: spec?.api ?? "",
        authMode: authModeByProvider[name] ?? "not-configured",
        models,
      };
    });

    const aliases = Object.fromEntries(
      Object.entries(modelsMap).filter(([, v]) => v?.alias).map(([k, v]) => [k, v.alias])
    );

    return {
      providers,
      agentDefaults: {
        primaryModel: agentDefaults?.model?.primary ?? "",
        fallbacks: agentDefaults?.model?.fallbacks ?? [],
        aliases,
      },
    };
  } catch {
    return { providers: [], agentDefaults: { primaryModel: "", fallbacks: [], aliases: {} } };
  }
};

const run = async () => {
  const entries = await fs.promises.readdir(sessionsDir, { withFileTypes: true }).catch(() => []);
  const files = entries.filter(e => e.isFile() && e.name.endsWith('.jsonl')).map(e => path.join(sessionsDir, e.name));
  for (const file of files) await readJsonl(file);

  const data = {
    updatedAt: Date.now(),
    catalog: readCatalog(),
    ranges: Object.fromEntries(Object.entries(ranges).map(([name, range]) => {
      const models = Array.from(range.models.values()).sort((a,b)=> b.totalTokens - a.totalTokens);
      return [name, { startMs: range.startMs, models }];
    }))
  };

  await fs.promises.mkdir(path.dirname(tmpPath), { recursive: true });
  await fs.promises.writeFile(tmpPath, JSON.stringify(data, null, 2));

  try {
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.promises.copyFile(tmpPath, outputPath);
  } catch (err) {
    try {
      const { execFile } = await import("node:child_process");
      await new Promise((resolve, reject) => {
        execFile("sudo", ["-n", "cp", tmpPath, outputPath], (error) => {
          if (error) return reject(error);
          resolve();
        });
      });
    } catch (sudoErr) {
      console.error(`Copy to ${outputPath} failed: ${err?.message ?? err}`);
      console.error(`Sudo copy failed: ${sudoErr?.message ?? sudoErr}`);
      console.log(`Temp file at ${tmpPath}`);
    }
  }
};

run();
