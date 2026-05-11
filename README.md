# TalkTranslate

Chat con traducción automática en tiempo real. Habla en tu idioma, el otro recibe el mensaje traducido al suyo.

## ✨ Características

- 💬 **Chat en vivo** con traducción automática
- 🌍 **6 idiomas**: Español, Inglés, Portugués, Francés, Alemán, Japonés
- 🎨 **Modo oscuro / claro**
- ⚡ **Traducción instantánea** vía MyMemory API
- 🔒 **Salas privadas** — compartes el ID y solo ellos entran
- 📱 **Responsive** — funciona en PC y móvil

## 🚀 Cómo usar

1. Abre la app en [talktranslate.onrender.com](https://talktranslate.onrender.com)
2. Escribe tu nombre y selecciona idiomas
3. **Crear sala** → compartes el ID con quien quieras hablar
4. **Unirse** → pegas el ID que te compartieron
5. ¡A chatear!

## 🛠️ Tecnologías

| Frontend | Backend | APIs |
|----------|---------|------|
| HTML/CSS/JS vanilla | Node.js + Express | MyMemory Translation |
| Socket.IO (WebSockets) | Socket.IO | - |

## 📦 Correr localmente

```bash
# Clonar
git clone https://github.com/SamuelCubano/talktranslate.git
cd talktranslate/server

# Instalar dependencias
npm install

# Iniciar servidor
node server.js

# Abrir http://localhost:3000
```

## ☁️ Deploy en Render

1. Crea un Web Service en [render.com](https://render.com)
2. Conecta tu repo de GitHub
3. Configura:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. Listo 🎉

## 📄 Licencia

MIT
