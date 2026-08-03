// ==UserScript==
// @name         RO Rebuild Web Assist
// @namespace    ro-rebuild-web-assist
// @version      4.0.0
// @description  ผู้ช่วยเล่นเว็บ client RO — auto-loot, auto-heal, auto-combat, auto-rest + อัปเดตอัตโนมัติ (Unity WebGL / WebSocket)
// @match        *://*.rayrag.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

/* ==========================================================================
   RO REBUILD WEB ASSIST  —  ผู้ช่วยเล่นสำหรับเว็บ client (Unity WebGL)
   ==========================================================================

   มี 2 ระบบทำงานแยกกัน (เปิด/ปิดเป็นอิสระ):

     1) AUTO-LOOT  — เก็บของที่ตกจากมอนที่เราฆ่าเอง
     2) AUTO-HEAL  — ใช้ขวดยาอัตโนมัติเมื่อเลือดต่ำกว่า % ที่ตั้ง

   --------------------------------------------------------------------------
   วิธีติดตั้ง
   --------------------------------------------------------------------------
   ทางเลือก A — Tampermonkey (แนะนำ)
     1. ติดตั้งส่วนเสริม "Tampermonkey"
     2. คลิกไอคอน Tampermonkey → Create a new script
     3. ลบเนื้อหาเดิม → วางสคริปต์นี้ทั้งหมด → Ctrl+S บันทึก
     4. รีเฟรชหน้าเว็บเกม (ต้องติดตั้งก่อนเข้าเกม เพราะต้องดัก WebSocket ตั้งแต่ต้น)

   ทางเลือก B — Console (ชั่วคราว)
     1. เปิดหน้าเว็บเกม แต่ "ยังไม่คลิกเข้าเกม"
     2. กด F12 → แท็บ Console
     3. วางสคริปต์นี้ทั้งหมด → Enter
     4. ค่อยคลิกเข้าเกม/เลือกตัวละคร
     (หมายเหตุ: ใช้วิธีนี้ต้องวางใหม่ทุกครั้งที่รีเฟรช)

   --------------------------------------------------------------------------
   ⭐ ที่ใช้บ่อย (พิมพ์ใน console)
   --------------------------------------------------------------------------
     ASSIST.status()           // ดูสถานะทั้งหมด (HP%, คิวของ, ค่าที่ตั้งไว้)
     ASSIST.help()             // ดูคำสั่งทั้งหมด

     // Auto-Loot (เปิดอยู่ default)
     ASSIST.lootOn()  /  ASSIST.lootOff()

     // Auto-Heal ★ DEFAULT = OFF (ยังไม่สมบูรณ์)
     //   ต้องตั้ง item ก่อน แล้วเปิดเอง:
     ASSIST.setHealItems(501,502,503)   // ตั้งไอเทม (จะเปิด auto-heal ให้อัตโนมัติ)
     ASSIST.setHealAt(50)               // เลือดต่ำกว่า 50% → ใช้ยา
     ASSIST.healOn()  /  ASSIST.healOff()

     // Warp-to-Loot ★ DEFAULT = OFF (ส่ง packet วาร์ปจริง)
     //   เก็บไม่ได้ครบ 6 ครั้ง → วาร์ปไปที่ไอเท็ม (กรณีติดกำแพง/หน้าผา)
     ASSIST.warpLootOn() / ASSIST.warpLootOff()

   ==========================================================================
   ส่วนที่ 1 — AUTO-HEAL
   ==========================================================================

   ทำงานยังไง?
     • อ่าน HP จาก packet ของตัวเอง (opcode 0x25 STAT)
     • พอ HP% ต่ำกว่าค่าที่ตั้ง (เช่น 50%) → สั่งใช้ item ที่กำหนด (packet 0x2f)
     • เลือก item 2 โหมด:
         'order'   = ใช้ item ตัวเดิมซ้ำจนกว่าจะหมด แล้วค่อยไปตัวถัดไป
         'random'  = สุ่มเลือก item ใหม่ทุกครั้ง
     • ★ วิธีรู้ว่า item "หมด": ใช้แล้ว HP ไม่ขยับเลย → ถือว่าหมด → ใช้ตัวถัดไป "ทันที"
       (ไม่ mark ว่าอันไหนหมดถาวร เพราะผู้เล่นอาจไปเก็บ/ซื้อเพิ่มมาแล้ว → รอบถัดไปที่วนกลับมาจะลองใหม่)
     • มีดีเลย์ระหว่างการใช้แต่ละครั้ง (ตั้งได้)

   คำสั่ง console (พิมพ์ได้เลย มีผลทันที):
     ASSIST.setHealAt(50)              // เปิด auto-heal + ตั้ง threshold 50%
     ASSIST.setHealItems(501, 502)     // เซ็ตรายการ item id ที่จะใช้ (ทับของเดิม)
     ASSIST.addHealItem(503)           // เพิ่ม item เข้ารายการ
     ASSIST.setHealMode('order')       // 'order' = ใช้ตัวเดิมจนหมดแล้วข้าม, 'random' = สุ่ม
     ASSIST.setHealDelay(800)          // ดีเลย์ 800ms ระหว่างการใช้แต่ละครั้ง
     ASSIST.healOn() / ASSIST.healOff()    // เปิด/ปิด

   ==========================================================================
   ส่วนที่ 2 — AUTO-LOOT
   ==========================================================================

   ทำงานยังไง?
     • ตรวจจับของที่ตกจากมอนที่ "เราฆ่าเอง" (สัญญาณ EXP + ระยะใกล้ตัว)
     • ส่งคำสั่งเก็บของ (packet 0x52)
     • เก็บไม่ได้ → ลองใหม่สูงสุด 6 ครั้ง ห่างกัน 1.2 วิ พร้อมสลับไปเก็บชิ้นอื่นก่อน
     • ครบ 6 ครั้งยังไม่ได้ → ปล่อยทิ้ง
     • ★ server ทำ walk-and-pickup เอง: ส่ง packet เดียว server เดินตัวละครไปเก็บเอง (รองรับนักธนูฆ่าไกล)
     • มีระบบกรอง: เก็บทั้งหมด / เก็บเฉพาะบางชิ้น / ไม่เก็บบางชิ้น

   คำสั่ง console:
     ASSIST.setLootMode('all')         // 'all' = เก็บหมด, 'only' = เก็บเฉพาะ, 'except' = ยกเว้น
     ASSIST.addLootOnly(909, 512)      // เพิ่ม item สำหรับโหมด 'only'
     ASSIST.addLootExcept(909)         // เพิ่ม item สำหรับโหมด 'except'
     ASSIST.clearLootOnly()            // ล้างรายการ 'only'
     ASSIST.clearLootExcept()          // ล้างรายการ 'except'
     ASSIST.name(935, 'Feather')       // ตั้งชื่อ item ให้อ่าน log ง่าย
     ASSIST.lootOn() / ASSIST.lootOff()    // เปิด/ปิด

   --------------------------------------------------------------------------
   เคล็ดลับหา "item id"
   --------------------------------------------------------------------------
   พิมพ์ ASSIST.status() ตอนมีของ/เลือด → จะเห็นชื่อแบบ "item_935" หรือเปิด inventory
   ในเกมแล้วเอา id มาใส่ในคำสั่งด้านบน

   ตัวอย่าง item id ทั่วไป (อ้างอิง RO มาตรฐาน — อาจต่างในแต่ละเซิร์ฟ):
     501 = Red Potion,    502 = Yellow Potion,   503 = White Potion
     504 = Blue Potion,   505 = Wing of Fly,     601 = Wing of Butterfly
     909 = Jellopy,       512 = Apple
   ========================================================================== */

