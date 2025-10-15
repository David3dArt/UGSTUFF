/* Fixed script: ensures options always render on first load even with MathJax */
let questions = [];
let currentQuestion = 0;
let score = 0;
let answered = false;
let allQuestionsGlobal = [];
let usedQuestions = [];
let batchSize = 10;
let isLightMode = false;

/* Cookies for mode (unchanged) */
function setCookie(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + (days*24*60*60*1000));
  document.cookie = name + "=" + value + ";expires=" + d.toUTCString() + ";path=/;SameSite=Lax";
}
function getCookie(name) {
  const n = name + "=";
  const ca = document.cookie.split(';');
  for(let c of ca) { c = c.trim(); if (c.indexOf(n) === 0) return c.substring(n.length, c.length); }
  return "";
}
function applySavedMode() {
  const saved = getCookie("quizMode");
  if (saved === "light") {
    isLightMode = true;
    document.body.classList.add("light");
    const ms = document.getElementById("mode-switch");
    if(ms) ms.textContent = "🌑";
  }
}
applySavedMode();

function toggleMode() {
  const modeSwitch = document.getElementById("mode-switch");
  isLightMode = !isLightMode;
  if (isLightMode) {
    document.body.classList.add("light");
    if(modeSwitch) modeSwitch.textContent = "🌑";
    setCookie("quizMode", "light", 365);
  } else {
    document.body.classList.remove("light");
    if(modeSwitch) modeSwitch.textContent = "☀️";
    setCookie("quizMode", "dark", 365);
  }
}

function shuffle(array){return array.sort(()=>Math.random()-0.5);}
function getNextBatch(){
  let remaining=allQuestionsGlobal.filter(q=>!usedQuestions.includes(q));
  if(remaining.length===0)return[];
  let shuffled=shuffle([...remaining]);
  let batch=shuffled.slice(0,batchSize);
  usedQuestions.push(...batch);
  return batch;
}
function updateProgressBar(){
  let percent=((currentQuestion)/questions.length)*100;
  const bar = document.getElementById("progress-bar");
  if(bar) bar.style.width=percent+"%";
}

/* CLICK LAYER (unchanged) */
let clickLayer=document.createElement("div");
clickLayer.style.position="absolute";
clickLayer.style.top=0;
clickLayer.style.left=0;
clickLayer.style.width="100%";
clickLayer.style.height="100%";
clickLayer.style.zIndex=500;
clickLayer.style.cursor="pointer";
clickLayer.style.display="none";
clickLayer.style.backgroundColor="rgba(0,0,0,0)";
const quizContainerEl = document.getElementById("quiz-container");
if(quizContainerEl) quizContainerEl.appendChild(clickLayer);
clickLayer.addEventListener("click",()=>{clickLayer.style.display="none";currentQuestion++;loadQuestion();});

/* ASYNC renderText that WAITs MathJax (safe if no MathJax) */
async function renderText(text, container){
  // ensure container is hidden while rendering to avoid flicker
  container.style.visibility = "hidden";
  if(text.includes("$$")){
    // convert $$...$$ to inline spans for MathJax
    container.innerHTML = text.replace(/\$\$(.*?)\$\$/g, (_,expr) => `<span class="latex">\\(${expr}\\)</span>`);
    container.classList.add("has-math");
    container.style.padding = "20px 0";
    // Wait for MathJax to be ready + typeset container
    try {
      if (window.MathJax) {
        if (MathJax.startup && MathJax.startup.promise) {
          await MathJax.startup.promise;
        }
        if (MathJax.typesetPromise) {
          await MathJax.typesetPromise([container]);
        }
      }
    } catch(e){
      // if MathJax fails, still continue
      console.warn("MathJax render error:", e);
    }
    container.style.visibility = "visible";
  } else {
    container.textContent = text;
    container.classList.remove("has-math");
    container.style.padding = "10px 0";
    container.style.visibility = "visible";
  }
}

