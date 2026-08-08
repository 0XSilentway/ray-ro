# 🗡️ RO Rebuild Web Assist

ผู้ช่วยเล่นเว็บ client **Ragnarok Online** (Unity WebGL / WebSocket) — ทำงานผ่าน **Tampermonkey** หรือ **browser console** โดยดัก/ฉีด WebSocket ของเกมเพื่ออ่าน packet และสั่งการอัตโนมัติ

> ⚠️ เป็นสคริปต์สแตนด์อะโลน **ไม่ใช่** บอท proxy แยกต่างหาก — รันในหน้าเว็บเกมเท่านั้น

---

## ✨ ฟีเจอร์ทั้งหมด

| ระบบ | ทำอะไร | Default | Mini-bar |
|---|---|---|---|
| **📦 Auto-Loot** | เก็บของที่ตกจากมอนที่ **เราฆ่าเอง** — สลับชิ้น, ลองหลายครั้ง, ระบบกรอง + popup จัดการรายการ (ไอคอน+ชื่อ) | ON | 📦 |
| **💉 Auto-Heal** | ใช้ขวดยาอัตโนมัติเมื่อ HP% ต่ำ — เลือกยาได้หลายชนิด, โหมดเรียง/สุ่ม, ตรวจจับ "ยาหมด" | OFF | 💉 |
| **🪑 Auto-Rest** | HP ต่ำ + ไม่โดนรุม → นั่งพักฟื้น → ลุกยืนกลับฟาร์ม | ON | 🪑 |
| **⚔️ Auto-Combat** | ตีมอนอัตโนมัติ — progressive search, เลือกเป้าใกล้สุด/HP ต่ำสุด, หนีเมื่อถูกรุม, กันแย่ง (KS), มอนตี damage 1 เพิ่มเวลาฆ่า | OFF | ⚔️ |
| **🔮 Auto-Skill** | ใช้สกิลตามเงื่อนไข — 3 โหมด (targeted/ground/AoE/self-cast) + SP tracking + cooldown + preset dropdown | OFF | 🔮 |
| **✨ Auto-Buff** | ใช้ไอเทมบัพเป็นระยะ (timer) — countdown display, เก็บเวลาข้าม session | OFF | ✨ |
| **💰 Auto-Sell** | ไปขายของ NPC อัตโนมัติ — เมื่อของเต็ม/ครบเวลา, per-item toggle (เก็บ/ขาย/ฝาก) | OFF | 💰 |
| **🏦 Auto-Storage** | ฝากของเข้า Kafra — chain หลังขาย, แยก equipment/stackable | OFF | 🏦 |
| **🗺️ Navigation** | บันทึกเส้นทางเดิน + waypoint graph — patrol mode (เดินตามลำดับ), export/import ข้อมูล | OFF | — |
| **🌀 Teleport** | วาร์ปสุ่มในแมปปัจจุบันทันที | — | 🌀 |
| **📤 Backup** | Import/Export ข้อมูลทั้งหมด — ย้ายเครื่องได้ | — | — |

ทุกระบบเปิด/ปิดเป็นอิสระต่อกัน + บันทึกค่าลง localStorage ข้าม session

---

## 📥 วิธีติดตั้ง

### ทางเลือก A — Tampermonkey (แนะนำ)

