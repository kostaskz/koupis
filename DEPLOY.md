# Οδηγίες Ανάπτυξης — KOUPIS P&L

## Επιλογή 1: Railway (Δωρεάν, Πιο Εύκολο)

1. Πήγαινε στο https://railway.app και κάνε λογαριασμό με GitHub
2. Πάτα "New Project" → "Deploy from GitHub repo"
3. Ανέβασε τον κώδικα στο GitHub πρώτα:
   ```bash
   git init
   git add .
   git commit -m "initial"
   git push
   ```
4. Το Railway θα ανιχνεύσει αυτόματα Node.js και θα τρέξει `npm start`
5. Θα σου δώσει URL τύπου: `https://koupis-xxx.railway.app`
6. Αυτό το URL ανοίγεις από iPhone για "Add to Home Screen"

---

## Επιλογή 2: Hetzner VPS (€4/μήνα, Πιο Σταθερό)

### Α. Αγορά VPS
- Πήγαινε: https://www.hetzner.com/cloud
- Επίλεξε: CX11 (€3.79/μήνα), Ubuntu 22.04

### Β. Σύνδεση & Εγκατάσταση
```bash
# Σύνδεση στο VPS
ssh root@<IP_ΤΟΥ_SERVER>

# Εγκατάσταση Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Εγκατάσταση PM2 (για να τρέχει πάντα)
npm install -g pm2
```

### Γ. Ανέβασμα κώδικα
```bash
# Στον VPS
mkdir /opt/koupis
cd /opt/koupis

# Αντιγραφή αρχείων (από τον υπολογιστή σου)
# scp -r ./koupis-sqlite-v6/* root@<IP>:/opt/koupis/

npm install
node db/init.js
pm2 start server.js --name koupis
pm2 save
pm2 startup
```

### Δ. HTTPS με Nginx + Let's Encrypt
```bash
apt-get install -y nginx certbot python3-certbot-nginx

# Δημιουργία config
cat > /etc/nginx/sites-available/koupis << 'EOF'
server {
    server_name koupis.yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -s /etc/nginx/sites-available/koupis /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Δωρεάν SSL
certbot --nginx -d koupis.yourdomain.com
```

---

## Εγκατάσταση στο iPhone (για όλους τους χρήστες)

1. Άνοιξε **Safari** (όχι Chrome)
2. Πήγαινε στο URL της εφαρμογής
3. Πάτα το κουμπί **Share** (το τετράγωνο με βελάκι στο κάτω μέρος)
4. Σκρόλαρε κάτω και πάτα **"Add to Home Screen"**
5. Δώσε όνομα "Koupis P&L" και πάτα **Add**
6. Η εφαρμογή εμφανίζεται στην αρχική οθόνη σαν κανονικό app!

---

## Σημειώσεις

- Το PWA λειτουργεί **μόνο με HTTPS** (απαίτηση Safari)
- Τα API calls πάνε πάντα στο network (δεν γίνονται cache)
- Τα static αρχεία (CSS/JS) γίνονται cache για γρήγορο άνοιγμα
