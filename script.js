import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ==========================================
// 1. FIREBASE CONFIGURATION (MAP ONLY)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCRZyzzNv3yyAnLGSGIGgOdoBHdPUde13k",
    authDomain: "ihihioh-feb7c.firebaseapp.com",
    projectId: "ihihioh-feb7c",
    storageBucket: "ihihioh-feb7c.firebasestorage.app",
    messagingSenderId: "377367541218",
    appId: "1:377367541218:web:6e1c7d0538e58e492df5bb",
    databaseURL: "https://ihihioh-feb7c-default-rtdb.firebaseio.com" 
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const mapDbRef = ref(db, 'mapEvents');

// ==========================================
// 2. UI & MAP INITIALIZATION 
// ==========================================
const map = new maplibregl.Map({
    container: 'map',
    style: {
        "version": 8,
        "sources": { "carto-dark": { "type": "raster", "tiles": ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"], "tileSize": 256 } },
        "layers": [{"id": "carto-dark-layer", "type": "raster", "source": "carto-dark", "minzoom": 0, "maxzoom": 22}]
    },
    center: [44.0, 29.0], // Centers on the Middle East
    zoom: 3.5, // Zooms out to show Egypt, Israel, Gulf, and Iran
    pitch: 40, 
    bearing: 0,
    interactive: false 
});

map.on('load', () => {
    setTimeout(() => { document.getElementById('map-bottom-sheet').classList.add('open'); }, 800);
});

// GLOBAL UI ALERT FUNCTION
let alertTimeout;
window.triggerGlobalAlert = function(eventType) {
    const elements = [
        document.getElementById('main-nav'),
        document.getElementById('header-pill'),
        ...document.querySelectorAll('.panel')
    ];
    
    const alertClass = `alert-${eventType}`;
    
    elements.forEach(el => {
        if(el) {
            el.classList.remove('alert-missile', 'alert-siren', 'alert-drone', 'alert-intercept');
            el.classList.add(alertClass);
        }
    });

    clearTimeout(alertTimeout);
    alertTimeout = setTimeout(() => {
        elements.forEach(el => {
            if(el) el.classList.remove(alertClass);
        });
    }, 6000); // 6 second flash
};

function enforceStackingRunways() {
    document.querySelectorAll('.stacked-dashboard').forEach(dash => {
        if (!dash.querySelector('.js-runway')) {
            let runway = document.createElement('div');
            runway.className = 'js-runway';
            runway.style.height = '300vh'; // Massive scroll runway to stop bottom panel jumping
            runway.style.width = '100%';
            runway.style.pointerEvents = 'none';
            runway.style.flexShrink = '0';
            dash.appendChild(runway);
        }
    });
}

window.forceRefresh = function() {
    const refreshBtn = document.querySelector('.refresh-btn');
    const originalText = refreshBtn.innerHTML;
    
    refreshBtn.innerHTML = '↻ SYNCING...';
    refreshBtn.style.opacity = '0.5';
    
    fetchLiveOSINT();
    loadFeeds();
    
    setTimeout(() => {
        refreshBtn.innerHTML = originalText;
        refreshBtn.style.opacity = '1';
    }, 1500);
};

window.toggleIframePlay = function(btn, iframeId) {
    const iframe = document.getElementById(iframeId);
    const isPlaying = btn.innerText.includes('PAUSE');
    iframe.contentWindow.postMessage(JSON.stringify({
        "event": "command",
        "func": isPlaying ? "pauseVideo" : "playVideo",
        "args": []
    }), '*');
    btn.innerText = isPlaying ? '[ PLAY ]' : '[ PAUSE ]';
};

window.toggleMapSheet = () => document.getElementById('map-bottom-sheet').classList.toggle('open');
window.closePopupAndOpenSheet = () => {
    document.getElementById('custom-popup').classList.add('hidden');
    document.getElementById('map-bottom-sheet').classList.add('open');
    document.querySelectorAll('.zero-marker').forEach(m => m.classList.remove('active-marker'));
    map.flyTo({ center: [44.0, 29.0], zoom: 3.5, essential: true, speed: 1.0 }); // Recenter to Middle East macro view
};

window.toggleHeader = () => {
    const v1 = document.getElementById('header-view-1');
    const v2 = document.getElementById('header-view-2');
    if (v1.classList.contains('hide')) {
        v2.classList.remove('show');
        setTimeout(() => { v1.classList.remove('hide'); }, 300);
    } else {
        v1.classList.add('hide');
        setTimeout(() => { v2.classList.add('show'); }, 300);
    }
};

window.toggleFullScreen = function(elem) {
    if (!document.fullscreenElement) { if (elem.requestFullscreen) elem.requestFullscreen(); } 
    else { if (document.exitFullscreen) document.exitFullscreen(); }
};

window.switchTab = function(tabId, el) {
    // FIX: Pause all videos and Live iframes when switching tabs to prevent background audio
    document.querySelectorAll('video').forEach(vid => vid.pause());
    document.querySelectorAll('.live-cam-wrapper iframe').forEach(iframe => {
        iframe.contentWindow.postMessage(JSON.stringify({ "event": "command", "func": "pauseVideo", "args": [] }), '*');
    });
    document.querySelectorAll('.custom-play-btn').forEach(btn => btn.innerText = '[ PLAY ]');

    window.scrollTo({ top: 0, behavior: 'instant' });
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active-tab');
        setTimeout(() => tab.classList.add('hidden-tab'), 300); 
    });
    
    if(tabId === 'map-section') {
        document.getElementById('ticker-container').style.display = 'flex';
        setTimeout(() => { document.getElementById('ticker-container').style.opacity = '1'; }, 50);
        document.getElementById('dash-arrow').style.display = 'flex';
    } else {
        document.getElementById('ticker-container').style.opacity = '0';
        setTimeout(() => { document.getElementById('ticker-container').style.display = 'none'; }, 300);
        document.getElementById('dash-arrow').style.display = 'none';
    }

    setTimeout(() => {
        const target = document.getElementById(tabId);
        target.classList.remove('hidden-tab');
        void target.offsetWidth; 
        target.classList.add('active-tab');
        if(tabId === 'map-section') { map.resize(); }
    }, 300);
    
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active-nav'));
    if(el) el.classList.add('active-nav');
}

