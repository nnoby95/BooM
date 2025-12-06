# TW Vezérlő - Központi Parancs Panel Útmutató

## 🎮 Áttekintés

A TW Vezérlő egy centralizált vezérlőpanel, amely lehetővé teszi az összes Tribal Wars fiók irányítását egyetlen helyről. Csak futtatni kell a userscriptet a Chrome profilokban, és mindent a központi panelről irányíthatsz!

## 📍 Elérés

- **URL**: `https://172.236.201.97:3000`
- **Felhasználó**: Nincs bejelentkezés szükség (biztonságos SSL)
- **Nyelvezet**: Magyar

## ⚡ Funkciók

### 1. Csapatok Küldése
- **Válassz fiókot** a legördülő menüből
- **Add meg a célkoordináták** at (pl. 500|500)
- **Válaszd ki a típust**: Támadás vagy Támogatás
- **Állítsd be a csapatokat**: Add meg minden egység számát
- **Kattints a "Csapatok Küldése" gombra**

**Automatika**:
- A parancs várólistára kerül
- 5-15 mp késleltetés minden parancs között
- 30 mp cooldown fiók között

### 2. Építés
- **Válassz fiókot**
- **Válassz épületet**: Főépület, Kaszárnya, Istálló, stb.
- **Add meg a szintek számát**: Hány szintet építsen
- **Kattints az "Építés Indítása" gombra**

### 3. Toborzás
- **Válassz fiókot**
- **Válassz épületet**: Kaszárnya, Istálló, Műhely, Akadémia
- **Add meg az egységek számát**: Mennyi egységet toborozzon
- **Kattints a "Toborzás Indítása" gombra**

### 4. Tömeges Műveletek
**⚠️ VESZÉLY: Több fiókot érint egyszerre!**

- **Tömeges Támadás**:
  - Add meg a célkoordináták at
  - Add meg a csapatok számát
  - Válassz ki több fiókot (Ctrl+Click)
  - Indítsd el a tömeges támadást

**Biztonsági rendszer**:
- Minden parancs automatikusan várólistára kerül
- 5-15 mp véletlenszerű késleltetés parancsok között
- 30 mp cooldown minden fiók között
- SOHA nem hajt végre több parancsot egyszerre

## 📊 Várólista Rendszer

A várólista biztosítja, hogy:
- ✅ Csak EGY parancs fut egyszerre a TELJES rendszerben
- ✅ 5-15 mp véletlenszerű késleltetés minden parancs között
- ✅ 30 mp cooldown minden fiók között
- ✅ Nem észlelhető a Tribal Wars által

**Várólista állapot**:
- **Várólistán**: Hány parancs vár végrehajtásra
- **Feldolgozás**: Fut-e éppen parancs
- **Parancslista**: Mit vár végrehajtásra és mikor

**Várólista törlése**:
- Vészhelyzet esetén kattints a "Várólista Törlése" gombra
- Minden várakozó parancs azonnal törlődik

## 📱 Csatlakozott Fiókok

A dashboard mutatja az összes csatlakozott fiókot:
- ✅ **Zöld pont**: Csatlakozva
- ⚪ **Szürke pont**: Lecsatlakozva

**Látható adatok**:
- Fiók neve (world_játékosnév)
- Falu neve és koordináták
- Nyersanyagok (Fa, Agyag, Vas)
- Lakosság
- Utolsó frissítés ideje

## 🚨 Riasztások

A dashboard automatikusan figyeli a bejövő támadásokat:
- ⚠️ **Piros figyelmeztetés**: Bejövő támadás
- ⏰ **Visszaszámlálás**: Mennyi idő van a becsapásig
- 📍 **Forrás**: Honnan jön a támadás

### ⚡ Valós Idejű Riasztások (v1.0.12 ÚJ!)

A userscript most már elfogja a játék saját WebSocket kapcsolatát és **azonnal** értesíti a dashboard-ot bejövő támadásokról:

**Előnyök**:
- 🚀 **Azonnali riasztások**: Nem kell várni 60 másodpercet!
- 🔔 **Hang értesítés**: Beep hang bejövő támadásnál
- 📢 **Böngésző értesítés**: Asztali notification (ha engedélyezed)
- ⚡ **Címsor villogás**: "🚨 TÁMADÁS!" üzenet a címsorban
- 🎯 **100% Biztonságos**: Csak olvas adatokat, nem ír semmit

**Hogyan működik**:
1. A userscript elfogja a játék Socket.IO kapcsolatát
2. Passzívan figyeli az eseményeket (command/incoming)
3. Továbbítja a vezérlő szervernek
4. Dashboard azonnal megjeleníti a riasztást

