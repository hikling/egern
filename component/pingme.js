// PingMe 多账户签到，Egern 原生脚本。
// 基于「怎么肥事 & yaowuliu」多账户版，参考 mickeu 的 Egern 单账户实现。
// 与旧版共用存储键；旧抓包的 URL 会在使用时重新解析，修复参数重复编码。
const STORE_KEY = 'pingme_accounts_v1';
const MAX_VIDEO = 5;
const VIDEO_DELAY = 8000;
const ACCOUNT_GAP = 3500;
const API = 'https://api.pingmeapp.net/app/';
const LOGIN_EXPIRED = /设备已退出登录|重新登录|登录已失效|登录过期|未登录|请先登录|已被注销/;

export default async function(ctx) {
  try {
    if (ctx.request) {
      if (String(ctx.env?.PINGME_CAPTURE ?? 'true').toLowerCase() === 'false') {
        console.log('PingMe 参数抓取已关闭');
        return;
      }
      captureAccount(ctx);
    } else {
      await runAll(ctx);
    }
  } catch (error) {
    console.log('PingMe 脚本异常：' + error);
    ctx.notify({ title: '❌ PingMe 任务异常', body: String(error) });
  }
}

function parseQuery(url) {
  const query = (String(url).split('?')[1] || '').split('#')[0];
  const result = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const index = pair.indexOf('=');
    const rawKey = index < 0 ? pair : pair.slice(0, index);
    const rawValue = index < 0 ? '' : pair.slice(index + 1);
    const decode = value => {
      try { return decodeURIComponent(value.replace(/\+/g, '%20')); }
      catch (_) { return value; }
    };
    result[decode(rawKey)] = decode(rawValue);
  }
  return result;
}

function headersToObject(headers) {
  const result = {};
  if (headers?.forEach) {
    headers.forEach((value, name) => { result[name] = value; });
  } else {
    for (const [name, value] of Object.entries(headers || {})) result[name] = value;
  }
  return result;
}

function requestHeaders(capture) {
  const headers = headersToObject(capture.headers);
  for (const name of Object.keys(headers)) {
    if (/^(host|content-length|connection|proxy-connection|transfer-encoding|accept-encoding)$/i.test(name) || name.startsWith(':')) {
      delete headers[name];
    }
  }
  // 登录请求使用抓取时的原始 User-Agent 与设备 ID。
  return headers;
}

function paramsFor(capture) {
  // 旧版 paramsRaw 保留的是百分号编码后的值，优先从原始 URL 解码一次。
  return capture.url ? parseQuery(capture.url) : { ...capture.paramsRaw };
}

function signedUrl(path, capture, deviceId, signingKey) {
  const params = paramsFor(capture);
  delete params.sign;
  delete params.signDate;
  if (deviceId && params.uniquedeviceid) params.uniquedeviceid = deviceId;
  params.signDate = utcSignDate();
  const base = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&');
  params.sign = MD5(base + signingKey);
  const query = Object.keys(params).map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join('&');
  return API + path + '?' + query;
}

function utcSignDate() {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
}

function accountEmail(capture) {
  return String(paramsFor(capture).email || '').trim();
}

function identity(params) {
  if (params.email) return 'email:' + String(params.email).toLowerCase();
  for (const key of ['userId', 'userid', 'uid', 'accountId', 'accountid']) {
    if (params[key]) return key.toLowerCase() + ':' + params[key];
  }
  const ignored = new Set(['sign', 'signDate', 'timestamp', 'ts', 'nonce', 'random', 'reqTime', 'reqId', 'requestId']);
  return 'capture:' + Object.keys(params).filter(key => !ignored.has(key)).sort().map(key => `${key}=${params[key]}`).join('&');
}

function emptyStore() { return { version: 2, accounts: {}, order: [] }; }

function loadStore(ctx) {
  const raw = ctx.storage.get(STORE_KEY);
  if (!raw) return emptyStore();
  try {
    const store = JSON.parse(raw);
    if (!store || typeof store.accounts !== 'object' || !store.accounts) return emptyStore();
    store.order = Array.isArray(store.order) ? store.order.filter(id => store.accounts[id]) : Object.keys(store.accounts);
    for (const id of Object.keys(store.accounts)) if (!store.order.includes(id)) store.order.push(id);
    return store;
  } catch (_) {
    return emptyStore();
  }
}

function saveStore(ctx, store) {
  store.version = 2;
  ctx.storage.set(STORE_KEY, JSON.stringify(store));
}