setInterval(() => { 
    const now = new Date();
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    document.getElementById('clock').innerText = now.toLocaleDateString('en-US', options).toUpperCase(); 
}, 1000);

const warStartDate = new Date('2023-10-07').getTime();
const weeksPassed = (Date.now() - warStartDate) / (1000 * 60 * 60 * 24 * 7);
let burns = { US: 12500000000 + (250000000 * weeksPassed), IL: 28400000000 + (500000000 * weeksPassed), IR: 4100000000 + (75000000 * weeksPassed) }; 
function formatMoney(num) { return '$' + num.toLocaleString('en-US', {maximumFractionDigits:0}); }

setInterval(() => {
    burns.US += (413 + (Math.random() * 50)); 
    burns.IL += (826 + (Math.random() * 80));
    burns.IR += (123 + (Math.random() * 20));
    document.getElementById('burn-us').innerText = formatMoney(burns.US);
    document.getElementById('burn-il').innerText = formatMoney(burns.IL);
    document.getElementById('burn-ir').innerText = formatMoney(burns.IR);
    document.getElementById('burn-total').innerText = formatMoney(burns.US + burns.IL + burns.IR);
}, 1000);

// ==========================================
// 3. BASELINE HISTORICAL DATA ENGINE
// ==========================================
const historicalRawData = [
  {"id":"feb28_01","title":"Operation Epic Fury: Decapitation Strike Kills Supreme Leader Khamenei","location":"TEHRAN, IRAN","lat":35.6892,"lng":51.389,"eventType":"missile","timestamp":1772265600000,"source":"US DoD / IDF / Press TV","mediaHTML":"<iframe width='100%' height='200' src='https://www.youtube.com/embed/hQzZUq-NGFI?autoplay=1&mute=1&controls=0' frameborder='0' allow='autoplay; encrypted-media' style='border-radius:4px; margin-top:8px; border: 1px solid #333;'></iframe>"},
  {"id":"feb28_02","title":"US Strike Hits Girls' School Near IRGC Naval Base","location":"MINAB, IRAN","lat":27.1466,"lng":57.08,"eventType":"missile","timestamp":1772257500000,"source":"New York Times / CFR"},
  {"id":"feb28_03","title":"IAF Strikes 500 Targets Including IRGC Aerospace Facilities","location":"TABRIZ, IRAN","lat":38.0792,"lng":46.2887,"eventType":"missile","timestamp":1772261100000,"source":"Alma Research Center"},
  {"id":"feb28_shiraz_01","title":"Airstrikes Target IRGC Imam Ali and Imam Javad Garrisons","location":"SHIRAZ, IRAN","lat":29.5918,"lng":52.5836,"eventType":"missile","timestamp":1772269200000,"source":"JINSA / OSINT"},
  {"id":"feb28_isfahan_01","title":"IAF Strikes Dozens of Defense Industrial Base Targets","location":"ISFAHAN, IRAN","lat":32.6539,"lng":51.6660,"eventType":"missile","timestamp":1772271000000,"source":"JINSA / IDF"}
  
  // ---> PASTE THE REST OF YOUR HISTORICAL DATA HERE <---
  
];

