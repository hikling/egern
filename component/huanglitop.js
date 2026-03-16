/**
 * 黄历看板 - 视觉对齐版
 * ✨ 逻辑：完全保留原代码算法与布局
 * ✨ 变更：颜色配置同步为汇率及网络信息插件风格 (深色 #0E1424 / 浅色 #FFFFFF)
 */

const LUNAR_INFO = [
0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,
0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
0x092e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
0x0d520
];

const GAN="甲乙丙丁戊己庚辛壬癸";
const ZHI="子丑寅卯辰巳午未申酉戌亥";
const MON_S=["正","二","三","四","五","六","七","八","九","十","冬","腊"];
const CHONG=["马","羊","猴","鸡","狗","猪","鼠","牛","虎","兔","龙","蛇"];
const SHA=["南","东","北","西","南","东","北","西","南","东","北","西"];
const BUILD=["建","除","满","平","定","执","破","危","成","收","开","闭"];

const BUILD_YI={
  建:["出行","上任","会友"], 除:["沐浴","扫舍","解除"], 满:["祈福","祭祀","嫁娶"],
  平:["祭祀","修饰"], 定:["嫁娶","安床","交易"], 执:["祈福","祭祀"],
  破:["破屋","求医"], 危:["安床","交易"], 成:["嫁娶","开市","入宅"],
  收:["纳财","捕捉"], 开:["开市","交易","出行"], 闭:["安葬","修墓"]
};

const BUILD_JI={
  建:["动土","安葬"], 除:["嫁娶","入宅"], 满:["安葬","破土"],
  平:["嫁娶","开市"], 定:["诉讼"], 执:["开市","安葬"],
  破:["嫁娶","开市"], 危:["登高","行船"], 成:["诉讼"],
  收:["安葬"], 开:["安葬"], 闭:["嫁娶","出行"]
};

function toJDN(y,m,d){
  let a=Math.floor((14-m)/12);
  let y2=y+4800-a;
  let m2=m+12*a-3;
  return d + Math.floor((153*m2+2)/5) + 365*y2 + Math.floor(y2/4) - Math.floor(y2/100) + Math.floor(y2/400) - 32045;
}

