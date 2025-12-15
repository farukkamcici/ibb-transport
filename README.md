# DoluMu - Istanbul Public Transit Crowding Prediction Platform

**AI-powered crowd and occupancy predictions for all Istanbul public transport. Check before you ride.**

🌐 **Available in Turkish and English** | Türkçe ve İngilizce dillerinde kullanılabilir

---

## What is this Platform?

**DoluMu** is a **multilingual, web-based AI prediction tool** that helps you avoid peak hours and plan more comfortable journeys on Istanbul's public transportation network covering Metro, Bus, Metrobus, and Ferry lines.

**Important:** This platform uses **AI models trained on historical passenger data and weather forecasts** to predict crowding levels. It does **not** rely on real-time sensors or live passenger counting. All information shown represents **forecasted predictions** based on patterns learned from past data, weather conditions, and calendar factors.

---

## Key Features

### 🕐 **24-Hour Crowding Forecasts**
- See predicted crowding levels for any metro line, bus route, or ferry service up to 24 hours ahead
- Plan your commute by checking the best departure times before you leave

### 🌦️ **Weather-Aware Predictions**
- Our AI considers weather conditions (rain, temperature, wind) that affect ridership patterns
- Get more accurate predictions during adverse weather conditions when people change their travel habits

### 🗺️ **Interactive Route Visualization**
- View complete bus line routes on an interactive map with all stops
- See dynamic direction labels showing destination stops (e.g., "KADIKÖY Yönü")
- Interactive stop markers with names and locations
- Distinctive start (green) and end (red) stop indicators
- Smooth, professional route rendering with rounded polylines

### 🚇 **Metro Network Mode**
- Metro lines render with official colors, accessibility badges, and accurate station geometry sourced from Metro Istanbul APIs.
- Station selectors automatically pull valid directions (e.g., Yenikapı → Havalimanı) and keep the forecast/time slider in sync with the chosen branch.
- Dedicated MetroLayer overlays stops on the map alongside bus/ferry data so you can mix and match trips visually.
- M1 is exposed as separate `M1A` and `M1B` branches in search and selection so station lists and timetables remain consistent per branch.

### ⚡ **Instant Metro Timetables**
- A compact widget shows the next departures plus first/last trips; tapping it opens a full-day `MetroScheduleModal` with every train for the selected station/direction.
- A built-in stale-while-revalidate cache keeps timetables available even if the upstream Metro API stalls, refreshing quietly whenever the network is reachable.

### 💡 **"Best Time to Travel" Suggestions**
- Receive personalized recommendations for less crowded departure times
- Compare multiple time slots to find your optimal travel window

### 📱 **Progressive Web App (PWA)**
- Access the platform on any device - mobile, tablet, or desktop
- Add to your phone's home screen for quick access
- Works offline for basic functionality
- Advanced mobile gestures: drag-to-minimize panels, haptic feedback
- Responsive design with desktop sidebar and mobile drawer layouts

### 🌐 **Multi-Language Support**
- Full interface available in Turkish (Türkçe) and English
- Easy language switching from Settings page
- All forecasts, labels, and notifications localized
- Automatic language detection based on browser preferences

---

## How to Interpret the "Crowd Score"

The platform shows crowding levels using a **color-coded system** and **crowd scores**:

### Color Scale
- 🟢 **Green (Very Low/Low):** Comfortable travel with plenty of space
- 🟡 **Yellow (Medium):** Moderate crowding, seats may be limited
- 🟠 **Orange (High):** Crowded conditions, standing room available
- 🔴 **Red (Very High):** Very crowded, limited standing space

### Understanding "High" vs "Low"
The crowd score is **contextual and relative** to each transport line's typical patterns:

- **Percentile Ranking:** How this hour compares to historical data for the same line and time
- **Peak Comparison:** How crowded this is relative to the line's busiest periods

**Example:** "M2 Metro - Şişli → Hacıosman: **High (🟠)**"
- *Historical Context:* 78% more crowded than typical for this time
- *Peak Reference:* 63% of this line's maximum capacity
- *Recommendation:* Consider traveling at 21:00 instead (Medium crowding)

