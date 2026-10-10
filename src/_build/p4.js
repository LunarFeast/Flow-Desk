/* ================= 规则引擎 =================
   两条通道，绝不混用：
   1) sbxm（象码）：单字 1-14、简码词 15-19、全码词 20-29 的既有细则（仅象码！）
   2) 其他方案：构词规则名与逐键说明全部从“该方案词典的 encoder formula”现场推导；
      单字说明只按码位+键类（声母/笔画/字根）描述，不套象码细则。
   所有展示编码本身一律取自词典 store.dict；公式只做对照解释。 */

/* —— 象码细则（仅 isXmScheme() 时使用） —— */
const RULE_NAMES={
 1:"一简字·单声母",
 2:"二简字·有理·声母+首根",
 3:"二简字·无理·首码声母、次码无理",
 4:"二简字·无理·首码无理、次码声母",
 5:"二简字·无理·首码首根、次码无理",
 6:"二简字·无理·其他",
 7:"三简字·有理·声母+首根+末根首笔",
 8:"三简字·无理·拼音前两码+提示",
 9:"三简字·无理·声母+首笔+提示",
 10:"三简字·无理·vv/vy+首笔",
 11:"三简字·无理·三码无理",
 12:"单字全码·单根字·声母+字根+首笔+次笔（只有一笔时次笔为重复笔画）",
 13:"单字全码·双根字·声母+首根+末根首笔+末根次笔（只有一笔时次笔为重复笔画）",
 14:"单字全码·多根字·声母+首根+次根+末根首笔",
 15:"简码词·二码·声声词，首字声母+次字声母",
 16:"简码词·二码·声笔词，首字声母+次字首笔",
 17:"简码词·三码·声声笔词，首字声母+次字声母+次字首笔",
 18:"简码词·三码·声笔笔词，首字声母+次字首笔+次字次笔",
 19:"简码词·四码·二三四字词，共享/补全前四码",
 20:"全码词·单字模式·共享/补全·二字词，首字首码+首字次码+末字声母+末字首笔符号形式",
 21:"全码词·单字模式·共享/补全·三字词，首字首码+次字首码+三字首码+末字首笔符号形式",
 22:"全码词·单字模式·共享/补全·多字词，首字首码+次字首码+三字首码+末字首笔符号形式",
 23:"全码词·单字模式·专用/变换·二字词，首字首码+首字次码+次字首码+次字首码数字形式",
 24:"全码词·单字模式·专用/变换·三字词，首字首码+次字首码+三字首码+三字首笔数字形式",
 25:"全码词·单字模式·专用/变换·四字词，首字首码+次字首码+三字首码+末字首码大写形式",
 26:"全码词·单字模式·专用/变换·五字词或以上，首字首码+次字首码+三字首码大写形式+末字首码",
 27:"全码词·词组模式·二字词，首字首码+首字次码+次字首码+次字次码",
 28:"全码词·词组模式·三字词，首字首码+次字首码+三字首码+三字次码",
 29:"全码词·词组模式·多字词，首字首码+次字首码+三字首码+末字首码",
 30:"纯笔画·全码，按笔顺逐笔输入",
 31:"纯笔画·简码，前若干笔即可定位",
 32:"全码词·词组模式·飞讯/飞简·二字词，首字前两码+次字首码+次字第三码",
 33:"全码词·词组模式·飞讯/飞简·三字词，前两字首码+第三字首码+第三字第三码",
 34:"全码词·词组模式·飞讯/飞简·多字词，前三字首码+末字第三码",
 35:"全码词·词组模式·简码·二字词，首字首码+次字前三码",
 36:"全码词·词组模式·简码·多字词，前三字首码+末字第二码",
 40:"拼音·全码，拼音串（含声调数字）",
 41:"拼音·简码，较短拼音即可定位",
 42:"反查·全码，按反查序列（笔画/部件键）逐键输入",
 43:"反查·简码，较短反查序列即可定位",
 50:"单字·一码",
 51:"单字·二码",
 52:"单字·三码",
 53:"单字·四码",
 54:"单字·五码及以上"
};
/* 简码词 15-18 的本地魔改失效提示 */
const MOD_NOTE="（检测到本地文件符号 ;',./ 对应笔画非原版，本简码输入/引导方式可能已经失效）";
const CF_SINGLE=new Set(['一','丨','丿','丶','乛','亅','㇀','㇁','㇂','㇃','㇄','㇅','㇆','㇇','㇈','㇉','㇊','㇋','㇌','㇍','㇎','㇏']);
function cfRoots(c){const cf=store.cf.get(c)||'';return [...cf].filter(x=>!CF_SINGLE.has(x));}
function rootCount(c){const r=cfRoots(c).length;return r===0?1:r;}
function firstRoot(c){return charInfo(c).full[1]||'';}
function firstStroke(c){return (store.strokes.get(c)||'').charAt(0);}
/* 象码单字编码分类 1-14 */
function classifyChar(code,c){
  const len=code.length, fr=firstRoot(c);
  if(len<=1)return 1;
  if(len===2){
    if(code[1]===fr&&fr)return 2;
    if(isInit(code[0])&&!isInit(code[1]))return 3;
    if(!isInit(code[0])&&isInit(code[1]))return 4;
    if(code[0]===fr&&fr&&!isInit(code[1]))return 5;
    return 6;
  }
  if(len===3){
    if(code[0]===(c?charInfo(c).s:'')&&code[1]===fr&&fr)return 7;
    if(code.slice(0,2)==='vv'||code.slice(0,2)==='vy')return 10;
    if(isInit(code[0])&&isStrokeK(code[1]))return 9;
    if(!isInit(code[0])&&!isInit(code[1]))return 8;
    return 11;
  }
  const rc=rootCount(c);
  if(rc<=1)return 12;
  if(rc===2)return 13;
  return 14;
}
/* 字字母：A/B/C…（超出字数归末字 Z） */
function UL(i,n){return String.fromCharCode(65+(i>=n?n-1:i));}
function tkCode(wi,ci,n,fulls){
  const k=(fulls[wi]&&fulls[wi][ci])||'';
  return {k,wi,ci,U:UL(wi,n),L:String.fromCharCode(97+ci)};
}
function tkLit(wi,ci,k,n){return {k,wi,ci,U:UL(wi,n),L:String.fromCharCode(97+ci),lit:true};}
/* 象码词组各细则的逐键 token（只用于解释，展示前仍与词典码核对） */
function phraseTokens(word,ruleId){
  const chars=[...word],n=chars.length,fulls=chars.map(c=>charInfo(c).full);
  const last=n-1, t=[];
  const push=(wi,ci)=>t.push(tkCode(wi,ci,n,fulls));
  const pushLit=(wi,ci,k)=>t.push(tkLit(wi,ci,k,n));
  const fs=wi=>firstStroke(chars[wi]);
  switch(ruleId){
    case 15: push(0,0);push(1,0);break;
    case 16: push(0,0);pushLit(1,0,fs(1));break;
    case 17: push(0,0);push(1,0);pushLit(1,1,fs(1));break;
    case 18: push(0,0);pushLit(1,0,fs(1));pushLit(1,1,(store.strokes.get(chars[1])||'')[1]||fs(1));break;
    case 19:
      if(n===2){push(0,0);push(0,1);push(1,0);pushLit(1,1,symForStroke(fs(1)));}
      else if(n===3){push(0,0);push(1,0);push(2,0);pushLit(2,1,symForStroke(fs(2)));}
      else{push(0,0);push(1,0);push(2,0);pushLit(last,1,symForStroke(fs(last)));}
      break;
    case 20: push(0,0);push(0,1);push(1,0);pushLit(1,1,symForStroke(fs(1)));break;
    case 21: push(0,0);push(1,0);push(2,0);pushLit(2,1,symForStroke(fs(2)));break;
    case 22: push(0,0);push(1,0);push(2,0);pushLit(last,1,symForStroke(fs(last)));break;
    case 23: push(0,0);push(0,1);push(1,0);pushLit(1,1,digitForStroke(fs(1)));break;
    case 24: push(0,0);push(1,0);push(2,0);pushLit(2,1,digitForStroke(fs(2)));break;
    case 25: push(0,0);push(1,0);push(2,0);pushLit(last,0,(fulls[last][0]||'').toUpperCase());break;
    case 26: push(0,0);push(1,0);pushLit(2,0,(fulls[2][0]||'').toUpperCase());push(last,0);break;
    case 27: push(0,0);push(0,1);push(1,0);push(1,1);break;
    case 28: push(0,0);push(1,0);push(2,0);push(2,1);break;
    case 29: push(0,0);push(1,0);push(2,0);push(last,0);break;
    case 32: push(0,0);push(0,1);push(1,0);push(1,2);break;
    case 33: push(0,0);push(1,0);push(2,0);push(2,2);break;
    case 34: push(0,0);push(1,0);push(2,0);push(last,2);break;
    case 35: push(0,0);push(1,0);push(1,1);push(1,2);break;
    case 36: push(0,0);push(1,0);push(2,0);push(last,1);break;
  }
  return {tokens:t,ruleId};
}

