# 🗡️ RO Rebuild Web Assist

ผู้ช่วยเล่นเว็บ client **Ragnarok Online** (Unity WebGL / WebSocket) — ทำงานผ่าน **Tampermonkey** หรือ **browser console** โดยดัก/ฉีด WebSocket ของเกมเพื่ออ่าน packet และสั่งการอัตโนมัติ

> ⚠️ เป็นสคริปต์สแตนด์อะโลน **ไม่ใช่** บอท proxy แยกต่างหาก — รันในหน้าเว็บเกมเท่านั้น

---

## ✨ ฟีเจอร์

| ระบบ | ทำอะไร | Default |
|---|---|---|
| **🩹 Auto-Heal** | ใช้ขวดยาอัตโนมัติเมื่อ HP% ต่ำกว่าที่ตั้ง — เลือกยาได้หลายชนิด, โหมดเรียง/สุ่ม, ตรวจจับ "ยาหมด" (ใช้แล้ว HP ไม่ขยับ → ข้ามไปตัวถัดไปทันที) | OFF |
| **📦 Auto-Loot** | เก็บของที่ตกจากมอนที่ **เราฆ่าเอง** — สลับชิ้น, ลองหลายครั้ง, ระบบกรอง + ดีเลย์ก่อนเก็บ | ON |
| **🌀 Warp-to-Loot** | ของติดกำแพง/หน้าผา เก็บไม่ได้ → วาร์ปไปที่ไอเท็มแล้วเก็บใหม่ | OFF |
| **⚔️ Auto-Combat** | ตีมอนอัตโนมัติ — เลือกเป้าใกล้สุด/HP ต่ำสุด, หนีเมื่อถูกรุม, กันแย่งคนอื่น (KS), วาร์ปหามอน | OFF |
| **🪑 Auto-Rest** | HP ต่ำ + ไม่โดนรุม → นั่งพักฟื้น HP → ลุกยืนกลับฟาร์มเมื่อ HP ครบ | OFF |

ทุกระบบเปิด/ปิดเป็นอิสระต่อกัน

---

## 📥 วิธีติดตั้ง

### ทางเลือก A — Tampermonkey (แนะนำ)

