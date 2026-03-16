export default async function (ctx) {
  const PRIMARY_API = "https://api.exchangerate-api.com/v4/latest/USD"; 
  const TIMEOUT_MS = 7000;

  // 深色模式背景锁定 #0E1424
  const BG = { light: "#FFFFFF", dark: "#0E1424" };
  const COLORS = {
    title:  { light: "#0f172a", dark: "#D1D5DB" }, 
    time:   { light: "#6b7280", dark: "#D1D5DB" },
    main:   { light: "#92400E", dark: "#FDE047" },
    label:  { light: "#374151", dark: "#FFFFFFCC" },
    sep:    { light: "#E6EEF6", dark: "#163444" }
  };

  // 币种配置
  const LEFT_CODES = [
    { code: "GBP", flag: "🇬🇧", name: "英镑" },
    { code: "EUR", flag: "🇪🇺", name: "欧元" },
    { code: "MYR", flag: "🇲🇾", name: "马来" },
    { code: "SGD", flag: "🇸🇬", name: "坡币" }
  ];
  const RIGHT_CODES = [
    { code: "HKD", flag: "🇭🇰", name: "港币" },
    { code: "JPY", flag: "🇯🇵", name: "日元" },
    { code: "KRW", flag: "🇰🇷", name: "韩元" },
    { code: "THB", flag: "🇹🇭", name: "泰铢" }
  ];

  const ALL_CODES = [...LEFT_CODES, ...RIGHT_CODES, { code: "USD", flag: "🇺🇸", name: "美元" }];

  async function fetchJson(url) {
    try {
      const r = await ctx.http.get(url, { timeout: TIMEOUT_MS });
      return typeof r.json === "function" ? await r.json() : JSON.parse(await r.text());
    } catch (e) { return null; }
  }

  let latestJ = await fetchJson(PRIMARY_API);
  let usedRates = {};
  
  // 实时时间
  const now = new Date();
  const timeDisplay = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

  if (latestJ && latestJ.rates && latestJ.rates.CNY) {
    const cnyPerUsd = latestJ.rates.CNY;
    ALL_CODES.forEach(c => {
      if (latestJ.rates[c.code]) usedRates[c.code] = latestJ.rates[c.code] / cnyPerUsd;
    });
  }

  const fmt2 = (v) => v == null ? "—" : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // 左侧行渲染
  function rowLeft(it) {
    const val = usedRates[it.code] ? 1 / usedRates[it.code] : null;
    return {
      type: "stack", direction: "row", alignItems: "center", padding: [2, 0],
      children: [
        { type: "text", text: `${it.flag} 1 ${it.code} ${it.name} =`, font: { size: 10 }, textColor: COLORS.label },
        { type: "spacer" },
        { type: "text", text: `¥${fmt2(val)}`, font: { size: 11, weight: "bold" }, textColor: COLORS.main }
      ]
    };
  }

  // 右侧行渲染：在数值和代码间加入空格隔离
  function rowRight(it) {
    const val = usedRates[it.code] || null;
    return {
      type: "stack", direction: "row", alignItems: "center", padding: [2, 0],
      children: [
        { type: "text", text: `${it.flag} ${fmt2(val)} ${it.code} ${it.name} =`, font: { size: 10 }, textColor: COLORS.label },
        { type: "spacer" },
        { type: "text", text: `¥1.00`, font: { size: 11, weight: "bold" }, textColor: COLORS.main }
      ]
    };
  }

  return {
    type: "widget",
    padding: [12, 12, 12, 12],
    backgroundColor: BG,
    children: [
      {
        type: "stack", direction: "row", alignItems: "center",
        children: [
          { type: "text", text: "实时汇率看板（CNY 双向对照）", font: { size: 11, weight: "semibold" }, textColor: COLORS.title },
          { type: "spacer" },
          { type: "text", text: timeDisplay, font: { size: 11 }, textColor: COLORS.time }
        ]
      },
      {
        type: "stack", direction: "row", alignItems: "center", padding: [8, 0, 0, 0],
        children: [
          { type: "text", text: `🇺🇸 国际美元 ¥${fmt2(usedRates["USD"] ? 1/usedRates["USD"] : 0)}`, font: { size: 20, weight: "bold" }, textColor: COLORS.main }
        ]
      },
      {
        type: "stack", direction: "row", height: 16, alignItems: "center",
        children: [{ type: "stack", flex: 1, height: 1, backgroundColor: COLORS.sep, children: [{ type: "text", text: " " }] }]
      },
      {
        type: "stack", direction: "row", gap: 10, // 增大双列间距
        children: [
          { type: "stack", direction: "column", flex: 1.2, children: LEFT_CODES.map(rowLeft) },
          { type: "stack", direction: "column", flex: 1.4, children: RIGHT_CODES.map(rowRight) }
        ]
      }
    ]
  };
}