/* —— 通用（非象码）：从 encoder formula 现场推导规则名与逐键说明 —— */
const CN_CHAR=['首','次','三','四','末'];
function charIdxLabel(i,n){
  if(i>=n-1&&n>1)return '末字';
  return (CN_CHAR[i]||('第'+ORD[i]))+'字';
}
function codePosLabel(ci){return ci===0?'首码':(ci===1?'次码':'第'+ORD[ci]+'码');}
/* "AaAbBaBbAcAd" → "首字一二码＋次字一二码＋首字三四码" */
function formulaName(formula,n){
  const parts=[];let cur=null;
  for(const ch of formula){
    if(/[A-Z]/.test(ch)){const i=Math.min(ch.charCodeAt(0)-65,Math.max(n-1,0));cur={i,cis:[]};parts.push(cur);}
    else if(/[a-z]/.test(ch)&&cur)cur.cis.push(ch.charCodeAt(0)-97);
  }
  return parts.map(p=>{
    const lbl=charIdxLabel(p.i,n);
    const cs=p.cis.map(ci=>ci===0?'一':(ci===1?'二':ORD[ci])).join('');
    return lbl+cs+'码';
  }).join('＋');
}
/* 公式 → tokens（每个键：来自第几字第几码），与真实词典码核对后才展示 */
function formulaTokens(formula,fulls,n){
  const detailed=applyFormulaDetailed(formula,fulls);
  detailed.forEach(it=>{
    if(it.U==='Z'||(it.U.charCodeAt(0)-65)>=n)it.wi=n-1;
    it.U=UL(it.wi,n);
  });
  return detailed;
}
/* 逐键归位：把词库真实编码的每个键，按“值”对应回各字的取码位/笔顺，不猜公式。
   键大体按字序出现，故优先“上一键之后、尚未取过码的字”，再回退到已取过码的字（末字优先）。 */
