#!/usr/bin/env node
// buyur PocketBase MCP sunucusu (stdio).
//
// Neden kendi sunucumuz: PocketBase için resmî bir MCP paketi yok ve bu token
// canlı veritabanının superuser yetkisini taşıyor — üçüncü parti bir npm
// paketine teslim etmek yerine bağımlılıksız, okunabilir bir köprü yazıyoruz.
//
// Kullanım: .mcp.json içinden `node scripts/mcp-pocketbase.mjs` olarak çalışır.
// Gerekli env: POCKETBASE_API_URL + POCKETBASE_ADMIN_TOKEN
// Opsiyonel:  POCKETBASE_ADMIN_EMAIL + POCKETBASE_ADMIN_PASSWORD
//             (token süresi dolduğunda otomatik tazelemek için)
//             POCKETBASE_MCP_ALLOW_WRITE=1 → yazma araçlarını açar

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "pocketbase", version: "1.0.0" };

const PB_URL = (process.env.POCKETBASE_API_URL || "").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || "";
const ALLOW_WRITE = process.env.POCKETBASE_MCP_ALLOW_WRITE === "1";

let token = process.env.POCKETBASE_ADMIN_TOKEN || "";

const log = (...args) => console.error("[mcp-pocketbase]", ...args);

if (!PB_URL) {
  log("POCKETBASE_API_URL tanımlı değil; sunucu başlatılamıyor.");
  process.exit(1);
}

// ---------------------------------------------------------------- PocketBase

// Superuser oturumunu tazele. Token'lar süreli olduğu için e-posta/parola
// verilmişse 401 alındığında sessizce yeniden giriş yapıyoruz.
async function refreshToken() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return false;
  const res = await fetch(
    `${PB_URL}/api/collections/_superusers/auth-with-password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    }
  );
  if (!res.ok) {
    log("Superuser girişi başarısız:", res.status);
    return false;
  }
  const data = await res.json();
  token = data.token;
  log("Superuser token'ı tazelendi.");
  return true;
}

// Token'ın süresi JWT'nin `exp` alanından okunur. Süresi dolmuş token'ı
// PocketBase 401 ile REDDETMEZ: isteği misafir olarak işler. Herkese açık
// okumalar çalışmaya devam eder ama yazma kurala takılıp 404 döner — 401'e
// bakarak tazelemek bu yüzden hiç tetiklenmiyordu. Süre bitmeden tazelenir.
function tokenExpiresSoon(value, marginSeconds = 60) {
  try {
    const payload = JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.exp !== "number" || payload.exp - marginSeconds <= Date.now() / 1000;
  } catch {
    return true;
  }
}

async function pbFetch(path, init = {}, retry = true) {
  if ((!token || tokenExpiresSoon(token)) && !(await refreshToken()) && token && tokenExpiresSoon(token, 0)) {
    throw new Error(
      "PocketBase superuser token'ının süresi dolmuş ve yenilenemedi. .mcp.json içindeki " +
        "POCKETBASE_ADMIN_TOKEN'ı yenileyin veya POCKETBASE_ADMIN_EMAIL/POCKETBASE_ADMIN_PASSWORD ekleyin."
    );
  }
  const res = await fetch(`${PB_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
      ...(init.headers || {}),
    },
  });

  if (res.status === 401 && retry && (await refreshToken())) {
    return pbFetch(path, init, false);
  }

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const message =
      (body && body.message) || `PocketBase ${res.status} hatası`;
    const detail = body && body.data ? ` ${JSON.stringify(body.data)}` : "";
    throw new Error(
      `${message} (HTTP ${res.status}, ${path})${detail}` +
        (res.status === 401
          ? "\nToken süresi dolmuş olabilir. .mcp.json içindeki " +
            "POCKETBASE_ADMIN_TOKEN'ı yenileyin veya POCKETBASE_ADMIN_EMAIL/" +
            "POCKETBASE_ADMIN_PASSWORD ekleyin."
          : "")
    );
  }
  return body;
}

// CLAUDE.md kuralı: filtreler string birleştirmeyle değil, parametreyle yazılır.
// PocketBase REST'te bağlı parametre yok; SDK'nın pb.filter() davranışını
// burada birebir taklit ediyoruz.
function quote(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (value instanceof Date) return `'${value.toISOString().replace("T", " ")}'`;
  const raw = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `'${raw.replace(/'/g, "\\'")}'`;
}

