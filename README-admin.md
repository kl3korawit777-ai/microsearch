# Microsearch Admin (Supabase)

Admin backend แยกจาก public site — ใช้ Supabase เก็บข้อมูล + Auth, แล้วกด Publish เพื่อ export `data.js` สำหรับ deploy

## สถาปัตยกรรม

```
[admin/index.html] --(Supabase JS)--> [Supabase: microbes table + Auth]
       |
       └─ กด Publish → ดาวน์โหลด data.js → commit + push → public site อัปเดต
```

Public site (`/app.html` — มี landing screen ที่ `/index.html` คั่นก่อน) ยังคงเป็น static อ่าน `data.js` ไม่แตะ Supabase
— ทำให้เร็ว, ไม่กิน Supabase quota, ทำงาน offline ได้

## ตั้งค่าครั้งแรก (one-time)

### 1. สร้าง Supabase project
1. ไปที่ https://supabase.com → Sign in → **New project**
2. ตั้งชื่อ project (เช่น `microsearch`) + ตั้ง database password
3. เลือก region ใกล้ๆ (เช่น Southeast Asia — Singapore)
4. รอสร้างเสร็จ (~2 นาที)

### 2. สร้าง table + RLS
1. เข้า project → เมนูซ้าย **SQL Editor** → **New query**
2. ก็อปเนื้อ `supabase/schema.sql` ทั้งไฟล์ → วาง → กด **Run**
3. ควรขึ้น `Success. No rows returned.`

### 3. สร้าง admin user
1. เมนูซ้าย **Authentication** → **Users** → **Add user** → **Create new user**
2. ใส่ email + password ที่จะใช้เข้า admin
3. ✅ ติ๊ก **Auto Confirm User** (ข้าม email verification)
4. กด **Create user**

### 4. เอา URL + anon key มาใส่
1. เมนูซ้าย **Project Settings** (เกียร์) → **API**
2. ก็อป **Project URL** และ **anon public** key
3. ก็อปไฟล์ `admin/config.example.js` เป็น `admin/config.js`
4. เปิด `admin/config.js` แล้ววาง URL + key ที่ก็อปมา

> `admin/config.js` ถูก gitignore แล้ว — แต่จริงๆ anon key ปลอดภัยที่จะ commit
> เพราะ RLS เป็นด่านป้องกันจริง (anon อ่านได้อย่างเดียว, เขียนต้อง login)

### 5. Seed ข้อมูลครั้งแรก
1. เปิด `admin/index.html` ในเบราว์เซอร์ (เช่น `file:///.../admin/index.html` หรือผ่าน live server)
2. Login ด้วย email/password ที่สร้างไว้ใน step 3
3. จะเห็นปุ่ม **⬇ Seed จาก data.js** — กด → ยืนยัน
4. ทุกเชื้อใน `data.js` ปัจจุบันจะถูกอัปขึ้น Supabase

## ใช้งานประจำ

### เพิ่ม / แก้ / ลบ
1. เปิด `admin/index.html` → Login
2. **+ เพิ่มเชื้อ** หรือคลิกแถวเพื่อแก้
3. กด **บันทึก** — เปลี่ยนแปลงเก็บใน Supabase ทันที

### Publish ไปยัง public site
1. หลังแก้เสร็จ — กดปุ่ม **↑ Publish** ที่ header
2. เบราว์เซอร์ดาวน์โหลดไฟล์ `data.js` ใหม่
3. เอาไฟล์ไปทับ `data.js` ใน repo
4. `git add data.js && git commit -m "Publish: <change>" && git push`
5. Vercel / GitHub Pages จะ deploy ใหม่อัตโนมัติ

## ความปลอดภัย

- **anon key**: ปลอดภัยที่จะอยู่ใน client (เป็น public key ตาม design ของ Supabase)
- **RLS policies** (อยู่ใน `schema.sql`):
  - `read all`: ใครก็อ่านได้ (เผื่อ public site จะดึงตรงในอนาคต)
  - `auth insert/update/delete`: ต้อง login ด้วย Supabase Auth ก่อน
- **service_role key**: ❌ ห้ามใส่ใน client — bypass RLS ทุกอย่าง
- **admin/config.js**: gitignore ไว้กันสับสน

## โครงสร้างไฟล์

```
admin/
├── index.html       UI admin
├── admin.js         CRUD + auth + publish logic
├── admin.css        styles เฉพาะ admin
├── config.example.js  template (commit ได้)
└── config.js        anon URL + key จริง (gitignore)

supabase/
└── schema.sql       table + RLS policies
```

## Troubleshooting

**"admin/config.js ยังไม่ตั้งค่า"** → ทำ step 4 ใหม่

**Login แล้วขึ้น error "Invalid login credentials"**
→ ตรวจ Authentication > Users ว่ามี user นั้นจริง + Auto Confirm ติ๊กแล้ว

**Seed แล้วขึ้น "permission denied"**
→ ยังไม่ได้รัน `schema.sql` หรือ RLS policy ไม่ครบ — รัน schema.sql อีกครั้ง

**กด Publish แล้วไฟล์ที่ดาวน์โหลดไม่ครบ**
→ ตรวจ Network tab — อาจมี microbe เยอะเกิน 1000 (default limit) ต้องแก้ pagination ใน `loadMicrobes()`
