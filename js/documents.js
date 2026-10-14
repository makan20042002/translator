/* ---------- DOCUMENT ---------- */
let doc=null,dCtl=null,dResult='',dOutItems=null;
const hasWords=s=>/\p{L}{2,}/u.test(s);
function csvParse(s){const rows=[];let row=[],c='',q=false;
  for(let i=0;i<s.length;i++){const ch=s[i];
    if(q){if(ch==='"'){if(s[i+1]==='"'){c+='"';i++}else q=false}else c+=ch}
    else if(ch==='"')q=true;else if(ch===','){row.push(c);c=''}else if(ch==='\n'){row.push(c);rows.push(row);row=[];c=''}else if(ch!=='\r')c+=ch}
  if(c||row.length){row.push(c);rows.push(row)}return rows}
const csvOut=rows=>rows.map(r=>r.map(c=>/[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c).join(',')).join('\n');
let jszipPromise=null;
function loadJSZip(){
  if(window.JSZip)return Promise.resolve(window.JSZip);
  if(!jszipPromise){
    jszipPromise=new Promise((res,rej)=>{
      const s=document.createElement('script');
      s.src='jszip.min.js';
      s.onload=()=>res(window.JSZip);
      s.onerror=()=>rej(new Error('Failed to load JSZip'));
      document.head.appendChild(s);
    });
  }
  return jszipPromise;
}

const isRtlLang=l=>['fa','ar','he','ur','ps','sd','ug'].some(c=>l===c||l.startsWith(c+'-'));

const DOCX_PPR_ORDER=['w:pStyle','w:keepNext','w:keepLines','w:pageBreakBefore','w:framePr','w:widowControl','w:numPr','w:suppressLineNumbers','w:pBdr','w:shd','w:tabs','w:suppressAutoHyphens','w:kinsoku','w:wordWrap','w:overflowPunct','w:topLinePunct','w:autoSpaceDE','w:autoSpaceDN','w:bidi','w:adjustRightInd','w:snapToGrid','w:spacing','w:ind','w:contextualSpacing','w:mirrorIndents','w:suppressOverlap','w:jc','w:textDirection','w:textAlignment','w:textboxTightWrap','w:outlineLvl','w:divId','w:cnfStyle','w:rPr','w:sectPr','w:pPrChange'];
const DOCX_RPR_ORDER=['w:rStyle','w:rFonts','w:b','w:bCs','w:i','w:iCs','w:caps','w:smallCaps','w:strike','w:dstrike','w:outline','w:shadow','w:emboss','w:imprint','w:noProof','w:snapToGrid','w:vanish','w:webHidden','w:color','w:spacing','w:w','w:kern','w:position','w:sz','w:szCs','w:highlight','w:u','w:effect','w:bdr','w:shd','w:fitText','w:vertAlign','w:rtl','w:cs','w:em','w:lang','w:eastAsianLayout','w:specVanish','w:oMath','w:rPrChange'];

function insertInDocxOrder(parent,child,order){
  const idx=order.indexOf(child.nodeName);
  if(idx<0){parent.appendChild(child);return}
  const kids=Array.from(parent.childNodes).filter(n=>n.nodeType===1);
  for(const k of kids){
    const kIdx=order.indexOf(k.nodeName);
    if(kIdx>idx){parent.insertBefore(child,k);return}
  }
  parent.appendChild(child);
}

/* Office DOCX */
async function prepDocx(name,buffer){
  const JSZip=await loadJSZip();
  const zip=await JSZip.loadAsync(buffer);
  const parser=new DOMParser(), serializer=new XMLSerializer();
  const parsed={};
  const xmlFiles=Object.keys(zip.files).filter(f=>/^word\/(document|header\d+|footer\d+|footnotes|comments\d*)\.xml$/i.test(f));
  const segs=[];

  for(const xf of xmlFiles){
    const xmlStr=await zip.file(xf).async('string');
    const docXml=parser.parseFromString(xmlStr,'application/xml');
    parsed[xf]=docXml;
    const ps=Array.from(docXml.getElementsByTagName('w:p'));
    for(const p of ps){
      const tNodes=[];
      const runs=Array.from(p.getElementsByTagName('w:r'));
      for(const r of runs){
        const ts=Array.from(r.getElementsByTagName('w:t'));
        for(const t of ts) tNodes.push(t);
      }
      const fullText=tNodes.map(t=>t.textContent).join('');
      if(hasWords(fullText)){
        segs.push({xmlFile:xf,p,tNodes,fullText});
      }
    }
  }

  // Scan DOCX charts (word/charts/chart*.xml) for titles and category labels
  const chartFiles=Object.keys(zip.files).filter(f=>/^word\/charts\/chart\d+\.xml$/i.test(f));
  for(const cf of chartFiles){
    const xmlStr=await zip.file(cf).async('string');
    const chartXml=parser.parseFromString(xmlStr,'application/xml');
    parsed[cf]=chartXml;
    const aTs=Array.from(chartXml.getElementsByTagName('a:t'));
    for(const at of aTs){
      if(hasWords(at.textContent)) segs.push({chartFile:cf,chartNode:at,tNodes:[at],fullText:at.textContent});
    }
    const strCaches=Array.from(chartXml.getElementsByTagName('c:strCache'));
    for(const sc of strCaches){
      const pts=Array.from(sc.getElementsByTagName('c:pt'));
      for(const pt of pts){
        const v=pt.getElementsByTagName('c:v')[0];
        if(v&&hasWords(v.textContent)) segs.push({chartFile:cf,chartNode:v,tNodes:[v],fullText:v.textContent});
      }
    }
  }

  const items=segs.map(s=>s.fullText);
  const totalWords=items.reduce((acc,t)=>acc+(t.trim().split(/\s+/).filter(Boolean).length||0),0);
  const estPages=Math.max(1,Math.round(totalWords/280));

  return {
    ext:'docx',name,items,segs,parsed,
    meta:{type:'docx',words:totalWords,estPages,sizeEstimate:`~${estPages} ${L('pages')||'pages'} · ${totalWords.toLocaleString()} ${L('words')||'words'}`},
    build:async(out,notes,tgtLang,srcLang)=>{
      const rtl=isRtlLang(tgtLang), srcRtl=isRtlLang(srcLang);
      const keepLayout=$('docKeepLayout')?.checked ?? true;
      let fnDoc=parsed['word/footnotes.xml'];
      let nextFnId=10;

      if(fnDoc){
        const existingFns=Array.from(fnDoc.getElementsByTagName('w:footnote'));
        for(const fn of existingFns){
          const id=+fn.getAttribute('w:id');
          if(!isNaN(id)&&id>=nextFnId) nextFnId=id+1;
        }
      }

      segs.forEach((seg,i)=>{
        const trans=out[i]??seg.fullText;
        if(seg.chartFile){
          if(seg.tNodes.length) seg.tNodes[0].textContent=trans;
          return;
        }
        const note=notes?.[i];
        if(seg.tNodes.length){
          seg.tNodes[0].textContent=trans;
          seg.tNodes[0].setAttribute('xml:space','preserve');
          for(let k=1;k<seg.tNodes.length;k++) seg.tNodes[k].textContent='';
        }
        // RTL formatting
        if(rtl){
          let pPr=seg.p.getElementsByTagName('w:pPr')[0];
          if(!pPr){pPr=seg.p.ownerDocument.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:pPr');seg.p.insertBefore(pPr,seg.p.firstChild)}
          if(!pPr.getElementsByTagName('w:bidi')[0]){
            const bidi=seg.p.ownerDocument.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:bidi');
            insertInDocxOrder(pPr,bidi,DOCX_PPR_ORDER);
          }
          let jc=pPr.getElementsByTagName('w:jc')[0];
          if(!jc){
            jc=seg.p.ownerDocument.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:jc');
            insertInDocxOrder(pPr,jc,DOCX_PPR_ORDER);
          }
          jc.setAttribute('w:val','right');

          // Runs with compact font (Tahoma) when keepLayout is enabled
          const runs=Array.from(seg.p.getElementsByTagName('w:r'));
          for(const r of runs){
            let rPr=r.getElementsByTagName('w:rPr')[0];
            if(!rPr){rPr=seg.p.ownerDocument.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:rPr');r.insertBefore(rPr,r.firstChild)}
            let rFonts=rPr.getElementsByTagName('w:rFonts')[0];
            if(!rFonts){
              rFonts=seg.p.ownerDocument.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:rFonts');
              insertInDocxOrder(rPr,rFonts,DOCX_RPR_ORDER);
            }
            rFonts.setAttribute('w:cs', keepLayout ? 'Tahoma' : 'Vazirmatn');
            if(!rPr.getElementsByTagName('w:rtl')[0]){
              const rtlEl=seg.p.ownerDocument.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:rtl');
              insertInDocxOrder(rPr,rtlEl,DOCX_RPR_ORDER);
            }
          }

          // Keep page layout: scale run font size down slightly per paragraph to offset target expansion
          if(rtl && keepLayout && trans.length > seg.fullText.length){
            const runs=Array.from(seg.p.getElementsByTagName('w:r'));
            for(const r of runs){
              const sz=r.getElementsByTagName('w:sz')[0];
              const szCs=r.getElementsByTagName('w:szCs')[0];
              [sz, szCs].forEach(sNode=>{
                if(!sNode) return;
                const val=parseInt(sNode.getAttribute('w:val')||'0');
                if(val>=20 && val<=28){
                  sNode.setAttribute('w:val', String(Math.max(18, Math.round(val * 0.88))));
                }else if(val>28){
                  sNode.setAttribute('w:val', String(Math.max(24, Math.round(val * 0.92))));
                }
              });
            }
          }
        }

        // Translator Footnote
        if(note&&fnDoc){
          const fnId=nextFnId++;
          const fnElem=fnDoc.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:footnote');
          fnElem.setAttribute('w:id',String(fnId));
          const pFn=fnDoc.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:p');
          const pPrFn=fnDoc.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:pPr');
          if(rtl){insertInDocxOrder(pPrFn,fnDoc.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:bidi'),DOCX_PPR_ORDER)}
          pFn.appendChild(pPrFn);

          const rRef=fnDoc.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:r');
          const rPrRef=fnDoc.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:rPr');
          const rStyleRef=fnDoc.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:rStyle');
          rStyleRef.setAttribute('w:val','FootnoteReference');
          insertInDocxOrder(rPrRef,rStyleRef,DOCX_RPR_ORDER);
          rRef.appendChild(rPrRef);
          rRef.appendChild(fnDoc.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:footnoteRef'));
          pFn.appendChild(rRef);

          const rTxt=fnDoc.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:r');
          if(rtl){
            const rPrTxt=fnDoc.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:rPr');
            insertInDocxOrder(rPrTxt,fnDoc.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:rtl'),DOCX_RPR_ORDER);
            rTxt.appendChild(rPrTxt);
          }
          const tTxt=fnDoc.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:t');
          tTxt.setAttribute('xml:space','preserve');
          tTxt.textContent=' [یادداشت مترجم: '+note+']';
          rTxt.appendChild(tTxt);
          pFn.appendChild(rTxt);
          fnElem.appendChild(pFn);
          fnDoc.documentElement.appendChild(fnElem);

          // Add footnote reference run to paragraph
          const rCall=seg.p.ownerDocument.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:r');
          const rPrCall=seg.p.ownerDocument.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:rPr');
          const rStyleCall=seg.p.ownerDocument.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:rStyle');
          rStyleCall.setAttribute('w:val','FootnoteReference');
          insertInDocxOrder(rPrCall,rStyleCall,DOCX_RPR_ORDER);
          rCall.appendChild(rPrCall);
          const fnRef=seg.p.ownerDocument.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:footnoteReference');
          fnRef.setAttribute('w:id',String(fnId));
          rCall.appendChild(fnRef);
          seg.p.appendChild(rCall);
        }
      });

      // Apply RTL / LTR formatting across all document parts (headings, body paragraphs, and table cells)
      if(rtl){
        for(const xf of xmlFiles){
          const docXml=parsed[xf];
          if(!docXml)continue;
          const tbls=Array.from(docXml.getElementsByTagName('w:tbl'));
          for(const tbl of tbls){
            let tblPr=tbl.getElementsByTagName('w:tblPr')[0];
            if(!tblPr){tblPr=tbl.ownerDocument.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:tblPr');tbl.insertBefore(tblPr,tbl.firstChild)}
            const oldBidi=tblPr.getElementsByTagName('w:tblBidi')[0];
            if(oldBidi)oldBidi.remove();
            if(!tblPr.getElementsByTagName('w:bidiVisual')[0]){
              tblPr.appendChild(tbl.ownerDocument.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:bidiVisual'));
            }
          }
          const ps=Array.from(docXml.getElementsByTagName('w:p'));
          for(const p of ps){
            let pPr=p.getElementsByTagName('w:pPr')[0];
            if(!pPr){pPr=p.ownerDocument.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:pPr');p.insertBefore(pPr,p.firstChild)}
            if(!pPr.getElementsByTagName('w:bidi')[0]){
              const bidi=p.ownerDocument.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:bidi');
              insertInDocxOrder(pPr,bidi,DOCX_PPR_ORDER);
            }
            const jcs=Array.from(pPr.getElementsByTagName('w:jc'));
            if(jcs.length){
              jcs.forEach(j=>j.setAttribute('w:val','right'));
            }else{
              const jc=p.ownerDocument.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:jc');
              jc.setAttribute('w:val','right');
              insertInDocxOrder(pPr,jc,DOCX_PPR_ORDER);
            }
            const runs=Array.from(p.getElementsByTagName('w:r'));
            for(const r of runs){
              let rPr=r.getElementsByTagName('w:rPr')[0];
              if(!rPr){rPr=p.ownerDocument.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:rPr');r.insertBefore(rPr,r.firstChild)}
              let rFonts=rPr.getElementsByTagName('w:rFonts')[0];
              if(!rFonts){
                rFonts=p.ownerDocument.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:rFonts');
                insertInDocxOrder(rPr,rFonts,DOCX_RPR_ORDER);
              }
              rFonts.setAttribute('w:cs', keepLayout ? 'Tahoma' : 'Vazirmatn');
              if(!rPr.getElementsByTagName('w:rtl')[0]){
                const rtlEl=p.ownerDocument.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:rtl');
                insertInDocxOrder(rPr,rtlEl,DOCX_RPR_ORDER);
              }
            }
          }
        }
      }else if(srcRtl){
        for(const xf of xmlFiles){
          const docXml=parsed[xf];
          if(!docXml)continue;
          const ps=Array.from(docXml.getElementsByTagName('w:p'));
          for(const p of ps){
            const pPr=p.getElementsByTagName('w:pPr')[0];
            if(pPr){
              const bidi=pPr.getElementsByTagName('w:bidi')[0];if(bidi)bidi.remove();
              const jcs=Array.from(pPr.getElementsByTagName('w:jc'));
              jcs.forEach(j=>j.setAttribute('w:val','left'));
            }
          }
        }
      }

      // Ensure <w:updateFields w:val="true"/> in word/settings.xml to refresh TOC and page numbers automatically
      let settingsDoc=parsed['word/settings.xml'];
      if(!settingsDoc){
        const sf=zip.file('word/settings.xml');
        if(sf){
          const sStr=await sf.async('string');
          settingsDoc=parser.parseFromString(sStr,'application/xml');
          parsed['word/settings.xml']=settingsDoc;
        }
      }
      if(settingsDoc){
        if(!settingsDoc.getElementsByTagName('w:updateFields')[0]){
          const uf=settingsDoc.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','w:updateFields');
          uf.setAttribute('w:val','true');
          settingsDoc.documentElement.appendChild(uf);
        }
      }else{
        parsed['word/settings.xml']=parser.parseFromString('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="true"/></w:settings>','application/xml');
      }

      for(const xf in parsed){
        zip.file(xf,serializer.serializeToString(parsed[xf]));
      }
      return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
    }
  };
}

/* Office PPTX */
async function prepPptx(name,buffer){
  const JSZip=await loadJSZip();
  const zip=await JSZip.loadAsync(buffer);
  const parser=new DOMParser(), serializer=new XMLSerializer();
  const parsed={};
  const slideFiles=Object.keys(zip.files)
    .filter(f=>/^ppt\/slides\/slide\d+\.xml$/i.test(f))
    .sort((a,b)=>{
      const numA=parseInt((a.match(/\d+/)??['0'])[0]);
      const numB=parseInt((b.match(/\d+/)??['0'])[0]);
      return numA-numB;
    });

  const segs=[];
  for(let sIdx=0; sIdx<slideFiles.length; sIdx++){
    const sf=slideFiles[sIdx];
    const xmlStr=await zip.file(sf).async('string');
    const docXml=parser.parseFromString(xmlStr,'application/xml');
    parsed[sf]=docXml;
    const ps=Array.from(docXml.getElementsByTagName('a:p'));
    for(const p of ps){
      const tNodes=Array.from(p.getElementsByTagName('a:t'));
      const fullText=tNodes.map(t=>t.textContent).join('');
      if(hasWords(fullText)){
        // Find enclosing txBody
        let txBody=p.parentNode;
        while(txBody&&!txBody.nodeName.endsWith('txBody')) txBody=txBody.parentNode;
        segs.push({slideFile:sf,slideIndex:sIdx+1,p,txBody,tNodes,fullText});
      }
    }
  }

  // Scan PPTX charts (ppt/charts/chart*.xml) for titles, legend, category labels
  const chartFiles=Object.keys(zip.files).filter(f=>/^ppt\/charts\/chart\d+\.xml$/i.test(f));
  for(const cf of chartFiles){
    const xmlStr=await zip.file(cf).async('string');
    const chartXml=parser.parseFromString(xmlStr,'application/xml');
    parsed[cf]=chartXml;
    const aTs=Array.from(chartXml.getElementsByTagName('a:t'));
    for(const at of aTs){
      if(hasWords(at.textContent)) segs.push({chartFile:cf,chartNode:at,tNodes:[at],fullText:at.textContent});
    }
    const strCaches=Array.from(chartXml.getElementsByTagName('c:strCache'));
    for(const sc of strCaches){
      const pts=Array.from(sc.getElementsByTagName('c:pt'));
      for(const pt of pts){
        const v=pt.getElementsByTagName('c:v')[0];
        if(v&&hasWords(v.textContent)) segs.push({chartFile:cf,chartNode:v,tNodes:[v],fullText:v.textContent});
      }
    }
  }

  const items=segs.map(s=>s.fullText);
  const totalWords=items.reduce((acc,t)=>acc+(t.trim().split(/\s+/).filter(Boolean).length||0),0);

  return {
    ext:'pptx',name,items,segs,
    meta:{type:'pptx',slides:slideFiles.length,words:totalWords,sizeEstimate:`${slideFiles.length} ${L('slides')||'slides'} · ${totalWords.toLocaleString()} ${L('words')||'words'}`},
    build:async(out,notes,tgtLang,srcLang)=>{
      const rtl=isRtlLang(tgtLang);
      segs.forEach((seg,i)=>{
        const trans=out[i]??seg.fullText;
        if(seg.chartFile){
          if(seg.tNodes.length) seg.tNodes[0].textContent=trans;
          return;
        }
        if(seg.tNodes.length){
          seg.tNodes[0].textContent=trans;
          for(let k=1;k<seg.tNodes.length;k++) seg.tNodes[k].textContent='';
        }
        // Turn on shrink-to-fit
        if(seg.txBody){
          let bPr=seg.txBody.getElementsByTagName('a:bodyPr')[0];
          if(!bPr){
            bPr=seg.txBody.ownerDocument.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main','a:bodyPr');
            seg.txBody.insertBefore(bPr,seg.txBody.firstChild);
          }
          const noFit=bPr.getElementsByTagName('a:noAutofit')[0];if(noFit)noFit.remove();
          const spFit=bPr.getElementsByTagName('a:spAutoFit')[0];if(spFit)spFit.remove();
          if(!bPr.getElementsByTagName('a:normAutofit')[0]){
            const norm=seg.txBody.ownerDocument.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main','a:normAutofit');
            norm.setAttribute('fontScale','100000');
            norm.setAttribute('lnSpcReduction','20000');
            bPr.appendChild(norm);
          }
        }
        // RTL paragraph alignment and direction
        let pPr=seg.p.getElementsByTagName('a:pPr')[0];
        if(!pPr){
          pPr=seg.p.ownerDocument.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main','a:pPr');
          seg.p.insertBefore(pPr,seg.p.firstChild);
        }
        if(rtl){
          pPr.setAttribute('algn','r');
          pPr.setAttribute('rtl','1');
        }else{
          pPr.setAttribute('algn','l');
          pPr.setAttribute('rtl','0');
        }
      });

      for(const k in parsed){
        zip.file(k,serializer.serializeToString(parsed[k]));
      }
      return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation'});
    }
  };
}

/* Office XLSX */
async function prepXlsx(name,buffer){
  const JSZip=await loadJSZip();
  const zip=await JSZip.loadAsync(buffer);
  const parser=new DOMParser(), serializer=new XMLSerializer();
  let sstDoc=null;
  const sstFile=zip.file('xl/sharedStrings.xml');
  const segs=[];

  if(sstFile){
    const sstStr=await sstFile.async('string');
    sstDoc=parser.parseFromString(sstStr,'application/xml');
    const sis=Array.from(sstDoc.getElementsByTagName('si'));
    for(const si of sis){
      const tNodes=Array.from(si.getElementsByTagName('t'));
      const fullText=tNodes.map(t=>t.textContent).join('');
      if(hasWords(fullText)){
        segs.push({si,tNodes,fullText});
      }
    }
  }

  // Worksheets
  const sheetFiles=Object.keys(zip.files).filter(f=>/^xl\/worksheets\/sheet\d+\.xml$/i.test(f));
  const parsedSheets={};
  for(const sf of sheetFiles){
    const sStr=await zip.file(sf).async('string');
    parsedSheets[sf]=parser.parseFromString(sStr,'application/xml');
  }

  const items=segs.map(s=>s.fullText);
  const totalWords=items.reduce((acc,t)=>acc+(t.trim().split(/\s+/).filter(Boolean).length||0),0);

  return {
    ext:'xlsx',name,items,segs,
    meta:{type:'xlsx',sheets:sheetFiles.length,words:totalWords,sizeEstimate:`${sheetFiles.length} ${L('sheets')||'sheets'} · ${totalWords.toLocaleString()} ${L('words')||'words'}`},
    build:async(out,notes,tgtLang,srcLang)=>{
      const rtl=isRtlLang(tgtLang);
      segs.forEach((seg,i)=>{
        const trans=out[i]??seg.fullText;
        if(seg.tNodes.length){
          seg.tNodes[0].textContent=trans;
          for(let k=1;k<seg.tNodes.length;k++) seg.tNodes[k].textContent='';
        }
      });
      if(sstDoc){
        zip.file('xl/sharedStrings.xml',serializer.serializeToString(sstDoc));
      }
      // Update sheet views for RTL
      for(const sf of sheetFiles){
        const sDoc=parsedSheets[sf];
        const sheetViews=sDoc.getElementsByTagName('sheetView');
        for(let v=0;v<sheetViews.length;v++){
          if(rtl) sheetViews[v].setAttribute('rightToLeft','1');
          else sheetViews[v].removeAttribute('rightToLeft');
        }
        zip.file(sf,serializer.serializeToString(sDoc));
      }
      return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    }
  };
}

function prepDoc(name,text){
  const ext=(name.split('.').pop()||'txt').toLowerCase();text=text.replace(/^\ufeff/,'');
  if(ext==='json'){
    const data=JSON.parse(text),refs=[];
    (function walk(o){for(const k in o){const v=o[k];if(typeof v==='string'){if(hasWords(v))refs.push([o,k])}else if(v&&typeof v==='object')walk(v)}})(data);
    const items=refs.map(([o,k])=>o[k]);
    const words=items.reduce((acc,t)=>acc+(t.trim().split(/\s+/).filter(Boolean).length||0),0);
    return {ext,name,items,meta:{type:'json',words,estPages:Math.max(1,Math.round(words/300)),sizeEstimate:`${items.length} strings · ${words.toLocaleString()} words`},build:out=>{refs.forEach(([o,k],i)=>o[k]=out[i]);return JSON.stringify(data,null,2)}};
  }
  if(ext==='csv'){
    const rows=csvParse(text),refs=[];rows.forEach((r,y)=>r.forEach((c,x)=>{if(hasWords(c))refs.push([y,x])}));
    const items=refs.map(([y,x])=>rows[y][x]);
    const words=items.reduce((acc,t)=>acc+(t.trim().split(/\s+/).filter(Boolean).length||0),0);
    return {ext,name,items,meta:{type:'csv',words,estPages:Math.max(1,Math.round(words/300)),sizeEstimate:`${rows.length} rows · ${words.toLocaleString()} words`},getRows:()=>rows,build:out=>{refs.forEach(([y,x],i)=>rows[y][x]=out[i]);return csvOut(rows)}};
  }
  const md=ext==='md'||ext==='markdown',lines=text.replace(/\r\n?/g,'\n').split('\n'),pre=[],items=[];let code=false;
  lines.forEach((l,i)=>{
    if(md&&/^\s*(```|~~~)/.test(l)){code=!code;pre[i]=null;return}
    if(code||!hasWords(l)){pre[i]=null;return}
    const m=md?l.match(/^(\s*(?:#{1,6}\s+|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+|>\s*)*)([\s\S]*)$/):l.match(/^(\s*)([\s\S]*)$/);
    pre[i]=m[1];items.push(m[2]);
  });
  const words=items.reduce((acc,t)=>acc+(t.trim().split(/\s+/).filter(Boolean).length||0),0);
  const estPages=Math.max(1,Math.round(words/300));
  return {
    ext:md?'md':'txt',name,items,
    meta:{type:md?'md':'txt',words,estPages,sizeEstimate:`~${estPages} pages · ${words.toLocaleString()} words`},
    build:(out,notes)=>{
      let k=0;
      return lines.map((l,i)=>{
        if(pre[i]==null)return l;
        const curK=k++;
        const note=notes?.[curK];
        const resText=out[curK]??items[curK];
        return pre[i]+resText+(note?` [یادداشت مترجم: ${note}]`:'');
      }).join('\n');
    }
  };
}

/* Subject & Terminology Detection */
let docTerms=[];
function renderDocTerms(terms){
  docTerms=terms||[];
  const list=$('docTermsList');
  if(!list)return;
  list.innerHTML='';
  docTerms.forEach((t,idx)=>{
    const chip=document.createElement('div');
    chip.className='doc-term-chip';
    chip.innerHTML=`<input class="doc-term-s" data-i="${idx}" value="${esc(t.s||'')}" placeholder="source">
      <span class="doc-term-arrow">→</span>
      <input class="doc-term-t" data-i="${idx}" value="${esc(t.t||'')}" placeholder="translation">
      <button class="doc-term-del" type="button" title="Delete" data-i="${idx}">×</button>`;
    list.appendChild(chip);
  });
  list.querySelectorAll('.doc-term-s').forEach(inp=>inp.oninput=e=>{const i=+e.target.dataset.i;if(docTerms[i])docTerms[i].s=e.target.value.trim()});
  list.querySelectorAll('.doc-term-t').forEach(inp=>inp.oninput=e=>{const i=+e.target.dataset.i;if(docTerms[i])docTerms[i].t=e.target.value.trim()});
  list.querySelectorAll('.doc-term-del').forEach(btn=>btn.onclick=e=>{const i=+e.target.dataset.i;docTerms.splice(i,1);renderDocTerms(docTerms)});
}
function getDocTerms(){
  return (docTerms||[]).filter(x=>x.s&&x.t);
}

function getDocEngineChain(){
  const cur=$('engine')?.value||'auto';
  if(cur&&cur!=='auto'&&usable(cur)) return [cur];
  if(isOff()){
    const offList=['nllb','chrome','ollama'].filter(usable);
    if(offList.length) return offList;
    return ['nllb'];
  }
  const mode=$('tMode')?.value||(typeof getDefaultTransMode==='function'?getDefaultTransMode():'fast');
  if(mode==='fast'){
    return typeof getFastChain==='function'?getFastChain():['google','mymemory'];
  }
  return typeof getSmartEngineChain==='function'?getSmartEngineChain():cfg.order.filter(usable);
}

async function detectSubjectAndTerms(d){
  const engId=$('engine').value;
  const isAi=ENG[engId]?.ai||(engId==='auto'&&usableAiEngine());
  if(!isAi){
    $('docEngineNotice').hidden=false;
    $('docSubjectCard').hidden=true;
    $('docSubjAnalyzing').hidden=true;
    return;
  }
  $('docEngineNotice').hidden=true;
  $('docSubjectCard').hidden=false;
  $('docSubjAnalyzing').hidden=false;

  // Build sample
  const sampleParts=[];
  const total=d.items.length;
  if(total>0) sampleParts.push(d.items[0]);
  if(total>1) sampleParts.push(d.items[1]);
  if(total>5) sampleParts.push(d.items[Math.floor(total/2)]);
  if(total>8) sampleParts.push(d.items[Math.floor(total*0.75)]);
  const sampleText=sampleParts.join('\n').slice(0,1400);

  const prompt=`You are an expert translation and domain analysis assistant.
Analyze this document sample and determine:
1. "subject": A concise subject/field (e.g. "Computer Science / Operating Systems", "Biomedicine", "Finance", "Law")
2. "register": One of: "Technical / Specialized", "Formal / Academic", "Neutral / Standard", "Casual / Colloquial"
3. "terms": An array of up to 6 key technical terms with their recommended translation from ${langName($('src').value)} to ${langName($('tgt').value)}: [{"s":"source term","t":"target translation"}]
Reply ONLY with a JSON object in this exact schema:
{"subject":"...","register":"Technical / Specialized","terms":[{"s":"...","t":"..."}]}

Document sample:
${sampleText}`;

  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), 20000);
  try{
    const res=await chat([{role:'user',content:prompt}],{engine:isAi?engId:'auto',signal:ctl.signal});
    let clean=res.text.replace(/```(?:json)?/g,'').trim();
    const a=clean.indexOf('{'), b=clean.lastIndexOf('}');
    if(a>=0&&b>a) clean=clean.slice(a,b+1);
    const data=JSON.parse(clean);
    if(data.subject) $('docSubjectField').value=data.subject;
    if(data.register) $('docRegister').value=data.register;
    if(Array.isArray(data.terms)) renderDocTerms(data.terms);
  }catch(e){
    console.warn('Subject detection skipped:', scrubKeys(e.message));
  }finally{
    clearTimeout(tm);
    $('docSubjAnalyzing').hidden=true;
  }
}

$('docAddTermBtn').onclick=()=>{
  docTerms.push({s:'',t:''});
  renderDocTerms(docTerms);
  const inps=$('docTermsList').querySelectorAll('.doc-term-s');
  if(inps.length) inps[inps.length-1].focus();
};
$('docAddToGlossaryBtn').onclick=()=>{
  const valid=getDocTerms();
  if(!valid.length){toast('No terms to add','warn');return}
  let added=0;
  valid.forEach(v=>{
    if(!glossary.some(g=>g.s.toLowerCase()===v.s.toLowerCase())){
      glossary.push({s:v.s,t:v.t});
      added++;
    }
  });
  store.set('gls', glossary);
  renderGloss();
  toast(`${added} ${L('docAddedToGlossary')||'terms added to Glossary'}`,'ok');
};

async function reviewDocTermsInContext(){
  const valid=getDocTerms();
  if(!valid.length){toast(L('noTermsToReview')||'No key terms detected to review','warn');return}
  const engId=$('engine').value;
  const isAi=ENG[engId]?.ai||(engId==='auto'&&usableAiEngine());
  if(!isAi){toast(L('docEngineNoticeText')||'Terminology review requires an AI engine','warn');return}

  $('docSubjAnalyzing').hidden=false;
  const statusSpan=$('docSubjAnalyzing').querySelector('span');
  const origText=statusSpan ? statusSpan.textContent : '';
  if(statusSpan) statusSpan.textContent=L('docReviewing')||'Reviewing detected terms in context…';

  try{
    const sample=doc?.items?.slice(0, 25)?.join('\n')?.slice(0, 3000)||'';
    const subj=$('docSubjectField').value||'General';
    const srcLangName=langName($('src').value);
    const tgtLangName=langName($('tgt').value);
    const prompt=`You are a senior technical translator and domain terminology editor.
DOCUMENT DOMAIN: ${subj}
TARGET LANGUAGE: ${tgtLangName} (Source: ${srcLangName})

DOCUMENT SAMPLE CONTEXT:
${sample}

DETECTED KEY TERMS TO REVIEW:
${JSON.stringify(valid)}

TASK:
Re-read each detected term in the context of the document domain.
Critically inspect each target translation for:
1. False friends and comical literal translation errors (for example, in computer systems "cache line" must NEVER be translated as "خط کش حافظه پنهان" where "خط کش" means a measuring ruler; the correct Persian term is "خط حافظه نهان (Cache Line)").
2. Misleading or incorrect technical vocabulary in this specific domain.
3. Proper spelling, standard capitalization, and technical conventions.

Return a JSON array of objects with the verified or corrected target translations:
[{"s": "source term", "t": "verified or corrected target translation", "corrected": true/false, "note": "brief reason if changed"}]
Return ONLY the raw JSON array.`;

    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), 25000);
    let res;
    try {
      res = await chat([{role:'user',content:prompt}],{engine:isAi?engId:'auto',signal:ctl.signal});
    } finally {
      clearTimeout(tm);
    }
    let clean=res.text.replace(/```(?:json)?/g,'').trim();
    const a=clean.indexOf('['), b=clean.lastIndexOf(']');
    if(a>=0&&b>a) clean=clean.slice(a,b+1);
    const reviewed=JSON.parse(clean);
    let correctedCount=0;
    if(Array.isArray(reviewed)){
      reviewed.forEach(r=>{
        const match=docTerms.find(dt=>dt.s.toLowerCase()===r.s.toLowerCase());
        if(match && r.t){
          if(match.t!==r.t){
            match.t=r.t;
            correctedCount++;
          }
        }
      });
      renderDocTerms(docTerms);
      toast(correctedCount>0?`Reviewed: ${correctedCount} term(s) corrected in context`:'All key terms verified accurate in context','ok',5000);
    }
  }catch(e){
    toast('Terminology review: '+e.message,'warn');
  }finally{
    $('docSubjAnalyzing').hidden=true;
    if(statusSpan) statusSpan.textContent=origText;
  }
}
$('docReviewTermsBtn').onclick=reviewDocTermsInContext;

const isDocErr=s=>!s||!s.trim()||/^(error|failed|http\s*\d+|429|503|rate limit|quota|timeout|timed?\s*out|unavailable|resource_exhausted)/i.test(s.trim());

function updateDocStatus(status, text){
  const chip=$('dStatusChip');
  const txt=$('dStatusText');
  if(chip) chip.className='doc-status-chip '+(status||'idle');
  if(txt){
    if(text) txt.textContent=text;
    else if(status==='idle') txt.textContent=(ui==='fa'?'آماده':'Ready');
    else if(status==='active'||status==='translating') txt.textContent=(ui==='fa'?'در حال ترجمه…':'Translating…');
    else if(status==='ok'||status==='done') txt.textContent=(ui==='fa'?'انجام شد':'Done');
    else if(status==='warn'||status==='partial') txt.textContent=(ui==='fa'?'ناقص':'Partial');
    else if(status==='error') txt.textContent=(ui==='fa'?'خطا':'Error');
  }
}

function updateDocProgCounts(done, total){
  const el=$('dProgCounts');
  if(!el) return;
  const word = ui==='fa'?'بخش':'segments';
  if(total==null||total===0){
    el.textContent=`0 ${word}`;
  }else if(done==null){
    el.textContent=`${total} ${word}`;
  }else{
    el.textContent=ui==='fa'?`${done} از ${total} ${word}`:`${done} / ${total} ${word}`;
  }
}

function renderDocSummary(validCount, totalCount, failedCount, memHits, engUsed){
  const card=$('docSummaryCard');
  if(!card||!doc) return;
  card.hidden=false;

  let countVal=String(validCount);
  let countLbl=ui==='fa'?'بخش ترجمه‌شده':'Translated segments';
  if(doc.ext==='pptx'&&doc.meta?.slides){
    countVal=`${validCount} / ${totalCount}`;
    countLbl=ui==='fa'?'بخش‌های اسلاید':'Slide segments';
  }else if(doc.ext==='xlsx'&&doc.meta?.sheets){
    countVal=`${validCount} / ${totalCount}`;
    countLbl=ui==='fa'?'بخش‌های برگه':'Sheet segments';
  }else if(doc.ext==='csv'&&doc.getRows){
    countVal=`${validCount} / ${totalCount}`;
    countLbl=ui==='fa'?'بخش‌های سطر':'Row segments';
  }
  if($('docSummaryCount')) $('docSummaryCount').textContent=countVal;
  if($('docSummaryCountLbl')) $('docSummaryCountLbl').textContent=countLbl;

  const outFmtSel=$('dOutFmt')?.value||'same';
  const outExt=(outFmtSel==='same'?doc.ext:outFmtSel).toUpperCase();
  if($('docSummaryFormat')) $('docSummaryFormat').textContent=outExt;
  if($('docSummaryEngine')) $('docSummaryEngine').textContent=engUsed||(ui==='fa'?'خودکار':'Auto');

  const factsList=$('docSummaryFacts');
  if(!factsList) return;
  factsList.innerHTML='';

  const tgtLang=$('tgt')?.value;
  const rtl=isRtlLang(tgtLang);
  if(rtl){
    const factEl=document.createElement('div');
    factEl.className='doc-summary-fact ok';
    factEl.textContent=ui==='fa'?'جهت متن راست‌به‌چپ (RTL) اعمال شد':'Right-to-left (RTL) text direction applied';
    factsList.appendChild(factEl);
    if(doc.ext==='xlsx'){
      const xFact=document.createElement('div');
      xFact.className='doc-summary-fact ok';
      xFact.textContent=ui==='fa'?'چینش برگه‌ها روی راست‌به‌چپ تنظیم شد':'Worksheet views updated to right-to-left';
      factsList.appendChild(xFact);
    }
  }
  if(memHits>0){
    const mFact=document.createElement('div');
    mFact.className='doc-summary-fact info';
    mFact.textContent=ui==='fa'?`${memHits} بخش از حافظه ترجمه بازیابی شد`:`${memHits} segment(s) retrieved from Translation Memory`;
    factsList.appendChild(mFact);
  }
  if(failedCount>0){
    const fFact=document.createElement('div');
    fFact.className='doc-summary-fact warn';
    fFact.textContent=ui==='fa'?`${failedCount} بخش ناموفق بود (متن اصلی حفظ شد)`:`${failedCount} segment(s) failed (original text retained)`;
    factsList.appendChild(fFact);
  }
  if($('docNotes')?.checked){
    const nFact=document.createElement('div');
    nFact.className='doc-summary-fact info';
    nFact.textContent=ui==='fa'?'یادداشت‌های مترجم در سند درج شدند':'Translator footnotes/notes embedded';
    factsList.appendChild(nFact);
  }
}

async function loadDoc(f){
  if(/\.pdf$/i.test(f.name)){
    toast(L('pdfNotSupported')||'PDF files are not supported yet.','warn',6000);
    return;
  }
  if(/\.(srt|vtt)$/i.test(f.name)){document.querySelector('[data-tab=sub]').click();return loadSubs(f)}

  const ext=(f.name.split('.').pop()||'txt').toLowerCase();
  $('dWork').hidden=false;
  $('dSave').disabled=true;
  $('dBar').style.width='0';
  $('dFileName').textContent=f.name;
  $('dBadge').textContent=ext.toUpperCase();

  try{
    if(ext==='docx'){
      const buf=await f.arrayBuffer();
      doc=await prepDocx(f.name,buf);
    }else if(ext==='pptx'){
      const buf=await f.arrayBuffer();
      doc=await prepPptx(f.name,buf);
    }else if(ext==='xlsx'){
      const buf=await f.arrayBuffer();
      doc=await prepXlsx(f.name,buf);
    }else{
      const text=await f.text();
      doc=prepDoc(f.name,text);
    }
  }catch(e){
    toast('Could not read file: '+e.message,'err',8000);
    return;
  }

  dResult='';dOutItems=null;
  const sizeKb=Math.round(f.size/1024)||(f.size>0?1:0);
  let detail='';
  if(doc.ext==='docx'&&doc.parsed&&doc.parsed['word/document.xml']){
    const trCount=doc.parsed['word/document.xml'].getElementsByTagName('w:tr').length;
    if(trCount>0) detail=`${trCount} ${L('rows')||'table rows'}`;
    else detail=`${doc.items.length} ${L('segments')}`;
  }else if(doc.ext==='pptx'&&doc.meta?.slides){
    detail=`${doc.meta.slides} ${L('slides')||'slides'}`;
  }else if(doc.ext==='xlsx'&&doc.meta?.sheets){
    detail=`${doc.meta.sheets} ${L('sheets')||'sheets'}`;
  }else if(doc.ext==='csv'&&doc.getRows){
    detail=`${doc.getRows().length} ${L('rows')||'rows'}`;
  }else{
    detail=`${doc.items.length} ${L('segments')}`;
  }
  $('dSizePill').textContent=`${sizeKb} KB · ${detail}`;
  $('dInfo').textContent=`${doc.items.length} ${L('segments')}`;
  $('dIn').value=doc.items.slice(0,25).join('\n\n').slice(0,50000);
  $('dOut').value='';

  updateDocStatus('idle');
  updateDocProgCounts(null, doc.items.length);
  $('dProgText').textContent=ui==='fa'?'آماده ترجمه':'Ready to translate';
  $('dEngineUsed').textContent='';
  if($('docSummaryCard')) $('docSummaryCard').hidden=true;

  // Reset terms and detect subject
  renderDocTerms([]);
  detectSubjectAndTerms(doc);
}

dropzone($('dDrop'),$('dFile'),loadDoc);
$('dChangeFile').onclick=()=>$('dFile').click();

$('dGo').onclick=async()=>{
  if(!doc)return;
  dCtl=new AbortController();
  busy([$('dGo')],$('dStop'),true);
  try{
    updateDocStatus('active');
    $('dProgText').textContent=ui==='fa'?'در حال ترجمه…':'Translating…';
    $('dEngineUsed').textContent='';
    updateDocProgCounts(0, doc.items.length);
    $('dBar').style.width='0%';

    const extraOpts={
      subject:$('docSubjectField')?.value?.trim()||'',
      register:$('docRegister')?.value||'',
      terms:getDocTerms(),
      includeNotes:!!$('docNotes')?.checked
    };

    const curEngine=$('engine')?.value||'auto';
    const firstEng=curEngine==='auto'?cfg.order.find(usable):curEngine;
    const docMemMode=(firstEng&&ENG[firstEng]?.ai)?'smart':'fast';
    const srcLang=$('src').value==='finglish'?'auto':$('src').value;
    const tgtLang=$('tgt').value;
    const tone=$('tone')?.value||'';
    const subject=extraOpts.subject||$('tSubject')?.value?.trim()||'';

    const partialOut=new Array(doc.items.length);
    const partialNotes=new Array(doc.items.length);
    const uniqueMap=new Map();
    const uniquePieces=[];

    for(let i=0;i<doc.items.length;i++){
      const raw=doc.items[i];
      const trimmed=(raw||'').trim();
      // Skip empty and numbers/punctuation/symbols-only snippets
      if(!trimmed||!/\p{L}/u.test(trimmed)){
        partialOut[i]=raw;
        partialNotes[i]=null;
        continue;
      }
      let entry=uniqueMap.get(trimmed);
      if(!entry){
        entry={id:uniquePieces.length,text:trimmed,indices:[i],out:null,note:null};
        uniqueMap.set(trimmed,entry);
        uniquePieces.push(entry);
      }else{
        entry.indices.push(i);
      }
    }

    // 1. Look up memory for unique pieces
    const neededPieces=[];
    let memHits=0;
    if(cfg.tm!==false&&typeof TranslationMemory!=='undefined'){
      for(const piece of uniquePieces){
        try{
          const hit=await TranslationMemory.get({
            text:piece.text,
            src:srcLang,
            tgt:tgtLang,
            modeClass:docMemMode,
            tone,
            subject
          });
          if(hit&&hit.translatedText){
            piece.out=hit.translatedText;
            piece.note=null;
            for(const idx of piece.indices){
              partialOut[idx]=hit.translatedText;
              partialNotes[idx]=null;
            }
            memHits+=piece.indices.length;
            continue;
          }
        }catch(_){}
        neededPieces.push(piece);
      }
    }else{
      neededPieces.push(...uniquePieces);
    }

    const totalPieces=uniquePieces.length;
    const initialDonePieces=totalPieces-neededPieces.length;
    const initialDoneSegments=partialOut.filter(x=>x!==undefined).length;
    updateDocProgCounts(initialDoneSegments, doc.items.length);

    // Update initial memory state if there were hits
    if(memHits>0){
      const memMsg=`${memHits} ${L('fromMemory')||'from memory'}`;
      $('dEngineUsed').textContent=memMsg;
      updateDocProgCounts(initialDoneSegments, doc.items.length);
      $('dBar').style.width=totalPieces?Math.min(99, Math.round((initialDonePieces/totalPieces)*100))+'%':'0%';
    }

    // If all segments hit memory or were skipped numbers/empty, no engine call needed
    if(neededPieces.length===0){
      dResult=await doc.build(partialOut,partialNotes,$('tgt').value,$('src').value);
      dOutItems=partialOut.slice();
      $('dOut').value=partialOut.slice(0,25).join('\n\n').slice(0,50000);
      $('dSave').disabled=false;
      $('dBar').style.width='100%';
      const memMsg=memHits?`${memHits} ${L('fromMemory')||'from memory'}`:'';
      if(memMsg) $('dEngineUsed').textContent=memMsg;
      updateDocProgCounts(doc.items.length, doc.items.length);
      updateDocStatus('ok');
      $('dProgText').textContent=memMsg?`${L('done')} · ${memMsg}`:L('done');
      renderDocSummary(doc.items.length, doc.items.length, 0, memHits, 'Memory');
      toast(memMsg?`${L('done')} · ${memMsg}`:L('done'),'ok');
      return;
    }

    // 2. Translate only missing unique pieces
    try{
      const neededTexts=neededPieces.map(p=>p.text);
      const chain=getDocEngineChain();
      const initialEngName=ENG[chain[0]]?.name||chain[0];
      const initialMemNote=memHits?` · ${memHits} ${L('fromMemory')||'from memory'}`:'';
      if($('dProgText')){
        $('dProgText').textContent=ui==='fa'
          ? `در حال ترجمه ${initialDonePieces} از ${totalPieces} بخش · ${initialEngName}${initialMemNote}`
          : `Translating ${initialDonePieces} of ${totalPieces} pieces · ${initialEngName}${initialMemNote}`;
      }
      const r=await translateItems(neededTexts,opts(Object.assign({
        chain,
        signal:dCtl.signal,
        onStatus:(msg)=>{
          if(msg&&!/Translating with|در حال ترجمه با/i.test(msg)){
            if($('dProgText')) $('dProgText').textContent=msg;
          }
        },
        onProgress:(pos,tot,engId)=>{
          const done=initialDonePieces+pos;
          const pct=Math.min(99, Math.round((done/totalPieces)*100));
          $('dBar').style.width=pct+'%';
          const doneSegments=partialOut.filter(x=>x!==undefined).length;
          updateDocProgCounts(doneSegments, doc.items.length);
          const engName=ENG[engId]?.name||engId||initialEngName;
          const memNote=memHits?` · ${memHits} ${L('fromMemory')||'from memory'}`:'';
          if(memHits>0){
            $('dEngineUsed').textContent=`${memHits} ${L('fromMemory')||'from memory'}`;
          }
          if(ui==='fa'){
            $('dProgText').textContent=`در حال ترجمه ${done} از ${totalPieces} بخش · ${engName}${memNote}`;
          }else{
            $('dProgText').textContent=`Translating ${done} of ${totalPieces} pieces · ${engName}${memNote}`;
          }
        },
        onBatch:(batchIndices,res,currentOut,currentNotes)=>{
          const errRe=/^(error|failed|http\s*\d+|429|503|rate limit|quota|timeout|timed?\s*out|unavailable|resource_exhausted)/i;
          const batchOk=Array.isArray(res)&&batchIndices.length===res.length&&batchIndices.every((_,k)=>{
            const item=res[k];
            const txt=typeof item==='string'?item:(item?.text||'');
            return typeof txt==='string'&&txt.trim()&&!errRe.test(txt.trim());
          });

          batchIndices.forEach((kMiss,k)=>{
            const piece=neededPieces[kMiss];
            if(!piece) return;
            const trans=currentOut[kMiss];
            const note=currentNotes[kMiss];
            piece.out=trans;
            piece.note=note;
            for(const realIdx of piece.indices){
              partialOut[realIdx]=trans;
              partialNotes[realIdx]=note;
            }

            if(batchOk&&cfg.tm!==false&&typeof TranslationMemory!=='undefined'){
              const outText=typeof trans==='string'?trans:String(trans||'');
              if(outText.trim()){
                TranslationMemory.put({
                  sourceText:piece.text,
                  translatedText:outText,
                  src:srcLang,
                  tgt:tgtLang,
                  modeClass:docMemMode,
                  tone,
                  subject
                }).catch(()=>{});
              }
            }
          });
        }
      },extraOpts)));

      // Ensure all needed pieces are mapped back to partialOut even if onBatch was missed
      neededPieces.forEach((piece,k)=>{
        const trans=r.out?.[k]??piece.out;
        const note=r.notes?.[k]??piece.note;
        piece.out=trans;
        piece.note=note;
        for(const realIdx of piece.indices){
          if(partialOut[realIdx]===undefined||partialOut[realIdx]===null){
            partialOut[realIdx]=trans;
            partialNotes[realIdx]=note;
          }
        }
      });

      // Verify results segment by segment
      let validCount=0;
      let failedCount=0;
      for(let i=0;i<doc.items.length;i++){
        const raw=doc.items[i];
        const val=partialOut[i];
        const txt=typeof val==='string'?val:(val?.text||'');
        if(!raw||!raw.trim()){
          validCount++;
          if(partialOut[i]==null) partialOut[i]=raw;
        }else if(txt&&txt.trim()&&!isDocErr(txt)){
          validCount++;
        }else{
          failedCount++;
          if(partialOut[i]==null) partialOut[i]=doc.items[i];
        }
      }

      dResult=await doc.build(partialOut,partialNotes,$('tgt').value,$('src').value);
      dOutItems=partialOut.slice();
      $('dOut').value=partialOut.slice(0,25).join('\n\n').slice(0,50000);
      $('dSave').disabled=(validCount===0);

      const usedStr=memHits?`${r.used} (+${memHits} ${L('fromMemory')||'from memory'})`:r.used;
      renderDocSummary(validCount, doc.items.length, failedCount, memHits, r.used);

      if(failedCount>0){
        updateDocStatus('warn', ui==='fa'?'ناقص':'Partial');
        const pct=Math.min(99, Math.round((validCount/doc.items.length)*100));
        $('dBar').style.width=pct+'%';
        updateDocProgCounts(validCount, doc.items.length);
        $('dProgText').textContent=ui==='fa'
          ? `${validCount} از ${doc.items.length} ترجمه شد · ${failedCount} ناموفق`
          : `${validCount} of ${doc.items.length} translated · ${failedCount} failed`;
        toast(ui==='fa'?`ترجمه با ${failedCount} خط ناموفق انجام شد`:`Done with ${failedCount} failed segments`,'warn');
      }else{
        updateDocStatus('ok');
        $('dBar').style.width='100%';
        updateDocProgCounts(doc.items.length, doc.items.length);
        if(memHits>0) $('dEngineUsed').textContent=`${memHits} ${L('fromMemory')||'from memory'}`;
        $('dProgText').textContent=`${L('done')} · ${usedStr}`;
        toast(`${L('done')} · ${usedStr}`,'ok');
      }
      updateTmCount();
    }catch(e){
      let validCount=0;
      let failedCount=0;
      for(let i=0;i<doc.items.length;i++){
        const raw=doc.items[i];
        const val=partialOut[i];
        const txt=typeof val==='string'?val:(val?.text||'');
        if(!raw||!raw.trim()){
          validCount++;
          if(partialOut[i]==null) partialOut[i]=raw;
        }else if(txt&&txt.trim()&&!isDocErr(txt)){
          validCount++;
        }else{
          failedCount++;
          if(partialOut[i]==null) partialOut[i]=doc.items[i];
        }
      }

      if(validCount>0){
        renderDocSummary(validCount, doc.items.length, failedCount, memHits, '');
      }else{
        if($('docSummaryCard')) $('docSummaryCard').hidden=true;
      }

      if(e.name==='AbortError'||dCtl?.signal?.aborted){
        try{
          dResult=await doc.build(partialOut,partialNotes,$('tgt').value,$('src').value);
          dOutItems=partialOut.slice();
          $('dOut').value=partialOut.slice(0,25).join('\n\n').slice(0,50000);
          $('dSave').disabled=(validCount===0);
          updateDocStatus('warn', ui==='fa'?'متوقف شد':'Stopped');
          const pct=Math.min(99, Math.round((validCount/doc.items.length)*100));
          $('dBar').style.width=pct+'%';
          updateDocProgCounts(validCount, doc.items.length);
          $('dProgText').textContent=validCount>0
            ?(ui==='fa'?`ترجمه متوقف شد (${validCount} بخش ذخیره شد)`:'Stopped (partial translation saved)')
            :(ui==='fa'?'ترجمه متوقف شد':'Stopped');
          toast(L('stopped')+(validCount>0?' — partial file saved':''),'warn');
        }catch(be){
          fail(e);
        }
      }else{
        updateDocStatus('error', ui==='fa'?'خطا':'Error');
        const pct=Math.min(99, Math.round((validCount/doc.items.length)*100));
        $('dBar').style.width=pct+'%';
        updateDocProgCounts(validCount, doc.items.length);
        const reason=toPlainReason(e)||e.message||'failed';
        $('dProgText').textContent=ui==='fa'
          ? `خطا در ترجمه: ${reason}`
          : `Translation failed: ${reason}`;
        if(validCount>0){
          try{
            dResult=await doc.build(partialOut,partialNotes,$('tgt').value,$('src').value);
            dOutItems=partialOut.slice();
            $('dOut').value=partialOut.slice(0,25).join('\n\n').slice(0,50000);
            $('dSave').disabled=false;
          }catch(_){}
        }else{
          $('dSave').disabled=true;
        }
        fail(e);
      }
    }
  }finally{
    busy([$('dGo')],$('dStop'),false);
  }
};

$('dStop').onclick=()=>dCtl?.abort();
/* ---- Output format: the translated text can also be saved as Word, PDF, Markdown or plain text ---- */
const OUT_FORMATS={docx:{ext:'docx',type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},pdf:{ext:'pdf',type:'application/pdf'},md:{ext:'md',type:'text/markdown'},txt:{ext:'txt',type:'text/plain'}};
const xmlEsc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
function docParagraphs(items,stripMd){
  return items.map(x=>String(x??'').replace(/\r\n?/g,'\n')).filter(x=>x.trim()!=='').map(x=>stripMd?x.replace(/^\s{0,3}#{1,6}\s+/gm,'').replace(/(\*\*|__)(.+?)\1/g,'$2'):x);
}
async function buildPlainDocx(paras,tgt){
  const JSZip=await loadJSZip(),z=new JSZip(),rtl=isRtlLang(tgt);
  z.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  z.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  const lang=rtl?`<w:lang w:val="${xmlEsc(tgt)}" w:bidi="${xmlEsc(tgt)}"/>`:`<w:lang w:val="${xmlEsc(tgt)}"/>`;
  const body=paras.map(t=>{
    const runs=t.split('\n').map((ln,i)=>`${i?'<w:br/>':''}<w:t xml:space="preserve">${xmlEsc(ln)}</w:t>`).join('');
    return `<w:p><w:pPr>${rtl?'<w:bidi/>':''}<w:spacing w:after="160"/>${rtl?'<w:jc w:val="right"/>':''}</w:pPr><w:r><w:rPr>${rtl?'<w:rtl/>':''}${lang}</w:rPr>${runs}</w:r></w:p>`;
  }).join('');
  z.file('word/document.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  return z.generateAsync({type:'blob',mimeType:OUT_FORMATS.docx.type});
}
function docxToBlocks(docXml){
  if(!docXml)return [];
  const body=docXml.getElementsByTagName('w:body')[0];
  if(!body)return [];
  const blocks=[];
  function processNode(node){
    if(node.nodeName==='w:p'){
      const tNodes=Array.from(node.getElementsByTagName('w:t'));
      const text=tNodes.map(t=>t.textContent).join('');
      if(text.trim()) blocks.push({type:'p',text});
    }else if(node.nodeName==='w:tbl'){
      const trNodes=Array.from(node.childNodes).filter(n=>n.nodeName==='w:tr');
      const allTrs=trNodes.length?trNodes:Array.from(node.getElementsByTagName('w:tr'));
      const rows=[];
      for(const tr of allTrs){
        const tcNodes=Array.from(tr.childNodes).filter(n=>n.nodeName==='w:tc');
        const allTcs=tcNodes.length?tcNodes:Array.from(tr.getElementsByTagName('w:tc'));
        const rowCells=allTcs.map(tc=>{
          const ps=Array.from(tc.getElementsByTagName('w:p'));
          if(ps.length){
            return ps.map(p=>Array.from(p.getElementsByTagName('w:t')).map(t=>t.textContent).join('')).join('\n');
          }
          return Array.from(tc.getElementsByTagName('w:t')).map(t=>t.textContent).join('');
        });
        if(rowCells.length) rows.push(rowCells);
      }
      if(rows.length) blocks.push({type:'table',rows});
    }else if(node.nodeName==='w:sdt'){
      const content=node.getElementsByTagName('w:sdtContent')[0]||node;
      Array.from(content.childNodes).forEach(processNode);
    }
  }
  Array.from(body.childNodes).forEach(processNode);
  return blocks;
}
// PDF: every page is drawn by the browser (so Persian and other right-to-left text is shaped correctly)
// and stored as a picture inside a small, valid PDF file. The text in such a PDF cannot be selected.
async function buildPlainPdf(items,tgt){
  const rtl=isRtlLang(tgt),W=1240,H=1754,M=110,FS=30,LH=46,MAXP=150;
  try{await document.fonts.ready}catch{}
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const cx=cv.getContext('2d');
  const font=`${FS}px Vazirmatn,"Segoe UI",Tahoma,"Noto Sans Arabic","Noto Sans",Arial,sans-serif`;
  const pages=[],pageTexts=[];let curPageTexts=[];let y=M+FS,started=false;
  const fresh=()=>{
    cx.fillStyle='#fff';cx.fillRect(0,0,W,H);cx.fillStyle='#000';cx.font=font;
    cx.direction=rtl?'rtl':'ltr';cx.textAlign=rtl?'right':'left';cx.textBaseline='alphabetic';
    y=M+FS;started=true;curPageTexts=[];
  };
  const flush=()=>{
    if(!started)return;
    pages.push(cv.toDataURL('image/jpeg',0.85));
    pageTexts.push(curPageTexts);
    started=false;
    if(pages.length>MAXP)throw new Error(L('outTooLong'));
  };
  const recordText=t=>{if(t)curPageTexts.push(String(t))};
  const x0=rtl?W-M:M,maxW=W-2*M;

  const blocks=(items||[]).map(x=>typeof x==='string'?{type:'p',text:x}:x);
  for(const block of blocks){
    if(block.type==='table'&&Array.isArray(block.rows)&&block.rows.length){
      const numCols=Math.max(...block.rows.map(r=>r.length),1);
      const colW=maxW/numCols;
      const pad=12;
      const tableFS=Math.min(24,Math.max(14,Math.floor(colW/12)));
      const tableLH=Math.round(tableFS*1.4);
      const tblFont=`${tableFS}px Vazirmatn,"Segoe UI",Tahoma,"Noto Sans Arabic","Noto Sans",Arial,sans-serif`;

      for(const row of block.rows){
        cx.font=tblFont;
        const cellLines=row.map(cellText=>{
          const rawLines=String(cellText??'').split('\n');
          const res=[];
          for(const raw of rawLines){
            const words=raw.split(/\s+/).filter(Boolean);
            if(!words.length){res.push('');continue}
            let cur='';
            for(const w of words){
              const t=cur?cur+' '+w:w;
              if(cx.measureText(t).width>(colW-2*pad)&&cur){res.push(cur);cur=w}else cur=t;
            }
            if(cur) res.push(cur);
          }
          return res.length?res:[''];
        });

        const maxLines=Math.max(1,...cellLines.map(cl=>cl.length));
        const rowH=maxLines*tableLH+2*pad;

        if(!started)fresh();
        if(y+rowH>H-M){flush();fresh()}

        const rowY=y;
        for(let c=0;c<numCols;c++){
          const cellX=rtl?(W-M-(c+1)*colW):(M+c*colW);
          cx.strokeStyle='#333';
          cx.lineWidth=1.5;
          cx.strokeRect(cellX,rowY,colW,rowH);

          const lines=cellLines[c]||[];
          cx.fillStyle='#000';
          cx.font=tblFont;
          cx.direction=rtl?'rtl':'ltr';
          cx.textAlign=rtl?'right':'left';
          const textX=rtl?(cellX+colW-pad):(cellX+pad);
          let textY=rowY+pad+tableFS;
          for(const ln of lines){
            if(ln) cx.fillText(ln,textX,textY);
            textY+=tableLH;
          }
          if(row[c]!=null) recordText(row[c]);
        }
        y+=rowH;
      }
      y+=LH*0.5;
      cx.font=font;
    }else{
      const pText=block.text??String(block);
      for(const raw of pText.split('\n')){
        const words=raw.split(/\s+/).filter(Boolean),lines=[];let cur='';
        if(!started)fresh();
        cx.font=font;
        for(const w of words){
          const t=cur?cur+' '+w:w;
          if(cx.measureText(t).width>maxW&&cur){lines.push(cur);cur=w}else cur=t;
        }
        lines.push(cur);
        for(const ln of lines){
          if(y>H-M){flush();fresh();cx.font=font}
          cx.fillText(ln,x0,y);
          y+=LH;
        }
        recordText(raw);
      }
      y+=LH*0.5;
    }
  }
  flush();
  if(!pages.length){fresh();flush()}
  const enc=new TextEncoder(),parts=[],offs=[];let len=0;
  const put=b=>{const u=typeof b==='string'?enc.encode(b):b;parts.push(u);len+=u.length};
  const obj=(n,fn)=>{offs[n]=len;put(`${n} 0 obj\n`);fn();put('\nendobj\n')};
  put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n=pages.length,kids=[];
  obj(1,()=>put('<< /Type /Catalog /Pages 2 0 R >>'));
  pages.forEach((_,i)=>kids.push(`${3+i*3+2} 0 R`));
  obj(2,()=>put(`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${n} >>`));
  pages.forEach((d,i)=>{
    const img=Uint8Array.from(atob(d.split(',')[1]),c=>c.charCodeAt(0)),base=3+i*3;
    obj(base,()=>{put(`<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`);put(img);put('\nendstream')});
    const textComments=(pageTexts[i]||[]).map(t=>`% TEXT: ${t.replace(/\r?\n/g,' ')}`).join('\n');
    const content=`q 595.28 0 0 841.89 0 0 cm /Im${i} Do Q`+(textComments?`\n${textComments}`:'');
    const contentBytes=enc.encode(content);
    obj(base+1,()=>put(`<< /Length ${contentBytes.length} >>\nstream\n${content}\nendstream`));
    obj(base+2,()=>put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im${i} ${base} 0 R >> >> /Contents ${base+1} 0 R >>`));
  });
  const total=3+n*3,xref=len;
  put(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for(let i=1;i<total;i++)put(String(offs[i]).padStart(10,'0')+' 00000 n \n');
  put(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts,{type:OUT_FORMATS.pdf.type});
}
async function buildOutputFormat(fmt){
  const tgt=$('tgt').value;
  if(fmt==='pdf'){
    let blocks=null;
    if(doc&&doc.ext==='docx'&&doc.parsed&&doc.parsed['word/document.xml']){
      blocks=docxToBlocks(doc.parsed['word/document.xml']);
    }else if(doc&&doc.ext==='csv'&&doc.getRows){
      blocks=[{type:'table',rows:doc.getRows()}];
    }
    if(blocks&&blocks.length){
      return buildPlainPdf(blocks,tgt);
    }
    const paras=docParagraphs(dOutItems||[],doc.ext==='md'||doc.ext==='markdown');
    return buildPlainPdf(paras,tgt);
  }
  const paras=docParagraphs(dOutItems||[],doc.ext==='md'||doc.ext==='markdown');
  if(fmt==='docx')return buildPlainDocx(paras,tgt);
  return paras.join('\n\n')+'\n'; // md and txt: plain paragraphs
}
$('dOutFmt').value=store.get('dOutFmt','same');
$('dOutFmt').onchange=()=>store.set('dOutFmt',$('dOutFmt').value);
$('dSave').onclick=async()=>{
  if(!dResult||!doc)return;
  const p=doc.name.lastIndexOf('.');
  const baseName=p>0?doc.name.slice(0,p):doc.name;
  const fmt=$('dOutFmt').value;
  if(fmt==='same'||!OUT_FORMATS[fmt]||(OUT_FORMATS[fmt].ext===doc.ext)){
    const ext=p>0?doc.name.slice(p):'.'+doc.ext;
    return download(`${baseName}.${$('tgt').value}${ext}`,dResult);
  }
  if(!dOutItems){toast('Nothing translated yet','warn');return}
  try{
    $('dSave').disabled=true;
    const data=await buildOutputFormat(fmt);
    download(`${baseName}.${$('tgt').value}.${OUT_FORMATS[fmt].ext}`,data,OUT_FORMATS[fmt].type);
  }catch(e){fail(e)}
  $('dSave').disabled=false;
};

function openDocEngineSettings(){
  if(typeof renderEngines==='function') renderEngines();
  let ok=0,total=cfg.order.length;
  cfg.order.forEach(id=>{if(engineConnStatus[id]?.code==='works')ok++});
  if(Object.keys(engineConnStatus).length&&$('checkConnSummary'))$('checkConnSummary').textContent=`${ok}/${total} ${L('connWorks')}`;
  $('ov').classList.add('on');
  const targetTab = isOff() ? 'secTrModels' : 'secEngines';
  if(typeof switchSettingsTab==='function') switchSettingsTab(targetTab);
  setTimeout(()=>{
    const sec = $(targetTab);
    if(sec){
      const first = sec.querySelector('button, select, input');
      if(first) first.focus();
    }
  }, 100);
}

function updateDocEngineInfo(){
  const line=$('docEngineLine');
  const txtEl=$('docEngineText');
  if(!line||!txtEl) return;
  if(typeof cfg==='undefined'||!cfg?.eng||!cfg?.order) return;

  const curEng=$('engine')?.value||'auto';
  const modeVal=$('tMode')?.value||(typeof getDefaultTransMode==='function'?getDefaultTransMode():'fast');
  const off=isOff();
  const chain=getDocEngineChain();
  const primaryId=chain[0]||'google';
  const engName=ENG[primaryId]?.name||primaryId;

  let modeLabel='';
  if(off){
    modeLabel=ui==='fa'?'آفلاین':'Offline';
  }else if(modeVal==='fast'){
    modeLabel=ui==='fa'?'سریع (Fast)':'Fast';
  }else if(modeVal==='smart'){
    modeLabel=ui==='fa'?'هوشمند (Smart)':'Smart';
  }else if(modeVal==='both'){
    modeLabel=ui==='fa'?'ترکیبی (Both)':'Both';
  }else{
    modeLabel=modeVal;
  }

  const netLabel=off?(ui==='fa'?'آفلاین':'Offline'):(ui==='fa'?'آنلاین':'Online');
  const netClass=off?'offline':'online';
  const autoTag=curEng==='auto'?(ui==='fa'?' (خودکار)':' (Auto)'):'';

  const engineHtml=`<bdi class="doc-engine-name">${esc(engName)}${autoTag}</bdi>`;
  const modeHtml=`<span class="doc-engine-mode-pill">${esc(modeLabel)}</span>`;
  const netHtml=`<span class="doc-engine-net-pill ${netClass}">${esc(netLabel)}</span>`;

  if(ui==='fa'){
    txtEl.innerHTML=`موتور: ${engineHtml} · حالت: ${modeHtml} · وضعیت: ${netHtml}`;
  }else{
    txtEl.innerHTML=`Engine: ${engineHtml} · Mode: ${modeHtml} · Status: ${netHtml}`;
  }
}

if($('docOpenEngineSettings')){
  $('docOpenEngineSettings').onclick=openDocEngineSettings;
}

if($('engine')) $('engine').addEventListener('change', updateDocEngineInfo);
if($('tMode')) $('tMode').addEventListener('change', updateDocEngineInfo);
if($('offline')) $('offline').addEventListener('change', updateDocEngineInfo);
if($('offBtn')) $('offBtn').addEventListener('click', () => setTimeout(updateDocEngineInfo, 10));
document.querySelectorAll('[data-tab=doc]').forEach(btn=>btn.addEventListener('click', updateDocEngineInfo));
if(document.readyState!=='loading'){
  updateDocEngineInfo();
}else{
  document.addEventListener('DOMContentLoaded', updateDocEngineInfo);
}

