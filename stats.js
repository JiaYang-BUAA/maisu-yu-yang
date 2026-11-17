"use strict";
const rows = (values) => values.map(value => "<td>"+value+"</td>").join("");
const display = (value) => Number(value).toLocaleString("zh-CN");
async function loadStats() {
  const {request,dateKey} = window.readerStats;
  const status = document.getElementById("status");
  const button = document.getElementById("refresh");
  button.disabled = true;
  status.textContent = "正在读取统计…";
  let failures = 0;
  async function read(key) {
    try { return await request(key); } catch { failures++; return null; }
  }
  const days = Array.from({length:7},(_,i)=>dateKey(new Date(Date.now()-i*86400000)));
  document.getElementById("days").innerHTML = days.map(day=>'<tr data-day="'+day+'">'+rows([day,"…","…"])+'</tr>').join("");
  document.getElementById("reading").innerHTML = "";
  const total = await read("visits");
  document.getElementById("pv").textContent = total ? display(total.page_pv) : "—";
  document.getElementById("uv").textContent = total ? display(total.page_uv) : "—";
  for (const day of days) {
    const beforeStart = day < "2026-11-17";
    const data = beforeStart ? null : await read("days/"+day);
    document.querySelector('[data-day="'+day+'"]').innerHTML = rows([day,data?display(data.page_pv):"—",data?display(data.page_uv):"—"]);
  }
  for (const [key,label] of [["comic","漫画"],["text","原文"],["facsimile","截图对照"]]) {
    const data = await read("reading/"+key);
    document.getElementById("reading").insertAdjacentHTML("beforeend","<tr>"+rows([label,data?display(data.page_pv):"—",data?display(data.page_uv):"—"])+"</tr>");
  }
  status.textContent = failures ? "部分数据暂未读取，请稍后刷新。破折号表示暂无可用数据。" : "已更新 · "+new Date().toLocaleTimeString("zh-CN",{timeZone:"Asia/Shanghai"});
  button.disabled = false;
}
const exclude = document.getElementById("exclude");
try { exclude.checked = localStorage.getItem("maisu-exclude-stats")==="1"; } catch {}
exclude.addEventListener("change",()=>{
  try { localStorage.setItem("maisu-exclude-stats",exclude.checked?"1":"0"); }
  catch { exclude.checked=false;document.getElementById("status").textContent="浏览器无法保存设置。"; }
});
document.getElementById("refresh").addEventListener("click",loadStats);
loadStats();