**Detektálhatóság**: ZERO! A userscript csak olvas adatokat, nem küld egyetlen kérést sem a Tribal Wars szervernek. A játék szerverének nincsen tudomása arról, hogy olvasod az adatokat.

## 🔧 Használat

### Lépésről lépésre

1. **Telepítsd a userscript et**:
   - URL: `/root/tw-agent-v1.0.12.user.js` (Linode szerveren)
   - Telepítsd minden Chrome profilba (30 fiók)

2. **Nyisd meg a Tribal Wars-t**:
   - A userscript automatikusan csatlakozik a szerverhez
   - Látni fogod a 🤖 TW Agent jelzést a jobb felső sarokban

3. **Nyisd meg a központi panelt**:
   - URL: `https://172.236.201.97:3000`
   - Látni fogod az összes csatlakozott fiókot

4. **Adj parancsokat**:
   - Válassz fület (Csapatok, Építés, Toborzás, Tömeges)
   - Töltsd ki a formot
   - Kattints a gombra
   - A parancs automatikusan végrehajtásra kerül!

### Tippek

✅ **DO** (Csináld):
- Használj közepes mennyiségű parancsot (10-20/óra per fiók)
- Hagyd futni a userscriptet 24/7
- Ellenőrizd a várólistát gyakran
- Használj egyedi csapatkonfigurációkat különböző fiókokhoz

❌ **DON'T** (Ne csináld):
- Ne indíts 30 támadást egyszerre (használd a tömeges műveletet)
- Ne törölj parancsokat válogatás nélkül
- Ne használd éjszaka teljes intenzitással (gyanús)
- Ne használj fix számokat minden parancshoz (variálj)

## 📈 Biztonsági Rendszer

### Globális Throttling
- **EGY** parancs egyszerre a TELJES rendszeren
- **5-15 mp** véletlenszerű késleltetés
- **30 mp** fiók cooldown

### Userscript Anti-Detektálás
- Egyedi timing fingerprint minden fióknak
- Human-like gépelés szimuláció
- Fatigue szimuláció (lassuló akciók idővel)
- Véletlen "gondolkodási" szünetek (5% esély)

### Magyar Nyelv Támogatás
- Működik klanhaboru.hu-n is
- Automatikus nyelv detektálás
- Bilingual DOM selectorok

## 🔗 API Végpontok

Ha saját scripteket akarsz írni:

```bash
# Csapatok küldése
POST /api/commands/send-troops
{
  "accountId": "hu97_player",
  "targetCoords": "500|500",
  "troops": { "axe": 100 },
  "sendType": "attack"
}

# Építés
POST /api/commands/build
{
  "accountId": "hu97_player",
  "building": "barracks",
  "levels": 1
}

# Toborzás
POST /api/commands/recruit
{
  "accountId": "hu97_player",
  "building": "barracks",
  "units": { "spear": 50 }
}

# Várólista állapot
GET /api/commands/queue/status

# Fiókok listája
GET /api/accounts

# Várólista törlése
DELETE /api/commands/queue
```

## 📞 Hibaelhárítás

### Fiók nem jelenik meg?
1. Ellenőrizd, hogy a userscript fut-e (🤖 jelző)
2. Ellenőrizd a böngésző konzolt (F12)
3. Próbáld újratölteni az oldalt

### Parancs nem hajt végre?
1. Ellenőrizd a várólista állapotot
2. Lehet cooldown alatt van a fiók (30 mp)
3. Ellenőrizd, hogy a fiók csatlakozva van-e

### Várólista leállt?
1. Ellenőrizd a szerver állapotát: `ssh root@172.236.201.97 "pm2 status"`
2. Újraindítás: `ssh root@172.236.201.97 "pm2 restart tw-controller"`

## ⚙️ Szerver Információk

- **Szerver**: Linode VPS (172.236.201.97)
- **SSH**: root@172.236.201.97 (jelszó: 2Bn3T53TqNd1995)
- **PM2 Process**: tw-controller
- **Port**: 3000 (HTTPS/WSS)
- **Userscript**: /root/tw-agent-v1.0.12.user.js

## 📚 További Információk

- **Phase 3 Implementation Guide**: `phase 3 implementation guide.md`
- **DEVLOG**: `DEVLOG.md`
- **Hungarian Support**: `hu_suport.md`

---

**Verzió**: 1.1 (2025-12-04)
**Fejlesztő**: TW Controller Team
**Status**: ✅ Production Ready (Real-Time Alerts Integrated!)
