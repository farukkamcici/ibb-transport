# IBB Transport Frontend Design System

This document outlines the design system for the IBB Transport frontend application. It includes the color palette, typography, and main UI components.

## Color Palette

The color palette is defined in `tailwind.config.js` and is based on a modern "Dark/Marine" theme.

| Name      | Hex       | Usage                               |
|-----------|-----------|-------------------------------------|
| `background`| `#0f172a` | Main application background (Deep Navy) |
| `surface` | `#1E293B` | Card and panel backgrounds (Dark Slate) |
| `primary`   | `#188580` | Buttons, highlights, and actions (Teal) |
| `secondary` | `#cce8e6` | Accent elements and secondary text (Pale Mint) |
| `text`      | `#F8FAFC` | Default text color (Off-white)      |

## Typography

The application uses the default sans-serif font provided by Tailwind CSS.

### Font Sizes

- `text-xs`: Extra small text, used for metadata and labels.
- `text-sm`: Small text, used for secondary information.
- `text-base`: Default text size.
- `text-lg`: Large text, used for titles.
- `text-xl`: Extra large text, used for main headings.
- `text-2xl`: 2x large text, used for prominent headings.

### Font Weights

- `font-medium`: Medium weight, used for labels and secondary text.
- `font-semibold`: Semi-bold weight, used for titles and important text.
- `font-bold`: Bold weight, used for main headings and important information.

## Components

This section provides an overview of the main UI components used in the application.

### `BottomNav`

The `BottomNav` component is the main navigation bar located at the bottom of the screen. It provides quick access to the main sections of the application.

- **File:** `src/components/ui/BottomNav.jsx`
- **Usage:** Placed at the bottom of the main layout in `src/app/page.js`.

### `CrowdChart`

The `CrowdChart` component is used to visualize the 24-hour crowd forecast for a selected transport line. It is built using the `recharts` library.

- **File:** `src/components/ui/CrowdChart.jsx`
- **Usage:** Used inside the `LineDetailPanel` component.

### `LineDetailPanel`

The `LineDetailPanel` is a bottom sheet that slides up to display detailed information about a selected transport line. It includes the current crowd status, the best time to travel, and the 24-hour forecast chart.

- **File:** `src/components/ui/LineDetailPanel.jsx`
- **Usage:** Placed in the main layout in `src/app/page.js` and its visibility is controlled by the `useAppStore` Zustand store.

### `SearchBar`

The `SearchBar` component allows users to search for transport lines by their ID or name. It displays a dropdown with the search results.

- **File:** `src/components/ui/SearchBar.jsx`
- **Usage:** Placed at the top of the main layout in `src/app/page.js`.

### `TimeSlider`

The `TimeSlider` component is a range input that allows users to select a specific hour of the day. The selected hour is used to display the estimated crowd level at that time.

- **File:** `src/components/ui/TimeSlider.jsx`
- **Usage:** Used inside the `LineDetailPanel` component.

### `TemperatureBadge`

The `TemperatureBadge` component displays current weather and expandable 6-hour forecast in a floating badge positioned in the top-right corner. Features intelligent location throttling and weather icons from OpenMeteo.

- **File:** `src/components/ui/Nowcast.jsx`
- **Usage:** Placed in the root layout (`src/app/layout.js`) for global visibility.
- **Features:** 
  - **Optimized API calls**: Only fetches temperature + weather codes
  - **Expandable interface**: Click to show 6-hour forecast
  - **Weather icons**: Uses OpenMeteo weather codes for emoji icons
  - **Location throttling**: Prevents excessive API calls when moving
  - **Smart caching**: 2-minute minimum between fetches, 30-minute auto-refresh
  - **Movement detection**: Only fetches if moved >100 meters
  - **Responsive design**: Adapts to mobile/desktop
  - **Smooth animations**: Expand/collapse with slide transitions
  - **Robust error handling**: Graceful fallbacks and user notifications

### `Alert`

The `Alert` component provides toast-style notifications for user feedback. It automatically dismisses after 5 seconds and includes a manual close button.

- **File:** `src/components/ui/Alert.jsx`
- **Usage:** Placed in the root layout for global alert handling.
- **Features:**
  - Slide-in animation from top
  - Auto-dismiss functionality
  - Manual close button
  - Uses design system colors and styling
