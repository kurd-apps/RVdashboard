// ================= GITHUB OAUTH SETTINGS ================= //
const OAUTH_CLIENT_ID = "Ov23licUZNUibVnGmgD4"; 
const OAUTH_CLIENT_SECRET = "bb6529ce89578246b7cf72ff454b994f5800f07e"; 
const ALLOWED_USERNAME = "kurd-apps"; 
const TARGET_REPO = "RV"; 
// ========================================================= //

let ghData = null; let fileSha = ''; let siteData = {};
let galleryCache = null; let currentGalleryTarget = ''; 

// کلیلێکی دیفۆڵت
const DEFAULT_AI_KEY = "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";

window.onload = async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
        document.getElementById('firstTimeSetup').classList.remove('hidden');
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('btnLogin').innerHTML = "سەلماندنی هەژمار... ⏳";
        await handleOAuthCallback(code);
    } else if (!localStorage.getItem('encrypted_gh')) { 
        document.getElementById('firstTimeSetup').classList.remove('hidden'); 
    } else {
        startLoginProcess(); 
    }
};

function resetLogin() { localStorage.removeItem('encrypted_gh'); location.reload(); }
function showLoginError(msg) { const errBox = document.getElementById('loginError'); errBox.innerText = msg; errBox.classList.remove('hidden'); document.getElementById('btnLogin').innerHTML = "چوونەژوورەوە بە گیتهەب <i class='fa-brands fa-github mr-2'></i>"; }

// --- وەرگێڕانی زیرەک (هەردوو ئاڕاستەکە) ---
function saveAiKey() {
    const key = document.getElementById('aiApiKey').value.trim();
    if(key) { localStorage.setItem('ai_api_key', key); showMsg('کلیلەکە سەیڤ کرا ✅'); }
}

async function autoTranslate(sourceId, targetId, isRichText = false, direction = 'ku-en') {
    const sourceEl = document.getElementById(sourceId);
    const targetEl = document.getElementById(targetId);
    if(!sourceEl || !targetEl) return;

    let sourceText = isRichText ? sourceEl.innerHTML : sourceEl.value;
    if(!sourceText.trim()) return alert('سەرەتا بەشە سەرەکییەکە پڕبکەرەوە!');

    const originalHtml = isRichText ? targetEl.innerHTML : targetEl.value;
    if(isRichText) targetEl.innerHTML = "⏳ لە وەرگێڕاندایە...";
    else targetEl.value = "⏳ لە وەرگێڕاندایە...";

    try {
        let apiKey = localStorage.getItem('ai_api_key') || DEFAULT_AI_KEY;

        // دیاریکردنی پرۆمپت بەپێی ئاڕاستەی وەرگێڕانەکە
        let promptMsg = "";
        if (direction === 'en-ku') {
            promptMsg = isRichText 
                ? `Translate the following English HTML content to Central Kurdish (Sorani). Maintain all HTML tags exactly as they are. Return ONLY the raw translated HTML. Text:\n\n${sourceText}`
                : `Translate the following English text to Central Kurdish (Sorani). Return ONLY the translation, without any extra text or quotes. Text:\n\n${sourceText}`;
        } else {
            promptMsg = isRichText 
                ? `Translate the following Kurdish HTML content to English. Maintain all HTML tags exactly as they are. Return ONLY the raw translated HTML. Text:\n\n${sourceText}`
                : `Translate the following Kurdish text to English. Return ONLY the translation, without any extra text or quotes. Text:\n\n${sourceText}`;
        }

        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": window.location.origin, // زۆر گرینگە بۆ نەهێشتنی ئیرۆر
                "X-Title": "RV Dashboard Translation" // زۆر گرینگە بۆ نەهێشتنی ئیرۆر
            },
            body: JSON.stringify({
                "model": "google/gemini-2.5-flash", 
                "messages": [
                    {"role": "user", "content": promptMsg}
                ]
            })
        });

        if(!res.ok) {
            const err = await res.text();
            console.error(err);
            throw new Error("API Request Failed");
        }

        const data = await res.json();
        let translated = data.choices[0].message.content.trim();

        if(translated.startsWith('```html')) translated = translated.replace(/^```html\n?/, '').replace(/\n?```$/, '');
        else if(translated.startsWith('```')) translated = translated.replace(/^```\n?/, '').replace(/\n?```$/, '');

        if(isRichText) targetEl.innerHTML = translated;
        else targetEl.value = translated;
        showMsg('✨ وەرگێڕانەکە سەرکەوتوو بوو!');
    } catch(e) {
        console.error(e);
        if(isRichText) targetEl.innerHTML = originalHtml; else targetEl.value = originalHtml;
        alert('وەرگێڕان شکستی هێنا. دڵنیابە هێڵی ئینتەرنێتت هەیە، یان کلیلەکەی OpenRouter پارەی تێدا ماوە.');
    }
}

