"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad = (n) => String(n).padStart(2,"0");
const safeNumber = (n, max) => Math.min(max, Math.max(1, Number(n) || 1));
let comic = [];
let original;
let mode = "home";
let current = 1;
let tab = "comic";
let ready = false;
let scrollTimer = 0;
let generation = 0;
let restoring = false;
const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem("maisu-v1-"+key)) ?? fallback; } catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem("maisu-v1-"+key, JSON.stringify(value)); } catch { /* Storage is optional. */ }
};
function sizeSetting() {
  return Math.min(28,Math.max(16,Number(read("size",20)) || 20));
}
function resumeLinks() {
  for (const link of $$("[data-resume]")) {
    const kind=link.dataset.resume;
    const saved=safeNumber(read(kind,1),kind==="comic"?comic.length:original.chapters.length);
    link.href=kind==="text"?"#text/resume":"#"+kind+"/"+saved;
  }
  if ($("[data-comic-label]")) $("[data-comic-label]").textContent=read("comic",0)?"继续读漫画":"开始读漫画";
  if ($("[data-text-label]")) $("[data-text-label]").textContent=read("text",0)?"继续读原文":"阅读原文";
}
function homeCards() {
  const featured=[1,3,5,13];
  $("#cards").innerHTML=featured.map(n=>{
    const p=comic[n-1];
    return '<a class="card" href="#comic/'+n+'" aria-label="第 '+n+' 页，'+escapeHTML(p.title)+'"><div class="card-art"><img src="'+p.still+'" alt="" width="500" height="368"></div><div class="card-label"><small>'+pad(n)+'</small><strong>'+escapeHTML(p.title)+'</strong></div></a>';
  }).join("");
}
function stepControl(kind, n, delta, long=false) {
  const max=kind==="comic"?comic.length:original.chapters.length;
  const unit=kind==="comic"?"页":"节";
  const label=delta<0?"← 上一"+unit:"下一"+unit+" →";
  const target=n+delta;
  if (target<1 || target>max) return long && target>max
    ? '<a class="rd-button" href="#home">回到首页 →</a>'
    : '<button class="rd-button" type="button" disabled>'+label+'</button>';
  return '<a class="rd-button" href="#'+kind+'/'+target+'">'+label+'</a>';
}
function bottom(kind,n,total) {
  return '<div class="read-bottom">'+stepControl(kind,n,-1,true)+'<button class="meter" data-open-toc="'+kind+'" aria-label="打开目录">'+pad(n)+' / '+pad(total)+'<span>目录</span></button>'+stepControl(kind,n,1,true)+'</div>';
}
function readingImage(page) {
  return page.image.replace("media/p", "media/read-p");
}
function preloadNextPage() {
  const image = $(".comic-sheet img");
  const next = comic[current];
  if (!image || !next || navigator.connection?.saveData) return;
  const preload = () => {
    if (!image.isConnected) return;
    const nextImage = new Image();
    nextImage.fetchPriority = "low";
    nextImage.src = readingImage(next);
  };
  if (image.complete && image.naturalWidth) preload();
  else image.addEventListener("load", preload, {once:true});
}
function comicPage(n) {
  const p=comic[n-1];
  const name=escapeHTML(p.title);
  return '<div class="reader-shell"><div class="read-head"><div class="crumbs"><a href="#home">首页</a><span>/</span><button data-open-toc="comic">漫画</button><span>/</span><b>'+pad(n)+' '+name+'</b></div><div class="tools">'+stepControl("comic",n,-1)+stepControl("comic",n,1)+'<button class="rd-button" data-zoom>放大</button></div></div>'+
    '<button class="comic-sheet" data-zoom aria-label="放大第 '+n+' 页漫画"><img src="'+readingImage(p)+'" width="1760" height="2430" alt="《麦穗与羊》第 '+n+' 页《'+name+'》，六格漫画。" fetchpriority="high"></button>'+bottom("comic",n,comic.length)+'</div>';
}
function textSection(n) {
  const ch=original.chapters[n-1];
  const paras=ch.paragraphs.map((p,i)=>{
    let html='<p id="para-'+(n+"-"+(i+1))+'">'+escapeHTML(p)+'</p>';
    for (const art of ch.illustrations || []) {
      if (art.after === i + 1) html += '<figure><img src="'+escapeHTML(art.src)+'" width="768" height="512" alt="'+escapeHTML(art.alt)+'" loading="lazy"></figure>';
    }
    return html;
  }).join("");
  return '<section class="text-section" id="text-section-'+n+'"><div class="section-mark">第 '+pad(n)+' 节</div><h2>'+escapeHTML(ch.title)+'</h2>'+paras+'</section>';
}
function textPage() {
  return '<div class="text-shell"><div class="read-head"><div class="crumbs"><a href="#home">首页</a><span>/</span><button data-open-toc="text">原文目录</button></div><div class="text-options"><a class="read-source" href="./facsimile/index.html">截图对照 ↗</a><button class="rd-button" data-size="-2" aria-label="缩小字号">A−</button><button class="rd-button" data-size="2" aria-label="增大字号">A＋</button></div></div><article class="prose"><figure><img src="media/story/cover.webp" width="971" height="1619" alt="麦穗与羊，两枝麦穗封面"></figure><h1>死在十七岁的你</h1><p class="rd-info">原作　羊馍干</p>'+original.chapters.map((_,i)=>textSection(i+1)).join('')+'</article><div class="read-bottom"><button class="rd-button" data-open-toc="text">阅读目录</button><a class="rd-button" href="#home">回到首页 →</a></div></div>';
}
function syncSize() {
  const fontSize=sizeSetting();
  document.documentElement.style.setProperty("--reading-size",fontSize+"px");
  const minus=$('[data-size="-2"]'),plus=$('[data-size="2"]');
  if (minus) minus.disabled=fontSize<=16;
  if (plus) plus.disabled=fontSize>=28;
}
function closeDialogs() {
  for(const dlg of $$("dialog[open]")) dlg.close();
}
function positionKey(){return mode==="text"?"position-text-continuous":"position-"+mode+"-"+current;}
function remember() {
  if (mode!=="home" && !restoring) write(positionKey(),Math.round(window.scrollY));
}
function route() {
  if(!ready) return;
  if(scrollTimer) clearTimeout(scrollTimer);
  closeDialogs();
  const parts=(location.hash.slice(1)||"home").split("/");
  const nextMode=["comic","text"].includes(parts[0])?parts[0]:"home";
  const n=nextMode==="home"?1:safeNumber(parseInt(parts[1],10),nextMode==="comic"?comic.length:original.chapters.length);
  if(nextMode!==mode || n!==current) remember();
  const wasText=mode==="text";
  mode=nextMode;
  current=n;
  const activeGeneration=++generation;
  restoring=true;
  $("#home").hidden=mode!=="home";
  $("#reader").hidden=mode==="home";
  $$("[data-nav]").forEach(el=>{
    if(el.dataset.nav===mode) el.setAttribute("aria-current","page");
    else el.removeAttribute("aria-current");
  });
  let title="麦穗与羊 · 图文读本";
  if(mode==="comic"){
    $("#reader").innerHTML=comicPage(n);
    preloadNextPage();
    title=comic[n-1].title+" · 漫画 · 麦穗与羊";
  }else if(mode==="text"){
    if(!wasText) $("#reader").innerHTML=textPage();
    title="完整原文 · 麦穗与羊";
    syncSize();
  }else $("#reader").replaceChildren();
  if(mode!=="home") write(mode,n);
  document.title=title;
  resumeLinks();
  const y=mode==="home"?0:read(positionKey(),0);
  document.querySelector("#main").focus({preventScroll:true});
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(generation!==activeGeneration) return;
    if(mode==="text" && parts[1]!=="resume"){
      if(n===1) window.scrollTo(0,0);
      else $("#text-section-"+n).scrollIntoView();
    }else window.scrollTo(0,y);
    restoring=false;
  }));
}
function showEntries(kind) {
  tab=kind;
  $$("[data-tab]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.tab===tab)));
  const list=kind==="comic"?comic:original.chapters;
  $("#toc-entries").innerHTML=list.map((item,i)=>{
    const n=i+1, active=mode===kind && current===n?' aria-current="page"':"";
    return '<a class="toc-entry" href="#'+kind+'/'+n+'"'+active+'>'+(kind==="comic"?'<img src="'+item.thumb+'" loading="lazy" width="36" height="40" alt="">':"")+'<em>'+pad(n)+'</em><span>'+escapeHTML(item.title)+'</span></a>';
  }).join("");
  $("#toc-entries").scrollTop=0;
}
function openToc(kind) {
  if(!ready) return;
  showEntries(kind==="comic"||kind==="text"?kind:(mode==="text"?"text":"comic"));
  $("#toc").showModal();
  $("#toc .cross").focus();
}
function zoom() {
  if(mode!=="comic") return;
  const p=comic[current-1];
  $("#zoom-page").src=p.image;
  $("#zoom-page").alt=p.title;
  $(".zoom-scroll").classList.remove("enlarged");
  $("#scale").textContent="放大";
  $("#zoom").showModal();
  $(".zoom-scroll").scrollTo(0,0);
}
document.addEventListener("click",e=>{
  const target=e.target.closest("button, a, dialog");
  if(!target) return;
  if(target.matches(".skip")){e.preventDefault();$("#main").focus();$("#main").scrollIntoView();}
  else if(target.matches("[data-close]")) document.getElementById(target.dataset.close).close();
  else if(target.matches("[data-open-toc]")) openToc(target.dataset.openToc);
  else if(target.matches("[data-tab]")) showEntries(target.dataset.tab);
  else if(target.matches("[data-zoom]")) zoom();
  else if(target.matches("#scale")) $("#scale").textContent=$(".zoom-scroll").classList.toggle("enlarged")?"适合屏幕":"放大";
  else if(target.matches("[data-size]")){write("size",Math.min(28,Math.max(16,sizeSetting()+Number(target.dataset.size))));syncSize();}
  else if(target.matches(".toc-entry")){
    closeDialogs();
    if(mode==="text" && target.hash===location.hash) $("#text-section-"+current).scrollIntoView();
  }
  else if(target.matches("dialog") && e.target===target){
    const r=target.getBoundingClientRect();
    if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)target.close();
  }
});
document.addEventListener("keydown",e=>{
  if(mode!=="comic" || document.querySelector("dialog[open]") || e.altKey||e.ctrlKey||e.metaKey) return;
  const k=e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:0;
  if(k && current+k>=1 && current+k<=comic.length){e.preventDefault();location.hash="comic/"+(current+k);}
});
window.addEventListener("scroll",()=>{if(restoring||mode==="home")return;clearTimeout(scrollTimer);scrollTimer=setTimeout(remember,180);},{passive:true});
window.addEventListener("pagehide",remember);
window.addEventListener("hashchange",route);
if("scrollRestoration" in history)history.scrollRestoration="manual";
async function getJSON(url){const r=await fetch(url);if(!r.ok)throw Error(r.status);return r.json();}
async function start(){
  try{
    [comic,original]=await Promise.all([getJSON("data/comic.json"),getJSON("data/original.json?v=3")]);
    ready=true;homeCards();route();
  }catch{
    $("#cards").innerHTML='<p class="load-error">读本暂时未加载。<button type="button" id="retry">重新加载</button>　<a href="./facsimile/index.html">打开图文对照版 ↗</a></p>';
    $("#retry").onclick=start;
  }
}
start();
