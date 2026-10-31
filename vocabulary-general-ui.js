(function(){
  var access=window.VW_APP_ACCESS, levels=['A1','A2','B1','B2','C1','C2'];
  var levelFilter='All', posFilter='All', practiceLevel=localStorage.getItem('verbwerk_general_level')||'A1', visibleLimit=60;
  var session={items:[],index:0,score:0,answered:false,choice:'',mode:'quickRevision'};
  var rows=window.VW_GENERAL_DATA&&Array.isArray(window.VW_GENERAL_DATA.entries)?window.VW_GENERAL_DATA.entries:[];
  function active(){return rows.filter(function(x){return x.status==='approved'&&x.is_active!==false;});}
  function escText(x){return window.esc(String(x==null?'':x));}
  function primary(x){var a=Array.isArray(x.english_terms)?x.english_terms:[];var t=a.find(function(y){return y.primary&&y.term;})||a.find(function(y){return y.term;});return t?t.term:'';}
  function meaning(x){return x.meaning||primary(x)||'Meaning not available';}
  function group(x){var p=(x.part_of_speech||'').toLowerCase();if(x.entry_kind==='expression'||p==='expression')return 'expression';return ['noun','verb','adjective','adverb'].indexOf(p)>=0?p:'other';}
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
  function levelButtons(id,selected,handler,all){
    var vals=all?['All'].concat(levels):levels;
    document.getElementById(id).innerHTML=vals.map(function(v){return '<button class="pill '+(selected===v?'active':'')+'" onclick="'+handler+'(\''+v+'\')">'+v+'</button>';}).join('');
  }
  window.setGeneralLevel=function(v){levelFilter=v;visibleLimit=60;window.renderGeneralLibrary();};
  window.setGeneralPos=function(v){posFilter=v;visibleLimit=60;window.renderGeneralLibrary();};
  window.showMoreGeneral=function(){visibleLimit+=60;window.renderGeneralLibrary();};
  window.renderGeneralLibrary=function(){
    var input=document.getElementById('generalLibrarySearch'),q=norm(input?input.value:'');
    var all=active(),found=all.filter(function(x){
      var a=levelFilter==='All'||x.level===levelFilter, b=posFilter==='All'||group(x)===posFilter;
      var s=[x.display_form,x.lemma,x.meaning,x.german_definition,x.level,x.part_of_speech,x.source_pack,primary(x)].concat((x.english_terms||[]).map(function(t){return t.term;})).join(' ');
      return a&&b&&norm(s).indexOf(q)>=0;
    });
    levelButtons('generalLevelFilters',levelFilter,'setGeneralLevel',true);
    var kinds=['All','noun','verb','adjective','adverb','expression','other'];
    document.getElementById('generalPosFilters').innerHTML=kinds.map(function(v){
      var label={All:'All',noun:'Nouns',verb:'Verbs',adjective:'Adjectives',adverb:'Adverbs',expression:'Expressions',other:'Other'}[v];
      return '<button class="pill '+(posFilter===v?'active':'')+'" onclick="setGeneralPos(\''+v+'\')">'+label+'</button>';
    }).join('');
    var shown=found.slice(0,visibleLimit);
    document.getElementById('generalLibraryCount').textContent='Showing '+shown.length+' of '+found.length+' matches · '+all.length+' active entries across A1-C2';
    document.getElementById('generalLibraryList').innerHTML=shown.map(function(x){
      var word=x.display_form||x.lemma, details=x.part_of_speech||'word', p=plural(x);
      if(x.part_of_speech==='noun'&&p)details+=' · plural: '+p;
      var ex=Array.isArray(x.german_examples)&&x.german_examples.length?x.german_examples[0].sentence:'';
      return '<div class="card"><div class="verb-row"><div><div class="verb">'+escText(word)+'</div><div class="meaning">'+escText(meaning(x))+'</div></div><span class="tag">'+escText(x.level)+'</span></div><div class="meta">'+escText(details)+'</div>'+(ex?'<div class="small">'+escText(ex)+'</div>':'')+'<div class="actions" style="margin-top:10px"><button class="btn ghost" onclick="speak(decodeURIComponent(\''+encodeURIComponent(word)+'\'))">Listen</button></div></div>';
    }).join('')||'<div class="empty">No matching entries found.</div>';
    document.getElementById('generalShowMore').classList.toggle('hidden',shown.length>=found.length);
  };
  window.setGeneralPracticeLevel=function(v){
    practiceLevel=v;localStorage.setItem('verbwerk_general_level',v);
    levelButtons('generalPracticeLevels',practiceLevel,'setGeneralPracticeLevel',false);
    var list=active().filter(function(x){return x.level===practiceLevel;});
    var s=ensure(),count=s.generalKnown.filter(function(id){return list.some(function(x){return x.id===id;});}).length;
    document.getElementById('generalPracticeInfo').textContent=list.length+' words and expressions at this level · '+count+' learned on this device';
  };
  var base=access.baseArticles.slice(), seen=new Set(base.map(function(x){return norm(x.n);}));
  window.VW_ARTICLE_BANK=base.concat(active().filter(function(x){return x.part_of_speech==='noun'&&['der','die','das'].indexOf(x.article)>=0;}).filter(function(x){var k=norm(x.lemma);if(!k||seen.has(k))return false;seen.add(k);return true;}).map(function(x){return {n:x.lemma,a:x.article,p:plural(x),en:meaning(x),level:x.level,source:'general',id:x.id};}));
  window.setLibraryKind=function(k){
    var ids={general:'generalLibraryPanel',pilot:'pilotPanel',verbs:'verbLibraryPanel',articles:'articleLibraryPanel',detail:'verbDetailPanel'};
    Object.keys(ids).forEach(function(x){var e=document.getElementById(ids[x]);if(e)e.classList.toggle('hidden',x!==k);});
    document.querySelectorAll('#libraryKinds .pill').forEach(function(e){e.classList.toggle('active',e.dataset.libraryKind===k);});
    if(k==='general')window.renderGeneralLibrary();if(k==='pilot')window.renderPilot();if(k==='verbs')window.renderLibrary();if(k==='articles')window.renderArticleLibrary();
  };
  window.openLibrary=function(k,btn){window.showPage('library',btn);window.setLibraryKind(k||'general');};
  window.renderArticleLibrary=function(){
    var q=norm((document.getElementById('articleLibrarySearch')||{}).value||''),list=window.VW_ARTICLE_BANK.filter(function(x){return norm([x.a,x.n,x.en,x.p,x.level].join(' ')).indexOf(q)>=0;});
    document.getElementById('articleLibraryCount').textContent=list.length+' nouns';
    document.getElementById('articleLibrary').innerHTML=list.map(function(x){
      var pl=x.p?'Plural: '+x.p:'Plural: not listed in this source',src=x.source==='general'?' · General '+x.level:'';
      return '<div class="card"><div class="verb-row"><div><div class="verb">'+escText(x.a+' '+x.n)+'</div><div class="meaning">'+escText(x.en)+'</div></div><span class="tag">'+escText(x.level)+'</span></div><div class="meta">'+escText(pl+src)+'</div><button class="btn ghost" style="margin-top:10px" onclick="speak(decodeURIComponent(\''+encodeURIComponent(x.a+' '+x.n)+'\'))">Listen</button></div>';
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
    var x=items[i],deep=String(mode).indexOf('deep')===0,pl=x.p?'Plural: '+x.p:'Plural: not listed in this source';
    root.innerHTML='<div class="card"><div class="eyebrow">ARTICLE '+(mode==='lesson'?'LESSON':String(mode).toUpperCase())+'</div><div class="sub">'+(i+1)+' / '+items.length+'</div><h2>Which article belongs to <b>'+escText(x.n)+'</b>?</h2><div class="meaning">'+escText(x.en)+'</div>'+['der','die','das'].map(function(a){return '<button class="quizopt" onclick="answerArticle(\''+a+'\')">'+a+'</button>';}).join('')+(access.articleDone?'<div class="feedback">'+(access.articleChoice===x.a?'Correct!':'Correct answer: '+escText(x.a))+'<br>'+escText(x.a+' '+x.n)+' · '+escText(pl)+'</div><button class="btn full" onclick="nextArticle()">Continue</button>':'')+'<div class="small">'+(deep?'After choosing, say the noun in a sentence and consider its case.':'Quick article recall.')+'</div></div>';
    document.getElementById('reviewProgress').textContent=(i+1)+' / '+items.length;
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
    var p=document.getElementById('generalPracticeLevelPanel');if(p)p.classList.toggle('hidden',t!=='general');if(t==='general')window.setGeneralPracticeLevel(practiceLevel);
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
    var candidates=pool.filter(function(x){return x.id!==target.id&&group(x)===group(target);});if(candidates.length<3)candidates=pool.filter(function(x){return x.id!==target.id;});
    shuffle(candidates).forEach(function(x){var w=x.display_form||x.lemma,k=norm(w);if(out.length<4&&!used.has(k)){used.add(k);out.push({id:x.id,word:w});}});
    return shuffle(out);
  }
  window.startGeneralPractice=function(k){
    var s=ensure(),pool=active().filter(function(x){return x.level===practiceLevel;}),known=new Set(s.generalKnown);
    pool.sort(function(a,b){var w=(s.generalWeak[b.id]||0)-(s.generalWeak[a.id]||0);if(w)return w;return (known.has(a.id)?1:0)-(known.has(b.id)?1:0);});
    var n=k==='quickTest'?8:k==='deepTest'?10:6;
    session={items:pool.slice(0,n).map(function(x){return {target:x,options:options(x,pool)};}),index:0,score:0,answered:false,choice:'',mode:k};
    window.vwNav('review',null,true);window.renderGeneralQuestion();
  };
  window.renderGeneralQuestion=function(){
    var root=document.getElementById('reviewContent');
    if(session.index>=session.items.length){
      root.innerHTML='<div class="card empty"><h2>General vocabulary practice complete</h2><p>Score: '+session.score+'/'+session.items.length+'</p><p class="small">Progress is saved separately from your Verbwerk course verbs.</p><button class="btn full" onclick="startGeneralPractice(\''+session.mode+'\')">Try another round</button></div>';
      document.getElementById('reviewProgress').textContent='Complete';return;
    }
    var q=session.items[session.index],x=q.target,deep=String(session.mode).indexOf('deep')===0;
    var choices=q.options.map(function(o){return '<button class="quizopt" onclick="answerGeneral(\''+encodeURIComponent(o.id)+'\')">'+escText(o.word)+'</button>';}).join('');
    var extra='';
    if(session.answered){var ex=Array.isArray(x.german_examples)&&x.german_examples.length?x.german_examples[0].sentence:'';extra='<div class="feedback">'+(session.choice===x.id?'Correct!':'Correct answer: '+escText(x.display_form||x.lemma))+'<br>'+escText(x.german_definition||meaning(x))+(deep&&ex?'<br><br>'+escText(ex):'')+'</div><button class="btn full" onclick="nextGeneralQuestion()">Continue</button>';}
    root.innerHTML='<div class="card"><div class="eyebrow">GENERAL GERMAN · '+escText(x.level)+' · '+(deep?'DEEP':'QUICK')+'</div><div class="sub">'+(session.index+1)+' / '+session.items.length+'</div><h3>Choose the German word or expression</h3><div class="meaning">'+escText(meaning(x))+'</div>'+choices+extra+'</div>';
    document.getElementById('reviewProgress').textContent=(session.index+1)+' / '+session.items.length;
  };
  window.answerGeneral=function(id){
    if(session.answered)return;var x=session.items[session.index].target,s=ensure();id=decodeURIComponent(id);session.choice=id;session.answered=true;s.generalAnswers++;
    if(id===x.id){session.score++;s.generalCorrect++;if(s.generalKnown.indexOf(x.id)<0)s.generalKnown.push(x.id);s.generalWeak[x.id]=Math.max(0,(s.generalWeak[x.id]||0)-1);}
    else s.generalWeak[x.id]=(s.generalWeak[x.id]||0)+1;
    window.save();window.renderGeneralQuestion();
  };
  window.nextGeneralQuestion=function(){session.index++;session.answered=false;session.choice='';window.renderGeneralQuestion();};
  var oldProgress=window.renderProgress;
  window.renderProgress=function(){oldProgress();var e=document.getElementById('generalProgressSummary');if(e){var s=ensure();e.textContent=s.generalKnown.length+' general A1-C2 entries learned · '+s.generalAnswers+' practice answers · '+s.generalCorrect+' correct. This is separate from your course verbs.';}};
  window.setLibraryKind('general');
})();
