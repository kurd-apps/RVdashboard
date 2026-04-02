// ================= GITHUB OAUTH SETTINGS ================= //
const OAUTH_CLIENT_ID = "Ov23licUZNUibVnGmgD4"; 
const OAUTH_CLIENT_SECRET = "bb6529ce89578246b7cf72ff454b994f5800f07e"; 
const ALLOWED_USERNAME = "kurd-apps"; 
const TARGET_REPO = "RV"; 
// ========================================================= //

let ghData = null; let fileSha = ''; let siteData = {};
let galleryCache = null; let currentGalleryTarget = ''; 

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

// --- AI Translation ---
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
        let apiKey = localStorage.getItem('ai_api_key');
        if(!apiKey) {
            alert("سەرەتا دەبێت کلیلەکەی OpenRouter لە بەشی 'زانیاری زیادە' دابنێیت!");
            if(isRichText) targetEl.innerHTML = originalHtml; else targetEl.value = originalHtml;
            return;
        }

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
                "HTTP-Referer": window.location.origin, 
                "X-Title": "RV Dashboard" 
            },
            body: JSON.stringify({
                "model": "google/gemini-2.5-flash", 
                "messages": [{"role": "user", "content": promptMsg}]
            })
        });

        if(!res.ok) throw new Error("API Request Failed");

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
        alert('وەرگێڕان شکستی هێنا. دڵنیابە هێڵی ئینتەرنێتت هەیە، یان کلیلەکەی OpenRouter دروستە.');
    }
}

// --- OAuth ---
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
            showLoginError("پێویستە Client ID بنووسیت لەناو کۆدەکەدا پێش بەکارهێنان!");
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

        if (username.toLowerCase() !== ALLOWED_USERNAME.toLowerCase()) throw new Error(`ببورە! هەژماری "${username}" ڕێگەپێدراو نییە.`);

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
            if(!siteData.custom) siteData.custom = { links: [], texts: [] };
            
            document.getElementById('loginScreen').classList.add('hidden');
            populateForms(); 
            showMsg('✅ بەستنەوە سەرکەوتوو بوو!');
        } else { resetLogin(); }
    } catch(e) { showLoginError('کێشە هەیە لە هێڵی ئینتەرنێتەکەت.'); }
}

// --- Core Functions ---
function getFullImageUrl(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url.includes('github.com') ? url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/') : url;
    return `https://raw.githubusercontent.com/${ghData.user}/${ghData.repo}/main/${url}`;
}

// Active State of Sidebar
function switchTab(tabId) { 
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active')); 
    document.getElementById('tab-' + tabId).classList.add('active'); 
    
    // Desktop reset
    document.querySelectorAll('.side-btn').forEach(b => { 
        b.classList.remove('bg-indigo-600', 'text-white', 'bg-slate-800', 'text-amber-400', 'active'); 
        b.classList.add('hover:bg-slate-800', 'hover:text-white', 'text-slate-300'); 
    }); 
    
    // Mobile reset
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    // Activate current Desktop
    const deskBtn = document.querySelector(`.side-btn[data-target="${tabId}"]`);
    if(deskBtn) {
        deskBtn.classList.remove('hover:bg-slate-800', 'hover:text-white', 'text-slate-300'); 
        if(tabId === 'extra') deskBtn.classList.add('bg-slate-800', 'text-amber-400', 'active');
        else deskBtn.classList.add('bg-indigo-600', 'text-white', 'active');
    }
    // Activate current Mobile
    const mobBtn = document.querySelector(`.nav-btn[data-target="${tabId}"]`);
    if(mobBtn) mobBtn.classList.add('active');
}

function showMsg(text) { const m = document.getElementById('statusMsg'); m.innerHTML = text; m.classList.remove('hidden'); m.classList.add('translate-y-4'); setTimeout(() => { m.classList.add('hidden'); m.classList.remove('translate-y-4'); }, 3000); }
function updateImagePos() { const x = document.getElementById('heroPosX').value; const y = document.getElementById('heroPosY').value; document.getElementById('profilePreview').style.objectPosition = `${x}% ${y}%`; }

function createExtraLinkHTML(ku='', en='', url='') {
    const uid = Date.now() + Math.random().toString(36).substr(2, 5);
    const div = document.createElement('div');
    div.className = "flex flex-wrap md:flex-nowrap gap-2 items-start extra-link-item bg-white p-3 rounded-xl border border-slate-200 w-full relative";
    div.innerHTML = `
        <button type="button" onclick="this.parentElement.remove()" class="absolute top-2 right-2 text-red-500 hover:bg-red-50 w-6 h-6 rounded flex items-center justify-center transition-colors z-10"><i class="fa-solid fa-xmark"></i></button>
        <div class="flex-1 w-full grid grid-cols-1 gap-2 pt-6 md:pt-0 pr-8 md:pr-0">
            <input type="text" id="cl-ku-${uid}" class="el-ku text-xs p-2 rounded-lg border border-slate-200 outline-none w-full" placeholder="ناوی لینک (کوردی)" value="${ku}">
            <div class="flex items-center gap-1">
                <button type="button" onclick="autoTranslate('cl-ku-${uid}', 'cl-en-${uid}')" class="text-amber-500 px-2 py-1"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
                <input type="text" id="cl-en-${uid}" class="el-en text-xs p-2 rounded-lg border border-slate-200 outline-none w-full" dir="ltr" placeholder="Name (EN)" value="${en}">
            </div>
            <input type="url" class="el-u text-xs p-2 rounded-lg border border-slate-200 outline-none w-full mt-1" dir="ltr" placeholder="https://..." value="${url}">
        </div>`;
    return div;
}