/* loadQuestion now AWAITS renderText for question + every option */
async function loadQuestion(skipAnimation=false){
  const quizContainer=document.getElementById("quiz-container");
  if(!quizContainer) return;
  if(!skipAnimation) quizContainer.classList.add("fade-out");
  setTimeout(async ()=>{
    if(!skipAnimation) quizContainer.classList.remove("fade-out");
    updateProgressBar();
    answered=false;
    clickLayer.style.display="none";

    const qCount = (questions && questions.length) || 0;
    if(currentQuestion < qCount){
      let q = questions[currentQuestion];
      const questionContainer = document.getElementById("question");
      questionContainer.innerHTML = "";
      const h2 = document.createElement("h2");
      questionContainer.appendChild(h2);

      // render question and await MathJax if present
      await renderText(q.question, h2);

      const optionsContainer = document.getElementById("options");
      optionsContainer.innerHTML = "";
      // hide options container until all options are fully rendered
      optionsContainer.style.visibility = "hidden";

      let shortOptions = q.options.every(opt => opt.trim().split(/\s+/).length < 3);
      if(q.type === "1" && shortOptions){
        optionsContainer.style.display = "grid";
        optionsContainer.style.gridTemplateColumns = "1fr 1fr";
        optionsContainer.style.columnGap = "15px";
        optionsContainer.style.rowGap = "12px";
      } else {
        optionsContainer.style.display = "block";
      }

      // render options one-by-one and await MathJax for each
      for (let opt of q.options) {
        const div = document.createElement("div");
        div.className = "option";
        div.dataset.answer = opt;
        optionsContainer.appendChild(div);
        await renderText(opt, div); // await ensures proper layout when math exists
        // attach click handler after rendering to avoid race
        div.addEventListener("click", ()=> checkAnswer(div, div.dataset.answer, q.correct));
      }

      // skip button (render text without MathJax)
      const skipDiv = document.createElement("div");
      skipDiv.className = "option skip";
      skipDiv.textContent = "გამოტოვება";
      skipDiv.addEventListener("click", ()=>{
        answered = true;
        document.querySelectorAll(".option").forEach(opt=>{
          if(opt.dataset.answer === q.correct) opt.classList.add("correct");
          opt.style.pointerEvents = "none";
        });
        clickLayer.style.display = "block";
      });
      optionsContainer.appendChild(skipDiv);

      // final typeset for options container if MathJax exists (extra safety)
      try {
        if(window.MathJax && MathJax.typesetPromise){
          await MathJax.typesetPromise([optionsContainer]);
        }
      } catch(e){ console.warn("MathJax final typeset error:", e); }

      // now show options container
      optionsContainer.style.visibility = "visible";

      if(!skipAnimation){
        quizContainer.classList.add("fade-in");
        setTimeout(()=>quizContainer.classList.remove("fade-in"),200);
      }

    } else {
      // quiz finished
      document.getElementById("question").innerHTML = "";
      document.getElementById("options").innerHTML = "";
      document.getElementById("result").innerHTML = `ქვიზი დასრულდა, თქვენ დააგროვეთ ${score} სწორი პასუხი.`;
      let nextBatch = getNextBatch();
      if(nextBatch.length > 0){
        document.getElementById("result").innerHTML += "<br>დააჭირეთ 'თავიდან დაწყებას' ახლიდან დასაწყებად.";
      }
      document.getElementById("restart").style.display = "inline-block";
    }
  }, skipAnimation ? 0 : 200);
}

function checkAnswer(element, answer, correct){
  if(answered) return;
  answered = true;
  if(answer === correct){
    element.classList.add("correct");
    score++;
  } else {
    element.classList.add("wrong");
    document.querySelectorAll(".option").forEach(opt => {
      if(opt.dataset.answer === correct) opt.classList.add("correct");
    });
  }
  document.querySelectorAll(".option").forEach(opt => opt.style.pointerEvents = "none");
  setTimeout(()=>{ clickLayer.style.display = "block"; }, 200);
}

function restartQuiz(){
  if(allQuestionsGlobal.length === 0) return;
  usedQuestions = [];
  questions = getNextBatch();
  currentQuestion = 0;
  score = 0;
  answered = false;
  const res = document.getElementById("result");
  if(res) res.innerHTML = "";
  const rstBtn = document.getElementById("restart");
  if(rstBtn) rstBtn.style.display = "none";
  loadQuestion(true);
}

/* reset button handler (top right) */
function resetQuiz(){
  restartQuiz();
}

/* deleteCsv kept but not used as requested */
function deleteCsv(){
  questions=[];currentQuestion=0;score=0;answered=false;usedQuestions=[];allQuestionsGlobal=[];
  const res = document.getElementById("result"); if(res) res.innerHTML="";
  const qEl = document.getElementById("question"); if(qEl) qEl.innerHTML="";
  const optEl = document.getElementById("options"); if(optEl) optEl.innerHTML="";
  const rest = document.getElementById("restart"); if(rest) rest.style.display="none";
  const pb = document.getElementById("progress-bar"); if(pb) pb.style.width="0%";
  const closeBtn = document.getElementById("close-btn"); if(closeBtn) closeBtn.style.display="none";
}

/* CSV PARSING (unchanged) */
function parseCSV(text){
  let rows = text.trim().split(/\r?\n/).map(r=>r.split(",").map(x=>x.trim()));
  rows.shift();
  return shuffle(rows.map(r=>{
    let options=[r[1],r[2],r[3],r[4]];
    return { question:r[0], options: shuffle([...options]), correct: r[1], type: r[5]||"" };
  }));
}

/* AUTO START: wait for DOM + MathJax startup (if present) */
window.addEventListener("DOMContentLoaded", async ()=>{
  // if MathJax isn't done loading yet, wait for its startup promise
  try {
    if(window.MathJax && MathJax.startup && MathJax.startup.promise){
      await MathJax.startup.promise;
    }
  } catch(e){
    console.warn("MathJax startup wait failed:", e);
  }

  const csvScript = document.getElementById("csv-data");
  const csvText = csvScript ? csvScript.textContent.trim() : "";
  if(csvText){
    allQuestionsGlobal = parseCSV(csvText);
    usedQuestions = [];
    questions = getNextBatch();

    const closeBtn = document.getElementById("close-btn");
    if(closeBtn){
      closeBtn.style.display = "block";
      closeBtn.textContent = "🔄";
      closeBtn.onclick = resetQuiz;
    }
    // ensure elements exist and start: WAIT a tick so layout is stable, then load
    setTimeout(()=>{ loadQuestion(true); }, 20);
  }
});