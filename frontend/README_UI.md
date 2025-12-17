# DoluMu - İstanbul Toplu Taşıma Doluluk Tahmin Platformu

**DoluMu**, İstanbul'daki toplu taşıma hatlarının yoğunluğunu 24 saat önceden tahmin eden, yapay zeka destekli bir web uygulamasıdır. Yola çıkmadan önce otobüsünüzün, metronuzun veya vapurunuzun ne kadar kalabalık olacağını öğrenebilir, yolculuğunuzu daha konforlu planlayabilirsiniz.

---

## 🎯 Neler Sunuyor?

### 1. **Gerçek Zamanlı Yoğunluk Tahminleri**
- **24 Saat Önceden Tahmin**: Herhangi bir hat için bugünün ve yarının her saatine ait yoğunluk tahminlerini görüntüleyin
- **Anlaşılır Yoğunluk Seviyeleri**: "Düşük", "Orta", "Yüksek", "Çok Yüksek" şeklinde renklerle kodlanmış görsel göstergeler
- **Doluluk Yüzdesi**: Her saat için tahmini doluluk oranını (% olarak) ve yolcu sayısını görün
- **Akıllı Tahminler**: Geçmiş yolcu verileri, hava durumu ve takvim özelliklerini birleştiren makine öğrenmesi modeli

### 2. **İnteraktif Harita Deneyimi**
- **Canlı Hat Görselleştirme**: 
  - Otobüs hatları için başlangıç-bitiş durakları ve güzergah polyline'ları
- **Konum Bazlı Hizmetler**: 
  - Mevcut konumunuzu haritada görün
  - Size yakın hatları kolayca bulun
- **Gelişmiş Harita Özellikleri**:
  - Pürüzsüz yakınlaştırma ve kaydırma
  - Metro istasyonları için olanaklar bilgisi (asansör, yürüyen merdiven, WC)
  - Renkli hat göstergeleri ve durak işaretleyicileri

### 3. **Sefer Bilgileri ve Planlama**
- **Gerçek Zamanlı Sefer Saatleri**:
  - Metro İstanbul API entegrasyonu ile canlı sefer bilgileri
  - Sonraki 5 seferin dakika bazında bilgisi
  - "Peronda" ve "X dakika içinde" gibi anlık bildirimler
- **Tam Sefer Programı**:
  - Günlük ilk ve son sefer saatleri
  - Yön bazlı sefer bilgileri (Gidiş/Dönüş)
  - Hizmet dışı saatler için bilgilendirme
- **Servis Saati Takibi**: Hat hizmet saatleri dışındayken otomatik uyarı

### 4. **Favoriler Sistemi**
- **Hızlı Erişim**: Sık kullandığınız hatları favorilere ekleyin
- **Favori Hat Kartları**: 
  - Her favori hat için mevcut doluluk durumunu gösterir
  - Anlık yolcu sayısı ve yoğunluk göstergeleri
  - Tek dokunuşla detaylı bilgiye erişim
- **Kalıcı Kayıt**: Favorileriniz tarayıcınızda saklanır

### 5. **Çok Dilli Destek**
- **Türkçe ve İngilizce**: Tam lokalizasyon desteği
- **Akıllı Dil Algılama**: Tarayıcı dilinize göre otomatik dil seçimi
- **Kolay Dil Değiştirme**: Ayarlar sayfasından tek tıkla dil değiştirin

### 6. **Progresif Web App (PWA)**
- **Ana Ekrana Ekleme**: Uygulamayı telefonunuzun ana ekranına ekleyerek native uygulama gibi kullanın
- **Çevrimdışı Destek**: Temel özellikler internetsiz çalışır
- **Hızlı Yükleme**: Service worker ile optimize edilmiş performans
- **Platformlar Arası**: iOS, Android ve masaüstü destekli

---

## 🚀 Nasıl Çalışıyor?

### Ana Sayfa: Harita ve Arama

**Başlangıç ekranında sizi karşılayan:**
- **Üst Çubuk**: 
  - Akıllı arama çubuğu (hat kodu veya açıklamaya göre arama)
  - **Trafik Yoğunluğu Widget'ı**: İstanbul geneli trafik yoğunluğu endeksi (%0-100)
  - **Hava Durumu Widget'ı**: Anlık sıcaklık ve 6 saatlik tahmin
  - Dil değiştirici
- **Harita Görünümü**: 
  - İstanbul haritası üzerinde tüm toplu taşıma hatları
  - Metro hatları otomatik renklendirilmiş ve istasyonlarla gösterilmiş
  - Otobüs/vapur hatları için arama sonrası güzergah gösterimi
