// --- TAB SWITCHING LOGIC WITH CSS MOTION ---
function switchTab(tabId, el) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active-tab');
        setTimeout(() => tab.classList.add('hidden-tab'), 300); 
    });
    
    setTimeout(() => {
        const target = document.getElementById(tabId);
        target.classList.remove('hidden-tab');
        void target.offsetWidth; // Force Reflow
        target.classList.add('active-tab');
        if(tabId === 'map-section' && map) map.resize();
    }, 300);
    
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active-nav'));
    if(el) el.classList.add('active-nav');
}

// --- GLOBAL DYNAMIC ALERT ENGINE ---
function triggerGlobalAlert(eventType) {
    const els = document.querySelectorAll('.panel, #main-nav');
    els.forEach(el => el.classList.remove('alert-missile', 'alert-siren', 'alert-drone', 'alert-intercept'));

    let duration = 10000; let cName = 'alert-missile';
    if(eventType === 'siren') { duration = 20000; cName = 'alert-siren'; }
    else if(eventType === 'drone') { duration = 10000; cName = 'alert-drone'; }
    else if(eventType === 'intercept') { duration = 10000; cName = 'alert-intercept'; }

    els.forEach(el => el.classList.add(cName));
    setTimeout(() => { els.forEach(el => el.classList.remove(cName)); }, duration);
}

// --- INSTANT CACHE ENGINE ---
function loadFromCache(id) {
    try {
        let cached = localStorage.getItem('iqwr_cache_' + id);
        if(cached && cached.trim() !== "") { 
            document.getElementById(id).innerHTML = cached; 
            return true; 
        }
    } catch(e) {}
    return false;
}
function saveToCache(id, html) { 
    if(html && html.trim() !== "") {
        localStorage.setItem('iqwr_cache_' + id, html); 
    }
}

// --- FAST PROXY ENGINE ---
async function fetchWithFastestProxy(targetUrl, type = 'json') {
    const timeWindow = Math.floor(Date.now() / 60000); 
    const sep = targetUrl.includes('?') ? '&' : '?';
    const freshUrl = `${targetUrl}${sep}_cb=${timeWindow}`;
    
    const proxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(freshUrl)}`,
        `https://corsproxy.io/?url=${encodeURIComponent(freshUrl)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(freshUrl)}`
    ];

    for (let proxy of proxies) {
        try {
            const res = await fetch(proxy, { cache: "no-store", mode: 'cors' });
            if (res.ok) return type === 'json' ? await res.json() : await res.text();
        } catch(e) { console.warn("Proxy fallback triggered..."); }
    }
    throw new Error("All Proxies failed.");
}

setInterval(() => { document.getElementById('clock').innerText = new Date().toUTCString(); }, 1000);

// CUSTOM FULLSCREEN FUNCTION
function toggleFullscreen(btn) {
    const container = btn.parentElement;
    if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => console.log(err));
    } else {
        document.exitFullscreen();
    }
}

