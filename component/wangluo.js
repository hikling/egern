// NetworkInfo_RestoreAndDetectHosting.js
// 恢复公网 IP/城市，并恢复并强化“机房 / 家宽”检测（含 RDAP），保留状态渐变与右上质量标签
// 【新增特性】全量添加 SF Symbols 小图标匹配
export default async function (ctx) {
  var debug = false; // 需要调试时设为 true

  // ---------- helpers ----------
  function safeJson(resp) {
    if (!resp || typeof resp.json !== "undefined" && typeof resp.json !== "function") return Promise.resolve(null);
    try {
      return resp.json().catch(function(){ return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  function median(arr) {
    if (!arr || !arr.length) return null;
    var a = arr.slice().sort(function(x,y){ return x - y; });
    var m = Math.floor(a.length / 2);
    return (a.length % 2 === 1) ? a[m] : Math.round((a[m-1] + a[m]) / 2);
  }

  function rssiToPercent(rssi) {
    if (typeof rssi !== "number" || isNaN(rssi)) return null;
    var pct = Math.round(((rssi + 100) / 50) * 100);
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    return pct;
  }

  // 修改点：为每种网络质量匹配对应的小图标
  function computeQuality(latency, signalPercent) {
    if (latency == null && signalPercent == null) return { label: "未知", color: "#BBBBBB", icon: "questionmark.circle" };
    var score = 50;
    if (latency != null) {
      if (latency < 30) score += 40;
      else if (latency < 80) score += 25;
      else if (latency < 200) score += 5;
      else score -= 20;
    }
    if (signalPercent != null) score += Math.round((signalPercent - 50) / 4);
    if (score < 0) score = 0;
    if (score > 100) score = 100;
    if (score >= 75) return { label: "优秀", color: "#34D399", icon: "checkmark.circle.fill" };
    if (score >= 50) return { label: "良好", color: "#FBBF24", icon: "checkmark.circle" };
    if (score >= 25) return { label: "较差", color: "#F87171", icon: "exclamationmark.triangle.fill" };
    return { label: "差", color: "#EF4444", icon: "xmark.octagon.fill" };
  }

  // ---------- latency ----------
  async function measureLatency(endpoints, timeout) {
    timeout = timeout || 3000;
    var results = [];
    if (!Array.isArray(endpoints)) return null;
    for (var i = 0; i < endpoints.length; i++) {
      try {
        var start = Date.now();
        await ctx.http.get(endpoints[i], { timeout: timeout });
        var t = Date.now() - start;
        if (t >= 0) results.push(t);
      } catch (e) {
        // ignore
      }
    }
    return median(results);
  }

  // ---------- public IP & geo (multi-source) ----------
  async function fetchPublicInfo() {
    var out = { ipv4: null, ipv6: null, city: null, isp: null, asn: null, raws: {} };

    async function tryApi(name, url, timeout) {
      try {
        var r = await ctx.http.get(url, { timeout: timeout || 4000 });
        if (r && r.status === 200) {
          var j = await safeJson(r);
          out.raws[name] = j || {};
          return j || null;
        }
      } catch (e) {
        // ignore
      }
      return null;
    }

    // priority: ip.sb -> ipapi -> ipinfo -> ipwhois
    try {
      var a = await tryApi("ipsb", "https://api.ip.sb/geoip", 4500);
      if (a) {
        if (!out.ipv4 && (a.ip || a.ipv4)) out.ipv4 = a.ip || a.ipv4;
        if (!out.ipv6 && a.ipv6) out.ipv6 = a.ipv6;
        if (!out.city && a.city) out.city = a.city;
        if (!out.isp && a.isp) out.isp = a.isp;
        if (!out.asn && a.asn) out.asn = a.asn;
      }
    } catch (e) {}

    try {
      var b = await tryApi("ipapi", "https://ipapi.co/json/", 4000);
      if (b) {
        if (!out.ipv4 && b.ip) out.ipv4 = b.ip;
        if (!out.ipv6 && b.ipv6) out.ipv6 = b.ipv6;
        if (!out.city && b.city) out.city = b.city;
        if (!out.isp && b.org) out.isp = b.org;
        if (!out.asn && b.asn) out.asn = b.asn;
      }
    } catch (e) {}

    try {
      var c = await tryApi("ipinfo", "https://ipinfo.io/json", 4000);
      if (c) {
        if (!out.ipv4 && c.ip) out.ipv4 = c.ip;
        if (!out.city && c.city) out.city = c.city;
        if (!out.isp && c.org) out.isp = c.org;
        if (!out.asn && c.org && typeof c.org === "string") {
          var m = c.org.match(/^AS\d+/);
          if (m) out.asn = m[0];
        }
      }
    } catch (e) {}

    try {
      var d = await tryApi("ipwhois", "https://ipwhois.app/json/", 4000);
      if (d) {
        if (!out.ipv4 && d.ip) out.ipv4 = d.ip;
        if (!out.city && d.city) out.city = d.city;
        if (!out.isp && (d.isp || (d.asn && d.asn.name))) out.isp = d.isp || (d.asn && d.asn.name);
        if (!out.asn && d.asn && (d.asn.asn || d.asn)) out.asn = d.asn.asn || d.asn;
      }
    } catch (e) {}

    return out;
  }

  // ---------- RDAP lookup (strong evidence for hosting) ----------
  async function fetchRDAP(ip) {
    if (!ip) return null;
    try {
      var url = "https://rdap.org/ip/" + encodeURIComponent(ip);
      var r = await ctx.http.get(url, { timeout: 5000 });
      if (r && r.status === 200) {
        var j = await safeJson(r);
        return j || null;
      }
    } catch (e) {
      // ignore RDAP failures (some envs block)
    }
    return null;
  }

  // ---------- hosting detection (enhanced) ----------
  // 返回 { type: "机房/数据中心" | "住宅/移动" | "未知", reason: "..." }
  async function detectHostingEnhanced(publicInfo) {
    try {
      var parts = [];
      if (publicInfo && publicInfo.isp) parts.push(String(publicInfo.isp));
      if (publicInfo && publicInfo.asn) parts.push(String(publicInfo.asn));
      if (publicInfo && publicInfo.raws) {
        for (var k in publicInfo.raws) {
          try {
            var o = publicInfo.raws[k];
            if (!o) continue;
            if (typeof o === "string") parts.push(o);
            else {
              if (o.org) parts.push(o.org);
              if (o.isp) parts.push(o.isp);
              if (o.asn_organization) parts.push(o.asn_organization);
              if (o.asn) parts.push(o.asn);
              // add short serialized version
              try { parts.push(JSON.stringify(o).slice(0,200)); } catch (e) {}
            }
          } catch (e) {}
        }
      }

      // If have ipv4, try RDAP for stronger clues
      var ip = publicInfo && publicInfo.ipv4 ? publicInfo.ipv4 : null;
      var rdap = null;
      if (ip) {
        rdap = await fetchRDAP(ip);
        if (rdap) {
          try {
            if (rdap.name) parts.push(rdap.name);
            if (rdap.handle) parts.push(rdap.handle);
            if (rdap.entities && Array.isArray(rdap.entities)) {
              for (var ei = 0; ei < rdap.entities.length; ei++) {
                try {
                  var ent = rdap.entities[ei];
                  if (!ent) continue;
                  if (typeof ent === "string") parts.push(ent);
                  else {
                    if (ent.fn) parts.push(ent.fn);
                    if (ent.roles) parts.push((ent.roles||[]).join(" "));
                    if (ent.vcardArray) parts.push(JSON.stringify(ent.vcardArray).slice(0,200));
                  }
                } catch (e) {}
              }
            }
            if (rdap.registrant) parts.push(String(rdap.registrant));
            if (rdap.network && rdap.network.name) parts.push(rdap.network.name);
          } catch (e) {}
        }
      }

      var text = parts.join(" ").toLowerCase();

      // datacenter/cloud keywords
      var dcKeywords = [
        "amazon", "amazonaws", "ec2", "google cloud", "gcp", "google", "microsoft", "azure",
        "digitalocean", "linode", "ovh", "hetzner", "cloudflare", "fastly", "vultr",
        "aliyun", "tencent", "oracle", "rackspace", "akamai", "cdn", "hosting",
        "data center", "datacenter", "colo", "colocation", "serverfarm"
      ];
      for (var i = 0; i < dcKeywords.length; i++) {
        if (text.indexOf(dcKeywords[i]) !== -1) {
          return { type: "机房/数据中心", reason: "match:" + dcKeywords[i], rdap: rdap || null };
        }
      }

      // residential / mobile keywords
      var resKeywords = [
        "telecom", "t-mobile", "att", "verizon", "chinaunicom", "中国联通", "中国电信", "中国移动",
        "移动", "comcast", "spectrum", "home", "residential", "isp", "cable", "broadband", "unicom"
      ];
      for (var j = 0; j < resKeywords.length; j++) {
        if (text.indexOf(resKeywords[j]) !== -1) {
          return { type: "住宅/移动", reason: "match:" + resKeywords[j], rdap: rdap || null };
        }
      }

      // check rdap network type fields
      try {
        if (rdap && rdap.network && rdap.network.name) {
          var nn = String(rdap.network.name).toLowerCase();
          if (nn.indexOf("cloud") !== -1 || nn.indexOf("amazon") !== -1 || nn.indexOf("digitalocean") !== -1) {
            return { type: "机房/数据中心", reason: "rdap.network", rdap: rdap };
          }
        }
      } catch (e) {}

      // heuristic
      try {
        if (publicInfo && publicInfo.asn && typeof publicInfo.asn === "string") {
          var asnLower = String(publicInfo.asn).toLowerCase();
          if (asnLower.indexOf("cloud") !== -1 || asnLower.indexOf("hosting") !== -1 || asnLower.indexOf("data") !== -1) {
            return { type: "机房/数据中心", reason: "asn_hint", rdap: rdap || null };
          }
        }
      } catch (e) {}

      return { type: "未知", reason: "no_match", rdap: rdap || null };
    } catch (err) {
      return { type: "未知", reason: "error", rdap: null };
    }
  }

  // ---------- main ----------
  try {
    var device = ctx.device || {};
    var wifi = device.wifi || {};
    var cellular = device.cellular || {};
    var ipv4local = device.ipv4 || {};
    var ipv6local = device.ipv6 || {};

    // title/icon
    var title = "未连接";
    var icon = "exclamationmark.triangle";
    var iconColor = "#FFFFFF";
    if (wifi && wifi.ssid) { title = wifi.ssid; icon = "wifi"; iconColor = "#A8DADC"; }
    else if (cellular && (cellular.radio || cellular.carrier || cellular.carrierName)) {
      var radio = String(cellular.radio || "").toUpperCase().replace(/\s/g, "");
      if (radio.indexOf("NR") !== -1 || radio === "5G") title = "5G";
      else if (radio.indexOf("LTE") !== -1) title = "4G";
      else title = radio || (cellular.carrier || cellular.carrierName) || "蜂窝";
      icon = "simcard.fill"; iconColor = "#F4A261";
    }

    // parallel: latency and public info
    var latencyEndpoints = [
      "https://www.google.com/generate_204",
      "https://www.apple.com/library/test/success.html",
      "https://cloudflare.com/cdn-cgi/trace"
    ];
    var pLatency = measureLatency(latencyEndpoints, 3500);
    var pPublic = fetchPublicInfo();
    var measuredLatency = null;
    var publicInfo = null;
    try {
      var all = await Promise.all([pLatency, pPublic]);
      measuredLatency = all[0];
      publicInfo = all[1];
    } catch (e) {
      try { measuredLatency = await pLatency; } catch (ee) { measuredLatency = null; }
      try { publicInfo = await pPublic; } catch (ee2) { publicInfo = null; }
    }

    // signal
    var rssi = null;
    if (wifi && typeof wifi.rssi !== "undefined") rssi = Number(wifi.rssi);
    else if (cellular && typeof cellular.rssi !== "undefined") rssi = Number(cellular.rssi);
    var signalPct = rssi != null ? rssiToPercent(rssi) : null;

    // quality
    var quality = computeQuality(measuredLatency, signalPct);

    // hosting detection - enhanced with RDAP
    var hostingRes = await detectHostingEnhanced(publicInfo || {});
    var hostingLabel = (hostingRes && hostingRes.type) ? hostingRes.type : "未知";

    // gradient by quality
    var gradientColors = ["#2F1C53", "#4B0082", "#6A5ACD"];
    if (quality.label === "优秀") gradientColors = ["#064E3B", "#065F46", "#047857"];
    else if (quality.label === "良好") gradientColors = ["#451A03", "#78350F", "#92400E"];
    else if (quality.label === "较差") gradientColors = ["#450A0A", "#7F1D1D", "#991B1B"];
    else if (quality.label === "差") gradientColors = ["#3F0A0A", "#5F1111", "#7F1D1D"];

    // 修改点：使用对象数组存储文本和图标
    var lines = [];

    if (ipv4local && ipv4local.address && ipv4local.address !== "0.0.0.0") 
      lines.push({ text: "内网 IPv4: " + ipv4local.address, icon: "house.fill" });
    else 
      lines.push({ text: "内网 IPv4: -", icon: "house.fill" });

    if (ipv6local && ipv6local.address && String(ipv6local.address).indexOf(":") !== -1) 
      lines.push({ text: "内网 IPv6: " + ipv6local.address, icon: "network" });

    var pub4 = publicInfo && publicInfo.ipv4 ? publicInfo.ipv4 : null;
    if (pub4) lines.push({ text: "公网 IP: " + pub4, icon: "globe" });
    else lines.push({ text: "公网 IP: -", icon: "globe" });

    // only show city (位置)
    var city = publicInfo && publicInfo.city ? publicInfo.city : null;
    if (city) lines.push({ text: "位置: " + city, icon: "location.fill" });

    // hosting / network type 匹配图标
    var typeIcon = "server.rack"; // 默认用服务器图标
    if (hostingLabel.indexOf("住宅") !== -1) typeIcon = "building.2.fill";
    else if (hostingLabel === "未知") typeIcon = "questionmark.circle";
    lines.push({ text: "网络类型: " + hostingLabel, icon: typeIcon });

    // signal & latency
    if (rssi != null) lines.push({ text: "信号: " + rssi + " dBm (" + signalPct + "%)", icon: "antenna.radiowaves.left.and.right" });
    if (measuredLatency != null) lines.push({ text: "延迟: " + measuredLatency + " ms", icon: "stopwatch.fill" });

    // debug info
    if (debug) {
      try {
        var dbg = [];
        if (publicInfo && publicInfo.raws) dbg.push("sources:" + Object.keys(publicInfo.raws).join(","));
        if (publicInfo && publicInfo.isp) dbg.push("isp:" + publicInfo.isp);
        if (publicInfo && publicInfo.asn) dbg.push("asn:" + publicInfo.asn);
        if (publicInfo && publicInfo.city) dbg.push("city:" + publicInfo.city);
        if (hostingRes && hostingRes.reason) dbg.push("reason:" + hostingRes.reason);
        if (hostingRes && hostingRes.rdap) dbg.push("rdap:" + (hostingRes.rdap && hostingRes.rdap.network && hostingRes.rdap.network.name ? hostingRes.rdap.network.name : "y"));
        var dbgLine = dbg.join(" | ") || "no_public_debug";
        if (dbgLine.length > 220) dbgLine = dbgLine.slice(0,217) + "...";
        lines.splice(0, 0, { text: "DBG: " + dbgLine, icon: "ladybug.fill" });
      } catch (e) {}
    }

    // build children
    var children = [];

    // 修改点：顶部横幅中增加右侧质量标签的图标 Stack
    children.push({
      type: "stack",
      direction: "row",
      alignItems: "center",
      gap: 8,
      children: [
        { type: "image", src: "sf-symbol:" + icon, width: 20, height: 20, color: quality.color || iconColor },
        { type: "text", text: title, font: { size: "title3", weight: "bold" }, textColor: "#FFFFFF", flex: 1, minScale: 0.9 },
        // 右上角质量带图标
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 4,
          children: [
             { type: "image", src: "sf-symbol:" + quality.icon, width: 14, height: 14, color: quality.color || "#BBBBBB" },
             { type: "text", text: quality.label, font: { size: "subheadline", weight: "semibold" }, textColor: quality.color || "#BBBBBB" }
          ]
        }
      ]
    });

    // 修改点：将每一行组装为带有左侧图标的 Stack
    for (var li = 0; li < lines.length; li++) {
      var item = lines[li];
      var color = (li >= lines.length - 2) ? "#BBBBBB" : "#E0E0E0";
      children.push({
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 6,
        children: [
          { type: "image", src: "sf-symbol:" + item.icon, width: 14, height: 14, color: color },
          { 
            type: "text", 
            text: item.text, 
            font: { size: "subheadline" }, 
            textColor: color, 
            textAlign: "left", 
            lineLimit: 1, 
            minScale: 0.82,
            flex: 1
          }
        ]
      });
    }

    return {
      type: "widget",
      padding: [10, 12, 10, 12],
      gap: 8,
      backgroundGradient: { type: "linear", colors: gradientColors, startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } },
      borderRadius: "auto",
      children: children
    };

  } catch (err) {
    try { console.log("[NetworkInfo_Error]", err && (err.stack || err.message || String(err))); } catch (e) {}
    var em = (err && (err.message || String(err))) || "未知错误";
    if (em.length > 200) em = em.slice(0, 197) + "...";
    return {
      type: "widget",
      padding: [12, 12, 12, 12],
      backgroundGradient: { type: "linear", colors: ["#2F1C53", "#4B0082"], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } },
      borderRadius: "auto",
      children: [
        { type: "text", text: "NetworkInfo 错误", font: { size: "title3", weight: "bold" }, textColor: "#FFFFFF" },
        { type: "text", text: em, font: { size: "subheadline" }, textColor: "#FFDDDD", lineLimit: 5, minScale: 0.7 }
      ]
    };
  }
}