let baselineMapData = [];
let baselineNewsData = [];

historicalRawData.forEach(item => {
    let safeMedia = item.mediaHTML || "";
    if (item.videoSrc && !item.videoSrc.includes("PASTE_YOUR")) {
        safeMedia = `
        <div style="position:relative; width:100%; border-radius:6px; overflow:hidden; border: 1px solid rgba(255,255,255,0.1); background:#000; margin-top:8px;">
            <video src="${item.videoSrc}" autoplay loop muted playsinline onclick="this.muted=!this.muted; this.nextElementSibling.innerText = this.muted ? '🔇 TAP TO UNMUTE' : '🔊 MUTE'" style="width:100%; display:block; max-height:180px; object-fit:contain; cursor:pointer;"></video>
            <div style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.8); color:#fff; font-size:0.6rem; font-weight:bold; padding:4px 8px; border-radius:4px; pointer-events:none;">🔇 TAP TO UNMUTE</div>
        </div>`;
    }

    const formattedItem = {
        id: item.id || 'hist_' + Math.random().toString(36).substr(2, 9),
        title: item.title,
        eventType: item.eventType || 'missile',
        lat: item.lat + (Math.random() - 0.5) * 0.08,
        lng: item.lng + (Math.random() - 0.5) * 0.08,
        location: item.location,
        timestamp: item.timestamp,
        date: item.timestamp, 
        source: item.source || 'HISTORICAL ARCHIVE',
        channel: item.source || 'ARCHIVE', 
        text: item.title, 
        mediaHTML: safeMedia
    };

    baselineMapData.push(formattedItem);
    baselineNewsData.push(formattedItem);
});

// ==========================================
// 4. GLOBAL DATA, GEO DB & UTILS
// ==========================================
function deduplicateItems(arr) {
    const seen = new Set();
    return arr.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    });
}

let globalIntelData = deduplicateItems([...baselineMapData]);
let allNewsData = deduplicateItems([...baselineNewsData]); 
let activeMapMarkers = [];
let currentFilterHours = 999999; 

function getJitteredCoords(lat, lng) {
    const maxOffset = 0.08; 
    return { lat: lat + (Math.random() - 0.5) * maxOffset, lng: lng + (Math.random() - 0.5) * maxOffset };
}

const geoDB = {
    "tel aviv": { coords: [34.7818, 32.0853], aliases: ["tel aviv", "central israel", "jaffa", "gush dan", "herzliya"] },
    "jerusalem": { coords: [35.2137, 31.7683], aliases: ["jerusalem", "al-quds"] },
    "haifa": { coords: [34.9892, 32.7940], aliases: ["haifa", "northern israel", "galilee", "golan"] },
    "ashkelon": { coords: [34.5715, 31.6693], aliases: ["ashkelon", "ashdod", "sderot", "southern israel"] },
    "eilat": { coords: [34.9519, 29.5577], aliases: ["eilat", "red sea"] },
    "gaza": { coords: [34.4668, 31.5017], aliases: ["gaza", "rafah", "khan younis"] },
    "beirut": { coords: [35.5018, 33.8938], aliases: ["beirut", "dahieh", "south lebanon", "tyre", "sidon"] },
    "damascus": { coords: [36.2913, 33.5138], aliases: ["damascus", "syria"] },
    "tehran": { coords: [51.3890, 35.6892], aliases: ["tehran"] },
    "isfahan": { coords: [51.8650, 32.7410], aliases: ["isfahan", "esfahan", "natanz"] },
    "shiraz": { coords: [52.5836, 29.5918], aliases: ["shiraz"] },
    "dubai": { coords: [55.2708, 25.2048], aliases: ["dubai", "jebel ali", "uae"] },
    "riyadh": { coords: [46.7167, 24.7136], aliases: ["riyadh", "saudi arabia"] },
    "sanaa": { coords: [44.2064, 15.3694], aliases: ["sanaa", "houthi", "yemen", "hodeidah"] }
};