- **Alt Navigasyon**: 
  - Harita, Favoriler, Ayarlar bölümleri arası hızlı geçiş

**Arama Deneyimi:**
1. Arama çubuğuna hat kodu yazın (örn: "M2", "500T", "15F")
2. Arama sonuçları anlık olarak filtrelenir
3. Her sonuçta:
   - Hat kodu (bold ve renkli)
   - Taşıt türü etiketi (Otobüs/Metro/Vapur)
   - Hat açıklaması (arama terimleri vurgulanmış)
4. Bir hata tıklayın, harita o hattı gösterecek şekilde güncellenir

### Hat Detay Paneli: Bilginin Merkezi

**Bir hat seçtiğinizde açılan akıllı panel:**

#### Mobil Görünüm:
- **Aşağıdan Yukarı Açılan Panel** (Bottom Sheet):
  - Yukarı kaydırarak genişletin
  - Aşağı kaydırarak küçültün
  - Kapatma butonu sağ üstte

#### Masaüstü Görünüm:
- **Sürüklenebilir Modal**: 
  - Ekranda istediğiniz yere sürükleyin
  - Köşeden boyutlandırın
  - "Konumu Sıfırla" butonuyla başlangıç pozisyonuna dönün
- **Minimize/Maksimize**: Küçük başlık çubuğu modunda çalışın

#### Panel İçeriği:

**1. Başlık Bölümü**
- Hat kodu ve adı
- Anlık doluluk yüzdesi rozeti
- Favori ekleme/çıkarma butonu
- Yön seçici (Gidiş/Dönüş) veya istasyon seçici (Metro için)

**2. Yoğunluk Kartı** (Ana Bilgi Kartı)
- **Seçili Saat Göstergesi**: "Tahmini Yoğunluk - 14:00"
- **Yoğunluk Seviyesi**: Büyük, renkli yazı ile ("Orta Yoğunluk")
- **Doluluk Çubuğu**: Yüzde bazlı görsel progress bar
- **Detaylı İstatistikler**:
  - Tahmini yolcu sayısı (örn: "1,234 kişi")
  - Maksimum kapasite (tooltip ile açıklama)
- **Zaman Kaydırıcı**: 0-23 arası saat seçimi için slider
  - Mevcut saat varsayılan olarak seçili
  - Kaydırdıkça tüm veriler güncellenir

**3. Sefer Bilgileri Kartı**
- **Sonraki 3-5 Sefer**: Anlık yaklaşma süreleri
- **"Tüm Seferleri Görüntüle"** butonu
- **Modal Açılımı**:
  - Tam günlük sefer programı
  - İlk ve son sefer saatleri
  - Metro için istasyon ve yön seçenekleri

**4. 24 Saatlik Grafik**
- **İnteraktif Çizgi Grafik** (Recharts ile):
  - Her saat için tahmini yolcu sayısı
  - Renkli alan dolgusu (yoğunluğa göre)
  - Hover ile detaylı bilgi gösterimi
- **Hizmet Saatleri Gösterimi**: 
  - Gri çubuklar sefer olmayan saatleri gösterir
  - Tooltipte "Sefer yok" uyarısı

**5. Durum Banner'ları** (Aktif olduğunda)
- **Uyarı Banner'ı**: Hat kesintileri ve duyurular için
- **Hizmet Dışı Banner'ı**: Hat şu an çalışmıyorsa
- Tıklanabilir - detaylı bilgi için modal açılır

### Favoriler Sayfası

**Kayıtlı hatlarınızı tek ekranda yönetin:**

- **Favori Hat Kartları**:
  - Her kart bir mini özet sunar
  - Mevcut saat için doluluk göstergesi
  - Yolcu sayısı ve doluluk yüzdesi
  - Hat bilgileri (kod, ad, tür)
  - Tıklayarak tam detay paneline geçiş
- **Boş Durum**:
  - Henüz favori yoksa yönlendirme kartı
  - "Hatlara Git" butonu ile haritaya yönlendirme
  - Nasıl favori ekleneceği adım adım açıklama

### Ayarlar Sayfası

**Uygulamayı kişiselleştirin:**

- **Dil Seçimi**: Türkçe ↔ İngilizce geçiş
- **PWA Yükleme**: Ana ekrana ekleme rehberi
  - iOS Safari/Chrome için özel talimatlar
  - Animasyonlu adım adım görseller
- **Veri Yönetimi**:
  - Favorileri temizle (onay modalı ile)
  - Uygulamayı sıfırla (tüm cache temizlenir)
