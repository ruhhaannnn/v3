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
    center: [44.0, 29.0], 
    zoom: 3.5, 
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
    }, 6000); 
};

function enforceStackingRunways() {
    document.querySelectorAll('.stacked-dashboard').forEach(dash => {
        if (!dash.querySelector('.js-runway')) {
            let runway = document.createElement('div');
            runway.className = 'js-runway';
            runway.style.height = '300vh'; 
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
    map.flyTo({ center: [44.0, 29.0], zoom: 3.5, essential: true, speed: 1.0 }); 
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
    // Pause media when navigating away
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
        
        // AUTOPLAY: Trigger Live Streams immediately upon entering the Live Tab
        if (tabId === 'live-section') {
            document.querySelectorAll('.live-cam-wrapper iframe').forEach(iframe => {
                iframe.contentWindow.postMessage(JSON.stringify({ "event": "command", "func": "playVideo", "args": [] }), '*');
            });
            document.querySelectorAll('.custom-play-btn').forEach(btn => btn.innerText = '[ PAUSE ]');
        }

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
  {"id":"feb28_isfahan_01","title":"IAF Strikes Dozens of Defense Industrial Base Targets","location":"ISFAHAN, IRAN","lat":32.6539,"lng":51.6660,"eventType":"missile","timestamp":1772271000000,"source":"JINSA / IDF"},
  {"id":"feb28_04","title":"Iranian Retaliation: 9 Waves of Missiles Trigger Shelters","location":"TEL AVIV, ISRAEL","lat":32.0853,"lng":34.7818,"eventType":"siren","timestamp":1772286000000,"source":"AP News"},
  {"id":"feb28_05","title":"Iranian Retaliation: 8 Waves of Missiles Fired","location":"NORTHERN ISRAEL","lat":33.1,"lng":35.5,"eventType":"siren","timestamp":1772289600000,"source":"Alma Research Center"},
  {"id":"feb28_06","title":"Drone Strike on Zayed International Airport (1 Killed, 7 Injured)","location":"ABU DHABI, UAE","lat":24.4329,"lng":54.6511,"eventType":"drone","timestamp":1772293200000,"source":"AP News"},
  {"id":"feb28_07","title":"Drone/Missile Strike on Dubai International Airport (4 Injured)","location":"DUBAI, UAE","lat":25.2532,"lng":55.3657,"eventType":"drone","timestamp":1772296800000,"source":"AP News"},
  {"id":"feb28_08","title":"Iranian Strikes Target US Base and Kuwait International Airport","location":"KUWAIT CITY, KUWAIT","lat":29.2266,"lng":47.98,"eventType":"missile","timestamp":1772300400000,"source":"AP News"},
  {"id":"feb28_09","title":"Iranian Retaliatory Strike on US Forces Facility","location":"MANAMA, BAHRAIN","lat":26.2285,"lng":50.586,"eventType":"missile","timestamp":1772304000000,"source":"UK Parliament Report / Alma"},
  {"id":"feb28_10","title":"Iranian Retaliatory Strike on US Forces Facility","location":"DOHA, QATAR","lat":25.2854,"lng":51.531,"eventType":"missile","timestamp":1772307600000,"source":"Alma Research Center"},
  {"id":"feb28_11","title":"Iranian Retaliatory Strike on US Base","location":"AMMAN, JORDAN","lat":31.9522,"lng":35.2332,"eventType":"drone","timestamp":1772311200000,"source":"Alma Research Center"},
  {"id":"mar01_01","title":"Follow-up Strike on Khamenei Compound","location":"TEHRAN, IRAN","lat":35.6892,"lng":51.389,"eventType":"missile","timestamp":1772323200000,"source":"Vision IAS / Wikipedia"},
  {"id":"mar01_02","title":"Drone Strike Hits Dubai International Airport Terminal 3","location":"DUBAI, UAE","lat":25.2532,"lng":55.3657,"eventType":"drone","timestamp":1772334600000,"source":"Wikipedia / OSINT"},
  {"id":"mar01_shiraz_01","title":"Air Defense Suppression Strikes on Shahid Dastghaib Air Base","location":"SHIRAZ, IRAN","lat":29.5392,"lng":52.5898,"eventType":"missile","timestamp":1772340000000,"source":"OSINT / US DoD"},
  {"id":"mar01_04","title":"Drones Strike French Naval Air Base Camp de la Paix","location":"ABU DHABI, UAE","lat":24.5106,"lng":54.3977,"eventType":"drone","timestamp":1772341800000,"source":"Wikipedia"},
  {"id":"mar01_06","title":"Drone and Missile Attacks on Military Bases by Militias","location":"ERBIL, IRAQ","lat":36.1901,"lng":44.009,"eventType":"drone","timestamp":1772359800000,"source":"ISW"},
  {"id":"mar01_07","title":"Iranian Missiles Strike Public Shelter","location":"BEIT SHEMESH, ISRAEL","lat":31.747,"lng":34.9881,"eventType":"missile","timestamp":1772363400000,"source":"ACLED"},
  {"id":"mar01_08","title":"Iranian-Made Drone Hits UK Akrotiri Air Force Base","location":"AKROTIRI, CYPRUS","lat":34.5833,"lng":32.9833,"eventType":"drone","timestamp":1772370600000,"source":"The Hindu / UK Defence Ministry"},
  {"id":"mar02_teh_01","title":"Air Defense Sirens Triggered Near Mehrabad International Airport","location":"TEHRAN, IRAN","lat":35.6892,"lng":51.3125,"eventType":"siren","timestamp":1772434800000,"source":"Local Telegram Channels / OSINT"},
  {"id":"mar02_01","title":"US Embassy Hit by Two Drones, Sparking Fire","location":"RIYADH, SAUDI ARABIA","lat":24.6828,"lng":46.6219,"eventType":"drone","timestamp":1772452800000,"source":"Saudi Confirmation / The Guardian"},
  {"id":"mar02_02","title":"Iranian Drones Hit UAE Airbase","location":"ABU DHABI, UAE","lat":24.4539,"lng":54.3773,"eventType":"drone","timestamp":1772456400000,"source":"Australian Gov / The Guardian"},
  {"id":"mar02_04","title":"Drone Attack Halts Operations at Ras Tanura Refinery","location":"RAS TANURA, SAUDI ARABIA","lat":26.6425,"lng":50.1017,"eventType":"drone","timestamp":1772463600000,"source":"The Guardian"},
  {"id":"mar02_06","title":"Six Missile Barrages Fired at Israel","location":"ISRAEL (NATIONWIDE)","lat":31.0461,"lng":34.8516,"eventType":"missile","timestamp":1772470800000,"source":"ISW"},
  {"id":"mar02_syr_01","title":"US and Israeli Jets Strike IRGC Weapons Depots","location":"ALEPPO, SYRIA","lat":36.2021,"lng":37.1343,"eventType":"missile","timestamp":1772434800000,"source":"OSINT / Al Jazeera"},
  {"id":"mar03_01","title":"Air Defenses Intercept New Wave of Missiles from Iran","location":"ISRAEL (NATIONWIDE)","lat":31.0461,"lng":34.8516,"eventType":"intercept","timestamp":1772506800000,"source":"IDF / AFP"},
  {"id":"mar03_02","title":"Powerful Explosions Heard in Capital","location":"TEHRAN, IRAN","lat":35.6892,"lng":51.389,"eventType":"missile","timestamp":1772511300000,"source":"AFP / Local Media"},
  {"id":"mar03_04","title":"Drone Strikes US Consulate Building","location":"DUBAI, UAE","lat":25.26,"lng":55.3,"eventType":"drone","timestamp":1772529300000,"source":"ISW"},
  {"id":"mar03_05","title":"Six Missile Barrages Fired; Cluster Munition Hits Near Tel Aviv","location":"TEL AVIV, ISRAEL","lat":32.0853,"lng":34.7818,"eventType":"missile","timestamp":1772536500000,"source":"ISW"},
  {"id":"mar04_01","title":"IDF Strikes IRGC Intelligence Headquarters","location":"TEHRAN, IRAN","lat":35.6892,"lng":51.389,"eventType":"missile","timestamp":1772625600000,"source":"ISW / IDF"},
  {"id":"mar04_shiraz_01","title":"Heavy Explosions Reported Near IRGC Aerospace Facilities","location":"SHIRAZ, IRAN","lat":29.5918,"lng":52.5836,"eventType":"missile","timestamp":1772618400000,"source":"IranWire / Local Media"},
  {"id":"mar05_02","title":"Massive Interception: 125 Drones and 6 Missiles Downed","location":"ABU DHABI, UAE","lat":24.4539,"lng":54.3773,"eventType":"intercept","timestamp":1772712000000,"source":"Emirati Defense Ministry"},
  {"id":"mar06_01","title":"U.S. and Israeli Airstrikes Target Iranian Naval and Missile Infrastructure","location":"BANDAR ABBAS, IRAN","lat":27.1832,"lng":56.2666,"eventType":"missile","timestamp":1772784000000,"source":"US DoD / IDF"},
  {"id":"mar07_shiraz_01","title":"Widespread Sirens and Power Outages Following Suspected Cyber/Kinetic Attack","location":"SHIRAZ, IRAN","lat":29.6100,"lng":52.5300,"eventType":"siren","timestamp":1772884800000,"source":"Local Telegram Channels"},
  {"id":"mar07_teh_01","title":"Explosions Reported at Military Logistics Hub on Western Outskirts","location":"KARAJ (GREATER TEHRAN), IRAN","lat":35.8327,"lng":50.9915,"eventType":"missile","timestamp":1772866800000,"source":"IranWire"},
  {"id":"mar07_02","title":"Drone Strike Causes Minor Damage Near Commercial Port","location":"JEBEL ALI, DUBAI, UAE","lat":24.9857,"lng":55.0602,"eventType":"drone","timestamp":1772892000000,"source":"Dubai Media Office"},
  {"id":"mar08_02","title":"US Navy Destroyers Intercept Incoming Ballistic Missiles","location":"PERSIAN GULF","lat":26.0,"lng":52.0,"eventType":"intercept","timestamp":1772964000000,"source":"CENTCOM / Bloomberg"},
  {"id":"mar08_isr_01","title":"Saturation Attack: Multi-Layered Defenses Engage Mass Salvos of Loitering Munitions","location":"HAIFA, ISRAEL","lat":32.7940,"lng":34.9892,"eventType":"intercept","timestamp":1772960400000,"source":"Times of India / Bloomberg"},
  {"id":"mar09_01","title":"Drone Strike Targets Commercial Vessel in Strait of Hormuz","location":"STRAIT OF HORMUZ","lat":26.5667,"lng":56.25,"eventType":"drone","timestamp":1773043200000,"source":"UKMTO"},
  {"id":"mar10_shiraz_01","title":"Coordinated Israeli Strikes Target Military Infrastructure and Airbases","location":"SHIRAZ, IRAN","lat":29.5918,"lng":52.5836,"eventType":"missile","timestamp":1773144000000,"source":"IranWire / IDF"},
  {"id":"mar11_06","title":"39 Drones Intercepted; Two Strike Near International Airport","location":"DUBAI, UAE","lat":25.2532,"lng":55.3657,"eventType":"drone","timestamp":1773244800000,"source":"ISW / UAE Ministry of Interior"},
  {"id":"mar12_01","title":"Airstrikes Target Iranian Weapons Transfer Hubs","location":"DAMASCUS, SYRIA","lat":33.5138,"lng":36.2765,"eventType":"missile","timestamp":1773280800000,"source":"SOHR / OSINT","mediaHTML":"<iframe width='100%' height='200' src='https://www.youtube.com/embed/lojCspTCpAA?autoplay=1&mute=1&controls=0' frameborder='0' allow='autoplay; encrypted-media' style='border-radius:4px; margin-top:8px; border: 1px solid #333;'></iframe>"},
  {"id":"mar12_shiraz_01","title":"IAF Destroys Subterranean Ballistic Missile Manufacturing Site","location":"SHIRAZ, IRAN","lat":29.5918,"lng":52.5836,"eventType":"missile","timestamp":1773316800000,"source":"Times of Israel / IDF"},
  {"id":"mar13_02","title":"Drone Strike Attempt Intercepted; Debris Falls in Commercial Zone","location":"DUBAI, UAE","lat":25.2048,"lng":55.2708,"eventType":"drone","timestamp":1773373500000,"source":"Dubai Media Office / Gulf News"},
  {"id":"mar14_01","title":"US Strikes Iranian Military Infrastructure on Kharg Island","location":"KHARG ISLAND, IRAN","lat":29.2333,"lng":50.3167,"eventType":"missile","timestamp":1773450000000,"source":"US War Dept","videoSrc":"https://d34w7g4gy10iej.cloudfront.net/video/2603/DOD_111580077/DOD_111580077.mp4"},
  {"id":"mar14_teh_01","title":"Airstrikes Hit Iran's Space Research Centre","location":"TEHRAN, IRAN","lat":35.6892,"lng":51.3890,"eventType":"missile","timestamp":1773465000000,"source":"Al Jazeera / OSINT"},
  {"id":"mar15_01","title":"IDF Strikes Over 200 Targets Across Western and Central Iran","location":"WESTERN IRAN","lat":34.3142,"lng":47.0650,"eventType":"missile","timestamp":1773536400000,"source":"IDF / DoD","videoSrc":"https://d34w7g4gy10iej.cloudfront.net/video/2603/DOD_111551494/DOD_111551494.mp4"},
  {"id":"mar15_shiraz_01","title":"Deep Penetration Strikes Target Airbase and Military Infrastructure","location":"SHIRAZ, IRAN","lat":29.5918,"lng":52.5836,"eventType":"missile","timestamp":1773550000000,"source":"JINSA / IDF"},
  {"id":"mar16_teh_01","title":"Israel Confirms Over 7,600 Strikes Conducted on Iran","location":"TEHRAN, IRAN","lat":35.6892,"lng":51.3890,"eventType":"missile","timestamp":1773622800000,"source":"FDD / IDF","videoSrc":"https://d34w7g4gy10iej.cloudfront.net/video/2603/DOD_111565192/DOD_111565192-1920x1080-9000k.mp4"},
  {"id":"mar17_teh_01","title":"Decapitation Strike Eliminates Senior Official Ali Larijani","location":"TEHRAN, IRAN","lat":35.6944,"lng":51.4215,"eventType":"missile","timestamp":1773662400000,"source":"Vision IAS"},
  {"id":"mar18_omn_01","title":"Port Infrastructure Targeted in Drone Attack","location":"MUSCAT, OMAN","lat":23.5859,"lng":58.4059,"eventType":"drone","timestamp":1773735000000,"source":"OSINT"},
  {"id":"mar19_dxb_01","title":"Projectile Strikes Road Near Al Minhad Air Base","location":"DUBAI, UAE","lat":25.0260,"lng":55.3660,"eventType":"missile","timestamp":1773832000000,"source":"Long War Journal / JINSA"},
  {"id":"mar20_01","title":"Iran Targets Commercial Shipping in Strait of Hormuz","location":"STRAIT OF HORMUZ","lat":26.5667,"lng":56.2500,"eventType":"drone","timestamp":1773936000000,"source":"UKMTO","mediaHTML":"<iframe width='100%' height='200' src='https://www.youtube.com/embed/9h7KjY8IunM?autoplay=1&mute=1&controls=0' frameborder='0' allow='autoplay; encrypted-media' style='border-radius:4px; margin-top:8px; border: 1px solid #333;'></iframe>"},
  {"id":"mar20_shiraz_01","title":"Airstrikes Target IRGC Imam Ali Garrison","location":"SHIRAZ, IRAN","lat":29.5918,"lng":52.5836,"eventType":"missile","timestamp":1773950000000,"source":"OSINT"},
  {"id":"mar21_teh_01","title":"Targeted Strike Eliminates IRGC Commander Saeed Agha Jani","location":"TEHRAN, IRAN","lat":35.6892,"lng":51.3890,"eventType":"missile","timestamp":1774045000000,"source":"Times of Israel","mediaHTML":"<iframe width='100%' height='200' src='https://www.youtube.com/embed/P9UPftLeCy0?autoplay=1&mute=1&controls=0' frameborder='0' allow='autoplay; encrypted-media' style='border-radius:4px; margin-top:8px; border: 1px solid #333;'></iframe>"},
  {"id":"mar22_isr_01","title":"Iranian Ballistic Missiles Strike Near Dimona Nuclear Site","location":"DIMONA, ISRAEL","lat":31.0650,"lng":35.0353,"eventType":"missile","timestamp":1774110000000,"source":"JINSA / Home Front Command"},
  {"id":"mar23_bhr_01","title":"Unprecedented Wave of 36 Drones Target Island Kingdom","location":"MANAMA, BAHRAIN","lat":26.2285,"lng":50.5860,"eventType":"drone","timestamp":1774165000000,"source":"JINSA"},
  {"id":"mar23_isr_01","title":"Mass Casualty Event in Central Israel Following Heavy Missile Barrage","location":"TEL AVIV, ISRAEL","lat":32.0853,"lng":34.7818,"eventType":"missile","timestamp":1774195000000,"source":"AP News / UN","mediaHTML":"<iframe width='100%' height='200' src='https://www.youtube.com/embed/S_8qK2G68fA?autoplay=1&mute=1&controls=0' frameborder='0' allow='autoplay; encrypted-media' style='border-radius:4px; margin-top:8px; border: 1px solid #333;'></iframe>"},
  {"id":"mar24_teh_01","title":"IDF Drops 100+ Bombs on IRGC Central Security HQ and Factories","location":"TEHRAN, IRAN","lat":35.6892,"lng":51.3890,"eventType":"missile","timestamp":1774245600000,"source":"JINSA / IDF"},
  {"id":"mar24_isr_01","title":"Ghadr Ballistic Missile Directly Impacts Upscale Neighborhood","location":"TEL AVIV, ISRAEL","lat":32.0853,"lng":34.7818,"eventType":"missile","timestamp":1774252000000,"source":"The Hindu / JNS"},
  {"id":"mar24_ksa_01","title":"13 Drone Attacks Launched Overnight Against Energy Assets","location":"EASTERN PROVINCE, SAUDI ARABIA","lat":26.2361,"lng":50.0393,"eventType":"drone","timestamp":1774260000000,"source":"JINSA"},
  {"id":"mar24_kwt_01","title":"Escalation: 17 Ballistic Missiles Fired at US Assets","location":"KUWAIT CITY, KUWAIT","lat":29.3759,"lng":47.9774,"eventType":"missile","timestamp":1774265000000,"source":"JINSA"},
  {"id":"mar25_teh_01","title":"New Wave of IDF Strikes Targets Infrastructure Across Capital","location":"TEHRAN, IRAN","lat":35.6892,"lng":51.3890,"eventType":"missile","timestamp":1774332000000,"source":"AFP / IDF"},
  {"id":"mar25_dxb_01","title":"Drone Strike Attempt on US Embassy","location":"DUBAI, UAE","lat":25.2600,"lng":55.3000,"eventType":"drone","timestamp":1774340000000,"source":"ICT / OSINT"},
  {"id":"mar25_syr_01","title":"US Army Precision Strike Missile (PrSM) Makes Combat Debut","location":"EASTERN SYRIA","lat":34.4553,"lng":40.9133,"eventType":"missile","timestamp":1774350000000,"source":"DefenseScoop"},
  {"id":"mar26_bandar_01","title":"US B-2 Bombers Obliterate Underground Anti-Ship Missile Silos","location":"BANDAR ABBAS, IRAN","lat":27.1832,"lng":56.2666,"eventType":"missile","timestamp":1774430000000,"source":"White House Press Briefing"},
  {"id":"mar26_isr_01","title":"Six Wounded as Iranian Missiles Strike Central Districts","location":"RISHON LEZION, ISRAEL","lat":31.9642,"lng":34.8044,"eventType":"missile","timestamp":1774436000000,"source":"JNS"},
  {"id":"mar04_leb_01","title":"Airstrikes Target Suspected Missile Depots in Bekaa Valley","location":"BEKAA VALLEY, LEBANON","lat":33.8400,"lng":36.0100,"eventType":"missile","timestamp":1772614800000,"source":"OSINT / IDF"},
  {"id":"mar05_irn_01","title":"Secondary Explosions Reported at Bandar Bushehr Naval Facility","location":"BUSHEHR, IRAN","lat":28.9700,"lng":50.8300,"eventType":"missile","timestamp":1772701200000,"source":"AMK Mapping"},
  {"id":"mar06_syr_01","title":"Airstrike Heavily Damages Runways at T4 Military Airbase","location":"HOMS GOVERNORATE, SYRIA","lat":34.5200,"lng":37.6200,"eventType":"missile","timestamp":1772787600000,"source":"SOHR / RNintel"},
  {"id":"mar07_isr_01","title":"Multiple Sirens Triggered by Drone Incursions Over Coastal City","location":"ASHKELON, ISRAEL","lat":31.6600,"lng":34.5700,"eventType":"siren","timestamp":1772874000000,"source":"Home Front Command"},
  {"id":"mar08_uae_01","title":"Air Defenses Intercept Loitering Munition Near Al Dhafra","location":"ABU DHABI, UAE","lat":24.2400,"lng":54.5400,"eventType":"intercept","timestamp":1772960400000,"source":"UAE Ministry of Defense"},
  {"id":"mar09_irq_01","title":"Militia Rocket Barrage Targets Al Asad Airbase","location":"AL ANBAR, IRAQ","lat":33.7900,"lng":42.4300,"eventType":"missile","timestamp":1773046800000,"source":"CENTCOM"},
  {"id":"mar11_qat_01","title":"Patriot Batteries Intercept Projectile Outside Al Udeid Perimeter","location":"DOHA, QATAR","lat":25.1100,"lng":51.3100,"eventType":"intercept","timestamp":1773219600000,"source":"OSINT / Press TV"},
  {"id":"mar12_ksa_02","title":"Houthi-Launched Drone Shot Down Approaching Southern Border","location":"NAJRAN, SAUDI ARABIA","lat":17.4900,"lng":44.1300,"eventType":"intercept","timestamp":1773306000000,"source":"Saudi Defence Ministry"},
  {"id":"mar13_isr_01","title":"Iron Dome Intercepts Heavy Rocket Barrage Over Northern Galilee","location":"SAFED, ISRAEL","lat":32.9600,"lng":35.4900,"eventType":"intercept","timestamp":1773392400000,"source":"IDF"},
  {"id":"mar14_leb_01","title":"Heavy Rocket Salvos Launched from Suspected Hezbollah Positions","location":"NABATIEH, LEBANON","lat":33.3700,"lng":35.4800,"eventType":"missile","timestamp":1773478800000,"source":"Middle East Observer"},
  {"id":"mar15_omn_01","title":"Omani Coast Guard Intercepts Suspicious Fast Boats Near Port","location":"DUQM, OMAN","lat":19.6600,"lng":57.7000,"eventType":"intercept","timestamp":1773565200000,"source":"Royal Oman Police"},
  {"id":"mar16_bhr_01","title":"Intercepted Drone Debris Falls Near Muharraq Residential Zone","location":"MUHARRAQ, BAHRAIN","lat":26.2600,"lng":50.6200,"eventType":"drone","timestamp":1773651600000,"source":"Bahrain Interior Ministry"},
  {"id":"mar17_syr_01","title":"Precision Strikes Target Warehouses at Damascus International Airport","location":"DAMASCUS, SYRIA","lat":33.4100,"lng":36.5100,"eventType":"missile","timestamp":1773738000000,"source":"SOHR"},
  {"id":"mar18_irn_01","title":"Suspected Sabotage Blast at Parchin Military Research Complex","location":"PARCHIN, IRAN","lat":35.5300,"lng":51.7700,"eventType":"missile","timestamp":1773824400000,"source":"Alma Research Center / JINSA"},
  {"id":"mar19_ksa_01","title":"Ballistic Missile Intercepted Over the Red Sea on Approach to City","location":"JEDDAH, SAUDI ARABIA","lat":21.4800,"lng":39.1900,"eventType":"intercept","timestamp":1773910800000,"source":"Saudi Press Agency"},
  {"id":"mar21_irn_01","title":"Airstrike Neutralizes Tabas Early Warning Radar Station","location":"TABAS, IRAN","lat":33.5900,"lng":56.9200,"eventType":"missile","timestamp":1774083600000,"source":"AMK Mapping"},
  {"id":"mar22_irq_01","title":"Unidentified Drone Intercepted Near Southern Oil Infrastructure","location":"BASRA, IRAQ","lat":30.5200,"lng":47.7700,"eventType":"intercept","timestamp":1774170000000,"source":"OSINT / RNintel"},
  {"id":"mar25_isr_01","title":"Projectile from the Red Sea Impacts Open Area Near Port","location":"EILAT, ISRAEL","lat":29.5500,"lng":34.9500,"eventType":"missile","timestamp":1774429200000,"source":"IDF"},
  {"id":"mar25_irn_02","title":"Strikes Hit Suspected Drone Launch Sites in the Southeast","location":"ZAHEDAN, IRAN","lat":29.4900,"lng":60.8600,"eventType":"missile","timestamp":1774432800000,"source":"Baloch Activist Channels / OSINT"},
  {"id":"mar26_leb_01","title":"IDF Artillery Targets Militant Infiltration Routes Near Border","location":"MAROUN AL-RAS, LEBANON","lat":33.0900,"lng":35.4400,"eventType":"missile","timestamp":1774483200000,"source":"IDF / Reuters"},
  {"id":"mar16_dxb_02","title":"Drone Incident Sparks Fire Near Dubai International Airport","location":"DUBAI, UAE","lat":25.2532,"lng":55.3657,"eventType":"drone","timestamp":1773651600000,"source":"Dubai Media Office"},
  {"id":"mar16_kharg_01","title":"US Military Obliterates Key Oil Infrastructure on Kharg Island","location":"KHARG ISLAND, IRAN","lat":29.2333,"lng":50.3167,"eventType":"missile","timestamp":1773655200000,"source":"White House / TOI"},
  {"id":"mar16_hormuz_01","title":"Strait of Hormuz Closed to US/Israeli Shipping; US Deploys Warships","location":"STRAIT OF HORMUZ","lat":26.5667,"lng":56.2500,"eventType":"intercept","timestamp":1773660000000,"source":"PTC News / US Navy"},
  {"id":"mar19_haifa_01","title":"Iranian Missile Strikes Oil Refinery","location":"HAIFA, ISRAEL","lat":32.7940,"lng":34.9892,"eventType":"missile","timestamp":1773910800000,"source":"Al Jazeera NewsFeed"},
  {"id":"mar19_irn_02","title":"US F-35 Makes Emergency Landing After Combat Mission Over Iran","location":"CENTRAL IRAN","lat":32.6539,"lng":51.6660,"eventType":"intercept","timestamp":1773918000000,"source":"US CENTCOM"},
  {"id":"mar20_syr_01","title":"Israeli Airstrikes Target Military Infrastructure in Southern Syria","location":"DARAA, SYRIA","lat":32.6243,"lng":36.1057,"eventType":"missile","timestamp":1773993600000,"source":"Al Jazeera"},
  {"id":"mar20_kwt_01","title":"Swarm Drones Strike Mina Al-Ahmadi Oil Refinery Causing Major Fire","location":"MINA AL-AHMADI, KUWAIT","lat":29.0790,"lng":48.1480,"eventType":"drone","timestamp":1774000800000,"source":"Al Jazeera"},
  {"id":"mar20_irq_01","title":"US Logistics Support Camp Near Airport Hit by Successive Attacks","location":"BAGHDAD, IRAQ","lat":33.2625,"lng":44.2344,"eventType":"missile","timestamp":1774008000000,"source":"Iraqi Security Sources"},
  {"id":"mar21_irq_01","title":"Drone Attack Targets Iraqi National Intelligence Service Headquarters","location":"BAGHDAD, IRAQ","lat":33.3152,"lng":44.3661,"eventType":"drone","timestamp":1774080000000,"source":"Iraqi Security Media"},
  {"id":"mar21_isr_02","title":"Direct Missile Hit on Dimona Town Leaves 39 Injured","location":"DIMONA, ISRAEL","lat":31.0650,"lng":35.0353,"eventType":"missile","timestamp":1774087200000,"source":"Magen David Adom / AFP"},
  {"id":"mar24_qat_01","title":"World's Largest LNG Facility at Ras Laffan Shut Down Following Strikes","location":"RAS LAFFAN, QATAR","lat":25.8940,"lng":51.5400,"eventType":"missile","timestamp":1774346400000,"source":"Defense Priorities"},
  {"id":"mar24_ksa_02","title":"Oil Fields Targeted; Kingdom Reroutes Oil to Red Sea Ports","location":"EASTERN PROVINCE, SAUDI ARABIA","lat":26.6425,"lng":50.1017,"eventType":"missile","timestamp":1774353600000,"source":"Defense Priorities"},
  {"id":"mar24_uae_01","title":"Massive Drone and Missile Barrage Impacts High-Rises and Commercial Zones","location":"ABU DHABI, UAE","lat":24.4539,"lng":54.3773,"eventType":"missile","timestamp":1774360800000,"source":"Defense Priorities"},
  {"id":"mar26_hormuz_01","title":"Iran Prepares to Mine Persian Gulf and Blockade Maritime Traffic","location":"PERSIAN GULF","lat":26.0000,"lng":52.0000,"eventType":"intercept","timestamp":1774512000000,"source":"Bloomberg / TOI"},
  {"id":"mar08_qat_01","title":"Loitering Munitions Intercepted on Approach to Al Udeid Air Base Perimeter","location":"DOHA, QATAR","lat":25.1181,"lng":51.3146,"eventType":"intercept","timestamp":1772965000000,"source":"CENTCOM / OSINT"},
  {"id":"mar13_shiraz_01","title":"Kinetic Strike Targets Substation Following Widespread Cyber Outage","location":"SHIRAZ, IRAN","lat":29.6100,"lng":52.5300,"eventType":"missile","timestamp":1773395000000,"source":"IranWire / JINSA"},
  {"id":"mar15_dxb_01","title":"Patriot Interceptor Debris Falls in Jebel Ali Free Zone Industrial Area","location":"JEBEL ALI, DUBAI, UAE","lat":24.9857,"lng":55.0602,"eventType":"intercept","timestamp":1773562000000,"source":"UAE Ministry of Defense"},
  {"id":"mar17_qat_01","title":"Unidentified Drone Swarm Tracked Near Commercial Maritime Routes","location":"DOHA PORT, QATAR","lat":25.2854,"lng":51.5310,"eventType":"siren","timestamp":1773735000000,"source":"UKMTO / Gulf News"},
  {"id":"mar18_shiraz_01","title":"Secondary Explosions Monitored at Shahid Dastghaib Air Base Munitions Depot","location":"SHIRAZ, IRAN","lat":29.5392,"lng":52.5898,"eventType":"missile","timestamp":1773822000000,"source":"Alma Research Center"},
  {"id":"mar22_dxb_01","title":"Air Traffic Diverted at Al Maktoum International Amid Drone Intercepts","location":"DUBAI SOUTH, UAE","lat":24.8965,"lng":55.1614,"eventType":"intercept","timestamp":1774175000000,"source":"OSINT / Aviation Trackers"},
  {"id":"mar01_yem_01","title":"US Navy Strikes Houthi Anti-Ship Missile Launchers","location":"HODEIDAH, YEMEN","lat":14.7969,"lng":42.9515,"eventType":"missile","timestamp":1772346000000,"source":"US CENTCOM"},
  {"id":"mar02_jor_01","title":"Jordanian Air Defenses Intercept Drones Breaching Airspace","location":"MAFRAQ, JORDAN","lat":32.3456,"lng":36.2082,"eventType":"intercept","timestamp":1772432400000,"source":"Jordanian Armed Forces"},
  {"id":"mar04_leb_02","title":"IAF Airstrikes Destroy Hezbollah Precision Missile Factory","location":"BAALBEK, LEBANON","lat":34.0058,"lng":36.2181,"eventType":"missile","timestamp":1772605200000,"source":"IDF / Reuters"},
  {"id":"mar05_yem_01","title":"Houthi Swarm Drones Target Commercial Shipping Lane","location":"RED SEA","lat":16.3262,"lng":41.2415,"eventType":"drone","timestamp":1772691600000,"source":"UKMTO"},
  {"id":"mar07_jor_01","title":"Debris from Intercepted Ballistic Missiles Falls in Desert Region","location":"ZARQA, JORDAN","lat":32.0728,"lng":36.0880,"eventType":"intercept","timestamp":1772864400000,"source":"Petra News Agency"},
  {"id":"mar09_syr_02","title":"Airstrikes Sever IRGC Supply Lines at Border Crossing","location":"ALBU KAMAL, SYRIA","lat":34.4553,"lng":40.9133,"eventType":"missile","timestamp":1773037200000,"source":"SOHR"},
  {"id":"mar11_irq_02","title":"Katyusha Rockets Impact Near US Embassy Green Zone","location":"BAGHDAD, IRAQ","lat":33.3030,"lng":44.3980,"eventType":"missile","timestamp":1773210000000,"source":"Iraqi Security Media"},
  {"id":"mar13_yem_01","title":"Coalition Forces Intercept Ballistic Missile Heading North","location":"SANA'A, YEMEN","lat":15.3694,"lng":44.1910,"eventType":"intercept","timestamp":1773382800000,"source":"Saudi MoD"},
  {"id":"mar15_leb_02","title":"Rocket Barrage Triggers Sirens Across Upper Galilee","location":"KIRYAT SHMONA, ISRAEL","lat":33.2073,"lng":35.5701,"eventType":"siren","timestamp":1773555600000,"source":"IDF Alerts"},
  {"id":"mar18_syr_02","title":"Drone Attack on Coalition Outpost Results in Minor Damage","location":"AL-TANF, SYRIA","lat":33.4079,"lng":38.9320,"eventType":"drone","timestamp":1773814800000,"source":"US CENTCOM"},
  {"id":"mar20_yem_01","title":"US/UK Joint Strikes Target Houthi Underground Storage Facilities","location":"SANA'A, YEMEN","lat":15.3694,"lng":44.1910,"eventType":"missile","timestamp":1773987600000,"source":"US DoD"},
  {"id":"mar22_leb_01","title":"IDF Targets Hezbollah Command Centers in Southern Suburbs","location":"BEIRUT, LEBANON","lat":33.8547,"lng":35.5088,"eventType":"missile","timestamp":1774160400000,"source":"IDF / Al Jazeera"},
  {"id":"mar24_yem_01","title":"Anti-Ship Ballistic Missile Strikes Greek-Owned Tanker","location":"GULF OF ADEN","lat":12.5000,"lng":45.0000,"eventType":"missile","timestamp":1774333200000,"source":"UKMTO / Bloomberg"},
  {"id":"mar26_jor_01","title":"Interception of Drones Crossing Northern Border Toward Israel","location":"IRBID, JORDAN","lat":32.5514,"lng":35.8515,"eventType":"intercept","timestamp":1774506000000,"source":"Jordanian Armed Forces"},
  {"id":"feb28_teh_01","title":"Decapitation Strike on Pasteur District: Supreme Leader Khamenei Killed","location":"TEHRAN, IRAN","lat":35.6892,"lng":51.3890,"eventType":"missile","timestamp":1772265600000,"source":"US DoD / IDF"},
  {"id":"feb28_teh_02","title":"Airstrikes Target Ministry of Defense and Atomic Energy HQ","location":"TEHRAN, IRAN","lat":35.7000,"lng":51.4000,"eventType":"missile","timestamp":1772266500000,"source":"Alma Research Center"},
  {"id":"mar02_teh_01","title":"Evacuation Warnings Issued for Evin District and IRIB Headquarters","location":"TEHRAN, IRAN","lat":35.7961,"lng":51.3836,"eventType":"siren","timestamp":1772434800000,"source":"IDF"},
  {"id":"mar03_teh_01","title":"Heavy U.S.-Israeli Strikes Leave Plumes of Smoke Over Capital","location":"TEHRAN, IRAN","lat":35.6892,"lng":51.3890,"eventType":"missile","timestamp":1772521200000,"source":"Britannica / OSINT"},
  {"id":"mar04_teh_01","title":"IDF Strikes IRGC Intelligence Headquarters","location":"TEHRAN, IRAN","lat":35.6892,"lng":51.3890,"eventType":"missile","timestamp":1772625600000,"source":"ISW / IDF"},
  {"id":"mar05_teh_01","title":"Unidentified Drones Intercepted Over Downtown Districts","location":"TEHRAN, IRAN","lat":35.6944,"lng":51.4215,"eventType":"intercept","timestamp":1772694000000,"source":"Fars News Agency"},
  {"id":"mar07_teh_01","title":"Explosions Reported at Military Logistics Hub on Western Outskirts","location":"KARAJ (GREATER TEHRAN), IRAN","lat":35.8327,"lng":50.9915,"eventType":"missile","timestamp":1772866800000,"source":"IranWire"},
  {"id":"mar08_teh_01","title":"Widespread Red Alert Sirens Across Northern Neighborhoods","location":"NORTHERN TEHRAN, IRAN","lat":35.7750,"lng":51.4333,"eventType":"siren","timestamp":1772953200000,"source":"OSINT"},
  {"id":"mar09_teh_01","title":"Strike Targets Suspected Drone Assembly Facility in Southern Industrial Zone","location":"REY (SOUTHERN TEHRAN), IRAN","lat":35.5833,"lng":51.4333,"eventType":"missile","timestamp":1773039600000,"source":"Alma Research Center"},
  {"id":"mar10_teh_01","title":"IAF Drops 170 Munitions on IRGC Quds Force Sites","location":"TEHRAN, IRAN","lat":35.6892,"lng":51.3890,"eventType":"missile","timestamp":1773144000000,"source":"ISW"},
  {"id":"mar12_teh_01","title":"Wave 13: IAF Jets Strike Central Tehran and Western IRGC Hubs","location":"TEHRAN, IRAN","lat":35.6892,"lng":51.3890,"eventType":"missile","timestamp":1773280800000,"source":"IDF"},
  {"id":"mar14_teh_01","title":"Airstrikes Hit Iran's Space Research Centre","location":"TEHRAN, IRAN","lat":35.6892,"lng":51.3890,"eventType":"missile","timestamp":1773465000000,"source":"Al Jazeera"},
  {"id":"mar17_teh_01","title":"Targeted Airstrike Eliminates De Facto Leader Ali Larijani","location":"EASTERN TEHRAN, IRAN","lat":35.7100,"lng":51.4500,"eventType":"missile","timestamp":1773662400000,"source":"The Guardian / OSINT"},
  {"id":"mar21_teh_01","title":"Targeted Strike Eliminates IRGC Commander Saeed Agha Jani","location":"TEHRAN, IRAN","lat":35.6892,"lng":51.3890,"eventType":"missile","timestamp":1774045000000,"source":"Times of Israel"},
  {"id":"mar24_teh_01","title":"IDF Drops 100+ Bombs on IRGC Central Security HQ and Factories","location":"TEHRAN, IRAN","lat":35.6892,"lng":51.3890,"eventType":"missile","timestamp":1774245600000,"source":"JINSA / IDF"},
  {"id":"mar25_teh_01","title":"Naval Missile Production Site Targeted in Fresh Wave of IDF Strikes","location":"TEHRAN, IRAN","lat":35.6892,"lng":51.3890,"eventType":"missile","timestamp":1774332000000,"source":"The Hindu / IDF"},
  {"id":"mar25_teh_02","title":"Residential Building Hit Amid Heavy Airstrikes; Rescuers Deployed","location":"TEHRAN, IRAN","lat":35.7000,"lng":51.4000,"eventType":"missile","timestamp":1774340000000,"source":"SNN News Agency / AFP"},
  {"id":"feb28_dxb_02","title":"Widespread Sirens Triggered Across Downtown and Marina Districts","location":"DUBAI, UAE","lat":25.2048,"lng":55.2708,"eventType":"siren","timestamp":1772290000000,"source":"Dubai Civil Defense"},
  {"id":"mar03_shiraz_02","title":"Air Defenses Engage Suspected Loitering Munitions Over City","location":"SHIRAZ, IRAN","lat":29.5918,"lng":52.5836,"eventType":"intercept","timestamp":1772525000000,"source":"Fars News / OSINT"},
  {"id":"mar04_dxb_01","title":"Kamikaze Drone Intercepted Off the Coast Near Jumeirah Beach","location":"DUBAI, UAE","lat":25.1412,"lng":55.1852,"eventType":"intercept","timestamp":1772630000000,"source":"UAE Ministry of Defense"},
  {"id":"mar06_shiraz_02","title":"IAF Strike Obliterates UAV Manufacturing Plant on City Outskirts","location":"SHIRAZ, IRAN","lat":29.5000,"lng":52.6000,"eventType":"missile","timestamp":1772785000000,"source":"Alma Research Center / IDF"},
  {"id":"mar08_dxb_01","title":"Interceptor Debris Causes Minor Damage in Deira Commercial District","location":"DEIRA, DUBAI, UAE","lat":25.2653,"lng":55.3117,"eventType":"intercept","timestamp":1772960000000,"source":"Dubai Media Office"},
  {"id":"mar10_shiraz_02","title":"Coordinated Bombardment of IRGC Command Centers","location":"SHIRAZ, IRAN","lat":29.5918,"lng":52.5836,"eventType":"missile","timestamp":1773129600000,"source":"IranWire / JINSA"},
  {"id":"mar11_dxb_02","title":"Proxy Drone Swarm Targets Jebel Ali Port Logistics Hub","location":"JEBEL ALI, DUBAI, UAE","lat":24.9857,"lng":55.0602,"eventType":"drone","timestamp":1773240000000,"source":"UKMTO / AMK Mapping"},
  {"id":"mar14_shiraz_01","title":"Airspace Completely Shut Down Amid Widespread Attack Sirens","location":"SHIRAZ, IRAN","lat":29.5392,"lng":52.5898,"eventType":"siren","timestamp":1773470000000,"source":"Aviation Trackers / OSINT"},
  {"id":"mar16_dxb_03","title":"Sirens Sound Across Marina District During Heavy Gulf Interceptions","location":"DUBAI MARINA, UAE","lat":25.0805,"lng":55.1403,"eventType":"siren","timestamp":1773660000000,"source":"Local Telegram Channels"},
  {"id":"mar19_shiraz_02","title":"Heavy Bunker-Buster Strikes Target Subterranean Missile Storage","location":"SHIRAZ, IRAN","lat":29.6100,"lng":52.5300,"eventType":"missile","timestamp":1773900000000,"source":"JINSA / IDF"},
  {"id":"mar21_dxb_01","title":"Suspected Drone Strike Attempt Intercepted Near Al Maktoum Airport","location":"DUBAI SOUTH, UAE","lat":24.8965,"lng":55.1614,"eventType":"intercept","timestamp":1774090000000,"source":"UAE Armed Forces"},
  {"id":"mar23_shiraz_01","title":"Air Defense Grid Active Against Suspected Israeli Drone Incursion","location":"SHIRAZ, IRAN","lat":29.5918,"lng":52.5836,"eventType":"intercept","timestamp":1774200000000,"source":"IRIB / OSINT"},
  {"id":"mar24_dxb_01","title":"Missile Intercepted Over Downtown; Debris Impacts Commercial Sector","location":"DOWNTOWN DUBAI, UAE","lat":25.1972,"lng":55.2744,"eventType":"intercept","timestamp":1774350000000,"source":"Dubai Media Office / Reuters"},
  {"id":"mar26_shiraz_01","title":"Dawn Airstrikes Destroy IRGC Logistics and Supply Hubs","location":"SHIRAZ, IRAN","lat":29.5918,"lng":52.5836,"eventType":"missile","timestamp":1774500000000,"source":"Middle East Observer"},
  {"id":"mar26_dxb_01","title":"Early Morning Alerts Triggered Due to Naval Engagements Offshore","location":"DUBAI, UAE","lat":25.2048,"lng":55.2708,"eventType":"siren","timestamp":1774510000000,"source":"UAE Ministry of Defense"},
  {"id":"feb28_tlv_02","title":"Swarm of Kamikaze Drones Intercepted Off the Coast","location":"NETANYA, ISRAEL","lat":32.3294,"lng":34.8565,"eventType":"intercept","timestamp":1772288000000,"source":"IDF / Home Front Command"},
  {"id":"mar02_tlv_01","title":"Shrapnel from Intercepted Ballistic Missile Damages Commercial Center","location":"PETAH TIKVA, ISRAEL","lat":32.0871,"lng":34.8869,"eventType":"missile","timestamp":1772450000000,"source":"Magen David Adom"},
  {"id":"mar04_tlv_02","title":"Massive Siren Alert Across Gush Dan; Dozens of Rockets Intercepted","location":"TEL AVIV, ISRAEL","lat":32.0853,"lng":34.7818,"eventType":"siren","timestamp":1772620000000,"source":"IDF Alerts"},
  {"id":"mar06_tlv_01","title":"Direct Missile Impact on Residential Block; Multiple Casualties Reported","location":"RAMAT GAN, ISRAEL","lat":32.0823,"lng":34.8105,"eventType":"missile","timestamp":1772790000000,"source":"AP News / JNS"},
  {"id":"mar09_tlv_01","title":"Drone Strike Attempt Intercepted; Flights Temporarily Suspended","location":"BEN GURION AIRPORT, ISRAEL","lat":32.0094,"lng":34.8828,"eventType":"drone","timestamp":1773050000000,"source":"Aviation Trackers / OSINT"},
  {"id":"mar11_tlv_01","title":"Arrow 3 System Intercepts Exoatmospheric Projectiles Above the Coast","location":"HERZLIYA, ISRAEL","lat":32.1624,"lng":34.8447,"eventType":"intercept","timestamp":1773220000000,"source":"IDF / Jerusalem Post"},
  {"id":"mar14_tlv_01","title":"Heavy Rocket Barrage Breaches Defenses, Striking Northern Suburbs","location":"TEL AVIV, ISRAEL","lat":32.1093,"lng":34.8000,"eventType":"missile","timestamp":1773480000000,"source":"Reuters"},
  {"id":"mar17_tlv_01","title":"Port Infrastructure Targeted by Loitering Munitions; Minor Damage","location":"ASHDOD, ISRAEL","lat":31.8044,"lng":34.6553,"eventType":"drone","timestamp":1773740000000,"source":"JINSA"},
  {"id":"mar19_tlv_01","title":"Low-Flying Cruise Missile Intercepted Over the Mediterranean Sea","location":"TEL AVIV (COAST), ISRAEL","lat":32.0853,"lng":34.7000,"eventType":"intercept","timestamp":1773910000000,"source":"IDF Naval Command"},
  {"id":"mar21_tlv_01","title":"Red Alert Sirens Trigger Mass Shelter Mobilization During Rush Hour","location":"RISHON LEZION, ISRAEL","lat":31.9642,"lng":34.8044,"eventType":"siren","timestamp":1774080000000,"source":"Home Front Command"},
  {"id":"mar23_tlv_02","title":"Coordinated Ballistic Strike Causes Widespread Power Outages","location":"TEL AVIV, ISRAEL","lat":32.0853,"lng":34.7818,"eventType":"missile","timestamp":1774250000000,"source":"The Hindu / Times of Israel"},
  {"id":"mar25_tlv_01","title":"Interception Debris Sets Fire to Vehicles and Property","location":"HOLON, ISRAEL","lat":32.0163,"lng":34.7732,"eventType":"intercept","timestamp":1774420000000,"source":"Fire and Rescue Services"},
  {"id":"mar26_tlv_01","title":"Early Morning Drone Swarm Intercepted Near Military Installation","location":"PALMACHIM AIRBASE, ISRAEL","lat":31.8977,"lng":34.6923,"eventType":"intercept","timestamp":1774500000000,"source":"Middle East Observer / IDF"},
  {"id":"mar03_hormuz_01","title":"IRGCN Fast Attack Craft Swarm Repelled by US Navy Destroyer","location":"STRAIT OF HORMUZ","lat":26.5667,"lng":56.2500,"eventType":"intercept","timestamp":1772500000000,"source":"US CENTCOM / UKMTO"},
  {"id":"mar05_qeshm_01","title":"Coalition Airstrikes Obliterate Coastal Anti-Ship Missile Batteries","location":"QESHM ISLAND, IRAN","lat":26.7565,"lng":55.8361,"eventType":"missile","timestamp":1772700000000,"source":"Alma Research Center / JINSA"},
  {"id":"mar08_oman_01","title":"Air Raid Sirens Sound at Port as Drone Swarm Violates Airspace","location":"MUSANDAM PENINSULA, OMAN","lat":26.1833,"lng":56.2500,"eventType":"siren","timestamp":1772960000000,"source":"Royal Oman Police / OSINT"},
  {"id":"mar10_hormuz_01","title":"Commercial Oil Tanker Struck by Loitering Munition; Major Fire Reported","location":"GULF OF OMAN","lat":24.9333,"lng":57.3500,"eventType":"drone","timestamp":1773100000000,"source":"UKMTO / Reuters"},
  {"id":"mar14_jask_01","title":"US B-1 Bombers Target Subterranean Submarine Pens and Naval Docks","location":"JASK, IRAN","lat":25.6436,"lng":57.7744,"eventType":"missile","timestamp":1773450000000,"source":"US DoD / Middle East Observer"},
  {"id":"mar17_hormuz_01","title":"Anti-Ship Ballistic Missile Intercepted by Carrier Strike Group Defenses","location":"STRAIT OF HORMUZ","lat":26.5667,"lng":56.2500,"eventType":"intercept","timestamp":1773730000000,"source":"US Navy / DefenseScoop"},
  {"id":"mar19_qeshm_01","title":"Secondary Explosions at IRGC Drone Launch Facilities Following Strikes","location":"QESHM ISLAND, IRAN","lat":26.7565,"lng":55.8361,"eventType":"missile","timestamp":1773910000000,"source":"ISW / AMK Mapping"},
  {"id":"mar22_hormuz_01","title":"General Alert Issued to All Commercial Shipping Amid Mine Threats","location":"STRAIT OF HORMUZ","lat":26.5667,"lng":56.2500,"eventType":"siren","timestamp":1774150000000,"source":"UKMTO / Bloomberg"},
  {"id":"mar24_oman_01","title":"Debris from Intercepted UAVs Washes Ashore Near Maritime Border","location":"KHASAB, OMAN","lat":26.1822,"lng":56.2472,"eventType":"intercept","timestamp":1774330000000,"source":"Oman News Agency"},
  {"id":"mar26_hormuz_01","title":"Massive Drone Swarm Launched Toward Coalition Fleet; Dozens Downed","location":"STRAIT OF HORMUZ","lat":26.5667,"lng":56.2500,"eventType":"drone","timestamp":1774500000000,"source":"US CENTCOM / RNintel"},
  {"id":"mar01_dam_01","title":"Precision Strike on IRGC Command Node in Sayyidah Zaynab","location":"DAMASCUS, SYRIA","lat":33.4444,"lng":36.3411,"eventType":"missile","timestamp":1772350000000,"source":"SOHR / JINSA"},
  {"id":"mar02_leb_01","title":"Heavy Airstrikes Target Subterranean Depots in Dahiyeh Suburbs","location":"BEIRUT, LEBANON","lat":33.8450,"lng":35.5080,"eventType":"missile","timestamp":1772445000000,"source":"IDF / Reuters"},
  {"id":"mar05_dam_01","title":"IAF Bombs Runways and Radars at Mezzeh Military Airport","location":"DAMASCUS, SYRIA","lat":33.4770,"lng":36.2230,"eventType":"missile","timestamp":1772710000000,"source":"SOHR"},
  {"id":"mar07_leb_01","title":"Airstrikes Obliterate Suspected Precision Missile Factories in Bekaa","location":"BAALBEK, LEBANON","lat":34.0058,"lng":36.2181,"eventType":"missile","timestamp":1772880000000,"source":"IDF / Al Jazeera"},
  {"id":"mar09_leb_01","title":"Drone Swarm Launch Attempt Intercepted Over the Mediterranean","location":"TYRE, LEBANON","lat":33.2705,"lng":35.2038,"eventType":"intercept","timestamp":1773055000000,"source":"IDF Naval Command"},
  {"id":"mar11_dam_01","title":"Bunker Busters Target Weapons Shipments at International Airport","location":"DAMASCUS, SYRIA","lat":33.4100,"lng":36.5100,"eventType":"missile","timestamp":1773230000000,"source":"Alma Research Center"},
  {"id":"mar14_leb_02","title":"IDF Artillery and Airstrikes Target Launch Sites North of the Litani","location":"NABATIEH, LEBANON","lat":33.3767,"lng":35.4836,"eventType":"missile","timestamp":1773490000000,"source":"Middle East Observer"},
  {"id":"mar16_dam_01","title":"Syrian Air Defenses Heavily Engaged Over Capital; Shrapnel Falls in City","location":"DAMASCUS, SYRIA","lat":33.5138,"lng":36.2765,"eventType":"intercept","timestamp":1773670000000,"source":"SANA / OSINT"},
  {"id":"mar19_leb_01","title":"Evacuation Sirens Triggered in Southern Suburbs Prior to Bombardment","location":"BEIRUT, LEBANON","lat":33.8450,"lng":35.5080,"eventType":"siren","timestamp":1773925000000,"source":"Local Civil Defense"},
  {"id":"mar22_leb_02","title":"Targeted Assassination Strike on Senior Militant Commander's Vehicle","location":"SIDON, LEBANON","lat":33.5571,"lng":35.3730,"eventType":"missile","timestamp":1774185000000,"source":"Times of Israel"},
  {"id":"mar25_dam_01","title":"Airstrike Neutralizes IRGC Weapons Convoy Approaching Lebanese Border","location":"ZABADANI, SYRIA","lat":33.7250,"lng":36.0970,"eventType":"missile","timestamp":1774440000000,"source":"OSINT / JINSA"},
  {"id":"mar27_leb_01","title":"Carpet Bombing Reported Along Border to Clear Infiltration Routes","location":"MAROUN AL-RAS, LEBANON","lat":33.0900,"lng":35.4400,"eventType":"missile","timestamp":1774615000000,"source":"Al Jazeera / IDF"},
  {"id":"mar28_dam_01","title":"High-Value Decapitation Strike Levers Residential Building in Kfar Sousah","location":"DAMASCUS, SYRIA","lat":33.4980,"lng":36.2710,"eventType":"missile","timestamp":1774698000000,"source":"SOHR / Reuters"},
  {"id":"mar04_hormuz_02","title":"US Navy MH-60R Helicopters Engage IRGCN Fast Attack Craft Laying Mines","location":"STRAIT OF HORMUZ","lat":26.5667,"lng":56.2500,"eventType":"intercept","timestamp":1772635000000,"source":"US CENTCOM / USNI News"},
  {"id":"mar07_larak_01","title":"Preemptive Airstrikes Destroy ASCM Batteries on Larak Island","location":"LARAK ISLAND, IRAN","lat":26.8533,"lng":56.3558,"eventType":"missile","timestamp":1772895000000,"source":"Alma Research Center"},
  {"id":"mar09_fuj_01","title":"Air Raid Sirens Triggered at Port of Fujairah Due to Gulf of Oman Engagements","location":"FUJAIRAH, UAE","lat":25.1672,"lng":56.3625,"eventType":"siren","timestamp":1773065000000,"source":"UAE Ministry of Defense"},
  {"id":"mar12_hormuz_02","title":"USS Arleigh Burke Intercepts Multiple Anti-Ship Cruise Missiles","location":"STRAIT OF HORMUZ","lat":26.5667,"lng":56.2500,"eventType":"intercept","timestamp":1773325000000,"source":"US Navy Fleet Forces"},
  {"id":"mar15_jask_02","title":"Bunker Buster Strikes Collapse Subterranean Tunnels Near Naval Base","location":"BANDAR-E JASK, IRAN","lat":25.6436,"lng":57.7744,"eventType":"missile","timestamp":1773585000000,"source":"Defense Priorities"},
  {"id":"mar18_hormuz_02","title":"VHF CH16 Broadcasts General Maritime Mayday Amid Active Combat in Transit Corridor","location":"STRAIT OF HORMUZ","lat":26.5667,"lng":56.2500,"eventType":"siren","timestamp":1773845000000,"source":"UKMTO / MarineTraffic"},
  {"id":"mar21_oman_02","title":"Commercial Liberian-Flagged Tanker Sustains Heavy Damage from Drone Swarm","location":"GULF OF OMAN","lat":24.9333,"lng":57.3500,"eventType":"drone","timestamp":1774105000000,"source":"Reuters / UKMTO"},
  {"id":"mar24_abumusa_01","title":"Coalition Jets Neutralize Mobile Launcher Columns Hidden in Civilian Sectors","location":"ABU MUSA ISLAND","lat":25.8733,"lng":55.0331,"eventType":"missile","timestamp":1774365000000,"source":"Middle East Observer"},
  {"id":"mar27_hormuz_01","title":"Massive Coastal Defense Cruise Missile Barrage Launched Toward Coalition Fleet","location":"STRAIT OF HORMUZ","lat":26.5667,"lng":56.2500,"eventType":"missile","timestamp":1774625000000,"source":"US CENTCOM"},
  {"id":"mar28_hormuz_01","title":"Electronic Warfare Aircraft Successfully Deflect Loitering Munitions Targeting Convoys","location":"STRAIT OF HORMUZ","lat":26.5667,"lng":56.2500,"eventType":"intercept","timestamp":1774695000000,"source":"US DoD"},
  {"id":"feb28_kwt_01","title":"Iranian Ballistic Missiles Target Ali Al Salem Air Base","location":"ALI AL SALEM AIR BASE, KUWAIT","lat":29.3466,"lng":47.5205,"eventType":"missile","timestamp":1772278000000,"source":"US CENTCOM"},
  {"id":"mar01_yem_01","title":"US Navy F/A-18s Strike Houthi Anti-Ship Missile Launchers","location":"HODEIDAH, YEMEN","lat":14.7969,"lng":42.9515,"eventType":"missile","timestamp":1772346000000,"source":"US CENTCOM"},
  {"id":"mar02_omn_01","title":"Strikes Hit Infrastructure in Muscat (Iran Claims False Flag)","location":"MUSCAT, OMAN","lat":23.5859,"lng":58.4059,"eventType":"missile","timestamp":1772449200000,"source":"Press TV / Al Jazeera"},
  {"id":"mar02_kwt_01","title":"Iranian Drone Strike Attempt on US Embassy Complex","location":"KUWAIT CITY, KUWAIT","lat":29.3759,"lng":47.9774,"eventType":"drone","timestamp":1772467200000,"source":"New York Times / ISW"},
  {"id":"mar04_kwt_01","title":"Explosion Reported Near Commercial Vessel in Territorial Waters","location":"KUWAIT COASTAL WATERS","lat":29.3000,"lng":48.1000,"eventType":"drone","timestamp":1772632800000,"source":"UKMTO / Windward"},
  {"id":"mar05_yem_01","title":"Houthi Swarm Drones Target Commercial Shipping Lane","location":"RED SEA (OFF YEMEN)","lat":16.3262,"lng":41.2415,"eventType":"drone","timestamp":1772691600000,"source":"UKMTO"},
  {"id":"mar07_kwt_01","title":"Patriot Batteries Intercept Missiles Over Camp Arifjan","location":"CAMP ARIFJAN, KUWAIT","lat":28.8756,"lng":48.1585,"eventType":"intercept","timestamp":1772865000000,"source":"US Army Central"},
  {"id":"mar08_omn_01","title":"Air Raid Sirens Sound as Drone Swarm Violates Airspace","location":"MUSANDAM PENINSULA, OMAN","lat":26.1833,"lng":56.2500,"eventType":"siren","timestamp":1772960000000,"source":"Royal Oman Police"},
  {"id":"mar09_yem_01","title":"US/UK Joint Strikes Target Deep Underground Weapons Facilities","location":"SANA'A, YEMEN","lat":15.3694,"lng":44.1910,"eventType":"missile","timestamp":1773030000000,"source":"US DoD / UK MoD"},
  {"id":"mar10_omn_01","title":"Commercial Oil Tanker Struck by Loitering Munition; Major Fire","location":"GULF OF OMAN","lat":24.9333,"lng":57.3500,"eventType":"drone","timestamp":1773100000000,"source":"UKMTO / Reuters"},
  {"id":"mar11_omn_01","title":"Drones Strike Fuel Storage Tanks at Major Port Logistics Hub","location":"PORT OF SALALAH, OMAN","lat":17.0151,"lng":54.0924,"eventType":"drone","timestamp":1773198000000,"source":"Times of India / Omani Authorities"},
  {"id":"mar11_kwt_01","title":"Air Defenses Intercept 4 Drones; Debris Hits Open Area","location":"KUWAIT INTERNATIONAL AIRPORT","lat":29.2266,"lng":47.9800,"eventType":"intercept","timestamp":1773205200000,"source":"Kuwait Defence Ministry"},
  {"id":"mar13_yem_01","title":"Coalition Forces Intercept Ballistic Missile Heading North","location":"SANA'A REGION, YEMEN","lat":15.5000,"lng":44.2000,"eventType":"intercept","timestamp":1773382800000,"source":"Saudi MoD"},
  {"id":"mar15_omn_01","title":"Omani Coast Guard Intercepts Suspicious Fast Boats Near Port","location":"DUQM, OMAN","lat":19.6600,"lng":57.7000,"eventType":"intercept","timestamp":1773565200000,"source":"Royal Oman Police"},
  {"id":"mar16_kwt_01","title":"General Quarters Sounded Following Suspected Radar Track","location":"KUWAIT NAVAL BASE","lat":28.8430,"lng":48.2710,"eventType":"siren","timestamp":1773630000000,"source":"US Navy / Local Media"},
  {"id":"mar18_omn_01","title":"Port Infrastructure Targeted in Dawn Drone Attack","location":"MUSCAT, OMAN","lat":23.5859,"lng":58.4059,"eventType":"drone","timestamp":1773735000000,"source":"OSINT / Regional Intel"},
  {"id":"mar20_kwt_01","title":"Swarm Drones Strike Mina Al-Ahmadi Oil Refinery Causing Major Fire","location":"MINA AL-AHMADI, KUWAIT","lat":29.0790,"lng":48.1480,"eventType":"drone","timestamp":1774000800000,"source":"Al Jazeera / Kuwait Petroleum"},
  {"id":"mar20_yem_01","title":"US/UK Strike Radar and Coastal Defense Installations","location":"TAIZ, YEMEN","lat":13.5795,"lng":44.0206,"eventType":"missile","timestamp":1773987600000,"source":"US CENTCOM"},
  {"id":"mar22_kwt_01","title":"Patriot Missiles Down Unidentified UAV Approaching Military Airfield","location":"ALI AL SALEM AIR BASE, KUWAIT","lat":29.3466,"lng":47.5205,"eventType":"intercept","timestamp":1774160000000,"source":"US Air Force Central"},
  {"id":"mar24_kwt_01","title":"Escalation: 17 Ballistic Missiles Fired at US Assests in Joint Wave","location":"KUWAIT CITY, KUWAIT","lat":29.3759,"lng":47.9774,"eventType":"missile","timestamp":1774265000000,"source":"JINSA"},
  {"id":"mar24_yem_01","title":"Anti-Ship Ballistic Missile Strikes Greek-Owned Tanker","location":"GULF OF ADEN","lat":12.5000,"lng":45.0000,"eventType":"missile","timestamp":1774333200000,"source":"UKMTO / Bloomberg"},
  {"id":"mar24_omn_01","title":"Debris from Intercepted UAVs Washes Ashore Near Maritime Border","location":"KHASAB, OMAN","lat":26.1822,"lng":56.2472,"eventType":"intercept","timestamp":1774330000000,"source":"Oman News Agency"},
  {"id":"mar26_yem_01","title":"Heavy B-2 Airstrikes on Houthi Drone Assembly Plant","location":"SAADA, YEMEN","lat":16.9402,"lng":43.7639,"eventType":"missile","timestamp":1774500000000,"source":"US War Dept"},
  {"id":"feb28_irq_01","title":"US Interceptors Down Missiles Near Military Assets","location":"ERBIL, IRAQ","lat":36.1901,"lng":44.0090,"eventType":"intercept","timestamp":1772298000000,"source":"CENTCOM"},
  {"id":"feb28_irq_02","title":"Iranian Retaliatory Strike on US Base","location":"BAGHDAD, IRAQ","lat":33.3152,"lng":44.3661,"eventType":"drone","timestamp":1772314800000,"source":"Alma Research Center"},
  {"id":"mar01_irq_01","title":"Drone and Missile Attacks on Military Bases by Militias","location":"ERBIL, IRAQ","lat":36.1901,"lng":44.0090,"eventType":"drone","timestamp":1772359800000,"source":"ISW"},
  {"id":"mar02_syr_01","title":"US and Israeli Jets Strike IRGC Weapons Depots","location":"ALEPPO, SYRIA","lat":36.2021,"lng":37.1343,"eventType":"missile","timestamp":1772434800000,"source":"OSINT / Al Jazeera"},
  {"id":"mar03_syr_01","title":"Iranian Missile Misfire Hits Residential Building (4 Killed)","location":"DAMASCUS, SYRIA","lat":33.5138,"lng":36.2765,"eventType":"missile","timestamp":1772539200000,"source":"Local Media"},
  {"id":"mar04_irq_01","title":"Militia Rocket Barrage Targets Al Asad Airbase","location":"AL ANBAR, IRAQ","lat":33.7900,"lng":42.4300,"eventType":"missile","timestamp":1772614800000,"source":"CENTCOM"},
  {"id":"mar05_irq_01","title":"Iranian Drone Strikes Target US Base","location":"ERBIL, IRAQ","lat":36.1901,"lng":44.0090,"eventType":"drone","timestamp":1772701200000,"source":"Iranian Media / ISW"},
  {"id":"mar06_syr_01","title":"Airstrike Heavily Damages Runways at T4 Military Airbase","location":"HOMS GOVERNORATE, SYRIA","lat":34.5200,"lng":37.6200,"eventType":"missile","timestamp":1772787600000,"source":"SOHR / RNintel"},
  {"id":"mar07_syr_01","title":"Air Defenses Intercept Proxy Drones Heading Toward Golan","location":"DARAA, SYRIA","lat":32.6243,"lng":36.1057,"eventType":"intercept","timestamp":1772884800000,"source":"IDF / OSINT"},
  {"id":"mar09_syr_01","title":"Airstrikes Sever IRGC Supply Lines at Border Crossing","location":"ALBU KAMAL, SYRIA","lat":34.4553,"lng":40.9133,"eventType":"missile","timestamp":1773037200000,"source":"SOHR"},
  {"id":"mar09_irq_01","title":"Pro-Iranian Militias Launch Drones at U.S. Base","location":"ERBIL, IRAQ","lat":36.1901,"lng":44.0090,"eventType":"drone","timestamp":1773086400000,"source":"ISW / Local Media"},
  {"id":"mar10_syr_01","title":"Strike on IRGC Convoy Near Lebanon Border","location":"AL-QUSAYR, SYRIA","lat":34.5091,"lng":36.5798,"eventType":"missile","timestamp":1773144000000,"source":"SOHR"},
  {"id":"mar11_irq_01","title":"Drone Strike Targets Diplomatic Consulate","location":"ERBIL, IRAQ","lat":36.1901,"lng":44.0090,"eventType":"drone","timestamp":1773216000000,"source":"Gulf News"},
  {"id":"mar11_irq_02","title":"Katyusha Rockets Impact Near US Embassy Green Zone","location":"BAGHDAD, IRAQ","lat":33.3030,"lng":44.3980,"eventType":"missile","timestamp":1773210000000,"source":"Iraqi Security Media"},
  {"id":"mar12_syr_01","title":"Airstrikes Target Iranian Weapons Transfer Hubs","location":"DAMASCUS, SYRIA","lat":33.5138,"lng":36.2765,"eventType":"missile","timestamp":1773280800000,"source":"SOHR / OSINT"},
  {"id":"mar12_irq_01","title":"Drone Swarm Targets US and Coalition Base","location":"ERBIL, IRAQ","lat":36.1901,"lng":44.0090,"eventType":"drone","timestamp":1773297000000,"source":"ISW / Local Media"},
  {"id":"mar12_syr_02","title":"Air Strikes Kill 11 Iran-Backed Fighters Near Border","location":"AL BUKAMAL, SYRIA","lat":34.4553,"lng":40.9133,"eventType":"missile","timestamp":1773316800000,"source":"AFP / The Hindu"},
  {"id":"mar13_irq_01","title":"Majnoon Oilfield Targeted by Two Suicide Drones","location":"MAJNOON, IRAQ","lat":31.0450,"lng":47.4120,"eventType":"drone","timestamp":1773373500000,"source":"Reuters"},
  {"id":"mar14_irq_01","title":"Drone Attack Sparks Huge Fire at Baghdad Airport Military Base","location":"BAGHDAD, IRAQ","lat":33.2625,"lng":44.2344,"eventType":"drone","timestamp":1773455000000,"source":"AFP / Al Jazeera"},
  {"id":"mar17_syr_01","title":"Precision Strikes Target Warehouses at Damascus International Airport","location":"DAMASCUS, SYRIA","lat":33.4100,"lng":36.5100,"eventType":"missile","timestamp":1773738000000,"source":"SOHR"},
  {"id":"mar18_syr_01","title":"Drone Attack on Coalition Outpost Results in Minor Damage","location":"AL-TANF, SYRIA","lat":33.4079,"lng":38.9320,"eventType":"drone","timestamp":1773814800000,"source":"US CENTCOM"},
  {"id":"mar20_syr_01","title":"Israeli Airstrikes Target Military Infrastructure in Southern Syria","location":"DARAA, SYRIA","lat":32.6243,"lng":36.1057,"eventType":"missile","timestamp":1773993600000,"source":"Al Jazeera"},
  {"id":"mar20_irq_01","title":"US Logistics Support Camp Near Airport Hit by Successive Attacks","location":"BAGHDAD, IRAQ","lat":33.2625,"lng":44.2344,"eventType":"missile","timestamp":1774008000000,"source":"Iraqi Security Sources"},
  {"id":"mar21_irq_01","title":"Drone Attack Targets Iraqi National Intelligence Service Headquarters","location":"BAGHDAD, IRAQ","lat":33.3152,"lng":44.3661,"eventType":"drone","timestamp":1774080000000,"source":"Iraqi Security Media"},
  {"id":"mar22_irq_01","title":"Unidentified Drone Intercepted Near Southern Oil Infrastructure","location":"BASRA, IRAQ","lat":30.5200,"lng":47.7700,"eventType":"intercept","timestamp":1774170000000,"source":"OSINT / RNintel"},
  {"id":"mar25_syr_01","title":"US Army Precision Strike Missile (PrSM) Makes Combat Debut","location":"EASTERN SYRIA", "lat":34.4553,"lng":40.9133,"eventType":"missile","timestamp":1774350000000,"source":"DefenseScoop"},
  {"id":"feb28_ksa_01","title":"Early Warning Sirens Triggered Amid Regional Barrage","location":"ARAR, SAUDI ARABIA","lat":30.9833,"lng":41.0167,"eventType":"siren","timestamp":1772275200000,"source":"Saudi Civil Defense"},
  {"id":"mar01_ksa_01","title":"Missiles Intercepted Targeting Air Base and International Airport","location":"RIYADH, SAUDI ARABIA","lat":24.7136,"lng":46.6753,"eventType":"intercept","timestamp":1772366400000,"source":"Saudi Defence Ministry"},
  {"id":"mar02_ksa_01","title":"US Embassy Hit by Two Drones, Sparking Minor Fire","location":"RIYADH, SAUDI ARABIA","lat":24.6828,"lng":46.6219,"eventType":"drone","timestamp":1772452800000,"source":"Saudi Confirmation / The Guardian"},
  {"id":"mar02_ksa_02","title":"Drone Attack Halts Operations at Ras Tanura Refinery","location":"RAS TANURA, SAUDI ARABIA","lat":26.6425,"lng":50.1017,"eventType":"drone","timestamp":1772463600000,"source":"The Guardian / Al Jazeera"},
  {"id":"mar03_ksa_01","title":"US Embassy Targeted by Drones; Sirens Echo Across Diplomatic Quarter","location":"RIYADH, SAUDI ARABIA","lat":24.6828,"lng":46.6219,"eventType":"siren","timestamp":1772539200000,"source":"Washington Post"},
  {"id":"mar04_ksa_01","title":"Attempted Drone Strike on Desalination Plant Intercepted","location":"AL JUBAIL, SAUDI ARABIA","lat":27.0111,"lng":49.6583,"eventType":"intercept","timestamp":1772600000000,"source":"Saudi Defence Ministry / Reuters"},
  {"id":"mar06_ksa_01","title":"Militia Drone Shot Down Approaching King Khalid Military City","location":"HAFAR AL-BATIN, SAUDI ARABIA","lat":28.4342,"lng":45.9636,"eventType":"intercept","timestamp":1772780000000,"source":"Al Arabiya"},
  {"id":"mar07_ksa_01","title":"Iranian Ballistic Missiles Intercepted Over Eastern Province","location":"DHAHRAN, SAUDI ARABIA","lat":26.2361,"lng":50.0393,"eventType":"intercept","timestamp":1772870400000,"source":"Saudi Defence Ministry"},
  {"id":"mar08_ksa_01","title":"Wave of Kamikaze Drones Intercepted Over Oil Infrastructure","location":"DHAHRAN, SAUDI ARABIA","lat":26.2361,"lng":50.0393,"eventType":"intercept","timestamp":1772956800000,"source":"Saudi Defence Ministry / Reuters"},
  {"id":"mar08_ksa_02","title":"Drone Strike on Residential Building Kills Two Civilians","location":"AL-KHARJ, SAUDI ARABIA","lat":24.1500,"lng":47.3000,"eventType":"drone","timestamp":1772971200000,"source":"Al Jazeera / Civil Defense"},
  {"id":"mar09_ksa_01","title":"Sirens Triggered as Intercepted Debris Falls Near Port Zones","location":"DAMMAM, SAUDI ARABIA","lat":26.4207,"lng":50.0888,"eventType":"siren","timestamp":1773045000000,"source":"Saudi Press Agency"},
  {"id":"mar10_ksa_01","title":"7 Ballistic Missiles Intercepted Targeting Prince Sultan Air Base","location":"PRINCE SULTAN AIR BASE, SAUDI ARABIA","lat":24.0622,"lng":47.5636,"eventType":"intercept","timestamp":1773122400000,"source":"Saudi Defence Ministry"},
  {"id":"mar11_ksa_01","title":"14 Kamikaze Drones Intercepted Over Kingdom Airspace","location":"SAUDI ARABIA (MULTIPLE)","lat":24.7136,"lng":46.6753,"eventType":"intercept","timestamp":1773255600000,"source":"Saudi Defence Ministry"},
  {"id":"mar11_ksa_02","title":"Solitary Drone Intercepted Over Red Sea Approaches","location":"JEDDAH, SAUDI ARABIA","lat":21.4858,"lng":39.1925,"eventType":"intercept","timestamp":1773216000000,"source":"Saudi Defence Ministry"},
  {"id":"mar12_ksa_01","title":"24 Drones and 2 Ballistic Missiles Intercepted Targeting Eastern Province","location":"EASTERN PROVINCE, SAUDI ARABIA","lat":26.2361,"lng":50.0393,"eventType":"intercept","timestamp":1773324000000,"source":"Al Arabiya"},
  {"id":"mar12_ksa_02","title":"Houthi-Launched Drone Shot Down Approaching Southern Border","location":"NAJRAN, SAUDI ARABIA","lat":17.4933,"lng":44.1277,"eventType":"intercept","timestamp":1773306000000,"source":"Saudi Defence Ministry"},
  {"id":"mar13_ksa_01","title":"Drones Shot Down Near Riyadh; Refinery Fire Efforts Ongoing","location":"RAS TANURA, SAUDI ARABIA","lat":26.6425,"lng":50.1017,"eventType":"drone","timestamp":1773380000000,"source":"Al Jazeera"},
  {"id":"mar13_ksa_02","title":"Air Defenses Neutralize Unprecedented Swarm of Nearly 50 Drones","location":"RIYADH, SAUDI ARABIA","lat":24.7136,"lng":46.6753,"eventType":"intercept","timestamp":1773374400000,"source":"Euro News"},
  {"id":"mar19_ksa_01","title":"Iranian Drones Strike Yanbu Oil Terminal on Red Sea","location":"YANBU, SAUDI ARABIA","lat":23.9570,"lng":38.2560,"eventType":"drone","timestamp":1773810000000,"source":"Saudi Foreign Ministry"},
  {"id":"mar19_ksa_02","title":"Ballistic Missile Intercepted Over the Red Sea on Approach to City","location":"JEDDAH, SAUDI ARABIA","lat":21.4858,"lng":39.1925,"eventType":"intercept","timestamp":1773910800000,"source":"Saudi Press Agency"},
  {"id":"mar20_ksa_01","title":"Horizontal Escalation: Swarm Drones Target Red Sea Energy Hub","location":"YANBU, SAUDI ARABIA","lat":23.9570,"lng":38.2560,"eventType":"drone","timestamp":1773936000000,"source":"Stimson / Reuters"},
  {"id":"mar24_ksa_01","title":"13 Drone Attacks Launched Overnight Against Energy Assets","location":"EASTERN PROVINCE, SAUDI ARABIA","lat":26.2361,"lng":50.0393,"eventType":"drone","timestamp":1774260000000,"source":"JINSA"},
  {"id":"mar24_ksa_02","title":"Oil Fields Targeted; Kingdom Reroutes Oil to Red Sea Ports","location":"EASTERN PROVINCE, SAUDI ARABIA","lat":26.6425,"lng":50.1017,"eventType":"missile","timestamp":1774353600000,"source":"Defense Priorities"},
  {"id":"feb28_isf_01","title":"IAF Strikes Dozens of Defense Industrial Base Targets","location":"ISFAHAN, IRAN","lat":32.6539,"lng":51.6660,"eventType":"missile","timestamp":1772271000000,"source":"JINSA / IDF"},
  {"id":"feb28_tab_01","title":"IAF Strikes 500 Targets Including IRGC Aerospace Facilities","location":"TABRIZ, IRAN","lat":38.0792,"lng":46.2887,"eventType":"missile","timestamp":1772261100000,"source":"Alma Research Center"},
  {"id":"feb28_qom_01","title":"Airstrikes Target Air Defenses Near Fordow Nuclear Facilities","location":"QOM, IRAN","lat":34.6416,"lng":50.8746,"eventType":"missile","timestamp":1772272500000,"source":"Alma Research Center"},
  {"id":"mar02_ahv_01","title":"Precision Strikes Target IRGC Regional Command Node","location":"AHVAZ, IRAN","lat":31.3183,"lng":48.6706,"eventType":"missile","timestamp":1772438400000,"source":"OSINT / JINSA"},
  {"id":"mar03_qom_01","title":"IAF Airstrike Targets Assembly of Experts Gathering","location":"QOM, IRAN","lat":34.6416,"lng":50.8746,"eventType":"missile","timestamp":1772535600000,"source":"Alma Research Center / Britannica"},
  {"id":"mar04_isf_01","title":"Airstrikes Target HESA Drone Manufacturing Complex","location":"ISFAHAN, IRAN","lat":32.7639,"lng":51.5540,"eventType":"missile","timestamp":1772615000000,"source":"Alma Research Center"},
  {"id":"mar04_ker_01","title":"Combined Force Strikes Cyber Police (FATA) Station","location":"KERMANSHAH, IRAN","lat":34.3142,"lng":47.0650,"eventType":"missile","timestamp":1772643600000,"source":"ISW"},
  {"id":"mar05_tab_01","title":"Early Warning Radar Installations Neutralized by SEAD Operations","location":"TABRIZ, IRAN","lat":38.0792,"lng":46.2887,"eventType":"missile","timestamp":1772697600000,"source":"CENTCOM"},
  {"id":"mar05_qom_01","title":"Airstrikes Target LEC Command Centers","location":"QOM, IRAN","lat":34.6416,"lng":50.8746,"eventType":"missile","timestamp":1772733600000,"source":"OSINT / ISW"},
  {"id":"mar05_ker_01","title":"Combined Forces Strike IRGC Ground Bases","location":"KERMANSHAH, IRAN","lat":34.3142,"lng":47.0650,"eventType":"missile","timestamp":1772744400000,"source":"OSINT"},
  {"id":"mar07_ahv_01","title":"Widespread Sirens Following Kinetic Strikes on Grid Infrastructure","location":"AHVAZ, IRAN","lat":31.3183,"lng":48.6706,"eventType":"siren","timestamp":1772864000000,"source":"IranWire"},
  {"id":"mar08_mas_01","title":"Sirens Sound Across Northeastern Hub Amid Deep Penetration Sorties","location":"MASHHAD, IRAN","lat":36.2972,"lng":59.6067,"eventType":"siren","timestamp":1772960000000,"source":"Local Telegram Channels"},
  {"id":"mar09_isf_01","title":"U.S. B-52 Bombers Strike Ballistic Missile Infrastructure","location":"ISFAHAN, IRAN","lat":32.6539,"lng":51.6660,"eventType":"missile","timestamp":1773072000000,"source":"CENTCOM"},
  {"id":"mar11_isf_01","title":"US B-1 Bombers Strike Deep Subterranean Missile Facilities","location":"ISFAHAN, IRAN","lat":32.6539,"lng":51.6660,"eventType":"missile","timestamp":1773266400000,"source":"US CENTCOM"},
  {"id":"mar12_ker_01","title":"U.S. HIMARS Units Target Mobile Launcher Columns Near Border","location":"KERMANSHAH, IRAN","lat":34.3142,"lng":47.0650,"eventType":"missile","timestamp":1773280000000,"source":"US DoD"},
  {"id":"mar13_ahv_01","title":"Airstrikes Impact Perimeter of Abadan Petrochemical Facilities","location":"ABADAN, IRAN","lat":30.3400,"lng":48.3000,"eventType":"missile","timestamp":1773388800000,"source":"Reuters"},
  {"id":"mar15_mas_01","title":"Strikes Heavily Damage Runways at Shahid Hasheminejad Airport","location":"MASHHAD, IRAN","lat":36.2346,"lng":59.6430,"eventType":"missile","timestamp":1773550000000,"source":"Aviation Trackers"},
  {"id":"mar16_tab_01","title":"Local Air Defenses Engage Unidentified Stealth UAVs","location":"TABRIZ, IRAN","lat":38.0792,"lng":46.2887,"eventType":"intercept","timestamp":1773665000000,"source":"Fars News Agency"},
  {"id":"mar21_ahv_01","title":"Targeted Decapitation Strike on Regional Militia Logistics Coordinator","location":"AHVAZ, IRAN","lat":31.3183,"lng":48.6706,"eventType":"missile","timestamp":1774080000000,"source":"Times of Israel"},
  {"id":"mar24_nat_01","title":"Bunker Buster Munitions Deployed Against Natanz Outer Defense Perimeter","location":"NATANZ, IRAN","lat":33.7258,"lng":51.7286,"eventType":"missile","timestamp":1774339200000,"source":"ISW"}
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
const newsSources = ['presstv', 'me_observer_TG'];

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

window.loadFeeds = async function() {
    // FILTER 1: Strict noise reduction for text parsing
    const blockedNewsKeywords = ['press release', 'statement', 'speech', 'spokesperson', 'condemn', 'condemns', 'says', 'said', 'announced', 'official', 'meeting', 'diplomat', 'minister', 'claims'];

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
                    
                    // Kill statements
                    if (blockedNewsKeywords.some(word => lowerText.includes(word))) {
                        return; 
                    }

                    // FILTER 2: Truncate long paragraphs to keep it snappy
                    if (text.length > 220) {
                        text = text.substring(0, 220) + '...';
                    }

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
    
    // 1. Process regular OSINT News
    let processedNews = allNewsData.map(p => { p.timeAgo = (nowMs - p.date) / 3600000; return p; })
        .filter(p => p.timeAgo <= 999999 && p.timeAgo >= 0);

    // 2. IMPORT MAP / FIREBASE ALERTS (12 Hour Lifespan Logic)
    let mapAlertNews = globalIntelData
        .filter(d => {
            let tAgo = (nowMs - d.timestamp) / 3600000;
            return tAgo <= 12 && tAgo >= 0; // Expires exactly after 12 hours
        })
        .map(d => {
            return {
                id: d.id + '_map',
                channel: 'TACTICAL ALERT',
                text: d.location + ' - ' + d.title,
                date: d.timestamp,
                mediaHTML: d.mediaHTML || '',
                lat: d.lat, lng: d.lng, location: d.location, eventType: d.eventType,
                timeAgo: (nowMs - d.timestamp) / 3600000,
                isFromMap: true
            };
        });

    // 3. Combine both streams and sort chronologically 
    let combinedFeeds = [...processedNews, ...mapAlertNews].sort((a,b) => a.timeAgo - b.timeAgo);

    const renderList = (posts, elId, limit) => {
        let html = '';
        posts.slice(0, limit).forEach(p => {
            let minutesAgo = Math.max(0, Math.floor(p.timeAgo * 60));
            let timeLabel = p.timeAgo > 1000 ? "ARCHIVE" : (minutesAgo < 1 ? "Just now" : minutesAgo < 60 ? minutesAgo + "m ago" : Math.floor(minutesAgo/60) + "h ago");
            
            let tStr = `<span style="color: #30d158 !important; font-weight: 700;">${timeLabel}</span>`;
            let channelColor = p.isFromMap ? '#ff3b30' : '#fff'; // Colorize tactical alerts
            
            let pinIcon = '';
            if(p.lat && p.lng) {
                pinIcon = `<span style="color: #ff3b30; margin-right: 4px;">📍</span>`;
            }

            html += `
            <div class="sc-list-item">
                <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
                    <span style="font-weight: 700; color: ${channelColor};">${pinIcon}${p.channel.replace('_TG','')}</span>${tStr}
                </div>
                <div style="color: #d1d1d6; line-height: 1.4; font-size: 0.75rem;">${p.text}</div>
                ${p.mediaHTML ? `<div style="margin-top: 8px; width: 100%; border-radius: 6px; overflow: hidden;">${p.mediaHTML}</div>` : ''}
            </div>`;
        });
        document.getElementById(elId).innerHTML = html || '<div style="padding:15px; color:#888; font-size:0.75rem;">No recent updates.</div>';
    };

    // Render Latest News: ME Observer + ANY Map Event within 12 hours
    renderList(combinedFeeds.filter(p => p.channel === 'ME_OBSERVER_TG' || p.isFromMap), 'news-feed', 50);

    // Render Iran News: PressTV + ANY Map Event within 12 hours matching Iranian sectors
    renderList(combinedFeeds.filter(p => p.channel === 'PRESSTV' || (p.isFromMap && (p.location === 'TEHRAN' || p.location === 'ISFAHAN' || p.location === 'SHIRAZ' || p.text.toLowerCase().includes('iran')))), 'iran-news-feed', 20);
    
    // Ticker Logic (Fallback to recent posts if no mid-length text is found)
    let tickerPosts = combinedFeeds.filter(p => p.text.length > 15 && p.text.length <= 150 && !p.isFromMap);
    if(tickerPosts.length === 0) tickerPosts = combinedFeeds.slice(0,5); 
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
    renderNewsFeeds(); 
    
    fetchLiveOSINT();
    loadFeeds(); 
    
    setInterval(fetchLiveOSINT, 60000); 
    setInterval(loadFeeds, 180000); 
};
