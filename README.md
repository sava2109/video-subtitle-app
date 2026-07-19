# 🎬 Видео Титловање - Апликација за ћириличне титлове

## 📋 О апликацији
Web апликација за аутоматско генерисање титлова на српском језику у **ћирилици**. 
Уплоадујте видео, добијте титлове, уредите их и експортујте видео са уграђеним титловима.

## ✨ Функционалности
- **📤 Upload видеа** - Подржани формати: MP4, AVI, MOV, MKV, WebM (до 500MB)
- **🎤 Аутоматска транскрипција** - Groq Whisper (БЕСПЛАТНО) или OpenAI Whisper
- **📥 Увоз SRT** - Увезите титлове из било ког бесплатног алата
- **🔄 Латиница → Ћирилица** - Аутоматска конверзија текста
- **✏️ Едитовање титлова** - Ручно уређивање текста и временских ознака
- **🗣️ Цео говор** - Панел са комплетним текстом (један ред = један титл)
- **➕ Убацивање титла** - Паузирај снимак, кликни ➕ и титл се убацује на том
  месту, а сви каснији титлови се померају за трајање новог
- **👁️ Преглед = Извоз (WYSIWYG)** - Оно што видиш у прегледу (величина фонта,
  позиција, преламање у макс. 2 реда, исечен формат) је тачно оно што се извезе
- **📥 Експорт** - Видео са уграђеним титловима или SRT/VTT фајлови

## 📂 Где се налазе експортовани снимци?
Сви извезени снимци се чувају у фолдеру **`exports/`** унутар пројекта:
```
C:\Users\Dimitrijevic\video-subtitle-app\exports\
```
Име фајла садржи оригинално име видеа, формат и време извоза, нпр.
`Moj_snimak_9x16_20260712_143000.mp4`. Путања се приказује и у апликацији
после сваког експорта.

## 🆓 Бесплатна транскрипција (Groq)
Не морате да плаћате OpenAI — направите бесплатан налог на
[console.groq.com](https://console.groq.com), генеришите API кључ и додајте
га у `.env` као `GROQ_API_KEY=...`. Groq користи Whisper large-v3 модел
(бољи од whisper-1) и бесплатан је за оволике количине.

Алтернативно, титлове можете направити у било ком бесплатном алату који
извози SRT и увести их дугметом **📥 Увези SRT** (аутоматски се пребацују
у ћирилицу).

## 🚀 Покретање апликације

### Предуслови
- Node.js 18+
- FFmpeg (инсталира се аутоматски преко ffmpeg-static)
- OpenAI API кључ (за аутоматску транскрипцију)

### Инсталација

```bash
# 1. Клонирај репозиторијум
git clone <repo-url>
cd video-subtitle-app

# 2. Инсталирај backend dependencies
npm install

# 3. Инсталирај frontend dependencies
cd client
npm install
cd ..

# 4. Креирај .env фајл
cp .env.example .env
# Уреди .env и додај свој OPENAI_API_KEY
```

### Покретање

```bash
# Покрени backend (порт 3001)
npm run dev

# У другом терминалу, покрени frontend (порт 3000)
cd client
npm start
```

Отвори http://localhost:3000 у прегледачу.

## 📁 Структура пројекта

```
video-subtitle-app/
├── src/                    # Backend (Node.js + Express)
│   ├── app.ts              # Главни entry point
│   ├── config/             # Конфигурација
│   ├── controllers/        # API контролери
│   ├── routes/             # API руте
│   ├── services/           # Бизнис логика
│   │   ├── speechToTextService.ts    # Транскрипција (Whisper)
│   │   ├── videoProcessingService.ts # FFmpeg обрада
│   │   └── subtitleService.ts        # Управљање титловима
│   ├── utils/              # Помоћне функције
│   │   ├── latinToCyrillic.ts        # Конверзија писма
│   │   └── srtParser.ts              # SRT/VTT парсирање
│   └── types/              # TypeScript типови
├── client/                 # Frontend (React)
│   └── src/
│       ├── components/     # React компоненте
│       ├── pages/          # Странице
│       ├── hooks/          # Custom hooks
│       └── services/       # API сервиси
├── uploads/                # Уплоадовани видеи
├── exports/                # Експортовани видеи
└── package.json
```

## 🔧 Конфигурација

Креирај `.env` фајл:

```env
# OpenAI API кључ (потребан за транскрипцију)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx

# Порт за backend
PORT=3001
```

### Без API кључа
Апликација ради и без OpenAI кључа - у том случају користи демо титлове за тестирање.

## 🎯 Како користити

1. **Upload** - Превуци видео на upload зону или кликни да изабереш фајл
2. **Генериши титлове** - Кликни "Генериши Титлове" да покренеш транскрипцију
3. **Уреди** - Исправи грешке у титловима ако их има
4. **Сачувај** - Сачувај измене
5. **Експортуј** - Преузми видео са уграђеним титловима или само SRT фајл

## 🛠 Технологије

| Компонента | Технологија |
|------------|-------------|
| Backend | Node.js, Express, TypeScript |
| Frontend | React 18, TypeScript |
| Транскрипција | OpenAI Whisper API |
| Видео обрада | FFmpeg |
| Стилови | CSS-in-JS |

## 📝 API ендпоинти

```
POST /api/videos/upload          - Upload видеа
GET  /api/videos                 - Листа свих видеа
GET  /api/videos/:id             - Детаљи видеа
POST /api/videos/:id/transcribe  - Генериши титлове
POST /api/videos/:id/export      - Експортуј видео

GET  /api/subtitles/:videoId     - Добави титлове
PUT  /api/subtitles/:videoId     - Ажурирај титлове
GET  /api/subtitles/:videoId/download/srt  - Преузми SRT
GET  /api/subtitles/:videoId/download/vtt  - Преузми VTT
```

## 🤝 Допринос
Слободно отворите issue или пошаљите pull request за побољшања.

## 📄 Лиценца
MIT
This project is licensed under the MIT License. See the LICENSE file for details.