### 🚦 Service Awareness
- Hours that fall outside the published schedule are clearly marked **Out of Service**, so you instantly know when a line is offline instead of staring at an empty chart.
- Direction-aware status checks mean the app can tell you if only one side of a route (e.g., `G` vs `D`) is paused, keeping the forecast, status banner, and schedule widget perfectly aligned.
- Metro/rail out-of-service hours are derived from Metro topology service windows (`first_time`/`last_time`) so 24h charts remain visible while inactive hours render as gaps.

---

## User Scenarios

### 🏢 **Daily Commuters**
*"I work in Levent and live in Kadıköy. Should I leave at 17:30 or wait until 18:30?"*
- Check M2 Metro predictions for both time slots
- Compare crowd levels and choose the more comfortable option

### 🛍️ **Weekend Shoppers**
*"Planning to visit Taksim on Saturday afternoon - when will the metro be less crowded?"*
- View weekend patterns for M2 Vezneciler → Taksim
- Get suggestions for off-peak shopping hours

### 🏥 **Medical Appointments**
*"I have a doctor's appointment in Bakırköy at 14:00 - when should I leave Beylikdüzü?"*
- Check Metrobüs predictions 2-3 hours before departure
- Plan buffer time based on predicted crowding levels

### 🎯 **Event Attendees**
*"There's a match at Vodafone Park tonight - how crowded will the metro be?"*
- Check predictions for lines serving Beşiktaş
- Plan alternative routes if main lines show high crowding

---

## FAQ & Important Information

### **How accurate are these predictions?**
Our AI models achieve good accuracy for typical conditions, but predictions are **estimates, not guarantees**. Accuracy is highest for:
- Regular weekday patterns
- Well-established metro and metrobüs lines
- Normal weather conditions

Predictions may be less accurate during:
- Unusual events (strikes, major celebrations, emergencies)
- Extreme weather conditions not seen in historical data
- New transportation routes with limited historical data

### **What data sources are used?**
- **Passenger Data:** Istanbul Metropolitan Municipality (IBB) open data on hourly ridership
- **Weather Data:** Open-Meteo weather forecasts and historical weather patterns
- **Calendar Data:** Turkish holidays, school terms, and seasonal patterns

### **Why don't I see real-time information?**
This platform focuses on **prediction and planning** rather than real-time monitoring. Our goal is to help you plan ahead and avoid crowded conditions before you start your journey.

### **Which transport lines are covered?**
The platform covers major Istanbul public transportation including:
- Metro lines (M1, M2, M3, M4, M5, M6, M7, M11)
- Metrobüs (BRT) routes
- Major bus lines with sufficient historical data
- Ferry services (selected routes)

### **Is my location data tracked?**
The platform can use your location (if you permit it) only to show nearby transport options and provide relevant recommendations. Location data is not stored or tracked for advertising purposes.

### **How do I save my favorite lines?**
You can bookmark frequently used transport lines by clicking the star icon (⭐) when viewing a line's details. Your favorites are stored locally on your device and displayed on the Forecast page for quick access to real-time crowd predictions.

### **Can I get notifications?**
Notification features are planned for future releases to alert you about:
- Unusually high crowding on your saved favorite lines
- Weather-related changes affecting your regular routes
- Recommended departure times for your planned trips

---

## Getting Started

1. **Visit the Platform:** Access through your web browser on any device
2. **Choose Your Language:** Select Turkish or English from Settings (⚙️)
3. **Explore the Map:** Browse Istanbul's transport network and crowding patterns
4. **Select Your Line:** Click on any metro, bus, or ferry route
5. **Choose Your Time:** Use the time slider to see predictions for different hours
6. **Save Favorites:** Bookmark your regular routes for quick access
7. **Plan Ahead:** Check predictions before starting your journey

---

*This platform is designed to make Istanbul's public transportation more comfortable and predictable for everyone. While we strive for accuracy, please use these predictions as guidance alongside your own experience and local conditions.*
