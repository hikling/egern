export default async function (ctx) {
  const PRIMARY_API = "https://api.exchangerate-api.com/v4/latest/USD"; // 新主 API（base = USD）
  const latestApi = "https://api.exchangerate-api.com/v4/latest/CNY"; // 旧 API 作为备用（base = CNY）
  const histBase  = "https://api.exchangerate.host/";
  const TIMEOUT_MS = 7000;

  const BG = { light: "#FFFFFF", dark: "#071018" };
  const COLORS = {
    title:  { light: "#0f172a", dark: "#D1D5DB" }, // 暗色下不偏黄
    time:   { light: "#6b7280", dark: "#D1D5DB" },
    main:   { light: "#92400E", dark: "#FDE047" },
    label:  { light: "#374151", dark: "#FFFFFFCC" },
    pos:    { light: "#059669", dark: "#86efac" },
    neg:    { light: "#b91c1c", dark: "#ffb4b4" },
    neutral:{ light: "#0f172a", dark: "#FFFFFFCC" },
    sep:    { light: "#E6EEF6", dark: "#163444" }
  };

  // 全部币种表（按之前约定顺序），已加入 THB（泰铢）
  const ALL_CODES = [
    { code: "USD", flag: "🇺🇸" },
    { code: "HKD", flag: "🇭🇰" },
    { code: "JPY", flag: "🇯🇵" },
    { code: "KRW", flag: "🇰🇷" },
    { code: "TRY", flag: "🇹🇷" },
    { code: "EUR", flag: "🇪🇺" },
    { code: "GBP", flag: "🇬🇧" },
    { code: "RUB", flag: "🇷🇺" },
    { code: "THB", flag: "🇹🇭" } // 泰铢
  ];
  const symbolsList = ALL_CODES.map(c => c.code).join(',');

  // 回退示例数据（当接口不可用） — 新增 THB 的示例值
  const SAMPLE_RATES = {
    USD: 0.141, HKD: 1.08, JPY: 18.72, KRW: 170.34,
    TRY: 3.05, EUR: 0.131, GBP: 0.113, RUB: 11.32, THB: 5.10
  };
  const SAMPLE_PREV  = {
    USD: 0.140, HKD: 1.09, JPY: 18.65, KRW: 169.10,
    TRY: 3.02, EUR: 0.132, GBP: 0.115, RUB: 11.10, THB: 5.05
  };

  function fetchJson(url) {
    return new Promise(resolve => {
      try {
        if (typeof $httpClient !== "undefined" && $httpClient.get) {
          $httpClient.get(url, function (err, resp, data) {
            if (err || !data) { resolve(null); return; }
            try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
          });
        } else if (typeof fetch === "function") {
          fetch(url).then(r => r.ok ? r.json().catch(()=>null) : null).then(j => resolve(j)).catch(()=>resolve(null));
        } else if (ctx && ctx.http && typeof ctx.http.get === "function") {
          // try ctx.http.get (some runtimes)
          (async () => {
            try {
              const r = await ctx.http.get(url, { timeout: TIMEOUT_MS });
              if (r && typeof r.json === "function") { resolve(await r.json().catch(()=>null)); }
              else resolve(r);
            } catch (e) { resolve(null); }
          })();
        } else {
          resolve(null);
        }
      } catch (e) { resolve(null); }
    });
  }

  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  const yesterdayStr = ymd(yesterday);

  // ===== 尝试主 API (PRIMARY_API, base=USD)，若成功把数据转换成与原脚本期待的 base=CNY 风格（1 CNY = rates[code] CUR）
  let latestJ = null;
  try {
    const primaryRaw = await Promise.race([fetchJson(PRIMARY_API), new Promise(r => setTimeout(()=>r(null), TIMEOUT_MS))]);
    if (primaryRaw && primaryRaw.rates && typeof primaryRaw.rates.CNY !== "undefined" && Number(primaryRaw.rates.CNY) !== 0) {
      const ratesCNY = {};
      ratesCNY["CNY"] = 1;
      const cnyPerUsd = Number(primaryRaw.rates.CNY); // CNY per USD
      // primaryRaw.rates[code] is CODE per USD
      for (const { code } of ALL_CODES) {
        if (code === "CNY") { ratesCNY["CNY"] = 1; continue; }
        if (typeof primaryRaw.rates[code] !== "undefined" && Number(primaryRaw.rates[code]) !== 0) {
          // CODE per CNY = (CODE per USD) / (CNY per USD)
          ratesCNY[code] = Number(primaryRaw.rates[code]) / cnyPerUsd;
        }
      }
      latestJ = { rates: ratesCNY };
    }
  } catch (e) {
    latestJ = null;
  }

  // ===== 若主 API 不可用，使用备用（original latestApi, base=CNY） =====
  if (!latestJ) {
    try {
      const fallbackRaw = await Promise.race([fetchJson(latestApi), new Promise(r => setTimeout(()=>r(null), TIMEOUT_MS))]);
      if (fallbackRaw && fallbackRaw.rates) {
        latestJ = { rates: {} };
        latestJ.rates["CNY"] = 1;
        for (const { code } of ALL_CODES) {
          if (code === "CNY") { latestJ.rates["CNY"] = 1; continue; }
          if (typeof fallbackRaw.rates[code] !== "undefined") latestJ.rates[code] = Number(fallbackRaw.rates[code]);
        }
      }
    } catch (e) {
      latestJ = null;
    }
  }

  // 如果依然没有数据，回退示例
  if (!latestJ) latestJ = { rates: SAMPLE_RATES };

  // 并行获取昨日数据用于对比（尽量）
  let prevJ = null;
  try {
    const prevUrl = `${histBase}${yesterdayStr}?base=CNY&symbols=${encodeURIComponent(symbolsList)}`;
    prevJ = await Promise.race([fetchJson(prevUrl), new Promise(r => setTimeout(()=>r(null), TIMEOUT_MS))]);
  } catch (e) {
    prevJ = null;
  }

  const latestRates = (latestJ && latestJ.rates) ? latestJ.rates : null;
  const prevRates   = (prevJ && prevJ.rates) ? prevJ.rates : null;
  const isOffline = !latestRates;

  const usedLatest = latestRates || SAMPLE_RATES;
  const usedPrev   = prevRates   || SAMPLE_PREV;

  // 从 API 的 rates（1 CNY = rates[code] CUR）转换为 1 CUR = ? CNY
  function oneToCnyFromRates(ratesObj, code) {
    if (!ratesObj || typeof ratesObj[code] === "undefined" || Number(ratesObj[code]) === 0) return null;
    return 1 / Number(ratesObj[code]);
  }
  function fmt2(v) { return v == null ? "—" : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  // 计算项目并计算涨跌百分比（用于决定颜色/箭头）
  const items = ALL_CODES.map(it => {
    const todayVal = oneToCnyFromRates(usedLatest, it.code);
    const prevVal = oneToCnyFromRates(usedPrev, it.code);
    const pct = (todayVal != null && prevVal != null) ? (todayVal - prevVal) / prevVal : null;
    return { ...it, value: todayVal, pct };
  });

  // 时间显示：优先使用 API 的 time 字段（若存在）
  let fetchedAt = null;
  if (latestJ && latestJ.time_last_updated) {
    fetchedAt = new Date(latestJ.time_last_updated * 1000);
  } else if (latestJ && latestJ.time_last_updated_unix) {
    fetchedAt = new Date(latestJ.time_last_updated_unix * 1000);
  }
  if (!fetchedAt) fetchedAt = new Date();
  const timeDisplay = fetchedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

  // 取主项 USD（顶部）与小组件保留的 4 个币：用 USD + 紧接其后的四个（HKD, JPY, KRW, TRY）
  const mainItem = items.find(i => i.code === "USD") || items[0];
  const MINI_FOUR_CODES = ["HKD","JPY","KRW","TRY"];
  const miniItems = MINI_FOUR_CODES.map(code => items.find(i => i.code === code)).filter(Boolean);

  // ---- 这里是专门为“小正方形”准备的五币种（与你给的 Small 版本对齐） ----
  const SMALL_CODES = ["USD","HKD","JPY","EUR","KRW"];
  const smallItems = SMALL_CODES.map(c => items.find(i => i.code === c)).filter(Boolean);

  function arrowAndColor(pct) {
    const up = pct > 0, down = pct < 0;
    const arrow = up ? "▲" : (down ? "▼" : "—");
    const color = up ? COLORS.pos : (down ? COLORS.neg : COLORS.neutral);
    return { arrow, color };
  }

  // 保留你确认过的 smallRowCompact（紧凑小行）实现
  function smallRowCompact(item) {
    const { arrow, color } = arrowAndColor(item.pct);
    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      padding: [3,0],
      children: [
        { type: "text", text: item.flag, font: { size: 13 }, textColor: { light: COLORS.label.light, dark: COLORS.label.dark }, flex: 0 },
        { type: "spacer", width: 8 },
        { type: "text", text: `1 ${item.code} =`, font: { size: 12 }, textColor: { light: COLORS.label.light, dark: COLORS.label.dark }, flex: 0 },
        { type: "spacer" },
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          children: [
            { type: "text", text: `¥${fmt2(item.value)}`, font: { size: 13, weight: "medium" }, textColor: { light: COLORS.main.light, dark: COLORS.main.dark } },
            { type: "text", text: arrow, font: { size: 12, weight: "bold" }, textColor: { light: color.light, dark: color.dark }, padding: [-8,0,0,0] }
          ]
        }
      ]
    };
  }

  // 检测尺寸
  const family = ctx && ctx.widgetFamily ? ctx.widgetFamily : (typeof $widgetFamily !== "undefined" ? $widgetFamily : "systemMedium");
  const isSmall = family === "systemSmall" || family === "accessoryCircular";

  // ----------------- 小正方形：**仅使用 smallItems（5 个币种）**，没有标题或时间 -----------------
  if (isSmall) {
    return {
      type: "widget",
      padding: [10,10,10,10],
      backgroundColor: { light: BG.light, dark: BG.dark },
      children: [
        // 仅五行（USD, HKD, JPY, EUR, KRW），按你要求的小版紧凑样式
        { type: "stack", direction: "column", gap: 6, children: smallItems.map(it => smallRowCompact(it)) },
        // 离线提示（若需要）
        ...(isOffline ? [{ type: "spacer", height: 6 }, { type: "text", text: "（示例数据）", font: { size: 9 }, textColor: { light: COLORS.time.light, dark: COLORS.time.dark } }] : [])
      ]
    };
  }

  // ----------------- 中/大部件：完全保留你原始的大长方形实现（不动） -----------------
  function rowChild(item) {
    const up = item.pct > 0, down = item.pct < 0;
    const arrow = up ? "▲" : (down ? "▼" : "—");
    const color = up ? COLORS.pos : (down ? COLORS.neg : COLORS.neutral);

    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      padding: [2, 0],
      children: [
        { type: "text", text: `${item.flag} 1 ${item.code} =`, font: { size: 11 }, textColor: { light: COLORS.label.light, dark: COLORS.label.dark } },
        { type: "spacer" },
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          children: [
            {
              type: "text",
              text: `¥${fmt2(item.value)}`,
              font: { size: 11, weight: "medium" },
              textColor: { light: COLORS.main.light, dark: COLORS.main.dark }
            },
            {
              type: "text",
              text: arrow,
              font: { size: 12, weight: "bold" },
              textColor: { light: (up?COLORS.pos.light:(down?COLORS.neg.light:COLORS.neutral.light)), dark: (up?COLORS.pos.dark:(down?COLORS.neg.dark:COLORS.neutral.dark)) },
              padding: [-8, 0, 0, 1]
            }
          ]
        }
      ]
    };
  }

  // === 下面关键改动：构造不包含 USD 的列表给中/大部件下方显示（THB 已包含于 ALL_CODES） ===
  const itemsNoUSD = items.filter(i => i.code !== "USD");
  const half = Math.ceil(itemsNoUSD.length / 2);
  const left = itemsNoUSD.slice(0, half), right = itemsNoUSD.slice(half);

  const children = [
    {
      type: "stack",
      direction: "row",
      children: [
        { type: "text", text: "汇率看板（人民币 / 单位）", font: { size: 11, weight: "semibold" }, textColor: { light: COLORS.title.light, dark: COLORS.title.dark } }
      ]
    },
    {
      type: "stack",
      direction: "row",
      alignItems: "center",
      padding: [10, 0, 0, 0],
      children: [
        { type: "text", text: `${mainItem.flag} 国际美元 ¥${fmt2(mainItem.value)}`, font: { size: 20, weight: "bold" }, textColor: { light: COLORS.main.light, dark: COLORS.main.dark } },
        { type: "spacer" },
        { type: "text", text: timeDisplay, font: { size: 11 }, textColor: { light: COLORS.time.light, dark: COLORS.time.dark } }
      ]
    },
    
    {
        type: "stack",
        direction: "row",
        height: 19,            // 增加容器总高度，给线条呼吸空间
        alignItems: "center",  // 线条在 12px 的高度里居中显示
        margin: [0, 0],        // 既然有了 height，margin 设为 0
        children: [
          {
            type: "stack",
            direction: "row",
            gap: 0,            // 间距为 0，让色块连成实线
            flex: 1,           // 整个容器铺满横向
            children: Array.from({ length: 15 }).map(() => ({
              type: "stack",
              flex: 1,         // 每个色块自动拉伸，铺满总宽度
              height: 1,     // 线条高度
              backgroundColor: COLORS.sep,
              children: [{ type: "text", text: " " }] // 内部填充空格，强制引擎渲染此色块
            }))
          }
        ]
      },
    
    {
      type: "stack",
      direction: "row",
      gap: 8,
      children: [
        { type: "stack", direction: "column", flex: 1, children: left.map(rowChild) },
        { type: "stack", direction: "column", flex: 1, children: right.map(rowChild) }
      ]
    }
  ];

  if (isOffline) {
    children.push({
      type: "text",
      text: "（使用示例数据或历史对比不可用）",
      font: { size: 10 },
      textColor: { light: COLORS.time.light, dark: COLORS.time.dark },
      padding: [6, 0, 0, 0]
    });
  }

  return {
    type: "widget",
    padding: [12, 12, 12, 12],
    backgroundColor: { light: BG.light, dark: BG.dark },
    children
  };
}