function captureAccount(ctx) {
  const url = String(ctx.request.url || '');
  if (!url.includes('/app/queryBalanceAndBonus')) return;
  const params = parseQuery(url);
  if (!Object.keys(params).length) return;
  const capture = { url, paramsRaw: params, headers: headersToObject(ctx.request.headers) };
  const email = accountEmail(capture);
  const id = MD5(identity(params)).slice(0, 12);
  const store = loadStore(ctx);
  const previousId = store.order.find(key => {
    const existing = store.accounts[key];
    if (!existing?.capture) return key === id;
    return key === id ||
      (email && String(existing.email || accountEmail(existing.capture)).toLowerCase() === email.toLowerCase()) ||
      identity(paramsFor(existing.capture)) === identity(params);
  });
  const previous = previousId ? store.accounts[previousId] : null;
  const position = previousId ? store.order.indexOf(previousId) : store.order.length;
  if (previousId && previousId !== id) delete store.accounts[previousId];
  store.order[position] = id;
  const alias = previous?.alias || `账号${position + 1}`;
  store.accounts[id] = {
    id, alias, email, capture,
    createdAt: previous?.createdAt || Date.now(),
    updatedAt: Date.now()
  };
  saveStore(ctx, store);
  ctx.notify({ title: previous ? '🔄 PingMe 账号已更新' : '✅ PingMe 账号已入库', body: `${alias}${email ? ` (${email})` : ''}\n当前共 ${store.order.length} 个账号` });
  console.log(`PingMe ${alias} 抓取成功，账号总数 ${store.order.length}`);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function fakeDeviceId() {
  const hex = length => Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase();
  return `${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(12)}PingMeIOS`;
}

async function fetchApi(ctx, path, capture, headers, deviceId, signingKey) {
  const url = signedUrl(path, capture, deviceId, signingKey);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ctx.http.get(url, { headers, timeout: 20000 });
      if (response.status >= 500 && attempt < 3) {
        await sleep(1500);
        continue;
      }
      return await response.json();
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(1500);
    }
  }
}

function replyText(data) {
  return String(data?.retmsg || `接口错误 (${data?.retcode ?? '未知'})`);
}

function isExpired(data) {
  return data?.retcode !== 0 && LOGIN_EXPIRED.test(replyText(data));
}

async function runAccount(ctx, account, index, total, signingKey) {
  const title = `[账号${index + 1}/${total} ${account.alias || `账号${index + 1}`}]`;
  const email = account.email || accountEmail(account.capture);
  const lines = [title + (email ? `\n📧 ${email}` : '')];
  const capture = account.capture;
  const headers = requestHeaders(capture);
  // 仅视频奖励使用随机 ID；整次账号任务共用一个。关闭开关后沿用抓取时的 ID。
  const randomVideoId = String(ctx.env?.PINGME_RANDOM_DEVICE_ID ?? 'true').toLowerCase() !== 'false';
  const videoId = randomVideoId ? fakeDeviceId() : null;
  let expired = false;
  let balance = null;

  async function call(path, deviceId) {
    const data = await fetchApi(ctx, path, capture, headers, deviceId, signingKey);
    if (isExpired(data)) expired = true;
    return data;
  }

  try {
    const query = await call('queryBalanceAndBonus');
    if (query.retcode === 0) {
      balance = Number(query.result?.balance);
      lines.push(`💰 余额：${query.result?.balance} Coins`);
    } else lines.push(`⚠️ 查询：${replyText(query)}`);
    if (expired) return expiredResult(lines);

    const checkIn = await call('checkIn');
    if (checkIn.retcode === 0) lines.push(`✅ 签到：${String(checkIn.result?.bonusHint || checkIn.retmsg || '成功').replace(/\n/g, ' ')}`);
    else lines.push(`⚠️ 签到：${replyText(checkIn)}`);
    if (expired) return expiredResult(lines);

    for (let i = 1; i <= MAX_VIDEO; i++) {
      await sleep(i === 1 ? 1500 : VIDEO_DELAY);
      try {
        const video = await call('videoBonus', videoId);
        if (video.retcode === 0) lines.push(`🎬 视频${i}：+${video.result?.bonus ?? '?'} Coins`);
        else {
          lines.push(`⏸ 视频${i}：${replyText(video)}`);
          if (expired) return expiredResult(lines);
          break;
        }
      } catch (error) {
        lines.push(`❌ 视频${i}：${String(error)}`);
        break;
      }
    }

    try {
      const latest = await call('queryBalanceAndBonus');
      if (latest.retcode === 0) {
        const delta = Number.isFinite(balance) ? `，本次增加 ${Number((Number(latest.result?.balance) - balance).toFixed(3))} Coins` : '';
        lines.push(`💰 最新余额：${latest.result?.balance} Coins${delta}`);
      } else lines.push(`⚠️ 最终查询：${replyText(latest)}`);
      if (expired) return expiredResult(lines);
    } catch (error) { lines.push(`❌ 最终查询：${String(error)}`); }
  } catch (error) {
    lines.push(`❌ 请求失败：${String(error)}`);
  }
  return { lines, expired: false };
}

