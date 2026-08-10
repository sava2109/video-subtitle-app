# Postavljanje aplikacije na internet (VPS + Docker)

Aplikacija obrađuje video FFmpeg-om, što traži procesor i memoriju, pa je
VPS znatno bolji izbor od malih "free/starter" planova. Preporuka:
**Hetzner CX22** (2 vCPU, 4 GB RAM, 40 GB diska, ~3.79 €/mes).

Sve ide kroz Docker, pa na serveru ne moraš ručno da instaliraš Node,
FFmpeg ni fontove. HTTPS sertifikat Caddy uzima sam.

---

## 1. Napravi server

1. Otvori nalog na <https://console.hetzner.cloud>
2. **New project** → **Add server**
3. Podesi:
   - **Location**: Nürnberg ili Falkenstein (Nemačka, najbliže)
   - **Image**: Ubuntu 24.04
   - **Type**: Shared vCPU → **CX22**
   - **SSH key**: dodaj svoj ključ (ako ga nemaš, napravi ga komandom
     `ssh-keygen -t ed25519` pa nalepi sadržaj fajla `~/.ssh/id_ed25519.pub`)
4. **Create & Buy now**
5. Zapiši IP adresu servera

---

## 2. Domen (ili besplatna zamena)

**Ako imaš domen**: napravi `A` zapis koji pokazuje na IP servera
(npr. `titlovi.tvojdomen.com` → `203.0.113.45`).

**Ako nemaš domen**: koristi `nip.io` — besplatno i radi odmah.
Za IP `203.0.113.45` domen je:

```
203.0.113.45.nip.io
```

Caddy i za taj domen dobija pravi Let's Encrypt sertifikat, pa imaš HTTPS.

---

## 3. Pripremi server

Poveži se:

```bash
ssh root@IP_SERVERA
```

Instaliraj Docker i osnovnu zaštitu:

```bash
# Docker
curl -fsSL https://get.docker.com | sh

# Firewall — pusti samo SSH i web
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable

# Swap 2 GB — sigurnosna mreža da FFmpeg ne ostane bez memorije
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## 4. Preuzmi i podesi aplikaciju

```bash
git clone https://github.com/sava2109/video-subtitle-app.git
cd video-subtitle-app
cp .env.example .env
nano .env
```

Popuni `.env` — **sva četiri reda su obavezna**:

```env
GROQ_API_KEY=gsk_tvoj_kljuc_sa_console.groq.com
SITE_PASSWORD=neka_tvoja_jaka_sifra
DOMAIN=titlovi.tvojdomen.com
PORT=3001
```

Sačuvaj sa `Ctrl+O`, `Enter`, pa `Ctrl+X`.

> **Bez `SITE_PASSWORD` server odbija da se pokrene** — namerno, da sajt
> nikad ne ostane otvoren za sve.

---

## 5. Pokreni

```bash
docker compose up -d --build
```

Prva izgradnja traje 3-5 minuta. Kad završi, otvori u pregledaču:

```
https://tvoj-domen
```

Unesi šifru iz `SITE_PASSWORD` i aplikacija je spremna.

---

## Svakodnevno korišćenje

| Šta hoćeš | Komanda |
|---|---|
| Vidi da li radi | `docker compose ps` |
| Pogledaj logove | `docker compose logs -f app` |
| Preuzmi nove izmene sa GitHub-a | `git pull && docker compose up -d --build` |
| Restartuj | `docker compose restart` |
| Zaustavi | `docker compose down` |
| Promeni šifru ili ključ | `nano .env` pa `docker compose up -d` |

Uploadovani i izvezeni snimci stoje u `uploads/` i `exports/` na serveru i
**preživljavaju restart i nadogradnju** (vezani su za disk servera).

---

## Održavanje

**Prostor na disku.** Video fajlovi se brzo gomilaju. Provera:

```bash
df -h /
du -sh uploads exports
```

Brisanje svega starijeg od 30 dana (može i u `cron`):

```bash
find uploads exports -type f -mtime +30 -delete
```

**Bezbednosne zakrpe sistema:**

```bash
apt update && apt upgrade -y
```

---

## Rešavanje problema

**Sajt se ne otvara / nema HTTPS**
Proveri da `A` zapis domena pokazuje na IP servera i da su portovi 80 i 443
otvoreni. Zatim: `docker compose logs caddy`

**Server neće da se pokrene**
Skoro uvek nedostaje `SITE_PASSWORD` u `.env`. Proveri: `docker compose logs app`

**Titlovi su demo tekst umesto pravog prepisa**
Nije postavljen `GROQ_API_KEY`. Uzmi besplatan ključ na
<https://console.groq.com> i upiši ga u `.env`, pa `docker compose up -d`.

**Izvoz puca na dugim snimcima**
Nema dovoljno memorije. Proveri da je swap uključen (`free -h`) ili
pređi na jači plan (CX32).

---

## Napomena o bezbednosti

Zaštita je jedna zajednička šifra za sve korisnike — dovoljno za deljenje
sa nekoliko poznatih ljudi, ali nije pravi sistem naloga. Ne stavljaj na
sajt poverljive snimke i **nikad ne commituj `.env`** (već je u
`.gitignore`).