1. ติดตั้งส่วนเสริม [Tampermonkey](https://www.tampermonkey.net/) บนเบราว์เซอร์
2. คลิกไอคอน Tampermonkey → **Create a new script**
3. ลบเนื้อหาเดิม → วางเนื้อหาจากไฟล์ [`ro-rebuild-web-assist.user.js`](./ro-rebuild-web-assist.user.js) ทั้งหมด → **Ctrl+S** บันทึก
4. รีเฟรชหน้าเว็บเกม (ต้องติดตั้งก่อนเข้าเกม เพราะต้องดัก WebSocket ตั้งแต่ต้น)

### ทางเลือก B — Console (ชั่วคราว ไม่ต้องติดตั้งส่วนเสริม)

วิธีนี้ง่ายที่สุด — ไม่ต้องติดตั้ง Tampermonkey ใช้ได้ทันที

1. เปิดหน้าเว็บเกม (เข้าหน้าล็อกอินได้ แต่ **ยังไม่กดล็อกอินเข้าเกม**)
2. **คลิกขวา** บนหน้าเว็บ → เลือก **Inspect** (หรือกด `F12` / `Ctrl+Shift+I`)
3. ไปที่แท็บ **Console**
4. เปิดไฟล์ [`ro-rebuild-web-assist.user.js`](./ro-rebuild-web-assist.user.js) → คัดลอกโค้ดทั้งหมด
5. **วาง** โค้ดลงในช่อง Console แล้วกด **Enter**
   - จะเห็นข้อความ `[ASSIST] ✅ ติดตั้งแล้ว` = สำเร็จ
6. ค่อย **ล็อกอินเข้าเกม** ตามปกติ
7. พอเข้าเกมแล้ว จะเห็น **แถบ ASSIST มุมขวาบน** — คลิกเพื่อเปิด panel ตั้งค่า

> ⚠️ ใช้วิธีนี้ต้องวางใหม่ทุกครั้งที่รีเฟรชหน้าเว็บ (เพราะเป็นการรันชั่วคราว ไม่ได้บันทึกถาวร)

---

## 🎮 วิธีใช้งาน

แค่เล่นเกมตามปกติ — ระบบจะทำงานให้เอง เปิด **Console (F12)** เพื่อดู log และควบคุม หรือคลิกที่ **แถบ ASSIST มุมขวาบน** เพื่อเปิด panel ตั้งค่าแบบกราฟิก

### ⭐ คำสั่งที่ใช้บ่อย

```javascript
ASSIST.status()                    // ดูสถานะทั้งหมด (HP%, คิวของ, ค่าที่ตั้งไว้)
ASSIST.help()                      // ดูคำสั่งทั้งหมด
ASSIST.debugEntities()             // (debug) ดูมอนรอบตัว + พิกัด + HP

// ---- Auto-Heal ----
ASSIST.setHealAt(50)               // เลือดต่ำกว่า 50% → ใช้ยา
ASSIST.setHealItems(501, 502, 503) // ไอเทมที่จะใช้ (Red/Yellow/White Potion)
ASSIST.setHealMode('order')        // 'order' = ใช้ตัวเดิมจนหมดแล้วข้าม, 'random' = สุ่ม
ASSIST.healOn() / ASSIST.healOff() // เปิด/ปิด

// ---- Auto-Loot ----
ASSIST.setLootMode('all')          // 'all' = เก็บหมด, 'only' = เก็บเฉพาะ, 'except' = ยกเว้น
ASSIST.addLootOnly(909, 512)       // เพิ่ม item โหมด 'only'
ASSIST.addLootExcept(909)          // เพิ่ม item โหมด 'except'
ASSIST.setLootDelay(500)           // รอ 500ms หลังของตก แล้วค่อยเก็บ (0=ทันที)
ASSIST.lootOn() / ASSIST.lootOff() // เปิด/ปิด

// ---- Warp-to-Loot (วาร์ปไปเก็บของที่ติดกำแพง) ----
ASSIST.warpLootOn() / ASSIST.warpLootOff()

// ---- Auto-Rest (นั่งพักฟื้น HP) ----
ASSIST.restOn() / ASSIST.restOff()
ASSIST.setRestHp(30)               // HP < 30% → นั่งพัก
ASSIST.setRestUntil(90)            // HP ≥ 90% → ลุกยืน
ASSIST.setRestMaxSec(60)           // นั่งนานสุด 60 วิ (กันค้าง)

// ---- Auto-Combat ----
ASSIST.combatOn() / ASSIST.combatOff()
ASSIST.setTargetWhitelist('Poring', 'Lunatic')  // ตีเฉพาะมอนเหล่านี้ (ชื่อหรือ sprite id)
ASSIST.setTargetBlacklist('MVP')                 // ไม่ตีมอนเหล่านี้
ASSIST.setRanged(8)               // นักธนู: ตีได้ในระยะ 8 ช่อง
ASSIST.setFleeMob(4)              // ถูกรุม 4 ตัว → วาร์ปหนี (0=off)
ASSIST.setFleeAggro(3)            // มอนจับเราเป็นเป้า 3 ตัว → หนี
ASSIST.setFleeProximity(5, 8)     // มอนรอบตัว 5 ตัว ในระยะ 8 → หนี
ASSIST.toggleAntiKS(true)         // ไม่ตีมอนที่คนอื่นกำลังสู้ (default ON)
ASSIST.toggleWarpFind(true)       // ไม่เจอมอน 30s → วาร์ปสุ่ม (default OFF)
ASSIST.toggleWarpToMonster(true)  // ตีมอนไม่เข้า → วาร์ปไปหา (default OFF)
```

### ตัวอย่าง item id (อ้างอิง RO มาตรฐาน — อาจต่างในแต่ละเซิร์ฟ)

| ID | ชื่อ |
|---|---|
| 501 | Red Potion |
| 502 | Yellow Potion |
| 503 | White Potion |
| 504 | Blue Potion |
| 505 | Wing of Fly |
| 601 | Wing of Butterfly |
| 909 | Jellopy |
| 512 | Apple |

> 💡 หา "item id": พิมพ์ `ASSIST.status()` ตอนมีของ/เลือด → จะเห็นชื่อแบบ `item_935` แล้วเอาตัวเลขไปใช้

---

## 🪟 Panel UI (แถบมุมขวาบน)

หลังเข้าเกม จะเห็นแถบ ASSIST ที่มุมขวาบนของหน้าเว็บ:

- **Mini-bar**: HP + แถบเลือด + toggle Loot/Heal/Rest/Combat ด่วน
- **Popup panel** (คลิกที่แถบ) มี 3 tab:
  - 📊 **สถิติ**: HP, ตำแหน่ง, ฆ่าได้, เก็บของได้, EXP/นาที, มอนที่ตีอยู่
  - ⚙️ **ตั้งค่า**: toggle ทุกระบบ + ช่องตั้งค่า whitelist/flee/heal/rest/loot
  - 📋 **Log**: log การทำงานแบบ real-time

---

## 🧠 รายละเอียดแต่ละระบบ

### Auto-Combat (โจมตีอัตโนมัติ)

บอทจะเลือกมอนเอง → ส่ง packet โจมตี → server เดินตัวละครเข้าไปตีเอง (เหมือนคลิก) รองรับนักธนู (ตีไกลได้)

**ลำดับการทำงาน (priority):**
1. **Rest** — HP ต่ำ + ไม่โดนรุม → นั่งพัก
2. **Flee** — ถูกรุม/aggro มาก → วาร์ปหนี
3. **Loot-blocking** — มีของรอเก็บ + ไม่โดนรุม → หยุดตี เก็บของก่อน
4. **Defensive retarget** — โดนมอนตี → สลับมาตีตัวนั้น
5. **Attack** — ตี target ปัจจุบัน
6. **Acquire** — หาเป้าใหม่ (ใกล้สุด หรือ HP ต่ำสุดเมื่อถูกรุม)
7. **Wander/WarpFind** — ไม่เจอมอน → สุ่มเดิน / วาร์ปหา

**ความปลอดภัย:**
- ตีเฉพาะมอนใน whitelist (default ว่าง = ตีทุกมอน — ระวัง MVP/มอนแรง)
- ไม่ตี NPC/ผู้เล่น (kind check)
- กันแย่งคนอื่น (anti-KS): ข้ามมอนที่คนอื่นกำลังสู้ + ข้ามมอนใกล้ผู้เล่นคนอื่น
- ถูกรุม ≥2 ตัว → ตี HP ต่ำสุดก่อน (ฆ่าทีละตัว ไม่ตีสลับ)

### Auto-Rest (นั่งพัก)

- HP < `restHpPercent` (30%) + ไม่โดนรุม → นั่ง (sit)
- HP ≥ `restUntilPercent` (90%) หรือ ครบ `restMaxSec` (60s) → ลุกยืน (stand)
- โดนรุมระหว่างนั่ง → ลุกทันทีเพื่อตีตอบ
- นั่งอยู่ → heal ข้าม (ใช้ regen แทน ประหยัดยา)

### Warp-to-Loot (วาร์ปไปเก็บของ)

- เก็บของไม่ได้ครบจำนวนครั้งที่กำหนด (server เงียบ = ติดกำแพง) → วาร์ปไปที่พิกัดของไอเท็ม
- ถ้าวาร์ป fail (พิกัด invalid) → ลอง offset ใกล้ๆ (กลาง/เหนือ3/ตอ3/ใต้3/ตต3)
- ส่ง packet warp จริง — default OFF เพราะเป็นฟีเจอร์รุนแรง

---

## 🔧 การทำงานเบื้องหลัง

สคริปต์ดัก `WebSocket` constructor ของหน้าเว็บ → อ่าน packet ที่เข้า/ออก และส่ง packet เอง:

| Packet | Opcode | ใช้สำหรับ |
|---|---|---|
| STAT | `0x25` | อ่าน HP/Max HP |
| ITEM_DROP | `0x51` | ของตกจากมอน |
| PICKUP | `0x52` | สั่งเก็บของ + รับผล |
| USE_ITEM | `0x2f` | สั่งใช้ยา |
| ATTACK | `0x0b` | สั่งโจมตีมอน |
| MOVE | `0x07` | สั่งเดิน (click-move) |
| TELEPORT | `0x40` | วาร์ป (flee/warp-loot/warp-find) |
| SIT_STAND | `0x0e` | นั่ง/ลุก |
| SPAWN | `0x06` | ตรวจจับมอน + HP + ตำแหน่ง |
| EXP_GAIN | `0x22` | สัญญาณว่าเราฆ่ามอนได้ |
| MONSTER_SKILL | `0x18` | มอนจับเราเป็นเป้า (aggro) |
| ENTITY_ACTION | `0x0f` | มอนตาย |
| DEATH | `0x24` | ตัวละครตาย |
| MAP_NAME | `0x12` | ชื่อแมป (จำเป็นสำหรับ warp) |
| SELECT_CHAR | `0x03` | หา player_id + ชื่อแมป (login ครั้งแรก) |

---

## ⚙️ ปรับแต่ง

แก้ค่าเริ่มต้นได้ในบล็อก `CFG` ที่ต้นไฟล์ `.user.js` หรือควบคุมสดจาก console ด้วย `ASSIST.*` (เปลี่ยนแล้วมีผลทันที ไม่ต้องรีเฟรช)

---

## ⚠️ ข้อควรระวัง

- ใช้กับเว็บ client ที่สื่อสารผ่าน **WebSocket** เท่านั้น (Unity WebGL / ไม่ใช่ client `.exe`)
- การใช้สคริปต์ช่วยเล่นอาจผิดกฎของเซิร์ฟเวอร์ — **ใช้ในความรับผิดชอบของผู้ใช้**
- `@match` ใน header ตั้งไว้ที่ `*://*.rayrag.com/*` — ถ้าเซิร์ฟอื่นให้แก้ให้ตรง
- ฟีเจอร์ที่ส่ง packet จริง (warp/combat) **default OFF** เพื่อความปลอดภัย — เปิดเองเมื่อพร้อมใช้

---

## 📜 License

MIT
