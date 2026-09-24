
    const moods={warm:{label:'Warm & grounded',summary:'A warm, steady rhythm, grounded in the movement around this stop.',notes:[196,247,294],tempo:1.0},bright:{label:'Bright & moving',summary:'A bright pulse with a little momentum for the journey ahead.',notes:[220,277,330],tempo:1.35},calm:{label:'Calm & spacious',summary:'An open, unhurried sound with space between each note.',notes:[174,220,261],tempo:.72},playful:{label:'Playful & curious',summary:'A curious, skipping rhythm with unexpected little turns.',notes:[220,330,392],tempo:1.5}};
    let choices=[],activeMoodKey='warm',selected=null,etaSeconds=10*60,maxEta=10*60,playing=false,audioContext=null,nodes=[],loopTimer=null,beat=0,toastTimer=null;
    const $=id=>document.getElementById(id), overlay=$('overlay');
    const timerCanvas=$('timerSurface'), timerContext=timerCanvas.getContext('2d');
    let timerSize=0, timerDpr=1;
    function timerColor(position){
      const stops=[[74,211,151],[225,225,96],[255,173,60],[249,66,53]];
      const p=Math.max(0,Math.min(1,position))*3, i=Math.min(2,Math.floor(p)), t=p-i;
      return `rgb(${stops[i].map((v,k)=>Math.round(v+(stops[i+1][k]-v)*t)).join(',')})`;
    }
    function drawTimer(progress){
      if(!timerSize||!timerContext)return;
      const c=timerContext,s=timerSize,r=s*.335,cx=s/2,cy=s/2,start=-Math.PI/2;
      const span=Math.PI*1.9*progress,width=Math.max(2,s*.009);
      c.setTransform(timerDpr,0,0,timerDpr,0,0);c.clearRect(0,0,s,s);
      const segments=Math.ceil(span*r/1.4);
      for(let i=0;i<segments;i++){
        const t=i/segments,next=(i+1)/segments,color=timerColor(progress*t);
        c.beginPath();c.arc(cx,cy,r,start+t*span,start+next*span+.002);
        c.strokeStyle=color;c.lineWidth=width;c.lineCap='butt';c.shadowColor=color;c.shadowBlur=width*1.7;c.stroke();
      }
      c.shadowBlur=0;
      if(progress>0){const end=start+span;c.beginPath();c.arc(cx+r*Math.cos(end),cy+r*Math.sin(end),width/2,0,Math.PI*2);c.fillStyle=timerColor(progress);c.fill()}
      // A small side-view bus marks the beginning of the growing line.
      const bx=cx,by=cy-r,color=timerColor(0);
      c.save();c.translate(bx,by);c.scale(s/450,s/450);
      c.shadowColor=color;c.shadowBlur=5;c.fillStyle=color;
      c.beginPath();c.roundRect(-11,-6,22,11,2.5);c.fill();c.shadowBlur=0;
      c.fillStyle='#14201c';c.beginPath();c.roundRect(-8,-4,13,5,1);c.fill();
      c.fillRect(7,-3,2,5);
      [-6,7].forEach(x=>{c.beginPath();c.arc(x,6,2.4,0,Math.PI*2);c.fillStyle='#101212';c.fill();c.beginPath();c.arc(x,6,.8,0,Math.PI*2);c.fillStyle=color;c.fill()});
      c.restore();
    }
    function sizeTimer(){timerSize=$('recordWrap').clientWidth;timerDpr=Math.min(window.devicePixelRatio||1,3);timerCanvas.width=Math.round(timerSize*timerDpr);timerCanvas.height=Math.round(timerSize*timerDpr);drawTimer(Math.max(0,Math.min(1,1-etaSeconds/maxEta)))}
    new ResizeObserver(sizeTimer).observe($('recordWrap'));
    function winningMoodKey(){const counts={warm:0,bright:0,calm:0,playful:0};choices.forEach(x=>counts[x]++);return Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0]}
    function updateArrival(){
      const minutes=Math.ceil(etaSeconds/60);
      $('eta').textContent=etaSeconds<=0?'NOW':String(minutes).padStart(2,'0');
      $('etaUnit').textContent=etaSeconds<=0?'arriving':'min away';
      const progress=Math.max(0,Math.min(1,1-etaSeconds/maxEta));
      drawTimer(progress);
      $('timerSurface').setAttribute('aria-label',etaSeconds<=0?'Bus arriving now':`${minutes} minutes until bus arrival`);
    }
    function updateCommunity(){const n=choices.length;$('panelProgress').innerHTML=`<strong>${n} of 3</strong> choices for the next mix`}
    function showToast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500)}
    function openPanel(){overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');resetSelection();$('openPrompt').setAttribute('aria-expanded','true');$('closePrompt').focus()}
    function closePanel(){overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true');$('openPrompt').setAttribute('aria-expanded','false');$('openPrompt').focus()}
    function resetSelection(){selected=null;document.querySelectorAll('.choice').forEach(b=>b.setAttribute('aria-pressed','false'));$('submitMood').disabled=true}
    function commit(){if(!selected)return;choices.push(selected);const didUpdate=choices.length>=3;if(didUpdate){activeMoodKey=winningMoodKey();choices=[];if(playing)restartAudio()}updateCommunity();resetSelection();closePanel();showToast(didUpdate?'New shared soundscape ready':'Your feeling was added')}
    function buildAudio(){audioContext=new (window.AudioContext||window.webkitAudioContext)();const master=audioContext.createGain();master.gain.value=.11;master.connect(audioContext.destination);const mood=moods[activeMoodKey];const frequencies=mood.notes;frequencies.forEach((freq,i)=>{const osc=audioContext.createOscillator();const gain=audioContext.createGain();osc.type=i===0?'sine':'triangle';osc.frequency.value=freq;gain.gain.value=0;osc.connect(gain);gain.connect(master);osc.start();nodes.push({osc,gain})});const interval=620/mood.tempo;function pulse(){if(!audioContext)return;const t=audioContext.currentTime;const index=beat%nodes.length;nodes.forEach((node,i)=>{node.gain.gain.cancelScheduledValues(t);node.gain.gain.setTargetAtTime(i===index?.28:.045,t,.08)});beat++}pulse();loopTimer=setInterval(pulse,interval);const lowpass=audioContext.createBiquadFilter();lowpass.type='lowpass';lowpass.frequency.value=900;master.disconnect();master.connect(lowpass);lowpass.connect(audioContext.destination)}
    function stopAudio(){clearInterval(loopTimer);loopTimer=null;for(const n of nodes){try{n.osc.stop()}catch(e){}}nodes=[];if(audioContext){audioContext.close();audioContext=null}playing=false;$('soundBtn').dataset.playing='false';$('soundBtn').setAttribute('aria-pressed','false');$('soundBtn').setAttribute('aria-label','Play soundscape');$('soundBtn').querySelector('.text').textContent='Listen'}
    function startAudio(){try{buildAudio();playing=true;$('soundBtn').dataset.playing='true';$('soundBtn').setAttribute('aria-pressed','true');$('soundBtn').setAttribute('aria-label','Pause soundscape');$('soundBtn').querySelector('.text').textContent='Pause sound';showToast('Sound on · use Listen to pause')}catch(e){showToast('Audio is unavailable in this browser')}}
    function restartAudio(){stopAudio();startAudio()}
    $('soundBtn').addEventListener('click',()=>playing?stopAudio():startAudio());$('openPrompt').addEventListener('click',openPanel);$('closePrompt').addEventListener('click',closePanel);overlay.addEventListener('click',e=>{if(e.target===overlay)closePanel()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.classList.contains('open'))closePanel()});
    document.querySelectorAll('.choice').forEach(button=>button.addEventListener('click',()=>{selected=button.dataset.mood;document.querySelectorAll('.choice').forEach(b=>b.setAttribute('aria-pressed',b===button?'true':'false'));$('submitMood').disabled=false}));$('submitMood').addEventListener('click',commit);
    let arrivalAt=Date.now()+maxEta*1000,resetAt=0;
    let lastTimerFrame=0;
    function tickArrival(timestamp=0){
      if(timestamp-lastTimerFrame>=100||timestamp===0){
        lastTimerFrame=timestamp;
        const now=Date.now();etaSeconds=Math.max(0,(arrivalAt-now)/1000);
        if(etaSeconds===0){if(!resetAt)resetAt=now+2500;if(now>=resetAt){arrivalAt=now+maxEta*1000;etaSeconds=maxEta;resetAt=0}}
        updateArrival();
      }
      requestAnimationFrame(tickArrival);
    }
    sizeTimer();tickArrival();updateCommunity();
  