const tacticalSources = ['AMK_Mapping', 'rnintel', 'DDGeopolitics', 'clashreport'];
// FIX: Added ILtoday to the list of news sources
const newsSources = ['AMK_Mapping', 'rnintel', 'DDGeopolitics', 'clashreport', 'presstv', 'me_observer_TG', 'spectatorindex', 'aljazeeraenglish', 'ILtoday'];

async function fetchWithFastestProxy(targetUrl, type = 'json') {
    const separator = targetUrl.includes('?') ? '&' : '?';
    const brokenCacheUrl = `${targetUrl}${separator}nocache=${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const encoded = encodeURIComponent(brokenCacheUrl);
    
    const proxies = [
        `https://corsproxy.io/?url=${encoded}`,
        `https://api.allorigins.win/raw?url=${encoded}`,
        `https://api.codetabs.com/v1/proxy?quest=${encoded}`
    ];

    for (let proxy of proxies) {
        try {
            const res = await fetch(proxy, { cache: "no-store", mode: 'cors' });
            if (res.ok) return type === 'json' ? await res.json() : await res.text();
        } catch(e) {}
    }
    return null;
}

// -------------------------------------------------------------------
// 5. FIREBASE REALTIME LISTENERS (MAP ONLY) & LOCAL RENDERING
// -------------------------------------------------------------------

onValue(mapDbRef, (snapshot) => {
    const liveData = snapshot.val() ? Object.values(snapshot.val()) : [];
    const previousLength = globalIntelData.length;
    
    globalIntelData = deduplicateItems([...baselineMapData, ...liveData]);
    
    // FIX: If Firebase pushes a new event from another client, trigger the alert
    if (globalIntelData.length > previousLength && previousLength > 0) {
        const newestEvent = globalIntelData[globalIntelData.length - 1];
        triggerGlobalAlert(newestEvent.eventType);
    }
    
    renderMapData();
});