function applyFilter(filter, params) {
  if (!filter) return "";
  if (!params) return filter;
  return filter.replace(/\{:(\w+)\}/g, (match, key) =>
    key in params ? quote(params[key]) : match
  );
}

function query(pairs) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(pairs)) {
    if (value !== undefined && value !== null && value !== "") {
      sp.set(key, String(value));
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// -------------------------------------------------------------------- Araçlar

const readOnlyTools = [
  {
    name: "pb_collections",
    description:
      "Tüm koleksiyonları listeler (id, ad, tip, alan adları). Şemayı keşfetmek için ilk durak.",
    inputSchema: {
      type: "object",
      properties: {
        filterName: {
          type: "string",
          description:
            "Opsiyonel: koleksiyon adında geçen metin (ör. 'products'). Boşsa hepsi döner.",
        },
      },
    },
    handler: async ({ filterName }) => {
      const data = await pbFetch(
        `/api/collections${query({ perPage: 300, sort: "name" })}`
      );
      let items = data.items || [];
      if (filterName) {
        const needle = filterName.toLowerCase();
        items = items.filter((c) => c.name.toLowerCase().includes(needle));
      }
      return items.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        fields: (c.fields || c.schema || []).map((f) => f.name),
      }));
    },
  },
  {
    name: "pb_schema",
    description:
      "Tek bir koleksiyonun tam şemasını döndürür: alan tipleri, zorunluluk, select seçenekleri, ilişkiler ve API kuralları.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string", description: "Koleksiyon adı veya id'si" },
      },
      required: ["collection"],
    },
    handler: async ({ collection }) => {
      const c = await pbFetch(
        `/api/collections/${encodeURIComponent(collection)}`
      );
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        system: c.system,
        fields: c.fields || c.schema,
        indexes: c.indexes,
        rules: {
          listRule: c.listRule,
          viewRule: c.viewRule,
          createRule: c.createRule,
          updateRule: c.updateRule,
          deleteRule: c.deleteRule,
        },
      };
    },
  },
  {
    name: "pb_list",
    description:
      "Bir koleksiyondaki kayıtları listeler. filter içinde {:ad} yer tutucusu kullanın ve değerleri params ile verin — string birleştirme yapmayın.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string", description: "Koleksiyon adı" },
        filter: {
          type: "string",
          description:
            "PocketBase filtresi, ör. \"business = {:id} && active = true\"",
        },
        params: {
          type: "object",
          description: "filter içindeki {:ad} yer tutucularının değerleri",
        },
        sort: { type: "string", description: "ör. '-created' veya 'order,name'" },
        expand: { type: "string", description: "ör. 'business,category'" },
        fields: {
          type: "string",
          description: "Dönecek alanlar, ör. 'id,name,price' (payload'ı küçültür)",
        },
        page: { type: "number", description: "Varsayılan 1" },
        perPage: { type: "number", description: "Varsayılan 50, en fazla 500" },
      },
      required: ["collection"],
    },
    handler: async (args) => {
      const perPage = Math.min(args.perPage || 50, 500);
      return pbFetch(
        `/api/collections/${encodeURIComponent(args.collection)}/records` +
          query({
            filter: applyFilter(args.filter, args.params),
            sort: args.sort,
            expand: args.expand,
            fields: args.fields,
            page: args.page || 1,
            perPage,
          })
      );
    },
  },
  {
    name: "pb_get",
    description: "Tek bir kaydı id ile getirir.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        id: { type: "string" },
        expand: { type: "string" },
        fields: { type: "string" },
      },
      required: ["collection", "id"],
    },
    handler: (args) =>
      pbFetch(
        `/api/collections/${encodeURIComponent(args.collection)}/records/${encodeURIComponent(args.id)}` +
          query({ expand: args.expand, fields: args.fields })
      ),
  },
  {
    name: "pb_count",
    description:
      "Filtreye uyan kayıt sayısını döndürür (kayıtları çekmeden). Analitik ve limit kontrolleri için.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        filter: { type: "string" },
        params: { type: "object" },
      },
      required: ["collection"],
    },
    handler: async (args) => {
      const data = await pbFetch(
        `/api/collections/${encodeURIComponent(args.collection)}/records` +
          query({
            filter: applyFilter(args.filter, args.params),
            perPage: 1,
            fields: "id",
            skipTotal: 0,
          })
      );
      return { totalItems: data.totalItems };
    },
  },
];