async function scrapeTelegramChannel(channel, extractMedia = false) {
    try {
        const htmlText = await fetchWithFastestProxy(`https://t.me/s/${channel}`, 'html');
        if(!htmlText) return [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        const messages = doc.querySelectorAll('.tgme_widget_message');
        let posts = [];
        
        for(let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            const textEl = msg.querySelector('.tgme_widget_message_text');
            const dateEl = msg.querySelector('time.time');
            
            if(textEl && dateEl) {
                const dateStr = dateEl.getAttribute('datetime');
                const msgDate = new Date(dateStr);
                let text = textEl.innerText.replace(/(<([^>]+)>)/gi, "").replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim(); 
                const link = msg.getAttribute('data-post') ? 'https://t.me/' + msg.getAttribute('data-post') : `https://t.me/s/${channel}`;
                
                let mediaHTML = '';
                let videoSrc = null;
                if (extractMedia) {
                    const photoWrap = msg.querySelector('.tgme_widget_message_photo_wrap');
                    if (photoWrap && photoWrap.style.backgroundImage) {
                        const urlMatch = photoWrap.style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
                        if (urlMatch && urlMatch[1]) mediaHTML = `<img src="${urlMatch[1]}" style="width:100%; border-radius:4px; margin-top:8px; border: 1px solid var(--border-color);" />`;
                    }
                    const videoWrap = msg.querySelector('video');
                    if (videoWrap && videoWrap.src) {
                        videoSrc = videoWrap.src;
                        // NO AUTOPLAY in the News Sidebar Feed
                        mediaHTML = `<video src="${videoSrc}" controls playsinline style="width:100%; max-height:250px; border-radius:4px; margin-top:8px; background: #000; border: 1px solid var(--border-color);"></video>`;
                    }
                }
                posts.push({ channel, text, date: msgDate, link, mediaHTML, videoSrc });
            }
        }
        return posts;
    } catch (error) { return []; }
}

async function fetchTicker() {
    try {
        const posts = await scrapeTelegramChannel('presstv', false);
        if(!posts || !posts.length) return;
        let validPosts = posts.filter(p => (Date.now() - p.date.getTime()) <= 3600000).slice(0, 10);
        if(validPosts.length === 0) validPosts = posts.slice(0, 3); 
        let htmlString = '';
        validPosts.forEach(p => {
            let fullText = p.text.replace(/\n/g, ' - '); 
            htmlString += `<span class="ticker-item">🚨 [PRESS TV] ${fullText.toUpperCase()}</span>`;
        });
        if(htmlString) {
            const tickerEl = document.getElementById('live-ticker');
            tickerEl.style.animationDuration = `${Math.max(htmlString.length * 0.12, 30)}s`;
            tickerEl.innerHTML = htmlString + htmlString;
        }
    } catch(e) {}
}

async function fetchSummary() {
    try {
        const elId = 'summary-feed';
        const [presstv, meObs, rnintel] = await Promise.all([
            scrapeTelegramChannel('presstv', false), scrapeTelegramChannel('me_observer_TG', false), scrapeTelegramChannel('rnintel', false)
        ]);
        let recent = [...(presstv||[]), ...(meObs||[]), ...(rnintel||[])]
            .filter(p => (Date.now() - p.date.getTime()) < 3600000 && p.text.length <= 160)
            .sort((a,b) => b.date - a.date);
        
        if (!recent.length) return;
        let html = '';
        recent.slice(0, 10).forEach(p => {
            html += `<li><a href="${p.link}" target="_blank" style="color: #e5e5e5; text-decoration: none;">${p.text}</a></li>`;
        });
        document.getElementById(elId).innerHTML = html;
        saveToCache(elId, html);
    } catch (e) {}
}

async function fetchNews() {
    try {
        const elId = 'news-feed';
        const [meObs, rnintel] = await Promise.all([scrapeTelegramChannel('me_observer_TG', true), scrapeTelegramChannel('rnintel', true)]);
        let posts = [...(meObs||[]), ...(rnintel||[])].filter(p => (Date.now() - p.date.getTime()) <= 16 * 3600000).sort((a,b) => b.date - a.date);
        if (!posts.length) return;
        let html = ''; 
        posts.slice(0, 30).forEach(p => {
            const diffMins = Math.max(0, Math.floor((Date.now() - p.date.getTime()) / 60000));
            let tStr = `<span style="color: #22c55e; font-weight: bold;">${diffMins < 1 ? "Just now" : diffMins < 60 ? diffMins + "m ago" : Math.floor(diffMins/60) + "h ago"}</span>`;
            html += `<div class="sc-list-item" style="flex-direction: column;">
                        <div style="display:flex; gap:10px;"><div class="icon-warn">~</div><div class="sc-content" style="width: 100%;">
                        <div style="font-weight: 600; color: #fff;">${p.channel.replace('_TG','').toUpperCase()} · ${tStr}</div>
                        <div style="margin-top: 4px;"><a href="${p.link}" target="_blank">${p.text}</a></div>${p.mediaHTML}</div></div></div>`;
        });
        document.getElementById(elId).innerHTML = html;
        saveToCache(elId, html);
    } catch (e) {}
}

async function fetchIranNews() {
    try {
        const elId = 'iran-news-feed';
        let posts = await scrapeTelegramChannel('presstv', true);
        if(!posts) return;
        posts = posts.filter(p => (Date.now() - p.date.getTime()) <= 16 * 3600000).sort((a,b) => b.date - a.date);
        let html = '';
        posts.slice(0, 30).forEach(p => {
            const diffMins = Math.max(0, Math.floor((Date.now() - p.date.getTime()) / 60000));
            let tStr = `<span style="color: #22c55e; font-weight: bold;">${diffMins < 1 ? "Just now" : diffMins < 60 ? diffMins + "m ago" : Math.floor(diffMins/60) + "h ago"}</span>`;
            html += `<div class="sc-list-item" style="flex-direction: column;">
                        <div style="display:flex; gap:10px;"><div class="icon-alert">!</div><div class="sc-content" style="width: 100%;">
                        <div style="font-weight: 600; color: #fff;">PRESS TV · ${tStr}</div>
                        <div style="margin-top: 4px;"><a href="${p.link}" target="_blank">${p.text}</a></div>${p.mediaHTML}</div></div></div>`;
        });
        document.getElementById(elId).innerHTML = html || '<div style="padding:20px; text-align:center; color:#888;">No recent broadcasts.</div>';
        saveToCache(elId, html);
    } catch (e) {}
}

const airspaceDB = [
    { country: "IRAN", status: "CLOSED", detail: "ALL CIVILIAN FLIGHTS SUSPENDED (NOTAM ACTIVE)" }, 
    { country: "ISRAEL", status: "CLOSED", detail: "BEN GURION OPERATIONS HALTED" },
    { country: "LEBANON", status: "CLOSED", detail: "BEY AIRSPACE COMPLETELY CLOSED" }, 
    { country: "SYRIA", status: "CLOSED", detail: "MILITARY OPERATIONS ONLY" },
    { country: "IRAQ", status: "CLOSED", detail: "CIVIL AVIATION HALTED OVER SAFETY CONCERNS" }, 
    { country: "JORDAN", status: "CLOSED", detail: "AMM AIRSPACE CLOSED TEMPORARILY" },
    { country: "SAUDI ARABIA", status: "RESTRICTED USE", detail: "NORTH/EAST SECTORS RESTRICTED" }, 
    { country: "YEMEN", status: "CLOSED", detail: "NO CIVILIAN FLIGHTS PERMITTED" },
    { country: "UAE", status: "RESTRICTED USE", detail: "DXB/AUH SEVERE REROUTING & DELAYS" }, 
    { country: "BAHRAIN", status: "RESTRICTED USE", detail: "BAH DELAYS DUE TO MILITARY OPS" }
];

async function fetchAirspaceStatus() {
    const elId = 'airspace-grid';
    if(!loadFromCache(elId)) {
        let html = '';
        airspaceDB.forEach(ap => {
            let statusClass = ap.status === "OPEN" ? "air-open" : ap.status.includes("RESTRICTED") ? "air-restricted" : "air-closed";
            let hex = ap.status === "OPEN" ? "#22c55e" : ap.status.includes("RESTRICTED") ? "#f59e0b" : "#ef4444";
            html += `<div class="airspace-card ${statusClass}"><div class="country">${ap.country}</div><div class="status"><div style="width: 10px; height: 10px; border-radius: 50%; background: ${hex}; box-shadow: 0 0 8px ${hex};"></div><span style="color: ${hex};">${ap.status}</span></div><div class="detail">${ap.detail}</div><div class="sub-data"><span>THREAT: HIGH</span><span>DATA: OSINT/ADSB</span></div></div>`;
        });
        document.getElementById(elId).innerHTML = html;
    }

    try {
        const [flightEmerg, osint] = await Promise.all([scrapeTelegramChannel('FlightEmergency', false), scrapeTelegramChannel('osintdefender', false)]);
        let posts = [...(flightEmerg||[]), ...(osint||[])].sort((a,b) => b.date - a.date);
        
        airspaceDB.forEach(ap => {
            const mention = posts.find(p => p.text.toLowerCase().includes(ap.country.toLowerCase()) && (Date.now() - p.date.getTime()) < 24 * 3600000);
            if(mention) {
                const t = mention.text.toLowerCase();
                if(t.includes('reopen') || t.includes('resume') || t.includes('clear')) {
                    ap.status = "OPEN"; ap.detail = "OPERATIONS RESUMING VIA LATEST OSINT";
                }
            }
        });
        
        let html = '';
        airspaceDB.forEach(ap => {
            let statusClass = ap.status === "OPEN" ? "air-open" : ap.status.includes("RESTRICTED") ? "air-restricted" : "air-closed";
            let hex = ap.status === "OPEN" ? "#22c55e" : ap.status.includes("RESTRICTED") ? "#f59e0b" : "#ef4444";
            html += `<div class="airspace-card ${statusClass}"><div class="country">${ap.country}</div><div class="status"><div style="width: 10px; height: 10px; border-radius: 50%; background: ${hex}; box-shadow: 0 0 8px ${hex};"></div><span style="color: ${hex};">${ap.status}</span></div><div class="detail">${ap.detail}</div><div class="sub-data"><span>THREAT: HIGH</span><span>DATA: OSINT/ADSB</span></div></div>`;
        });
        document.getElementById(elId).innerHTML = html;
        saveToCache(elId, html);
    } catch(e) {}
}

// ==========================================
// KINETIC MAP TRACKER
// ==========================================
let currentFilterHours = 999999; 
let currentRegionFilter = 'ALL';

const map = new maplibregl.Map({
    container: 'map',
    style: {
        "version": 8,
        "sources": { "carto-dark": { "type": "raster", "tiles": ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"], "tileSize": 256 } },
        "layers": [{"id": "carto-dark-layer", "type": "raster", "source": "carto-dark", "minzoom": 0, "maxzoom": 22}]
    },
    center: [46.0, 28.0], zoom: 4.2, pitch: 40, bearing: 0,
    interactive: false 
});

const nowMs = Date.now();
const baselineData = [
    { id: "iran1", title: "Heavy Airstrikes on Leadership Targets", location: "TEHRAN", lat: 35.6892, lng: 51.3890, eventType: "missile", timestamp: nowMs - (2*3600000), source: "Baseline" },
    { id: "b0", title: "Air Siren - Jerusalem & Central Israel", location: "JERUSALEM", lat: 31.7683, lng: 35.2137, eventType: "siren", timestamp: nowMs - (80*3600000), source: "Baseline" },
    { id: "b6", title: "Drone Attack Naval Base", location: "DUQM (OMAN)", lat: 19.6643, lng: 57.7029, eventType: "drone", timestamp: nowMs - (54*3600000), source: "Baseline" },
    { id: "b14", title: "Drone Attack Dubai Airport", location: "DUBAI", lat: 25.2532, lng: 55.3657, eventType: "drone", timestamp: nowMs - (48*3600000), source: "Baseline" }
];

// MASSIVE HISTORY ENGINE (Now handles up to 2500 events locally)
function getStoredIntel() { 
    try {
        let data = JSON.parse(localStorage.getItem('iqwr_intel_db')) || [];
        return data.filter(d => typeof d.timestamp === 'number' && !isNaN(d.timestamp));
    } catch(e) {
        localStorage.removeItem('iqwr_intel_db'); return [];
    }
}
function saveStoredIntel(dataArray) { localStorage.setItem('iqwr_intel_db', JSON.stringify(dataArray.slice(-2500))); }

let globalIntelData = [];

// FETCH EXTERNAL HISTORY JSON
async function loadExternalHistory() {
    try {
        const response = await fetch('./history.json');
        if (response.ok) {
            const externalData = await response.json();
            let localData = getStoredIntel();
            
            externalData.forEach(ext => {
                const exists = localData.some(loc => loc.id === ext.id || (loc.location === ext.location && loc.timestamp === ext.timestamp));
                if(!exists) localData.push(ext);
            });
            saveStoredIntel(localData);
            console.log("History.json successfully loaded and merged.");
        }
    } catch(e) {
        console.warn("No local history.json found or failed to load. Falling back to LocalStorage.");
    }
}

const geoDB = {
    "tel aviv": { coords: [34.7818, 32.0853], aliases: ["tel aviv", "tel-aviv", "gush dan", "central israel", "jaffa"], region: "ISRAEL" },
    "jerusalem": { coords: [35.2137, 31.7683], aliases: ["jerusalem", "al-quds"], region: "ISRAEL" },
    "haifa": { coords: [34.9892, 32.7940], aliases: ["haifa", "carmel", "northern israel"], region: "ISRAEL" },
    "beirut": { coords: [35.5018, 33.8938], aliases: ["beirut", "dahieh"], region: "LEBANON" },
    "damascus": { coords: [36.2913, 33.5138], aliases: ["damascus"], region: "SYRIA" },
    "tehran": { coords: [51.3890, 35.6892], aliases: ["tehran"], region: "IRAN" },
    "isfahan": { coords: [51.8650, 32.7410], aliases: ["isfahan", "esfahan"], region: "IRAN" },
    "shiraz": { coords: [29.5918, 52.5388], aliases: ["shiraz"], region: "IRAN" },
    "karaj": { coords: [35.8327, 50.9915], aliases: ["karaj"], region: "IRAN" },
    "kermanshah": { coords: [34.3142, 47.0650], aliases: ["kermanshah"], region: "IRAN" },
    "tabriz": { coords: [38.0773, 46.2919], aliases: ["tabriz"], region: "IRAN" },
    "baghdad": { coords: [44.3615, 33.3128], aliases: ["baghdad"], region: "IRAQ" },
    "sanaa": { coords: [44.2064, 15.3694], aliases: ["sanaa", "hodeidah", "yemen"], region: "YEMEN" },
    "dubai": { coords: [55.2708, 25.2048], aliases: ["dubai", "jebel ali", "uae", "burj"], region: "UAE" },
    "riyadh": { coords: [46.7167, 24.7136], aliases: ["riyadh", "saudi arabia", "aramco"], region: "SAUDI ARABIA" },
    "manama": { coords: [50.5860, 26.2285], aliases: ["bahrain", "manama", "salman port"], region: "BAHRAIN" },
    "doha": { coords: [51.5310, 25.2854], aliases: ["qatar", "doha", "mesaieed"], region: "QATAR" },
    "muscat": { coords: [58.4059, 23.5859], aliases: ["muscat", "oman", "duqm"], region: "OMAN" },
    "cyprus": { coords: [33.4299, 35.1264], aliases: ["cyprus"], region: "CYPRUS" }
};

// STRICT KEYWORD FILTERING
function determineEventType(text) {
    let t = text.toLowerCase();
    if (t.includes("intercept")) return "intercept"; 
    if (t.match(/siren|red alert|alarm/)) return "siren"; 
    if (t.match(/drone|uav|swarm/)) return "drone"; 
    if (t.match(/missile|strike|attack|rocket|bomb|explosion/)) return "missile"; 
    return null;
}

async function fetchLiveOSINT() {
    try {
        const [amkData, rnintelData, ddData, auroraData, clashData] = await Promise.all([
            scrapeTelegramChannel('AMK_Mapping', true), 
            scrapeTelegramChannel('rnintel', true), 
            scrapeTelegramChannel('DDGeopolitics', true),
            scrapeTelegramChannel('AuroraIntel', true),
            scrapeTelegramChannel('clashreport', true)
        ]);
        const posts = [...(amkData||[]), ...(rnintelData||[]), ...(ddData||[]), ...(auroraData||[]), ...(clashData||[])];
        
        let storedIntel = getStoredIntel();
        let newFound = false;
        let highestAlert = null;

        posts.forEach(post => {
            const title = post.text;
            const evtType = determineEventType(title);
            
            if(!evtType) return; 

            let detectedLoc = null, lat = null, lng = null, region = null;
            for (const [key, geoData] of Object.entries(geoDB)) {
                if (geoData.aliases.some(alias => title.toLowerCase().includes(alias))) {
                    detectedLoc = key.toUpperCase(); 
                    lng = geoData.coords[0]; 
                    lat = geoData.coords[1]; 
                    region = geoData.region;
                    break;
                }
            }

            if (detectedLoc) {
                const isDuplicate = storedIntel.some(existing => 
                    existing.location === detectedLoc && existing.eventType === evtType && Math.abs(existing.timestamp - post.date.getTime()) < (2*3600000)
                );

                if(!isDuplicate && (Date.now() - post.date.getTime()) < 3600000) {
                    storedIntel.push({
                        id: Math.random().toString(), title: title, eventType: evtType,
                        lat: lat + (Math.random()-0.5)*0.03, lng: lng + (Math.random()-0.5)*0.03, 
                        location: detectedLoc, region: region, timestamp: post.date.getTime(), 
                        source: post.channel.toUpperCase(), mediaHTML: post.mediaHTML, videoSrc: post.videoSrc // Media Saved Here
                    });
                    newFound = true;
                    if(evtType === 'missile') highestAlert = 'missile';
                    else if(evtType === 'siren' && highestAlert !== 'missile') highestAlert = 'siren';
                    else if(evtType === 'drone' && !highestAlert) highestAlert = 'drone';
                    else if(evtType === 'intercept' && !highestAlert) highestAlert = 'intercept';
                }
            }
        });

        if(newFound) {
            saveStoredIntel(storedIntel);
            if(highestAlert) triggerGlobalAlert(highestAlert);
        }

        let combinedData = [...baselineData];
        storedIntel.forEach(storedEvt => {
            const isDupBase = combinedData.some(baseEvt => 
                baseEvt.location === storedEvt.location && baseEvt.eventType === storedEvt.eventType && Math.abs(baseEvt.timestamp - storedEvt.timestamp) < (6*3600000)
            );
            if(!isDupBase) combinedData.push(storedEvt);
        });
        
        globalIntelData = combinedData;
        renderMapData();
    } catch (err) { console.error("OSINT Failed"); }
}

let activeMapMarkers = [];
let activePopup = null;

function flyToLoc(lng, lat, strikeId) {
    map.flyTo({ center: [lng, lat], zoom: 9, essential: true, speed: 1.5 });
    if (activePopup) activePopup.remove();

    document.querySelectorAll('.manual-blink').forEach(el => el.classList.remove('manual-blink'));
    const targetMarker = document.getElementById('marker-' + strikeId);
    if (targetMarker) {
        targetMarker.classList.add('manual-blink');
        setTimeout(() => { if(targetMarker) targetMarker.classList.remove('manual-blink'); }, 10000);
    }
}

function setFilter(hours) {
    currentFilterHours = hours;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${hours}`).classList.add('active');
    renderMapData();
}

function setRegionFilter(region) {
    currentRegionFilter = region;
    renderMapData();
}

function renderMapData() {
    activeMapMarkers.forEach(m => m.remove());
    activeMapMarkers = [];

    const feedElement = document.getElementById('feed');
    feedElement.innerHTML = '';
    
    const currMs = Date.now();
    globalIntelData.forEach(d => { 
        if(d.timestamp) d.timeAgo = (currMs - d.timestamp) / 3600000; 
        else d.timeAgo = 0; 
        
        if(!d.region && geoDB[d.location.toLowerCase()]) d.region = geoDB[d.location.toLowerCase()].region;
    });
    
    const filtered = globalIntelData.filter(d => {
        let matchesTime = d.timeAgo <= currentFilterHours;
        let matchesRegion = currentRegionFilter === 'ALL' || d.region === currentRegionFilter;
        return matchesTime && matchesRegion;
    }).sort((a,b) => a.timeAgo - b.timeAgo);

    if (!filtered.length) {
        feedElement.innerHTML = '<div style="color: #666; text-align: center; padding: 20px 0;">NO DETECTIONS IN TIMEFRAME/REGION</div>';
        return;
    }

    filtered.forEach(strike => {
        let minutesAgo = Math.max(0, Math.floor(strike.timeAgo * 60));
        let timeText = minutesAgo < 1 ? "JUST NOW" : minutesAgo < 60 ? `T-MINUS ${minutesAgo}M` : strike.timeAgo < 24 ? `T-MINUS ${Math.floor(strike.timeAgo)}H` : `T-MINUS ${Math.floor(strike.timeAgo/24)}D`;
        
        let blinkClass = minutesAgo <= 10 ? 'critical-blink' : '';
        let hex = '#ef4444'; if (strike.eventType === 'siren') hex = '#3b82f6'; else if (strike.eventType === 'drone') hex = '#f97316'; else if (strike.eventType === 'intercept') hex = '#9ca3af';

        feedElement.insertAdjacentHTML('beforeend', `
            <div class="feed-entry ${strike.eventType} ${blinkClass}" onclick="flyToLoc(${strike.lng}, ${strike.lat}, '${strike.id}')">
                <div class="entry-time"><span style="color:${hex}">[ NODE: ${strike.source} ]</span><span>${timeText}</span></div>
                <div class="entry-desc"><strong>${strike.location}:</strong> ${strike.title.substring(0,85)}${strike.title.length>85?'...':''}</div>
            </div>
        `);

        const elContainer = document.createElement('div');
        elContainer.className = `zero-marker ${blinkClass}`;
        elContainer.id = 'marker-' + strike.id;
        
        const dot = document.createElement('div');
        dot.className = 'zero-dot';
        dot.style.backgroundColor = hex;
        elContainer.appendChild(dot);
        
        const ring = document.createElement('div');
        ring.className = 'zero-pulse';
        ring.style.borderColor = hex;
        if (strike.timeAgo > 6 && !blinkClass) ring.classList.add('inactive-pulse');
        elContainer.appendChild(ring);

        if (strike.eventType === 'siren') {
            const sirenCircle = document.createElement('div');
            sirenCircle.className = 'siren-radius';
            elContainer.appendChild(sirenCircle);
        }

        // MAP POPUP MEDIA ENGINE (AUTOPLAY YES)
        let mapMedia = strike.mediaHTML ? strike.mediaHTML : '';
        if (strike.videoSrc) {
            mapMedia = `<video src="${strike.videoSrc}" autoplay loop muted playsinline style="width:100%; max-height:200px; border-radius:4px; margin-top:8px; background: #000; border: 1px solid #333;"></video>`;
        }

        const popupHTML = `<div style="display:flex; justify-content:space-between; margin-bottom: 6px; border-bottom: 1px solid #333; padding-bottom: 4px;">
                <strong style="color:${hex}; font-size:1.1em;">${strike.location}</strong>
                <span style="color:#aaa; font-size:0.8em; align-self:center;">${timeText}</span></div>
            <div style="font-size:0.9em; line-height:1.4; margin-bottom: 8px; max-height: 120px; overflow-y: auto;">${strike.title}</div>
            ${mapMedia}
            <div style="font-size:0.7em; color:#888; text-transform:uppercase; border-top: 1px dashed #333; padding-top: 4px; margin-top: 8px;">SOURCE: ${strike.source}</div>`;
        
        const popup = new maplibregl.Popup({ offset: 10, closeOnClick: false }).setHTML(popupHTML);

        const marker = new maplibregl.Marker({ element: elContainer, anchor: 'center' })
            .setLngLat([strike.lng, strike.lat]).setPopup(popup).addTo(map);

        elContainer.addEventListener('click', () => { activePopup = popup; });
        activeMapMarkers.push(marker);
    });
}

let secondsLeft = 600; 
function updateTimer() {
    let mins = Math.floor(secondsLeft / 60);
    let secs = secondsLeft % 60;
    document.getElementById('timer-display').innerText = `${mins < 10 ? '0'+mins : mins}:${secs < 10 ? '0'+secs : secs}`;
    if (secondsLeft <= 0) { secondsLeft = 600; fetchLiveOSINT(); fetchAirspaceStatus(); } else { secondsLeft--; }
}

window.onload = () => {
    loadFromCache('summary-feed');
    loadFromCache('news-feed');
    loadFromCache('iran-news-feed');
};

map.on('load', async () => {
    // 1. First, attempt to load History.json
    await loadExternalHistory(); 

    // 2. Then merge it with baseline and local data
    globalIntelData = [...baselineData, ...getStoredIntel()];
    renderMapData(); 
    
    Promise.allSettled([ fetchTicker(), fetchSummary(), fetchNews(), fetchIranNews(), fetchAirspaceStatus(), fetchLiveOSINT() ]);
    
    setInterval(() => { Promise.allSettled([ fetchTicker(), fetchSummary(), fetchNews(), fetchAirspaceStatus() ]); }, 60000);
    setInterval(fetchIranNews, 65000);
    setInterval(updateTimer, 1000);
});