export default async function(ctx){
  const now=new Date();
  const y=now.getFullYear();
  const m=now.getMonth()+1;
  const d=now.getDate();
  const WEEK = ["日","一","二","三","四","五","六"];

  // 农历计算逻辑 (保持原样)
  let offset=(Date.UTC(y,m-1,d)-Date.UTC(1900,0,31))/86400000;
  let i,temp,lY,lM,lD,isL=false;
  for(i=1900;i<2101&&offset>0;i++){
    temp=348;
    for(let j=0x8000;j>0x8;j>>=1) if(LUNAR_INFO[i-1900]&j) temp++;
    if(LUNAR_INFO[i-1900]&0xf) temp+=(LUNAR_INFO[i-1900]&0x10000)?30:29;
    offset-=temp;
  }
  if(offset<0){offset+=temp;i--;}
  lY=i;
  const leap=LUNAR_INFO[lY-1900]&0xf;
  for(i=1;i<13&&offset>0;i++){
    if(leap>0&&i===leap+1&&!isL){ i--; isL=true; temp=(LUNAR_INFO[lY-1900]&0x10000)?30:29; }
    else { temp=(LUNAR_INFO[lY-1900]&(0x10000>>i))?30:29; }
    if(isL&&i===leap+1) isL=false;
    offset-=temp;
    lM=i;
  }
  if(offset<0){offset+=temp;i--;}
  lD=Math.floor(offset)+1;
  const lDStr = lD===10?"初十":lD===20?"二十":lD===30?"三十":["初","十","廿","卅"][Math.floor(lD/10)]+["","一","二","三","四","五","六","七","八","九","十"][lD%10];
  const yIdx = (m>2 || (m===2 && d>=4)) ? (y-4) : (y-5);
  const yGZ = GAN[yIdx%10] + ZHI[yIdx%12];
  const jdn = toJDN(y,m,d);
  const base = toJDN(1900,1,31);
  const index = ((jdn - base + 40) % 60 + 60) % 60;
  const dayStem = index % 10;
  const dayBranch = index % 12;
  const dGZ = GAN[dayStem] + ZHI[dayBranch];
  const mGZ = GAN[(yIdx*2 + m) % 10] + ZHI[(m+1) % 12];
  const chongIndex = dayBranch;
  const chongText = `冲${CHONG[chongIndex]}煞${SHA[chongIndex]}`;
  const buildIndex = (dayBranch - lM + 12) % 12;
  const build = BUILD[buildIndex];

  let yi = BUILD_YI[build] ? BUILD_YI[build].slice() : [];
  let ji = BUILD_JI[build] ? BUILD_JI[build].slice() : [];
  if (dayStem % 2 === 0) { if (!yi.includes("嫁娶")) yi.unshift("嫁娶"); if (!yi.includes("祈福")) yi.unshift("祈福"); }
  else { if (!ji.includes("探病")) ji.unshift("探病"); }
  if ([1,5,8,11].includes(lM)) { if (!yi.includes("祭祀")) yi.unshift("祭祀"); }
  const yiSet = new Set();
  for (const t of yi) { if (!ji.includes(t)) yiSet.add(t); if (yiSet.size >= 6) break; }
  const jiSet = new Set();
  for (const t of ji) { if (!yiSet.has(t)) jiSet.add(t); if (jiSet.size >= 6) break; }
  const allYiPool = Object.values(BUILD_YI).flat();
  const allJiPool = Object.values(BUILD_JI).flat();
  for (const t of allYiPool) { if (yiSet.size >= 6) break; if (!yiSet.has(t) && !jiSet.has(t)) yiSet.add(t); }
  for (const t of allJiPool) { if (jiSet.size >= 6) break; if (!jiSet.has(t) && !yiSet.has(t)) jiSet.add(t); }
  const yiFinal = Array.from(yiSet).slice(0,6);
  const jiFinal = Array.from(jiSet).slice(0,6);

  // ===== 颜色对齐逻辑 (汇率看板/网络信息同款) =====
  const BG = { light: "#FFFFFF", dark: "#0E1424" }; 
  const COLORS = {
    topDate:    { light: "#0f172a", dark: "#D1D5DB" }, // 汇率标题色
    topSub:     { light: "#6b7280", dark: "#A2A2B5" }, // 汇率时间色
    mainYellow: { light: "#92400E", dark: "#FDE047" }, // 汇率强调色
    subText:    { light: "#374151", dark: "#FFFFFFCC" }, // 汇率标签色
    // 宜/忌 容器
    yiText:     { light: "#92400E", dark: "#FDE047" },
    jiText:     { light: "#b91c1c", dark: "#FF3B30" },
    yiBg:       { light: "#FFFBEB", dark: "#2E2412" }, 
    yiBorder:   { light: "#FEF3C7", dark: "#5F4718" },
    jiBg:       { light: "#FEF2F2", dark: "#3A0F0F" }, 
    jiBorder:   { light: "#FEE2E2", dark: "#5A1A1A" }
  };

  return {
    type: "widget",
    padding: [16, 12, 16, 12],
    backgroundColor: BG,
    children: [{
      type: "stack", direction: "column", flex: 1,
      children: [
        { type: "stack", direction: "row", alignItems: "center", children: [
          { type: "text", text: `${y}年${m}月${d}日 星期${WEEK[now.getDay()]}`, font: { size: 10, weight: "bold" }, textColor: COLORS.topDate },
          { type: "spacer" },
          { type: "text", text: `${chongText} | ${"⭐".repeat((index%3)+3)}`, font: { size: 9 }, textColor: COLORS.topSub }
        ]},
        { type: "stack", flex: 1, direction: "column", justifyContent: "center", alignItems: "center", children: [
          { type: "text", text: `${(isL?"闰":"")+MON_S[lM-1]}月${lDStr}`, font: { size: 26, weight: "bold" }, textColor: COLORS.mainYellow, textAlign: "center" },
          { type: "text", text: `${yGZ}年 · ${mGZ}月 · ${dGZ}日`, font: { size: 13, weight: "medium" }, textColor: COLORS.subText, padding: [2,0,0,0] }
        ]},
        { type: "stack", direction: "row", gap: 8, children: [
          { type: "stack", direction: "row", flex: 1, padding: 8, backgroundColor: COLORS.yiBg, cornerRadius: 16, borderRadius: 16, borderWidth: 0.5, borderColor: COLORS.yiBorder, alignItems: "center", children: [
              { type: "stack", width: 28, alignItems: "center", children: [{ type: "text", text: "宜", font: { size: 16, weight: "bold" }, textColor: COLORS.yiText }] },
              { type: "spacer", width: 6 },
              { type: "text", text: yiFinal.slice(0,3).join(' ') + '\n' + yiFinal.slice(3,6).join(' '), font: { size: 10, lineSpacing: 4, weight: "medium" }, textColor: COLORS.yiText, flex: 1 }
          ]},
          { type: "stack", direction: "row", flex: 1, padding: 8, backgroundColor: COLORS.jiBg, cornerRadius: 16, borderRadius: 16, borderWidth: 0.5, borderColor: COLORS.jiBorder, alignItems: "center", children: [
              { type: "stack", width: 28, alignItems: "center", children: [{ type: "text", text: "忌", font: { size: 16, weight: "bold" }, textColor: COLORS.jiText }] },
              { type: "spacer", width: 6 },
              { type: "text", text: jiFinal.slice(0,3).join(' ') + '\n' + jiFinal.slice(3,6).join(' '), font: { size: 10, lineSpacing: 4, weight: "medium" }, textColor: COLORS.jiText, flex: 1 }
          ]}
        ]}
      ]
    }]
  };
}