- **Geri Bildirim Formu**:
  - Hata raporlama
  - Veri hatası bildirimi
  - Özellik istekleri
  - E-posta ile takip (opsiyonel)

---

## 🎨 Tasarım ve Kullanıcı Deneyimi

### Görsel Kimlik
- **Koyu Tema**: Modern, göz yormayan slate-gray renk paleti
- **Neon Vurgular**: Mor-amber gradyanlar ve parlak renkli aksan renkleri
- **Glassmorphism**: Şeffaf arka planlar ve backdrop blur efektleri
- **Yumuşak Köşeler**: 2xl border-radius ile dostça görünüm

### Renk Sistemi
- **Yoğunluk Renkleri**:
  - 🟢 Yeşil: Düşük yoğunluk
  - 🟡 Sarı: Orta yoğunluk
  - 🟠 Turuncu: Yüksek yoğunluk
  - 🔴 Kırmızı: Çok yüksek yoğunluk
  - ⚫ Gri: Hizmet dışı / Bilinmiyor
- **Hat Türü Renkleri**:
  - Metro: Mavi tonları
  - Otobüs: Yeşil-amber
  - Vapur: Cyan-mavi

### Animasyonlar ve İnteraksiyonlar
- **Framer Motion** ile:
  - Panel açılma/kapanma animasyonları
  - Sayfa geçiş efektleri
  - Sürükle-bırak etkileşimleri
- **Haptic Feedback**: Mobil cihazlarda titreşim geri bildirimi
- **Skeleton Loaders**: Veri yüklenirken placeholder gösterimi
- **Smooth Scrolling**: Tüm listelerde özel scrollbar stilleri

### Erişilebilirlik
- **Semantic HTML**: Proper heading hierarchy
- **ARIA Labels**: Ekran okuyucu desteği
- **Keyboard Navigation**: Tab tuşu ile gezinme
- **Yüksek Kontrast**: WCAG standartlarına uygun renk oranları
- **Loading States**: `aria-busy` ve `sr-only` kullanımı

### Responsive Tasarım
- **Mobil Öncelikli**: Tüm özellikler dokunmatik optimizasyonlu
- **Tablet Desteği**: Orta ekranlar için özel layout'lar
- **Masaüstü**: Geniş ekranlarda çoklu panel görünümü
- **Dinamik Viewport**: 100dvh kullanımı ile tam ekran deneyim

---

## 🏗️ Teknik Altyapı

### Framework ve Kütüphaneler
- **Next.js 16** (App Router): Modern React framework
- **React 19**: Latest stable React version
- **next-intl 4.5.5**: Uluslararasılaştırma
- **Zustand**: Hafif state management
- **Tailwind CSS**: Utility-first CSS framework
- **Framer Motion**: Animasyonlar
- **React Leaflet**: İnteraktif haritalar
- **Recharts**: Grafik ve data visualization
- **Axios**: HTTP client
- **date-fns**: Tarih manipülasyonu

### State Management (Zustand Store)
```javascript
{
  selectedLine: null,          // Seçili hat objesi
  isPanelOpen: false,          // Detay paneli açık mı?
  isPanelMinimized: false,     // Panel minimize mi?
  selectedHour: 14,            // Seçili saat (0-23)
  userLocation: [41.0, 28.9],  // GPS koordinatları
  favorites: ['M2', '500T'],   // Favori hat kodları
  selectedDirection: 'G',      // 'G' (Gidiş) veya 'D' (Dönüş)
  showRoute: true,             // Haritada güzergah göster
  metroSelection: {            // Metro seçimleri
    lineCode: 'M2',
    stationId: 123,
    directionId: 1
  }
}
```

### API Entegrasyonu
- **Backend**: FastAPI (Python)
- **Base URL**: `https://ibb-transport.onthewifi.com/api`
- **Endpoints**:
  - `GET /lines/search?query={query}`: Hat arama
  - `GET /forecast/{lineCode}?target_date={date}&direction={dir}`: 24 saatlik tahmin
  - `GET /lines/{lineCode}`: Hat metadata
  - `GET /lines/{lineCode}/status`: Hat durumu ve uyarılar
- **Metro API**: Metro İstanbul'un canlı sefer API'si
- **Hava Durumu**: Open-Meteo API entegrasyonu

### Veri Yapıları

**Forecast Response (24 saatlik):**
```json
[
  {
    "hour": 14,
    "predicted_value": 1234,
    "occupancy_pct": 67,
    "crowd_level": "High",
    "max_capacity": 1850,
    "in_service": true
  }
]
```

**Line Metadata:**
```json
{
  "line_name": "M2",
  "transport_type_id": 2,
  "road_type": "metro",
  "line": "Yenikapı - Hacıosman Metro Hattı"
}
```

