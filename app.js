import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

const $ = id => document.getElementById(id);
let pdf=null, currentPage=1, zoom=1, fileName="Моя книга", selected="";
const canvas=$("pdfCanvas"), ctx=canvas.getContext("2d");
const storeKey="quiet-reader-v1";
let saved=JSON.parse(localStorage.getItem(storeKey)||'{"progress":{},"bookmarks":{},"vocab":[]}');
const persist=()=>localStorage.setItem(storeKey,JSON.stringify(saved));
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2100)}
function key(){return fileName}
function updateProgress(){
 if(!pdf)return;
 const pct=Math.round(currentPage/pdf.numPages*100);
 $("pageLabel").textContent=`Страница ${currentPage} из ${pdf.numPages}`;
 $("percentLabel").textContent=pct+"%";
 $("pageRange").value=currentPage;
 $("progressFill").style.width=pct+"%";
 saved.progress[key()]=currentPage;persist();
}
async function renderPage(num){
 if(!pdf)return;
 currentPage=Math.max(1,Math.min(pdf.numPages,num));
 const page=await pdf.getPage(currentPage);
 const viewport=page.getViewport({scale:zoom});
 const ratio=window.devicePixelRatio||1;
 canvas.width=Math.floor(viewport.width*ratio);canvas.height=Math.floor(viewport.height*ratio);
 canvas.style.width=viewport.width+"px";canvas.style.height=viewport.height+"px";
 ctx.setTransform(ratio,0,0,ratio,0,0);
 await page.render({canvasContext:ctx,viewport}).promise;
 const layer=$("textLayer");layer.innerHTML="";
 const text=await page.getTextContent();
 const transform=pdfjsLib.Util.transform;
 for(const item of text.items){
   if(!item.str)continue;
   const tx=transform(viewport.transform,item.transform);
   const span=document.createElement("span");
   span.textContent=item.str;
   span.style.left=tx[4]+"px";span.style.top=(tx[5]-Math.abs(tx[3]))+"px";
   span.style.fontSize=Math.hypot(tx[2],tx[3])+"px";
   span.style.fontFamily=item.fontName||"sans-serif";
   span.style.height=Math.max(1,Math.hypot(tx[2],tx[3]))+"px";
   layer.appendChild(span);
 }
 $("pageContainer").style.width=viewport.width+"px";
 $("pageContainer").style.height=viewport.height+"px";
 updateProgress();
}
async function openFile(file){
 if(!file)return;
 if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf")){toast("Выбери PDF-файл");return}
 try{
   const bytes=await file.arrayBuffer();
   pdf=await pdfjsLib.getDocument({data:bytes}).promise;
   fileName=file.name;currentPage=saved.progress[key()]||1;
   $("welcome").classList.add("hidden");$("reader").classList.remove("hidden");
   $("bookTitle").textContent=fileName.replace(/\.pdf$/i,"");
   $("bookMeta").textContent=`PDF BOOK · ${pdf.numPages} СТРАНИЦ`;
   $("pageRange").max=pdf.numPages;
   await renderPage(currentPage);toast("Книга открыта");
 }catch(e){console.error(e);toast("Не удалось открыть PDF")}
}
$("fileInput").addEventListener("change",e=>openFile(e.target.files[0]));
$("fileInputDrawer").addEventListener("change",e=>{openFile(e.target.files[0]);closeDrawer()});
$("changeBook").onclick=()=>$("fileInput").click();
$("prevBtn").onclick=()=>renderPage(currentPage-1);
$("nextBtn").onclick=()=>renderPage(currentPage+1);
$("pageRange").oninput=e=>renderPage(Number(e.target.value));
$("bookmarkBtn").onclick=()=>{
 if(!pdf)return toast("Сначала открой книгу");
 const arr=saved.bookmarks[key()]||[];
 if(!arr.includes(currentPage))arr.push(currentPage);
 saved.bookmarks[key()]=arr;persist();renderLists();toast("Закладка добавлена");
};
function openDrawer(){$("drawer").classList.remove("hidden");$("scrim").classList.remove("hidden");renderLists()}
function closeDrawer(){$("drawer").classList.add("hidden");$("scrim").classList.add("hidden")}
$("libraryBtn").onclick=openDrawer;$("closeDrawer").onclick=closeDrawer;$("scrim").onclick=closeDrawer;
function renderLists(){
 const b=$("bookmarkList");b.innerHTML="";
 const marks=saved.bookmarks[key()]||[];
 if(!marks.length)b.textContent="Пока нет закладок";
 marks.forEach(n=>{const row=document.createElement("div");row.className="item";const t=document.createElement("span");t.textContent="Страница "+n;const go=document.createElement("button");go.textContent="Открыть";go.onclick=()=>{renderPage(n);closeDrawer()};row.append(t,go);b.append(row)});
 const v=$("vocabList");v.innerHTML="";
 if(!saved.vocab.length)v.textContent="Сохранённых слов пока нет";
 saved.vocab.slice().reverse().forEach((w,i)=>{const row=document.createElement("div");row.className="item";const t=document.createElement("span");t.textContent=w;const del=document.createElement("button");del.textContent="×";del.onclick=()=>{saved.vocab.splice(saved.vocab.length-1-i,1);persist();renderLists()};row.append(t,del);v.append(row)});
}
$("settingsBtn").onclick=()=>$("settingsDialog").showModal();
$("closeSettings").onclick=()=>$("settingsDialog").close();
$("themeSelect").onchange=e=>document.body.dataset.theme=e.target.value;
function setZoom(z){zoom=Math.max(.65,Math.min(1.7,z));$("zoomValue").textContent=Math.round(zoom*100)+"%";renderPage(currentPage)}
$("zoomIn").onclick=()=>setZoom(zoom+.1);$("zoomOut").onclick=()=>setZoom(zoom-.1);
document.addEventListener("selectionchange",()=>{
 const text=window.getSelection()?.toString().trim();
 if(text&&text.length<100){selected=text;$("selectedText").textContent=text;$("selectionTools").classList.remove("hidden")}
});
$("translateBtn").onclick=()=>{if(selected)window.open("https://translate.google.com/?sl=auto&tl=ru&text="+encodeURIComponent(selected)+"&op=translate","_blank","noopener")};
$("saveWordBtn").onclick=()=>{
 if(!selected)return;
 if(!saved.vocab.includes(selected)){saved.vocab.push(selected);persist();toast("Добавлено в словарь")}else toast("Уже есть в словаре");
 renderLists();
};
document.addEventListener("keydown",e=>{
 if(e.key==="ArrowLeft"&&!$("reader").classList.contains("hidden"))renderPage(currentPage-1);
 if(e.key==="ArrowRight"&&!$("reader").classList.contains("hidden"))renderPage(currentPage+1);
});
window.addEventListener("resize",()=>{if(pdf)renderPage(currentPage)});