// -------------------------------------------------------------------
// 6. SCRAPERS
// -------------------------------------------------------------------
window.fetchLiveOSINT = async function() {
    // FIX: Filter out diplomatic/noise keywords from triggering map events
    const blockedKeywords = ['press release', 'statement', 'speech', 'spokesperson', 'condemn', 'condemns', 'says', 'said', 'announced', 'official', 'meeting', 'diplomat', 'minister', 'claims'];

    try {
        tacticalSources.forEach(async (source) => {
            const htmlText = await fetchWithFastestProxy(`https://t.me/s/${source}`, 'html');
            if (htmlText) {
                const doc = new DOMParser().parseFromString(htmlText, 'text/html');
                const sourceName = source.toUpperCase();
                
                doc.querySelectorAll('.tgme_widget_message').forEach(msg => {
                    const textEl = msg.querySelector('.tgme_widget_message_text');
                    const dateEl = msg.querySelector('time.time');
                    if(textEl && dateEl) {
                        let text = textEl.innerText.toLowerCase();
                        
                        // Filter Check
                        if (blockedKeywords.some(word => text.includes(word))) {
                            return; 
                        }
                        
                        let evtType = null;
                        if (text.includes('intercept') || text.includes('shot down')) evtType = 'intercept';
                        else if (text.includes('siren') || text.includes('alert')) evtType = 'siren';
                        else if (text.includes('drone') || text.includes('uav')) evtType = 'drone';
                        else if (text.includes('missile') || text.includes('rocket') || text.includes('strike') || text.includes('explosion')) evtType = 'missile';
                        
                        if (evtType) {
                            for (const [key, geoData] of Object.entries(geoDB)) {
                                if (geoData.aliases.some(a => text.includes(a))) {
                                    
                                    let mediaHTML = '';
                                    const photoWrap = msg.querySelector('.tgme_widget_message_photo_wrap');
                                    if (photoWrap && photoWrap.style.backgroundImage) {
                                        const urlMatch = photoWrap.style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
                                        if (urlMatch && urlMatch[1]) {
                                            mediaHTML = `<img src="${urlMatch[1]}" style="width:100%; display:block; border-radius:6px; max-height:180px; object-fit:contain; border: 1px solid rgba(255,255,255,0.1);" />`;
                                        }
                                    }
                                    const videoWrap = msg.querySelector('video');
                                    if (videoWrap && videoWrap.src) {
                                        mediaHTML = `
                                        <div style="position:relative; width:100%; border-radius:6px; overflow:hidden; border: 1px solid rgba(255,255,255,0.1); background:#000;">
                                            <video src="${videoWrap.src}" autoplay loop muted playsinline onclick="this.muted=!this.muted; this.nextElementSibling.innerText = this.muted ? '🔇 TAP TO UNMUTE' : '🔊 MUTE'" style="width:100%; display:block; max-height:180px; object-fit:contain; cursor:pointer;"></video>
                                            <div style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.8); color:#fff; font-size:0.6rem; font-weight:bold; padding:4px 8px; border-radius:4px; pointer-events:none;">🔇 TAP TO UNMUTE</div>
                                        </div>`;
                                    }

                                    let jittered = getJitteredCoords(geoData.coords[1], geoData.coords[0]);
                                    let ts = new Date(dateEl.getAttribute('datetime')).getTime();
                                    const uniqueId = sourceName.replace(/[^a-zA-Z0-9]/g, '') + '_' + ts;

                                    const newObj = {
                                        id: uniqueId, title: textEl.innerText, eventType: evtType,
                                        lat: jittered.lat, lng: jittered.lng, location: key.toUpperCase(), 
                                        timestamp: ts, source: sourceName, mediaHTML: mediaHTML
                                    };
                                    
                                    if(!globalIntelData.some(d => Math.abs(d.timestamp - newObj.timestamp) < 300000 && d.location === newObj.location)) {
                                        globalIntelData.push(newObj);
                                        renderMapData();
                                        set(ref(db, 'mapEvents/' + uniqueId), newObj);
                                        
                                        // FIX: Trigger global UI alert on new map event
                                        triggerGlobalAlert(evtType);
                                    }
                                    break;
                                }
                            }
                        }
                    }
                });
            }
        });
    } catch (err) {}
}