(function () {
  if (window.__ASSIST) { console.warn('[ASSIST] รันอยู่แล้ว'); return; }
  window.__ASSIST = true;

  // ============================================================
  //  VERSION + config persistence (localStorage)
  // ============================================================
  const VERSION = '4.0.0';
  const GITHUB_RAW = 'https://raw.githubusercontent.com/superogira/ro-rebuild-web-assist/main/ro-rebuild-web-assist.user.js';
  const CFG_STORAGE_KEY = 'roAssistConfig_v1';
  // keys ที่บันทึก/โหลด (boolean/number/array/string — ไม่เก็บ function หรือ object ซ้อน)
  const PERSIST_KEYS = [
    'healEnabled', 'healAtPercent', 'healItems', 'healMode', 'healDelayMs', 'healAtMax',
    'lootEnabled', 'lootDelayAfterDropMs', 'filter',
    'warpLootEnabled',
    'combatEnabled', 'targetWhitelist', 'targetBlacklist', 'attackRange', 'rangedAttackRange',
    'maxAcquireDistance', 'maxChaseDistance', 'antiKS', 'avoidOtherPlayers', 'targetLowestHpFirst',
    'fleeOnMobCount', 'fleeOnAggroCount', 'fleeOnProximityCount', 'fleeOnProximityRadius',
    'wanderEnabled', 'warpFindEnabled', 'warpToMonster',
    'restEnabled', 'restHpPercent', 'restUntilPercent', 'restMaxSec', 'postCombatDelayMs',
    'itemNames',
  ];
  function saveConfig() {
    try {
      const out = {};
      for (const k of PERSIST_KEYS) if (k in CFG) out[k] = CFG[k];
      localStorage.setItem(CFG_STORAGE_KEY, JSON.stringify(out));
    } catch (e) { /* localStorage อาจถูกบล็อก — ข้าม */ }
  }
  function loadConfig() {
    try {
      const raw = localStorage.getItem(CFG_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      for (const k of PERSIST_KEYS) if (k in saved) CFG[k] = saved[k];
      log('💾 โหลดค่าที่บันทึกไว้จากเครื่อง (' + PERSIST_KEYS.filter(k => k in saved).length + ' รายการ)');
    } catch (e) { /* parse fail — ใช้ default */ }
  }
  // debounce save (กันเขียนถี่เกินไป)
  let saveTimer = null;
  function saveConfigDebounced() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveConfig, 800);
  }

  // ============================================================
  //  Item database (โหลดจาก GitHub raw + cache localStorage)
  // ============================================================
  const ITEMS_CSV_URL = GITHUB_RAW.replace('/ro-rebuild-web-assist.user.js', '/items.csv');
  const ITEMS_META_URL = GITHUB_RAW.replace('/ro-rebuild-web-assist.user.js', '/items/meta.json');
  const ITEMS_ICON_URL = GITHUB_RAW.replace('/ro-rebuild-web-assist.user.js', '/items/small/');
  const ITEMDB_CACHE_KEY = 'roAssistItemDB_v1';
  const itemDB = { names: {}, prices: {}, loaded: false };
  async function loadItemDB() {
    if (itemDB.loaded) return;
    // ลอง cache ก่อน
    try {
      const cached = localStorage.getItem(ITEMDB_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.names && parsed.prices) {
          itemDB.names = parsed.names;
          itemDB.prices = parsed.prices;
          itemDB.loaded = true;
          log('🗃️ โหลด item DB จาก cache (' + Object.keys(parsed.names).length + ' รายการ)');
          return;
        }
      }
    } catch (e) {}
    // โหลดจาก GitHub
    try {
      log('🗃️ กำลังโหลด item DB จาก GitHub...');
      const [csvRes, metaRes] = await Promise.all([fetch(ITEMS_CSV_URL), fetch(ITEMS_META_URL)]);
      if (csvRes.ok) {
        const csv = await csvRes.text();
        for (const line of csv.split('\n')) {
          const c = line.indexOf(',');
          if (c > 0) { const id = line.slice(0, c).trim(); const nm = line.slice(c + 1).trim(); if (id && nm) itemDB.names[id] = nm; }
        }
      }
      if (metaRes.ok) {
        const meta = await metaRes.json();
        for (const [id, info] of Object.entries(meta)) {
          if (info && info.buyPrice != null) itemDB.prices[id] = info.buyPrice;
        }
      }
      itemDB.loaded = true;
      // cache ลง localStorage (กันโหลดใหม่ทุกครั้ง)
      try { localStorage.setItem(ITEMDB_CACHE_KEY, JSON.stringify({ names: itemDB.names, prices: itemDB.prices })); } catch (e) {}
      log('🗃️ โหลด item DB สำเร็จ: ' + Object.keys(itemDB.names).length + ' ชื่อ, ' + Object.keys(itemDB.prices).length + ' ราคา');
    } catch (e) {
      log('⚠️ โหลด item DB ล้มเหลว (offline?) — ใช้ชื่อเริ่มต้น');
      itemDB.loaded = true;   // ไม่ลองใหม่
    }
  }
  // ชื่อ item จาก DB (fallback ไป CFG.itemNames หรือ item_<id>)
  function itemDisplayName(id) {
    const k = String(id);
    if (itemDB.names[k]) return itemDB.names[k];
    if (CFG.itemNames[id]) return CFG.itemNames[id];
    return 'item_' + id;
  }
  // ราคา item (buyPrice) — 0 ถ้าไม่มีข้อมูล
  function itemPrice(id) { return itemDB.prices[String(id)] || 0; }
  // URL รูป item (lazy-load จาก GitHub raw)
  function itemIconUrl(id) { return ITEMS_ICON_URL + id + '.gif'; }
  // ยอด zeny รวม session (จาก itemsByCount × buyPrice)
  function sessionZeny() {
    let total = 0;
    for (const [id, count] of stats.itemsByCount) total += (itemPrice(id) || 0) * count;
    return total;
  }

  // ============================================================
  //  ตั้งค่าเริ่มต้น — แก้ได้ที่นี่ หรือใช้คำสั่ง ASSIST.* จาก console
  // ============================================================
  const CFG = {
    // ---------- AUTO-HEAL ----------
    //  ★★ DEFAULT = OFF — ระบบยังไม่สมบูรณ์ อาจส่ง packet แปลกปลอมถ้าไม่มี item heal
    //     เปิดใช้เองด้วย ASSIST.healOn() หรือ ASSIST.setHealItems(...) (จะเปิดให้อัตโนมัติ)
    healEnabled: false,           // เปิดใช้ตอนเริ่มหรือไม่
    healAtPercent: 60,            // HP% ที่จะเริ่มใช้ยา (เช่น 60 = ต่ำกว่า 60% ใช้ยา)
    healItems: [512,507,501,502],                // ★ DEFAULT = ว่าง → จะไม่ส่ง packet heal ใด ๆ จนกว่าจะตั้ง item
    healMode: 'order',            // 'order' = ใช้ตัวเดิมจนหมดแล้วค่อยข้าม, 'random' = สุ่มทุกครั้ง
    healDelayMs: 200,             // ดีเลย์ขั้นต่ำระหว่างการใช้ item แต่ละครั้ง
    healCheckMs: 100,             // ความถี่ในการเช็ค HP
    healAtMax: false,             // true = ใช้ยาจนเต็มก่อนหยุด (ไม่ใช่แค่พ้น threshold)
    healExhaustedMs: 3000,        // ★ item ที่ "หมด" จะรออีก N ms ก่อนลองใหม่ (เผื่อเก็บ/ซื้อมาเพิ่ม)
    healItemEffectCheckMs: 300,   // รอ server ส่ง HP กลับ N ms หลังใช้ item แล้วค่อยเช็คผล

    // ---------- AUTO-REST (★ default OFF — นั่งพักเสี่ยงถ้ามีมอนรอบตัว) ----------
    //  เมื่อ HP ต่ำกว่า restHpPercent และไม่โดนรุม → นั่งพัก
    //  ฟื้นถึง restUntilPercent หรือหมดเวลา restMaxSec → ลุกยืนกลับฟาร์ม
    //  ★ โดนรุมระหว่างนั่ง → ลุกทันทีเพื่อตีตอบ
    restEnabled: true,
    restHpPercent: 40,            // HP ต่ำกว่า 30% → นั่งพัก
    restUntilPercent: 90,         // ฟื้นถึง 90% → ลุก
    restMaxSec: 40,               // นั่งนานสุด 60 วิ (กันค้าง — HP ไม่ขยับ = มีปัญหา)

    // ---------- AUTO-LOOT ----------
    lootEnabled: true,
    pickRadius: 2,                // ระยะ (ช่อง) จากตัวเรา ที่จะถือว่าของเป็นของเรา
    combatWindowMs: 4000,         // ของตกต้องมาภายในเวลานี้หลังเราตี/ฆ่า
    lootDelayAfterDropMs: 400,      // ★ รอ N ms หลังของตก แล้วค่อยเริ่มเก็บ (0 = เก็บทันที, กันดูเป็นบอท)
    attemptIntervalMs: 1200,      // ห่างระหว่างการลองเก็บชิ้นเดิม (1.2 วิ — รอ server เดินไปเก็บ)
    sendThrottleMs: 400,          // ห่างระหว่างคำสั่งเก็บทุกชิ้น (กันสแปม)
    maxAttempts: 6,               // เก็บไม่ได้ 6 ครั้ง → ปล่อย (นักธนูฆ่าไกล ตัวเดินไปเก็บนานขึ้น)
    itemMaxAgeMs: 30000,          // ของเก่ากว่านี้ → ทิ้งออกจากคิว
    lootTickMs: 300,

    // ---------- WARP-TO-LOOT (ฟีเจอร์รุนแรง — default OFF) ----------
    //  เมื่อเก็บของไม่ได้ครบ maxAttempts (server เงียบ = ติดกำแพง/หน้าผา)
    //  → วาร์ปไปที่พิกัดของไอเท็ม แล้วส่ง pickup อีกครั้ง
    //  ★ default OFF เพราะส่ง packet warp จริง — เปิดเองด้วย ASSIST.warpLootOn()
    warpLootEnabled: true,
    warpLootMaxOffsets: 3,        // ลองกี่ offset รอบไอเท็ม (กลาง + ±3 รอบข้าง) ก่อนปล่อยทิ้ง
    warpLootCooldownMs: 2000,     // ห่างขั้นต่ำระหว่างการวาร์ป (กันสแปม)
    warpLootPickupDelayMs: 1000,   // รอ server ย้ายตัวละครหลังวาร์ป ก่อนส่ง pickup

    // ---------- AUTO-COMBAT (★ default OFF — ส่ง attack packet จริง) ----------
    //  เปิดเองด้วย ASSIST.combatOn()
    //  targetWhitelist: [] = ตีทุกมอน kind=1; ['Poring', 4000] = ตีเฉพาะ (รองรับชื่อ + sprite id)
    //  ⚠️ ว่าง = ตีทุกมอน รวม MVP/มอนแรง → แนะนำให้ตั้ง whitelist หรือใช้ blacklist กันตาย
    combatEnabled: false,
    targetWhitelist: [],          // [] = ตีมอน kind=1 ทุกตัว; ['Poring', 4000] = เฉพาะ (รองรับชื่อ + sprite id)
    targetBlacklist: [],          // ไม่ตีมอนเหล่านี้ (ชื่อหรือ sprite id)
    attackRange: 2,               // ระยะโจมตี (ช่อง) — ใกล้กว่านี้สั่งตี, ไกลกว่าเดินไป
    rangedAttackRange: 8,         // 0 = ใช้ attackRange; >0 = นักธนูตีไกลได้ N ช่อง
    maxAcquireDistance: 30,       // ★ เลือกเป้า + ส่ง ATTACK ได้ในระยะนี้ (บอทหลัก search [5,10,20,30])
    maxChaseDistance: 40,         // ★ เดินไล่ตามมอนได้สูงสุด N ช่อง (ไกลกว่านี้ abandon หาตัวอื่น)
    walkStepDistance: 20,         // ★ สั่งเดินทีละ N ช่อง (game click-walk cap ~20)
    maxWalkDistance: 15,          // (legacy — ใช้น้อย เพราะ server walk-and-attack เอง)
    combatTickMs: 200,            // tick loop (มี jitter ±25% เหมือนบอทหลัก)
    postCombatDelayMs: 1000,      // ★ รอ N ms หลังสู้เสร็จ/เก็บของเสร็จ ก่อนทำอย่างอื่น (ดูเป็นธรรมชาติ)
    attackReIssueMs: 3000,        // ส่ง attack ซ้ำถ้า server เงียบนานกว่านี้ (เพิ่มจาก 2500 → pending เพิ่มช้าลง)
    attackAbandonMs: 20000,       // ★ ส่ง attack แล้ว server ไม่ตอบ N ms → abandon (เพิ่มจาก 8s → 20s รองรับ reset ล่าช้า)
    attackPendingMax: 4,          // ★ abandon ถ้า pending ≥ N (ลดจาก 8 → 4 ใกล้บอทหลัก ตัดมอนตีไม่ได้เร็วขึ้น)
    aggroKeepAliveMs: 15000,      // ★ มอน aggro เรา → ถือว่ายังสู้อยู่ N ms (กัน abandon ตอนมอนเดินมาหา)
    maxEngageSec: 20,             // abandon target ถ้า engage นานกว่านี้ (ลดจาก 30 → 20 ใกล้บอทหลัก)
    // flee (วาร์ปหนี)
    fleeOnMobCount: 3,            // มอนรุม N ตัว (ที่ตีเรา) → วาร์ปหนี (0=off)
    fleeOnAggroCount: 5,          // มอนจับเราเป็นเป้า N ตัว → วาร์ปหนี (0=off)
    fleeOnProximityCount: 10,      // มอนอยู่รอบ N ตัวในระยะ → วาร์ปหนี (0=off)
    fleeOnProximityRadius: 8,
    fleeMobWindowMs: 5000,        // ช่วงเวลาที่นับว่ามอน "กำลังตีเรา"
    fleeCooldownMs: 3000,
    // KS avoidance + ป้องกันแย่ง
    antiKS: true,                 // ไม่ตีมอนที่คนอื่นกำลังสู้ (default ON)
    antiKSCooldownMs: 5000,       // มอนที่ถูกตีโดยคนอื่น จะถูกข้ามไป N ms
    avoidOtherPlayers: true,      // ไม่ตีมอนที่อยู่ใกล้ผู้เล่นคนอื่น
    playerProximityRadius: 10,
    // target selection
    targetLowestHpFirst: true,    // ถูกรุม ≥2 ตัว → ตีเลือดน้อยสุดก่อน
    // stuck
    warpToMonster: false,         // ติดกำแพง → วาร์ปไปหามอน (toggle, default OFF)
    warpToMonsterCooldownMs: 10000,
    warpToMonsterMaxPerEntity: 2,
    stuckWarpOnAbandon: 3,        // abandon 3 ครั้งใน 60s → วาร์ปสุ่ม
    // หามอน
    wanderEnabled: true,          // ไม่เจอมอน → สุ่มเดิน
    wanderMaxStep: 20,            // สุ่มระยะ ≤20 ช่อง
    wanderCooldownMs: 3000,
    warpFindEnabled: false,       // ไม่เจอมอนนาน → วาร์ปสุ่ม (toggle, default OFF)
    noMonsterWarpSec: 30,

    // โหมดกรองของ: 'all' = เก็บหมด, 'only' = เก็บเฉพาะ, 'except' = ยกเว้น
    filter: { mode: 'except', onlyItems: [], exceptItems: [909,916,1302,1602,2302] },

    // ---------- ทั่วไป ----------
    verbose: true,
    itemNames: {
      501: 'Red Potion', 502: 'Yellow Potion', 503: 'White Potion',
      504: 'Blue Potion', 505: 'Wing of Fly', 601: 'Wing of Butterfly',
      909: 'Jellopy', 916: 'Bird Feather', 512: 'Apple',
    },
  };

  // ★ โหลดค่าที่บันทึกไว้จาก localStorage (ทับ default)
  loadConfig();

  // ---------- state ทั่วไป ----------
  let activeWS = null;                 // game socket (ใช้ส่งคำสั่ง)
  let playerId = null;                 // ไอดีตัวเรา
  const player = { x: null, y: null }; // ตำแหน่งตัวเรา

  // ---------- log buffer (สำหรับ panel log console) ----------
  const LOG_BUF_MAX = 200;
  const logBuf = [];
  function log(...a) {
    const msg = a.map(x => (typeof x === 'object' ? (() => { try { return JSON.stringify(x); } catch (e) { return String(x); } })() : String(x))).join(' ');
    logBuf.push({ t: Date.now(), msg });
    while (logBuf.length > LOG_BUF_MAX) logBuf.shift();
    if (CFG.verbose) console.log('[ASSIST]', ...a);
  }
  const nameOf = (id) => {
    const db = itemDisplayName(id);
    return db !== 'item_' + id ? `${db}(${id})` : (CFG.itemNames[id] ? `${CFG.itemNames[id]}(${id})` : `item_${id}`);
  };

  // ---------- สถิติการฟาร์ม ----------
  const stats = {
    startTime: Date.now(),
    kills: 0,              // จำนวนที่ฆ่าได้ (นับจาก EXP gain)
    itemsLooted: 0,        // จำนวนชิ้นที่เก็บได้
    expGained: 0,          // EXP รวมที่ได้ (base+job delta)
    itemsByCount: new Map(), // itemId -> จำนวนที่เก็บได้
    pickupFails: 0,        // ครั้งที่พยายามเก็บแล้วล้มเหลว
    deaths: 0,             // ครั้งที่ตาย
  };
  function resetStats() {
    stats.startTime = Date.now();
    stats.kills = 0; stats.itemsLooted = 0; stats.expGained = 0;
    stats.itemsByCount = new Map(); stats.pickupFails = 0; stats.deaths = 0;
  }

  // ---------- HP tracking ----------
  //  ★★★ ทุก STAT(0x25) packet ของ player = HP update (หลักฐานจากบอทหลัก world.js:1605-1643)
  //    statType เป็นแค่ label วนๆ (83 ค่าต่อ session) ทุก packet มี (cur,max) อยู่ในช่วง HP เดียวกัน
  //    → รับทุกตัวเลย แค่ sanity check (0 ≤ cur ≤ max)
  //    (ก่อนหน้านี้ใช้เทคนิค "เก็บ max สูงสุด" → ผิด! ถ้า server ส่ง sub-stat ที่ max=6774 → ทับ hp.max
  //     → แสดง 549/6774 ทั้งที่ HP จริง 408)
  const hp = { cur: null, max: null };
  function applyStat(id, cur, m) {
    if (id !== playerId) return;
    if (!(m > 0) || cur < 0 || cur > m) return;          // sanity check
    // ★ respawn detection: HP จาก 0/ตาย → กลับมา > 0 = เกิดใหม่แล้ว
    if (isDead && cur > 0) {
      isDead = false;
      heal.clearExhausted();                            // ล้าง mark "หมด" ทั้งหมด เริ่มนับใหม่
      heal.allExhaustedLogged = false;
    }
    hp.cur = cur;
    hp.max = m;
  }
  const hpPct = () => (hp.cur != null && hp.max > 0) ? (hp.cur / hp.max) * 100 : null;

  // ============================================================
  //  AUTO-HEAL
  // ============================================================
  //  ★ logic การเลือก item:
  //   - แต่ละ item มี "exhaustedUntil" = เวลาที่จะลองใช้ใหม่ได้
  //     (= 0 หรือ ผ่านไปแล้ว = ใช้ได้ปกติ)
  //   - 'order'  : เลือก item แรกสุดที่ "ใช้ได้" (ตามลำดับที่ตั้ง) → ใช้ซ้ำจนกว่าจะหมด
  //                พอหมด → mark exhaustedUntil = now + healExhaustedMs → ข้ามไปตัวถัดไปทันที
  //                พอหมดเวลา → ลองใหม่ → ถ้าเก็บมาเพิ่มก็ใช้ได้ทันที (ไม่ mark ถาวร)
  //   - 'random' : สุ่มเลือกเฉพาะ item ที่ "ใช้ได้" ตอนนั้น
  //   - ทุกครั้งที่ใช้ item → จำ HP ก่อนใช้ → รอ healItemEffectCheckMs → เช็คผล
  //     ถ้า HP ไม่ขยับ = หมด → mark exhaustedUntil + ข้าม delay → ใช้ตัวถัดไปทันที
  //   - ตอนตาย (isDead) → หยุด heal ทั้งหมด (กันนึกว่ายาหมดทั้งหมด)
  let isDead = false;

  // ---------- AUTO-REST state ----------
  let isResting = false;          // กำลังนั่งพักอยู่
  let restUntil = 0;              // timestamp ที่จะลุก (กันค้าง — restMaxSec)
  const heal = {
    exhaustedUntil: new Map(),    // itemId -> timestamp ที่จะลองใช้ใหม่ได้
    lastUseAt: 0,                 // เวลาที่ใช้ item ครั้งล่าสุด
    pendingCheckAt: 0,            // เวลาที่ใช้ item ล่าสุด (รอเช็คผล)
    pendingItemId: null,          // item ที่รอเช็คผลอยู่
    pendingHpBefore: null,        // HP ก่อนใช้ item ล่าสุด

    // item นี้ "ใช้ได้" ไหม (ไม่ได้ถูก mark ว่าเพิ่งหมด)
    isAvailable(id, now) {
      const t = this.exhaustedUntil.get(id) || 0;
      return now >= t;
    },
    // mark ว่า item หมด → รอ healExhaustedMs แล้วค่อยลองใหม่
    markExhausted(id, now) {
      this.exhaustedUntil.set(id, now + CFG.healExhaustedMs);
    },
    // เลือก item ถัดไปที่จะใช้ (ตามโหมด)
    pickNext(now) {
      const ids = CFG.healItems;
      if (!ids.length) return null;
      const avail = ids.filter(id => this.isAvailable(id, now));
      if (!avail.length) return null;                // ทุกตัว mark ว่าหมดอยู่
      if (CFG.healMode === 'random') {
        return avail[Math.floor(Math.random() * avail.length)];
      }
      return avail[0];                               // 'order' = ตัวแรกที่ใช้ได้
    },
    // ล้าง mark "หมด" ทั้งหมด (ใช้ตอน respawn / reset)
    clearExhausted() { this.exhaustedUntil.clear(); },
  };

  // ส่งคำสั่งใช้ item: packet 0x2f, [2f][item_id:4 LE][target:4 LE], target=FFFFFFFF (self)
  function sendUseItem(itemId) {
    if (!activeWS || activeWS.readyState !== 1) return false;
    const b = new Uint8Array(9);
    b[0] = 0x2f;
    b[1] = itemId & 0xff; b[2] = (itemId >> 8) & 0xff;
    b[3] = (itemId >> 16) & 0xff; b[4] = (itemId >>> 24) & 0xff;
    b[5] = 0xff; b[6] = 0xff; b[7] = 0xff; b[8] = 0xff;   // target = FFFFFFFF (self)
    activeWS.send(b);
    return true;
  }

  // ตัวเช็ค HP และใช้ยา
  const healLoop = setInterval(() => {
    if (!CFG.healEnabled) return;
    // ★★ GUARD สำคัญ: ถ้าไม่มี item heal เลย → ห้ามทำอะไร (กันส่ง packet 0x2f ปลอม → ถูกตรวจจับเป็นบอท)
    if (!CFG.healItems.length) return;
    const now = Date.now();
    const pct = hpPct();
    if (pct == null || hp.cur == null) return;            // ยังไม่รู้ HP
    if (isDead) return;                                   // ★ ตายอยู่ → ห้าม heal
    if (isResting) return;                                // ★ กำลังนั่งพัก → ข้าม heal (ใช้ regen แทน ประหยัดยา)

    // ★ เช็คผลของ item ที่ใช้ครั้งก่อน (background — ไม่บล็อกการใช้ตัวถัดไป)
    //   ถ้า HP ไม่ขยับ = หมด → mark exhausted (pickNext จะข้ามเอง)
    //   แต่ไม่ return — ให้ด้านล่างใช้ยาตัวถัดไปได้เลยถ้า HP ยังต่ำ + ผ่าน delay
    if (heal.pendingItemId != null && heal.pendingHpBefore != null &&
        now - heal.pendingCheckAt >= CFG.healItemEffectCheckMs) {
      if (hp.cur <= heal.pendingHpBefore + 1) {
        log('💊', nameOf(heal.pendingItemId), 'หมด (ใช้แล้ว HP ไม่ขยับ) → ใช้ตัวถัดไป');
        heal.markExhausted(heal.pendingItemId, now);
        heal.lastUseAt = 0;                              // ข้าม delay ให้ใช้ตัวถัดไปทันที
      }
      heal.pendingItemId = null;
      heal.pendingHpBefore = null;
      heal.pendingCheckAt = 0;
    }

    // เงื่อนไขการใช้ยา — ใช้ได้เลยถ้า HP ยังต่ำ + ผ่าน delay (ไม่ต้องรอ pending เคลียร์)
    const belowThreshold = pct < CFG.healAtPercent;
    const notFull = CFG.healAtMax ? (hp.cur < hp.max) : belowThreshold;
    if (!notFull) return;
    if (now - heal.lastUseAt < CFG.healDelayMs) return;   // throttle ดีเลย์เท่านั้น

    const id = heal.pickNext(now);
    if (id == null) {
      // ทุกตัว mark ว่าหมดอยู่ → log ครั้งเดียวเมื่อเริ่มหมด (กัน spam)
      if (!heal.allExhaustedLogged) {
        log('⚠️ item heal ทุกตัวหมด/ไม่ได้ผล — รอเก็บ/ซื้อเพิ่ม');
        heal.allExhaustedLogged = true;
      }
      return;
    }
    heal.allExhaustedLogged = false;
    if (sendUseItem(id)) {
      heal.lastUseAt = now;
      heal.pendingItemId = id;
      heal.pendingHpBefore = hp.cur;                      // จำ HP ก่อนใช้ เพื่อเช็คผล
      heal.pendingCheckAt = now;
      log('💉 ใช้', nameOf(id), `@ HP ${hp.cur}/${hp.max} (${pct.toFixed(0)}%)`);
    }
  }, CFG.healCheckMs);

  // ============================================================
  //  AUTO-LOOT
  // ============================================================
  let lastCombatAt = 0, lastExpAt = 0, lastSendAt = 0;
  const recentDrops = new Map();       // dropId -> {dropId,x,y,itemId,t}
  const queue = new Map();             // dropId -> {dropId,itemId,x,y,attempts,lastAttemptAt,addedAt}

  // ---------- WARP-TO-LOOT state ----------
  let currentMap = null;               // ชื่อแมปปัจจุบัน (จาก opcode 0x12) — จำเป็นสำหรับ warp
  const warpQueue = new Map();         // dropId -> {dropId,itemId,x,y,offsetIdx,warpAt,pickupSentAt}
  let lastWarpAt = 0;                  // throttle การวาร์ป
  let warpGuardUntil = 0;              // ★ ระยะหลังวาร์ป — รอ player pos อัปเดตก่อนคำนวณ dist
  let lastWarpPlayerPos = null;        // ★ player.x/y ก่อนวาร์ป (เช็คว่า pos เปลี่ยนไหม)
  let lastWarpTargetId = null;         // dropId ที่กำลังวาร์ปไป (เช็คผลจาก 0x2a)

  const u16 = (u, o) => u[o] | (u[o + 1] << 8);
  const u32 = (u, o) => ((u[o]) | (u[o + 1] << 8) | (u[o + 2] << 16) | (u[o + 3] << 24)) >>> 0;
  const i16 = (u, o) => { const v = u16(u, o); return v >= 0x8000 ? v - 0x10000 : v; };   // signed int16 LE (พิกัดติดลบได้)
  const dv = new DataView(new ArrayBuffer(4));
  const f32 = (u, o) => { dv.setUint32(0, u32(u, o), true); return dv.getFloat32(0, true); };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const FAIL = 0xffffffff;

  function shouldLoot(itemId) {
    const f = CFG.filter;
    if (f.mode === 'only')   return f.onlyItems.includes(itemId);
    if (f.mode === 'except') return !f.exceptItems.includes(itemId);
    return true;
  }

  function syncU8(d) {
    if (d instanceof ArrayBuffer) return new Uint8Array(d);
    if (ArrayBuffer.isView(d)) return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
    return null;
  }
  async function toU8(d) {
    const u = syncU8(d);
    if (u) return u;
    if (typeof Blob !== 'undefined' && d instanceof Blob) return new Uint8Array(await d.arrayBuffer());
    return null;
  }

  // ส่งคำสั่งเก็บของ: packet 0x52, [52][drop_id:4 LE]
  function sendPickup(dropId) {
    if (!activeWS || activeWS.readyState !== 1) return false;
    const b = new Uint8Array(5);
    b[0] = 0x52;
    b[1] = dropId & 0xff; b[2] = (dropId >> 8) & 0xff;
    b[3] = (dropId >> 16) & 0xff; b[4] = (dropId >>> 24) & 0xff;
    activeWS.send(b);
    return true;
  }

  // ★ เขียน signed int16 LE ลง Uint8Array ที่ offset (รองรับค่าติดลบ เช่น -999)
  function writeI16LE(b, off, v) {
    const x = v & 0xffff;
    b[off] = x & 0xff; b[off + 1] = (x >> 8) & 0xff;
  }
  // ★ ส่งคำสั่งวาร์ป: packet 0x40, [40][len:2 LE][mapname UTF-8][x:i16 LE][y:i16 LE][00]
  //   x/y เป็น signed int16 (-999 = random) — format ยืนยันจากบอทหลักแล้ว
  function sendTeleport(mapName, x, y) {
    if (!activeWS || activeWS.readyState !== 1) return false;
    if (!mapName) return false;
    const mapBytes = new TextEncoder().encode(mapName);
    const b = new Uint8Array(1 + 2 + mapBytes.length + 2 + 2 + 1);
    let p = 0;
    b[p++] = 0x40;
    b[p++] = mapBytes.length & 0xff; b[p++] = (mapBytes.length >> 8) & 0xff;
    b.set(mapBytes, p); p += mapBytes.length;
    writeI16LE(b, p, Math.round(x)); p += 2;
    writeI16LE(b, p, Math.round(y)); p += 2;
    b[p] = 0x00;
    activeWS.send(b);
    // ★ ตั้ง warp guard — หลังวาร์ป player.x/y จะค้างจนกว่า server จะส่ง MOVE_UPDATE ใหม่
    //   combatLoop จะรอจนกว่า player pos จะเปลี่ยนจากก่อนวาร์ป ก่อนคำนวณ dist/ตี
    warpGuardUntil = nowMs() + 3000;          // หมดเวลา 3s กันค้าง (ถ้า server ไม่ส่ง pos ใหม่)
    lastWarpPlayerPos = (player.x != null) ? { x: player.x, y: player.y } : null;
    return true;
  }

  function tryClaim(d) {
    if (queue.has(d.dropId)) return;
    const now = Date.now();
    if (now - lastCombatAt > CFG.combatWindowMs) return;
    const nearPlayer = (player.x != null && dist(player, d) <= CFG.pickRadius);
    const nearExp = (now - lastExpAt) < 2000;
    if (!(nearPlayer || nearExp)) return;
    if (!shouldLoot(d.itemId)) {
      log('⛔ ข้าม', nameOf(d.itemId), '(ตัวกรอง mode=' + CFG.filter.mode + ') drop', d.dropId);
      return;
    }
    queue.set(d.dropId, { dropId: d.dropId, itemId: d.itemId, x: d.x, y: d.y, attempts: 0, lastAttemptAt: 0, addedAt: now });
    log('🎯 คิวเก็บ', nameOf(d.itemId), 'drop', d.dropId, '@(', d.x.toFixed(1), d.y.toFixed(1) + ')');
  }
  function markCombat() { lastCombatAt = Date.now(); }

  // ---------- ประมวลผล packet ----------
  function handleIn(u) {
    if (!u.length) return;
    const op = u[0];

    // 0x25 STAT: HP/SP ของ entity → [25][eid:4][statType:4][cur:4][max:4][flag:1]
    //   ★★ ห้ามตั้ง playerId จากที่นี่! STAT ส่งมาให้หลาย entity (player + monster)
    //      entityId แรกที่ส่ง STAT อาจเป็น monster → playerId ผิด → player position ไม่อัปเดต
    //      playerId ต้องมาจาก SELECT_CHAR(0x03) หรือ SPAWN(flag=1) เท่านั้น
    if (op === 0x25 && u.length >= 18) {
      const id = u32(u, 1);
      const cur = u32(u, 9), m = u32(u, 13);
      applyStat(id, cur, m);
    }
    // 0x07 MOVE: ตำแหน่ง entity (ทั้ง player + monster/NPC)
    //   ★ player ใช้ i16 (offset 5/7) เหมือน monster เพื่อให้ระบบพิกัดตรงกัน (combat คำนวณระยะ/ทิศได้แม่น)
    //   ★ VALID_COORD: พิกัด Ragnarok อยู่ในช่วง [-500, 1000] — ค่านอกนี้ = parse ผิด → ปฏิเสธ
    else if (op === 0x07 && u.length >= 9) {
      const id = u32(u, 1);
      const x = i16(u, 5), y = i16(u, 7);
      // sanity check: พิกัดต้องอยู่ในช่วงแผนที่ (-500 ถึง 1000) — กัน garbage จาก parse ผิด
      const valid = (x >= -500 && x <= 1000 && y >= -500 && y <= 1000);
      if (!valid) return;   // พิกัดผิดปกติ → ข้ามทั้ง packet
      // ★ (D) stalePlayerIds check — กัน phantom entity จาก oldPlayerId (mirror world.js:1562)
      if (isStaleId(id, nowMs())) return;
      if (playerId != null && id === playerId) {
        player.x = x; player.y = y;
        // ★ ซิงค์ entities[playerId] ให้ตรง player.x/y (กัน entity ค้างที่ค่าผิด)
        const pe = entities.get(playerId);
        if (pe) { pe.x = x; pe.y = y; pe.kind = 0; pe.alive = true; }
        else { entities.set(playerId, { id, kind: 0, x, y, alive: true }); }
      } else {
        const e = entities.get(id);
        if (e) { e.x = x; e.y = y; }
        else { entities.set(id, { id, kind: 1, x, y, alive: true }); }   // assume monster
      }
    }
    // 0x0b ATTACK_RESULT: ถ้าตัวเราเป็นคนตี → กำลังสู้
    else if (op === 0x0b && u.length >= 9) {
      if (playerId != null && u32(u, 1) === playerId) markCombat();
    }
    // 0x22 EXP: เราฆ่ามอนได้ → นับ stats
    //   format: [22][baseTotal:4][baseDelta:4][jobTotal:4][jobDelta:4] (17 bytes)
    else if (op === 0x22) {
      lastExpAt = Date.now(); markCombat();
      stats.kills++;
      // parse EXP delta อย่างปลอดภัย (signed — delta อาจเป็นลบได้ในบางเซิร์ฟ)
      if (u.length >= 17) {
        const baseDelta = u32(u, 5) | 0;   // offset 5 = baseDelta, |0 = แปลงเป็น signed
        const jobDelta  = u32(u, 13) | 0;  // offset 13 = jobDelta
        const gain = Math.max(0, baseDelta) + Math.max(0, jobDelta);
        if (gain > 0) stats.expGained += gain;
      }
      for (const d of recentDrops.values()) tryClaim(d);
    }
    // 0x51 ITEM_DROP: ของตก
    else if (op === 0x51 && u.length >= 15) {
      const d = { dropId: u32(u, 1), x: f32(u, 5), y: f32(u, 9), itemId: u16(u, 13), t: Date.now() };
      recentDrops.set(d.dropId, d);
      tryClaim(d);
    }
    // 0x52 PICKUP result (เช็คทั้ง queue ปกติ + warpQueue)
    else if (op === 0x52 && u.length >= 9) {
      const picker = u32(u, 1), dropId = u32(u, 5);
      const it = queue.get(dropId);
      const wit = warpQueue.get(dropId);   // ★ อาจมาจาก warpQueue หลังวาร์ปไปเก็บ
      if (picker !== FAIL) {
        if (it) { queue.delete(dropId); }
        if (wit) { warpQueue.delete(dropId); log('✨ วาร์ปไปเก็บสำเร็จ:', nameOf(wit.itemId), 'drop', dropId); }
        const itemId = (it || wit).itemId;
        stats.itemsLooted++;
        stats.itemsByCount.set(itemId, (stats.itemsByCount.get(itemId) || 0) + 1);
        log('✅ เก็บได้', nameOf(itemId), 'drop', dropId);
        // ★ ถ้าเก็บหมดแล้ว (queue ว่าง) → trigger cooldown ก่อน combatLoop acquire ใหม่
        if (queue.size === 0 && warpQueue.size === 0) {
          combatCooldownUntil = nowMs() + CFG.postCombatDelayMs;
        }
      } else {
        // server ตอบ FAIL ชัดเจน → ของอาจถูกมอนเก็บไปแล้ว → ลด attempts ที่เหลือให้เหลือ 1 (ลองอีกทีเดียวแล้วปล่อย)
        stats.pickupFails++;
        if (it) {
          if (it.attempts >= CFG.maxAttempts - 1) {
            queue.delete(dropId);
            log('🚫 ปล่อย', nameOf(it.itemId), 'drop', dropId, '(server ตอบ FAIL', it.attempts, 'ครั้ง — ของอาจถูกเก็บไปแล้ว)');
          }
        }
        // wit ไม่ delete ที่นี่ → warpLoop จะจัดการ offset ถัดไป
      }
    }
    // 0x24 DEATH: player ตาย → ล็อค isDead (ห้าม heal ตอนตาย) + รีเซ็ต HP
    else if (op === 0x24 && u.length >= 5 && playerId != null && u32(u, 1) === playerId) {
      isDead = true;
      hp.cur = 0;
      stats.deaths++;
      log('☠️ ตัวละครตาย — หยุด heal จนกว่าจะ respawn');
    }
    // 0x12 MAP_NAME: ชื่อแมปปัจจุบัน → เก็บไว้ใช้สำหรับ warp
    //   format: [12][len:2 LE][mapname UTF-8]
    else if (op === 0x12 && u.length >= 3) {
      const len = u16(u, 1);
      if (u.length >= 3 + len) {
        const name = new TextDecoder().decode(u.slice(3, 3 + len));
        if (name && name !== currentMap) { currentMap = name; log('🗺️ แมป:', name); }
      }
    }
    // 0x03 SELECT_CHAR: server ตอบหลังเลือกตัวละคร — ★ ฝัง mapName (MAP_NAME ไม่ส่งตอน login ครั้งแรก)
    //   format: [03][eid:4][len:2][mapname null-terminated]
    else if (op === 0x03 && u.length >= 7) {
      const eid = u32(u, 1);
      if (playerId == null && eid) { playerId = eid; log('👤 player_id =', eid.toString(16), '(จาก SELECT_CHAR)'); }
      const mapLen = u16(u, 5);
      if (u.length >= 7 + mapLen && mapLen > 0) {
        let name = new TextDecoder().decode(u.slice(7, 7 + mapLen));
        name = name.split('\0')[0];   // ตัดที่ null terminator
        if (name && name !== currentMap) { currentMap = name; log('🗺️ แมป:', name, '(จาก SELECT_CHAR)'); }
      }
    }
    // 0x2a WARP_FAIL: server บอกว่าพิกัดวาร์ป invalid (กำแพง/น้ำ) → warpLoop จะลอง offset ถัดไป
    //   format: [2a][02]
    else if (op === 0x2a && u.length >= 2) {
      if (lastWarpTargetId != null) {
        const wit = warpQueue.get(lastWarpTargetId);
        if (wit) {
          log('⚠️ วาร์ป fail (พิกัด invalid) → ลอง offset ถัดไป:', nameOf(wit.itemId));
          wit.offsetIdx++;              // บังคับ offset ถัดไปใน warpLoop
          wit.warpAt = 0;               // ให้ warpLoop วาร์ปใหม่ได้เลย (ผ่าน cooldown)
        }
        lastWarpTargetId = null;
      }
    }
    // 0x36 DESPAWN_REASON: [36][eid:4][reason:4] — reason=2 = entity ถูกเก็บไป (โดย player หรือมอน loot)
    //   ★ สำคัญ: ถ้าของที่เรารอเก็บถูกมอน loot (เช่น Poring กินของ) → ลบออกจาก queue ทันที ไม่ต้องลองเก็บเปล่าๆ
    else if (op === 0x36 && u.length >= 9) {
      const eid = u32(u, 1);
      const reason = u32(u, 5);
      if (reason === 2) {
        // ของถูกเก็บไป → ลบจาก queue/recentDrops/warpQueue
        if (queue.has(eid)) {
          const it = queue.get(eid);
          queue.delete(eid);
          log('🗑️ ของหายไป:', nameOf(it.itemId), 'drop', eid, '(ถูกเก็บไปแล้ว — อาจโดยมอน loot)');
        }
        recentDrops.delete(eid);
        warpQueue.delete(eid);
      }
    }
    // ============== COMBAT packets ==============
    // 0x06 SPAWN: สร้าง/อัปเดต entity (kind=0 player/1 monster/2 NPC)
    //   layout: [06][flag:1][type:4][0f][id:4][sub:4][?:4][z:i32][nameLen:4][name][kind:1][class:2][x:i32][y:i32][hp:u32][hpMax:u32]
    //   ★ name เริ่มที่ offset 27 (หลัง z@19-22 + nameLen@23-26) ไม่ใช่ 19!
    //   nameLen (u32 @23) ใช้ได้สำหรับ ASCII แต่ผิดสำหรับ UTF-8 ไทย → scan สำรอง
    else if (op === 0x06 && u.length >= 27) {
      try {
        const flag = u[1];
        const id = u32(u, 7);            // offset 7 (ข้าม marker 0x0f @6)
        const sub = u32(u, 11);          // offset 11
        // ★ flag=1 = SPAWN ตัวเอง → ใช้หา/อัปเดต playerId (mirror world.js:1280)
        //   ถ้า playerId เปลี่ยน (respawn/warp) → track oldId เป็น stale + clear entities
        if (flag === 1) {
          if (playerId == null) {
            playerId = id; log('👤 player_id =', id.toString(16), '(จาก SPAWN flag=1)');
          } else if (playerId !== id) {
            // ID เปลี่ยน (respawn/warp) → track oldId + clear entities (mirror world.js:1250-1278)
            log('🔄 player_id เปลี่ยน:', playerId.toString(16), '→', id.toString(16));
            stalePlayerIds.set(playerId, nowMs() + 300000);  // stale 5 นาที
            entities.clear();
            monsterAggro.clear(); mobAttackers.clear();
            playerId = id;
          }
        }
        // z @ 19-22 (i32 signed) — ข้าม
        const nameLenField = u32(u, 23); // nameLen @ 23 (u32 — น่าเชื่อถือไม่ได้สำหรับ UTF-8 ไทย)
        // หา nameEnd: เริ่มจาก 27+nameLenField ถ้าดูเหมือน ASCII, ไม่งั้น scan จาก offset 27
        let nameEnd = 27 + nameLenField;
        let name = '';
        if (nameLenField > 0 && nameLenField < 32) {
          const candidate = u.slice(27, 27 + nameLenField);
          const lastByte = candidate[candidate.length - 1];
          const looksTruncated = (lastByte >= 0x80);   // ถ้า byte สุดท้ายเป็น UTF-8 continuation → ตัดกลางคัน
          if (looksTruncated) {
            // scan หา [00 00][kind<=2] จาก offset 27 (ข้าม z + nameLen)
            for (let i = 27; i < u.length - 2; i++) {
              if (u[i] === 0 && u[i + 1] === 0 && u[i + 2] <= 2) { nameEnd = i; break; }
            }
          }
          try { name = new TextDecoder('utf8', { fatal: false }).decode(u.slice(27, nameEnd)); } catch (e) { name = ''; }
        } else {
          // nameLen ผิดปกติ → scan หา [00 00][kind<=2] จาก offset 27
          nameEnd = -1;
          for (let i = 27; i < u.length - 2; i++) {
            if (u[i] === 0 && u[i + 1] === 0 && u[i + 2] <= 2) { nameEnd = i; break; }
          }
          if (nameEnd < 0) nameEnd = u.length;   // ไม่เจอ → ใช้ท้าย packet
          try { name = new TextDecoder('utf8', { fatal: false }).decode(u.slice(27, nameEnd)); } catch (e) { name = ''; }
        }
        // kind @ nameEnd + 2 (หลัง 00 00 ตัวที่ 2) — เหมือนบอทหลักที่ scan pattern หา kind
        // จริงๆ nameEnd ใน path scan = index ของ 00 ตัวแรก → kind อยู่ที่ nameEnd+2
        // ใน path nameLen (ไม่ scan) → nameEnd = 27+nameLenField → kind @ nameEnd ตรงๆ
        // แก้โดยใช้ logic เดียวกับบอทหลัก: kind = byte หลัง name
        let kind = -1;
        // ถ้า nameEnd มาจาก scan (มี 00 00 ก่อน) → kind @ nameEnd+2
        if (u[nameEnd] === 0 && u[nameEnd + 1] === 0) kind = u[nameEnd + 2];
        else kind = u[nameEnd];   // nameEnd = จุดสิ้นสุดชื่อ (path nameLen)
        if (kind < 0 || kind > 2) {
          // kind ไม่ valid → scan ใหม่หา pattern [00 00][0-2]
          for (let i = 27; i < u.length - 2; i++) {
            if (u[i] === 0 && u[i + 1] === 0 && u[i + 2] <= 2) { nameEnd = i; kind = u[i + 2]; break; }
          }
        }
        if (kind >= 0 && kind <= 2) {
          let x = null, y = null, hp = null, hpMax = null;
          // x/y/hp/hpMax relative to nameEnd (kind @ nameEnd+2 → data เริ่ม nameEnd+3)
          // ★ บอทหลัก: x @ nameEnd+3, y @ nameEnd+7 (i32 signed), hp @ +12, hpMax @ +16
          if (u.length >= nameEnd + 20) {
            let rx = u32(u, nameEnd + 3); rx = rx > 0x7fffffff ? rx - 0x100000000 : rx;
            let ry = u32(u, nameEnd + 7); ry = ry > 0x7fffffff ? ry - 0x100000000 : ry;
            // ★ VALID_COORD: พิกัดต้องอยู่ในช่วงแผนที่ [-500, 1000] — ถ้าไม่ใช่ = nameEnd ผิด → ไม่รับ
            if (rx >= -500 && rx <= 1000 && ry >= -500 && ry <= 1000) { x = rx; y = ry; }
            const v3 = u32(u, nameEnd + 12);
            const v4 = u32(u, nameEnd + 16);
            if (v3 > 0 && v3 <= v4) { hp = v3; hpMax = v4; }
          }
          const existing = entities.get(id) || {};
          entities.set(id, {
            id, kind, sub, name,
            x: x != null ? x : (existing.x != null ? existing.x : null),
            y: y != null ? y : (existing.y != null ? existing.y : null),
            hp: hp != null ? hp : existing.hp,
            hpMax: hpMax != null ? hpMax : existing.hpMax,
            alive: true,
            _lastEngagedByOtherAt: existing._lastEngagedByOtherAt || 0,
            _lastDamageAt: existing._lastDamageAt || 0,
          });
          // ★ (C) SPAWN อัปเดต player.x/y ด้วย (mirror world.js:1289-1292) — กัน stale หลังวาร์ป
          if (id === playerId && x != null) { player.x = x; player.y = y; }
        }
      } catch (e) { /* SPAWN parse error ข้าม */ }
    }
    // 0x07 MOVE_UPDATE: อัปเดตตำแหน่ง entity — merge แล้วใน handler 0x07 ด้านบน (player + entity)
    // 0x3c ENTITY_LIST: batch ตำแหน่ง [3c][count:2][eid:4][x:2][y:2][flag:1]...
    else if (op === 0x3c && u.length >= 3) {
      const count = u16(u, 1);
      const now = nowMs();
      let p = 3;
      for (let i = 0; i < count && p + 9 <= u.length; i++) {
        const id = u32(u, p);
        const x = i16(u, p + 4), y = i16(u, p + 6);
        // sanity check พิกัด (กัน garbage)
        if (x >= -500 && x <= 1000 && y >= -500 && y <= 1000) {
          if (id !== playerId && !isStaleId(id, now)) {
            const e = entities.get(id);
            if (e) { e.x = x; e.y = y; }
            else { entities.set(id, { id, kind: 1, x, y, alive: true }); }
          } else if (id === playerId) { player.x = x; player.y = y; }   // ★ player ด้วย
        }
        p += 9;
      }
    }
    // 0x14 ENTITY_POS: [14][id:4][x:2][y:2][flag:1]
    else if (op === 0x14 && u.length >= 9) {
      const id = u32(u, 1);
      const x = i16(u, 5), y = i16(u, 7);
      if (x >= -500 && x <= 1000 && y >= -500 && y <= 1000) {   // sanity
        if (id !== playerId && !isStaleId(id, nowMs())) {
          const e = entities.get(id);
          if (e) { e.x = x; e.y = y; }
          else { entities.set(id, { id, kind: 1, x, y, alive: true }); }
        } else if (id === playerId) { player.x = x; player.y = y; }
      }
    }
    // 0x0b ATTACK_RESULT IN: [0b][attacker:4][target:4]...[damage:4 @17 ถ้ามี]
    //   + 0x26 variant: [26][attacker:4][damage:4] (มอนตี player)
    //   ★ บอทหลักรับแค่ 8 bytes (attacker+target) damage เป็น optional — กันเคส packet สั้น
    else if ((op === 0x0b || op === 0x26) && playerId != null) {
      let attacker, victimId, damage;
      if (op === 0x26 && u.length >= 9) { attacker = u32(u, 1); victimId = 0; damage = u32(u, 5); }
      else if (op === 0x0b && u.length >= 9) {   // ★ ลดจาก 21 → 9 (รับ packet สั้น)
        attacker = u32(u, 1); victimId = u32(u, 5);
        damage = u.length >= 21 ? u32(u, 17) : 0;   // damage optional (offset 17 ถ้ามี)
      }
      else return;
      const now = nowMs();
      // ★ DEBUG: ถ้ากำลังตี target อยู่ → log packet จริงเพื่อหาสาเหตุ reset ไม่ทำงาน
      if (target && CFG.verbose) {
        const isOur = (attacker === playerId);
        const isTgt = (victimId === target.id);
        if (!isOur && !isTgt && victimId !== playerId && victimId !== 0) {
          // packet ไม่ match ทั้ง playerId ทั้ง target.id → น่าสงสัย
          console.log('[ASSIST][debug] ATTACK_RESULT ไม่ match: attacker=' + attacker.toString(16) + ' victim=' + victimId.toString(16) + ' target=' + target.id.toString(16) + ' playerId=' + playerId.toString(16) + ' len=' + u.length + ' dmg=' + damage);
        }
      }
      // เราตีมอน → ลด HP มอน + reset pending + mark combat
      //   ★ reset pending เฉพาะ damage > 0 (miss ไม่ reset — กันค้างตีมอนที่ตีไม่ได้)
      //   ★ reset pending ถ้า victimId = target ปัจจุบัน (แม้ attacker ไม่ตรง playerId — กัน playerId ผิด)
      //   ★ ถ้าไม่มี entity ใน map → สร้างเลย (กัน _lastDamageAt ไม่ถูก stamp)
      const isOurAttack = (attacker === playerId && victimId !== playerId && victimId !== 0);
      const isTargetHit = (target && victimId === target.id && victimId !== 0 && victimId !== playerId);
      if (isOurAttack || isTargetHit) {
        let m = entities.get(victimId);
        if (!m) { m = { id: victimId, kind: 1, alive: true }; entities.set(victimId, m); }   // สร้างถ้าไม่มี
        m._lastDamageAt = now;
        if (damage > 0 && m.hp != null && m.hpMax != null) m.hp = Math.max(0, m.hp - damage);
        // ★ reset pending เฉพาะ damage > 0 (mirror bot.js:343) — miss (damage=0) ไม่ reset
        if (damage > 0 && target && target.id === victimId) { target.lastAttackResultAt = now; target.pendingAttacks = 0; target.firstAttackAt = 0; stuckAbandonCount = 0; stuckAbandonHistory = []; }
        markCombat();
      }
      // มอนตีเรา → mark mobAttacker
      else if (victimId === playerId || (victimId === 0 && attacker !== playerId)) {
        mobAttackers.set(attacker, now);
        markCombat();
      }
      // คนอื่นตีมอน → mark engaged (KS avoidance)
      else if (attacker !== playerId && victimId !== playerId && victimId !== 0) {
        const m = entities.get(victimId);
        if (m && m.kind === 1) m._lastEngagedByOtherAt = now;
      }
    }
    // 0x18 MONSTER_SKILL: [18][srcId:4][dstId:4][skillId:2]... → aggro detection
    else if (op === 0x18 && u.length >= 11 && playerId != null) {
      const srcId = u32(u, 1), dstId = u32(u, 5);
      if (dstId === playerId) { monsterAggro.set(srcId, nowMs()); markCombat(); }
    }
    // 0x0f ENTITY_ACTION: action=3 = ตาย (authoritative)
    else if (op === 0x0f && u.length >= 6 && u[5] === 3) {
      const id = u32(u, 1);
      const e = entities.get(id);
      if (e) { e.alive = false; }
      entities.delete(id);
      if (target && target.id === id) {
        abandonTarget('ฆ่าได้', false); target = null;
        // ★ trigger post-combat cooldown (รอก่อน acquire ใหม่ — ถ้ามีของ loot-blocking จะเก็บก่อน)
        combatCooldownUntil = nowMs() + CFG.postCombatDelayMs;
      }
    }
    // 0x1b DESPAWN: entity หาย (มี false-despawn guard)
    else if (op === 0x1b && u.length >= 5) {
      const id = u32(u, 1);
      const e = entities.get(id);
      if (e) {
        const now = nowMs();
        if (e._lastDamageAt && now - e._lastDamageAt < 3000) { e.alive = false; }   // false despawn guard
        else { entities.delete(id); if (target && target.id === id) { abandonTarget('despawn', false); target = null; } }
      }
    }
  }
  function handleOut(u) {
    if (!u.length) return;
    if (u[0] === 0x0b) markCombat();
  }

  // ---------- loop เก็บของ ----------
  const lootLoop = setInterval(() => {
    if (!CFG.lootEnabled) return;
    const now = Date.now();
    for (const [id, it] of queue) {
      if (now - it.addedAt > CFG.itemMaxAgeMs) { queue.delete(id); log('⌛ หมดอายุ drop', id); }
    }
    for (const [id, d] of recentDrops) if (now - d.t > 4000) recentDrops.delete(id);

    // ทิ้งชิ้นที่ครบ maxAttempts — ถ้าเปิด warpLoot ให้ย้ายไป warpQueue แทนที่จะปล่อยทิ้ง
    for (const [id, it] of queue) {
      if (it.attempts >= CFG.maxAttempts) {
        queue.delete(id);
        if (CFG.warpLootEnabled && currentMap) {
          // ★ ย้ายไป warpQueue เพื่อวาร์ปไปเก็บ (น่าจะติดกำแพง/หน้าผา)
          warpQueue.set(id, { dropId: id, itemId: it.itemId, x: it.x, y: it.y, offsetIdx: 0, warpAt: 0, pickupSentAt: 0 });
          log('🌀 เก็บไม่ได้ครบ', it.attempts, 'ครั้ง → วาร์ปไปเก็บ:', nameOf(it.itemId), 'drop', id);
        } else {
          log('🚫 ปล่อย', nameOf(it.itemId), 'drop', id, '(ล้มเหลว', it.attempts, 'ครั้ง ไม่มีผลจาก server)');
        }
      }
    }

    const eligible = [];
    for (const it of queue.values()) {
      if (it.attempts >= CFG.maxAttempts) continue;
      if (now - it.lastAttemptAt < CFG.attemptIntervalMs) continue;
      // ★ รอ lootDelayAfterDropMs หลังของตก ก่อนเริ่มเก็บ (addedAt = ตอนของตกเข้าคิว)
      if (now - it.addedAt < CFG.lootDelayAfterDropMs) continue;
      eligible.push(it);
    }
    if (!eligible.length) return;
    if (now - lastSendAt < CFG.sendThrottleMs) return;

    eligible.sort((a, b) => a.lastAttemptAt - b.lastAttemptAt);
    const it = eligible[0];
    if (sendPickup(it.dropId)) {
      it.lastAttemptAt = now; it.attempts++; lastSendAt = now;
      log('📨 ลองเก็บ', nameOf(it.itemId), 'drop', it.dropId, '(ครั้ง', it.attempts + '/' + CFG.maxAttempts + ')');
    }
  }, CFG.lootTickMs);

  // ============================================================
  //  WARP-TO-LOOT loop — วาร์ปไปเก็บของที่เก็บไม่ได้ (ติดกำแพง/หน้าผา)
  // ============================================================
  //  offset pattern: กลาง → เหนือ3 → ตอ3 → ใต้3 → ตต3 (เหมือนบอทหลัก)
  const WARP_OFFSETS = [[0,0,'กลาง'], [0,-3,'เหนือ3'], [3,0,'ตอ3'], [0,3,'ใต้3'], [-3,0,'ตต3']];
  const warpLoop = setInterval(() => {
    if (!CFG.warpLootEnabled) return;
    if (!currentMap) return;                          // ไม่รู้แมป → ไม่วาร์ป (กัน packet ผิด)
    const now = Date.now();

    for (const [id, wit] of warpQueue) {
      // ครบ offset ทั้งหมดแล้วยัง fail → ปล่อยทิ้ง
      if (wit.offsetIdx >= Math.min(CFG.warpLootMaxOffsets, WARP_OFFSETS.length)) {
        warpQueue.delete(id);
        log('🚫 ปล่อย', nameOf(wit.itemId), 'drop', id, '(วาร์ปครบ', wit.offsetIdx, 'offset แล้วยังไม่ได้)');
        continue;
      }

      // ถ้ายังไม่ได้วาร์ปในรอบนี้ และผ่าน cooldown แล้ว → วาร์ป
      if (wit.warpAt === 0 && now - lastWarpAt >= CFG.warpLootCooldownMs) {
        const off = WARP_OFFSETS[wit.offsetIdx] || [0, 0, '?'];
        const tx = Math.round(wit.x + off[0]);
        const ty = Math.round(wit.y + off[1]);
        if (sendTeleport(currentMap, tx, ty)) {
          wit.warpAt = now;
          wit.pickupSentAt = 0;
          lastWarpAt = now;
          lastWarpTargetId = id;
          log('🌀 วาร์ปไปเก็บ', nameOf(wit.itemId), '@(', tx, ty, ') offset', off[2]);
        }
        return;   // วาร์ปทีละชิ้นต่อรอบ
      }

      // หลังวาร์ปแล้วรอ warpLootPickupDelayMs → ส่ง pickup อีกครั้ง
      if (wit.warpAt !== 0 && wit.pickupSentAt === 0 && now - wit.warpAt >= CFG.warpLootPickupDelayMs) {
        if (sendPickup(id)) {
          wit.pickupSentAt = now;
          log('📨 ลองเก็บหลังวาร์ป', nameOf(wit.itemId), 'drop', id);
        }
        return;
      }

      // ถ้าส่ง pickup ไปแล้ว แต่รอนานเกินไป (server เงียบ = วาร์ปไปที่ไม่ดี) → offset ถัดไป
      if (wit.pickupSentAt !== 0 && now - wit.pickupSentAt > 3000) {
        wit.offsetIdx++;
        wit.warpAt = 0;
        wit.pickupSentAt = 0;
        log('⏭️', nameOf(wit.itemId), 'ยังไม่ได้หลังวาร์ป → offset ถัดไป');
        return;
      }
    }
  }, CFG.lootTickMs);

  // ============================================================
  //  AUTO-COMBAT — entity tracker + state machine
  // ============================================================
  // ---------- entity tracker ----------
  //  kind: 0=player, 1=monster, 2=NPC (จาก SPAWN)
  const entities = new Map();    // id -> {id,kind,sub,name,x,y,hp,hpMax,alive,_lastEngagedByOtherAt,_lastDamageAt}
  const monsterAggro = new Map(); // monsterId -> timestamp (มอนจับเราเป็นเป้า)
  const stalePlayerIds = new Map(); // oldPlayerId -> expireAt (กัน phantom entity จาก ID เก่า, 5 นาที)
  function isStaleId(id, now) {
    const exp = stalePlayerIds.get(id);
    if (!exp) return false;
    if (now >= exp) { stalePlayerIds.delete(id); return false; }
    return true;
  }
  const mobAttackers = new Map(); // monsterId -> timestamp (มอนตีเรา)
  let noMonsterSince = 0;        // timestamp ที่เริ่มไม่เจอมอน
  let lastWanderAt = 0;
  let lastFleeAt = 0;
  let lastWarpFindAt = 0;        // throttle warpFind กัน spam
  let lastTargetSwitchAt = 0;    // throttle การสลับ target (กันสลับบ่อย)

  // ---------- combat target state ----------
  let target = null;             // {id, x, y, acquiredAt, engageAt, lastAttackAt, lastAttackResultAt, pendingAttacks, stuckCount, warpCount}
  let lastWalkPos = null;        // {x,y} สำหรับ stuck detection
  let stuckWalkCount = 0;
  let stuckAbandonCount = 0;
  let stuckAbandonHistory = [];  // timestamps ใน 60s
  const warpToMonsterCount = new Map(); // entityId -> count

  // ---------- combat helpers ----------
  function nowMs() { return Date.now(); }

  // whitelist/blacklist matching (รองรับทั้งชื่อ + sprite id แบบ number)
  function matchList(entity, list) {
    if (!list || !list.length) return false;
    return list.some(e => {
      if (typeof e === 'number') return entity.sub === e;
      return entity.name && entity.name.toLowerCase() === String(e).toLowerCase();
    });
  }
  function isTargetable(m, now) {
    if (!m || !m.alive) return false;
    if (m.kind !== 1) return false;                       // ตีเฉพาะ monster
    if (m.x == null || m.y == null) return false;
    // ★ ข้ามมอนที่เพิ่ง abandon (กันเลือกตัวเดิมซ้ำทันที → วนลูป)
    const ab = abandonCooldown.get(m.id);
    if (ab && now < ab) return false;
    if (ab && now >= ab) abandonCooldown.delete(m.id);    // หมดอายุ → ล้าง
    // ★ ผ่อน guard: ต้องเคยเห็น SPAWN (มี sub) หรืออยู่ใกล้ตัวเรามาก (≤12 ช่อง — NPC มักนิ่ง ไม่ใช่อันตราย)
    //   กัน ghost entity ไกลๆ แต่ยอมรับมอนใกล้ที่อาจยังไม่ได้ SPAWN
    if (m.sub == null) {
      if (player.x == null) return false;
      const d = Math.hypot(m.x - player.x, m.y - player.y);
      if (d > 12) return false;                           // ghost ไกล → ข้าม (รอ SPAWN)
    }
    if (matchList(m, CFG.targetBlacklist)) return false;
    if (CFG.targetWhitelist.length && !matchList(m, CFG.targetWhitelist)) return false;
    // anti-KS: ข้ามมอนที่คนอื่นตีอยู่
    if (CFG.antiKS && m._lastEngagedByOtherAt && now - m._lastEngagedByOtherAt < CFG.antiKSCooldownMs) return false;
    // avoid players: ข้ามมอนที่อยู่ใกล้ผู้เล่นคนอื่น
    if (CFG.avoidOtherPlayers) {
      for (const e of entities.values()) {
        // ★ ต้องมี name ด้วย (mirror world.js:1777) — กัน ghost entity kind=0 ที่ไม่มีชื่อ
        if (e.kind === 0 && e.alive && e.id !== playerId && e.x != null && e.name && !isStaleId(e.id, now)) {
          if (Math.hypot(e.x - m.x, e.y - m.y) <= CFG.playerProximityRadius) return false;
        }
      }
    }
    return true;
  }
  function getMonsters(now) {
    const out = [];
    for (const m of entities.values()) {
      if (isTargetable(m, now || nowMs())) out.push(m);
    }
    return out;
  }
  function countMonsters(radius) {
    if (player.x == null) return 0;
    let n = 0;
    for (const m of entities.values()) {
      if (m.kind === 1 && m.alive && m.x != null && Math.hypot(m.x - player.x, m.y - player.y) <= radius) n++;
    }
    return n;
  }
  // นับมอนที่ aggro เรา (MONSTER_SKILL dstId=player) ที่ยังมีอยู่จริง — สำหรับ UI/แสดงผล
  function getAggroCount(radius) {
    const now = nowMs();
    let n = 0;
    for (const [id, t] of monsterAggro) {
      if (now - t > 10000) { monsterAggro.delete(id); continue; }
      const m = entities.get(id);
      if (!m || !m.alive || m.x == null) { monsterAggro.delete(id); continue; }
      if (isStaleId(id, now)) { monsterAggro.delete(id); continue; }
      if (player.x != null && radius && Math.hypot(m.x - player.x, m.y - player.y) > radius) continue;
      n++;
    }
    return n;
  }
  // ★ getThreatCount = max(aggro, nearby) — สำหรับ flee logic (mirror world.js:1018-1044)
  function getThreatCount(radius) {
    return Math.max(getAggroCount(radius), radius ? countMonsters(radius) : 0);
  }
  function getMobAttackerCount(radius) {
    const now = nowMs();
    let n = 0;
    for (const [id, t] of mobAttackers) {
      if (now - t >= CFG.fleeMobWindowMs) { mobAttackers.delete(id); continue; }   // หมดอายุ → ลบ
      if (isStaleId(id, now)) { mobAttackers.delete(id); continue; }              // stale player ID → ลบ
      const m = entities.get(id);
      if (!m || !m.alive || m.x == null) { mobAttackers.delete(id); continue; }   // entity หาย → ลบ
      // ถ้าระบุ radius → นับเฉพาะในรัศมี (เหมือน aggro)
      if (radius && player.x != null && Math.hypot(m.x - player.x, m.y - player.y) > radius) continue;
      n++;
    }
    return n;
  }
  // คำนวณ HP% (default 1.0 ถ้าไม่รู้)
  function monsterHpPct(m) { return (m.hpMax && m.hpMax > 0 && m.hp != null) ? m.hp / m.hpMax : 1.0; }
  // เลือกมอนใกล้สุด (cap ระยะ maxAcquireDistance — กันเลือกมอนไกลเกินไป)
  function findNearestMonster(now) {
    if (player.x == null) return null;
    let best = null, bestD = Infinity;
    for (const m of getMonsters(now)) {
      const d = Math.hypot(m.x - player.x, m.y - player.y);
      if (d > CFG.maxAcquireDistance) continue;   // ★ เกินระยะ acquire → ข้าม
      if (d < bestD) { bestD = d; best = m; }
    }
    return best ? { m: best, dist: bestD } : null;
  }
  // เลือกมอน HP% ต่ำสุด (tiebreak = ระยะ) — cap ระยะเหมือนกัน
  function findLowestHpMonster(now) {
    if (player.x == null) return null;
    let best = null, bestHp = 2, bestD = Infinity;
    for (const m of getMonsters(now)) {
      const hp = monsterHpPct(m);
      const d = Math.hypot(m.x - player.x, m.y - player.y);
      if (d > CFG.maxAcquireDistance) continue;   // ★ เกินระยะ acquire → ข้าม
      if (hp < bestHp || (hp === bestHp && d < bestD)) { bestHp = hp; bestD = d; best = m; }
    }
    return best ? { m: best, dist: bestD, hpPct: bestHp } : null;
  }

  // ---------- combat encoders ----------
  // ATTACK OUT: [0b][target_id:4]
  function sendAttack(targetId) {
    if (!activeWS || activeWS.readyState !== 1) return false;
    const b = new Uint8Array(5);
    b[0] = 0x0b;
    b[1] = targetId & 0xff; b[2] = (targetId >> 8) & 0xff;
    b[3] = (targetId >> 16) & 0xff; b[4] = (targetId >>> 24) & 0xff;
    activeWS.send(b);
    return true;
  }
  // MOVE OUT (click-move): [07][x:i16][y:i16] (signed)
  function sendMove(x, y) {
    if (!activeWS || activeWS.readyState !== 1) return false;
    const b = new Uint8Array(5);
    b[0] = 0x07;
    writeI16LE(b, 1, Math.round(x));
    writeI16LE(b, 3, Math.round(y));
    activeWS.send(b);
    return true;
  }
  // วาร์ปสุ่มในแมปปัจจุบัน (x=y=-999)
  function sendRandomWarp() {
    if (!currentMap) { log('⚠️ วาร์ปหนี: ยังไม่รู้ชื่อแมป'); return false; }
    return sendTeleport(currentMap, -999, -999);
  }
  // SIT/STAND OUT: [0e][state:1] (1=นั่ง, 0=ยืน) — format ยืนยันจากบอทหลัก protocol.js:381
  function sendSit() {
    if (!activeWS || activeWS.readyState !== 1) return false;
    activeWS.send(new Uint8Array([0x0e, 0x01]));
    return true;
  }
  function sendStand() {
    if (!activeWS || activeWS.readyState !== 1) return false;
    activeWS.send(new Uint8Array([0x0e, 0x00]));
    return true;
  }
  function clearCombatThreat() { monsterAggro.clear(); mobAttackers.clear(); }

  // ---------- combat state machine ----------
  // abandon target + (ถ้าเป็น stuck/ล้มเหลว) ตั้ง cooldown กันเลือกตัวเดิมซ้ำทันที
  //   cooldownMs: 0 = ไม่ตั้ง (เช่น ฆ่าได้/defensive ที่เป็นการเปลี่ยนเป้าปกติ)
  function abandonTarget(reason, stuck, cooldownMs = 0) {
    if (target) {
      log('🚫 abandon target', target.id, '(' + reason + ')');
      if (cooldownMs > 0) abandonCooldown.set(target.id, nowMs() + cooldownMs);
      if (stuck) {
        stuckAbandonHistory.push(nowMs());
        stuckAbandonHistory = stuckAbandonHistory.filter(t => nowMs() - t < 60000);
        stuckAbandonCount = stuckAbandonHistory.length;
      }
    }
    target = null;
    stuckWalkCount = 0;
  }
  function doFlee(reason) {
    const now = nowMs();
    if (now - lastFleeAt < CFG.fleeCooldownMs) return false;
    log('🏃 วาร์ปหนี:', reason);
    if (sendRandomWarp()) {
      lastFleeAt = now;
      clearCombatThreat();
      abandonTarget('flee', false);
      return true;
    }
    return false;
  }
  function acquireTarget(now) {
    // ★ cooldown: กันสลับ target บ่อยเกินไป (สลับได้ทุก 1.5s)
    if (now - lastTargetSwitchAt < 1500) return null;
    // whitelist ว่าง = ตีทุกมอน kind=1 (ตามความหมายของ whitelist); ตั้งค่า = ตีเฉพาะที่ match
    const mobCount = getMobAttackerCount();
    let found;
    if (CFG.targetLowestHpFirst && mobCount >= 2) {
      found = findLowestHpMonster(now);
      if (found) log('🎯 เลือกเป้า HP ต่ำสุด (รุม', mobCount, 'ตัว):', found.m.name, (found.hpPct * 100).toFixed(0) + '%');
    } else {
      found = findNearestMonster(now);
      if (found) log('🎯 เลือกเป้าใกล้สุด:', found.m.name, '@', found.dist.toFixed(1));
    }
    if (!found) return null;
    const m = found.m;
    target = {
      id: m.id, x: m.x, y: m.y, acquiredAt: now, engageAt: 0,
      lastAttackAt: 0, lastAttackResultAt: 0, pendingAttacks: 0, firstAttackAt: 0,
      stuckCount: 0, warpCount: 0,
    };
    lastTargetSwitchAt = now;
    return target;
  }
  // เดินไปหามอน — เดินเส้นตรงไปทางมอน + stuck detection ดูระยะลดลง
  let lastWalkToTargetAt = 0;
  let lastDistToTarget = null;
  let noProgressTicks = 0;
  const abandonCooldown = new Map();   // entityId → timestamp ที่ abandon (กันเลือกตัวเดิมซ้ำเลย)
  function walkToTarget(now, m) {
    if (player.x == null) return false;
    const dist = Math.hypot(m.x - player.x, m.y - player.y);
    // stuck detection: ดูว่าระยะลดลงไหม (แม่นกว่าดูพิกัดคงที่)
    if (lastDistToTarget != null) {
      if (dist < lastDistToTarget - 0.5) {
        noProgressTicks = 0;             // ใกล้ขึ้น → ไม่ stuck
      } else {
        noProgressTicks++;               // ไม่ใกล้ขึ้น → นับ stuck
      }
    }
    lastDistToTarget = dist;

    // ★ stuck จริงๆ (ระยะไม่ลด ≥10 tick ≈ 8s+) → return 'STUCK' ให้ caller ตัดสินใจ (warpToMonster/abandon)
    //   ไม่ abandon เองที่นี่ เพื่อให้ caller ควบคุม (เช่น warpToMonster อาจช่วยได้)
    if (noProgressTicks >= 10) {
      log('🚧 stuck: ไม่เข้าใกล้ ' + noProgressTicks + ' tick @ dist ' + dist.toFixed(1));
      return 'STUCK';
    }

    if (now - lastWalkToTargetAt < 800) return false;
    lastWalkToTargetAt = now;
    // เดินเส้นตรงไปทางมอน (step = min(ระยะที่เหลือ, walkStepDistance) — สั่งทีละ ≤20 ช่อง)
    let angle = Math.atan2(m.y - player.y, m.x - player.x);
    // ถ้า stuck (ระยะไม่ลด) → เปลี่ยนทิศตั้งฉากบ้างเพื่อหาทางอ้อม
    if (noProgressTicks >= 3) angle += (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2);
    else angle += (Math.random() * 2 - 1) * (Math.PI / 12);   // ±15° jitter เล็กน้อย
    const step = Math.min(dist, CFG.walkStepDistance);
    const tx = player.x + Math.cos(angle) * step;
    const ty = player.y + Math.sin(angle) * step;
    if (sendMove(tx, ty)) { log('🚶 เดินไปหา', m.name || m.id.toString(16), '@(', Math.round(tx), Math.round(ty) + ') dist=' + dist.toFixed(1) + ' step=' + Math.round(step) + ' stuck=' + noProgressTicks); return 'WALKING'; }
    return false;
  }

  let combatCooldownUntil = 0;   // ★ หยุด combat ชั่วคราวจนกว่าจะถึงเวลานี้ (post-combat delay)
  const combatLoop = setInterval(() => {
    if (!CFG.combatEnabled) return;
    if (isDead) { return; }
    if (!activeWS || activeWS.readyState !== 1) return;
    const now = nowMs();
    const pct = hpPct();
    const mobCount = getMobAttackerCount();

    // === -1. AUTO-REST (priority สูงสุด — ก่อน flee) ===
    //   ถ้า HP ต่ำ + ไม่โดนรุม → นั่งพัก; ถ้ากำลังนั่งอยู่ → จัดการลุก/นั่งต่อ
    if (CFG.restEnabled && pct != null && hp.cur != null) {
      if (!isResting && pct < CFG.restHpPercent && mobCount === 0) {
        // เริ่มนั่งพัก
        if (sendSit()) {
          isResting = true;
          restUntil = now + CFG.restMaxSec * 1000;
          log('🪑 นั่งพัก: HP', pct.toFixed(0) + '% < ' + CFG.restHpPercent + '% (นานสุด ' + CFG.restMaxSec + 's หรือจนถึง ' + CFG.restUntilPercent + '%)');
        }
        return;
      }
      if (isResting) {
        // โดนรุมระหว่างนั่ง → ลุกทันทีเพื่อตีตอบ (ไม่ return — ให้ flee/defensive ทำงานต่อ)
        if (mobCount > 0) {
          if (sendStand()) { log('⚠️ โดนรุมระหว่างนั่ง → ลุกทันที'); }
          isResting = false;
        }
        // ฟื้นถึง restUntilPercent หรือหมดเวลา → ลุก
        else if (pct >= CFG.restUntilPercent || now >= restUntil) {
          if (sendStand()) { log('🪑 ลุกยืน: HP', pct.toFixed(0) + '% (≥ ' + CFG.restUntilPercent + '%)'); }
          isResting = false;
          combatCooldownUntil = now + CFG.postCombatDelayMs;   // พักเล็กน้อยก่อนเริ่ม
        }
        else { return; }   // ยังนั่งอยู่ → หยุดทุกอย่าง
      }
    }

    // === 0. post-combat cooldown — รอหลังสู้เสร็จ/เก็บของเสร็จ ก่อนทำอย่างอื่น ===
    //   ยกเว้น flee (ต้องทำทันทีเสมอเพื่อความปลอดภัย)
    const inCooldown = now < combatCooldownUntil;
    if (CFG.fleeOnMobCount > 0 && getMobAttackerCount(CFG.fleeOnProximityRadius) >= CFG.fleeOnMobCount) { doFlee('รุม ' + getMobAttackerCount(CFG.fleeOnProximityRadius) + ' ตัว'); return; }
    if (CFG.fleeOnAggroCount > 0 && getThreatCount(CFG.fleeOnProximityRadius) >= CFG.fleeOnAggroCount) { doFlee('aggro ' + getThreatCount(CFG.fleeOnProximityRadius) + ' ตัว'); return; }
    if (CFG.fleeOnProximityCount > 0 && countMonsters(CFG.fleeOnProximityRadius) >= CFG.fleeOnProximityCount) { doFlee('มอนรอบ ' + countMonsters(CFG.fleeOnProximityRadius) + ' ตัว'); return; }
    if (inCooldown && mobCount === 0) return;   // อยู่ใน cooldown + ไม่โดนรุม → รอ

    // === 1b. ★ ถ้ามีของรอเก็บ → หยุด combat ชั่วคราว ให้ loot ทำงานก่อน ===
    //   เหตุผล: ฆ่ามอนได้ → เก็บของก่อน แล้วค่อยไปตีตัวใหม่ (เหมือนบอทหลัก _lootBlockingFarm)
    //   ยกเว้น: ถ้ากำลังโดนรุม (mobAttackers ≥1) → ยังตีต่อเพื่อป้องกันตัวเอง
    if (CFG.lootEnabled && queue.size > 0 && getMobAttackerCount() === 0) {
      return;   // มีของรอเก็บ + ไม่โดนรุม → รอ lootLoop เก็บก่อน
    }

    // === 1c. ★ warp guard — หลังวาร์ป player.x/y ค้างจนกว่า server จะส่ง MOVE_UPDATE ใหม่
    //   ถ้าคำนวณ dist ตอนนี้จะได้ค่าผิด (dist 0.0 หลอก) → ตีไม่ได้ → pending ขึ้น
    //   แก้: รอจนกว่า player pos จะเปลี่ยนจากก่อนวาร์ป (หรือหมดเวลา 3s)
    if (now < warpGuardUntil && lastWarpPlayerPos) {
      if (player.x === lastWarpPlayerPos.x && player.y === lastWarpPlayerPos.y) {
        return;   // pos ยังไม่เปลี่ยน → รอ (dist จะผิดถ้าคำนวณตอนนี้)
      }
      // pos เปลี่ยนแล้ว → เคลียร์ guard
      warpGuardUntil = 0;
      lastWarpPlayerPos = null;
    }

    // === 1b. Defensive retarget === ถ้าโดนมอนตี (ที่ไม่ใช่ target ปัจจุบัน) → สลับมาตีตัวนั้น
    //   สำคัญ: ถ้ามอน aggro เรา ต้องสู้กลับ ไม่ใช่เดินหาตัวอื่น
    if (player.x != null) {
      let attacker = null, attackerDist = Infinity;
      for (const [aid, at] of mobAttackers) {
        if (now - at > CFG.fleeMobWindowMs) { mobAttackers.delete(aid); continue; }
        if (target && aid === target.id) continue;   // ตัวที่กำลังตีอยู่แล้ว → ข้าม
        const am = entities.get(aid);
        if (!am || !am.alive || am.x == null) continue;
        if (!isTargetable(am, now)) continue;         // ตัวที่ตีเราต้อง targetable ด้วย
        const d = Math.hypot(am.x - player.x, am.y - player.y);
        if (d < attackerDist) { attackerDist = d; attacker = am; }
      }
      if (attacker) {
        if (target) abandonTarget('defensive → ตีตัวที่รุม', false);
        target = { id: attacker.id, x: attacker.x, y: attacker.y, acquiredAt: now, engageAt: 0, lastAttackAt: 0, lastAttackResultAt: 0, pendingAttacks: 0, firstAttackAt: 0, stuckCount: 0, warpCount: 0 };
        lastTargetSwitchAt = now;
        log('🛡️ สลับเป้า: ตีตัวที่กำลังตีเรา', attacker.name || attacker.id.toString(16));
        return;
      }
    }

    // === 2. Target validation / abandon ===
    if (target) {
      const m = entities.get(target.id);
      if (!m || !m.alive) { abandonTarget('ตาย/หาย', false); target = null; }
      else {
        target.x = m.x; target.y = m.y;
        // ★ ถ้ากำลังเข้าใกล้ขึ้น (dist ลด) → อย่า abandon (กำลังทำงานถูกต้อง)
        const curDist = (player.x != null) ? Math.hypot(m.x - player.x, m.y - player.y) : Infinity;
        if (target._lastDist != null && curDist < target._lastDist - 0.5) {
          target.pendingAttacks = 0;   // เข้าใกล้ขึ้น → reset pending (ไม่ใช่ stuck)
        }
        target._lastDist = curDist;
        // abandon เฉพาะเคสจริง: engage นานเกิน หรือ pending สูง (server เงียบ)
        const engageAge = target.engageAt ? (now - target.engageAt) / 1000 : 0;
        const acquireAge = (now - target.acquiredAt) / 1000;
        // ★ มอนยัง "กำลังสู้กับเรา" → ยกเลิก abandon จาก pending/server เงียบ
        //   สัญญาณ 3 อย่าง (อย่างน้อย 1 อย่างล่าสุด):
        //   1. monsterAggro (0x18) — มอนเลือกเราเป็นเป้า
        //   2. mobAttackers — มอนตีเรา
        //   3. _lastDamageAt — เราสร้าง damage ให้มอนได้จริง (สำคัญสำหรับมอนนิ่ง เช่น ไข่/เห็ด ที่ไม่ตีกลับ)
        const targetAggro = monsterAggro.get(target.id);
        const targetHitUs = mobAttackers.get(target.id);
        const targetDamaged = m._lastDamageAt;   // ★ เราตีมอนแล้วโดน (HP ลด)
        const lastCombatSignal = Math.max(targetAggro || 0, targetHitUs || 0, targetDamaged || 0);
        const isTargetStillEngaged = lastCombatSignal && (now - lastCombatSignal < CFG.aggroKeepAliveMs);
        if (target.engageAt && engageAge > CFG.maxEngageSec && !isTargetStillEngaged) {
          abandonTarget('engage นาน ' + engageAge.toFixed(0) + 's', true, 10000); target = null;
        }
        else if (!target.engageAt && acquireAge > CFG.maxEngageSec && !isTargetStillEngaged) {
          abandonTarget('ไม่ได้ตี ' + acquireAge.toFixed(0) + 's', true, 10000); target = null;
        }
        // ★ pending ≥ attackPendingMax abandon ถ้า server ไม่ตอบนานเกินไป — แต่ถ้ามอนยัง aggro เรา ข้าม (ยังสู้อยู่)
        else if (target.pendingAttacks >= CFG.attackPendingMax && target.firstAttackAt && (now - target.firstAttackAt > CFG.attackAbandonMs) && !isTargetStillEngaged) {
          abandonTarget('pending ' + target.pendingAttacks + ' (server เงียบ)', true, 10000); target = null;
        }
      }
      // stuck warp escalation
      if (!target && CFG.stuckWarpOnAbandon > 0 && stuckAbandonCount >= CFG.stuckWarpOnAbandon) {
        log('🌀 stuck abandon', stuckAbandonCount, 'ครั้ง → วาร์ปสุ่ม');
        sendRandomWarp(); stuckAbandonCount = 0; stuckAbandonHistory = [];
      }
    }

    // === 3. Attack ===
    //   ★ server ทำ walk-and-attack เอง: ส่ง ATTACK ในระยะ maxAcquireDistance → server เดินตัวละครเข้าไปตี
    //     dist > maxAcquireDistance → บอทเดินเข้าไปเอง (MOVE) จนถึง ≤maxAcquireDistance แล้วค่อยส่ง ATTACK
    if (target) {
      const m = entities.get(target.id);
      if (m && player.x != null) {
        const dist = Math.hypot(m.x - player.x, m.y - player.y);
        // ในระยะ acquire → ส่ง ATTACK ตรงๆ (server เดินเข้าไปตีเอง)
        if (dist <= CFG.maxAcquireDistance) {
          // (ลบ fallback เดินเข้า — server walk-and-attack ทำงานจริง แค่ reset ไม่ทำงานชั่วคราว)
          // ★ ถ้า pending สูง + server เงียบนาน + เปิด warpToMonster → วาร์ปไปหามอน (แทน abandon)
          if (CFG.warpToMonster && target.pendingAttacks >= 4 && target.firstAttackAt && (now - target.firstAttackAt > 8000)
              && (warpToMonsterCount.get(target.id) || 0) < CFG.warpToMonsterMaxPerEntity
              && now - (target._lastWarpAt || 0) > CFG.warpToMonsterCooldownMs) {
            const wc = warpToMonsterCount.get(target.id) || 0;
            if (sendTeleport(currentMap, m.x, m.y)) {
              target._lastWarpAt = now; warpToMonsterCount.set(target.id, wc + 1);
              target.pendingAttacks = 0; target.firstAttackAt = 0;   // reset หลังวาร์ป
              log('🌀 วาร์ปไปหา', m.name || target.id.toString(16), '@(', m.x, m.y + ')', '(pending สูง warp', wc + 1 + ')');
            }
            return;
          }
          if (now - target.lastAttackAt > CFG.attackReIssueMs || target.lastAttackAt === 0) {
            if (sendAttack(target.id)) {
              target.lastAttackAt = now; target.pendingAttacks++;
              if (!target.firstAttackAt) { target.firstAttackAt = now; }   // ★ จดเวลาส่งครั้งแรก
              if (!target.engageAt) { target.engageAt = now; }
              log('⚔️ ตี', m.name || m.id.toString(16), target.id.toString(16), '@ dist', dist.toFixed(1), '(pending', target.pendingAttacks + ')');
            }
          }
          return;
        }
        // ★ dist > maxChaseDistance → abandon ทันที (มอนไกลเกินไป ไม่สมควรไล่ตาม)
        if (dist > CFG.maxChaseDistance) {
          log('📏 abandon: มอนไกล', dist.toFixed(0), 'ช่อง (เกิน maxChase ' + CFG.maxChaseDistance + ')');
          abandonTarget('ไกลเกิน ' + CFG.maxChaseDistance, false, 10000);
          target = null;
          return;
        }
        // dist > maxAcquireDistance → เดินเข้าไปเองจนถึงระยะ acquire
        //   สั่งเดินทีละ walkStepDistance ช่อง (≤20) ถ้าติดกำแพงนาน → warpToMonster/abandon
        const stuck = walkToTarget(now, m);
        if (stuck === 'STUCK') {
          if (CFG.warpToMonster && (warpToMonsterCount.get(target.id) || 0) < CFG.warpToMonsterMaxPerEntity) {
            const wc = warpToMonsterCount.get(target.id) || 0;
            if (now - (target._lastWarpAt || 0) > CFG.warpToMonsterCooldownMs) {
              if (sendTeleport(currentMap, m.x, m.y)) {
                target._lastWarpAt = now; warpToMonsterCount.set(target.id, wc + 1);
                log('🌀 วาร์ปไปหา', m.name || target.id.toString(16), '@(', m.x, m.y + ')', '(warp', wc + 1 + ')');
              }
              return;
            }
          }
          // ไม่เปิด warpToMonster หรือ warp ครบแล้ว → abandon + cooldown กันเลือกตัวเดิม
          abandonTarget('ติดกำแพง (stuck)', true, 15000);
          target = null;
        }
        return;
      }
    }

    // === 4. Acquire new target ===
    if (!target) {
      const t = acquireTarget(now);
      if (t) { target = t; noMonsterSince = 0; return; }
      // ไม่เจอมอน
      if (!noMonsterSince) noMonsterSince = now;
      const noMonSec = (now - noMonsterSince) / 1000;
      // warp-find — มี cooldown กัน spam (วาร์ป fail ก็ต้องรอ ไม่ยิงทุก tick)
      if (CFG.warpFindEnabled && noMonSec >= CFG.noMonsterWarpSec && now - lastWarpFindAt > 3000) {
        lastWarpFindAt = now;
        if (currentMap) {
          log('🌀 ไม่เจอมอน', noMonSec.toFixed(0) + 's → วาร์ปสุ่ม');
          if (sendRandomWarp()) noMonsterSince = now;   // สำเร็จ → reset (เริ่มนับใหม่ในแมปใหม่)
          // fail → ไม่ reset noMonsterSince แต่ lastWarpFindAt คุม cooldown แล้ว ไม่ spam
        } else {
          log('⚠️ warpFind: ยังไม่รู้ชื่อแมป — รอ SELECT_CHAR/MAP_NAME');
        }
        return;
      }
      // wander — สุ่มเดิน ≤ walkStepDistance ช่องจากตำแหน่งปัจจุบัน
      if (CFG.wanderEnabled && now - lastWanderAt > CFG.wanderCooldownMs && player.x != null) {
        lastWanderAt = now;
        const angle = Math.random() * Math.PI * 2;
        const step = 3 + Math.random() * Math.min(CFG.wanderMaxStep, CFG.walkStepDistance) - 3;
        const tx = player.x + Math.cos(angle) * step;
        const ty = player.y + Math.sin(angle) * step;
        if (sendMove(tx, ty)) log('🚶 สุ่มเดิน @(', Math.round(tx), Math.round(ty) + ') | จาก player(', player.x.toFixed(0), player.y.toFixed(0) + ') step=' + Math.round(step));
      }
    }
  }, CFG.combatTickMs);

  // ---------- patch WebSocket ----------
  function attach(ws) {
    if (ws.__loot) return; ws.__loot = true;
    activeWS = ws; log('🔌 ต่อ WebSocket แล้ว');
    const origSend = ws.send.bind(ws);
    ws.send = function (data) {
      try { const u = syncU8(data); if (u) handleOut(u); } catch (e) {}
      return origSend(data);
    };
    ws.addEventListener('message', async (e) => {
      try { const u = await toU8(e.data); if (u) handleIn(u); } catch (err) {}
    });
  }
  const NativeWS = window.WebSocket;
  window.WebSocket = function (...a) { const ws = new NativeWS(...a); attach(ws); return ws; };
  window.WebSocket.prototype = NativeWS.prototype;
  ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(k => window.WebSocket[k] = NativeWS[k]);

  // ============================================================
  //  API ควบคุมจาก console — พิมพ์ ASSIST.<method>()
  // ============================================================
  window.ASSIST = {
    // ---------- สถานะ ----------
    status() {
      const pct = hpPct();
      console.table([{
        version: VERSION + (latestVersion && cmpVer(latestVersion, VERSION) > 0 ? ` → ${latestVersion} ⬆` : ''),
        loot: CFG.lootEnabled ? 'ON' : 'off',
        heal: CFG.healEnabled ? 'ON' : 'off',
        dead: isDead ? '☠️ YES' : 'no',
        HP: hp.cur != null ? `${hp.cur}/${hp.max} (${pct != null ? pct.toFixed(0) : '?'}%)` : '?',
        healAt: CFG.healAtPercent + '%',
        healItems: CFG.healItems.map(nameOf).join(', '),
        healMode: CFG.healMode,
        lootMode: CFG.filter.mode,
        lootQueue: queue.size,
        player_id: playerId ? playerId.toString(16) : '?',
      }]);
      const now = Date.now();
      const healStatus = CFG.healItems.map(id => ({
        id,
        name: nameOf(id),
        available: heal.isAvailable(id, now),
        retryInMs: heal.isAvailable(id, now) ? 0 : (heal.exhaustedUntil.get(id) - now),
      }));
      return {
        hp: { ...hp }, hpPct: pct, isDead,
        heal: { enabled: CFG.healEnabled, mode: CFG.healMode, threshold: CFG.healAtPercent + '%', items: healStatus },
        loot: { ...CFG.filter, queue: [...queue.values()].map(it => ({ item: nameOf(it.itemId), ...it })) },
      };
    },
    help() {
      console.log(`%c ASSIST — คำสั่ง `, 'background:#4caf50;color:#fff;padding:2px 6px;border-radius:3px');
      console.log(`%c Auto-Heal `, 'color:#e91e63;font-weight:bold');
      console.log('  ASSIST.healOn() / ASSIST.healOff()');
      console.log('  ASSIST.setHealAt(50)              // เลือดต่ำกว่า 50% → ใช้ยา');
      console.log('  ASSIST.setHealItems(501,502,503)  // เซ็ตรายการ item id');
      console.log('  ASSIST.addHealItem(503)           // เพิ่ม item');
      console.log('  ASSIST.setHealMode("order")       // "order"=ใช้ตัวเดิมจนหมดแล้วข้าม, "random"=สุ่ม');
      console.log('  ASSIST.setHealDelay(800)          // ดีเลย์ ms');
      console.log('  ASSIST.setHealExhausted(3000)     // item หมด→รอ N ms แล้วลองใหม่ (default 3000)');
      console.log('  ASSIST.clearHealExhausted()       // บังคับลองใช้ item ทุกตัวใหม่ (ล้าง mark หมด)');
      console.log('  ASSIST.setHealToFull(true)        // true=ใช้ยาจนเต็ม, false=พ้น threshold หยุด');
      console.log(`%c Auto-Loot `, 'color:#2196f3;font-weight:bold');
      console.log('  ASSIST.lootOn() / ASSIST.lootOff()');
      console.log('  ASSIST.setLootMode("all")         // "all" | "only" | "except"');
      console.log('  ASSIST.addLootOnly(909,512)       ASSIST.addLootExcept(909)');
      console.log('  ASSIST.clearLootOnly()            ASSIST.clearLootExcept()');
      console.log('  ASSIST.setLootDelay(500)         // รอ 500ms หลังของตกแล้วค่อยเก็บ (0=ทันที)');
      console.log(`%c อื่นๆ `, 'color:#9c27b0;font-weight:bold');
      console.log('  ASSIST.name(935,"Feather")        // ตั้งชื่อ item');
      console.log('  ASSIST.status()  ASSIST.config()  ASSIST.stopAll()');
    },

    // ---------- Auto-Heal ----------
    healOn() {
      if (!CFG.healItems.length) {
        console.warn('⚠️ ยังไม่มี item heal — ตั้งก่อนด้วย ASSIST.setHealItems(...) ไม่งั้นจะไม่ทำงาน');
      }
      CFG.healEnabled = true; log('💉 Auto-Heal: ON');
    },
    healOff() { CFG.healEnabled = false; log('💉 Auto-Heal: OFF'); },
    setHealAt(pct) {
      if (typeof pct !== 'number' || pct < 1 || pct > 100) { console.warn('ต้องเป็นเลข 1-100'); return; }
      CFG.healAtPercent = pct;
      log('💉 threshold =', pct + '%');
    },
    setHealItems(...ids) {
      CFG.healItems = ids.filter(x => typeof x === 'number');
      heal.clearExhausted();
      // ★ ตั้ง item = เจตนาเปิดใช้ → เปิด auto-heal ให้อัตโนมัติ (default ปิดอยู่)
      CFG.healEnabled = true;
      log('💉 healItems =', CFG.healItems.map(nameOf).join(', '), '→ auto-heal ON');
    },
    addHealItem(...ids) {
      for (const id of ids) if (!CFG.healItems.includes(id)) CFG.healItems.push(id);
      log('💉 healItems =', CFG.healItems.map(nameOf).join(', '));
    },
    setHealMode(mode) {
      if (!['order', 'random'].includes(mode)) { console.warn('โหมดต้องเป็น order/random'); return; }
      CFG.healMode = mode; log('💉 healMode =', mode);
    },
    setHealDelay(ms) {
      if (typeof ms !== 'number' || ms < 0) { console.warn('ต้องเป็นเลข ≥ 0'); return; }
      CFG.healDelayMs = ms; log('💉 delay =', ms + 'ms');
    },
    // ตั้งระยะเวลาที่ item ที่ "หมด" จะรอก่อนลองใหม่ (ms) — default 3000
    setHealExhausted(ms) {
      if (typeof ms !== 'number' || ms < 0) { console.warn('ต้องเป็นเลข ≥ 0'); return; }
      CFG.healExhaustedMs = ms; log('💉 item หมด → รอ', ms + 'ms แล้วลองใหม่');
    },
    // ล้าง mark "หมด" ทั้งหมดทันที (บังคับลองใช้ item ทุกตัวอีกครั้ง)
    clearHealExhausted() {
      heal.clearExhausted();
      log('💉 ล้าง mark "หมด" ทั้งหมด → ลองใช้ item ทุกตัวใหม่');
    },
    setHealToFull(on) { CFG.healAtMax = !!on; log('💉 ใช้ยาจนเต็ม =', CFG.healAtMax); },

    // ---------- Auto-Rest ----------
    restOn()  { CFG.restEnabled = true;  log('🪑 Auto-Rest: ON (HP < ' + CFG.restHpPercent + '% → นั่งพัก)'); },
    restOff() { CFG.restEnabled = false; if (isResting) { sendStand(); isResting = false; } log('🪑 Auto-Rest: OFF'); },
    setRestHp(pct) { CFG.restHpPercent = pct; log('🪑 นั่งพักตอน HP <', pct + '%'); },
    setRestUntil(pct) { CFG.restUntilPercent = pct; log('🪑 ลุกยืนตอน HP ≥', pct + '%'); },
    setRestMaxSec(sec) { CFG.restMaxSec = sec; log('🪑 นั่งนานสุด', sec + 's'); },
    isResting() { return isResting; },

    // ---------- Auto-Loot ----------
    lootOn()  { CFG.lootEnabled = true;  log('📦 Auto-Loot: ON'); },
    lootOff() { CFG.lootEnabled = false; log('📦 Auto-Loot: OFF'); },
    setLootMode(mode) {
      if (!['all', 'only', 'except'].includes(mode)) { console.warn('โหมดต้องเป็น all/only/except'); return; }
      CFG.filter.mode = mode; log('📦 loot mode =', mode);
    },
    // ---------- Warp-to-Loot (ฟีเจอร์รุนแรง) ----------
    warpLootOn() {
      CFG.warpLootEnabled = true;
      if (!currentMap) console.warn('⚠️ ยังไม่รู้ชื่อแมป — warp จะทำงานหลังเข้าแมป');
      log('🌀 Warp-to-Loot: ON (เก็บไม่ได้ครบ', CFG.maxAttempts, 'ครั้ง → วาร์ปไปเก็บ)');
    },
    warpLootOff() {
      CFG.warpLootEnabled = false;
      warpQueue.clear();
      log('🌀 Warp-to-Loot: OFF');
    },
    warpLootQueue() {
      return [...warpQueue.values()].map(w => ({ item: nameOf(w.itemId), x: w.x, y: w.y, offsetIdx: w.offsetIdx }));
    },
    addLootOnly(...ids) {
      for (const id of ids) if (!CFG.filter.onlyItems.includes(id)) CFG.filter.onlyItems.push(id);
      log('📦 onlyItems =', CFG.filter.onlyItems);
    },
    addLootExcept(...ids) {
      for (const id of ids) if (!CFG.filter.exceptItems.includes(id)) CFG.filter.exceptItems.push(id);
      log('📦 exceptItems =', CFG.filter.exceptItems);
    },
    clearLootOnly()   { CFG.filter.onlyItems = [];   log('📦 ล้าง onlyItems'); },
    clearLootExcept() { CFG.filter.exceptItems = []; log('📦 ล้าง exceptItems'); },
    // ตั้งดีเลย์ก่อนเริ่มเก็บ (ms หลังของตก) — 0 = เก็บทันที
    setLootDelay(ms) {
      if (typeof ms !== 'number' || ms < 0) { console.warn('ต้องเป็นเลข ≥ 0'); return; }
      CFG.lootDelayAfterDropMs = ms;
      log('📦 ดีเลย์ก่อนเก็บ =', ms + 'ms' + (ms ? ' (รอหลังของตก)' : ' (เก็บทันที)'));
    },

    // ---------- Auto-Combat ----------
    combatOn() {
      CFG.combatEnabled = true;
      if (!CFG.targetWhitelist.length && !CFG.targetBlacklist.length) console.warn('⚠️ whitelist + blacklist ว่าง = ตีทุกมอน (รวม MVP/มอนแรง) — ควรตั้ง whitelist หรือ blacklist กันตาย');
      log('⚔️ Auto-Combat: ON');
    },
    combatOff() { CFG.combatEnabled = false; target = null; log('⚔️ Auto-Combat: OFF'); },
    setTargetWhitelist(...namesOrIds) {
      CFG.targetWhitelist = namesOrIds;
      log('⚔️ whitelist =', namesOrIds.join(', ') || '(ว่าง = ตีทุกมอน)');
    },
    addTargetWhitelist(...x) { for (const e of x) if (!CFG.targetWhitelist.includes(e)) CFG.targetWhitelist.push(e); log('⚔️ whitelist =', CFG.targetWhitelist.join(', ')); },
    clearTargetWhitelist() { CFG.targetWhitelist = []; log('⚔️ ล้าง whitelist = ตีทุกมอน'); },
    setTargetBlacklist(...namesOrIds) { CFG.targetBlacklist = namesOrIds; log('⚔️ blacklist =', namesOrIds.join(', ')); },
    addTargetBlacklist(...x) { for (const e of x) if (!CFG.targetBlacklist.includes(e)) CFG.targetBlacklist.push(e); log('⚔️ blacklist =', CFG.targetBlacklist.join(', ')); },
    clearTargetBlacklist() { CFG.targetBlacklist = []; log('⚔️ ล้าง blacklist'); },
    setFleeMob(n) { CFG.fleeOnMobCount = n; log('🏃 flee รุม', n, 'ตัว' + (n ? '' : ' (off)')); },
    setFleeAggro(n) { CFG.fleeOnAggroCount = n; log('🏃 flee aggro', n, 'ตัว' + (n ? '' : ' (off)')); },
    setFleeProximity(n, radius) { CFG.fleeOnProximityCount = n; if (radius != null) CFG.fleeOnProximityRadius = radius; log('🏃 flee มอนรอบ', n, 'ตัวในระยะ', CFG.fleeOnProximityRadius); },
    setRanged(range) { CFG.rangedAttackRange = range; log('🏹 ranged range =', range, range ? '' : '(ใช้ attackRange)'); },
    setAttackRange(r) { CFG.attackRange = r; log('⚔️ attackRange =', r); },
    // ★ ปรับ re-issue/abandon timing (pending spam)
    setAttackReissue(ms) { CFG.attackReIssueMs = ms; log('⚔️ re-issue attack ทุก', ms + 'ms'); },
    setAttackAbandon(ms) { CFG.attackAbandonMs = ms; log('⚔️ abandon ถ้า server เงียบ', ms + 'ms'); },
    setPostCombatDelay(ms) { CFG.postCombatDelayMs = ms; log('⚔️ รอ', ms + 'ms หลังสู้เสร็จ/เก็บของเสร็จ'); },
    // toggle helpers สำหรับ UI
    toggleAntiKS(on) { CFG.antiKS = !!on; log('⚔️ antiKS =', CFG.antiKS); },
    toggleAvoidPlayers(on) { CFG.avoidOtherPlayers = !!on; log('⚔️ avoidOtherPlayers =', CFG.avoidOtherPlayers); },
    toggleLowestHpFirst(on) { CFG.targetLowestHpFirst = !!on; log('⚔️ targetLowestHpFirst =', CFG.targetLowestHpFirst); },
    toggleWander(on) { CFG.wanderEnabled = !!on; log('⚔️ wander =', CFG.wanderEnabled); },
    toggleWarpFind(on) { CFG.warpFindEnabled = !!on; log('⚔️ warpFind =', CFG.warpFindEnabled); },
    toggleWarpToMonster(on) { CFG.warpToMonster = !!on; log('⚔️ warpToMonster =', CFG.warpToMonster); },
    // debug
    getEntities() {
      const now = nowMs();
      return [...entities.values()].filter(e => e.kind === 1 && e.alive).slice(0, 30).map(e => ({
        id: e.id.toString(16), name: e.name || '?', sub: e.sub, x: e.x, y: e.y,
        hp: e.hp != null && e.hpMax ? (e.hp + '/' + e.hpMax + ' ' + monsterHpPct(e).toFixed(0) + '%') : '?',
        engaged: e._lastEngagedByOtherAt && (now - e._lastEngagedByOtherAt) < 5000,
      }));
    },
    getTarget() { return target ? { id: target.id.toString(16), pending: target.pendingAttacks, engageSec: target.engageAt ? ((nowMs()-target.engageAt)/1000).toFixed(0) : 0 } : null; },
    getAggro() { return { mobAttackers: getMobAttackerCount(CFG.fleeOnProximityRadius), aggro: getAggroCount(CFG.fleeOnProximityRadius), threat: getThreatCount(CFG.fleeOnProximityRadius), monstersNearby: countMonsters(CFG.fleeOnProximityRadius) }; },
    // ★ debug: ดู entities ทั้งหมดเพื่อหาสาเหตุ acquire ไม่ติด
    debugEntities() {
      const now = nowMs();
      let spawnCount = 0, ghostCount = 0, monsterCount = 0, targetableCount = 0;
      const sample = [];
      for (const e of entities.values()) {
        if (e.sub != null) spawnCount++; else ghostCount++;
        if (e.kind === 1 && e.alive) {
          monsterCount++;
          if (sample.length < 8) sample.push({ id: e.id.toString(16), name: e.name, sub: e.sub, x: e.x, y: e.y, hp: e.hp, hpMax: e.hpMax, targetable: isTargetable(e, now) });
          if (isTargetable(e, now)) targetableCount++;
        }
      }
      console.log('entities total:', entities.size, '| fromSPAWN:', spawnCount, '| ghost:', ghostCount, '| monsters:', monsterCount, '| targetable:', targetableCount);
      // ★ debug playerId vs entity: ดูว่า player entity มีพิกัดตรงกับ player.x/y ไหม
      const playerEntity = playerId ? entities.get(playerId) : null;
      console.log('playerId:', playerId ? playerId.toString(16) : 'NULL', '| player.x/y:', player.x, player.y,
        '| playerEntity:', playerEntity ? `{x:${playerEntity.x}, y:${playerEntity.y}, kind:${playerEntity.kind}, name:${playerEntity.name}}` : 'NOT IN ENTITIES');
      // ★ debug target ปัจจุบัน (แม้อยู่นอก 8 ตัวแรก)
      if (target) {
        const tm = entities.get(target.id);
        console.log('TARGET:', target.id.toString(16), '| pending:', target.pendingAttacks, '| firstAttackAt:', target.firstAttackAt ? ((now-target.firstAttackAt)/1000).toFixed(1)+'s' : 'none',
          '| inEntities:', !!tm, tm ? `{name:${tm.name}, hp:${tm.hp}/${tm.hpMax}, _lastDamageAt:${tm._lastDamageAt ? ((now-tm._lastDamageAt)/1000).toFixed(1)+'s ago' : 'NEVER'}}` : '');
      }
      console.table(sample);
      return { total: entities.size, spawnCount, ghostCount, monsterCount, targetableCount, sample, player: { ...player }, playerId: playerId ? playerId.toString(16) : null };
    },

    // ---------- ทั่วไป ----------
    name(id, label) { CFG.itemNames[id] = label; log('🏷️', id, '=', label); },
    config() { return CFG; },
    // ---------- สถิติ + log (สำหรับ panel) ----------
    getStats() {
      const elapsed = Math.max(1, Date.now() - stats.startTime);
      const elapsedMin = elapsed / 60000;
      return {
        ...stats,
        itemsByCount: [...stats.itemsByCount.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([id, n]) => ({ id, name: nameOf(id), count: n })),
        elapsedMs: elapsed,
        expPerMin: elapsedMin > 0 ? Math.round(stats.expGained / elapsedMin) : 0,
        killsPerMin: elapsedMin > 0 ? +(stats.kills / elapsedMin).toFixed(1) : 0,
      };
    },
    resetStats() { resetStats(); log('📊 รีเซ็ตสถิติแล้ว'); },
    getLogs() { return logBuf.slice(); },
    clearLogs() { logBuf.length = 0; log('🧹 ล้าง log'); },
    stopAll() {
      clearInterval(healLoop); clearInterval(lootLoop); clearInterval(warpLoop); clearInterval(combatLoop);
      if (typeof uiLoop !== 'undefined') clearInterval(uiLoop);
      log('⏹ หยุดระบบทั้งหมดแล้ว');
    },
    // ---------- version + update ----------
    version() { return { current: VERSION, latest: latestVersion, updateAvailable: latestVersion ? cmpVer(latestVersion, VERSION) > 0 : false }; },
    checkVersion() { return checkVersion(); },
    update() { return doUpdate(); },
    saveConfig() { saveConfig(); log('💾 บันทึกการตั้งค่าลงเครื่องแล้ว'); },
  };

  // ============================================================
  //  UI — mini-bar + popup panel (ฝังในหน้าเกม)
  // ============================================================
  let uiLoop;          // render interval (clear ใน stopAll)
  function buildUI() {
    if (document.getElementById('__assist_root')) return;   // สร้างแล้ว

    // ---------- CSS ----------
    const css = `
      #__assist_root, #__assist_root * { box-sizing: border-box; margin: 0; padding: 0; }
      #__assist_root {
        position: fixed; top: 10px; right: 10px; z-index: 2147483647;
        font-family: 'Segoe UI', system-ui, sans-serif; font-size: 12px;
        color: #e8e8e8; user-select: none;
      }
      /* mini-bar */
      #__assist_bar {
        background: rgba(20,22,28,.92); border: 1px solid #3a3f4b; border-radius: 8px;
        padding: 6px 10px; display: flex; align-items: center; gap: 10px;
        cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.4); transition: opacity .15s;
        max-width: 360px;
      }
      #__assist_bar:hover { opacity: .85; }
      #__assist_bar .hpbar { width: 80px; height: 8px; background: #2a2d35; border-radius: 4px; overflow: hidden; }
      #__assist_bar .hpfill { height: 100%; background: linear-gradient(90deg,#e53935,#ef5350); transition: width .3s; }
      #__assist_bar .hpfill.warn { background: linear-gradient(90deg,#fb8c00,#ffa726); }
      #__assist_bar .hpfill.good { background: linear-gradient(90deg,#43a047,#66bb6a); }
      #__assist_bar .pill { font-size: 10px; padding: 1px 6px; border-radius: 8px; font-weight: 600; }
      #__assist_bar .pill.on  { background: #1b5e20; color: #a5d6a7; }
      #__assist_bar .pill.off { background: #4a2020; color: #ef9a9a; }
      #__assist_bar .expand { color: #8ab4f8; font-weight: 700; }
      /* popup */
      #__assist_popup {
        display: none; margin-top: 6px; width: 340px; max-height: 70vh;
        background: rgba(20,22,28,.97); border: 1px solid #3a3f4b; border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0,0,0,.6); overflow: hidden; flex-direction: column;
      }
      #__assist_popup.open { display: flex; }
      #__assist_tabs { display: flex; background: #15171c; border-bottom: 1px solid #3a3f4b; }
      #__assist_tabs .tab {
        flex: 1; padding: 8px 4px; text-align: center; cursor: pointer; font-size: 11px;
        color: #9aa0a6; border-bottom: 2px solid transparent;
      }
      #__assist_tabs .tab:hover { background: rgba(255,255,255,.04); }
      #__assist_tabs .tab.active { color: #8ab4f8; border-bottom-color: #8ab4f8; }
      .__assist_page { display: none; padding: 10px; overflow-y: auto; }
      .__assist_page.active { display: block; }
      .__assist_page .row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,.05); }
      .__assist_page .row .k { color: #9aa0a6; }
      .__assist_page .row .v { color: #e8e8e8; font-weight: 600; }
      .__assist_page h4 { margin: 8px 0 4px; color: #8ab4f8; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
      .__assist_page .field { margin: 6px 0; }
      .__assist_page .field label { display: block; color: #9aa0a6; font-size: 10px; margin-bottom: 2px; }
      .__assist_page .field input, .__assist_page .field select {
        width: 100%; background: #15171c; border: 1px solid #3a3f4b; border-radius: 5px;
        color: #e8e8e8; padding: 5px 7px; font-size: 12px; font-family: inherit;
      }
      .__assist_page .field input:focus, .__assist_page .field select:focus { outline: none; border-color: #8ab4f8; }
      .__assist_page .btns { display: flex; gap: 6px; margin-top: 8px; }
      .__assist_page button {
        flex: 1; background: #2a3441; border: 1px solid #3a3f4b; border-radius: 5px;
        color: #e8e8e8; padding: 6px; cursor: pointer; font-size: 11px; font-family: inherit;
      }
      .__assist_page button:hover { background: #34465a; }
      .__assist_page button.on  { background: #1b5e20; border-color: #2e7d32; }
      .__assist_page button.off { background: #4a2020; border-color: #6a3030; }
      .__assist_page button.danger { background: #4a2020; }
      .__assist_page .logbox {
        background: #0f1115; border: 1px solid #2a2d35; border-radius: 5px; padding: 6px;
        height: 240px; overflow-y: auto; font-family: 'Consolas', monospace; font-size: 10.5px; line-height: 1.5;
      }
      .__assist_page .logline { color: #b0b0b0; padding: 1px 0; border-bottom: 1px solid rgba(255,255,255,.03); white-space: pre-wrap; word-break: break-word; }
      .__assist_page .logline .ts { color: #5f6368; }
      .__assist_dead { animation: __assist_blink 1s infinite; }
      @keyframes __assist_blink { 50% { opacity: .4; } }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // ---------- DOM ----------
    const root = document.createElement('div');
    root.id = '__assist_root';
    root.innerHTML = `
      <div id="__assist_bar">
        <span class="hptext">HP ?</span>
        <div class="hpbar"><div class="hpfill" style="width:0%"></div></div>
        <span class="pill off" data-loot>Loot</span>
        <span class="pill off" data-heal>Heal</span>
        <span class="pill off" data-rest>Rest</span>
        <span class="pill off" data-combat>Combat</span>
        <span class="expand">⚙</span>
      </div>
      <div id="__assist_popup">
        <div id="__assist_tabs">
          <div class="tab active" data-page="stats">📊 สถิติ</div>
          <div class="tab" data-page="config">⚙️ ตั้งค่า</div>
          <div class="tab" data-page="log">📋 Log</div>
        </div>
        <div class="__assist_page active" data-page="stats">
          <div class="row" style="border-bottom:2px solid #3a3f4b;">
            <span class="k">RO Assist</span>
            <span class="v" data-version>v?</span>
            <button id="__assist_updatebtn" style="display:none;background:#e67e22;color:#fff;border:none;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer;font-family:inherit;margin-left:6px;">⬆ อัปเดต</button>
          </div>
          <div class="row"><span class="k">HP</span><span class="v" data-hp>?</span></div>
          <div class="row"><span class="k">ตำแหน่ง</span><span class="v" data-pos>?</span></div>
          <div class="row"><span class="k">player_id</span><span class="v" data-pid>?</span></div>
          <div class="row"><span class="k">สถานะ</span><span class="v" data-state>?</span></div>
          <h4>การฟาร์ม</h4>
          <div class="row"><span class="k">ฆ่าได้</span><span class="v" data-kills>0</span></div>
          <div class="row"><span class="k">เก็บของได้</span><span class="v" data-looted>0</span></div>
          <div class="row"><span class="k">💰 ยอด zeny (session)</span><span class="v" data-zeny style="color:#f1c40f">0z</span></div>
          <div class="row"><span class="k">EXP รวม</span><span class="v" data-exp>0</span></div>
          <div class="row"><span class="k">EXP/นาที</span><span class="v" data-expmin>0</span></div>
          <div class="row"><span class="k">เวลาทำงาน</span><span class="v" data-elapsed>0s</span></div>
          <div class="row"><span class="k">ตาย</span><span class="v" data-deaths>0</span></div>
          <h4>Combat</h4>
          <div class="row"><span class="k">เป้าหมาย</span><span class="v" data-combat-target>(none)</span></div>
          <div class="row"><span class="k">มอน (ตี/aggro/รอบ)</span><span class="v" data-combat-aggro>0 / 0 / 0</span></div>
          <h4>ของที่เก็บได้ (ล่าสุด)</h4>
          <div data-items style="font-size:11px;color:#9aa0a6">(ยังไม่มี)</div>
          <div class="btns"><button class="danger" id="__assist_resetstats">รีเซ็ตสถิติ</button></div>
        </div>
        <div class="__assist_page" data-page="config">
          <div class="btns">
            <button id="__assist_lootbtn" class="on">Loot: ?</button>
            <button id="__assist_healbtn" class="off">Heal: ?</button>
          </div>
          <div class="field"><label>HP% เริ่มใช้ยา (healAt)</label><input type="number" id="__assist_healat" min="1" max="100"></div>
          <div class="field"><label>item id ที่จะใช้ heal (คั่นด้วยจุลภาค)</label><input type="text" id="__assist_healitems" placeholder="เช่น 501,502,503"></div>
          <div class="btns"><button id="__assist_applyheal">ใช้ค่า heal</button></div>
          <div class="field"><label>โหมด heal</label><select id="__assist_healmode"><option value="order">order (ใช้ตัวเดิมจนหมด)</option><option value="random">random (สุ่ม)</option></select></div>
          <div class="field"><label>โหมด loot</label><select id="__assist_lootmode"><option value="all">all (เก็บหมด)</option><option value="only">only (เก็บเฉพาะ)</option><option value="except">except (ยกเว้น)</option></select></div>
          <div class="field"><label>item id ที่จะเก็บเท่านั้น / ยกเว้น (คั่นจุลภาค)</label><input type="text" id="__assist_lootfilter" placeholder="เช่น 909,512"></div>
          <div class="btns">
            <button id="__assist_applylootonly">ตั้ง only</button>
            <button id="__assist_applylootexcept">ตั้ง except</button>
            <button id="__assist_clearfilter">ล้าง</button>
          </div>
          <div class="field"><label>ดีเลย์ก่อนเก็บ (ms หลังของตก) — 0 = เก็บทันที</label><input type="number" id="__assist_lootdelay" min="0" step="100"></div>
          <div class="btns"><button id="__assist_applylootdelay">ตั้งดีเลย์</button></div>

          <h4>🌀 Warp-to-Loot (วาร์ปไปเก็บของที่ติดกำแพง)</h4>
          <div class="btns"><button id="__assist_warpbtn" class="off">วาร์ปไปเก็บของ: ?</button></div>

          <h4>⚔️ Combat (ส่ง attack packet จริง)</h4>
          <div class="btns"><button id="__assist_combatbtn" class="off">Combat: ?</button></div>
          <div class="field"><label>มอนที่จะตี — whitelist (ชื่อหรือ sprite id, คั่นจุลภาค) — ว่าง = ตีทุกมอน</label><input type="text" id="__assist_whitelist" placeholder="เช่น Poring,Lunatic หรือ 4000,1010"></div>
          <div class="field"><label>มอนที่จะไม่ตี — blacklist</label><input type="text" id="__assist_blacklist" placeholder="เช่น MVP,Boss"></div>
          <div class="btns"><button id="__assist_applywhitelist">ตั้ง whitelist</button><button id="__assist_applyblacklist">ตั้ง blacklist</button></div>
          <div class="field"><label>ระยะโจมตี (ช่อง) — นักธนูตั้ง >2 เพื่อตีไกล</label><input type="number" id="__assist_attackrange" min="0" max="15"></div>
          <div class="field"><label>flee: รุม N ตัว (0=off)</label><input type="number" id="__assist_fleemob" min="0" max="20"></div>
          <div class="field"><label>flee: aggro N ตัว (0=off)</label><input type="number" id="__assist_fleeaggro" min="0" max="20"></div>
          <div class="field"><label>flee: มอนรอบ N ตัว ในระยะ (0=off)</label><input type="number" id="__assist_fleeprox" min="0" max="20"></div>
          <div class="btns">
            <button id="__assist_t_antiks" class="on">antiKS</button>
            <button id="__assist_t_avoidp" class="on">avoidPlayers</button>
            <button id="__assist_t_lowhp" class="on">lowestHP</button>
          </div>
          <div class="btns">
            <button id="__assist_t_wander" class="on">เดินหามอน</button>
            <button id="__assist_t_warpfind" class="off">วาร์ปหามอน</button>
            <button id="__assist_t_warptomon" class="off">วาร์ปไปหามอนที่ตี</button>
          </div>
          <div class="btns"><button id="__assist_applycombat">ใช้ค่า flee + range</button></div>

          <h4>🪑 Rest (นั่งพักฟื้น HP)</h4>
          <div class="btns"><button id="__assist_restbtn" class="off">Rest: ?</button></div>
          <div class="field"><label>HP% ที่จะนั่งพัก (ต่ำกว่านี้ → นั่ง)</label><input type="number" id="__assist_resthp" min="1" max="99"></div>
          <div class="field"><label>HP% ที่จะลุกยืน (ฟื้นถึงนี้ → ลุก)</label><input type="number" id="__assist_restuntil" min="1" max="100"></div>
          <div class="field"><label>นั่งนานสุด (วินาที) — กันค้าง</label><input type="number" id="__assist_restmaxsec" min="5" max="300"></div>
          <div class="btns"><button id="__assist_applyrest">ใช้ค่า rest</button></div>
        </div>
        <div class="__assist_page" data-page="log">
          <div class="logbox" id="__assist_logbox"></div>
          <div class="btns"><button id="__assist_clearlog">ล้าง log</button></div>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    // ---------- wire events ----------
    // ★★ Unity WebGL (Emscripten) ดัก keyboard ที่ window ใน capture phase เหมือนกัน
    //   + เรียก preventDefault ทำให้ input ไม่รับ key → พิมพ์ไม่ติด
    //   วิธีแก้: intercept keydown ใน capture phase (ดักก่อน Unity) ถ้ามี input ของเรา active
    //   → หยุด propagation + จัดการ input เอง (แทรก/ลบตัวอักษรตรงๆ)
    const ASSIST_INPUT_SEL = 'input, select, textarea';
    function isOurField(t) { return t && t.closest && root.contains(t) && t.matches && t.matches(ASSIST_INPUT_SEL); }
    function ourActiveInput() {
      const ae = document.activeElement;
      return (ae && isOurField(ae)) ? ae : null;
    }
    // ดัก keyboard events ใน capture phase — ถ้ามี input ของเรา active ให้หยุดทุกอย่าง + จัดการเอง
    window.addEventListener('keydown', (e) => {
      const inp = ourActiveInput();
      if (!inp) return;
      // หยุด Unity รับ key นี้
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      e.preventDefault();
      // จัดการ input เอง (Unity กลืน key หมด แม้ input focus)
      handleInputKey(inp, e);
    }, true);
    // ดัก paste ด้วย
    window.addEventListener('paste', (e) => {
      const inp = ourActiveInput();
      if (!inp) return;
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text');
      const s = inp.selectionStart, en = inp.selectionEnd;
      inp.value = inp.value.slice(0, s) + text + inp.value.slice(en);
      const pos = s + text.length;
      inp.selectionStart = inp.selectionEnd = pos;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }, true);
    // จัดการ key ให้ input เอง (เพราะ Unity กลืน keydown)
    function handleInputKey(inp, e) {
      const k = e.key;
      const s = inp.selectionStart, en = inp.selectionEnd;
      if (k === 'Backspace') {
        if (s === en && s > 0) { inp.value = inp.value.slice(0, s - 1) + inp.value.slice(en); inp.selectionStart = inp.selectionEnd = s - 1; }
        else if (s !== en) { inp.value = inp.value.slice(0, s) + inp.value.slice(en); inp.selectionStart = inp.selectionEnd = s; }
      } else if (k === 'Delete') {
        if (s === en && s < inp.value.length) { inp.value = inp.value.slice(0, s) + inp.value.slice(en + 1); inp.selectionStart = inp.selectionEnd = s; }
        else if (s !== en) { inp.value = inp.value.slice(0, s) + inp.value.slice(en); inp.selectionStart = inp.selectionEnd = s; }
      } else if (k === 'ArrowLeft') { inp.selectionStart = inp.selectionEnd = Math.max(0, s - 1); }
      else if (k === 'ArrowRight') { inp.selectionStart = inp.selectionEnd = Math.min(inp.value.length, s + 1); }
      else if (k === 'Home') { inp.selectionStart = inp.selectionEnd = 0; }
      else if (k === 'End') { inp.selectionStart = inp.selectionEnd = inp.value.length; }
      else if (k === 'Enter') { inp.blur(); }
      else if (k.length === 1) {   // ตัวอักษร 1 ตัว (รวมตัวเลข ภาษาอังกฤษ)
        inp.value = inp.value.slice(0, s) + k + inp.value.slice(en);
        inp.selectionStart = inp.selectionEnd = s + 1;
      }
      // อื่นๆ (Shift/Ctrl/Alt/Tab ฯลฯ) ไม่ต้องทำอะไร
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }
    // ★ คลิก input → focus ทันที (กัน Unity ขโมย)
    root.addEventListener('mousedown', (e) => {
      if (isOurField(e.target)) {
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        setTimeout(() => { try { e.target.focus(); e.target.select && e.target.select(); } catch (_) {} }, 0);
      }
    }, true);

    const bar = root.querySelector('#__assist_bar');
    const popup = root.querySelector('#__assist_popup');
    bar.addEventListener('click', (e) => {
      // กดที่ pill loot/heal ใน mini-bar = toggle ทันที (ไม่เปิด popup)
      const pill = e.target.closest('.pill');
      if (pill) {
        if (pill.hasAttribute('data-loot')) CFG.lootEnabled ? ASSIST.lootOff() : ASSIST.lootOn();
        if (pill.hasAttribute('data-heal')) CFG.healEnabled ? ASSIST.healOff() : ASSIST.healOn();
        if (pill.hasAttribute('data-rest')) CFG.restEnabled ? ASSIST.restOff() : ASSIST.restOn();
        if (pill.hasAttribute('data-combat')) {
          if (!CFG.combatEnabled && !confirm('เปิด Auto-Combat?\n\nส่ง packet โจมตีจริง — ตั้ง whitelist ก่อน (เช่น ASSIST.setTargetWhitelist("Poring"))\nใช้ในความรับผิดชอบของคุณ')) return;
          CFG.combatEnabled ? ASSIST.combatOff() : ASSIST.combatOn();
        }
        return;
      }
      popup.classList.toggle('open');
    });

    // tab switching
    root.querySelectorAll('#__assist_tabs .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const page = tab.getAttribute('data-page');
        root.querySelectorAll('#__assist_tabs .tab').forEach(t => t.classList.toggle('active', t === tab));
        root.querySelectorAll('.__assist_page').forEach(p => p.classList.toggle('active', p.getAttribute('data-page') === page));
      });
    });

    // config tab buttons
    root.querySelector('#__assist_lootbtn').addEventListener('click', () => CFG.lootEnabled ? ASSIST.lootOff() : ASSIST.lootOn());
    root.querySelector('#__assist_healbtn').addEventListener('click', () => CFG.healEnabled ? ASSIST.healOff() : ASSIST.healOn());
    root.querySelector('#__assist_warpbtn').addEventListener('click', () => {
      if (!CFG.warpLootEnabled && !confirm('เปิด Warp-to-Loot?\n\nส่ง packet วาร์ปจริง — เก็บไม่ได้ครบ ' + CFG.maxAttempts + ' ครั้งจะวาร์ปไปที่ไอเท็ม\nใช้ในความรับผิดชอบของคุณ')) return;
      CFG.warpLootEnabled ? ASSIST.warpLootOff() : ASSIST.warpLootOn();
    });

    root.querySelector('#__assist_applyheal').addEventListener('click', () => {
      const pct = parseInt(root.querySelector('#__assist_healat').value, 10);
      if (!isNaN(pct)) ASSIST.setHealAt(pct);
      const ids = root.querySelector('#__assist_healitems').value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      if (ids.length) ASSIST.setHealItems(...ids);
    });
    root.querySelector('#__assist_healmode').addEventListener('change', e => ASSIST.setHealMode(e.target.value));
    root.querySelector('#__assist_lootmode').addEventListener('change', e => ASSIST.setLootMode(e.target.value));
    root.querySelector('#__assist_applylootonly').addEventListener('click', () => {
      const ids = root.querySelector('#__assist_lootfilter').value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      ASSIST.clearLootOnly();
      if (ids.length) ASSIST.addLootOnly(...ids);
    });
    root.querySelector('#__assist_applylootexcept').addEventListener('click', () => {
      const ids = root.querySelector('#__assist_lootfilter').value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      ASSIST.clearLootExcept();
      if (ids.length) ASSIST.addLootExcept(...ids);
    });
    root.querySelector('#__assist_clearfilter').addEventListener('click', () => { ASSIST.clearLootOnly(); ASSIST.clearLootExcept(); });
    root.querySelector('#__assist_applylootdelay').addEventListener('click', () => {
      const ms = parseInt(root.querySelector('#__assist_lootdelay').value, 10);
      if (!isNaN(ms)) ASSIST.setLootDelay(ms);
    });

    // ---- combat wires ----
    const parseList = (sel) => root.querySelector(sel).value.split(',').map(s => {
      const t = s.trim(); if (!t) return null;
      const n = parseInt(t, 10); return isNaN(n) ? t : n;     // ตัวเลข → number, อื่น → ชื่อ
    }).filter(x => x !== null);
    root.querySelector('#__assist_combatbtn').addEventListener('click', () => {
      if (!CFG.combatEnabled && !confirm('เปิด Auto-Combat?\n\nส่ง packet โจมตีจริง — ตั้ง whitelist ก่อน\nใช้ในความรับผิดชอบของคุณ')) return;
      CFG.combatEnabled ? ASSIST.combatOff() : ASSIST.combatOn();
    });
    root.querySelector('#__assist_applywhitelist').addEventListener('click', () => ASSIST.setTargetWhitelist(...parseList('#__assist_whitelist')));
    root.querySelector('#__assist_applyblacklist').addEventListener('click', () => ASSIST.setTargetBlacklist(...parseList('#__assist_blacklist')));
    root.querySelector('#__assist_applycombat').addEventListener('click', () => {
      const r = parseInt(root.querySelector('#__assist_attackrange').value, 10);
      const fm = parseInt(root.querySelector('#__assist_fleemob').value, 10);
      const fa = parseInt(root.querySelector('#__assist_fleeaggro').value, 10);
      const fp = parseInt(root.querySelector('#__assist_fleeprox').value, 10);
      if (!isNaN(r)) { if (r > 2) ASSIST.setRanged(r); else ASSIST.setAttackRange(r || 2); }
      if (!isNaN(fm)) ASSIST.setFleeMob(fm);
      if (!isNaN(fa)) ASSIST.setFleeAggro(fa);
      if (!isNaN(fp)) ASSIST.setFleeProximity(fp);
    });
    // ---- rest wires ----
    root.querySelector('#__assist_restbtn').addEventListener('click', () => CFG.restEnabled ? ASSIST.restOff() : ASSIST.restOn());
    root.querySelector('#__assist_applyrest').addEventListener('click', () => {
      const hp = parseInt(root.querySelector('#__assist_resthp').value, 10);
      const until = parseInt(root.querySelector('#__assist_restuntil').value, 10);
      const sec = parseInt(root.querySelector('#__assist_restmaxsec').value, 10);
      if (!isNaN(hp)) ASSIST.setRestHp(hp);
      if (!isNaN(until)) ASSIST.setRestUntil(until);
      if (!isNaN(sec)) ASSIST.setRestMaxSec(sec);
    });
    const tBtn = (sel, fn, cfgKey) => root.querySelector(sel).addEventListener('click', () => { CFG[cfgKey] = !CFG[cfgKey]; fn(CFG[cfgKey]); });
    tBtn('#__assist_t_antiks', (v) => ASSIST.toggleAntiKS(v), 'antiKS');
    tBtn('#__assist_t_avoidp', (v) => ASSIST.toggleAvoidPlayers(v), 'avoidOtherPlayers');
    tBtn('#__assist_t_lowhp', (v) => ASSIST.toggleLowestHpFirst(v), 'targetLowestHpFirst');
    tBtn('#__assist_t_wander', (v) => ASSIST.toggleWander(v), 'wanderEnabled');
    tBtn('#__assist_t_warpfind', (v) => ASSIST.toggleWarpFind(v), 'warpFindEnabled');
    tBtn('#__assist_t_warptomon', (v) => ASSIST.toggleWarpToMonster(v), 'warpToMonster');

    root.querySelector('#__assist_resetstats').addEventListener('click', () => ASSIST.resetStats());
    root.querySelector('#__assist_clearlog').addEventListener('click', () => ASSIST.clearLogs());
    const updBtn = root.querySelector('#__assist_updatebtn');
    if (updBtn) updBtn.addEventListener('click', () => { if (confirm('อัปเดตเป็นเวอร์ชั่นล่าสุด?\n(หลังอัปเดตต้อง reconnect เกม ปิด-เปิดหน้า)')) ASSIST.update(); });

    log('🖥️ แสดง panel แล้ว (คลิกที่แถบมุมขวาบนเพื่อเปิด)');
  }

  // ---------- render loop ----------
  function fmtMs(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm ' + (s % 60) + 's';
    const h = Math.floor(m / 60);
    return h + 'h ' + (m % 60) + 'm';
  }
  function renderUI() {
    const root = document.getElementById('__assist_root');
    if (!root) return;
    const pct = hpPct();
    const pctNum = pct == null ? null : pct;
    const hpText = hp.cur != null ? `${hp.cur}/${hp.max} (${pctNum != null ? pctNum.toFixed(0) : '?'}%)` : 'HP ?';

    // mini-bar
    const hpEl = root.querySelector('.hptext');
    const fill = root.querySelector('.hpfill');
    // version + update button
    const verEl = root.querySelector('[data-version]');
    const updAvail = latestVersion && cmpVer(latestVersion, VERSION) > 0;
    if (verEl) verEl.textContent = 'v' + VERSION + (updAvail ? ' (มีใหม่ v' + latestVersion + ')' : '');
    const updBtn = root.querySelector('#__assist_updatebtn');
    if (updBtn) updBtn.style.display = updAvail ? '' : 'none';
    if (hpEl) hpEl.textContent = hpText;
    if (fill) {
      const w = pctNum != null ? Math.max(0, Math.min(100, pctNum)) : 0;
      fill.style.width = w + '%';
      fill.className = 'hpfill' + (w < 25 ? '' : w < 50 ? ' warn' : ' good');
    }
    root.querySelectorAll('.pill').forEach(p => {
      let on, label;
      if (p.hasAttribute('data-loot')) { on = CFG.lootEnabled; label = 'Loot'; }
      else if (p.hasAttribute('data-heal')) { on = CFG.healEnabled; label = 'Heal'; }
      else if (p.hasAttribute('data-rest')) { on = CFG.restEnabled; label = isResting ? '🪑' : 'Rest'; }
      else if (p.hasAttribute('data-combat')) { on = CFG.combatEnabled; label = 'Combat'; }
      else return;
      p.className = 'pill ' + (on ? 'on' : 'off');
      p.textContent = label + ': ' + (on ? 'ON' : 'OFF');
    });
    if (isDead) root.querySelector('#__assist_bar').classList.add('__assist_dead');
    else root.querySelector('#__assist_bar').classList.remove('__assist_dead');

    // stats page
    const s = ASSIST.getStats();
    const set = (sel, val) => { const el = root.querySelector(sel); if (el) el.textContent = val; };
    set('[data-hp]', hpText);
    set('[data-pos]', player.x != null ? `(${player.x.toFixed(1)}, ${player.y.toFixed(1)})` : '?');
    set('[data-pid]', playerId ? playerId.toString(16) : '?');
    set('[data-state]', isDead ? '☠️ ตาย' : (isResting ? '🪑 นั่งพัก' : (activeWS && activeWS.readyState === 1 ? '🟢 เชื่อมต่อ' : '🔴 ไม่ได้ต่อ')));
    set('[data-kills]', s.kills);
    set('[data-looted]', s.itemsLooted);
    set('[data-exp]', s.expGained.toLocaleString());
    set('[data-expmin]', s.expPerMin.toLocaleString());
    set('[data-elapsed]', fmtMs(s.elapsedMs));
    set('[data-deaths]', s.deaths);
    set('[data-zeny]', sessionZeny().toLocaleString() + 'z');
    const itemsEl = root.querySelector('[data-items]');
    if (itemsEl) {
      const top = s.itemsByCount.slice(0, 8);
      itemsEl.innerHTML = top.length ? top.map(i => {
        const price = itemPrice(i.id);
        const zeny = price ? ` <span style="color:#f1c40f">${(price * i.count).toLocaleString()}z</span>` : '';
        const icon = itemDB.loaded ? `<img src="${itemIconUrl(i.id)}" style="width:16px;height:16px;vertical-align:middle" onerror="this.style.display='none'"> ` : '';
        return `<div>${icon}${i.name} ×${i.count}${zeny}</div>`;
      }).join('') : '(ยังไม่มี)';
    }
    // combat stats
    const tgt = ASSIST.getTarget();
    const agg = ASSIST.getAggro();
    set('[data-combat-target]', tgt ? (tgt.id + ' pending:' + tgt.pending) : '(none)');
    set('[data-combat-aggro]', agg.mobAttackers + ' ตี / ' + agg.aggro + ' aggro / ' + agg.threat + ' threat / ' + agg.monstersNearby + ' รอบ');

    // config page — ซิงค์ค่าปัจจุบันเข้า input (กันเขียนทับเวลา user กำลังพิมพ์)
    const lootBtn = root.querySelector('#__assist_lootbtn');
    const healBtn = root.querySelector('#__assist_healbtn');
    const warpBtn = root.querySelector('#__assist_warpbtn');
    if (lootBtn) { lootBtn.textContent = 'Loot: ' + (CFG.lootEnabled ? 'ON' : 'OFF'); lootBtn.className = CFG.lootEnabled ? 'on' : 'off'; }
    if (healBtn) { healBtn.textContent = 'Heal: ' + (CFG.healEnabled ? 'ON' : 'OFF'); healBtn.className = CFG.healEnabled ? 'on' : 'off'; }
    if (warpBtn) { warpBtn.textContent = 'วาร์ปไปเก็บของ: ' + (CFG.warpLootEnabled ? 'ON' : 'OFF') + (warpQueue.size ? ` (${warpQueue.size})` : ''); warpBtn.className = CFG.warpLootEnabled ? 'on' : 'off'; }
    const ha = root.querySelector('#__assist_healat');
    if (ha && document.activeElement !== ha) ha.value = CFG.healAtPercent;
    const hi = root.querySelector('#__assist_healitems');
    if (hi && document.activeElement !== hi) hi.value = CFG.healItems.join(',');
    const hm = root.querySelector('#__assist_healmode');
    if (hm && document.activeElement !== hm) hm.value = CFG.healMode;
    const lm = root.querySelector('#__assist_lootmode');
    if (lm && document.activeElement !== lm) lm.value = CFG.filter.mode;
    const lf = root.querySelector('#__assist_lootfilter');
    if (lf && document.activeElement !== lf) {
      lf.value = (CFG.filter.mode === 'only' ? CFG.filter.onlyItems : CFG.filter.mode === 'except' ? CFG.filter.exceptItems : []).join(',');
      lf.placeholder = CFG.filter.mode === 'only' ? 'item id ที่จะเก็บเท่านั้น' : CFG.filter.mode === 'except' ? 'item id ที่จะไม่เก็บ' : 'เลือกโหมดก่อน';
    }
    const ld = root.querySelector('#__assist_lootdelay');
    if (ld && document.activeElement !== ld) ld.value = CFG.lootDelayAfterDropMs;

    // combat config sync
    const combatBtn = root.querySelector('#__assist_combatbtn');
    if (combatBtn) { combatBtn.textContent = 'Combat: ' + (CFG.combatEnabled ? 'ON' : 'OFF'); combatBtn.className = CFG.combatEnabled ? 'on' : 'off'; }
    const syncInput = (sel, val) => { const el = root.querySelector(sel); if (el && document.activeElement !== el) el.value = val; };
    syncInput('#__assist_whitelist', CFG.targetWhitelist.join(','));
    syncInput('#__assist_blacklist', CFG.targetBlacklist.join(','));
    syncInput('#__assist_attackrange', CFG.rangedAttackRange > 0 ? CFG.rangedAttackRange : CFG.attackRange);
    syncInput('#__assist_fleemob', CFG.fleeOnMobCount);
    syncInput('#__assist_fleeaggro', CFG.fleeOnAggroCount);
    // rest config sync
    const restBtn = root.querySelector('#__assist_restbtn');
    if (restBtn) { restBtn.textContent = 'Rest: ' + (CFG.restEnabled ? 'ON' : 'OFF') + (isResting ? ' 🪑' : ''); restBtn.className = CFG.restEnabled ? 'on' : 'off'; }
    syncInput('#__assist_resthp', CFG.restHpPercent);
    syncInput('#__assist_restuntil', CFG.restUntilPercent);
    syncInput('#__assist_restmaxsec', CFG.restMaxSec);
    syncInput('#__assist_fleeprox', CFG.fleeOnProximityCount);
    const syncToggle = (sel, on) => { const el = root.querySelector(sel); if (el) el.className = on ? 'on' : 'off'; };
    syncToggle('#__assist_t_antiks', CFG.antiKS);
    syncToggle('#__assist_t_avoidp', CFG.avoidOtherPlayers);
    syncToggle('#__assist_t_lowhp', CFG.targetLowestHpFirst);
    syncToggle('#__assist_t_wander', CFG.wanderEnabled);
    syncToggle('#__assist_t_warpfind', CFG.warpFindEnabled);
    syncToggle('#__assist_t_warptomon', CFG.warpToMonster);

    // log page (อัปเดตเฉพาะถ้าเปิดอยู่ เพื่อประหยัด)
    const logPage = root.querySelector('.__assist_page[data-page="log"]');
    if (logPage && logPage.classList.contains('active')) {
      const box = root.querySelector('#__assist_logbox');
      if (box) {
        const logs = ASSIST.getLogs();
        const wasNearBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
        // rebuild เฉพาะถ่ายจำนวนเปลี่ยน (กัน thrash)
        if (box.childElementCount !== logs.length) {
          box.innerHTML = logs.map(l => {
            const d = new Date(l.t);
            const ts = d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0')+':'+d.getSeconds().toString().padStart(2,'0');
            return `<div class="logline"><span class="ts">${ts}</span> ${l.msg.replace(/</g,'&lt;')}</div>`;
          }).join('');
          if (wasNearBottom) box.scrollTop = box.scrollHeight;
        }
      }
    }
  }

  // ---------- version check + update ----------
  let lastConfigSnapshot = null;
  let lastAutoSaveAt = 0;
  let lastVersionCheckAt = 0;
  let latestVersion = null;          // เวอร์ชั่นล่าสุดจาก GitHub (null = ยังไม่ได้เช็ค)
  let updateChecking = false;
  function parseVersionFromHeader(src) {
    const m = src.match(/@version\s+([\d.]+)/);
    return m ? m[1] : null;
  }
  function cmpVer(a, b) {   // คืน >0 ถ้า a ใหม่กว่า b
    const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const da = pa[i] || 0, db = pb[i] || 0;
      if (da !== db) return da - db;
    }
    return 0;
  }
  async function checkVersion() {
    if (updateChecking) return;
    updateChecking = true;
    try {
      const res = await fetch(GITHUB_RAW, { cache: 'no-store' });
      if (!res.ok) return;
      const src = await res.text();
      const remote = parseVersionFromHeader(src);
      if (remote) {
        latestVersion = remote;
        if (cmpVer(remote, VERSION) > 0) {
          log('🔔 มีเวอร์ชั่นใหม่!', VERSION, '→', remote, '(กดปุ่ม ⬆ อัปเดต หรือ ASSIST.update())');
        } else {
          log('✅ เวอร์ชั่นล่าสุดแล้ว (' + VERSION + ')');
        }
      }
    } catch (e) { /* offline / CORS → ข้าม */ }
    finally { updateChecking = false; }
  }
  async function doUpdate() {
    log('⬆ กำลังดาวน์โหลดเวอร์ชั่นใหม่...');
    try {
      const res = await fetch(GITHUB_RAW, { cache: 'no-store' });
      if (!res.ok) { log('❌ ดาวน์โหลดล้มเหลว'); return; }
      let src = await res.text();
      // ถ้าโหลดผ่าน console → eval แทนที่เลย (บันทึก config ก่อน)
      saveConfig();
      // ลบ re-entry guard ออก (window.__ASSIST) เพื่อให้ eval ใหม่ได้
      // เก็บ activeWS ไว้ — สคริปต์ใหม่จะ patch ไม่ได้ socket เดิม (ต้อง reconnect)
      try {
        window.__ASSIST = false;
        (0, eval)(src);
        log('✅ อัปเดตสำเร็จ — รบกวน reconnect เกม (ปิด-เปิดหน้า) เพื่อให้ดัก WebSocket ใหม่');
      } catch (e) {
        log('⚠️ eval ล้มเหลว (อาจเป็น Tampermonkey) → เปิดลิงก์ raw URL เพื่อ copy เอง');
        window.open(GITHUB_RAW, '_blank');
      }
    } catch (e) { log('❌ อัปเดตล้มเหลว:', e.message); }
  }

  // ---------- bootstrap UI (รอ DOM ready) ----------
  function startUI() {
    buildUI();
    uiLoop = setInterval(() => {
      renderUI();
      // auto-save config ทุก ~5 วิ ถ้าค่าเปลี่ยน
      const now = Date.now();
      if (now - lastAutoSaveAt > 5000) {
        lastAutoSaveAt = now;
        const snap = JSON.stringify(PERSIST_KEYS.map(k => CFG[k]));
        if (snap !== lastConfigSnapshot) { lastConfigSnapshot = snap; saveConfig(); }
      }
      // ตรวจเวอร์ชั่นจาก GitHub ทุก ~10 นาที
      if (!latestVersion && now - lastVersionCheckAt > 600000) {
        lastVersionCheckAt = now;
        checkVersion();
      }
    }, 400);
    // ตรวจเวอร์ชั่นครั้งแรกหลังเข้าเกม 5 วิ
    setTimeout(checkVersion, 5000);
    setTimeout(loadItemDB, 2000);   // โหลด item DB หลังเข้าเกม 2s
  }
  if (document.body) startUI();
  else document.addEventListener('DOMContentLoaded', startUI, { once: true });

  log('✅ ติดตั้งแล้ว — เล่นเกมตามปกติ ระบบจะเก็บของและใช้ยาให้เอง');
  log('   พิมพ์ ASSIST.help() เพื่อดูคำสั่งทั้งหมด, ASSIST.status() เพื่อดูสถานะ');
})();
