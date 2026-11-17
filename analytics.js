(() => {
  "use strict";
  const endpoint = "https://bsz.iirose.cn/api";
  const base = "https://jiayang-buaa.github.io/maisu-yu-yang/_stats/v1/";
  const dateKey = (date = new Date()) => new Intl.DateTimeFormat("en-CA", {
    timeZone:"Asia/Shanghai", year:"numeric", month:"2-digit", day:"2-digit"
  }).format(date);
  let identity = "";
  try { identity = localStorage.getItem("maisu-stats-identity") || ""; } catch {}
  async function request(key, method = "GET") {
    const headers = {"x-bsz-referer":base + key};
    if (identity) headers.Authorization = "Bearer " + identity;
    const response = await fetch(endpoint, {
      method, headers,
      credentials:"omit", cache:"no-store", signal:AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error("统计服务暂时不可用");
    const result = await response.json();
    const receivedIdentity = response.headers.get("Set-Bsz-Identity");
    if (receivedIdentity) {
      identity = receivedIdentity;
      try { localStorage.setItem("maisu-stats-identity", identity); } catch {}
    }
    if (!result.success || !result.data) throw new Error("统计数据未返回");
    return result.data;
  }
  window.readerStats = {request, dateKey};
  if (document.body.dataset.stats === "dashboard") return;
  if (location.hostname !== "jiayang-buaa.github.io") return;
  if (new URLSearchParams(location.search).has("nostats")) return;
  let excluded = false;
  try { excluded = localStorage.getItem("maisu-exclude-stats") === "1"; } catch {}
  if (excluded) return;
  let pending = Promise.resolve();
  const record = key => {
    pending = pending.then(() => request(key,"POST")).catch(() => {});
  };
  const day = dateKey();
  record("visits");
  record("days/" + day);
  const seen = new Set();
  function trackReading() {
    const kind = location.pathname.includes("/facsimile/") ? "facsimile" : location.hash.split("/")[0].slice(1);
    if (!["comic","text","facsimile"].includes(kind) || seen.has(kind)) return;
    seen.add(kind);
    record("reading/" + kind);
  }
  trackReading();
  window.addEventListener("hashchange",trackReading);
})();