// FIX: Instant Progressive Loading for news feeds
window.loadFeeds = async function() {
    newsSources.forEach(async (u) => {
        try {
            const html = await fetchWithFastestProxy(`https://t.me/s/${u}`, 'html');
            if (!html) return;

            const doc = new DOMParser().parseFromString(html, 'text/html');
            const sourceName = u.toUpperCase();
            let newItemsFound = false;

            doc.querySelectorAll('.tgme_widget_message').forEach(msg => {
                const textEl = msg.querySelector('.tgme_widget_message_text');
                const dateEl = msg.querySelector('time.time');
                if(textEl && dateEl) {
                    let text = textEl.innerText.replace(/[\n\r]+/g, ' - ').replace(/(<([^>]+)>)/gi, "").replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
                    let lowerText = text.toLowerCase();
                    
                    let isRelevantNews = false;
                    if (lowerText.includes('israel') || lowerText.includes('iran') || lowerText.includes('idf') || lowerText.includes('irgc') || lowerText.includes('hezbollah')) {
                            isRelevantNews = true;
                    }

                    let matchedLat = null, matchedLng = null, matchedLoc = null, evtType = 'missile';
                    for (const [key, geoData] of Object.entries(geoDB)) {
                        if (geoData.aliases.some(a => lowerText.includes(a))) {
                            let jittered = getJitteredCoords(geoData.coords[1], geoData.coords[0]);
                            matchedLat = jittered.lat; matchedLng = jittered.lng; matchedLoc = key.toUpperCase();
                            if(lowerText.includes('siren')) evtType = 'siren';
                            else if(lowerText.includes('drone')) evtType = 'drone';
                            else if(lowerText.includes('intercept')) evtType = 'intercept';
                            isRelevantNews = true;
                            break;
                        }
                    }
                    
                    if (!isRelevantNews) return;

                    let mediaHTML = '';
                    const photoWrap = msg.querySelector('.tgme_widget_message_photo_wrap');
                    if (photoWrap && photoWrap.style.backgroundImage) {
                        const urlMatch = photoWrap.style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
                        if (urlMatch && urlMatch[1]) {
                            mediaHTML = `<img src="${urlMatch[1]}" style="width:100%; display:block; border-radius:6px; max-height:180px; object-fit:contain; border: 1px solid rgba(255,255,255,0.1);" />`;
                        }
                    }
                    const videoWrap = msg.querySelector('video');
                    if (videoWrap && videoWrap.src) {
                        mediaHTML = `
                        <div style="position:relative; width:100%; border-radius:6px; overflow:hidden; border: 1px solid rgba(255,255,255,0.1); background:#000;">
                            <video src="${videoWrap.src}" autoplay loop muted playsinline onclick="this.muted=!this.muted; this.nextElementSibling.innerText = this.muted ? '🔇 TAP TO UNMUTE' : '🔊 MUTE'" style="width:100%; display:block; max-height:180px; object-fit:contain; cursor:pointer;"></video>
                            <div style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.8); color:#fff; font-size:0.6rem; font-weight:bold; padding:4px 8px; border-radius:4px; pointer-events:none;">🔇 TAP TO UNMUTE</div>
                        </div>`;
                    }

                    let ts = new Date(dateEl.getAttribute('datetime')).getTime();
                    const uniqueId = sourceName.replace(/[^a-zA-Z0-9]/g, '') + '_' + ts;

                    const newNewsObj = { 
                        id: uniqueId,
                        channel: sourceName, text: text, date: ts, 
                        mediaHTML: mediaHTML,
                        lat: matchedLat, lng: matchedLng, location: matchedLoc, eventType: evtType
                    };

                    if(!allNewsData.some(d => d.id === uniqueId)) {
                        allNewsData.push(newNewsObj);
                        newItemsFound = true;
                    }
                }
            });

            if(newItemsFound) { renderNewsFeeds(); }

        } catch (e) {}
    });
}

window.renderNewsFeeds = function() {
    const nowMs = Date.now();
    let processedNews = allNewsData.map(p => { p.timeAgo = (nowMs - p.date) / 3600000; return p; })
        .filter(p => p.timeAgo <= 999999 && p.timeAgo >= 0) 
        .sort((a,b) => a.timeAgo - b.timeAgo);

    const renderList = (posts, elId, limit, isSummary = false) => {
        let html = '';
        posts.slice(0, limit).forEach(p => {
            let minutesAgo = Math.max(0, Math.floor(p.timeAgo * 60));
            let timeLabel = p.timeAgo > 1000 ? "ARCHIVE" : (minutesAgo < 1 ? "Just now" : minutesAgo < 60 ? minutesAgo + "m ago" : Math.floor(minutesAgo/60) + "h ago");
            let tStr = `<span style="color: #30d158 !important; font-weight: 700;">${timeLabel}</span>`;
            
            // FIX: Removed clickLogic entirely so it no longer takes the user to the map tab
            let clickLogic = ''; 
            let pinIcon = '';
            if(p.lat && p.lng) {
                pinIcon = `<span style="color: #ff3b30; margin-right: 4px;">📍</span>`;
            }

            if(isSummary) {
                html += `<div class="sc-list-item" ${clickLogic}><div class="sc-summary-text">${pinIcon}${p.text}</div></div>`;
            } else {
                html += `
                <div class="sc-list-item" ${clickLogic}>
                    <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
                        <span style="font-weight: 700; color: #fff;">${pinIcon}${p.channel.replace('_TG','')}</span>${tStr}
                    </div>
                    <div style="color: #d1d1d6; line-height: 1.4; font-size: 0.75rem;">${p.text}</div>
                    ${p.mediaHTML ? `<div style="margin-top: 8px; width: 100%; border-radius: 6px; overflow: hidden;">${p.mediaHTML}</div>` : ''}
                </div>`;
            }
        });
        document.getElementById(elId).innerHTML = html || '<div style="padding:15px; color:#888; font-size:0.75rem;">No recent combat updates.</div>';
    };

    renderList(processedNews, 'news-feed', 50, false);
    
    let summaryPosts = processedNews.filter(p => p.timeAgo <= 48 && p.text.length < 150); 
    renderList(summaryPosts, 'summary-feed', 5, true); 
    
    renderList(processedNews.filter(p => 
        (p.text.includes('Iran') || p.text.includes('IRAN') || p.channel.includes('IRAN')) && 
        p.channel !== 'ME_OBSERVER_TG'
    ), 'iran-news-feed', 20, false);

    renderList(processedNews.filter(p => 
        (p.text.includes('Israel') || p.text.includes('ISRAEL') || p.text.includes('Tel Aviv') || p.text.includes('IDF')) && 
        p.channel !== 'PRESSTV' && p.channel !== 'ME_OBSERVER_TG'
    ), 'israel-news-feed', 20, false);
    
    let tickerPosts = processedNews.filter(p => (p.channel.includes('PRESS') || p.channel.includes('CLASH') || p.channel.includes('ALJAZEERA')) && p.text.length > 15 && p.text.length <= 150);
    if(tickerPosts.length === 0) tickerPosts = processedNews.slice(0,5); 
    let tickerHtml = '';
    tickerPosts.slice(0,8).forEach(p => { tickerHtml += `<span class="ticker-item">🚨 ${p.text.toUpperCase()}</span>`; });
    const tickerEl = document.getElementById('live-ticker');
    tickerEl.innerHTML = tickerHtml + tickerHtml; 
    tickerEl.style.animation = 'none'; tickerEl.offsetHeight; 
    tickerEl.style.animation = `ticker ${Math.max(tickerHtml.length * 0.15, 30)}s linear infinite`;
    document.getElementById('ticker-container').style.opacity = '1';
}