1. ติดตั้งส่วนเสริม [Tampermonkey](https://www.tampermonkey.net/)
2. คลิกไอคอน Tampermonkey → **Create a new script**
3. ลบเนื้อหาเดิม → วางเนื้อหาจากไฟล์ [`ro-rebuild-web-assist.user.js`](./ro-rebuild-web-assist.user.js) ทั้งหมด → **Ctrl+S**
4. รีเฟรชหน้าเว็บเกม — auto-update ทำงานอัตโนมัติ (มี `@updateURL`)

### ทางเลือก B — Console (ชั่วคราว)

1. เปิดหน้าเว็บเกม (เข้าหน้าล็อกอินได้ แต่ **ยังไม่กดเข้าเกม**)
2. กด **F12** → แท็บ **Console**
3. วางโค้ดทั้งหมด → **Enter**
4. ค่อยเข้าเกม → จะเห็นแถบ ASSIST มุมขวาบน

> ⚠️ ใช้วิธี B ต้องวางใหม่ทุกครั้งที่รีเฟรช

---

## 🎮 วิธีใช้งาน

เล่นเกมตามปกติ — ระบบทำงานเอง คลิก **แถบ ASSIST มุมขวาบน** เพื่อเปิด panel ตั้งค่า

### ⭐ คำสั่งที่ใช้บ่อย (console)

```javascript
ASSIST.status()                    // ดูสถานะทั้งหมด
ASSIST.help()                      // ดูคำสั่งทั้งหมด
ASSIST.config()                    // ดูค่า config ปัจจุบัน

// ---- Auto-Loot ----
ASSIST.lootOn() / lootOff()
ASSIST.setLootMode('all')          // 'all' | 'only' | 'except'

// ---- Auto-Heal ----
ASSIST.setHealItems(501, 502, 503) // ตั้งไอเทม (เปิด auto-heal อัตโนมัติ)
ASSIST.setHealAt(50)               // HP < 50% → ใช้ยา
ASSIST.healOn() / healOff()

// ---- Auto-Combat ----
ASSIST.combatOn() / combatOff()
ASSIST.setTargetWhitelist('Poring', 'Lunatic')  // ว่าง = ตีทุกมอน
ASSIST.setRanged(8)               // นักธนู: ตีไกล 8 ช่อง
ASSIST.setFleeMob(4)              // รุม 4 ตัว → วาร์ปหนี

// ---- Auto-Skill ----
ASSIST.addSkill({ skillId:24, level:10, targeted:true, maxUsesPerTarget:2, maxDistance:12, spMin:14, cooldownMs:2000 })
ASSIST.skillOn() / skillOff()
ASSIST.skillNow()                  // ใช้ skill ทั้งหมดทันที

// ---- Auto-Buff ----
ASSIST.addBuffItem(656, 30)        // Awakening Potion ทุก 30 นาที
ASSIST.buffOn() / buffOff()

// ---- Auto-Sell ----
ASSIST.setSellNpc('Tool Dealer', 'izlude_in')
ASSIST.sellNow()                   // ไปขายทันที

// ---- Auto-Storage (Kafra) ----
ASSIST.setKafra('Kafra Staff', 'izlude')
ASSIST.depositNow()                // ไปฝากทันที

// ---- Farm Map ----
ASSIST.useCurrentPosAsFarm()       // ตั้งแมปฟาร์ม = ตำแหน่งปัจจุบัน
ASSIST.warpToFarm()                // วาร์ปกลับแมปฟาร์ม

// ---- Navigation ----
ASSIST.navRecordOn() / navRecordOff()   // บันทึกเส้นทางเดิน
ASSIST.navGetAllStats()                 // ดูข้อมูลทุกแมป

// ---- Backup ----
ASSIST.exportAll()                // download ข้อมูลทั้งหมด
ASSIST.importAll(jsonString)      // import จาก string
```

---

## 🪟 Panel UI

คลิกแถบ **ASSIST** มุมขวาบน → เปิด panel มี 3 tab:

### 📊 สถิติ (Stats)
- HP/SP, ตำแหน่ง, แมปปัจจุบัน/แมปฟาร์ม
- ฆ่าได้, เก็บของได้, EXP/นาที, ยอด zeny (session)
- มอนที่ตีอยู่, aggro, จำนวนมอนรอบตัว
- ของที่เก็บได้ (พร้อม toggle เก็บ/ขาย/ฝาก)
- **ล้างรายการของ**, **รีเซ็ตสถิติ**
- **📤 export / 📥 import** ข้อมูลทั้งหมด

### ⚙️ ตั้งค่า (Config)
- toggle ทุกระบบ + ช่องตั้งค่า
- **Popup จัดการรายการ item** (เก็บเฉพาะ/ยกเว้น) — แสดงไอคอน + ชื่อ + ค้นหา + เพิ่ม id manual
- **Popup จัดการ skill** — preset dropdown + ฟอร์มแก้ไข (label + tooltip ทุกช่อง)
- Skill/Buff countdown display (เหลือเวลาอีกกี่นาที/วินาที)

### 📋 Log
- log การทำงานแบบ real-time

---

## 🧠 รายละเอียดแต่ละระบบ

### Auto-Combat (โจมตีอัตโนมัติ)
- **Progressive search** — ค้นมอนจากรัศมีเล็กไปใหญ่ `[5,10,20,30]` (เลือกใกล้ก่อน)
- **Targeted skill** — ส่ง packet สกิลแทน/ร่วมกับ attack ปกติ
- **Stuck handling** — ตีไม่ติด/server เงียบ → abandon + เดินหลีก + cooldown
- **Slow monster** — มอนตี damage 1 (mushroom/plant) → เพิ่มเวลาฆ่าเป็น 180s
- **Anti-KS** — ข้ามมอนที่คนอื่นกำลังสู้ (ตรวจจาก ATTACK + SKILL packet)
- **HP guard** — ป้องกัน HP ผิดเพี้ยนในที่คนเยอะ (playerName guard + grace period)

### Auto-Skill (ใช้สกิลอัตโนมัติ)
4 โหมดการส่ง:
| โหมด | Protocol | ตัวอย่าง |
|---|---|---|
| **targeted** (sub=01) | `[1d][01][targetId:4][skillId:1][level:1]` | Bash, Double Strafe, Charge Arrow |
| **ground** (sub=04) | `[1d][04][x:2][y:2][skillId:1][level:1]` | Arrow Shower |
| **AoE** (sub=05) | `[1d][05][skillId:2][level:1]` | Magnum Break |
| **self-cast** (sub=05) | `[1d][05][skillId:2][level:1]` | Two-Hand Quicken, Improve Concentration |

- **SP tracking** — อ่าน SP จาก packet 0x27 (SP_UPDATE) แยกจาก HP
- **Cooldown + persist** — บันทึกเวลาใช้ล่าสุดข้าม session
- **Per-target uses** — จำกัดจำนวนครั้งต่อมอน + reset ตอนเปลี่ยน target/ตาย
- **Preset dropdown** — เลือกสกิลสำเร็จรูป (ทดลองแล้ว) จาก list

### Auto-Sell + Auto-Storage
- **Sell**: วาร์ปไป NPC → คุย → เลือก Sell → ส่งรายการขาย → วาร์ปกลับ
- **Storage (Kafra)**: chain หลังขาย → คุย Kafra → เปิด storage → ฝากทีละชิ้น → ปิด → วาร์ปกลับ
- **Equipment**: ส่ง slot ID (ไม่ใช่ itemId) + เรียง slot สูง→ต่ำ (กัน index shift)
- **Per-item toggle**: ปุ่มสีที่รายการของ — เก็บ(เทา) → ขาย(ส้ม) → ฝาก(เขียว)

### Navigation (เส้นทางเดิน)
- **Recording**: เปิดบันทึก → เดินเอง → บันทึก trail (ตำแหน่งที่คลิกจริง)
- **Waypoint graph**: สร้าง graph จาก trail (merge จุดใกล้กัน + edges)
- **Patrol mode**: เดินตามลำดับ route → ครบแล้วย้อนกลับ (ping-pong)
- **localStorage** per-map + export/import

### Farm Map
- ตั้งแมปฟาร์ม + พิกัดวาร์ป
- เผลอเดินเข้าวาร์ป → วาร์ปกลับอัตโนมัติ (retry ทุก 5s ถ้าไม่สำเร็จ)
- ปุ่ม "วาร์ปไปแมปฟาร์ม" สำหรับใช้ manual

---

## 🔧 การทำงานเบื้องหลัง

สคริปต์ดัก `WebSocket` constructor → อ่าน packet ที่เข้า/ออก และส่ง packet เอง

| Packet | Opcode | ใช้สำหรับ |
|---|---|---|
| STAT | `0x25` | อ่าน HP/Max HP |
| SP_UPDATE | `0x27` | อ่าน SP/Max SP |
| ITEM_DROP | `0x51` | ของตกจากมอน |
| PICKUP | `0x52` | สั่งเก็บของ + รับผล |
| USE_ITEM | `0x2f` | สั่งใช้ยา/buff |
| SKILL | `0x1d` | สั่งใช้สกิล (targeted/ground/AoE/self) |
| ATTACK | `0x0b` | สั่งโจมตีมอน |
| MOVE | `0x07` | สั่งเดิน (click-move) |
| TELEPORT | `0x40` | วาร์ป (flee/warp-loot/warp-farm) |
| SIT_STAND | `0x0e` | นั่ง/ลุก |
| SPAWN | `0x06` | ตรวจจับมอน + HP + ตำแหน่ง + playerId |
| INVENTORY | `0x32` | track inventory count + equipment slot |
| NPC_TALK | `0x4c` | คุย NPC (sell/storage) |
| NPC_DIALOG | `0x4d` | NPC menu → เลือก Sell/Storage |
| SELL_ITEMS | `0x57` | ส่งรายการขาย |
| STORAGE_MOVE | `0x56` | ฝากของเข้า Kafra |
| MAP_NAME | `0x12` | ชื่อแมป + warp-back-to-farm |
| SELECT_CHAR | `0x03` | playerId + ชื่อแมป (login) |

---

## 📦 ข้อมูลที่ใช้

| ไฟล์ | รายละเอียด |
|---|---|
| `items.csv` | รายการ item id + name (949 รายการ, dedup + sort) |
| `items/meta.json` | item metadata + buyPrice (853 entries) |
| `items/small/` | ไอคอน item (.gif, 960 รายการ) |

---

## ⚠️ ข้อควรระวัง

- ใช้กับเว็บ client ที่สื่อสารผ่าน **WebSocket** เท่านั้น (Unity WebGL)
- การใช้สคริปต์ช่วยเล่นอาจผิดกฎของเซิร์ฟเวอร์ — **ใช้ในความรับผิดชอบของผู้ใช้**
- `@match` ตั้งไว้ที่ `*://*.rayrag.com/*` — ถ้าเซิร์ฟอื่นให้แก้ให้ตรง
- ฟีเจอร์ที่ส่ง packet จริง (warp/combat/skill) **default OFF** — เปิดเองเมื่อพร้อม
- สกิลใน preset dropdown เฉพาะที่ **ทดลองแล้ว** (verify จาก packet capture) — จะค่อยๆ เพิ่ม

---

## 📜 License

MIT