function expiredResult(lines) {
  lines.push('🔑 登录状态已失效：请在 PingMe App 重新登录此账号，打开余额页重新抓取；本次已跳过视频任务。');
  return { lines, expired: true };
}

async function runAll(ctx) {
  const signingKey = String(ctx.env?.PINGME_SIGNING_KEY || '').trim();
  if (!signingKey) {
    ctx.notify({ title: '⚠️ PingMe 缺少签名参数', body: '请在 Egern 的 PingMe 模块设置中填写「签名参数」后再运行。' });
    return;
  }
  const store = loadStore(ctx);
  const accounts = store.order.map(id => store.accounts[id]).filter(Boolean);
  if (!accounts.length) {
    ctx.notify({ title: '⚠️ PingMe 未抓到账号', body: '请先在 PingMe App 打开余额页触发抓取。' });
    return;
  }
  const results = [];
  let expiredCount = 0;
  for (let i = 0; i < accounts.length; i++) {
    const result = await runAccount(ctx, accounts[i], i, accounts.length, signingKey);
    results.push(result.lines.join('\n'));
    if (result.expired) expiredCount++;
    if (i < accounts.length - 1) await sleep(ACCOUNT_GAP);
  }
  const title = expiredCount ? `⚠️ PingMe 完成：${expiredCount}/${accounts.length} 个账号需重新登录` : `🎉 PingMe 全部完成（${accounts.length} 个账号）`;
  ctx.notify({ title, body: results.join('\n———\n') });
}