// ==========================================
// 7. MAP RENDERING & SAFE POPUPS
// ==========================================
window.setFilter = function(hours) {
    currentFilterHours = hours;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(hours === 24 ? 'btn-24' : 'btn-999999').classList.add('active');
    renderMapData();
}

window.safeFlyToLoc = function(targetId) {
    let targetData = globalIntelData.find(d => d.id === targetId);
    
    if (!targetData) {
        let newsItem = allNewsData.find(d => d.id === targetId);
        if(newsItem) {
            let minutesAgo = Math.max(0, Math.floor(((Date.now() - newsItem.date) / 3600000) * 60));
            let timeText = minutesAgo > 1000 ? "ARCHIVE" : (minutesAgo < 1 ? "JUST NOW" : minutesAgo < 60 ? `${minutesAgo}M AGO` : `${Math.floor(minutesAgo/60)}H AGO`);
            targetData = {
                lat: newsItem.lat, lng: newsItem.lng, id: newsItem.id, location: newsItem.location,
                eventType: newsItem.eventType, title: newsItem.text, source: newsItem.channel,
                mediaHTML: newsItem.mediaHTML || '', timeText: timeText
            };
            targetData.hex = targetData.eventType === 'siren' ? '#0a84ff' : targetData.eventType === 'drone' ? '#ff9f0a' : targetData.eventType === 'intercept' ? '#98989d' : '#ff3b30';
        }
    }

    if (!targetData) return;

    map.flyTo({ center: [targetData.lng, targetData.lat], zoom: 6.5, essential: true, speed: 1.2 });
    
    if(!document.getElementById('map-section').classList.contains('active-tab')) {
        switchTab('map-section', document.querySelector('.mac-dock .nav-item:first-child'));
    }

    document.getElementById('map-bottom-sheet').classList.remove('open'); 
    document.querySelectorAll('.zero-marker').forEach(m => m.classList.remove('active-marker'));
    
    const activeMarker = document.getElementById('marker-' + targetData.id);
    if(activeMarker) activeMarker.classList.add('active-marker');
    
    document.getElementById('custom-popup-content').innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">
            <strong style="color:${targetData.hex}; font-size:1.1em; letter-spacing: 1px;">${targetData.location}</strong>
        </div>
        <div style="font-size:0.95em; line-height:1.5; color: #f5f5f7;">${targetData.title}</div>
        <div style="width: 100%; display: ${targetData.mediaHTML ? 'block' : 'none'}; margin-top: 10px; border-radius: 6px;">
            ${targetData.mediaHTML}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 8px; margin-top:12px;">
            <span style="font-size:0.7em; color:#888; text-transform:uppercase; font-weight: bold;">SOURCE: ${targetData.source}</span>
            <span style="color:#30d158 !important; font-size:0.75em; font-weight:700; font-family: var(--font-mono);">${targetData.timeText || "RECENT"}</span>
        </div>
    `;
    
    setTimeout(() => { document.getElementById('custom-popup').classList.remove('hidden'); }, 800);
}

function renderMapData() {
    activeMapMarkers.forEach(m => m.remove());
    activeMapMarkers = []; 

    const feedElement = document.getElementById('feed');
    feedElement.innerHTML = '';
    const nowMs = Date.now();

    const filtered = globalIntelData.map(d => { 
            d.timeAgo = (nowMs - d.timestamp) / 3600000; 
            return d; 
        })
        .filter(d => d.timeAgo <= currentFilterHours && d.timeAgo >= 0)
        .sort((a,b) => a.timeAgo - b.timeAgo).slice(0, 500); 

    if (!filtered.length) {
        feedElement.innerHTML = '<div style="color: #666; text-align: center; padding: 30px 0; font-weight: bold; font-size: 0.75rem;">NO DETECTIONS FOUND</div>'; 
        return;
    }

    filtered.forEach(strike => {
        let minutesAgo = Math.max(0, Math.floor(strike.timeAgo * 60));
        strike.timeText = strike.timeAgo > 1000 ? "ARCHIVE" : (minutesAgo < 1 ? "JUST NOW" : minutesAgo < 60 ? `${minutesAgo}M AGO` : `${Math.floor(minutesAgo/60)}H AGO`);
        strike.hex = strike.eventType === 'siren' ? '#0a84ff' : strike.eventType === 'drone' ? '#ff9f0a' : strike.eventType === 'intercept' ? '#98989d' : '#ff3b30';

        feedElement.insertAdjacentHTML('beforeend', `
            <div class="feed-entry ${strike.eventType}" onclick="safeFlyToLoc('${strike.id}')">
                <div class="entry-time"><span style="color:${strike.hex}">[ ${strike.source} ]</span><span style="color: #30d158 !important;">${strike.timeText}</span></div>
                <div class="entry-desc" style="font-size: 0.7rem; line-height: 1.2;"><strong style="color: #fff;">${strike.location}:</strong> ${strike.title.substring(0,85)}...</div>
            </div>
        `);

        const elContainer = document.createElement('div'); 
        elContainer.className = 'zero-marker';
        elContainer.id = 'marker-' + strike.id;

        if (strike.timeAgo <= 0.166) { elContainer.classList.add('is-recent'); }
        
        const dot = document.createElement('div'); dot.className = `zero-dot`; dot.style.borderColor = strike.hex; dot.style.backgroundColor = strike.hex; elContainer.appendChild(dot);
        const ring = document.createElement('div'); ring.className = 'zero-pulse'; ring.style.borderColor = strike.hex; elContainer.appendChild(ring);
        
        if (strike.eventType === 'siren') {
            const sirenRadar = document.createElement('div');
            sirenRadar.className = 'siren-radius';
            if (strike.timeAgo <= 1) {
                sirenRadar.classList.add('siren-active');
            }
            elContainer.appendChild(sirenRadar);
        }

        const marker = new maplibregl.Marker({ element: elContainer, anchor: 'center' }).setLngLat([strike.lng, strike.lat]).addTo(map);
        elContainer.addEventListener('click', (e) => { e.stopPropagation(); safeFlyToLoc(strike.id); });
        activeMapMarkers.push(marker);
    });
}

// Initialization Triggers
window.onload = () => {
    enforceStackingRunways();
    setFilter(999999); 
    
    renderMapData();
    renderNewsFeeds(); // Baseline renders instantly
    
    fetchLiveOSINT();
    loadFeeds(); // Scrapes stream in progressively behind the scenes
    
    setInterval(fetchLiveOSINT, 60000); 
    setInterval(loadFeeds, 180000); 
};