const writeTools = [
  {
    name: "pb_create",
    description:
      "Yeni kayıt oluşturur. Yalnızca POCKETBASE_MCP_ALLOW_WRITE=1 iken çalışır.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        data: { type: "object", description: "Alan adı → değer" },
      },
      required: ["collection", "data"],
    },
    handler: (args) =>
      pbFetch(
        `/api/collections/${encodeURIComponent(args.collection)}/records`,
        { method: "POST", body: JSON.stringify(args.data) }
      ),
  },
  {
    name: "pb_update",
    description:
      "Mevcut kaydı günceller (kısmi). Yalnızca POCKETBASE_MCP_ALLOW_WRITE=1 iken çalışır.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        id: { type: "string" },
        data: { type: "object" },
      },
      required: ["collection", "id", "data"],
    },
    handler: (args) =>
      pbFetch(
        `/api/collections/${encodeURIComponent(args.collection)}/records/${encodeURIComponent(args.id)}`,
        { method: "PATCH", body: JSON.stringify(args.data) }
      ),
  },
  {
    name: "pb_delete",
    description:
      "Kaydı siler. Geri alınamaz. Yalnızca POCKETBASE_MCP_ALLOW_WRITE=1 iken çalışır.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        id: { type: "string" },
      },
      required: ["collection", "id"],
    },
    handler: async (args) => {
      await pbFetch(
        `/api/collections/${encodeURIComponent(args.collection)}/records/${encodeURIComponent(args.id)}`,
        { method: "DELETE" }
      );
      return { deleted: args.id };
    },
  },
];

// Yazma araçları varsayılan olarak kapalı: bu token canlı veritabanına
// superuser yetkisiyle bağlanıyor, kazara yazma riski taşımamalı.
const tools = ALLOW_WRITE ? [...readOnlyTools, ...writeTools] : readOnlyTools;
const toolMap = new Map(tools.map((t) => [t.name, t]));

// ------------------------------------------------------------- JSON-RPC katmanı

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function replyError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handle(msg) {
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case "initialize": {
      const asked = params?.protocolVersion;
      const version = PROTOCOL_VERSIONS.includes(asked)
        ? asked
        : PROTOCOL_VERSIONS[0];
      reply(id, {
        protocolVersion: version,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      });
      return;
    }

    case "notifications/initialized":
    case "notifications/cancelled":
      return;

    case "ping":
      if (!isNotification) reply(id, {});
      return;

    case "tools/list":
      reply(id, {
        tools: tools.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
        })),
      });
      return;

    case "tools/call": {
      const tool = toolMap.get(params?.name);
      if (!tool) {
        const hidden = writeTools.some((t) => t.name === params?.name);
        reply(id, {
          isError: true,
          content: [
            {
              type: "text",
              text: hidden
                ? `'${params.name}' yazma aracı kapalı. Açmak için .mcp.json içinde POCKETBASE_MCP_ALLOW_WRITE=1 yapın.`
                : `Bilinmeyen araç: ${params?.name}`,
            },
          ],
        });
        return;
      }
      try {
        const result = await tool.handler(params.arguments || {});
        reply(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        });
      } catch (err) {
        reply(id, {
          isError: true,
          content: [{ type: "text", text: String(err?.message || err) }],
        });
      }
      return;
    }

    default:
      if (!isNotification) replyError(id, -32601, `Desteklenmeyen metot: ${method}`);
  }
}

let buffer = "";
// Uçuştaki istekler: stdin kapandığında yanıtsız bırakmamak için sayıyoruz.
const inflight = new Set();

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      log("Geçersiz JSON satırı atlandı.");
      continue;
    }
    const task = handle(msg).catch((err) => {
      log("İşlenmemiş hata:", err);
      if (msg.id !== undefined && msg.id !== null) {
        replyError(msg.id, -32603, String(err?.message || err));
      }
    });
    inflight.add(task);
    task.finally(() => inflight.delete(task));
  }
});

process.stdin.on("end", async () => {
  // Yanıtı beklenen istek varsa önce onları bitir, sonra kapan.
  while (inflight.size) await Promise.all([...inflight]);
  process.exit(0);
});
log(
  `hazır → ${PB_URL} (${tools.length} araç, yazma ${ALLOW_WRITE ? "AÇIK" : "kapalı"})`
);
