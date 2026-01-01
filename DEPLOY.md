# Deployment (minimal production)

Este guia mostra como disponibilizar o BedFlow na internet com o minimo aceitavel de seguranca **sem custos adicionais**. Assume um servidor Ubuntu/Debian com acesso root e um dominio apontado para o IP publico.

## 1. Variáveis de ambiente

Servidor (`server/.env`):

```
DATABASE_URL="file:./prisma/bedflow.db"
JWT_SECRET="altere_para_um_valor_unico"
JWT_EXPIRES="2h"
PORT=1893
HOST=0.0.0.0
CORS_ORIGIN="https://app.seuhospital.pt,https://api.seuhospital.pt"
```

Frontend (`client/.env.production`):

```
VITE_API_BASE=https://api.seuhospital.pt
```

## 2. Construir artefactos

```bash
# Backend
cd ~/bedflow/server
npm install
npm run build

# Frontend
cd ../client
npm install
VITE_API_BASE=https://api.seuhospital.pt npm run build
```

O frontend gerado em `client/dist` pode ser copiado para `/var/www/bedflow`.

## 3. Serviço do backend (systemd)

`/etc/systemd/system/bedflow.service`

```
[Unit]
Description=BedFlow API
After=network.target

[Service]
WorkingDirectory=/opt/bedflow/server
Environment=NODE_ENV=production
EnvironmentFile=/opt/bedflow/server/.env
ExecStart=/usr/bin/node dist/src/main.js
Restart=on-failure
User=bedflow
Group=bedflow

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bedflow
```

## 4. Reverse proxy + TLS gratuito

### Instalar Nginx e Certbot

```bash
sudo apt update && sudo apt install nginx certbot python3-certbot-nginx
```

### Configuracao base `/etc/nginx/sites-available/bedflow`

```
server {
  listen 80;
  server_name app.seuhospital.pt api.seuhospital.pt;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name app.seuhospital.pt;

  ssl_certificate /etc/letsencrypt/live/app.seuhospital.pt/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/app.seuhospital.pt/privkey.pem;

  root /var/www/bedflow;
  index index.html;

  location / {
    try_files $uri /index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:1893/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 443 ssl http2;
  server_name api.seuhospital.pt;

  ssl_certificate /etc/letsencrypt/live/api.seuhospital.pt/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.seuhospital.pt/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:1893/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Ativar site e certificados:

```bash
sudo ln -s /etc/nginx/sites-available/bedflow /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.seuhospital.pt -d api.seuhospital.pt
```

Certbot renova automaticamente (ver `systemctl status certbot.timer`).

## 5. Testes finais

1. Verificar API: `curl -I https://api.seuhospital.pt/auth/login` deve retornar 405/401.
2. Abrir `https://app.seuhospital.pt` no browser e confirmar carregamento.
3. Validar WebSocket inexistente e CORS: o header `Access-Control-Allow-Origin` deve mostrar o domínio configurado.

## 6. Boas práticas extra (opcional)

- Utilizar `pm2` ou `systemd` para reiniciar automaticamente em caso de falha.
- Ativar firewall (UFW) permitindo apenas 22/80/443.
- Criar backup periodico do ficheiro `server/prisma/bedflow.db`.
- Substituir SQLite por Postgres/MySQL antes de ir para produção definitiva.

> **Atenção:** mesmo com estes passos, contas e passwords fortes continuam obrigatórios. Nunca exponha o serviço com utilizadores padrão sem trocar a `JWT_SECRET`.