function MD5(string) {
  function RotateLeft(lValue, iShiftBits) { return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits)); }
  function AddUnsigned(lX, lY) {
    const lX4 = lX & 0x40000000, lY4 = lY & 0x40000000, lX8 = lX & 0x80000000, lY8 = lY & 0x80000000;
    const lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) return (lResult & 0x40000000) ? (lResult ^ 0xC0000000 ^ lX8 ^ lY8) : (lResult ^ 0x40000000 ^ lX8 ^ lY8);
    return lResult ^ lX8 ^ lY8;
  }
  function F(x, y, z) { return (x & y) | ((~x) & z); }
  function G(x, y, z) { return (x & z) | (y & (~z)); }
  function H(x, y, z) { return x ^ y ^ z; }
  function I(x, y, z) { return y ^ (x | (~z)); }
  function FF(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
  function GG(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
  function HH(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
  function II(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
  function ConvertToWordArray(str) {
    const lMessageLength = str.length;
    const lNumberOfWords_temp1 = lMessageLength + 8;
    const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
    const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
    const lWordArray = Array(lNumberOfWords - 1).fill(0);
    let lBytePosition = 0, lByteCount = 0;
    while (lByteCount < lMessageLength) {
      const lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] |= str.charCodeAt(lByteCount) << lBytePosition;
      lByteCount++;
    }
    const lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] |= 0x80 << lBytePosition;
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
    lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
    return lWordArray;
  }
  function WordToHex(lValue) {
    let WordToHexValue = '';
    for (let lCount = 0; lCount <= 3; lCount++) {
      const lByte = (lValue >>> (lCount * 8)) & 255;
      const WordToHexValue_temp = '0' + lByte.toString(16);
      WordToHexValue += WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
    }
    return WordToHexValue;
  }
  const x = ConvertToWordArray(string);
  let a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;
  const S11 = 7, S12 = 12, S13 = 17, S14 = 22, S21 = 5, S22 = 9, S23 = 14, S24 = 20;
  const S31 = 4, S32 = 11, S33 = 16, S34 = 23, S41 = 6, S42 = 10, S43 = 15, S44 = 21;
  for (let k = 0; k < x.length; k += 16) {
    const AA = a, BB = b, CC = c, DD = d;
    a = FF(a,b,c,d,x[k+0],S11,0xD76AA478); d = FF(d,a,b,c,x[k+1],S12,0xE8C7B756); c = FF(c,d,a,b,x[k+2],S13,0x242070DB); b = FF(b,c,d,a,x[k+3],S14,0xC1BDCEEE);
    a = FF(a,b,c,d,x[k+4],S11,0xF57C0FAF); d = FF(d,a,b,c,x[k+5],S12,0x4787C62A); c = FF(c,d,a,b,x[k+6],S13,0xA8304613); b = FF(b,c,d,a,x[k+7],S14,0xFD469501);
    a = FF(a,b,c,d,x[k+8],S11,0x698098D8); d = FF(d,a,b,c,x[k+9],S12,0x8B44F7AF); c = FF(c,d,a,b,x[k+10],S13,0xFFFF5BB1); b = FF(b,c,d,a,x[k+11],S14,0x895CD7BE);
    a = FF(a,b,c,d,x[k+12],S11,0x6B901122); d = FF(d,a,b,c,x[k+13],S12,0xFD987193); c = FF(c,d,a,b,x[k+14],S13,0xA679438E); b = FF(b,c,d,a,x[k+15],S14,0x49B40821);
    a = GG(a,b,c,d,x[k+1],S21,0xF61E2562); d = GG(d,a,b,c,x[k+6],S22,0xC040B340); c = GG(c,d,a,b,x[k+11],S23,0x265E5A51); b = GG(b,c,d,a,x[k+0],S24,0xE9B6C7AA);
    a = GG(a,b,c,d,x[k+5],S21,0xD62F105D); d = GG(d,a,b,c,x[k+10],S22,0x02441453); c = GG(c,d,a,b,x[k+15],S23,0xD8A1E681); b = GG(b,c,d,a,x[k+4],S24,0xE7D3FBC8);
    a = GG(a,b,c,d,x[k+9],S21,0x21E1CDE6); d = GG(d,a,b,c,x[k+14],S22,0xC33707D6); c = GG(c,d,a,b,x[k+3],S23,0xF4D50D87); b = GG(b,c,d,a,x[k+8],S24,0x455A14ED);
    a = GG(a,b,c,d,x[k+13],S21,0xA9E3E905); d = GG(d,a,b,c,x[k+2],S22,0xFCEFA3F8); c = GG(c,d,a,b,x[k+7],S23,0x676F02D9); b = GG(b,c,d,a,x[k+12],S24,0x8D2A4C8A);
    a = HH(a,b,c,d,x[k+5],S31,0xFFFA3942); d = HH(d,a,b,c,x[k+8],S32,0x8771F681); c = HH(c,d,a,b,x[k+11],S33,0x6D9D6122); b = HH(b,c,d,a,x[k+14],S34,0xFDE5380C);
    a = HH(a,b,c,d,x[k+1],S31,0xA4BEEA44); d = HH(d,a,b,c,x[k+4],S32,0x4BDECFA9); c = HH(c,d,a,b,x[k+7],S33,0xF6BB4B60); b = HH(b,c,d,a,x[k+10],S34,0xBEBFBC70);
    a = HH(a,b,c,d,x[k+13],S31,0x289B7EC6); d = HH(d,a,b,c,x[k+0],S32,0xEAA127FA); c = HH(c,d,a,b,x[k+3],S33,0xD4EF3085); b = HH(b,c,d,a,x[k+6],S34,0x04881D05);
    a = HH(a,b,c,d,x[k+9],S31,0xD9D4D039); d = HH(d,a,b,c,x[k+12],S32,0xE6DB99E5); c = HH(c,d,a,b,x[k+15],S33,0x1FA27CF8); b = HH(b,c,d,a,x[k+2],S34,0xC4AC5665);
    a = II(a,b,c,d,x[k+0],S41,0xF4292244); d = II(d,a,b,c,x[k+7],S42,0x432AFF97); c = II(c,d,a,b,x[k+14],S43,0xAB9423A7); b = II(b,c,d,a,x[k+5],S44,0xFC93A039);
    a = II(a,b,c,d,x[k+12],S41,0x655B59C3); d = II(d,a,b,c,x[k+3],S42,0x8F0CCC92); c = II(c,d,a,b,x[k+10],S43,0xFFEFF47D); b = II(b,c,d,a,x[k+1],S44,0x85845DD1);
    a = II(a,b,c,d,x[k+8],S41,0x6FA87E4F); d = II(d,a,b,c,x[k+15],S42,0xFE2CE6E0); c = II(c,d,a,b,x[k+6],S43,0xA3014314); b = II(b,c,d,a,x[k+13],S44,0x4E0811A1);
    a = II(a,b,c,d,x[k+4],S41,0xF7537E82); d = II(d,a,b,c,x[k+11],S42,0xBD3AF235); c = II(c,d,a,b,x[k+2],S43,0x2AD7D2BB); b = II(b,c,d,a,x[k+9],S44,0xEB86D391);
    a = AddUnsigned(a,AA); b = AddUnsigned(b,BB); c = AddUnsigned(c,CC); d = AddUnsigned(d,DD);
  }
  return (WordToHex(a) + WordToHex(b) + WordToHex(c) + WordToHex(d)).toLowerCase();
}

