(function(){
  var access=window.VW_APP_ACCESS, visibleLimit=60;
  var session={items:[],index:0,score:0,answered:false,choice:'',mode:'quickRevision'};
  var rows=window.VW_GENERAL_DATA&&Array.isArray(window.VW_GENERAL_DATA.entries)?window.VW_GENERAL_DATA.entries:[];
  var frequencyRows=window.VW_WORDLY_DE||[], frequencyLimit=60;
  var posAliases={pron:"pronoun",prep:"preposition",conj:"conjunction",intj:"interjection",num:"numeral"};
  var frequencyRanks=new Map(frequencyRows.map(function(row){
    return [rankKey(row.lemma,posAliases[row.pos]||row.pos),row.rank];
  }));
  var frequencyBands={500:[1,500],1000:[501,1000],2000:[1001,2000],3500:[2001,3500],upper:[3501,5000],all:[1,5000]};
  function rankKey(lemma,pos){return lemma.normalize("NFC")+"|"+pos;}
  function rank(entry){return frequencyRanks.get(rankKey(entry.lemma||entry.display_form||"",entry.part_of_speech))||5001;}
  function active(){return rows.filter(function(x){return x.status==='approved'&&x.is_active!==false;});}
  function escText(x){return window.esc(String(x==null?'':x));}
  function primary(x){var a=Array.isArray(x.english_terms)?x.english_terms:[];var t=a.find(function(y){return y.primary&&y.term;})||a.find(function(y){return y.term;});return t?t.term:'';}
  function meaning(x){return x.meaning||primary(x)||'Meaning not available';}
  function plural(x){var a=Array.isArray(x.plural_forms)?x.plural_forms:[];return String(a[0]||'').replace(/^(die|der|das)\s+/i,'').trim();}
  function norm(x){return String(x||'').toLocaleLowerCase().trim();}
  function shuffle(a){return a.slice().sort(function(){return Math.random()-.5;});}
  function ensure(){
    var s=access.state;
    if(!Array.isArray(s.generalKnown))s.generalKnown=[];
    if(!s.generalWeak||typeof s.generalWeak!=='object')s.generalWeak={};
    if(typeof s.generalAnswers!=='number')s.generalAnswers=0;
    if(typeof s.generalCorrect!=='number')s.generalCorrect=0;
    return s;
  }
  window.renderFrequencyList=function(reset){
    if(reset)frequencyLimit=60;
    var query=norm(document.getElementById("frequencySearch").value);
    var bounds=frequencyBands[document.getElementById("frequencyBand").value];
    var matches=frequencyRows.filter(function(row){
      return row.rank>=bounds[0]&&row.rank<=bounds[1]&&norm(row.lemma+" "+row.gloss).includes(query);
    });
    var shown=matches.slice(0,frequencyLimit);
    document.getElementById("frequencyCount").textContent=matches.length?("Showing "+shown.length+" of "+matches.length+" entries"):"No matching entries";
    document.getElementById("frequencyList").innerHTML=shown.map(function(row){
      return '<li><span class="rank" aria-label="Frequency rank '+row.rank+'">'+row.rank+'</span><div><strong lang="de">'+escText(row.lemma)+'</strong><div class="meaning">'+escText(row.gloss)+'</div></div></li>';
    }).join("");
    document.getElementById("frequencyMore").classList.toggle("hidden",shown.length>=matches.length);
  };
  window.showMoreFrequency=function(){frequencyLimit+=60;window.renderFrequencyList();};
  window.showMoreGeneral=function(){visibleLimit+=60;window.renderGeneralLibrary();};
  window.renderGeneralLibrary=function(){
    var input=document.getElementById('generalLibrarySearch'),q=norm(input?input.value:'');
    var all=active(),summary=document.getElementById('generalLibrarySummary');if(summary)summary.textContent=all.length+' active words and expressions · Available offline.';var found=all.filter(function(x){
      var searchable=[x.display_form,x.lemma,x.meaning,x.german_definition,x.usage_note,primary(x)].concat((x.english_terms||[]).map(function(t){return t.term;})).join(' ');
      return norm(searchable).indexOf(q)>=0;
    });
    var shown=found.slice(0,visibleLimit);
    document.getElementById('generalLibraryCount').textContent='Showing '+shown.length+' of '+found.length+' matches · '+all.length+' active words and expressions';
    document.getElementById('generalLibraryList').innerHTML=shown.map(function(x){
      var word=x.display_form||x.lemma,p=plural(x),ex=Array.isArray(x.german_examples)&&x.german_examples.length?x.german_examples[0].sentence:'';
      return '<div class="card word-card" data-detail-kind="general" data-detail-id="'+encodeURIComponent(x.id)+'"><div class="verb-row"><div><button class="word-link" type="button" lang="de" onclick="openVocabularyDetail(\'general\',decodeURIComponent(\''+encodeURIComponent(x.id)+'\'))">'+escText(word)+' <span aria-hidden="true">&#8594;</span></button><div class="meaning">'+escText(meaning(x))+'</div></div></div>'+(p?'<div class="meta">Plural: '+escText(p)+'</div>':'')+(ex?'<div class="small">'+escText(ex)+'</div>':'')+'<div class="actions" style="margin-top:10px"><button class="btn secondary" onclick="speak(decodeURIComponent(\''+encodeURIComponent(word)+'\'))">🔊 Listen</button></div></div>';
    }).join('')||'<div class="empty">No matching entries found.</div>';
    document.getElementById('generalShowMore').classList.toggle('hidden',shown.length>=found.length);
  };
  window.updateGeneralPracticeInfo=function(){
    var list=active(),s=ensure(),count=s.generalKnown.filter(function(id){return list.some(function(x){return x.id===id;});}).length;
    var info=document.getElementById('generalPracticeInfo');
    if(info)info.textContent=count+' of '+list.length+' words and expressions learned';
    var progress=document.getElementById('generalPracticeProgress');
    if(progress){progress.max=list.length||1;progress.value=count;}
  };  var base=access.baseArticles.slice(), seen=new Set(base.map(function(x){return norm(x.n);}));
  window.VW_ARTICLE_BANK=base.concat(active().filter(function(x){return x.part_of_speech==='noun'&&['der','die','das'].indexOf(x.article)>=0;}).filter(function(x){var k=norm(x.lemma);if(!k||seen.has(k))return false;seen.add(k);return true;}).map(function(x){return {n:x.lemma,a:x.article,p:plural(x),en:meaning(x),source:'general',id:x.id};}));

  function detailRecord(kind,id){
    if(kind==='general')return active().find(function(x){return x.id===id;})||null;
    if(kind==='pilot'){
      var p=(window.VW_PILOT_DATA||[]).find(function(x){return x.id===id;});
      if(!p)return null;
      var matched=active().find(function(x){return norm(x.lemma)===norm(p.lemma);});
      return matched?Object.assign({},matched,p):p;
    }
    if(kind==='article'){
      var a=(window.VW_ARTICLE_BANK||[]).find(function(x){return norm(x.lemma||x.n)===norm(id);});
      if(!a)return null;
      var matched=active().find(function(x){return norm(x.lemma)===norm(a.lemma||a.n);});
      return matched?Object.assign({},matched,a):a;
    }
    return null;
  }
  function courseVerbFor(kind,id,x){
    var p=kind==='pilot'?(window.VW_PILOT_DATA||[]).find(function(y){return y.id===id;}):null;
    var candidate=(p&&p.verbId)||x.lemma||x.n||x.word||'';
    if(p&&p.kind!=='Verb'&&!x.part_of_speech)return null;
    if(x.part_of_speech&&x.part_of_speech!=='verb'&&!(p&&p.verbId))return null;
    var courseVerbs=typeof VERBS==='undefined'?[]:VERBS;return courseVerbs.find(function(v){return norm(v.id)===norm(candidate);})||null;
  }
  window.openVocabularyDetail=function(kind,id){
    var x=detailRecord(kind,id);if(!x)return;
    var verb=courseVerbFor(kind,id,x);
    if(verb&&window.showVerb){window.showVerb(verb.id);return;}
    window.vwNav('library',null,true,{view:'vocabularyDetail',entryKind:kind,entryId:String(id)});
    window.renderVocabularyDetail(kind,id);
    window.scrollTo(0,0);
  };
  window.renderVocabularyDetail=function(kind,id){
    var x=detailRecord(kind,id);if(!x)return;
    var word=kind==='article'&&x.n?((x.a||x.article||'')+' '+x.n).trim():(x.display_form||x.word||x.lemma||x.n||'');
    var meaningText=x.meaning||x.en||primary(x)||'Meaning not available';

    
    var english=(Array.isArray(x.english_terms)?x.english_terms.map(function(t){return t.term;}):[]);
    if(!english.length&&x.wikidata&&Array.isArray(x.wikidata.englishGlosses))english=x.wikidata.englishGlosses.slice();
    if(!english.length&&x.en)english=[x.en];
    english=Array.from(new Set(english.filter(Boolean)));
    var article=x.article||x.a||'';
    var pl=plural(x)||String(x.p||'').replace(/^(die|der|das)\s+/i,'').trim();
    var parts=['<div class="card detail"><div class="verb-row"><div><div class="eyebrow" style="color:var(--green)">WORD DETAILS</div><h2 lang="de">'+escText(word)+'</h2><div class="meaning">'+escText(meaningText)+'</div></div></div>'];
    if(article||pl)parts.push('<div class="casebox"><b>Noun forms</b><br>'+(article?'Article: '+escText(article):'')+(article&&pl?' · ':'')+(pl?'Plural: '+escText(pl):'')+'</div>');
    if(x.german_definition)parts.push('<h3>Meaning in German</h3><div class="example" lang="de">'+escText(x.german_definition)+'</div>');
    if(x.usage_note)parts.push('<h3>Usage tip</h3><div class="casebox">'+escText(x.usage_note)+'</div>');
    if(english.length)parts.push('<h3>English meanings</h3><div class="casebox">'+english.map(escText).join(' · ')+'</div>');
    var forms=Array.isArray(x.forms)?x.forms.filter(function(f){return f&&f.surface;}):[];
    var seen=Object.create(null),uniqueForms=forms.filter(function(f){var key=[f.surface,f.number,f.case].join('|');if(seen[key])return false;seen[key]=true;return true;}).slice(0,10);
    if(uniqueForms.length>1){
      var cases={nom:'Nominative',acc:'Accusative',dat:'Dative',gen:'Genitive'};
      parts.push('<h3>Word forms</h3><table class="table"><thead><tr><th>Form</th><th>Number</th><th>Case</th></tr></thead><tbody>'+uniqueForms.map(function(f){return '<tr><td lang="de">'+escText(f.surface)+'</td><td>'+escText(f.number==='sg'?'Singular':f.number==='pl'?'Plural':'—')+'</td><td>'+escText(cases[f.case]||f.case||'Base form')+'</td></tr>';}).join('')+'</tbody></table>');
    }
    var tags=uniqueForms.length&&uniqueForms[0].tags?uniqueForms[0].tags:{},notes=[];
    if(tags.aux)notes.push('Auxiliary: '+tags.aux);
    if(tags.prefix)notes.push('Prefix: '+tags.prefix);
    if(notes.length)parts.push('<h3>Verb notes</h3><div class="casebox">'+notes.map(escText).join(' · ')+'</div>');
    var examples=Array.isArray(x.german_examples)?x.german_examples:(Array.isArray(x.examples)?x.examples:[]);
    if(examples.length)parts.push('<h3>Examples in context</h3>'+window.renderExampleSet(examples.slice(0,3),x));
    if(Array.isArray(x.domains)&&x.domains.length)parts.push('<div class="meta">Topics: '+x.domains.map(escText).join(' · ')+'</div>');
    parts.push('</div>');
    window.clearLibraryDetail();
    window.currentVocabDetail={kind:String(kind),id:String(id)};
    window.detailPronunciation=word;
    window.setLibraryKind('detail');
    document.getElementById('verbDetailContent').innerHTML=parts.join('');
    var listen=document.getElementById('detailListenButton');if(listen)listen.setAttribute('aria-label','Listen to German pronunciation of '+word);var slow=document.getElementById('detailListenSlowButton');if(slow)slow.setAttribute('aria-label','Listen slowly to '+word);
  };
  document.addEventListener('click',function(event){
    var card=event.target.closest('.word-card[data-detail-kind]');
    if(!card||event.target.closest('button,a,input,select,textarea,label,[role="button"]'))return;
    var kind=card.dataset.detailKind,id=decodeURIComponent(card.dataset.detailId||'');
    if(kind==='verb'){window.showVerb(id);return;}
    window.openVocabularyDetail(kind,id);
  });
  function enhanceWordCards(){
    document.querySelectorAll('#todayList .card[onclick*="showVerb("]').forEach(function(card){
      var title=card.querySelector('.verb');if(!title)return;
      card.classList.add('word-card');card.dataset.detailKind='verb';card.dataset.detailId=encodeURIComponent(title.textContent.trim());title.setAttribute('lang','de');card.removeAttribute('onclick');
    });
    document.querySelectorAll('.word-card[data-detail-kind]').forEach(function(card){
      var title=card.querySelector('.word-link,.verb'),word=title?title.textContent.replace(/→/g,'').trim():decodeURIComponent(card.dataset.detailId||'');
      if(title&&title.tagName==='BUTTON'){var plain=document.createElement('span');plain.className=title.className;plain.setAttribute('lang','de');plain.innerHTML=title.innerHTML;title.replaceWith(plain);}
      var kind=card.dataset.detailKind,id=decodeURIComponent(card.dataset.detailId||'');
      if(!card.querySelector(':scope > .word-card-open')){
        var open=document.createElement('button');open.type='button';open.className='word-card-open';open.setAttribute('aria-label','Open details for '+word);
        open.addEventListener('click',function(){if(kind==='verb')window.showVerb(id);else window.openVocabularyDetail(kind,id);});card.prepend(open);
      }
      var speakButton=card.querySelector('button[onclick*="speak("]');
      if(speakButton&&!speakButton.hasAttribute('aria-label'))speakButton.setAttribute('aria-label','Listen to German pronunciation of '+word);
      if(speakButton&&!card.querySelector('[data-slow-speech]')){
        var slow=document.createElement('button');slow.type='button';slow.className='btn ghost slow-speech';slow.dataset.slowSpeech='true';slow.textContent='0.7× Slow';slow.title='Listen slowly';slow.setAttribute('aria-label','Listen slowly to '+word);slow.addEventListener('click',function(event){event.stopPropagation();window.speak(word,true);});speakButton.parentElement.appendChild(slow);
      }
      if(kind==='general'){var example=card.querySelector('.small');if(example)example.setAttribute('lang','de');}
    });
  }
  function observeWordCards(id){var root=document.getElementById(id);if(root){new MutationObserver(enhanceWordCards).observe(root,{childList:true,subtree:true});}}
  enhanceWordCards();observeWordCards('home');observeWordCards('library');
  window.setLibraryKind=function(k,button){
    var ids={general:'generalLibraryPanel',frequency:'frequencyPanel',pilot:'pilotPanel',verbs:'verbLibraryPanel',articles:'articleLibraryPanel',detail:'verbDetailPanel'};
    Object.keys(ids).forEach(function(x){var e=document.getElementById(ids[x]);if(e)e.classList.toggle('hidden',x!==k);});
    var nav=document.getElementById('libraryKinds');if(nav)nav.classList.toggle('hidden',k==='detail');
    if(k!=='detail'&&window.clearLibraryDetail)window.clearLibraryDetail();
    document.querySelectorAll('#libraryKinds .pill').forEach(function(e){var selected=e.dataset.libraryKind===k;e.classList.toggle('active',selected);e.setAttribute('aria-pressed',String(selected));});
    if(button&&history.state&&history.state.pageId==='library'){
      var route=Object.assign({},history.state,{libraryKind:k});
      history.replaceState(route,'',window.vwRouteUrl(route));
    }
    if(k==='frequency')window.renderFrequencyList();
    if(k==='general')window.renderGeneralLibrary();if(k==='pilot')window.renderPilot();if(k==='verbs')window.renderLibrary();if(k==='articles')window.renderArticleLibrary();
  };
  window.openLibrary=function(k,btn){window.vwNav('library',btn,true,{libraryKind:k||'general'});};
  window.renderArticleLibrary=function(){
    var q=norm((document.getElementById('articleLibrarySearch')||{}).value||''),list=window.VW_ARTICLE_BANK.filter(function(x){return norm([x.a,x.n,x.en,x.p].join(' ')).indexOf(q)>=0;});
    document.getElementById('articleLibraryCount').textContent=list.length+' nouns';
    document.getElementById('articleLibrary').innerHTML=list.map(function(x){
      var pl=x.p?'Plural: '+x.p:'Plural: not listed in this source';
      return '<div class="card word-card" data-detail-kind="article" data-detail-id="'+encodeURIComponent(x.n)+'"><div class="verb-row"><div><button class="word-link" type="button" lang="de" onclick="openVocabularyDetail(\'article\',decodeURIComponent(\''+encodeURIComponent(x.n)+'\'))">'+escText(x.a+' '+x.n)+' <span aria-hidden="true">&#8594;</span></button><div class="meaning">'+escText(x.en)+'</div></div></div><div class="meta">'+escText(pl)+'</div><button class="btn secondary" style="margin-top:10px" onclick="speak(decodeURIComponent(\''+encodeURIComponent(x.a+' '+x.n)+'\'))">🔊 Listen</button></div>';
    }).join('')||'<div class="empty">No matching nouns found.</div>';
  };
  window.renderArticleHome=function(){
    var s=access.state,done=Array.isArray(s.articleCompleted)?s.articleCompleted.length:0,day=Math.max(1,done+1);
    var fresh=window.VW_ARTICLE_BANK.slice((day-1)*5,day*5);
    document.getElementById('articleDayTitle').textContent='Day '+day+' · Article training';
    document.getElementById('articleDayInfo').textContent=fresh.length?fresh.length+' new nouns · previous nouns return in revision':'All available nouns have been introduced. Use article practice for review.';
    document.getElementById('articleDailyWords').textContent=fresh.map(function(x){return x.a+' '+x.n+' · '+x.en;}).join('  |  ');
    var b=document.querySelector('#articlePage button[onclick="startArticleLesson()"]');if(b)b.disabled=!fresh.length;
  };
  window.startArticleLesson=function(){
    var s=access.state,day=Math.max(1,(s.articleCompleted||[]).length+1),fresh=window.VW_ARTICLE_BANK.slice((day-1)*5,day*5),prior=window.VW_ARTICLE_BANK.slice(0,(day-1)*5).slice(-5);
    if(!fresh.length){alert('All currently bundled article lessons are complete.');return;}
    access.articleItems=fresh.concat(prior);access.articleMode='lesson';access.articleIndex=0;access.articleScore=0;access.articleDone=false;access.articleChoice='';
    window.vwNav('review',null,true);window.renderArticleQuestion();
  };
  window.startArticlePractice=function(k){
    var s=access.state;access.articleMode=k;
    var learned=window.VW_ARTICLE_BANK.slice(0,Math.min(window.VW_ARTICLE_BANK.length,Math.max(5,(s.articleCompleted||[]).length*5)));
    access.articleItems=learned.slice().sort(function(a,b){return ((s.articleWeak||{})[b.n]||0)-((s.articleWeak||{})[a.n]||0);}).slice(0,k==='quickTest'?10:k==='deepTest'?12:8);
    access.articleIndex=0;access.articleScore=0;access.articleDone=false;access.articleChoice='';
    window.vwNav('review',null,true);window.renderArticleQuestion();
  };
  window.renderArticleQuestion=function(){
    var root=document.getElementById('reviewContent'),items=access.articleItems,i=access.articleIndex,mode=access.articleMode;
    if(i>=items.length){
      if(mode==='lesson'){var s=access.state;s.articleCompleted=s.articleCompleted||[];var d=s.articleCompleted.length+1;if(s.articleCompleted.indexOf(d)<0)s.articleCompleted.push(d);window.save();}
      root.innerHTML='<div class="card empty"><h2>Article practice complete</h2><p>Score: '+access.articleScore+'/'+items.length+'</p><button class="btn full" onclick="vwNav(\'articlePage\',null,true);renderArticleHome()">Back to Article Training</button></div>';
      document.getElementById('reviewProgress').textContent='Complete';return;
    }
    var x=items[i],deep=String(mode).indexOf('deep')===0,pl=x.p?'Plural: '+x.p:'Plural: not listed in this source',keepFocus=window.shouldMoveReviewFocus();
    root.innerHTML='<div class="card"><div class="eyebrow">ARTICLE '+(mode==='lesson'?'LESSON':String(mode).toUpperCase())+'</div><div class="sub">'+(i+1)+' / '+items.length+'</div><h2>Which article belongs to <b lang="de">'+escText(x.n)+'</b>?</h2><div class="meaning">'+escText(x.en)+'</div>'+['der','die','das'].map(function(a){return '<button class="quizopt" lang="de" onclick="answerArticle(\''+a+'\')">'+a+'</button>';}).join('')+(access.articleDone?'<div class="feedback" role="status" aria-live="polite" aria-atomic="true">'+(access.articleChoice===x.a?'Correct!':'Correct answer: '+escText(x.a))+'<br>'+escText(x.a+' '+x.n)+' · '+escText(pl)+'</div><button class="btn full" onclick="nextArticle()">Continue</button>':'')+'<div class="small">'+(deep?'After choosing, say the noun in a sentence and consider its case.':'Quick article recall.')+'</div></div>';
    document.getElementById('reviewProgress').textContent=(i+1)+' / '+items.length;if(access.articleDone&&keepFocus)window.focusReviewContinue();
  };
  window.answerArticle=function(a){
    if(access.articleDone)return;access.articleChoice=a;access.articleDone=true;
    var x=access.articleItems[access.articleIndex],s=access.state;
    if(a===x.a){access.articleScore++;s.articleCorrect=(s.articleCorrect||0)+1;s.articleWeak=s.articleWeak||{};s.articleWeak[x.n]=Math.max(0,(s.articleWeak[x.n]||0)-1);}
    else{s.articleWeak=s.articleWeak||{};s.articleWeak[x.n]=(s.articleWeak[x.n]||0)+1;}
    s.articleAnswers=(s.articleAnswers||0)+1;window.save();window.renderArticleQuestion();
  };
  window.nextArticle=function(){access.articleIndex++;access.articleDone=false;access.articleChoice='';window.renderArticleQuestion();};
  window.setPracticeTrack=function(t){
    access.track=t;['vocab','articles','both','general'].forEach(function(x){var b=document.getElementById('track'+x.charAt(0).toUpperCase()+x.slice(1));if(b)b.classList.toggle('active',x===t);});
    var p=document.getElementById('generalPracticeInfoPanel');if(p)p.classList.toggle('hidden',t!=='general');if(t==='general')window.updateGeneralPracticeInfo();
  };
  window.setPracticeDifficulty=function(d){
    access.difficulty=d;['quick','deep'].forEach(function(x){var b=document.getElementById('difficulty'+x.charAt(0).toUpperCase()+x.slice(1));if(b)b.classList.toggle('active',x===d);});
  };
  window.launchSelectedPractice=function(){
    var k=access.difficulty+(String(access.articleMode).toLowerCase().indexOf('test')>=0?'Test':'Revision');
    if(access.track==='general'){window.startGeneralPractice(k);return;}if(access.track==='articles'){window.startArticlePractice(k);return;}if(access.track==='both'){window.startMixedPractice(k);return;}window.startVerbPractice(k);
  };
  function options(target,pool){
    var out=[{id:target.id,word:target.display_form||target.lemma}],used=new Set([norm(out[0].word)]);
    var candidates=pool.filter(function(x){return x.id!==target.id;});
    shuffle(candidates).forEach(function(x){var w=x.display_form||x.lemma,k=norm(w);if(out.length<4&&!used.has(k)){used.add(k);out.push({id:x.id,word:w});}});
    return shuffle(out);
  }
  function meaningOptions(target,pool){
    var label=meaning(target),out=[{id:target.id,word:label}],used=new Set([norm(label)]);
    shuffle(pool.filter(function(x){return x.id!==target.id;})).forEach(function(x){var m=meaning(x),key=norm(m);if(out.length<4&&m!=='Meaning not available'&&!used.has(key)){used.add(key);out.push({id:x.id,word:m});}});
    return shuffle(out);
  }
  window.startGeneralPractice=function(k){
    var s=ensure(),pool=active(),known=new Set(s.generalKnown);
    pool.sort(function(a,b){var w=(s.generalWeak[b.id]||0)-(s.generalWeak[a.id]||0);if(w)return w;return Number(known.has(a.id))-Number(known.has(b.id))||rank(a)-rank(b);});
    var listening=k==='listenQuick',n=listening?6:k==='quickTest'?8:k==='deepTest'?10:6;
    session={items:pool.slice(0,n).map(function(x){return {target:x,options:listening?meaningOptions(x,pool):options(x,pool)};}),index:0,score:0,answered:false,choice:'',mode:k};
    window.vwNav('review',null,true);window.renderGeneralQuestion();
  };
  window.renderGeneralQuestion=function(){
    var root=document.getElementById('reviewContent');
    if(session.index>=session.items.length){
      root.innerHTML='<div class="card empty"><h2>General vocabulary practice complete</h2><p>Score: '+session.score+'/'+session.items.length+'</p><p class="small">Progress is saved separately from your Verbwerk course verbs.</p><button class="btn full" onclick="startGeneralPractice(\''+session.mode+'\')">Try another round</button></div>';
      document.getElementById('reviewProgress').textContent='Complete';return;
    }
    var q=session.items[session.index],x=q.target,deep=String(session.mode).indexOf('deep')===0,listening=session.mode==='listenQuick',keepFocus=window.shouldMoveReviewFocus();
    var locale=listening?'en':'de';
    var choices=q.options.map(function(o){return '<button class="quizopt" lang="'+locale+'" onclick="answerGeneral(\''+encodeURIComponent(o.id)+'\')">'+escText(o.word)+'</button>';}).join('');
    var extra='';
    if(session.answered){var row=Array.isArray(x.german_examples)&&x.german_examples.length?x.german_examples[0]:null,ex=typeof row==='string'?row:row&&(row.sentence||row.de)||'',example=ex?'<br><br>'+window.renderExampleSet([row],x):'';extra='<div class="feedback" role="status" aria-live="polite" aria-atomic="true">'+(session.choice===x.id?'Correct!':'Correct answer: '+escText(x.display_form||x.lemma))+'<br>'+escText(x.german_definition||meaning(x))+example+'</div><button class="btn full" onclick="nextGeneralQuestion()">Continue</button>'; }
    var prompt= listening?'<p class="small">Listen to the German pronunciation, then choose its meaning.</p><div class="actions listen-actions"><button class="btn secondary" type="button" aria-label="Play the German pronunciation" onclick="speak(decodeURIComponent(\''+encodeURIComponent(x.display_form||x.lemma)+'\'))">&#128266; Play word</button><button class="btn ghost" type="button" aria-label="Play the German pronunciation slowly" onclick="speak(decodeURIComponent(\''+encodeURIComponent(x.display_form||x.lemma)+'\'),true)">0.7&#215; Slow</button></div>': '<div class="meaning">'+escText(meaning(x))+'</div>';
    root.innerHTML='<div class="card"><div class="eyebrow">GENERAL VOCABULARY · '+(listening?'LISTENING':deep?'DEEP':'QUICK')+'</div><div class="sub">'+(session.index+1)+' / '+session.items.length+'</div><h3>'+(listening?'Choose the meaning you hear':'Choose the German word or expression')+'</h3>'+prompt+choices+extra+'</div>';
    document.getElementById('reviewProgress').textContent=(session.index+1)+' / '+session.items.length;if(session.answered&&keepFocus)window.focusReviewContinue();
  };
  window.answerGeneral=function(id){
    if(session.answered)return;var x=session.items[session.index].target,s=ensure();id=decodeURIComponent(id);session.choice=id;session.answered=true;s.generalAnswers++;
    if(id===x.id){session.score++;s.generalCorrect++;if(s.generalKnown.indexOf(x.id)<0)s.generalKnown.push(x.id);s.generalWeak[x.id]=Math.max(0,(s.generalWeak[x.id]||0)-1);}
    else s.generalWeak[x.id]=(s.generalWeak[x.id]||0)+1;
    window.save();window.renderGeneralQuestion();
  };
  window.nextGeneralQuestion=function(){session.index++;session.answered=false;session.choice='';window.renderGeneralQuestion();};
  var oldProgress=window.renderProgress;
  window.renderProgress=function(){oldProgress();var e=document.getElementById('generalProgressSummary');if(e){var s=ensure();e.textContent=s.generalKnown.length+' general entries learned · '+s.generalAnswers+' practice answers · '+s.generalCorrect+' correct. This is separate from your course verbs.';}};
  window.setLibraryKind('general');
})();
