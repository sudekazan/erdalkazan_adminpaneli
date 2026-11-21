#!/usr/bin/env bash
# Yayından sonra sunucuda (deploy kullanıcısıyla) çalışır ve sitenin durumunu özetler.
# Repo herkese açık olduğu için yayın kayıtlarını herkes görebilir: bu betik
# hiçbir ayar değeri, adres veya şifre yazdırmaz; yalnızca var/yok bilgisi verir.
# Site sağlıklı başlamazsa hata koduyla biter ve yayın kırmızı görünür.
set -u

cd "${SUNUCU_DIR:-/srv/sunucu}" || { echo "::error::Sunucu klasörü bulunamadı"; exit 1; }

cid=$(docker compose ps -q erdalkazan)
if [ -z "$cid" ]; then
  echo "::error::erdalkazan kapsayıcısı çalışmıyor"
  exit 1
fi

# Sağlık kontrolü (/healthz): en fazla 2 dakika bekle
status=""
for _ in $(seq 1 24); do
  status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}tanımsız{{end}}' "$cid")
  case "$status" in healthy|unhealthy|tanımsız) break ;; esac
  sleep 5
done
echo "Sağlık durumu: $status"

# Zorunlu ayarlar: yalnızca eksik olanların ADI yazılır
# shellcheck disable=SC2016  # $v kapsayıcının içinde açılmalı
missing=$(docker exec "$cid" sh -c 'for v in MONGO_URI ADMIN_PASSWORD JWT_SECRET CLOUDINARY_CLOUD_NAME CLOUDINARY_API_KEY CLOUDINARY_API_SECRET; do [ -n "$(printenv "$v")" ] || printf "%s " "$v"; done')
if [ -n "$missing" ]; then
  echo "::warning::Eksik ayarlar: $missing"
else
  echo "Zorunlu ayarların hepsi tanımlı"
fi

# shellcheck disable=SC2016
if docker exec "$cid" sh -c '[ -n "${TRUST_PROXY:-}" ]'; then trust="tanımlı"; else trust="tanımlı değil"; fi
echo "TRUST_PROXY: $trust"

# Önünde ters proxy (HTTPS sağlayan ara sunucu) var mı?
proxy="yok"
if docker ps --format '{{.Image}}' | grep -Eiq 'caddy|nginx|traefik|haproxy'; then proxy="var"; fi
for s in nginx caddy apache2 haproxy traefik; do
  if systemctl is-active --quiet "$s" 2>/dev/null; then proxy="var"; fi
done
echo "Ters proxy: $proxy"

port=$(docker port "$cid" 3000/tcp 2>/dev/null || true)
case "$port" in
  "") echo "3000 portu: dışarıya açılmamış (yalnızca Docker ağı)" ;;
  *127.0.0.1*|*"[::1]"*) echo "3000 portu: yalnızca sunucunun kendisinden erişilebilir" ;;
  *) echo "3000 portu: internetten doğrudan erişilebilir" ;;
esac

if [ "$proxy" = "var" ] && [ "$trust" = "tanımlı değil" ]; then
  echo "::warning::Ters proxy var ama TRUST_PROXY tanımlı değil: giriş deneme sınırı tüm ziyaretçileri tek kişi sayar. Ayarlara TRUST_PROXY=1 eklenmeli."
fi

# Uygulamanın açılış mesajlarından yalnızca bilinen, zararsız satırlar
docker logs --tail 50 "$cid" 2>&1 \
  | grep -E '^(MongoDB bağlantısı kuruldu|Sunucu çalışıyor|UYARI: Şu ortam değişkenleri)' \
  | sed -E 's#https?://[^ ]+#(adres gizlendi)#g' \
  | tail -5

if [ "$status" != "healthy" ]; then
  echo "::error::Site sağlıklı başlamadı (durum: $status)"
  exit 1
fi