function dictPhraseTokens(word,fulls,n,code){
  const chars=[...word],used=new Set(),claimed=new Set(),strokes=chars.map(c=>store.strokes.get(c)||''),out=[];
  let prevWi=0;
  const claim=i=>{claimed.add(i);prevWi=i;};
  const strokeOrder=()=>{
    const o=[];
    for(let wi=prevWi;wi<n;wi++)if(!claimed.has(wi))o.push(wi);
    for(let wi=0;wi<prevWi;wi++)if(!claimed.has(wi))o.push(wi);
    for(let wi=n-1;wi>=0;wi--)if(claimed.has(wi))o.push(wi);
    return o;
  };
  for(const k of code){
    let tk=null;
    /* 1) 声母/首码：按字序取第一个吻合且未被占用的字 */
    if(isInit(k))for(let wi=prevWi;wi<n+prevWi&&!tk;wi++){
      const i=wi%n;
      if(used.has('c'+i)||(fulls[i]||'')[0]!==k)continue;
      used.add('c'+i);claim(i);
      tk={k,wi:i,ci:0,U:UL(i,n),L:'a',tag:charIdxLabel(i,n)+'声母',role:'声母'};
    }
    /* 2) 笔画键（字母 a-e-u-i-o / 符号 ; ' , . / / 数字 2-9 三种形式）：按笔顺定位 */
    if(!tk){
      const s=isStrokeK(k)?k:(symToStroke(k)||digitToStroke(k));
      if(s)for(const wi of strokeOrder()){
        const p=(strokes[wi]||'').indexOf(s);
        if(p<0||used.has('s'+wi+'_'+p))continue;
        used.add('s'+wi+'_'+p);claim(wi);
        tk={k,wi,ci:p,U:UL(wi,n),L:'',stroke:s,tag:charIdxLabel(wi,n)+'第'+(p+1)+'笔',
            role:'第'+(p+1)+'笔'+(STROKE_NAME[s]||'')+'，'+k+'='+(STROKE_NAME[s]||'')};
        break;
      }
      if(!tk&&s)tk={k,wi:n-1,ci:'',U:UL(n-1,n),L:'',stroke:s,tag:'笔画'+(STROKE_NAME[s]||''),
                    role:'笔画'+(STROKE_NAME[s]||'')+'形式 '+k};
    }
    /* 3) 其他码位精确吻合 */
    if(!tk)for(let ci=1;ci<=5&&!tk;ci++)for(let wi=0;wi<n;wi++){
      if(used.has('c'+wi+'_'+ci)||(fulls[wi]||'')[ci]!==k)continue;
      used.add('c'+wi+'_'+ci);claim(wi);
      tk={k,wi,ci,U:UL(wi,n),L:String.fromCharCode(97+ci),tag:charIdxLabel(wi,n)+codePosLabel(ci),
          role:codePosLabel(ci)};
      break;
    }
    /* 4) 词库自有补充码 */
    if(!tk)tk={k,wi:-1,ci:'',U:'',L:'',tag:'补充码',role:'词库补充码'};
    out.push(tk);
  }
  return out;
}
function dictPhraseName(tokens){
  return '词库编码：'+tokens.map(t=>t.tag||'补码').join('＋');
}
/* 单字键角色（通用描述，不含象码细则）：c 给出时按该字笔顺/字根核对键形 */
function strokeForm(k){return isStrokeK(k)?k:(symToStroke(k)||digitToStroke(k)||'');}
function hasStroke(c,s){const str=store.strokes.get(c)||'';return !!s&&(!str||str.indexOf(s)>=0);}
function keyRole(k,ci,c){
  const s=strokeForm(k);
  if(s&&(!c||hasStroke(c,s))){
    const nm=STROKE_NAME[s]||'';
    if(k===s)return '笔画'+nm;
    return '笔画'+nm+'的'+(isDigitK(k)?'数字':isSymK(k)?'符号':'字母')+'形式 '+k;
  }
  if(/[A-Z]/.test(k)&&isInit(k.toLowerCase()))return '大写顶屏（'+k.toLowerCase()+' 的大写）';
  if(ci===0)return firstKind()==='stroke'?'第一码，笔画':(firstKind()==='root'?'第一码，字根首码':(isInit(k)?'第一码，声母':'第一码，首码'));
  if(s)return '第'+ORD[ci]+'码，字根<span class="zg-font">'+k+'</span>';
  if(ci===1)return '第二码，字根/形码';
  return '第'+ORD[ci]+'码';
}
/* 通用单字分组：按码长命名，逐键说明用键角色 */
function charGroups(c,codes){
  return codes.map(code=>{
    const tokens=[...code].map((k,ci)=>({k,wi:0,ci,U:'',L:String.fromCharCode(97+ci),role:keyRole(k,ci,c)}));
    const rid=code.length<=1?50:(code.length>=5?54:49+code.length);
    return {code,tokens,name:RULE_NAMES[rid],rid};
  });
}
/* 通用词组分组：对每个词典真实编码，尝试与本方案公式生成的全码比对 */
function phraseGroups(word,fulls,n){
  const codes=(store.dict.get(word)||[]).slice();
  const groups=[];
  const ef=encoderFormulaFor(n);
  const fCode=ef?formulaTokens(ef.formula,fulls,n):null;
  const fStr=fCode?fCode.map(t=>t.k).join(''):'';
  for(const code of codes){
    let g=null;
    if(fCode&&code===fStr){
      g={code,tokens:fCode,name:formulaName(ef.formula,n),kind:'full'};
    }else if(fCode&&fStr.startsWith(code)){
      g={code,tokens:fCode.slice(0,code.length),name:'简码·取全码前'+code.length+'码',kind:'simple'};
    }else if(fCode&&code.startsWith(fStr)&&code.length>fStr.length){
      /* 词典里的扩展编码：全码＋补充码（core.lua：扩展=首字前两笔等） */
      const extra=[...code.slice(fStr.length)].map((k,ci)=>({k,wi:0,ci,U:'A',L:String.fromCharCode(97+fStr.length+ci),role:keyRole(k,fStr.length+ci)}));
      g={code,tokens:fCode.concat(extra),name:'全码＋扩展码（重码补充）',kind:'full'};
    }else{
      /* 与本方案公式不吻合（词库自有编码）：逐键按值归位到各字取码位/笔顺 */
      const tokens=dictPhraseTokens(word,fulls,n,code);
      g={code,tokens,name:dictPhraseName(tokens),kind:code.length<=3?'simple':'full'};
    }
    groups.push(g);
  }
  groups.sort((a,b)=>a.code.length-b.code.length);
  return groups;
}
/* 非形码大类（纯笔画/拼音/两分）的通用分组 */
function groupsGeneric(word,kind){
  const codes=(store.dict.get(word)||[]).slice(),groups=[],seen=new Set();
  if(!codes.length)return groups;
  const maxLen=Math.max(...codes.map(c=>c.length)),n=[...word].length;
  for(const code of codes){
    if(seen.has(code))continue;seen.add(code);
    const isFull=code.length===maxLen;
    const rid=kind==='stroke'?(isFull?30:31):(kind==='rev'?(isFull?42:43):(isFull?40:41));
    const tokens=[...code].map((k,ci)=>({k,wi:0,ci,U:'',L:String.fromCharCode(97+ci),generic:kind,role:keyRole(k,ci)}));
    groups.push({rid,code,tokens,name:RULE_NAMES[rid],note:'',isFull});
  }
  groups.sort((a,b)=>b.code.length-a.code.length);
  return groups;
}
/* 笔画键形式互换后的规则吻合判定：非笔画键逐位相等，笔画键允许字母/符号/数字同笔 */
function phraseMatch(word,rid,code){
  const cs=[...code],tk=phraseTokens(word,rid).tokens;
  if(tk.length!==cs.length)return null;
  const out=[];
  for(let i=0;i<cs.length;i++){
    const t=tk[i],k=cs[i];
    const s1=isStrokeK(t.k)?t.k:(symToStroke(t.k)||digitToStroke(t.k)||'');
    const s2=isStrokeK(k)?k:(symToStroke(k)||digitToStroke(k)||'');
    if(s1||s2){if(!s1||!s2||s1!==s2)return null;out.push(Object.assign({},t,{k}));}
    else{if(t.k!==k)return null;out.push(t);}
  }
  return out;
}
/* 象码词组分组：细则 15-29 逐条与该词的词典真实编码核对，吻合才套用该细则名 */
function xmPhraseGroups(word){
  const chars=[...word],n=chars.length;
  const fulls=chars.map(c=>charInfo(c).full);
  const groups=[],seen=new Set();
  const add=(rid,tokens,note,name)=>{
    const code=tokens.map(x=>x.k).join('');
    if(!code||seen.has(code+'@'+rid))return;
    seen.add(code+'@'+rid);
    groups.push({rid,code,tokens,note:note||'',name:name||RULE_NAMES[rid]});
  };
  const dictCodes=(store.dict.get(word)||[]).slice();
  const mod=isStrokeModified();
  const proChar=opt('pro_char');
  const order=n===2?(proChar?[20,23,15,16,17,18,19]:[27,15,16,17,18,19,32,35])
            :n===3?(proChar?[21,24,17,18,19]:[28,17,18,19,33,36])
                  :(proChar?[22,25,26,19]:[29,19,34,36]);
  for(const code of dictCodes){
    let hit=null;
    for(const rid of order){
      const m=phraseMatch(word,rid,code);
      if(m){hit={rid,tokens:m};break;}
    }
    if(hit)add(hit.rid,hit.tokens,(mod&&hit.rid>=15&&hit.rid<=18)?MOD_NOTE:'');
    else{const dt=dictPhraseTokens(word,fulls,n,code);add(0,dt,'',dictPhraseName(dt));}
  }
  groups.sort((a,b)=>a.code.length-b.code.length);
  return groups;
}
/* 枚举一个词的全部编码分组：[{code,tokens,name,rid?,note?}] */
function groupsForWord(word){
  const kind=schemeKind();
  if(kind!=='shape'&&kind!=='')return groupsGeneric(word,kind==='two'?'pinyin':kind);
  if(!store.dict.size)return [];
  const codes=store.dict.get(word);
  if(!codes||!codes.length)return [];
  const chars=[...word],n=chars.length;
  if(isXmScheme()){
    if(n===1){
      const fullCodes=codes.slice().sort((a,b)=>a.length-b.length);
      return fullCodes.map(code=>({code,rid:classifyChar(code,chars[0]),name:RULE_NAMES[classifyChar(code,chars[0])],
        tokens:[...code].map((k,ci)=>({k,wi:0,ci,U:'A',L:String.fromCharCode(97+ci),role:keyRole(k,ci,chars[0])}))}));
    }
    return xmPhraseGroups(word);
  }
  const fulls=chars.map(c=>charInfo(c).full);
  if(n===1)return charGroups(chars[0],codes.slice().sort((a,b)=>a.length-b.length));
  return phraseGroups(word,fulls,n);
}

