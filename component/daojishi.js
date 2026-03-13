/**
 * -L 是农历  例如05-20-L 
 * +  是正计时 例如2026-05-20+ 这样天数从20号开始算起
 * 最上面那个是正计时 需要设置变量 'MAIN_TITLE' 'MAIN_DATE'
 * 下面六个 左边变量分别是 'L1_T' 'L1_D' 'L2_T' 'L2_D''L3_T' 'L3_D'
 * 下面六个 右边变量分别是 'R1_T' 'R1_D' 'R2_T' 'R2_D''R3_T' 'R3_D'
 */

export default async function (ctx) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  // 1. 主目标计算 (出生天数)
  const mainTitle = ctx.env.MAIN_TITLE || "已出生天数";
  const birthDate = new Date(ctx.env.MAIN_DATE || "1997-06-20");
  const passedDays = Math.floor((todayStart - birthDate) / 86400000);

  // 2. 列表解析
  const getList = (side) => {
    let list = [];
    for (let i = 1; i <= 3; i++) {
      const t = ctx.env[`${side}${i}_T`];
      const d = ctx.env[`${side}${i}_D`];
      if (t && d) {
        let days;
        if (d.endsWith("+")) {
          const dateStr = d.replace("+", "");
          days = Math.floor((todayStart - new Date(dateStr)) / 86400000);
        } else if (d.endsWith("-L")) {
          days = getLunarRemaining(d.replace("-L", ""), now);
        } else if (d.length === 5) {
          days = getRemaining(d, now);
        } else {
          days = Math.ceil((new Date(d) - now) / 86400000);
        }
        list.push({ title: t, days: Math.max(0, days) });
      }
    }
    return list;
  };

  const leftList = getList("L");
  const rightList = getList("R");

  return {
    type: "widget",
    padding: [16, 12, 16, 12],
    backgroundGradient: {
      type: "linear",
      colors: ["#0891B2", "#4F46E5", "#0F172A"],
      stops: [0, 0.45, 1],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 }
    },
    refreshAfter: new Date(Date.now() + 3600000).toISOString(),
    children: [
      // 顶部栏
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        padding: [0, 4, 0, 4],
        children: [
          { type: "image", src: "sf-symbol:clock.fill", width: 10, height: 10, color: "#22D3EE" },
          { type: "spacer", width: 5 },
          { type: "text", text: "2026 DIGITAL LIFE", font: { size: "caption2", weight: "black" }, textColor: "#FFFFFF55" },
          { type: "spacer" },
          { type: "text", text: timeStr, font: { size: "caption2" }, textColor: "#FFFFFF33" }
        ]
      },
      { type: "spacer", height: 12 },

      // 主展示区
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        padding: [0, 6, 0, 6],
        children: [
          { 
            type: "text", 
            text: mainTitle, 
            font: { size: 14, weight: "bold" }, 
            textColor: "#22D3EE", // 主标题改为青蓝
            flex: 1 
          },
          {
            type: "stack",
            direction: "row",
            alignItems: "end",
            gap: 2,
            children: [
              { 
                type: "text", 
                text: `${passedDays}`, 
                font: { size: 28, weight: "bold" }, 
                textColor: "#FDE047" // 大数字改为黄色
              },
              { 
                type: "text", 
                text: "天", 
                font: { size: 9, weight: "bold" }, 
                textColor: "#FDE04744", // 单位跟随黄色透明度
                padding: [0, 0, 4, 0] 
              }
            ]
          }
        ]
      },

      { type: "spacer", height: 22 },

      // 下方胶囊列表 (白色数字)
      {
        type: "stack",
        direction: "row",
        gap: 8, 
        children: [
          {
            type: "stack", direction: "column", flex: 1, gap: 7,
            children: leftList.map(item => buildCapsule(item))
          },
          {
            type: "stack", direction: "column", flex: 1, gap: 7,
            children: rightList.map(item => buildCapsule(item))
          }
        ]
      },
      { type: "spacer" }
    ]
  };
}

function buildCapsule(item) {
  return {
    type: "stack",
    direction: "row",
    alignItems: "center",
    padding: [8, 10, 8, 10],
    backgroundColor: "#FFFFFF0C", 
    borderRadius: 10, 
    borderWidth: 0.5,
    borderColor: "#FFFFFF12",
    children: [
      { type: "text", text: item.title, font: { size: 10 }, textColor: "#FFFFFF88", flex: 1, maxLines: 1 },
      {
        type: "stack", direction: "row", alignItems: "end", gap: 1.5,
        children: [
          { type: "text", text: `${item.days}`, font: { size: 11, weight: "bold" }, textColor: "#FFFFFFEE" },
          { type: "text", text: "天", font: { size: 7 }, textColor: "#FFFFFF33", padding: [0, 0, 0.5, 0] }
        ]
      }
    ]
  };
}

// 农历计算逻辑 (保持稳定)
function getLunarRemaining(mdStr, now) {
  const [lMonth, lDay] = mdStr.split("-").map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const formatter = new Intl.DateTimeFormat('zh-u-ca-chinese', { month: 'numeric', day: 'numeric' });
  const check = (year) => {
    for (let i = 0; i < 400; i++) {
      const date = new Date(year, 0, 1 + i);
      const parts = formatter.formatToParts(date);
      let m = 0, d = 0;
      parts.forEach(p => {
        if (p.type === 'month') m = parseInt(p.value);
        if (p.type === 'day') d = parseInt(p.value);
      });
      if (m === lMonth && d === lDay) return date;
    }
    return null;
  };
  let targetDate = check(today.getFullYear());
  if (!targetDate || targetDate < today) targetDate = check(today.getFullYear() + 1);
  return Math.ceil((targetDate - today) / 86400000);
}

function getRemaining(mdStr, now) {
  const [m, d] = mdStr.split("-").map(Number);
  let target = new Date(now.getFullYear(), m - 1, d);
  if (target < new Date(now.getFullYear(), now.getMonth(), now.getDate())) target.setFullYear(now.getFullYear() + 1);
  return Math.ceil((target - now) / 86400000);
}