### Performans Optimizasyonları
- **Debounced Search**: 300ms gecikme ile API çağrı azaltma
- **Lazy Loading**: Sayfalar ve bileşenler ihtiyaç anında yüklenir
- **Image Optimization**: Next.js Image component
- **Code Splitting**: Route-based automatic splitting
- **Service Worker**: PWA caching stratejileri
- **localStorage**: Favori bilgileri lokal saklanır

### Veri Yönetimi
- **Static Data**: 
  - `public/data/line_routes.json`: Hat güzergahları
  - `public/data/metro_topology.json`: Metro ağı yapısı
  - `public/data/stops_geometry.json`: Durak koordinatları
- **Cache Strategy**:
  - Metro sefer bilgileri: 30 saniye cache
  - Güzergah verileri: İlk yüklemede cache, reload'da refresh
  - Forecast: Her saat başı API çağrısı

### Özel Hook'lar
- `useDebounce`: Input debouncing
- `useGetTransportLabel`: i18n ile taşıt türü çevirisi
- `useMediaQuery`: Responsive breakpoint algılama
- `useMetroSchedule`: Metro sefer verisi yönetimi
- `useMetroTopology`: Metro ağ yapısı parsing
- `usePwaInstall`: PWA yükleme event yönetimi
- `useRoutePolyline`: Güzergah polyline'larını getir

---

## 📱 Kullanıcı Akışı Örnekleri

### Senaryo 1: Sabah İşe Giderken
1. Uygulamayı açıyorsunuz → Ana harita görünümü
2. Arama çubuğuna "M2" yazıyorsunuz
3. M2 Metro hattına tıklıyorsunuz
4. Panel açılıyor, saat 8:00 için:
   - **Çok Yüksek Yoğunluk** (%92 doluluk)
   - Tahmini 1,847 yolcu
5. Zaman kaydırıcısını 9:00'a çekiyorsunuz:
   - **Yüksek Yoğunluk** (%78 doluluk)
   - Tahmini 1,562 yolcu
6. Karar: 1 saat sonra daha rahat yolculuk
7. Yıldız butonuna basarak favorilere ekliyorsunuz

### Senaryo 2: Yeni Bir Semte Gidiyorsunuz
1. Haritada konum butonuna basıyorsunuz
2. GPS konumunuz haritada mavi nokta olarak görünüyor
3. Yakındaki "500T" otobüsünü arıyorsunuz
4. Panel açılıyor, güzergah haritada çiziliyor
5. Başlangıç ve bitiş durakları yeşil/kırmızı işaretli
6. Sefer bilgilerine bakıyorsunuz: "5 dk içinde"
7. 24 saatlik grafik: Akşam 18:00'da yoğunluk artıyor
8. Dönüş yolculuğunuzu bu bilgiye göre planlıyorsunuz

### Senaryo 3: Metro İstasyonunda Bekliyorsunuz
1. Favoriler sayfasını açıyorsunuz
2. Kayıtlı M4 hattınıza tıklıyorsunuz
3. İstasyon seçiciden "Kadıköy" seçiyorsunuz
4. Yön: "Tavşantepe" yönü
5. Canlı sefer bilgileri:
   - **2 dakika** içinde tren geliyor
   - Sonraki sefer: **7 dakika**
6. "Tüm Seferleri Görüntüle" → Günlük program açılıyor
7. Son sefer: 23:45 - Buna göre dönüş planı yapıyorsunuz

---

## 🌟 Öne Çıkan Özellikler

### 1. Akıllı Servis Saati Yönetimi
- Seçilen saat için hat hizmet vermiyorsa otomatik algılama
- "Sefer Yok" durumu için özel UI gösterimi
- İlk sefer saati bilgisi ile yönlendirme
- Grafikte gri çubuklar ile hizmet dışı saatleri gösterme

### 2. Çift Yönlü Hat Desteği
- Gidiş ve Dönüş yönleri için ayrı tahminler
- Her yön için farklı sefer saatleri
- Yön değiştirme ile anında veri güncelleme
- Direction-specific route polylines

### 3. Metro Özel Özellikleri
- **Tam Metro Ağı Görselleştirmesi**:
  - Tüm istasyonlar sıralı görünüm
  - İstasyon arası bağlantı çizgileri
  - Aktarma istasyonları vurgulaması
- **İstasyon Detayları**:
  - Olanak bilgileri (asansör, yürüyen merdiven)
  - Fonksiyonel kodlar
  - Sıra numarası (1. durak, 2. durak...)
