(function(){
  var access=window.VW_APP_ACCESS, visibleLimit=60;
  var session={items:[],index:0,score:0,answered:false,choice:'',selectedId:'',mode:'quickRevision'};
  var rows=window.VW_GENERAL_DATA&&Array.isArray(window.VW_GENERAL_DATA.entries)?window.VW_GENERAL_DATA.entries:[];
  var frequencyRows=window.VW_WORDLY_DE||[], frequencyLimit=60;
  var nounGenderData=window.VW_GERMAN_NOUN_GENDERS||{entries:{}};
  var nounGenderEntries=nounGenderData.entries||{};
  var posAliases={pron:"pronoun",prep:"preposition",conj:"conjunction",intj:"interjection",num:"numeral"};
  var frequencyRanks=new Map(frequencyRows.map(function(row){
    return [rankKey(row.lemma,posAliases[row.pos]||row.pos),row.rank];
  }));
  var frequencyBands={500:[1,500],1000:[501,1000],2000:[1001,2000],3500:[2001,3500],upper:[3501,5000],all:[1,5000]};
  var wordTypes=[
    ["all","Alle Wörter"],["noun","Nomen"],["verb","Verben"],["adj","Adjektive"],["adv","Adverbien"],
    ["connector","Konnektoren"],["preposition","Präpositionen"],["pronoun","Pronomen"],
    ["det","Artikel und Determinative"],["numeral","Numeralia"],["particle","Partikeln"],
    ["interjection","Interjektionen"],["chunk","Wendungen"],["other","Sonstige"]
  ];
  var connectorAdverbs=new Set(["also","außerdem","ansonsten","dagegen","daher","dann","darum","deshalb","deswegen","folglich","sonst","stattdessen","trotzdem","zudem"]);
  function hasWordType(lemma,pos,type){
    if(type==="all")return true;
    if(type==="connector")return pos==="conjunction"||(pos==="adv"&&connectorAdverbs.has(norm(lemma)));
    return pos===type;
  }
  function populateWordTypes(id,entries){
    var select=document.getElementById(id);
    wordTypes.forEach(function(pair){
      var type=pair[0],label=pair[1];
      if(type==="all"||entries.some(function(entry){return hasWordType(entry.lemma,posAliases[entry.pos]||entry.pos||entry.part_of_speech,type);}))
        select.add(new Option(label,type));
    });
  }
  function rankKey(lemma,pos){return lemma.normalize("NFC")+"|"+pos;}
  function rank(entry){return frequencyRanks.get(rankKey(entry.lemma||entry.display_form||"",entry.part_of_speech))||5001;}
  function active(){return rows.filter(function(x){return x.status==='approved'&&x.is_active!==false;});}
  function escText(x){return window.esc(String(x==null?'':x));}
  function primary(x){var a=Array.isArray(x.english_terms)?x.english_terms:[];var t=a.find(function(y){return y.primary&&y.term;})||a.find(function(y){return y.term;});return t?t.term:'';}
  function meaning(x){return x.meaning||primary(x)||'Meaning not available';}
  function plurals(x){
    return (Array.isArray(x.plural_forms)?x.plural_forms:[]).map(function(value){return String(value).replace(/^(die|der|das)\s+/i,"").trim();}).filter(Boolean);
  }
  function plural(x){return plurals(x)[0]||"";}
  function articlePluralLabel(x){
    if(x.p)return "Plural: "+x.p;
    return x.pluralUsage==="singular_in_sense"?"In dieser Bedeutung meist Singular":"Plural: not listed in this source";
  }
  function norm(x){return String(x||'').toLocaleLowerCase().normalize('NFC').trim();}
  function genderInfo(lemma){return nounGenderEntries[norm(lemma)]||null;}
  function genderArticles(info){return info&&Array.isArray(info.articles)?info.articles.filter(function(a){return ['der','die','das'].indexOf(a)>=0;}):[];}
  function displayNoun(lemma,articles){return articles&&articles.length?articles.join('/')+' '+lemma:lemma;}
  function shuffle(a){return a.slice().sort(function(){return Math.random()-.5;});}
  function ensure(){
    var s=access.state;
    if(!Array.isArray(s.generalKnown))s.generalKnown=[];
    if(!s.generalWeak||typeof s.generalWeak!=='object')s.generalWeak={};
    if(!Array.isArray(s.generalSaved))s.generalSaved=[];
    if(!s.generalWordProgress||typeof s.generalWordProgress!=='object')s.generalWordProgress={};
    if(typeof s.generalAnswers!=='number')s.generalAnswers=0;
    if(typeof s.generalCorrect!=='number')s.generalCorrect=0;
    return s;
  }
  window.renderFrequencyList=function(reset){
    if(reset)frequencyLimit=60;
    var query=norm(document.getElementById("frequencySearch").value);
    var bounds=frequencyBands[document.getElementById("frequencyBand").value];
    var type=document.getElementById("frequencyWordType").value;
    var matches=frequencyRows.filter(function(row){
      return row.rank>=bounds[0]&&row.rank<=bounds[1]&&hasWordType(row.lemma,posAliases[row.pos]||row.pos,type)&&norm(row.lemma+" "+row.gloss).includes(query);
    });
    var shown=matches.slice(0,frequencyLimit);
    document.getElementById("frequencyCount").textContent=matches.length?("Showing "+shown.length+" of "+matches.length+" entries"):"No matching entries";
    document.getElementById("frequencyList").innerHTML=shown.map(function(row){
      var rankLabel="Frequency rank "+row.rank, info=row.pos==='noun'?genderInfo(row.lemma):null, articles=genderArticles(info);
      var shownWord=row.pos==='noun'?displayNoun(row.lemma,articles):row.lemma;
      var articleNote=row.pos==='noun'&&info&&!articles.length?'<div class="meta">'+escText(info.note||'Article depends on usage')+'</div>':'';
      return '<article class="card word-card frequency-entry" role="listitem" data-detail-kind="frequency" data-detail-id="'+row.rank+'"><div class="frequency-row"><span class="frequency-rank" aria-label="'+rankLabel+'">#'+row.rank+'</span><div class="frequency-main"><span class="word-link" lang="de">'+escText(shownWord)+' <span aria-hidden="true">&#8594;</span></span><div class="meaning">'+escText(row.gloss)+'</div>'+articleNote+'</div></div>'+window.pronunciationButtons(shownWord)+'</article>';
    }).join("");
    document.getElementById("frequencyMore").classList.toggle("hidden",shown.length>=matches.length);
  };
  window.showMoreFrequency=function(){frequencyLimit+=60;window.renderFrequencyList();};
  window.showMoreGeneral=function(){visibleLimit+=60;window.renderGeneralLibrary();};
  function wordProgress(id){
    var s=ensure();if(!s.generalWordProgress||typeof s.generalWordProgress!=='object')s.generalWordProgress={};
    if(!s.generalWordProgress[id])s.generalWordProgress[id]={attempts:0,correct:0,streak:0,repetitions:0,lastReviewedAt:0,dueAt:0,status:'new'};
    return s.generalWordProgress[id];
  }
  function isDue(id){var s=ensure(),p=s.generalWordProgress&&s.generalWordProgress[id];return p?Number(p.dueAt||0)<=Date.now():((s.generalWeak[id]||0)>0||s.generalKnown.indexOf(id)>=0);}
  window.toggleGeneralSaved=function(event,id){if(event)event.stopPropagation();id=decodeURIComponent(id);var s=ensure(),at=s.generalSaved.indexOf(id);if(at>=0)s.generalSaved.splice(at,1);else s.generalSaved.push(id);window.save();window.renderGeneralLibrary();if(window.currentVocabDetail&&window.currentVocabDetail.kind==='general'&&window.currentVocabDetail.id===id)window.renderVocabularyDetail('general',id);window.updateGeneralPracticeInfo();};
  window.renderGeneralLibrary=function(reset){
    if(reset)visibleLimit=60;
    var type=document.getElementById('generalWordType').value,input=document.getElementById('generalLibrarySearch'),q=norm(input?input.value:''),filter=document.getElementById('generalCollectionFilter'),collection=filter?filter.value:'all',s=ensure();
    var all=active(),meta=window.VW_GENERAL_DATA&&window.VW_GENERAL_DATA.metadata||{},summary=document.getElementById('generalLibrarySummary');
    if(summary)summary.textContent=all.length+' active words and expressions · vocabulary data v'+(meta.version||'1')+' · Available offline.';
    var found=all.filter(function(x){
      var searchable=[x.display_form,x.lemma,x.meaning,x.german_definition,x.usage_note,x.grammar_note,primary(x)].concat((x.english_terms||[]).map(function(t){return t.term;})).join(' ');
      if(collection==='saved'&&s.generalSaved.indexOf(x.id)<0)return false;
      if(collection==='due'&&!isDue(x.id))return false;
      return hasWordType(x.lemma,x.part_of_speech,type)&&norm(searchable).includes(q);
    });
    var shown=found.slice(0,visibleLimit);
    document.getElementById('generalLibraryCount').textContent='Showing '+shown.length+' of '+found.length+' matches · '+all.length+' active words and expressions';
    document.getElementById('generalLibraryList').innerHTML=shown.map(function(x){
      var word=x.display_form||x.lemma,p=plural(x),ex=Array.isArray(x.german_examples)&&x.german_examples.length?x.german_examples[0].sentence:'',saved=s.generalSaved.indexOf(x.id)>=0;
      return '<div class="card word-card" data-detail-kind="general" data-detail-id="'+encodeURIComponent(x.id)+'"><div class="verb-row"><div><button class="word-link" type="button" lang="de" onclick="openVocabularyDetail(\'general\',decodeURIComponent(\''+encodeURIComponent(x.id)+'\'))">'+escText(word)+' <span aria-hidden="true">&#8594;</span></button><div class="meaning">'+escText(meaning(x))+'</div></div></div>'+(p?'<div class="meta">Plural: '+escText(p)+'</div>':'')+(ex?'<div class="small">'+escText(ex)+'</div>':'')+'<div class="actions general-word-actions"><button class="btn secondary" type="button" onclick="speak(decodeURIComponent(\''+encodeURIComponent(word)+'\'))">🔊 Listen</button><button class="btn ghost" type="button" aria-pressed="'+String(saved)+'" onclick="toggleGeneralSaved(event,\''+encodeURIComponent(x.id)+'\')">'+(saved?'★ Saved':'☆ Save')+'</button></div></div>';
    }).join('')||'<div class="empty">No matching entries found.</div>';
    document.getElementById('generalShowMore').classList.toggle('hidden',shown.length>=found.length);
  };
  window.updateGeneralPracticeInfo=function(){
    var list=active(),s=ensure(),count=s.generalKnown.filter(function(id){return list.some(function(x){return x.id===id;});}).length;
    var info=document.getElementById('generalPracticeInfo');
    var progress=document.getElementById('generalPracticeProgress');
    if(progress){progress.max=list.length||1;progress.value=count;}
    var due=list.filter(function(x){return isDue(x.id);}).length,saved=list.filter(function(x){return s.generalSaved.indexOf(x.id)>=0;}).length,meta=window.VW_GENERAL_DATA&&window.VW_GENERAL_DATA.metadata||{};
    if(info)info.textContent=count+' of '+list.length+' words learned · '+due+' due · '+saved+' saved · data v'+(meta.version||'1');var dueButton=document.getElementById('generalPracticeDueButton'),savedButton=document.getElementById('generalPracticeSavedButton');if(dueButton){dueButton.disabled=due===0;dueButton.textContent='Review due / weak ('+due+')'}if(savedButton){savedButton.disabled=saved===0;savedButton.textContent='Practice saved ('+saved+')'}
  };  var base=access.baseArticles.slice(), seen=new Set(base.map(function(x){return norm(x.n);}));
  var generalNouns=active().filter(function(x){return x.part_of_speech==='noun'&&['der','die','das'].indexOf(x.article)>=0;}).filter(function(x){var k=norm(x.lemma);if(!k||seen.has(k))return false;seen.add(k);return true;}).map(function(x){return {n:x.lemma,a:x.article,articles:[x.article],p:plural(x),en:meaning(x),source:'general',id:x.id,pluralUsage:x.plural_usage};});
  var frequencyNouns=frequencyRows.filter(function(x){return x.pos==='noun';}).filter(function(x){var k=norm(x.lemma);if(!k||seen.has(k)||!genderInfo(x.lemma))return false;seen.add(k);return true;}).map(function(x){var info=genderInfo(x.lemma),articles=genderArticles(info);return {n:x.lemma,a:articles.join(' / '),articles:articles,p:'',en:x.gloss,source:'frequency',frequencyRank:x.rank,note:info.note||''};});
  window.VW_ARTICLE_BANK=base.concat(generalNouns,frequencyNouns);
  window.VW_ARTICLE_PRACTICE_BANK=window.VW_ARTICLE_BANK.filter(function(x){return ['der','die','das'].indexOf(x.a)>=0;});
  function setCount(id,count){var node=document.getElementById(id);if(node)node.textContent=new Intl.NumberFormat('en-US').format(count);}
  setCount('frequencyCollectionCount',frequencyRows.length);
  setCount('pilotCollectionCount',(window.VW_PILOT_DATA||[]).length);
  setCount('verbCollectionCount',(window.VW_UNIFIED_VERB_ENTRIES||[]).length||(typeof VERBS==='undefined'?[]:VERBS).length);
  setCount('articleCollectionCount',window.VW_ARTICLE_BANK.length);

  function detailRecord(kind,id){
    if(kind==='general')return active().find(function(x){return x.id===id;})||null;
    if(kind==='frequency'){
      var frequency=frequencyRows.find(function(x){return String(x.rank)===String(id);});
      if(!frequency)return null;
      var wantedPos=posAliases[frequency.pos]||frequency.pos, frequencyGender=wantedPos==='noun'?genderInfo(frequency.lemma):null, frequencyArticles=genderArticles(frequencyGender);
      var curated=active().find(function(x){
        var entryPos=posAliases[x.part_of_speech]||x.part_of_speech;
        return norm(x.lemma)===norm(frequency.lemma)&&entryPos===wantedPos;
      });
      if(curated)return Object.assign({},curated,{frequencyRank:frequency.rank,frequencyPos:frequency.pos,frequencyGloss:frequency.gloss,frequencyArticles:curated.article?[curated.article]:frequencyArticles,genderNote:curated.article?'':frequencyGender&&frequencyGender.note||''});
      return {id:'wordly-'+frequency.rank,lemma:frequency.lemma,display_form:frequency.pos==='noun'?displayNoun(frequency.lemma,frequencyArticles):frequency.lemma,meaning:frequency.gloss,english_terms:[{term:frequency.gloss,primary:true}],part_of_speech:wantedPos,frequencyRank:frequency.rank,frequencyPos:frequency.pos,frequencyGloss:frequency.gloss,article:frequencyArticles.join(' / '),articles:frequencyArticles,frequencyArticles:frequencyArticles,genderNote:frequencyGender&&frequencyGender.note||'',source:'Wordly'};
    }
    if(kind==='pilot'){
      var p=(window.VW_PILOT_DATA||[]).find(function(x){return x.id===id;});
      if(!p)return null;
      var matched=active().find(function(x){return norm(x.lemma)===norm(p.lemma);});
      return matched?Object.assign({},matched,p):p;
    }
    if(kind==='article'){
      var a=(window.VW_ARTICLE_BANK||[]).find(function(x){return norm(x.lemma||x.n)===norm(id);});
      if(!a)return null;
      var matched=active().find(function(x){return a.id?x.id===a.id:x.part_of_speech==='noun'&&x.article===a.a&&norm(x.lemma)===norm(a.lemma||a.n);});
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
    var nounArticles=Array.isArray(x.frequencyArticles)&&x.frequencyArticles.length?x.frequencyArticles:(Array.isArray(x.articles)&&x.articles.length?x.articles:(x.article||x.a?String(x.article||x.a).split(/\s*\/\s*/).filter(Boolean):[]));
    if(kind!=='article'&&x.part_of_speech==='noun'&&nounArticles.length&&!/^(der|die|das)\s/i.test(word))word=nounArticles.join('/')+' '+(x.lemma||word);
    var meaningText=x.frequencyGloss||x.meaning||x.en||primary(x)||'Meaning not available';

    
    var english=(Array.isArray(x.english_terms)?x.english_terms.map(function(t){return t.term;}):[]);
    if(!english.length&&x.wikidata&&Array.isArray(x.wikidata.englishGlosses))english=x.wikidata.englishGlosses.slice();
    if(x.frequencyGloss)english.unshift(x.frequencyGloss);
    if(!english.length&&x.en)english=[x.en];
    english=Array.from(new Set(english.filter(Boolean)));
    var article=x.article||x.a||'';
    if(!article&&nounArticles.length)article=nounArticles.join(' / ');
    var pl=plurals(x).join(" / ")||String(x.p||'').replace(/^(die|der|das)\s+/i,'').trim();
    var isVerb=x.part_of_speech==="verb"||x.kind==="Verb";
    var grammarForm=(Array.isArray(x.forms)?x.forms:[]).find(function(form){return form&&form.tags&&(form.tags.verb_class||form.tags.aux||form.tags.prefix);});
    var tags=grammarForm?grammarForm.tags:{};
    var heading=isVerb?window.verbHeading(x.lemma||word,tags.verb_class,tags.modal):'<div class="eyebrow" style="color:var(--green)">WORD DETAILS</div>';
    var parts=['<div class="card detail">'+heading+'<div class="verb-row"><div><h2 lang="de">'+escText(word)+'</h2><div class="meaning">'+escText(meaningText)+'</div></div></div>'];
    if(article||pl||x.genderNote)parts.push('<div class="casebox"><b>Noun forms</b><br>'+(article?'Article: '+escText(article):'')+(article&&pl?' · ':'')+(pl?'Plural: '+escText(pl):'')+(x.genderNote?'<br>'+escText(x.genderNote):'')+'</div>');
    if(x.frequencyRank){
      var frequencyType={noun:"noun",verb:"verb",adj:"adjective",adv:"adverb",conj:"conjunction",det:"determiner",intj:"interjection",num:"numeral",other:"other",prep:"preposition",pron:"pronoun"}[x.frequencyPos]||x.frequencyPos||"not listed";
      parts.push('<div class="casebox"><b>Wordly frequency</b><br>Rank '+escText(x.frequencyRank)+' of 5,000 · word type: '+escText(frequencyType)+'</div>');
    }
    if(x.german_definition)parts.push('<h3>Meaning in German</h3><div class="example" lang="de">'+escText(x.german_definition)+'</div>');
    if(x.grammar_note)parts.push('<h3 lang="de">Grammatik</h3><div class="casebox" lang="de">'+escText(x.grammar_note)+'</div>');
    if(x.usage_note)parts.push('<h3>Usage tip</h3><div class="casebox">'+escText(x.usage_note)+'</div>');
    if(english.length)parts.push('<h3>English meanings</h3><div class="casebox">'+english.map(escText).join(' · ')+'</div>');
    var forms=Array.isArray(x.forms)?x.forms.filter(function(f){return f&&f.surface;}):[];
    var seen=Object.create(null),uniqueForms=forms.filter(function(f){var key=[f.surface,f.number,f.case].join('|');if(seen[key])return false;seen[key]=true;return true;}).slice(0,10);
    if(uniqueForms.length>1){
      var cases={nom:'Nominative',acc:'Accusative',dat:'Dative',gen:'Genitive'};
      parts.push('<h3>Word forms</h3><table class="table"><thead><tr><th>Form</th><th>Number</th><th>Case</th></tr></thead><tbody>'+uniqueForms.map(function(f){return '<tr><td lang="de">'+escText(f.surface)+'</td><td>'+escText(f.number==='sg'?'Singular':f.number==='pl'?'Plural':'—')+'</td><td>'+escText(cases[f.case]||f.case||'Base form')+'</td></tr>';}).join('')+'</tbody></table>');
    }
    if(isVerb){
      var auxiliary=window.vocabularyAuxiliary(x.lemma||word,tags.aux),notes=[];
      if(auxiliary)notes.push("Hilfsverb: "+auxiliary);
      if(tags.prefix)notes.push("Präfix: "+tags.prefix);
      if(notes.length)parts.push('<h3 lang="de">Verbgrammatik</h3><div class="casebox" lang="de">'+notes.map(escText).join(" · ")+"</div>");
    }
    var examples=Array.isArray(x.german_examples)?x.german_examples:(Array.isArray(x.examples)?x.examples:[]);
    if(examples.length)parts.push('<h3>Examples in context</h3>'+window.renderExampleSet(examples.slice(0,3),x));
    else parts.push('<h3>Examples in context</h3><div class="casebox">No reviewed example is available for this entry yet.</div>');
    if(Array.isArray(x.domains)&&x.domains.length)parts.push('<div class="meta">Topics: '+x.domains.map(escText).join(' · ')+'</div>');
    if(kind==='general'){var saved=ensure().generalSaved.indexOf(x.id)>=0;parts.push('<div class="actions general-word-actions"><button class="btn secondary" type="button" aria-pressed="'+String(saved)+'" onclick="toggleGeneralSaved(event,\''+encodeURIComponent(x.id)+'\')">'+(saved?'★ Saved':'☆ Save word')+'</button><button class="btn" type="button" onclick="startGeneralPractice(\'word\',decodeURIComponent(\''+encodeURIComponent(x.id)+'\'))">Practice this word</button></div>');}
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
    var ids={general:'generalLibraryPanel',frequency:'frequencyPanel',grammar:'grammarPanel',pilot:'pilotPanel',verbs:'verbLibraryPanel',articles:'articleLibraryPanel',detail:'verbDetailPanel'};
    Object.keys(ids).forEach(function(x){var e=document.getElementById(ids[x]);if(e)e.classList.toggle('hidden',x!==k);});
    var nav=document.getElementById('libraryKinds');if(nav)nav.classList.toggle('hidden',k==='detail');
    if(k!=='detail'&&window.clearLibraryDetail)window.clearLibraryDetail();
    document.querySelectorAll('#libraryKinds [data-library-kind]').forEach(function(e){var selected=e.dataset.libraryKind===k;e.classList.toggle('active',selected);e.setAttribute('aria-pressed',String(selected));});
    var collectionLabels={frequency:'By frequency',pilot:'Starter words',verbs:'Verb library',articles:'Nouns by article'};
    var collectionMenu=document.getElementById('libraryMoreKinds'),collectionLabel=document.getElementById('libraryMoreKindsLabel');
    if(collectionLabel)collectionLabel.textContent=collectionLabels[k]||'More collections';
    if(collectionMenu&&collectionMenu.open){collectionMenu.open=false;var summary=collectionMenu.querySelector('summary');if(summary)summary.focus();}
    if(button&&history.state&&history.state.pageId==='library'){
      var route=Object.assign({},history.state,{libraryKind:k});
      history.replaceState(route,'',window.vwRouteUrl(route));
    }
    if(k==='frequency')window.renderFrequencyList();
    if(k==='general')window.renderGeneralLibrary();if(k==='pilot')window.renderPilot();if(k==='verbs')window.renderLibrary();if(k==='articles')window.renderArticleLibrary();
  };
  window.openLibrary=function(k,btn){window.vwNav('library',btn,true,{libraryKind:k||'general'});};
  var articleMatches=[],articleRendered=0,articleBatchSize=60;
  function articleCard(x){
    var pl=articlePluralLabel(x),articles=Array.isArray(x.articles)&&x.articles.length?x.articles:(x.a?String(x.a).split(/\s*\/\s*/).filter(Boolean):[]),articleLabel=articles.join(' / '),label=articleLabel?articleLabel+' '+x.n:x.n,note=x.note||'';
    return '<div class="card word-card" data-detail-kind="article" data-detail-id="'+encodeURIComponent(x.n)+'"><div class="verb-row"><div><button class="word-link" type="button" lang="de" onclick="openVocabularyDetail(\'article\',decodeURIComponent(\''+encodeURIComponent(x.n)+'\'))">'+escText(label)+' <span aria-hidden="true">&#8594;</span></button><div class="meaning">'+escText(x.en)+'</div></div></div>'+(note?'<div class="meta">'+escText(note)+'</div>':'')+'<div class="meta">'+escText(pl)+'</div><button class="btn secondary" style="margin-top:10px" aria-label="Listen to '+escText(label)+'" onclick="speak(decodeURIComponent(\''+encodeURIComponent(label)+'\'))">🔊 Listen</button></div>';
  }
  function appendArticleBatch(){
    var root=document.getElementById('articleLibrary'),batch=articleMatches.slice(articleRendered,articleRendered+articleBatchSize);
    if(root&&batch.length)root.insertAdjacentHTML('beforeend',batch.map(articleCard).join(''));
    articleRendered+=batch.length;
    var count=document.getElementById('articleLibraryCount'),more=document.getElementById('articleLibraryShowMore');
    if(count)count.textContent=articleMatches.length?'Showing '+new Intl.NumberFormat('en-US').format(articleRendered)+' of '+new Intl.NumberFormat('en-US').format(articleMatches.length)+' nouns':'No matching nouns';
    if(more)more.classList.toggle('hidden',articleRendered>=articleMatches.length);
  }
  window.showMoreArticleNouns=appendArticleBatch;
  window.renderArticleLibrary=function(){
    var q=norm((document.getElementById('articleLibrarySearch')||{}).value||'');
    articleMatches=window.VW_ARTICLE_BANK.filter(function(x){return norm([x.a,(x.articles||[]).join(' '),x.n,x.en,x.p,x.note].join(' ')).indexOf(q)>=0;});
    articleRendered=0;
    var root=document.getElementById('articleLibrary');if(root)root.replaceChildren();
    var note=document.getElementById('articleLibraryPracticeNote');
    if(note){var total=new Intl.NumberFormat('en-US').format(window.VW_ARTICLE_BANK.length),eligible=new Intl.NumberFormat('en-US').format(window.VW_ARTICLE_PRACTICE_BANK.length);note.textContent=eligible+' of '+total+' nouns have one fixed article for single-answer practice. Nouns with multiple or context-dependent articles remain available to browse.';}
    appendArticleBatch();
  };
  window.renderArticleHome=function(){
    var s=access.state,done=Array.isArray(s.articleCompleted)?s.articleCompleted.length:0,day=Math.max(1,done+1);
    var fresh=window.VW_ARTICLE_PRACTICE_BANK.slice((day-1)*5,day*5);
    document.getElementById('articleDayTitle').textContent='Day '+day+' · Article training';
    document.getElementById('articleDayInfo').textContent=fresh.length?fresh.length+' new nouns · previous nouns return in revision':'All available nouns have been introduced. Use article practice for review.';
    document.getElementById('articleDailyWords').textContent=fresh.map(function(x){return x.a+' '+x.n+' · '+x.en;}).join('  |  ');
    var b=document.querySelector('#articlePage button[onclick="startArticleLesson()"]');if(b)b.disabled=!fresh.length;
  };
  window.startArticleLesson=function(){
    var s=access.state,day=Math.max(1,(s.articleCompleted||[]).length+1),fresh=window.VW_ARTICLE_PRACTICE_BANK.slice((day-1)*5,day*5),prior=window.VW_ARTICLE_PRACTICE_BANK.slice(0,(day-1)*5).slice(-5);
    if(!fresh.length){alert('All currently bundled article lessons are complete.');return;}
    access.articleItems=fresh.concat(prior);access.articleMode='lesson';access.articleIndex=0;access.articleScore=0;access.articleDone=false;access.articleChoice='';
    window.vwNav('review',null,true);window.renderArticleQuestion();
  };
  window.startArticlePractice=function(k){
    var s=access.state;access.articleMode=k;
    var learned=window.VW_ARTICLE_PRACTICE_BANK.slice(0,Math.min(window.VW_ARTICLE_PRACTICE_BANK.length,Math.max(5,(s.articleCompleted||[]).length*5)));
    access.articleItems=learned.slice().sort(function(a,b){return ((s.articleWeak||{})[b.n]||0)-((s.articleWeak||{})[a.n]||0);}).slice(0,k==='quickTest'?10:k==='deepTest'?12:8);
    access.articleIndex=0;access.articleScore=0;access.articleDone=false;access.articleChoice='';
    window.vwNav('review',null,true);window.renderArticleQuestion();
  };
  window.renderArticleQuestion=function(){var root=document.getElementById('reviewContent'),items=access.articleItems,i=access.articleIndex,mode=access.articleMode;if(i>=items.length){if(mode==='lesson'){var s=access.state;s.articleCompleted=s.articleCompleted||[];var d=s.articleCompleted.length+1;if(s.articleCompleted.indexOf(d)<0)s.articleCompleted.push(d);window.save()}root.innerHTML='<div class="card empty"><h2>Article practice complete</h2><p>Score: '+access.articleScore+'/'+items.length+'</p><button class="btn full" onclick="vwNav(&quot;articlePage&quot;,null,true);renderArticleHome()">Back to Article Training</button></div>';document.getElementById('reviewProgress').textContent='Complete';return}var x=items[i],deep=String(mode).indexOf('deep')===0,pl=articlePluralLabel(x),keepFocus=window.shouldMoveReviewFocus();root.innerHTML='<div class="card"><div class="eyebrow">ARTICLE '+(mode==='lesson'?'LESSON':String(mode).toUpperCase())+'</div><div class="sub">'+(i+1)+' / '+items.length+'</div><h2>Which article belongs to <b lang="de">'+escText(x.n)+'</b>?</h2><div class="meaning">'+escText(x.en)+'</div>'+['der','die','das'].map(function(a){var chosen=access.articleChoice===a;return '<button type="button" class="quizopt'+(chosen?' chosen':'')+'" lang="de" aria-pressed="'+String(chosen)+'"'+(access.articleDone?' disabled':'')+' onclick="answerArticle(&quot;'+a+'&quot;)">'+a+'</button>'}).join('')+(access.articleDone?'<div class="feedback" role="status" aria-live="polite" aria-atomic="true">'+(access.articleChoice===x.a?'Correct!':'Correct answer: '+escText(x.a))+'<br>'+escText(x.a+' '+x.n)+' · '+escText(pl)+'</div><button class="btn full" onclick="nextArticle()">Continue</button>':'')+'<div class="small">'+(deep?'After choosing, say the noun in a sentence and consider its case.':'Quick article recall.')+'</div></div>';document.getElementById('reviewProgress').textContent=(i+1)+' / '+items.length;if(access.articleDone&&keepFocus)window.focusReviewContinue()};
  window.answerArticle=function(a){
    if(access.articleDone)return;access.articleChoice=a;access.articleDone=true;
    var x=access.articleItems[access.articleIndex],s=access.state;
    if(a===x.a){access.articleScore++;s.articleCorrect=(s.articleCorrect||0)+1;s.articleWeak=s.articleWeak||{};s.articleWeak[x.n]=Math.max(0,(s.articleWeak[x.n]||0)-1);}
    else{s.articleWeak=s.articleWeak||{};s.articleWeak[x.n]=(s.articleWeak[x.n]||0)+1;}
    s.articleAnswers=(s.articleAnswers||0)+1;window.save();window.renderArticleQuestion();
  };
  window.nextArticle=function(){access.articleIndex++;access.articleDone=false;access.articleChoice='';window.renderArticleQuestion();};
  window.setPracticeTrack=function(t){
    access.track=t;['vocab','articles','both','general'].forEach(function(x){var b=document.getElementById('track'+x.charAt(0).toUpperCase()+x.slice(1));if(b){b.classList.toggle('active',x===t);b.setAttribute('aria-pressed',String(x===t));}});
    var p=document.getElementById('generalPracticeInfoPanel');if(p)p.classList.toggle('hidden',t!=='general');if(t==='general')window.updateGeneralPracticeInfo();
  };
  window.setPracticeDifficulty=function(d){
    access.difficulty=d;['quick','deep'].forEach(function(x){var b=document.getElementById('difficulty'+x.charAt(0).toUpperCase()+x.slice(1));if(b){b.classList.toggle('active',x===d);b.setAttribute('aria-pressed',String(x===d));}});
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
    var spoken=norm(target.display_form||target.lemma);
    var distractors=pool.filter(function(x){return x.id!==target.id&&norm(x.display_form||x.lemma)!==spoken;});
    shuffle(distractors).forEach(function(x){var m=meaning(x),key=norm(m);if(out.length<4&&m!=='Meaning not available'&&!used.has(key)){used.add(key);out.push({id:x.id,word:m});}});
    return shuffle(out);
  }
  function updateWordReview(x,correct){
    var s=ensure(),p=wordProgress(x.id),now=Date.now();p.attempts++;p.lastReviewedAt=now;
    if(correct){p.correct++;p.streak++;p.repetitions++;var intervals=[1,3,7,14,30],days=intervals[Math.min(p.repetitions-1,intervals.length-1)];p.dueAt=now+days*86400000;p.status=p.repetitions>=4?'mastered':'learning';if(s.generalKnown.indexOf(x.id)<0)s.generalKnown.push(x.id);s.generalWeak[x.id]=Math.max(0,(s.generalWeak[x.id]||0)-1);}
    else{p.streak=0;p.repetitions=0;p.status='learning';p.dueAt=now+10*60000;s.generalWeak[x.id]=(s.generalWeak[x.id]||0)+1;}
  }
  window.startGeneralPractice=function(k,selectedId){
    var s=ensure(),allPool=active(),pool=allPool,known=new Set(s.generalKnown),emptyMessage='';
    if(k==='saved'){pool=pool.filter(function(x){return s.generalSaved.indexOf(x.id)>=0;});emptyMessage='Save words in the Library to practice your personal collection.';}
    else if(k==='due'){pool=pool.filter(function(x){return isDue(x.id);});emptyMessage='Nothing is due right now. Keep learning, or check back later.';}
    else if(k==='word'){pool=pool.filter(function(x){return x.id===selectedId;});emptyMessage='This word is not available in the current vocabulary pack.';}
    pool.sort(function(a,b){var w=(s.generalWeak[b.id]||0)-(s.generalWeak[a.id]||0);if(w)return w;var pa=s.generalWordProgress[a.id],pb=s.generalWordProgress[b.id],da=pa?Number(pa.dueAt||0):0,db=pb?Number(pb.dueAt||0):0;if(k==='due'&&da!==db)return da-db;return Number(known.has(a.id))-Number(known.has(b.id))||rank(a)-rank(b);});
    var listening=k==='listenQuick',n=(k==='due'||k==='saved')?10:(k==='word'?1:(listening?6:k==='quickTest'?8:k==='deepTest'?10:6));
    session={items:pool.slice(0,n).map(function(x){return {target:x,options:listening?meaningOptions(x,allPool):options(x,allPool)};}),index:0,score:0,answered:false,choice:'',selectedId:'',mode:k,emptyMessage:emptyMessage};
    window.vwNav('review',null,true);window.renderGeneralQuestion();
  };
  window.renderGeneralQuestion=function(){
    var root=document.getElementById('reviewContent');
    if(session.index>=session.items.length){
      var empty=session.items.length===0,heading=empty?'Nothing to practice yet':'General vocabulary practice complete',body=empty?session.emptyMessage:'Score: '+session.score+'/'+session.items.length;
      root.innerHTML='<div class="card empty"><h2>'+heading+'</h2><p>'+escText(body)+'</p><p class="small">Your saved words and review schedule stay on this device and are included in progress backups.</p><button class="btn full" onclick="showPage(\'practiceHome\')">Back to Practice</button></div>';
      document.getElementById('reviewProgress').textContent=empty?'Ready':'Complete';return;
    }
    var q=session.items[session.index],x=q.target,deep=String(session.mode).indexOf('deep')===0,listening=session.mode==='listenQuick',typed=session.mode==='typeQuick',keepFocus=window.shouldMoveReviewFocus(),locale=listening?'en':'de';
    var choices=typed?'':'<div class="general-answer-options">'+q.options.map(function(o){var chosen=session.selectedId===o.id;return '<button type="button" class="quizopt'+(chosen?' chosen':'')+'" lang="'+locale+'" aria-pressed="'+String(chosen)+'"'+(session.answered?' disabled':'')+' onclick="answerGeneral(\''+encodeURIComponent(o.id)+'\')">'+escText(o.word)+'</button>';}).join('')+'</div>'; 
    var extra='';
    if(session.answered){var row=Array.isArray(x.german_examples)&&x.german_examples.length?x.german_examples[0]:null,ex=typeof row==='string'?row:row&&(row.sentence||row.de)||'',example=ex?'<br><br>'+window.renderExampleSet([row],x):'';extra='<div class="feedback" role="status" aria-live="polite" aria-atomic="true">'+(session.choice===x.id?'Correct!':'Correct answer: '+escText(x.display_form||x.lemma))+'<br>'+escText(x.german_definition||meaning(x))+example+'</div><button class="btn full" onclick="nextGeneralQuestion()">Continue</button>'; }
    var prompt=listening?'<p class="small">Listen to the German pronunciation, then choose its meaning.</p><div class="actions listen-actions"><button class="btn secondary" type="button" aria-label="Play the German pronunciation" onclick="speak(decodeURIComponent(\''+encodeURIComponent(x.display_form||x.lemma)+'\'))">&#128266; Play word</button><button class="btn ghost" type="button" aria-label="Play the German pronunciation slowly" onclick="speak(decodeURIComponent(\''+encodeURIComponent(x.display_form||x.lemma)+'\'),true)">0.7&#215; Slow</button></div>':typed?'<div class="meaning">'+escText(meaning(x))+'</div><form class="general-type-form" onsubmit="answerGeneralTyped(event)"><label for="generalTypedAnswer">Type the German word</label><input class="search" id="generalTypedAnswer" type="text" lang="de" autocomplete="off" autocapitalize="none" spellcheck="false" required><button class="btn full" type="submit">Check answer</button></form>':'<div class="meaning">'+escText(meaning(x))+'</div>';
    root.innerHTML='<div class="card"><div class="eyebrow">GENERAL VOCABULARY · '+(listening?'LISTENING':typed?'TYPE AND RECALL':deep?'DEEP':session.mode==='due'?'REVIEW DUE':session.mode==='saved'?'SAVED WORDS':'QUICK')+'</div><div class="sub">'+(session.index+1)+' / '+session.items.length+'</div><h3>'+(listening?'Choose the meaning you hear':typed?'Recall the German word or expression':'Choose the German word or expression')+'</h3>'+prompt+choices+extra+'</div>';
    document.getElementById('reviewProgress').textContent=(session.index+1)+' / '+session.items.length;if(typed&&!session.answered){var field=document.getElementById('generalTypedAnswer');if(field)field.focus();}if(session.answered&&keepFocus)window.focusReviewContinue();
  };
  function submitGeneralAnswer(correct){if(session.answered)return;var x=session.items[session.index].target,s=ensure();session.choice=correct?x.id:'__wrong__';session.answered=true;s.generalAnswers++;if(correct){session.score++;s.generalCorrect++;}updateWordReview(x,correct);window.save();window.renderGeneralQuestion();}
  window.answerGeneral=function(id){if(session.answered)return;id=decodeURIComponent(id);session.selectedId=id;submitGeneralAnswer(id===session.items[session.index].target.id);};
  window.answerGeneralTyped=function(event){event.preventDefault();if(session.answered)return;var x=session.items[session.index].target,answer=norm(document.getElementById('generalTypedAnswer').value),accepted=[x.lemma,x.display_form];if(x.article)accepted.push(x.article+' '+x.lemma);submitGeneralAnswer(accepted.some(function(value){return norm(value)===answer;}));};
  window.nextGeneralQuestion=function(){session.index++;session.answered=false;session.choice='';session.selectedId='';window.renderGeneralQuestion();};
  var oldProgress=window.renderProgress;
  window.renderProgress=function(){oldProgress();var e=document.getElementById('generalProgressSummary');if(e){var s=ensure();var due=active().filter(function(x){return isDue(x.id);}).length;e.textContent=s.generalKnown.length+' entries learned · '+s.generalSaved.length+' saved · '+due+' due for review · '+s.generalAnswers+' answers, '+s.generalCorrect+' correct.';}};
  populateWordTypes("generalWordType",active());
  populateWordTypes("frequencyWordType",frequencyRows);
  document.addEventListener('click',function(event){
    var menu=document.getElementById('libraryMoreKinds');
    if(menu&&menu.open&&!menu.contains(event.target))menu.open=false;
  });
  document.addEventListener('focusin',function(event){
    var menu=document.getElementById('libraryMoreKinds');
    if(menu&&menu.open&&!menu.contains(event.target))menu.open=false;
  });
  document.addEventListener('keydown',function(event){
    if(event.key!=='Escape')return;
    var menu=document.getElementById('libraryMoreKinds');
    if(!menu||!menu.open)return;
    menu.open=false;
    var summary=menu.querySelector('summary');
    if(summary)summary.focus();
  });
  window.setLibraryKind('general');
})();
