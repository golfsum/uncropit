import { Ionicons } from "@expo/vector-icons";

export interface SizePreset {
  id: string;
  label: string;
  w: number;
  h: number;
}

export interface PlatformGroup {
  platform: string;
  icon: keyof typeof Ionicons.glyphMap;
  presets: SizePreset[];
}

// Popular, current export sizes per platform. Pixel dimensions.
export const PLATFORMS: PlatformGroup[] = [
  {
    platform: "Instagram",
    icon: "logo-instagram",
    presets: [
      { id: "ig-square", label: "Post (Square)", w: 1080, h: 1080 },
      { id: "ig-portrait", label: "Portrait", w: 1080, h: 1350 },
      { id: "ig-story", label: "Story / Reel", w: 1080, h: 1920 },
      { id: "ig-land", label: "Landscape", w: 1080, h: 566 },
    ],
  },
  {
    platform: "TikTok",
    icon: "musical-notes",
    presets: [{ id: "tt-video", label: "Video", w: 1080, h: 1920 }],
  },
  {
    platform: "YouTube",
    icon: "logo-youtube",
    presets: [
      { id: "yt-thumb", label: "Thumbnail", w: 1280, h: 720 },
      { id: "yt-short", label: "Short", w: 1080, h: 1920 },
      { id: "yt-banner", label: "Channel Art", w: 2560, h: 1440 },
    ],
  },
  {
    platform: "Facebook",
    icon: "logo-facebook",
    presets: [
      { id: "fb-post", label: "Post", w: 1200, h: 630 },
      { id: "fb-story", label: "Story", w: 1080, h: 1920 },
      { id: "fb-cover", label: "Cover", w: 820, h: 312 },
    ],
  },
  {
    platform: "X / Twitter",
    icon: "logo-twitter",
    presets: [
      { id: "x-post", label: "Post", w: 1600, h: 900 },
      { id: "x-header", label: "Header", w: 1500, h: 500 },
    ],
  },
  {
    platform: "LinkedIn",
    icon: "logo-linkedin",
    presets: [
      { id: "li-post", label: "Post", w: 1200, h: 627 },
      { id: "li-cover", label: "Cover", w: 1584, h: 396 },
    ],
  },
  {
    platform: "Pinterest",
    icon: "logo-pinterest",
    presets: [{ id: "pin-pin", label: "Pin", w: 1000, h: 1500 }],
  },
  {
    platform: "App Store",
    icon: "logo-apple-appstore",
    presets: [
      { id: "as-icon", label: "App Icon", w: 1024, h: 1024 },
      { id: "as-67", label: 'iPhone 6.7"/6.9"', w: 1290, h: 2796 },
      { id: "as-65", label: 'iPhone 6.5"', w: 1242, h: 2688 },
      { id: "as-55", label: 'iPhone 5.5"', w: 1242, h: 2208 },
      { id: "as-ipad", label: 'iPad 12.9"', w: 2048, h: 2732 },
    ],
  },
  {
    platform: "Favicon",
    icon: "globe-outline",
    presets: [
      { id: "fav-32", label: "Favicon", w: 32, h: 32 },
      { id: "fav-48", label: "Favicon", w: 48, h: 48 },
      { id: "fav-180", label: "Apple Touch", w: 180, h: 180 },
      { id: "fav-192", label: "PWA / Android", w: 192, h: 192 },
      { id: "fav-512", label: "PWA Maskable", w: 512, h: 512 },
    ],
  },
];

// Platforms that default to Fill mode (full-bleed, no padding) - icons/favicons.
export const FILL_PLATFORMS = ["App Store", "Favicon"];