- **Dinamik Hat Mantığı**:
  - M1 hattı için M1A ve M1B otomatik birleştirme
  - Yöne göre istasyon sıralaması ters çevirme

### 4. Veri Görselleştirme
- **Crowd Level Mapping**:
  - Yüzde bazlı doluluk → Yoğunluk seviyesi dönüşümü
  - Renk kodlaması ile hızlı algılama
  - Progress bar ile görsel orantı
- **24 Saatlik Grafik**:
  - Area chart ile trend gösterimi
  - Tooltip ile interaktif veri keşfi
  - Gradient fill ile estetik görünüm

### 5. Hata Yönetimi ve Kullanıcı Bildirimleri
- **Graceful Degradation**:
  - API hatalarında anlamlı mesajlar
  - Timeout durumlarında otomatik retry
  - Network error için bağlantı kontrolü önerisi
- **Loading States**:
  - Skeleton screens veri yüklenirken
  - "Yükleniyor..." metinleri ekran okuyucular için
  - Shimmer efektli placeholder'lar

### 6. Çoklu Platform Desteği
- **iOS Optimizasyonları**:
  - Safari için özel install talimatları
  - Safe area insets yönetimi
  - Touch delay optimizasyonları
- **Android Optimizasyonları**:
  - Chrome PWA install prompt
  - Material Design principles
- **Desktop**:
  - Hover states
  - Keyboard shortcuts
  - Resize handles

---

## 🔮 Kullanıcı Değer Önerileri

### Zaman Tasarrufu
- **Bekleme Süresi Azaltma**: En az kalabalık saati seçerek
- **Akıllı Planlama**: Alternatif rotalar ve saatler karşılaştırma
- **Anlık Bilgi**: Yola çıkmadan önce mevcut durumu görme

### Konfor Artışı
- **Kalabalıktan Kaçınma**: Yüksek yoğunluk saatlerini atlama
- **Yer Bulma Şansı**: Düşük doluluk dönemlerini tercih etme
- **Stres Azaltma**: Önceden bilgi sahibi olmanın rahatlığı

### Güvenilir Bilgi
- **Makine Öğrenmesi**: Geçmiş verilerle eğitilmiş modeller
- **Gerçek Veriler**: İBB resmi yolcu sayıları
- **Sürekli Güncelleme**: Her gün yeni tahminler

### Erişilebilirlik
- **Ücretsiz**: Tamamen açık erişim
- **Platform Bağımsız**: Web tarayıcı yeterli
- **Offline Çalışma**: PWA ile temel özellikler her zaman hazır

---

## 📊 Veri Akışı ve Mimari

```
Kullanıcı Etkileşimi
    ↓
Next.js Frontend (React Components)
    ↓
Zustand Store (State Management)
    ↓
API Client (Axios)
    ↓
FastAPI Backend
    ↓
┌──────────────┬──────────────┬───────────────┐
│  PostgreSQL  │  LightGBM    │  Metro API    │
│  (Metadata)  │  (ML Model)  │  (Live Data)  │
└──────────────┴──────────────┴───────────────┘
```

### Veri Güncelliği
- **Forecast Verisi**: Günlük batch job ile 24 saat önceden hesaplanır
- **Metro Seferleri**: 30 saniye cache ile neredeyse gerçek zamanlı
- **Hat Durumu**: İstek anında API'den çekilir
- **Güzergah Verileri**: Statik JSON, değişime göre güncellenir

---

## 🎨 Tasarım Sistemi

Detaylı tasarım sistemi için `DESIGN_SYSTEM.md` dosyasına bakın. Ana öğeler:

- **Typography**: Inter font family, responsive font sizes
- **Spacing**: 4px grid system (space-1 → space-20)
- **Colors**: 
  - Background: slate-950
  - Surface: slate-900
  - Text: gray-100
  - Primary: purple-600
  - Secondary: amber-500
- **Shadows**: Multi-layer shadows for depth
- **Borders**: Subtle white/10 opacity borders

---

## 💻 Geliştirme

### Kurulum

```bash
npm install
```

### Geliştirme Sunucusu

```bash
npm run dev
```

Tarayıcınızda [http://localhost:3000](http://localhost:3000) adresini açın.

### Build

```bash
npm run build
npm start
```

### Lint

```bash
npm run lint
```

---

## 🙏 Teşekkürler

Bu platform, İstanbul'da yaşayan milyonlarca insanın günlük yolculuklarını daha konforlu hale getirme amacıyla geliştirilmiştir. Kullanıcı geri bildirimleri ve topluluk desteği sayesinde sürekli gelişmektedir.

**Keyifli yolculuklar dileriz!** 🚇🚌⛴️