function populateForms() {
    const s = siteData.sections;
    const aiKey = localStorage.getItem('ai_api_key');
    if(aiKey) document.getElementById('aiApiKey').value = aiKey;

    if(s.hero) {
        document.getElementById('profilePreview').src = getFullImageUrl(s.hero.image);
        document.getElementById('navLogoPreview').src = getFullImageUrl(s.hero.navLogo);
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
    document.getElementById('clientsContainer').innerHTML = ''; if(s.clients?.logos) s.clients.logos.forEach((url) => buildClientLogo(url));

    if(s.contact) { 
        document.getElementById('c-email').value = s.contact.email||''; document.getElementById('c-phone').value = s.contact.phone||''; 
        document.getElementById('c-addr-ku').value = s.contact.address?.ku||''; document.getElementById('c-addr-en').value = s.contact.address?.en||''; 
        document.getElementById('c-form-key').value = s.contact.formKey||''; 
        document.getElementById('s-fb').value = s.contact.socials?.facebook || ''; document.getElementById('s-ig').value = s.contact.socials?.instagram || '';
        document.getElementById('s-yt').value = s.contact.socials?.youtube || ''; document.getElementById('s-be').value = s.contact.socials?.behance || '';
        document.getElementById('contactExtraLinks').innerHTML = '';
        if(s.contact.extraLinks) s.contact.extraLinks.forEach(l => addContactExtraLink(l.title?.ku, l.title?.en, l.url));
    }
    
    renderProjectsGrid();

    document.getElementById('customLinksContainer').innerHTML = '';
    if(siteData.custom?.links) siteData.custom.links.forEach(l => buildCustomLink(l));
    document.getElementById('customTextsContainer').innerHTML = '';
    if(siteData.custom?.texts) siteData.custom.texts.forEach(t => buildCustomText(t));
}

function buildBusiness(b, index) {
    const uid = Date.now() + Math.random().toString(36).substr(2, 5);
    const div = document.createElement('div'); div.className = "b-item bg-slate-50 p-5 rounded-2xl border border-slate-200 relative mb-4";
    div.innerHTML = `
        <button onclick="this.parentElement.remove()" class="absolute top-3 left-3 text-red-500 hover:text-white hover:bg-red-500 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"><i class="fa-solid fa-trash"></i></button>
        <div class="flex gap-4 items-center mb-5 mt-2">
            <img src="${getFullImageUrl(b.logo)}" class="b-logo-img w-16 h-16 rounded-xl bg-white border border-slate-200 object-cover shadow-sm">
            <div class="flex gap-2"><input type="hidden" class="b-logo-val" value="${b.logo||''}"><button onclick="currentGalleryTarget='bLogo_${index}'; openGallery('bLogo_${index}')" class="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors">گۆڕینی لۆگۆ <i class="fa-solid fa-image ml-1"></i></button></div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div><label class="text-[10px] font-bold text-slate-400 mb-1 flex justify-between"><span>ناوی بزنس (کوردی)</span><button onclick="autoTranslate('b-t-en-${uid}', 'b-t-ku-${uid}', false, 'en-ku')" class="text-amber-500"><i class="fa-solid fa-language"></i></button></label><input type="text" id="b-t-ku-${uid}" class="b-t-ku w-full border border-slate-200 p-2.5 rounded-xl text-sm" value="${b.heading?.ku||''}"></div>
            <div><label class="text-[10px] font-bold text-slate-400 mb-1 flex justify-between"><span>Name (EN)</span><button onclick="autoTranslate('b-t-ku-${uid}', 'b-t-en-${uid}', false, 'ku-en')" class="text-amber-500"><i class="fa-solid fa-wand-magic-sparkles"></i></button></label><input type="text" id="b-t-en-${uid}" class="b-t-en w-full border border-slate-200 p-2.5 rounded-xl text-sm" dir="ltr" value="${b.heading?.en||''}"></div>
            <div><label class="text-[10px] font-bold text-slate-400 mb-1 flex justify-between"><span>دەربارە (کوردی)</span><button onclick="autoTranslate('b-d-en-${uid}', 'b-d-ku-${uid}', false, 'en-ku')" class="text-amber-500"><i class="fa-solid fa-language"></i></button></label><textarea id="b-d-ku-${uid}" class="b-d-ku w-full border border-slate-200 p-3 rounded-xl h-20 text-sm resize-none">${b.desc?.ku||''}</textarea></div>
            <div><label class="text-[10px] font-bold text-slate-400 mb-1 flex justify-between"><span>About (EN)</span><button onclick="autoTranslate('b-d-ku-${uid}', 'b-d-en-${uid}', false, 'ku-en')" class="text-amber-500"><i class="fa-solid fa-wand-magic-sparkles"></i></button></label><textarea id="b-d-en-${uid}" class="b-d-en w-full border border-slate-200 p-3 rounded-xl h-20 text-sm resize-none" dir="ltr">${b.desc?.en||''}</textarea></div>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-slate-100">
            <div class="flex items-center gap-2"><i class="fa-solid fa-globe text-slate-400"></i><input type="url" class="b-w w-full border-0 p-1 text-xs outline-none bg-transparent" dir="ltr" placeholder="Website" value="${b.socials?.website||''}"></div>
            <div class="flex items-center gap-2"><i class="fa-brands fa-facebook text-blue-500"></i><input type="url" class="b-fb w-full border-0 p-1 text-xs outline-none bg-transparent" dir="ltr" placeholder="Facebook" value="${b.socials?.facebook||''}"></div>
            <div class="flex items-center gap-2"><i class="fa-brands fa-instagram text-pink-500"></i><input type="url" class="b-ig w-full border-0 p-1 text-xs outline-none bg-transparent" dir="ltr" placeholder="Instagram" value="${b.socials?.instagram||''}"></div>
            <div class="flex items-center gap-2"><i class="fa-brands fa-youtube text-red-500"></i><input type="url" class="b-yt w-full border-0 p-1 text-xs outline-none bg-transparent" dir="ltr" placeholder="Youtube" value="${b.socials?.youtube||''}"></div>
        </div>
        <div class="mt-4 border-t border-slate-200 pt-4">
            <div class="flex justify-between items-center mb-2">
                <span class="text-xs font-bold text-slate-500">لینکە زیادەکان</span>
                <button type="button" onclick="addBusinessExtraLink(this)" class="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md font-bold">+ لینک</button>
            </div>
            <div class="b-extra-links space-y-2"></div>
        </div>`;
    div.dataset.bindex = index;
    document.getElementById('businessContainer').appendChild(div);
    if(b.extraLinks) b.extraLinks.forEach(l => div.querySelector('.b-extra-links').appendChild(createExtraLinkHTML(l.title?.ku, l.title?.en, l.url)));
}
function addBusinessUI() { const idx = document.querySelectorAll('.b-item').length; buildBusiness({heading:{},desc:{},socials:{}, extraLinks:[]}, idx); }
function addBusinessExtraLink(btn) { btn.parentElement.nextElementSibling.appendChild(createExtraLinkHTML()); }
function addContactExtraLink(ku='', en='', url='') { document.getElementById('contactExtraLinks').appendChild(createExtraLinkHTML(ku, en, url)); }

// -- CV UI --
function buildCv(c) {
    const uid = Date.now() + Math.random().toString(36).substr(2, 5);
    const div = document.createElement('div'); 
    div.className = "cv-item bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative transition-all hover:border-indigo-300";
    div.innerHTML = `
        <button onclick="this.parentElement.remove()" class="absolute top-4 left-4 text-red-500 bg-red-50 hover:bg-red-500 hover:text-white w-8 h-8 rounded-lg flex items-center justify-center transition-colors"><i class="fa-solid fa-trash"></i></button>
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 mt-2">
            <div class="md:col-span-5">
                <label class="text-[10px] font-bold text-slate-400 mb-1 block">پۆست / ڕۆڵ</label>
                <div class="flex flex-col gap-2">
                    <input type="text" id="cv-r-ku-${uid}" class="cv-r-ku border border-slate-200 p-2.5 rounded-xl text-sm w-full outline-none bg-slate-50" placeholder="کوردی" value="${c.role?.ku||''}">
                    <div class="flex gap-2">
                        <button onclick="autoTranslate('cv-r-ku-${uid}','cv-r-en-${uid}', false, 'ku-en')" class="text-amber-500 bg-amber-50 px-2 rounded-lg"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
                        <input type="text" id="cv-r-en-${uid}" class="cv-r-en border border-slate-200 p-2.5 rounded-xl text-sm w-full outline-none bg-slate-50" dir="ltr" placeholder="English" value="${c.role?.en||''}">
                    </div>
                </div>
            </div>
            <div class="md:col-span-5">
                <label class="text-[10px] font-bold text-slate-400 mb-1 block">شوێنی کار / کۆمپانیا</label>
                <div class="flex flex-col gap-2">
                    <input type="text" id="cv-p-ku-${uid}" class="cv-p-ku border border-slate-200 p-2.5 rounded-xl text-sm w-full outline-none" placeholder="کوردی" value="${c.place?.ku||''}">
                    <div class="flex gap-2">
                        <button onclick="autoTranslate('cv-p-ku-${uid}','cv-p-en-${uid}', false, 'ku-en')" class="text-amber-500 bg-amber-50 px-2 rounded-lg"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
                        <input type="text" id="cv-p-en-${uid}" class="cv-p-en border border-slate-200 p-2.5 rounded-xl text-sm w-full outline-none" dir="ltr" placeholder="English" value="${c.place?.en||''}">
                    </div>
                </div>
            </div>
            <div class="md:col-span-2">
                <label class="text-[10px] font-bold text-slate-400 mb-1 block">ساڵ</label>
                <input type="text" class="cv-y border border-slate-200 p-2.5 rounded-xl text-sm w-full outline-none font-bold text-center bg-indigo-50/50 text-indigo-700" dir="ltr" placeholder="2020 - 2024" value="${c.year||''}">
            </div>
            <div class="md:col-span-6 border-t border-slate-100 pt-4 mt-2">
                <label class="text-[10px] font-bold text-slate-400 mb-1 flex justify-between"><span>کورتەی کار (کوردی)</span><button onclick="autoTranslate('cv-d-en-${uid}','cv-d-ku-${uid}', false, 'en-ku')" class="text-amber-500"><i class="fa-solid fa-language"></i></button></label>
                <textarea id="cv-d-ku-${uid}" class="cv-d-ku border border-slate-200 p-3 rounded-xl h-20 text-sm w-full outline-none resize-none bg-slate-50">${c.desc?.ku||''}</textarea>
            </div>
            <div class="md:col-span-6 border-t border-slate-100 pt-4 mt-2">
                <label class="text-[10px] font-bold text-slate-400 mb-1 flex justify-between"><span>Work Description (EN)</span><button onclick="autoTranslate('cv-d-ku-${uid}','cv-d-en-${uid}', false, 'ku-en')" class="text-amber-500"><i class="fa-solid fa-wand-magic-sparkles"></i></button></label>
                <textarea id="cv-d-en-${uid}" class="cv-d-en border border-slate-200 p-3 rounded-xl h-20 text-sm w-full outline-none resize-none bg-slate-50" dir="ltr">${c.desc?.en||''}</textarea>
            </div>
        </div>`;
    document.getElementById('cvContainer').appendChild(div);
}
function addCvUI() { buildCv({role:{},place:{},desc:{},year:""}); }

// -- SKILL UI --
function buildSkill(sk) {
    const uid = Date.now() + Math.random().toString(36).substr(2, 5);
    const div = document.createElement('div'); 
    div.className = "skill-item bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3";
    div.innerHTML = `
        <div class="flex justify-between items-center w-full">
            <span class="text-xs font-bold text-slate-400">ناوی شارەزایی</span>
            <button onclick="this.parentElement.parentElement.remove()" class="text-red-400 hover:text-red-600 bg-red-50 w-6 h-6 rounded flex items-center justify-center transition-colors"><i class="fa-solid fa-trash text-xs"></i></button>
        </div>
        <div class="flex flex-col gap-2">
            <div class="flex gap-2">
                <input type="text" id="sk-n-ku-${uid}" class="sk-n-ku border border-slate-200 bg-slate-50 p-2 rounded-xl text-sm w-full outline-none" placeholder="کوردی" value="${sk.name?.ku||''}">
                <button onclick="autoTranslate('sk-n-ku-${uid}','sk-n-en-${uid}', false, 'ku-en')" class="text-amber-500 bg-amber-50 px-3 rounded-xl"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
            </div>
            <input type="text" id="sk-n-en-${uid}" class="sk-n-en border border-slate-200 bg-slate-50 p-2 rounded-xl text-sm w-full outline-none" dir="ltr" placeholder="English" value="${sk.name?.en||''}">
        </div>
        <div class="flex items-center justify-between bg-slate-100 p-2 rounded-xl mt-1">
            <span class="text-xs font-bold text-slate-500 ml-2">ئاستی شارەزایی:</span>
            <div class="flex items-center gap-1 bg-white px-2 py-1 rounded-lg shadow-sm border border-slate-200">
                <input type="number" class="sk-p border-0 bg-transparent w-10 text-center text-sm font-bold outline-none text-indigo-700" placeholder="0" min="0" max="100" value="${sk.percent||''}">
                <span class="text-xs text-indigo-400 font-bold">%</span>
            </div>
        </div>`;
    document.getElementById('skillsContainer').appendChild(div);
}
function addSkillUI() { buildSkill({name:{}, percent:""}); }

function buildClientLogo(url) {
    const div = document.createElement('div'); div.className = "client-logo relative group w-20 h-20 bg-white rounded-2xl shadow-sm border border-slate-200 p-3 flex items-center justify-center cursor-pointer hover:border-indigo-400 transition-colors";
    div.innerHTML = `<img src="${getFullImageUrl(url)}" class="max-w-full max-h-full object-contain"><div onclick="this.parentElement.remove()" class="absolute inset-0 bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-2xl font-bold transition-all text-sm backdrop-blur-sm"><i class="fa-solid fa-trash"></i></div><input type="hidden" class="c-url" value="${url}">`;
    document.getElementById('clientsContainer').appendChild(div);
}

function buildCustomLink(l) {
    const uid = Date.now() + Math.random().toString(36).substr(2, 5);
    const div = document.createElement('div'); div.className = "cl-item bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-3 items-center relative";
    div.innerHTML = `
        <div class="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-2">
            <input type="text" id="cl-ku-${uid}" class="cl-t-ku border border-slate-200 p-2 rounded-lg text-sm outline-none focus:border-indigo-500" placeholder="ناوی لینک (کوردی)" value="${l.title?.ku||''}">
            <div class="flex items-center gap-1">
                <button onclick="autoTranslate('cl-ku-${uid}', 'cl-en-${uid}')" class="text-amber-500"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
                <input type="text" id="cl-en-${uid}" class="cl-t-en w-full border border-slate-200 p-2 rounded-lg text-sm outline-none focus:border-indigo-500" dir="ltr" placeholder="Link Name (EN)" value="${l.title?.en||''}">
            </div>
        </div>
        <input type="url" class="cl-u flex-1 w-full border border-slate-200 p-2 rounded-lg text-sm outline-none focus:border-indigo-500" dir="ltr" placeholder="https://..." value="${l.url||''}">
        <button onclick="this.parentElement.remove()" class="bg-red-100 text-red-600 hover:bg-red-500 hover:text-white w-full md:w-10 h-10 rounded-lg flex items-center justify-center transition-colors shrink-0"><i class="fa-solid fa-trash"></i></button>`;
    document.getElementById('customLinksContainer').appendChild(div);
}
function addCustomLinkUI() { buildCustomLink({title:{}, url:""}); }

function buildCustomText(t) {
    const uid = Date.now() + Math.random().toString(36).substr(2, 5);
    const div = document.createElement('div'); div.className = "ct-item bg-slate-50 p-5 rounded-2xl border border-slate-200 relative";
    div.innerHTML = `
        <button onclick="this.parentElement.remove()" class="absolute top-3 left-3 text-red-500 hover:text-white hover:bg-red-500 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"><i class="fa-solid fa-trash"></i></button>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 mt-2">
            <input type="text" id="ct-t-ku-${uid}" class="ct-t-ku border border-slate-200 p-2.5 rounded-xl text-sm font-bold outline-none focus:border-sky-500" placeholder="سەردێڕ (کوردی)" value="${t.title?.ku||''}">
            <div class="flex items-center gap-1">
                <button onclick="autoTranslate('ct-t-ku-${uid}','ct-t-en-${uid}')" class="text-amber-500"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
                <input type="text" id="ct-t-en-${uid}" class="ct-t-en border border-slate-200 p-2.5 rounded-xl text-sm font-bold outline-none focus:border-sky-500 w-full" dir="ltr" placeholder="Title (EN)" value="${t.title?.en||''}">
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <textarea id="ct-c-ku-${uid}" class="ct-c-ku border border-slate-200 p-3 rounded-xl h-24 text-sm outline-none focus:border-sky-500 resize-none" placeholder="دەق / ناوەڕۆک (کوردی)">${t.content?.ku||''}</textarea>
            <div class="relative w-full">
                <button onclick="autoTranslate('ct-c-ku-${uid}','ct-c-en-${uid}')" class="absolute left-2 top-2 text-amber-500"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
                <textarea id="ct-c-en-${uid}" class="ct-c-en border border-slate-200 p-3 rounded-xl h-24 text-sm outline-none focus:border-sky-500 resize-none w-full" dir="ltr" placeholder="Content (EN)">${t.content?.en||''}</textarea>
            </div>
        </div>`;
    document.getElementById('customTextsContainer').appendChild(div);
}
function addCustomTextUI() { buildCustomText({title:{}, content:{}}); }

// --- Projects Logic ---
function renderProjectsGrid() {
    const grid = document.getElementById('projectsGrid');
    if(!siteData.projects) siteData.projects = [];
    grid.innerHTML = siteData.projects.map((pr, i) => `
        <div class="bg-white border border-slate-200 rounded-[1.5rem] overflow-hidden shadow-sm hover:shadow-xl transition-all relative group w-full flex flex-col h-full">
            <div class="w-full h-48 overflow-hidden bg-slate-100 relative">
                <img src="${pr.bannerImage ? getFullImageUrl(pr.bannerImage) : (pr.images && pr.images[0] ? getFullImageUrl(pr.images[0]) : 'https://via.placeholder.com/300x200?text=No+Image')}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                ${pr.category ? `<div class="absolute top-3 right-3 bg-white/90 backdrop-blur text-indigo-700 text-[10px] font-black px-2 py-1 rounded-md">${pr.category}</div>` : ''}
            </div>
            <div class="p-5 flex flex-col flex-1">
                <h4 class="font-black text-slate-800 text-lg mb-2 truncate">${pr.title?.ku || 'پڕۆژەی نوێ'}</h4>
                <div class="mt-auto flex gap-2">
                    <button onclick="openProjectEditor(${i})" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex-1 py-2 rounded-xl font-bold text-xs transition-colors"><i class="fa-solid fa-pen ml-1"></i> دەستکاری</button>
                    <button onclick="deleteProject(${i})" class="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-xl font-bold text-xs transition-colors"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        </div>`).join('');
    document.getElementById('projectsGrid').classList.remove('hidden'); document.getElementById('projectEditorModal').classList.add('hidden');
}

function deleteProject(index) { if(confirm('دڵنیایت لە سڕینەوەی ئەم پڕۆژەیە؟')) { siteData.projects.splice(index, 1); renderProjectsGrid(); } }
function addNewProject() { siteData.projects.unshift({title:{ku:"",en:""}, category:"", shortDesc:{ku:"",en:""}, fullDesc:{ku:"",en:""}, images:[], videoLink:"", date:"", websiteLink:"", displayType: "video", bannerImage: "", extraLinks:[]}); openProjectEditor(0); }

function openProjectEditor(index) {
    document.getElementById('projectsGrid').classList.add('hidden');
    const modal = document.getElementById('projectEditorModal'); modal.classList.remove('hidden');
    const pr = siteData.projects[index]; document.getElementById('editProjIndex').value = index;

    let catOptions = siteData.categories.map(c => `<option value="${c}" ${pr.category===c?'selected':''}>${c}</option>`).join('');
    if(!siteData.categories.includes(pr.category) && pr.category) catOptions += `<option value="${pr.category}" selected>${pr.category}</option>`;
    document.getElementById('ep-c').innerHTML = catOptions; document.getElementById('ep-new-c').value = ''; 
    
    document.getElementById('ep-disp').value = pr.displayType || 'video';
    document.getElementById('ep-t-ku').value = pr.title?.ku||''; document.getElementById('ep-t-en').value = pr.title?.en||'';
    document.getElementById('ep-date').value = pr.date||'';
    document.getElementById('ep-s-ku').value = pr.shortDesc?.ku||''; document.getElementById('ep-s-en').value = pr.shortDesc?.en||'';
    document.getElementById('ep-f-ku').innerHTML = pr.fullDesc?.ku||''; document.getElementById('ep-f-en').innerHTML = pr.fullDesc?.en||'';
    document.getElementById('ep-v').value = pr.videoLink||''; document.getElementById('ep-web').value = pr.websiteLink||'';
    renderEditorImages(pr.images || [], pr.bannerImage || '');
    
    document.getElementById('ep-extra-links').innerHTML = '';
    if(pr.extraLinks) { pr.extraLinks.forEach(l => addProjectExtraLink(l.title?.ku, l.title?.en, l.url)); }
}

function addProjectExtraLink(ku='', en='', url='') { document.getElementById('ep-extra-links').appendChild(createExtraLinkHTML(ku, en, url)); }

function renderEditorImages(imgs, currentBanner) {
    document.getElementById('ep-img-list').innerHTML = imgs.map((img, i) => `
        <div class="relative w-24 h-24 md:w-28 md:h-28 border-[3px] rounded-xl overflow-hidden shadow-sm ${img === currentBanner ? 'border-amber-400' : 'border-slate-200'}">
            <img src="${getFullImageUrl(img)}" class="w-full h-full object-cover">
            <button onclick="removeEditorImage(${i})" class="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full text-xs shadow"><i class="fa-solid fa-xmark"></i></button>
            <button onclick="setBannerImage('${img}')" class="absolute top-1 left-1 bg-white text-slate-800 w-6 h-6 rounded-full text-xs shadow flex items-center justify-center hover:text-amber-500" title="بیکە بە بانەر"><i class="fa-solid fa-star ${img === currentBanner ? 'text-amber-500' : ''}"></i></button>
            <input type="hidden" class="ep-img-val" value="${img}">
            ${img === currentBanner ? '<span class="absolute bottom-0 inset-x-0 bg-amber-400 text-slate-900 text-[10px] py-0.5 text-center font-black uppercase tracking-widest">بانەر</span>' : ''}
        </div>`).join('');
}

function removeEditorImage(index) { const idx = document.getElementById('editProjIndex').value; siteData.projects[idx].images.splice(index, 1); renderEditorImages(siteData.projects[idx].images, siteData.projects[idx].bannerImage); }
function setBannerImage(imgUrl) { const idx = document.getElementById('editProjIndex').value; siteData.projects[idx].bannerImage = imgUrl; renderEditorImages(siteData.projects[idx].images, imgUrl); showMsg('وێنەکە کرا بە بانەری سەرەکی 🌟'); }
function closeProjectEditor() { renderProjectsGrid(); }

function saveProjectEditor() {
    const idx = document.getElementById('editProjIndex').value; const pr = siteData.projects[idx];
    pr.title.ku = document.getElementById('ep-t-ku').value; pr.title.en = document.getElementById('ep-t-en').value;
    pr.displayType = document.getElementById('ep-disp').value;
    const newCat = document.getElementById('ep-new-c').value.trim();
    if(newCat) { pr.category = newCat; if(!siteData.categories.includes(newCat)) siteData.categories.push(newCat); } else { pr.category = document.getElementById('ep-c').value; }
    pr.date = document.getElementById('ep-date').value;
    pr.shortDesc.ku = document.getElementById('ep-s-ku').value; pr.shortDesc.en = document.getElementById('ep-s-en').value;
    pr.fullDesc.ku = document.getElementById('ep-f-ku').innerHTML; pr.fullDesc.en = document.getElementById('ep-f-en').innerHTML;
    pr.videoLink = document.getElementById('ep-v').value; pr.websiteLink = document.getElementById('ep-web').value;
    pr.images = []; document.querySelectorAll('.ep-img-val').forEach(el => pr.images.push(el.value));
    pr.extraLinks = [];
    document.querySelectorAll('#ep-extra-links .extra-link-item').forEach(el => {
        const ku = el.querySelector('.el-ku').value.trim(); const en = el.querySelector('.el-en').value.trim(); const u = el.querySelector('.el-u').value.trim();
        if(ku || en || u) pr.extraLinks.push({title: {ku, en}, url: u});
    });
    showMsg('پڕۆژەکە بە کاتی هەڵگیرا. بۆ بڵاوکردنەوە کلیک لە سەوزەکە بکە ✔️'); closeProjectEditor();
}

function execCmd(command, button, value=null) { document.execCommand(command, false, value); button.parentElement.parentElement.nextElementSibling.focus(); }
function addLink(button) { const url = prompt('لینکەکە دابنێ (http://...):'); if(url) execCmd('createLink', button, url); }

// --- Gallery & Upload ---
async function coreUpload(file, btn) {
    const ogText = btn.innerHTML;
    btn.innerHTML = "<i class='fa-solid fa-circle-notch fa-spin'></i>"; btn.disabled = true;
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = async function() {
            const b64 = reader.result.split(',')[1]; const name = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9.]/g, '');
            try {
                const res = await fetch(`https://api.github.com/repos/${ghData.user}/${ghData.repo}/contents/images/${name}`, {
                    method: 'PUT', headers: { 'Authorization': `token ${ghData.token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: 'Upload via Dashboard', content: b64 })
                });
                if(res.ok) { const dat = await res.json(); if(galleryCache) galleryCache.push(dat.content); resolve(dat.content.path); } else reject("Upload failed");
            } catch(e) { reject(e); }
            btn.innerHTML = ogText; btn.disabled = false;
        };
        reader.readAsDataURL(file);
    });
}

async function openGallery(target) {
    currentGalleryTarget = target;
    const modal = document.getElementById('galleryModal'); const grid = document.getElementById('galleryGrid');
    modal.classList.remove('hidden'); modal.classList.add('flex');
    
    if(!galleryCache) {
        grid.innerHTML = '<div class="col-span-full text-center py-20 font-bold text-slate-500"><i class="fa-solid fa-circle-notch fa-spin text-4xl text-indigo-500 mb-4 block"></i>لە هێنانی وێنەکاندایە لە گیتهەب...</div>';
        try {
            const res = await fetch(`https://api.github.com/repos/${ghData.user}/${ghData.repo}/contents/images`, { headers: { 'Authorization': `token ${ghData.token}` } });
            if(res.ok) { galleryCache = await res.json(); galleryCache = galleryCache.filter(f => f.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)); renderGalleryImages(); } 
            else { grid.innerHTML = '<div class="col-span-full text-center py-20 font-bold text-red-500"><i class="fa-solid fa-triangle-exclamation text-4xl mb-4 block"></i>هەڵە لە هێنانی گەلەری. فۆڵدەری images بەتاڵە!</div>'; }
        } catch(e) { grid.innerHTML = '<div class="col-span-full text-center py-20 font-bold text-red-500">کێشەی هێڵ!</div>'; }
    } else { renderGalleryImages(); }
}

function renderGalleryImages() {
    const grid = document.getElementById('galleryGrid');
    if(galleryCache.length === 0) { grid.innerHTML = '<div class="col-span-full text-center py-20 font-bold text-slate-500">هیچ وێنەیەک نییە!</div>'; return; }
    grid.innerHTML = galleryCache.map(file => `
        <div onclick="selectFromGallery('${file.path}')" class="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-500 hover:shadow-md transition-all group overflow-hidden relative h-24 md:h-32">
            <img src="${getFullImageUrl(file.path)}" class="w-full h-full object-cover rounded-xl transition-transform duration-500 group-hover:scale-110">
            <div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2"><span class="text-white text-[10px] font-bold truncate px-2 w-full text-center" dir="ltr">${file.name}</span></div>
        </div>`).join('');
}

function closeGallery() { document.getElementById('galleryModal').classList.add('hidden'); document.getElementById('galleryModal').classList.remove('flex'); }

function selectFromGallery(path) {
    if(currentGalleryTarget === 'hero') { document.getElementById('profilePreview').src = getFullImageUrl(path); siteData.sections.hero.image = path; }
    else if(currentGalleryTarget === 'navLogo') { document.getElementById('navLogoPreview').src = getFullImageUrl(path); siteData.sections.hero.navLogo = path; }
    else if(currentGalleryTarget.startsWith('bLogo_')) { const idx = currentGalleryTarget.split('_')[1]; document.querySelectorAll('.b-item')[idx].querySelector('.b-logo-img').src = getFullImageUrl(path); document.querySelectorAll('.b-item')[idx].querySelector('.b-logo-val').value = path; }
    else if(currentGalleryTarget === 'client') { buildClientLogo(path); }
    else if(currentGalleryTarget === 'project') { const idx = document.getElementById('editProjIndex').value; siteData.projects[idx].images.push(path); if(!siteData.projects[idx].bannerImage) siteData.projects[idx].bannerImage = path; renderEditorImages(siteData.projects[idx].images, siteData.projects[idx].bannerImage); }
    closeGallery(); showMsg('وێنەکە هەڵبژێردرا 🖼️');
}

async function uploadProfileImage() { const input = document.getElementById('heroImageInput'); const btn = input.nextElementSibling.querySelector('button') || input.nextElementSibling; if(!input.files.length) return alert('وێنە هەڵبژێرە!'); try { const path = await coreUpload(input.files[0], btn); document.getElementById('profilePreview').src = getFullImageUrl(path); siteData.sections.hero.image = path; showMsg('سەرکەوت!'); input.value=''; } catch(e) { alert(e); } }
async function uploadNavLogo() { const input = document.getElementById('navLogoInput'); const btn = input.nextElementSibling.querySelector('button') || input.nextElementSibling; if(!input.files.length) return alert('لۆگۆ هەڵبژێرە!'); try { const path = await coreUpload(input.files[0], btn); document.getElementById('navLogoPreview').src = getFullImageUrl(path); siteData.sections.hero.navLogo = path; showMsg('سەرکەوت!'); input.value=''; } catch(e) { alert(e); } }
async function uploadClientLogo() { const input = document.getElementById('clientImgInput'); const btn = input.nextElementSibling.querySelector('button') || input.nextElementSibling; if(!input.files.length) return alert('لۆگۆ هەڵبژێرە!'); try { const path = await coreUpload(input.files[0], btn); buildClientLogo(path); showMsg('سەرکەوت!'); input.value=''; } catch(e) { alert(e); } }
async function uploadProjectImage() { const input = document.getElementById('ep-img-input'); const btn = input.nextElementSibling.querySelector('button') || input.nextElementSibling; if(!input.files.length) return; try { const path = await coreUpload(input.files[0], btn); const idx = document.getElementById('editProjIndex').value; siteData.projects[idx].images.push(path); if(!siteData.projects[idx].bannerImage) siteData.projects[idx].bannerImage = path; renderEditorImages(siteData.projects[idx].images, siteData.projects[idx].bannerImage); input.value = ''; } catch(e) { alert(e); } }

// --- Save All Data (Fixed SHA issue) ---
async function saveAllToGithub() {
    if(!siteData.sections) return alert('سەرەتا زانیارییەکان بهێنە!');
    showMsg('لە پاشەکەوتکردندایە... ⏳'); 
    
    try {
        const s = siteData.sections;
        s.hero.name.ku = document.getElementById('h-name-ku').value; s.hero.name.en = document.getElementById('h-name-en').value;
        s.hero.title.ku = document.getElementById('h-title-ku').value; s.hero.title.en = document.getElementById('h-title-en').value;
        s.hero.imagePos = { x: document.getElementById('heroPosX').value, y: document.getElementById('heroPosY').value };
        s.about.desc.ku = document.getElementById('a-desc-ku').value; s.about.desc.en = document.getElementById('a-desc-en').value;
        
        s.businesses = [];
        document.querySelectorAll('.b-item').forEach(el => {
            const eLinks = [];
            el.querySelectorAll('.extra-link-item').forEach(linkEl => {
                const ku = linkEl.querySelector('.el-ku').value.trim(); const en = linkEl.querySelector('.el-en').value.trim(); const u = linkEl.querySelector('.el-u').value.trim();
                if(ku || en || u) eLinks.push({title: {ku, en}, url: u});
            });
            s.businesses.push({
                heading: { ku: el.querySelector('.b-t-ku').value, en: el.querySelector('.b-t-en').value },
                desc: { ku: el.querySelector('.b-d-ku').value, en: el.querySelector('.b-d-en').value },
                logo: el.querySelector('.b-logo-val').value,
                socials: { website: el.querySelector('.b-w').value, facebook: el.querySelector('.b-fb').value, instagram: el.querySelector('.b-ig').value, youtube: el.querySelector('.b-yt').value },
                extraLinks: eLinks
            });
        });

        s.cv.items = []; document.querySelectorAll('.cv-item').forEach(el => s.cv.items.push({ role: {ku: el.querySelector('.cv-r-ku').value, en: el.querySelector('.cv-r-en').value}, place: {ku: el.querySelector('.cv-p-ku').value, en: el.querySelector('.cv-p-en').value}, year: el.querySelector('.cv-y').value, desc: {ku: el.querySelector('.cv-d-ku').value, en: el.querySelector('.cv-d-en').value} }));
        s.skills.list = []; document.querySelectorAll('.skill-item').forEach(el => s.skills.list.push({ name: {ku: el.querySelector('.sk-n-ku').value, en: el.querySelector('.sk-n-en').value}, percent: el.querySelector('.sk-p').value }));
        s.clients.logos = []; document.querySelectorAll('.c-url').forEach(el => s.clients.logos.push(el.value));

        s.contact.email = document.getElementById('c-email').value; s.contact.phone = document.getElementById('c-phone').value; 
        s.contact.address.ku = document.getElementById('c-addr-ku').value; s.contact.address.en = document.getElementById('c-addr-en').value;
        s.contact.formKey = document.getElementById('c-form-key').value;
        s.contact.socials.facebook = document.getElementById('s-fb').value; s.contact.socials.behance = document.getElementById('s-be').value;
        s.contact.socials.instagram = document.getElementById('s-ig').value; s.contact.socials.youtube = document.getElementById('s-yt').value;
        
        s.contact.extraLinks = [];
        document.querySelectorAll('#contactExtraLinks .extra-link-item').forEach(el => {
            const ku = el.querySelector('.el-ku').value.trim(); const en = el.querySelector('.el-en').value.trim(); const u = el.querySelector('.el-u').value.trim();
            if(ku || en || u) s.contact.extraLinks.push({title: {ku, en}, url: u});
        });
        
        if(!siteData.custom) siteData.custom = { links: [], texts: [] };
        siteData.custom.links = [];
        document.querySelectorAll('#customLinksContainer .cl-item').forEach(el => {
            const ku = el.querySelector('.cl-t-ku').value; const en = el.querySelector('.cl-t-en').value; const u = el.querySelector('.cl-u').value;
            if(ku || en || u) siteData.custom.links.push({ title: {ku, en}, url: u });
        });
        
        siteData.custom.texts = [];
        document.querySelectorAll('#customTextsContainer .ct-item').forEach(el => {
            const tku = el.querySelector('.ct-t-ku').value; const ten = el.querySelector('.ct-t-en').value;
            const cku = el.querySelector('.ct-c-ku').value; const cen = el.querySelector('.ct-c-en').value;
            if(tku || ten || cku || cen) siteData.custom.texts.push({ title: {ku: tku, en: ten}, content: {ku: cku, en: cen} });
        });

        // 🚨 چارەسەری کێشەی سەیڤ نەبوون:
        // پێش ئەوەی داتاکە بنێرین بۆ گیتهەب، دەبێت SHA ی تازە بهێنینەوە نەوەک لەسەر گیتهەب گۆڕابێت
        const freshRes = await fetch(`https://api.github.com/repos/${ghData.user}/${ghData.repo}/contents/data.json`, { headers: { 'Authorization': `token ${ghData.token}` } });
        if(freshRes.ok) {
            const freshData = await freshRes.json();
            fileSha = freshData.sha;
        }

        // پاشان داتاکە سەیڤ دەکەین
        const res = await fetch(`https://api.github.com/repos/${ghData.user}/${ghData.repo}/contents/data.json`, { 
            method: 'PUT', 
            headers: { 'Authorization': `token ${ghData.token}`, 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
                message: 'Update from Dashboard', 
                content: btoa(unescape(encodeURIComponent(JSON.stringify(siteData, null, 2)))), 
                sha: fileSha 
            }) 
        });

        if(res.ok) { 
            const r = await res.json(); 
            fileSha = r.content.sha; 
            showMsg('✅ بە سەرکەوتوویی بڵاوکرایەوە بۆ وێبسایتەکەت!'); 
        } else { 
            const errData = await res.json();
            alert('هەڵە لە پاشەکەوتکردن: ' + (errData.message || 'نەزانراو')); 
            console.error(errData);
        }
    } catch(e) { 
        console.error(e); 
        alert('کێشە هەیە لە هێڵی ئینتەرنێتەکەت یان گیتهەب.'); 
    }
}
