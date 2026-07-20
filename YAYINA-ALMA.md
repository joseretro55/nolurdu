# Yayına alma

Bu klasör Vercel üzerinde doğrudan yayımlanabilecek şekilde hazırlanmıştır. `api/live.js` canlı TCMB ve metal fiyatlarını sunucu tarafında birleştirir; API anahtarı gerekmez.

1. `outputs` klasörünü yeni bir GitHub deposuna yükleyin.
2. Vercel'de **New Project** ile depoyu seçin.
3. Framework seçimini **Other**, kök dizini de deponun kökü olarak bırakın.
4. Yayın tamamlanınca Vercel projesindeki **Domains** alanından alan adınızı bağlayın.

Canlı veri uç noktası: `/api/live`

Önbellek süresi 15 dakikadır. TCMB hafta sonu ve tatillerde son iş günü bültenini döndürür. Haricî servis geçici olarak çalışmazsa arayüz yerel son veriye geri döner.
