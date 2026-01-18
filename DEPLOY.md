# Video Subtitle App - Deployment na Render.com

## Koraci za deployment

### 1. Priprema GitHub repozitorijuma

```bash
# Inicijalizuj git ako već nije
git init

# Dodaj sve fajlove
git add .

# Commit
git commit -m "Initial commit - Video Subtitle App"

# Kreiraj repo na GitHub i povezi
git remote add origin https://github.com/TVOJ_USERNAME/video-subtitle-app.git
git branch -M main
git push -u origin main
```

### 2. Deploy na Render.com

1. Idi na https://render.com i napravi nalog (besplatno)
2. Klikni "New +" → "Web Service"
3. Poveži sa GitHub nalogom
4. Izaberi `video-subtitle-app` repozitorijum
5. Podesi:
   - **Name**: video-subtitle-app
   - **Region**: Frankfurt (EU Central)
   - **Branch**: main
   - **Build Command**: `npm install && npm run build:all`
   - **Start Command**: `npm start`
   - **Plan**: Free

6. Dodaj Environment Variables:
   - `SITE_PASSWORD` = `DeteSava`
   - `OPENAI_API_KEY` = tvoj OpenAI API ključ
   - `NODE_ENV` = `production`

7. Klikni "Create Web Service"

### 3. Pristup aplikaciji

- URL će biti: `https://video-subtitle-app.onrender.com`
- Šifra za pristup: `DeteSava`

### Napomene

- Free tier na Render.com ima ograničenja:
  - Server se "uspava" posle 15 minuta neaktivnosti
  - Prvi pristup posle uspavljivanja može trajati 30-60 sekundi
  - 750 sati mesečno (dovoljno za stalno pokretanje)
  - 512MB RAM

- Za video processing, možda ćeš morati na plaćeni plan ako su video fajlovi veliki