// --- OAuth Logic ---
async function startLoginProcess() {
    document.getElementById('loginError').classList.add('hidden');
    const stored = localStorage.getItem('encrypted_gh');
    const btn = document.getElementById('btnLogin');
    
    if (stored) {
        btn.innerHTML = "لە پەیوەندیکردندایە... ⏳";
        try {
            const decodedString = decodeURIComponent(escape(atob(stored)));
            ghData = JSON.parse(decodedString);
            await testAndFetchData(false);
        } catch (e) { showLoginError('داتاکانی ناو براوسەر کێشەیان هەیە.'); }
    } else {
        if (OAUTH_CLIENT_ID === "YOUR_GITHUB_OAUTH_CLIENT_ID") {
            showLoginError("پێویستە Client ID بنووسیت لەناو فایلەکەدا پێش بەکارهێنان!");
            return;
        }
        btn.innerHTML = "بەستنەوە... ⏳";
        const redirectUri = window.location.origin + window.location.pathname;
        window.location.href = `https://github.com/login/oauth/authorize?client_id=${OAUTH_CLIENT_ID}&scope=repo,user&redirect_uri=${encodeURIComponent(redirectUri)}`;
    }
}

async function handleOAuthCallback(code) {
    try {
        const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent("https://github.com/login/oauth/access_token");
        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: OAUTH_CLIENT_ID, client_secret: OAUTH_CLIENT_SECRET, code: code })
        });

        if (!response.ok) throw new Error("کێشە لە وەرگرتنی تۆکنی چوونەژوورەوە هەیە");
        const data = await response.json();
        if (data.error) throw new Error(data.error_description || "هەڵەی OAuth");

        const accessToken = data.access_token;
        const userRes = await fetch('https://api.github.com/user', { headers: { 'Authorization': `token ${accessToken}` } });
        
        if (!userRes.ok) throw new Error("کێشە لە سەلماندنی هەژمارەکەدا هەیە");
        const userData = await userRes.json();
        const username = userData.login;

        if (username.toLowerCase() !== ALLOWED_USERNAME.toLowerCase()) {
            throw new Error(`ببورە! هەژماری "${username}" ڕێگەپێدراو نییە.`);
        }

        ghData = { user: username, repo: TARGET_REPO, token: accessToken };
        await testAndFetchData(true);
        window.history.replaceState({}, document.title, window.location.pathname);

    } catch (error) {
        showLoginError(error.message);
        document.getElementById('btnLogin').innerHTML = "دووبارە چوونەژوورەوە";
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

async function testAndFetchData(shouldSave = false) {
    try {
        const res = await fetch(`https://api.github.com/repos/${ghData.user}/${ghData.repo}/contents/data.json?t=${Date.now()}`, { headers: { 'Authorization': `token ${ghData.token}` } });
        if (res.ok) {
            const data = await res.json(); fileSha = data.sha;
            siteData = JSON.parse(decodeURIComponent(escape(atob(data.content))));
            
            if (shouldSave) localStorage.setItem('encrypted_gh', btoa(unescape(encodeURIComponent(JSON.stringify(ghData))))); 
            
            if(!siteData.categories) siteData.categories = ["وێب دیزاین", "مۆنتاژی ڤیدیۆ", "گرافیک دیزاین"];
            if(!siteData.sections.businesses) siteData.sections.businesses = [];
            
            document.getElementById('loginScreen').classList.add('hidden');
            populateForms(); 
            showMsg('✅ بەستنەوە سەرکەوتوو بوو!');
        } else { resetLogin(); }
    } catch(e) { showLoginError('کێشە هەیە لە هێڵی ئینتەرنێتەکەت.'); }
}

function getFullImageUrl(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url.includes('github.com') ? url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/') : url;
    return `https://raw.githubusercontent.com/${ghData.user}/${ghData.repo}/main/${url}`;
}

function switchTab(tabId) { 
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active')); 
    document.getElementById('tab-' + tabId).classList.add('active'); 
}
function showMsg(text) { const m = document.getElementById('statusMsg'); m.innerHTML = text; m.classList.remove('hidden'); m.classList.add('translate-y-4'); setTimeout(() => { m.classList.add('hidden'); m.classList.remove('translate-y-4'); }, 3000); }
function updateImagePos() { const x = document.getElementById('heroPosX').value; const y = document.getElementById('heroPosY').value; document.getElementById('profilePreview').style.objectPosition = `${x}% ${y}%`; }

function populateForms() {
    const s = siteData.sections;
    const aiKey = localStorage.getItem('ai_api_key');
    if(aiKey) document.getElementById('aiApiKey').value = aiKey;

    if(s.hero) {
        document.getElementById('profilePreview').src = getFullImageUrl(s.hero.image);
        if(s.hero.imagePos) { document.getElementById('heroPosX').value = s.hero.imagePos.x || 50; document.getElementById('heroPosY').value = s.hero.imagePos.y || 50; updateImagePos(); }
        document.getElementById('h-name-ku').value = s.hero.name?.ku||''; document.getElementById('h-name-en').value = s.hero.name?.en||'';
        document.getElementById('h-title-ku').value = s.hero.title?.ku||''; document.getElementById('h-title-en').value = s.hero.title?.en||'';
    }
    if(s.about) {
        document.getElementById('a-desc-ku').value = s.about.desc?.ku||''; document.getElementById('a-desc-en').value = s.about.desc?.en||'';
    }
    
    document.getElementById('businessContainer').innerHTML = ''; 
    if(s.businesses) s.businesses.forEach((b, i) => buildBusiness(b, i));

    document.getElementById('cvContainer').innerHTML = ''; if(s.cv?.items) s.cv.items.forEach(c => buildCv(c));
    document.getElementById('skillsContainer').innerHTML = ''; if(s.skills?.list) s.skills.list.forEach(sk => buildSkill(sk));

    if(s.contact) { 
        document.getElementById('c-email').value = s.contact.email||''; document.getElementById('c-phone').value = s.contact.phone||''; 
        document.getElementById('c-addr-ku').value = s.contact.address?.ku||''; document.getElementById('c-addr-en').value = s.contact.address?.en||''; 
        document.getElementById('s-fb').value = s.contact.socials?.facebook || ''; document.getElementById('s-ig').value = s.contact.socials?.instagram || '';
        document.getElementById('s-yt').value = s.contact.socials?.youtube || ''; document.getElementById('s-be').value = s.contact.socials?.behance || '';
    }
    renderProjectsGrid();
}

function buildBusiness(b, index) {
    const uid = Date.now() + Math.random().toString(36).substr(2, 5);
    const div = document.createElement('div'); div.className = "b-item bg-slate-50 p-5 rounded-2xl border border-slate-200 relative mb-4";
    div.innerHTML = `
        <button onclick="this.parentElement.remove()" class="absolute top-3 left-3 text-red-500 hover:text-white hover:bg-red-500 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"><i class="fa-solid fa-trash"></i></button>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            <div><label class="text-[10px] font-bold text-slate-400 mb-1 flex justify-between"><span>ناوی بزنس (کوردی)</span><button onclick="autoTranslate('b-t-en-${uid}', 'b-t-ku-${uid}', false, 'en-ku')" class="text-amber-500"><i class="fa-solid fa-language"></i></button></label><input type="text" id="b-t-ku-${uid}" class="b-t-ku w-full border border-slate-200 p-2.5 rounded-xl text-sm" value="${b.heading?.ku||''}"></div>
            <div><label class="text-[10px] font-bold text-slate-400 mb-1 flex justify-between"><span>Name (EN)</span><button onclick="autoTranslate('b-t-ku-${uid}', 'b-t-en-${uid}', false, 'ku-en')" class="text-amber-500"><i class="fa-solid fa-wand-magic-sparkles"></i></button></label><input type="text" id="b-t-en-${uid}" class="b-t-en w-full border border-slate-200 p-2.5 rounded-xl text-sm" dir="ltr" value="${b.heading?.en||''}"></div>
            <div><label class="text-[10px] font-bold text-slate-400 mb-1 flex justify-between"><span>دەربارە (کوردی)</span><button onclick="autoTranslate('b-d-en-${uid}', 'b-d-ku-${uid}', false, 'en-ku')" class="text-amber-500"><i class="fa-solid fa-language"></i></button></label><textarea id="b-d-ku-${uid}" class="b-d-ku w-full border border-slate-200 p-3 rounded-xl h-20 text-sm resize-none">${b.desc?.ku||''}</textarea></div>
            <div><label class="text-[10px] font-bold text-slate-400 mb-1 flex justify-between"><span>About (EN)</span><button onclick="autoTranslate('b-d-ku-${uid}', 'b-d-en-${uid}', false, 'ku-en')" class="text-amber-500"><i class="fa-solid fa-wand-magic-sparkles"></i></button></label><textarea id="b-d-en-${uid}" class="b-d-en w-full border border-slate-200 p-3 rounded-xl h-20 text-sm resize-none" dir="ltr">${b.desc?.en||''}</textarea></div>
        </div>
    `;
    document.getElementById('businessContainer').appendChild(div);
}
function addBusinessUI() { buildBusiness({heading:{},desc:{},socials:{}}, 0); }

function buildCv(c) {
    const uid = Date.now() + Math.random().toString(36).substr(2, 5);
    const div = document.createElement('div'); div.className = "cv-item bg-white p-5 rounded-2xl border border-slate-200 relative";
    div.innerHTML = `
        <button onclick="this.parentElement.remove()" class="absolute top-3 left-3 text-red-500"><i class="fa-solid fa-xmark"></i></button>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <div class="flex gap-2"><input type="text" id="cv-r-ku-${uid}" class="cv-r-ku border p-2 text-sm w-full" value="${c.role?.ku||''}"><button onclick="autoTranslate('cv-r-en-${uid}','cv-r-ku-${uid}', false, 'en-ku')" class="text-amber-500 px-1"><i class="fa-solid fa-language"></i></button><button onclick="autoTranslate('cv-r-ku-${uid}','cv-r-en-${uid}', false, 'ku-en')" class="text-amber-500 px-1"><i class="fa-solid fa-wand-magic-sparkles"></i></button><input type="text" id="cv-r-en-${uid}" class="cv-r-en border p-2 text-sm w-full" dir="ltr" value="${c.role?.en||''}"></div>
            <textarea id="cv-d-ku-${uid}" class="cv-d-ku border p-2 text-sm w-full h-16">${c.desc?.ku||''}</textarea>
            <textarea id="cv-d-en-${uid}" class="cv-d-en border p-2 text-sm w-full h-16" dir="ltr">${c.desc?.en||''}</textarea>
        </div>`;
    document.getElementById('cvContainer').appendChild(div);
}
function addCvUI() { buildCv({role:{},desc:{}}); }

function buildSkill(sk) {
    const uid = Date.now() + Math.random().toString(36).substr(2, 5);
    const div = document.createElement('div'); div.className = "skill-item flex gap-2 bg-white p-3 rounded-xl border border-slate-200";
    div.innerHTML = `
        <input type="text" id="sk-n-ku-${uid}" class="sk-n-ku border bg-slate-50 p-2 text-sm flex-1" value="${sk.name?.ku||''}">
        <button onclick="autoTranslate('sk-n-en-${uid}','sk-n-ku-${uid}', false, 'en-ku')" class="text-amber-500"><i class="fa-solid fa-language"></i></button>
        <button onclick="autoTranslate('sk-n-ku-${uid}','sk-n-en-${uid}', false, 'ku-en')" class="text-amber-500"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
        <input type="text" id="sk-n-en-${uid}" class="sk-n-en border bg-slate-50 p-2 text-sm flex-1" dir="ltr" value="${sk.name?.en||''}">
        <button onclick="this.parentElement.remove()" class="text-red-400"><i class="fa-solid fa-trash"></i></button>`;
    document.getElementById('skillsContainer').appendChild(div);
}
function addSkillUI() { buildSkill({name:{}}); }

function renderProjectsGrid() {
    const grid = document.getElementById('projectsGrid');
    if(!siteData.projects) siteData.projects = [];
    grid.innerHTML = siteData.projects.map((pr, i) => `
        <div class="bg-white border rounded-[1.5rem] p-5">
            <h4 class="font-black text-slate-800 text-lg mb-2 truncate">${pr.title?.ku || 'پڕۆژە'}</h4>
            <div class="flex gap-2">
                <button onclick="openProjectEditor(${i})" class="bg-indigo-50 text-indigo-700 flex-1 py-2 rounded-xl text-xs">دەستکاری</button>
                <button onclick="deleteProject(${i})" class="bg-red-50 text-red-600 px-3 py-2 rounded-xl text-xs"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join('');
    document.getElementById('projectsGrid').classList.remove('hidden'); document.getElementById('projectEditorModal').classList.add('hidden');
}

function deleteProject(index) { if(confirm('دەسڕدرێتەوە؟')) { siteData.projects.splice(index, 1); renderProjectsGrid(); } }
function addNewProject() { siteData.projects.unshift({title:{ku:"",en:""}, shortDesc:{ku:"",en:""}, fullDesc:{ku:"",en:""}, images:[]}); openProjectEditor(0); }

function openProjectEditor(index) {
    document.getElementById('projectsGrid').classList.add('hidden');
    document.getElementById('projectEditorModal').classList.remove('hidden');
    const pr = siteData.projects[index]; document.getElementById('editProjIndex').value = index;
    
    document.getElementById('ep-t-ku').value = pr.title?.ku||''; document.getElementById('ep-t-en').value = pr.title?.en||'';
    document.getElementById('ep-s-ku').value = pr.shortDesc?.ku||''; document.getElementById('ep-s-en').value = pr.shortDesc?.en||'';
    document.getElementById('ep-f-ku').innerHTML = pr.fullDesc?.ku||''; document.getElementById('ep-f-en').innerHTML = pr.fullDesc?.en||'';
    document.getElementById('ep-img-list').innerHTML = (pr.images||[]).map(img => `<img src="${getFullImageUrl(img)}" class="w-20 h-20 object-cover border rounded-lg">`).join('');
}
function closeProjectEditor() { renderProjectsGrid(); }

function saveProjectEditor() {
    const idx = document.getElementById('editProjIndex').value; const pr = siteData.projects[idx];
    pr.title.ku = document.getElementById('ep-t-ku').value; pr.title.en = document.getElementById('ep-t-en').value;
    pr.shortDesc.ku = document.getElementById('ep-s-ku').value; pr.shortDesc.en = document.getElementById('ep-s-en').value;
    pr.fullDesc.ku = document.getElementById('ep-f-ku').innerHTML; pr.fullDesc.en = document.getElementById('ep-f-en').innerHTML;
    showMsg('پڕۆژەکە بە کاتی هەڵگیرا.'); closeProjectEditor();
}

function execCmd(command, button, value=null) { document.execCommand(command, false, value); }

async function saveAllToGithub() {
    showMsg('لە پاشەکەوتکردندایە... ⏳'); 
    try {
        const s = siteData.sections;
        s.hero.name.ku = document.getElementById('h-name-ku').value; s.hero.name.en = document.getElementById('h-name-en').value;
        s.hero.title.ku = document.getElementById('h-title-ku').value; s.hero.title.en = document.getElementById('h-title-en').value;
        s.about.desc.ku = document.getElementById('a-desc-ku').value; s.about.desc.en = document.getElementById('a-desc-en').value;
        
        s.contact.email = document.getElementById('c-email').value; s.contact.phone = document.getElementById('c-phone').value; 
        s.contact.address.ku = document.getElementById('c-addr-ku').value; s.contact.address.en = document.getElementById('c-addr-en').value;

        const res = await fetch(`https://api.github.com/repos/${ghData.user}/${ghData.repo}/contents/data.json`, { 
            method: 'PUT', headers: { 'Authorization': `token ${ghData.token}`, 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ message: 'Update from Dashboard', content: btoa(unescape(encodeURIComponent(JSON.stringify(siteData, null, 2)))), sha: fileSha }) 
        });
        if(res.ok) { const r = await res.json(); fileSha = r.content.sha; showMsg('✅ بڵاوکرایەوە!'); }
    } catch(e) { alert('کێشە هەیە لە پاشەکەوتکردن.'); }
}