/* —— 渲染 —— */
/* 公式符号单元格：A（第一字）a（首码）；象码逐键注释复用 */
function formulaCellHtml(item,n){
  const U=item.U,L=item.L;let h='';
  if(U){
    const ui=U.charCodeAt(0)-65;
    const ulabel=(U==='Z'||ui>=n)?'末字':'第'+ORD[ui]+'字';
    h+=U+'<span class="ec-note">（'+ulabel+'）</span>';
  }
  if(L)h+=L+'<span class="ec-note">（'+codePosLabel(L.charCodeAt(0)-97)+'）</span>';
  return h||'<span class="ec-note">—</span>';
}
function keyNoteHtml(item,infos,n){
  if(item.generic){
    const k=item.k;
    const role=item.generic==='stroke'?('笔画'+(STROKE_NAME[k]||''))
      :item.generic==='rev'?('反查序列键（笔画/部件）')
      :(/[0-9]/.test(k)?('声调数字 '+k):'拼音字母');
    return `<b class="ec-key">${k}</b><span class="ec-note">（${role}）</span>`;
  }
  const {wi,ci,k}=item;
  if(wi<0)return `<b class="ec-key">${k}</b><span class="ec-note">（${item.role||'词库补充码'}）</span>`;
  const ch=infos[wi]?infos[wi].c:'';
  let pos='第'+ORD[wi]+'字';
  if(wi===n-1&&n>1)pos='第'+ORD[wi]+'字/末字';
  let role;
  const s=strokeForm(k),known=store.strokes.get(ch)||'';
  const strk=!!s&&(!known||known.indexOf(s)>=0);
  const formNote=(s&&k!==s)?'（'+(isDigitK(k)?'数字':isSymK(k)?'符号':'字母')+'形式 '+k+'）':'';
  if(item.role)role=item.role;
  else if(item.lit||strk&&ci>0)role=codePosLabel(ci)+'，笔画'+(STROKE_NAME[s]||'')+formNote;
  else if(firstKind()==='stroke')role=(ci===0?'第一码':'第'+ORD[ci]+'码')+'，笔画';
  else if(ci===0)role='第一码，'+(firstKind()==='root'?'字根首码':(isInit(k)?'声母':'首码'));
  else if(isStrokeK(k))role='第'+ORD[ci]+'码，字根<span class="zg-font">'+k+'</span>';
  else if(ci===1)role='第二码，字根<span class="zg-font">'+k+'</span>';
  else role='第'+ORD[ci]+'码，补充';
  return `<b class="ec-key">${k}</b><span class="ec-note">（${pos}「${ch}」${role}）</span>`;
}
/* 词组取码解释主体：按提示强度分级显示规则名/逐键/编码 */
function explainWord(word){
  const infos=[...word].map(charInfo),n=infos.length;
  const lv=store.practiceMode==='text_free'?4:hintLv();
  let groups=[];
  try{groups=groupsForWord(word);}catch(e){groups=[];}
  /* 只剩取码方法名 + 编码时（练习强度=中），编码块内部改为横向单行、块与块竖向排开 */
  const oneLine=lv===2;
  let h='<div class="explain-box'+(oneLine?' compact':'')+'">';
  if(lv<3){
    const famName=store.schemeName||'当前方案';
    const ruleTitle=n===1?'按照「'+famName+'」单字取码':'按照「'+famName+'」构词公式';
    h+='<div class="keymap-head"><span class="lbl">取码规则：</span><span class="ec-title">'+ruleTitle+'</span></div>';
    if(groups.length===0)h+='<div class="rule-kind">（词典中无可用编码）</div>';
    groups.forEach(g=>{
      h+='<div class="rule-group'+(oneLine?' compact':'')+'">';
      h+='<div class="rule-kind">'+(g.name||'').split('·').join('<span class="rk-sep">·</span>')+'</div>';
      if(lv<2){
        h+='<div class="keymap-grid">'+g.tokens.map(it=>'<div class="km-formula">'+formulaCellHtml(it,n)+'</div><div class="km-key">'+keyNoteHtml(it,infos,n)+'</div>').join('')+'</div>';
      }else{
        h+='<div class="keymap-single">'+g.tokens.map(it=>'<div class="km-formula">'+formulaCellHtml(it,n)+'</div>').join('')+'</div>';
      }
      if(lv<1){
        const isSimpleCode=n===1?(g.code.length<Math.max(...(store.dict.get(word)||['']).map(x=>x.length))):g.code.length<=3;
        h+='<div class="explain-row"><span class="lbl">'+(isSimpleCode?'字词简码：':'拼合全码：')+'</span><b class="ec-code">'+g.code+'</b></div>';
      }
      if(g.note)h+='<div class="rule-note">'+g.note+'</div>';
      h+='</div>';
    });
  }
  h+='</div>';
  return h;
}
function showTarget(word){
  store.targetWord=word;
  targetWordEl.textContent=word;
  const lv=store.practiceMode==='text_free'?4:hintLv();
  document.getElementById('hintCodeRow').style.display=lv<1?'':'none';
  let allCodes=[];
  try{allCodes=[...new Set(groupsForWord(word).map(g=>g.code))];}catch(e){}
  hintCodeEl.textContent=allCodes.length?allCodes.join('，'):'（词典中无编码）';
  document.getElementById('cfHintRow').style.display=lv<4?'':'none';
  if(store.cf.size>0)cfHintEl.innerHTML=buildCfHtml(word);
  else cfHintEl.textContent='（无拆字数据）';
  document.getElementById('explainLine').innerHTML=explainWord(word);
}
function nextWord(){
  if(store.practiceMode==='transform'){nextTransform();return;}
  if(isWordMode()){
    if(store.sortedWordList.length===0){showTarget('—');hintCodeEl.textContent='请先加载词典';cfHintEl.textContent='—';return;}
    store.practiceIndex++;
    if(store.practiceIndex>=store.sortedWordList.length){alert('已练完当前出题顺序下的全部字词，将从头开始。');store.practiceIndex=0;}
    showTarget(store.sortedWordList[store.practiceIndex]);
  }else{
    if(store.textPracticeContent.length===0){showTarget('—');hintCodeEl.textContent='请先加载文本练习 txt';cfHintEl.textContent='—';return;}
    store.textPracticeIndex++;
    if(store.textPracticeIndex>=store.textPracticeContent.length){alert('文本练习已全部完成！');store.textPracticeIndex=0;}
    showTarget(store.textPracticeContent[store.textPracticeIndex]);
  }
  resetInput();
}
