/**
 * 📌 网络·代理·IP纯净度 (颜色对齐汇率插件版)
 * ✨ 变更：浅色模式全面同步汇率插件配色，深色保持 #0E1424
 */
export default async function(ctx) {
  // --- 1. 颜色配置对象 (完全同步汇率插件配色风格) ---
  const BG = { light: "#FFFFFF", dark: "#0E1424" };
  const COLORS = {
    title:  { light: "#0f172a", dark: "#D1D5DB" }, // 标题深蓝灰
    sub:    { light: "#6b7280", dark: "#A2A2B5" }, // 标签灰 (等同汇率 time 颜色)
    main:   { light: "#374151", dark: "#FFFFFF" }, // 主体字 (等同汇率 label 颜色)
    accent: { light: "#92400E", dark: "#FDE047" }, // 强调色 (等同汇率 main 颜色)
    green:  { light: "#059669", dark: "#32D74B" }, // 成功绿
    proxy:  { light: "#7c3aed", dark: "#9945FF" }, // 代理紫
    node:   { light: "#dc2626", dark: "#FF3B30" }, // 落地红
    warn:   { light: "#d97706", dark: "#FFCC00" }  // 警告黄
  };

  const fmtISP = (isp) => {
    if (!isp) return "未知";
    const s = String(isp).toLowerCase();
    if (/移动|mobile|cmcc/i.test(s)) return "中国移动";
    if (/电信|telecom|chinanet/i.test(s)) return "中国电信";
    if (/联通|unicom/i.test(s)) return "中国联通";
    if (/广电|broadcast|cbn/i.test(s)) return "中国广电";
    return String(isp); 
  };

  function computeQuality(ms) {
    if (ms <= 0) return { label: "测速中", color: { light: "#9ca3af", dark: "#BBBBBB" }, icon: "clock" };
    if (ms < 60) return { label: "优秀", color: { light: "#059669", dark: "#34D399" }, icon: "star.fill" };
    if (ms < 150) return { label: "良好", color: { light: "#d97706", dark: "#FBBF24" }, icon: "hand.thumbsup.fill" };
    if (ms < 300) return { label: "较差", color: { light: "#dc2626", dark: "#F87171" }, icon: "exclamationmark.triangle.fill" };
    return { label: "极差", color: { light: "#b91c1c", dark: "#EF4444" }, icon: "xmark.octagon.fill" };
  }

  // --- 2. 数据获取逻辑 (保持不动) ---
  const d = ctx.device || {};
  const isWifi = !!d.wifi?.ssid;
  let netName = isWifi ? (d.wifi.ssid || "Wi-Fi") : (d.cellular?.radio || "蜂窝网络");
  let netIcon = isWifi ? "wifi" : "antenna.radiowaves.left.and.right";
  const localIp = d.ipv4?.address || "未知";

  let pubIp = "获取中...", pubLoc = "获取中...", pubIsp = "获取中...";
  let nodeIp = "获取中...", nodeLoc = "获取中...", nativeText = "检测中...";
  let asnInfo = "获取中...", riskTxt = "获取中...", riskCol = COLORS.warn, riskIc = "clock";
  let costTime = 0;

  try {
    const [resIPIP, resIPPURE] = await Promise.allSettled([
      ctx.http.get('https://myip.ipip.net/json', { timeout: 5000 }),
      ctx.http.get('https://my.ippure.com/v1/info', { timeout: 5000 })
    ]);

    if (resIPIP.status === 'fulfilled') {
      try {
        const body = JSON.parse(await resIPIP.value.text());
        if (body?.data) {
          pubIp = body.data.ip || "获取失败";
          const locArr = body.data.location || [];
          pubLoc = `🇨🇳 ${locArr[1]||""} ${locArr[2]||""}`.trim();
          pubIsp = fmtISP(locArr[4] || locArr[3]);
        }
      } catch(e) { pubIp = "解析失败"; }
    }

    if (resIPPURE.status === 'fulfilled') {
      try {
        const start = Date.now();
        const body = JSON.parse(await resIPPURE.value.text());
        costTime = Date.now() - start || 120;
        nodeIp = body.ip || "获取失败";
        nodeLoc = `${body.country || ''} ${body.city || ''}`.trim();
        nativeText = body.isResidential === true ? "🏠 原生住宅" : "🏢 商业机房";
        asnInfo = body.asn ? `${body.asn} ${body.org || ''}`.trim() : "未知";
        
        const risk = body.fraudScore;
        if (risk !== null && risk !== undefined) {
          if (risk >= 80) { riskTxt = `高危(${risk})`; riskCol = COLORS.node; riskIc = "xmark.shield.fill"; }
          else if (risk >= 40) { riskTxt = `中危(${risk})`; riskCol = COLORS.warn; riskIc = "exclamationmark.shield.fill"; }
          else { riskTxt = `纯净(${risk})`; riskCol = COLORS.green; riskIc = "checkmark.shield.fill"; }
        }
      } catch(e) { nodeIp = "解析失败"; }
    }
  } catch (err) {}

  const q = computeQuality(costTime);

  // 通用行组件
  const Row = (ic, icCol, label, val, valCol) => ({
    type: 'stack', direction: 'row', alignItems: 'center', gap: 5,
    children: [
      { type: 'image', src: `sf-symbol:${ic}`, color: icCol, width: 11, height: 11 },
      { type: 'text', text: label, font: { size: 10 }, textColor: COLORS.sub },
      { type: 'spacer' },
      { type: 'text', text: String(val), font: { size: 10, weight: 'bold', family: 'Menlo' }, textColor: valCol, maxLines: 1 }
    ]
  });

  // --- 3. 返回结构 (对齐汇率插件布局美感) ---
  return {
    type: 'widget',
    padding: [12, 12],
    backgroundColor: BG,
    refreshPolicy: { onNetworkChange: true, onEnter: true },
    children: [
      {
        type: 'stack', direction: 'row', alignItems: 'center',
        children: [
          {
            type: 'stack', direction: 'row', alignItems: 'center', gap: 5,
            children: [
              { type: 'image', src: `sf-symbol:${netIcon}`, color: COLORS.accent, width: 13, height: 13 },
              { type: 'text', text: `${pubIsp} | ${netName}`, font: { size: 12, weight: 'bold' }, textColor: COLORS.title }
            ]
          },
          { type: 'spacer' },
          {
            type: 'stack', direction: 'row', alignItems: 'center', gap: 4,
            children: [
              { type: 'image', src: `sf-symbol:${q.icon}`, width: 11, height: 11, color: q.color },
              { type: 'text', text: `${q.label} ${costTime}ms`, font: { size: 11, weight: 'bold' }, textColor: q.color }
            ]
          }
        ]
      },
      // 分割线 (参考汇率插件样式)
      { type: 'spacer', length: 6 },
      { type: 'stack', height: 1, backgroundColor: COLORS.sub, opacity: 0.1, children: [{type:'text', text:''}] },
      { type: 'spacer', length: 6 },
      // 内容行
      {
        type: 'stack', direction: 'column', gap: 4,
        children: [
          Row("iphone", COLORS.green, "内网地址", localIp, COLORS.green),
          Row("globe", COLORS.proxy, "出口地址", pubIp, COLORS.main),
          Row("mappin.and.ellipse", COLORS.proxy, "出口位置", pubLoc, COLORS.main),
          Row("paperplane.fill", COLORS.node, "落地节点", nodeIp, COLORS.main),
          Row("building.2.fill", COLORS.node, "线路属性", nativeText, COLORS.main),
          Row("mappin.and.ellipse", COLORS.node, "落地位置", nodeLoc, COLORS.main),
          Row("number.square.fill", COLORS.node, "ASN信息", asnInfo, COLORS.main),
          Row(riskIc, riskCol, "欺诈风险", riskTxt, riskCol)
        ]
      }
    ]
  };
}
