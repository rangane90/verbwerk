(function () {
  "use strict";
  var generalData = window.VW_GENERAL_DATA && Array.isArray(window.VW_GENERAL_DATA.entries) ? window.VW_GENERAL_DATA.entries : [];
  var generalRows = generalData.filter(function (x) { return x.status === "approved" && x.is_active !== false; });
  var frequencyRows = Array.isArray(window.VW_WORDLY_DE) ? window.VW_WORDLY_DE : [];
  var nounGenderEntries = window.VW_GERMAN_NOUN_GENDERS && window.VW_GERMAN_NOUN_GENDERS.entries || {};
  var pilotRows = Array.isArray(window.VW_PILOT_DATA) ? window.VW_PILOT_DATA : [];
  var articleRows = Array.isArray(window.VW_ARTICLE_BANK) ? window.VW_ARTICLE_BANK : [];
  var courseRows = typeof VERBS !== "undefined" && Array.isArray(VERBS) ? VERBS : [];
  var labels = {curated:"Curated vocabulary",frequency:"Frequency list",pilot:"50-word pilot",course:"Course verbs",articles:"Article nouns"};
  var aliases = {adj:"adjective",adv:"adverb",conj:"conjunction",det:"determiner",intj:"interjection",num:"numeral",prep:"preposition",pron:"pronoun",Noun:"noun",Verb:"verb",Adjective:"adjective",Adverb:"adverb",Preposition:"preposition",Pronoun:"pronoun",Conjunction:"conjunction",Determiner:"determiner",Numeral:"numeral",Interjection:"interjection"};
  var modals = new Set(["dürfen","können","mögen","müssen","sollen","wollen","möchten"]);
  var connectors = new Set(["also","außerdem","ansonsten","dagegen","daher","dann","darum","deshalb","deswegen","folglich","sonst","stattdessen","trotzdem","zudem"]);
  var types = [["all","All types"],["noun","Nouns"],["verb","Verbs"],["modal","Modal verbs"],["adjective","Adjectives"],["adverb","Adverbs"],["connector","Connectors"],["preposition","Prepositions"],["pronoun","Pronouns"],["determiner","Articles and determiners"],["numeral","Numerals"],["particle","Particles"],["interjection","Interjections"],["chunk","Expressions"],["other","Other"]];
  var entries = [], byKey = Object.create(null), index = Object.create(null), limit = 60;
  var originalOpen = window.openVocabularyDetail, originalRender = window.renderVocabularyDetail;

  function norm(x) { return String(x == null ? "" : x).toLocaleLowerCase().normalize("NFC").trim(); }
  function genderInfo(lemma) { return nounGenderEntries[norm(lemma)] || null; }
  function displayWord(x) {
    var base=String(x.lemma||x.display_form||"");
    if(pos(x.part_of_speech)==="noun") {
      var articles=Array.isArray(x.articles)?x.articles:(x.article?String(x.article).split(/\s*\/\s*/):[]);
      articles=articles.filter(function(a){return ["der","die","das"].indexOf(a)>=0;});
      if(articles.length)return articles.join("/")+" "+base;
    }
    return String(x.display_form||x.lemma||"");
  }
  function formatCount(value) { return new Intl.NumberFormat("en-US").format(Number(value) || 0); }
  function pos(x) { var raw = String(x || "").trim(); return aliases[raw] || aliases[raw.toLowerCase()] || raw.toLowerCase(); }
  function lemmaKey(lemma, type) { return norm(lemma) + "|" + pos(type); }
  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]; }); }
  function mainMeaning(x) {
    var terms = Array.isArray(x.english_terms) ? x.english_terms : [];
    var term = terms.find(function (t) { return t && t.primary && t.term; }) || terms.find(function (t) { return t && t.term; });
    return x.meaning || (term && term.term) || "";
  }
  function pilotPos(x) { return pos((x.wikidata && x.wikidata.lexicalCategory) || x.part_of_speech || x.kind || "other"); }
  function meaningValues(record, source) {
    var out = [];
    if (source === "curated") {
      out.push(record.meaning);
      (record.english_terms || []).forEach(function (x) { if (x) out.push(x.term); });
    } else if (source === "frequency") out.push(record.gloss);
    else if (source === "pilot") {
      out.push(record.meaning);
      if (record.wikidata && record.wikidata.englishGlosses) out = out.concat(record.wikidata.englishGlosses);
    } else if (source === "course") out.push(record.meaning);
    else if (source === "articles") out.push(record.en);
    return out.filter(Boolean).map(norm);
  }
  function score(a, aSource, b, bSource) {
    var best = 0;
    meaningValues(a, aSource).forEach(function (x) {
      meaningValues(b, bSource).forEach(function (y) {
        if (x === y) best = Math.max(best, 5);
        else if (x.length > 3 && y.length > 3 && (x.indexOf(y) >= 0 || y.indexOf(x) >= 0)) best = Math.max(best, 4);
        else {
          var aw = x.replace(/[^a-zäöüß0-9 ]/g," ").split(/\s+/).filter(function (w) { return w.length > 2 && !/^(the|and|for|with|from|that|this|to|a|an|of|in|on|by)$/.test(w); });
          var bw = y.replace(/[^a-zäöüß0-9 ]/g," ").split(/\s+/).filter(function (w) { return w.length > 2 && !/^(the|and|for|with|from|that|this|to|a|an|of|in|on|by)$/.test(w); });
          var overlap = aw.filter(function (w) { return bw.indexOf(w) >= 0; }).length;
          if (aw.length && bw.length && overlap / Math.min(aw.length,bw.length) >= .66) best = Math.max(best,3);
          else if (aw.length && bw.length && overlap) best = Math.max(best,1);
        }
      });
    });
    return best;
  }
  function makeEntry(source,id,lemma,type,record,display,meaning) {
    var key = source + ":" + String(id), row = {key:key,lemma:String(lemma || display || ""),part_of_speech:pos(type),display_form:String(display || lemma || ""),meaning:String(meaning || ""),sources:[],records:Object.create(null),article:"",articles:[],genderNote:"",plural:"",frequencyRank:0,frequencyGloss:"",general:null,courseVerb:null};
    entries.push(row); byKey[key] = row;
    (index[lemmaKey(row.lemma,row.part_of_speech)] || (index[lemmaKey(row.lemma,row.part_of_speech)] = [])).push(row);
    return row;
  }
  function findMatch(source,lemma,type,record) {
    var candidates = index[lemmaKey(lemma,type)] || [];
    if (source === "articles") {
      var wanted=Array.isArray(record.articles)?record.articles:(record.a?String(record.a).split(/\s*\/\s*/):[]);
      var compatible=candidates.filter(function(x){return !x.articles.length||!wanted.length||x.articles.some(function(a){return wanted.indexOf(a)>=0;});});
      if(compatible.length)candidates=compatible;
      if(candidates.length===1)return candidates[0];
    }
    var ranked = candidates.map(function (item) {
      var best = 0;
      Object.keys(item.records).forEach(function (existingSource) {
        item.records[existingSource].forEach(function (existing) { best = Math.max(best,score(record,source,existing,existingSource)); });
      });
      return {item:item,score:best};
    }).sort(function (a,b) { return b.score-a.score; });
    if (!ranked.length || ranked[0].score < 1) return null;
    if (ranked.length === 1 || ranked[0].score > ranked[1].score) return ranked[0].item;
    return null;
  }
  function add(source,id,lemma,type,record,display,meaning) {
    if (!lemma && !display) return;
    var item = source === "curated" ? null : findMatch(source,lemma || display,type,record);
    if (!item) item = makeEntry(source,id,lemma || display,type,record,display,meaning);
    if (item.sources.indexOf(source) < 0) item.sources.push(source);
    (item.records[source] || (item.records[source] = [])).push(record);
    if (source === "curated" && !item.general) {
      item.general = record; item.display_form = record.display_form || record.lemma || item.display_form; item.meaning = mainMeaning(record) || item.meaning;
    } else if (!item.meaning && meaning) item.meaning = meaning;
    var articleValues=[];
    if(Array.isArray(record.articles))articleValues=articleValues.concat(record.articles);
    if(record.article)articleValues=articleValues.concat(String(record.article).split(/\s*\/\s*/));
    if(record.a)articleValues=articleValues.concat(String(record.a).split(/\s*\/\s*/));
    if(source==="frequency"&&pos(type)==="noun"){
      var gender=genderInfo(lemma);
      if(gender){articleValues=articleValues.concat(gender.articles||[]);if(!item.genderNote)item.genderNote=gender.note||"";}
    }
    articleValues.forEach(function(a){if(["der","die","das"].indexOf(a)>=0&&item.articles.indexOf(a)<0)item.articles.push(a);});
    item.articles=["der","die","das"].filter(function(a){return item.articles.indexOf(a)>=0;});
    item.article=item.articles.join(" / ");
    if(record.note&&!item.genderNote)item.genderNote=record.note;
    var plural = record.plural || record.p || (record.plural_forms && record.plural_forms[0]) || "";
    if (plural) item.plural = String(plural).replace(/^(der|die|das)\s+/i,"").trim();
    if (source === "frequency") {
      var rank = Number(record.rank || 0);
      if (rank && (!item.frequencyRank || rank < item.frequencyRank)) item.frequencyRank = rank;
      item.frequencyGloss = item.frequencyGloss || String(record.gloss || "");
    }
    if (source === "course") item.courseVerb = record;
  }
  generalRows.forEach(function (x) { add("curated",x.id,x.lemma,x.part_of_speech,x,x.display_form || x.lemma,mainMeaning(x)); });
  frequencyRows.forEach(function (x) { add("frequency",x.rank,x.lemma,x.pos,x,x.lemma,x.gloss); });
  pilotRows.forEach(function (x) { add("pilot",x.id,x.lemma,pilotPos(x),x,x.word || x.lemma,x.meaning); });
  courseRows.forEach(function (x) { add("course",x.id,x.id,"verb",x,x.id,x.meaning); });
  articleRows.forEach(function (x) { add("articles",(x.a || "") + ":" + x.n,x.n,"noun",x,((x.a || "") + " " + x.n).trim(),x.en); });
  entries.sort(function (a,b) { return (a.frequencyRank || 999999) - (b.frequencyRank || 999999) || norm(a.display_form).localeCompare(norm(b.display_form)); });

  function matchesType(x,type) {
    var p = pos(x.part_of_speech);
    if (type === "all") return true;
    if (type === "modal") return p === "verb" && (modals.has(norm(x.lemma)) || (x.records.pilot || []).some(function (r) { return /modal/i.test(r.kind || ""); }));
    if (type === "connector") return p === "conjunction" || (p === "adverb" && connectors.has(norm(x.lemma)));
    return p === type;
  }
  function populateFilters() {
    var select = document.getElementById("generalWordType");
    if (select) {
      var old = select.value || "all"; select.replaceChildren();
      types.forEach(function (entry) { if (entry[0] === "all" || entries.some(function (x) { return matchesType(x,entry[0]); })) select.add(new Option(entry[1],entry[0])); });
      select.value = Array.from(select.options).some(function (x) { return x.value === old; }) ? old : "all";
    }
  }
  function state() { return window.VW_APP_ACCESS && window.VW_APP_ACCESS.state || {}; }
  function savedId(x) { return x.general && x.general.id || ""; }
  function isDue(x) {
    var id = savedId(x), s = state(), p = id && s.generalWordProgress && s.generalWordProgress[id];
    if (!id) return false;
    return p ? Number(p.dueAt || 0) <= Date.now() : ((s.generalWeak && s.generalWeak[id] || 0) > 0 || (s.generalKnown || []).indexOf(id) >= 0);
  }
  function searchable(x) {
    var values = [x.lemma,x.display_form,x.meaning,x.article,(x.articles||[]).join(" "),x.genderNote,x.plural,x.frequencyGloss];
    Object.keys(x.records).forEach(function (s) {
      x.records[s].forEach(function (r) {
        meaningValues(r,s).forEach(function (v) { values.push(v); });
        values.push(r.german_definition,r.usage_note,r.grammar_note,r.pattern,r.note,r.word,r.gloss,r.en);
      });
    });
    return norm(values.filter(Boolean).join(" "));
  }
  function examplesOf(x) {
    var out = [], seen = Object.create(null);
    ["curated","pilot","course","articles"].forEach(function (source) {
      (x.records[source] || []).forEach(function (record) {
        var examples = Array.isArray(record.german_examples) ? record.german_examples : (Array.isArray(record.examples) ? record.examples : []);
        examples.forEach(function (example) {
          var value = Array.isArray(example) ? {sentence:example[0],translation_language:"en",translation:example[1] || ""} : (typeof example === "string" ? {sentence:example} : Object.assign({},example || {}));
          var sentence = value.sentence || value.de;
          if (sentence && !seen[norm(sentence)]) { seen[norm(sentence)] = true; out.push(value); }
        });
      });
    });
    return out.slice(0,3);
  }
  function meaningsOf(x) {
    var out = [];
    Object.keys(x.records).forEach(function (source) {
      x.records[source].forEach(function (r) {
        meaningValues(r,source).forEach(function (v) { if (out.indexOf(v) < 0) out.push(v); });
      });
    });
    return out;
  }
  function sourceText(x) { return x.sources.map(function (s) { return labels[s] || s; }).join(" · "); }
  function typeText(x) {
    return ({noun:"Noun",verb:"Verb",adjective:"Adjective",adverb:"Adverb",conjunction:"Conjunction",preposition:"Preposition",pronoun:"Pronoun",determiner:"Determiner",numeral:"Numeral",particle:"Particle",interjection:"Interjection",chunk:"Expression",other:"Other"})[pos(x.part_of_speech)] || pos(x.part_of_speech);
  }
  function baseRecord(x) {
    var g = x.records.curated && x.records.curated[0], p = x.records.pilot && x.records.pilot[0], a = x.records.articles && x.records.articles[0], f = x.records.frequency && x.records.frequency[0], c = x.records.course && x.records.course[0], result;
    if (g) result = Object.assign({},g);
    else if (p) {
      result = Object.assign({},p,{id:x.key,lemma:p.lemma || x.lemma,display_form:p.word || p.lemma || x.display_form,part_of_speech:x.part_of_speech,meaning:p.meaning || x.meaning,article:p.article || x.article,plural_forms:p.plural ? [p.plural] : []});
      if (!result.english_terms && p.wikidata && p.wikidata.englishGlosses) result.english_terms = p.wikidata.englishGlosses.map(function (term,i) { return {term:term,primary:i===0}; });
    } else if (a) result = {id:x.key,lemma:a.n || x.lemma,display_form:((a.a || "") + " " + (a.n || x.lemma)).trim(),part_of_speech:"noun",article:a.a,articles:a.articles||[],genderNote:a.note||"",plural_forms:a.p ? [a.p] : [],meaning:a.en || x.meaning,english_terms:a.en ? [{term:a.en,primary:true}] : []};
    else if (f) result = {id:x.key,lemma:f.lemma || x.lemma,display_form:f.lemma || x.display_form,part_of_speech:x.part_of_speech,meaning:f.gloss || x.meaning,english_terms:f.gloss ? [{term:f.gloss,primary:true}] : []};
    else {
      var ex = (c && c.examples || []).map(function (e) { return {sentence:e[0],translation_language:"en",translation:e[1] || ""}; });
      result = {id:x.key,lemma:c && c.id || x.lemma,display_form:c && c.id || x.display_form,part_of_speech:"verb",meaning:c && c.meaning || x.meaning,english_terms:c && c.meaning ? [{term:c.meaning,primary:true}] : [],german_examples:ex};
    }
    result.frequencyRank = x.frequencyRank || 0;
    result.frequencyGloss = x.frequencyGloss || "";
    result.frequencyPos = f && f.pos || "";
    result.allSources = sourceText(x);
    result.courseVerb = c || null;
    return result;
  }
  function renderUnifiedDetail(key) {
    var x = byKey[key]; if (!x) return;
    var r = baseRecord(x), word = displayWord(x), meanings = meaningsOf(x), examples = examplesOf(x);
    var html = '<div class="card detail"><div class="eyebrow">WORD DETAILS</div><div class="verb-row"><div><h2 lang="de">' + esc(word) + '</h2><div class="meaning">' + esc(x.meaning || "Meaning not available") + '</div></div></div>';
    if (x.article || x.plural || x.genderNote) html += '<div class="casebox"><b>Noun forms</b><br>' + (x.article ? "Article: " + esc(x.article) : "") + (x.article && x.plural ? " · " : "") + (x.plural ? "Plural: " + esc(x.plural) : "") + (x.genderNote ? "<br>" + esc(x.genderNote) : "") + "</div>";
    if (x.frequencyRank) html += '<div class="casebox"><b>Frequency reference</b><br>Wordly rank ' + x.frequencyRank + " of 5,000" + (x.frequencyGloss ? " · " + esc(x.frequencyGloss) : "") + "</div>";
    if (r.german_definition) html += '<h3>Meaning in German</h3><div class="example" lang="de">' + esc(r.german_definition) + "</div>";
    if (r.grammar_note) html += '<h3 lang="de">Grammatik</h3><div class="casebox" lang="de">' + esc(r.grammar_note) + "</div>";
    if (r.usage_note) html += '<h3>Usage tip</h3><div class="casebox">' + esc(r.usage_note) + "</div>";
    if (meanings.length) html += '<h3>English meanings</h3><div class="casebox">' + meanings.slice(0,8).map(esc).join(" · ") + "</div>";
    var course = x.courseVerb;
    if (course) {
      var notes = [];
      if (course.case) notes.push("Case: " + course.case);
      if (course.pattern) notes.push("Pattern: " + course.pattern);
      if (course.aux) notes.push("Auxiliary: " + course.aux);
      if (course.preterite) notes.push("Präteritum: " + course.preterite);
      if (course.perfect) notes.push("Perfekt: " + course.perfect);
      if (notes.length) html += '<h3>Verb pattern and forms</h3><div class="casebox">' + notes.map(esc).join("<br>") + "</div>";
      if (course.forms && typeof course.forms === "object") html += '<table class="table"><thead><tr><th>Person</th><th>Present</th></tr></thead><tbody>' + Object.keys(course.forms).map(function (person) { return "<tr><td>" + esc(person) + '</td><td lang="de">' + esc(course.forms[person]) + "</td></tr>"; }).join("") + "</tbody></table>";
      if (course.note || course.reflexive) html += '<div class="meta">' + esc([course.reflexive,course.note].filter(Boolean).join(" · ")) + "</div>";
    }
    html += "<h3>Examples in context</h3>";
    if (examples.length && window.renderExampleSet) html += window.renderExampleSet(examples,r);
    else html += '<div class="casebox">No reviewed example is available for this entry yet.</div>';
    if (r.domains && r.domains.length) html += '<div class="meta">Topics: ' + r.domains.map(esc).join(" · ") + "</div>";
    html += '<div class="meta">Sources: ' + esc(sourceText(x)) + "</div>";
    if (x.general) {
      var s = state(), isSaved = (s.generalSaved || []).indexOf(x.general.id) >= 0;
      html += '<div class="actions general-word-actions"><button class="btn secondary" type="button" aria-pressed="' + String(!!isSaved) + '" onclick="toggleUnifiedSaved(event,\'' + encodeURIComponent(x.general.id) + '\',\'' + encodeURIComponent(key) + '\')">' + (isSaved ? "★ Saved" : "☆ Save word") + '</button><button class="btn" type="button" onclick="startGeneralPractice(\'word\',decodeURIComponent(\'' + encodeURIComponent(x.general.id) + '\'))">Practice this word</button></div>';
    }
    html += '<div class="actions general-word-actions"><button class="btn secondary" type="button" aria-label="Listen to German pronunciation of ' + esc(word) + '" onclick="speak(decodeURIComponent(\'' + encodeURIComponent(word) + '\'))">🔊 Listen</button><button class="btn ghost" type="button" aria-label="Listen slowly to ' + esc(word) + '" onclick="speak(decodeURIComponent(\'' + encodeURIComponent(word) + '\'),true)">0.7× Slow</button></div></div>';
    if (window.clearLibraryDetail) window.clearLibraryDetail();
    if (window.setLibraryKind) window.setLibraryKind("detail");
    var root = document.getElementById("verbDetailContent"); if (root) root.innerHTML = html;
    var sharedListen = document.getElementById("detailListenActions"); if (sharedListen) sharedListen.classList.add("hidden");
    window.currentVocabDetail = {kind:"unified",id:key}; window.detailPronunciation = word;
  }
  window.renderGeneralLibrary = function (reset) {
    if (reset) limit = 60;
    var input = document.getElementById("generalLibrarySearch"), typeSelect = document.getElementById("generalWordType"), statusSelect = document.getElementById("generalCollectionFilter");
    var query = norm(input && input.value || ""), type = typeSelect && typeSelect.value || "all", status = statusSelect && statusSelect.value || "all", s = window.VW_APP_ACCESS && window.VW_APP_ACCESS.state || {};
    var matches = entries.filter(function (x) {
      if (!matchesType(x,type) || searchable(x).indexOf(query) < 0) return false;
      var id = x.general && x.general.id;
      if (status === "saved" && (!id || (s.generalSaved || []).indexOf(id) < 0)) return false;
      if (status === "due" && !isDue(x)) return false;
      return true;
    });
    var shown = matches.slice(0,limit), count = document.getElementById("generalLibraryCount");
    if (count) count.textContent = matches.length ? "Showing " + formatCount(shown.length) + " of " + formatCount(matches.length) + " words and phrases" : "No matching words or phrases.";
    var list = document.getElementById("generalLibraryList");
    if (list) list.innerHTML = shown.map(function (x) {
      var id = x.general && x.general.id, stateNow = window.VW_APP_ACCESS && window.VW_APP_ACCESS.state || {}, isSaved = id && (stateNow.generalSaved || []).indexOf(id) >= 0;
      var ex = examplesOf(x)[0], sentence = ex && (ex.sentence || ex.de) || "";
      var noun = x.article ? "Article: " + x.article : (x.genderNote || "");
      if (x.plural) noun += (noun ? " · " : "") + "Plural: " + x.plural;
      var typeInfo = ({noun:"Noun",verb:"Verb",adjective:"Adjective",adverb:"Adverb",conjunction:"Conjunction",preposition:"Preposition",pronoun:"Pronoun",determiner:"Determiner",numeral:"Numeral",particle:"Particle",interjection:"Interjection",chunk:"Expression",other:"Other"})[pos(x.part_of_speech)] || pos(x.part_of_speech);
      var encoded = encodeURIComponent(x.key), actions = '<div class="actions general-word-actions"><button class="btn secondary" type="button" aria-label="Listen to German pronunciation of ' + esc(x.display_form) + '" onclick="speak(decodeURIComponent(\'' + encodeURIComponent(x.display_form) + '\'))">🔊 Listen</button>';
      if (id) actions += '<button class="btn ghost" type="button" aria-pressed="' + String(!!isSaved) + '" onclick="toggleUnifiedSaved(event,\'' + encodeURIComponent(id) + '\',\'' + encoded + '\')">' + (isSaved ? "★ Saved" : "☆ Save") + "</button>";
      return '<article class="card word-card" data-detail-kind="unified" data-detail-id="' + encoded + '"><div class="verb-row"><div><span class="word-link" lang="de">' + esc(displayWord(x)) + ' <span aria-hidden="true">&#8594;</span></span><div class="meaning">' + esc(x.meaning || "Meaning not available") + "</div></div></div>" +
        (noun ? '<div class="meta">' + esc(noun) + "</div>" : "") + (sentence ? '<div class="small" lang="de">' + esc(sentence) + "</div>" : "") +
        '<div class="meta">' + esc(typeInfo) + "</div>" + actions + "</article>";
    }).join("") || '<div class="empty">No matching entries found.</div>';
    var more = document.getElementById("generalShowMore"); if (more) more.classList.toggle("hidden",shown.length >= matches.length);
  };
  window.showMoreGeneral = function () { limit += 60; window.renderGeneralLibrary(); };
  window.toggleUnifiedSaved = function (event, encodedId, encodedKey) {
    if (event) event.stopPropagation();
    if (window.toggleGeneralSaved) window.toggleGeneralSaved(null,encodedId);
    window.renderVocabularyDetail("unified",decodeURIComponent(encodedKey || ""));
  };
  window.openVocabularyDetail = function (kind,id) {
    if (kind !== "unified") return originalOpen && originalOpen(kind,id);
    id = String(id || ""); if (!byKey[id]) return;
    window.vwNav("library",null,true,{view:"vocabularyDetail",entryKind:"unified",entryId:id});
    renderUnifiedDetail(id); window.scrollTo(0,0);
  };
  window.renderVocabularyDetail = function (kind,id) {
    if (kind !== "unified") return originalRender && originalRender(kind,id);
    renderUnifiedDetail(String(id || ""));
  };
  var verbRows=entries.filter(function (x) { return pos(x.part_of_speech)==="verb"; });
  window.VW_UNIFIED_VERB_ENTRIES=verbRows;
  if (typeof window.configureExpandedVerbLessons === "function") window.configureExpandedVerbLessons(verbRows);
  var verbFilter="All",verbMatches=[],verbRendered=0,verbBatchSize=60;
  var originalSetFilter=window.setFilter;
  if (typeof originalSetFilter==="function") window.setFilter=function (value,button) { verbFilter=value||"All"; return originalSetFilter(value,button); };
  function needsVerbPractice(x) {
    var s=state(),courseId=x.courseVerb&&x.courseVerb.id,generalId=savedId(x);
    if (courseId&&Number(s.weak&&s.weak[courseId]||0)>0) return true;
    if (!generalId) return false;
    var progress=s.generalWordProgress&&s.generalWordProgress[generalId];
    return Number(s.generalWeak&&s.generalWeak[generalId]||0)>0 || !!(progress&&progress.status!=="mastered"&&Number(progress.dueAt||0)>0&&Number(progress.dueAt||0)<=Date.now());
  }
  function verbCard(x) {
    var word=displayWord(x),course=x.courseVerb,pattern=course&&(course.pattern||course.case)||"",encoded=encodeURIComponent(x.key);
    return '<article class="card word-card" data-detail-kind="unified" data-detail-id="'+encoded+'"><div class="verb-row"><div><span class="word-link" lang="de">'+esc(word)+' <span aria-hidden="true">&#8594;</span></span><div class="meaning">'+esc(x.meaning||"Meaning not available")+'</div></div></div>'+(pattern?'<div class="meta">'+esc(pattern)+'</div>':'')+window.pronunciationButtons(word)+'</article>';
  }
  function appendVerbBatch() {
    var root=document.getElementById("libraryList"),batch=verbMatches.slice(verbRendered,verbRendered+verbBatchSize);
    if(root&&batch.length)root.insertAdjacentHTML("beforeend",batch.map(verbCard).join(""));
    verbRendered+=batch.length;
    var count=document.getElementById("libraryCount"),more=document.getElementById("verbLibraryShowMore");
    if(count)count.textContent=verbMatches.length?"Showing "+formatCount(verbRendered)+" of "+formatCount(verbMatches.length)+" verbs":"No matching verbs";
    if(more)more.classList.toggle("hidden",verbRendered>=verbMatches.length);
  }
  window.showMoreVerbs=appendVerbBatch;
  window.renderLibrary=function () {
    var input=document.getElementById("search"),query=norm(input&&input.value||""),root=document.getElementById("libraryList");
    verbMatches=verbRows.filter(function (x) { return searchable(x).indexOf(query)>=0&&(verbFilter!=="Weak"||needsVerbPractice(x)); });
    verbRendered=0;if(root)root.replaceChildren();appendVerbBatch();
  };
  var countNode=document.getElementById("verbCollectionCount");
  if(countNode)countNode.textContent=formatCount(verbRows.length);
  populateFilters();
  window.renderGeneralLibrary(true);
})();