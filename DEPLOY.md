# 🚀 Guía de Lanzamiento — APIForge

## Opción 1: Railway (RECOMENDADO — Gratis para empezar)

### Paso 1: Crear cuenta
1. Ve a https://railway.app
2. Regístrate con GitHub

### Paso 2: Deploy
1. Click **"New Project"**
2. Selecciona **"Deploy from GitHub Repo"**
3. Busca y selecciona: `kepabilbao67-bot/api-generate.js`
4. Railway auto-detecta Node.js y hace deploy

### Paso 3: Variables de entorno
En el panel de Railway, ve a **Variables** y añade:

```
NODE_ENV=production
PORT=3000
JWT_SECRET=genera-un-string-random-de-64-caracteres-aqui
OWNER_EMAILS=tu-email-real@gmail.com
BASE_URL=https://tu-app.railway.app
SITE_NAME=APIForge
SITE_URL=https://tu-app.railway.app
```

Para generar JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Paso 4: Dominio personalizado (opcional)
1. En Railway → Settings → Domains
2. Añade tu dominio (ej: `apiforge.io`)
3. Configura DNS: CNAME → tu-app.railway.app

### Paso 5: Stripe (para cobrar)
1. Crea cuenta en https://stripe.com
2. Obtén las keys en Developers → API Keys
3. Añade a variables de Railway:
```
STRIPE_SECRET_KEY=sk_live_xxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx
```

---

## Opción 2: Render (Alternativa gratuita)

1. Ve a https://render.com
2. New → Web Service → Connect GitHub
3. Selecciona el repo
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Añade variables de entorno (igual que Railway)

---

## Opción 3: VPS (DigitalOcean $4/mes)

```bash
# En tu VPS (Ubuntu)
sudo apt update && sudo apt install -y nodejs npm
git clone https://github.com/kepabilbao67-bot/api-generate.js.git
cd api-generate.js
npm install
cp .env.example .env
nano .env  # Editar con tus valores reales

# Instalar PM2 para mantener el server activo
npm install -g pm2
pm2 start src/server.js --name apiforge
pm2 startup
pm2 save

# Nginx reverse proxy (para dominio)
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/apiforge
```

Nginx config:
```nginx
server {
    listen 80;
    server_name apiforge.io www.apiforge.io;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/apiforge /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

# SSL con Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d apiforge.io -d www.apiforge.io
```

---

## Opción 4: Docker

```bash
docker-compose up -d
```

---

## Post-Deploy Checklist

- [ ] Verificar /health responde 200
- [ ] Registrar tu cuenta (primer usuario = owner)
- [ ] Crear una API de prueba (POST /api/v1/quick/tasks)
- [ ] Verificar que funciona el CRUD
- [ ] Probar login/register en /login.html
- [ ] Verificar /docs.html carga correctamente
- [ ] Conectar Stripe (si quieres cobrar)
- [ ] Configurar dominio personalizado
- [ ] Correr `npm run seed` para datos demo
