// ============================================================================
// Orqui Editor — Lucide Icons Selector
// ============================================================================
import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import {
  Activity, Airplay, AlarmClock, AlertCircle, AlertOctagon, AlertTriangle,
  Archive, ArrowDown, ArrowDownCircle, ArrowDownLeft, ArrowDownRight, ArrowLeft,
  ArrowRight, ArrowUp, ArrowUpCircle, ArrowUpLeft, ArrowUpRight, AtSign,
  Award, Ban, Banknote, BarChart, BarChart2, BarChart3, Battery, BatteryCharging,
  Bell, BellOff, BellRing, Binary, Bluetooth, Bookmark, Box, Boxes,
  Bug, Calendar, CalendarClock, CalendarDays, Camera, Cast, Check,
  CheckCircle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronsDown,
  ChevronsLeft, ChevronsRight, ChevronsUp, ChevronUp, Circle, Clipboard,
  ClipboardCheck, ClipboardCopy, ClipboardList, Clock, Cloud, CloudRain,
  CloudSnow, Code, Code2, Coins, Command, Component, Contact,
  Container, Copy, CornerDownLeft, CornerDownRight, CornerUpLeft, CornerUpRight,
  Cpu, CreditCard, Crosshair, Crown, Database, Diamond, DollarSign,
  DoorClosed, DoorOpen, Download, Edit, Edit2, Edit3, Eraser, Euro,
  Eye, EyeOff, File, FileAudio, FileCode, FileImage, FileText,
  FileVideo, Files, Film, Filter,
  Flag, Flame, Folder, FolderCheck, FolderLock, FolderMinus, FolderOpen,
  FolderPlus, FolderX, Forward, Frown, Gift, Github, Gitlab, Globe,
  Grid3x3, Grip, GripHorizontal, GripVertical, Hammer, Hand, HardDrive,
  Hash, Headphones, Heart, HelpCircle, Highlighter, Home, Hourglass,
  Image, Images, Inbox, Info, Key, Laptop, Laugh, Layers, LayoutGrid,
  LayoutList, Link, List, Loader, Loader2, Lock, LockKeyhole,
  LockKeyholeOpen, LogIn, LogOut, Mail, MailOpen, Map, MapPin, Maximize,
  Meh, Menu, MessageCircle, MessageSquare, MessagesSquare, Mic, MicOff,
  Minimize, Minus, MinusCircle, Monitor, Moon, MoreHorizontal, MoreVertical,
  Move, MoveDown, MoveLeft, MoveRight, MoveUp, Music, Music2, Navigation,
  Navigation2, Package, PanelLeft, PanelRight, Paperclip, Pause,
  Pen, PenLine, PenTool, Pencil, Percent, Phone, PhoneCall, PhoneIncoming,
  PhoneMissed, PhoneOff, PhoneOutgoing, PieChart, Play, Plus, PlusCircle,
  Plug, Podcast, PoundSterling, Power, PowerOff, Radio, Receipt, Redo,
  RefreshCcw, RefreshCw, Reply, RotateCcw, RotateCw, Save, Scissors,
  Search, Send, Server, Settings, Share, Share2, Shield, ShieldAlert,
  ShieldCheck, ShieldX, ShoppingBag, ShoppingCart, Sidebar, Signal,
  SkipBack, SkipForward, Slash, Sliders, Smartphone, Smile, Sparkles,
  Square, Star, Sun, Sunrise, Sunset, Table, Tablet, Tag, Tags,
  Target, Terminal, TestTube, ThumbsDown, ThumbsUp, Ticket, Timer,
  Trash2, TrendingDown, TrendingUp, Triangle, Trophy, Undo,
  Unlock, Upload, User, UserCheck, UserCircle, UserMinus, UserPlus,
  Users, UserSquare, UserX, Video, VideoOff, Volume, Volume1, Volume2,
  VolumeX, Wallet, Wind, Workflow, Wrench, X, XCircle, XOctagon,
  Zap, ZoomIn, ZoomOut,
  type LucideProps
} from "lucide-react";
import { COLORS, s } from "../lib/constants";

// Create icon registry for dynamic lookup
export const LUCIDE_ICON_REGISTRY: Record<string, React.ComponentType<LucideProps>> = {
  Activity, Airplay, AlarmClock, AlertCircle, AlertOctagon, AlertTriangle,
  Archive, ArrowDown, ArrowDownCircle, ArrowDownLeft, ArrowDownRight, ArrowLeft,
  ArrowRight, ArrowUp, ArrowUpCircle, ArrowUpLeft, ArrowUpRight, AtSign,
  Award, Ban, Banknote, BarChart, BarChart2, BarChart3, Battery, BatteryCharging,
  Bell, BellOff, BellRing, Binary, Bluetooth, Bookmark, Box, Boxes,
  Bug, Calendar, CalendarClock, CalendarDays, Camera, Cast, Check,
  CheckCircle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronsDown,
  ChevronsLeft, ChevronsRight, ChevronsUp, ChevronUp, Circle, Clipboard,
  ClipboardCheck, ClipboardCopy, ClipboardList, Clock, Cloud, CloudRain,
  CloudSnow, Code, Code2, Coins, Command, Component, Contact,
  Container, Copy, CornerDownLeft, CornerDownRight, CornerUpLeft, CornerUpRight,
  Cpu, CreditCard, Crosshair, Crown, Database, Diamond, DollarSign,
  DoorClosed, DoorOpen, Download, Edit, Edit2, Edit3, Eraser, Euro,
  Eye, EyeOff, File, FileAudio, FileCode, FileImage, FileText,
  FileVideo, Files, Film, Filter,
  Flag, Flame, Folder, FolderCheck, FolderLock, FolderMinus, FolderOpen,
  FolderPlus, FolderX, Forward, Frown, Gift, Github, Gitlab, Globe,
  Grid3x3, Grip, GripHorizontal, GripVertical, Hammer, Hand, HardDrive,
  Hash, Headphones, Heart, HelpCircle, Highlighter, Home, Hourglass,
  Image, Images, Inbox, Info, Key, Laptop, Laugh, Layers, LayoutGrid,
  LayoutList, Link, List, Loader, Loader2, Lock, LockKeyhole,
  LockKeyholeOpen, LogIn, LogOut, Mail, MailOpen, Map, MapPin, Maximize,
  Meh, Menu, MessageCircle, MessageSquare, MessagesSquare, Mic, MicOff,
  Minimize, Minus, MinusCircle, Monitor, Moon, MoreHorizontal, MoreVertical,
  Move, MoveDown, MoveLeft, MoveRight, MoveUp, Music, Music2, Navigation,
  Navigation2, Package, PanelLeft, PanelRight, Paperclip, Pause,
  Pen, PenLine, PenTool, Pencil, Percent, Phone, PhoneCall, PhoneIncoming,
  PhoneMissed, PhoneOff, PhoneOutgoing, PieChart, Play, Plus, PlusCircle,
  Plug, Podcast, PoundSterling, Power, PowerOff, Radio, Receipt, Redo,
  RefreshCcw, RefreshCw, Reply, RotateCcw, RotateCw, Save, Scissors,
  Search, Send, Server, Settings, Share, Share2, Shield, ShieldAlert,
  ShieldCheck, ShieldX, ShoppingBag, ShoppingCart, Sidebar, Signal,
  SkipBack, SkipForward, Slash, Sliders, Smartphone, Smile, Sparkles,
  Square, Star, Sun, Sunrise, Sunset, Table, Tablet, Tag, Tags,
  Target, Terminal, TestTube, ThumbsDown, ThumbsUp, Ticket, Timer,
  Trash2, TrendingDown, TrendingUp, Triangle, Trophy, Undo,
  Unlock, Upload, User, UserCheck, UserCircle, UserMinus, UserPlus,
  Users, UserSquare, UserX, Video, VideoOff, Volume, Volume1, Volume2,
  VolumeX, Wallet, Wind, Workflow, Wrench, X, XCircle, XOctagon,
  Zap, ZoomIn, ZoomOut,
};

// ============================================================================
// Icon Categories
// ============================================================================

// Emoji categories (kept from Phosphor for IconPicker)
export const ICON_CATEGORIES: Record<string, string[]> = {
  "Geometric": ["⬡", "◆", "●", "■", "▲", "◇", "⬢", "◉", "◈", "⬟"],
  "Stars": ["★", "✦", "✧", "✶", "✴", "✹", "⭐", "🌟", "💫", "⚝"],
  "Symbols": ["⚡", "⟐", "⊚", "⊛", "⊕", "⊗", "⏣", "⎔", "◎", "☰"],
  "Tech": ["🔷", "🔶", "🔹", "🔸", "💎", "🧊", "⚙️", "🔧", "🛠️", "💻"],
  "Business": ["📊", "📈", "📋", "📁", "📂", "🗂️", "📑", "📌", "📎", "🏢"],
  "Creative": ["💡", "🎯", "🚀", "🔮", "🎨", "✏️", "🖊️", "🧩", "🔬", "🧪"],
  "Nature": ["🌊", "🔥", "🌱", "🍃", "☁️", "🌙", "🏔️", "🌀", "♾️", "🪐"],
  "Comms": ["💬", "🏠", "🔔", "📡", "🌐", "🔗", "📮", "✉️", "📢", "🎙️"],
  "Security": ["🛡️", "🔒", "🔑", "🏷️", "✅", "❌", "⚠️", "🚫", "🔐", "👁️"],
  "Animals": ["🐙", "🦊", "🐝", "🦋", "🐬", "🦄", "🐺", "🦅", "🐢", "🎪"],
};
export const ICON_PRESETS = Object.values(ICON_CATEGORIES).flat();

// ============================================================================
// Top 300 Most Commonly Used Lucide Icons
// ============================================================================

// Top 278 validated Lucide icons (alphabetically sorted)
// Verified against lucide-react v0.563.0
export const LUCIDE_TOP_300 = [
  "Activity", "Airplay", "AlarmClock", "AlertCircle", "AlertOctagon", "AlertTriangle",
  "Archive", "ArrowDown", "ArrowDownCircle", "ArrowDownLeft", "ArrowDownRight", "ArrowLeft",
  "ArrowRight", "ArrowUp", "ArrowUpCircle", "ArrowUpLeft", "ArrowUpRight", "AtSign",
  "Award", "Ban", "Banknote", "BarChart", "BarChart2", "BarChart3",
  "Battery", "BatteryCharging", "Bell", "BellOff", "BellRing", "Binary",
  "Bluetooth", "Bookmark", "Box", "Boxes", "Bug", "Calendar",
  "CalendarClock", "CalendarDays", "Camera", "Cast", "Check", "CheckCircle",
  "CheckCircle2", "ChevronDown", "ChevronLeft", "ChevronRight", "ChevronsDown", "ChevronsLeft",
  "ChevronsRight", "ChevronsUp", "ChevronUp", "Circle", "Clipboard", "ClipboardCheck",
  "ClipboardCopy", "ClipboardList", "Clock", "Cloud", "CloudRain", "CloudSnow",
  "Code", "Code2", "Coins", "Command", "Component", "Contact",
  "Container", "Copy", "CornerDownLeft", "CornerDownRight", "CornerUpLeft", "CornerUpRight",
  "Cpu", "CreditCard", "Crosshair", "Crown", "Database", "Diamond",
  "DollarSign", "DoorClosed", "DoorOpen", "Download", "Edit", "Edit2",
  "Edit3", "Eraser", "Euro", "Eye", "EyeOff", "File",
  "FileAudio", "FileCode", "FileImage", "FileText", "FileVideo", "Files",
  "Film", "Filter", "Flag", "Flame", "Folder", "FolderCheck",
  "FolderLock", "FolderMinus", "FolderOpen", "FolderPlus", "FolderX", "Forward",
  "Frown", "Gift", "Github", "Gitlab", "Globe", "Grid3x3",
  "Grip", "GripHorizontal", "GripVertical", "Hammer", "Hand", "HardDrive",
  "Hash", "Headphones", "Heart", "HelpCircle", "Highlighter", "Home",
  "Hourglass", "Image", "Images", "Inbox", "Info", "Key",
  "Laptop", "Laugh", "Layers", "LayoutGrid", "LayoutList", "Link",
  "List", "Loader", "Loader2", "Lock", "LockKeyhole", "LockKeyholeOpen",
  "LogIn", "LogOut", "Mail", "MailOpen", "Map", "MapPin",
  "Maximize", "Meh", "Menu", "MessageCircle", "MessageSquare", "MessagesSquare",
  "Mic", "MicOff", "Minimize", "Minus", "MinusCircle", "Monitor",
  "Moon", "MoreHorizontal", "MoreVertical", "Move", "MoveDown", "MoveLeft",
  "MoveRight", "MoveUp", "Music", "Music2", "Navigation", "Navigation2",
  "Package", "PanelLeft", "PanelRight", "Paperclip", "Pause", "Pen",
  "PenLine", "PenTool", "Pencil", "Percent", "Phone", "PhoneCall",
  "PhoneIncoming", "PhoneMissed", "PhoneOff", "PhoneOutgoing", "PieChart", "Play",
  "Plus", "PlusCircle", "Plug", "Podcast", "PoundSterling", "Power",
  "PowerOff", "Radio", "Receipt", "Redo", "RefreshCcw", "RefreshCw",
  "Reply", "RotateCcw", "RotateCw", "Save", "Scissors", "Search",
  "Send", "Server", "Settings", "Share", "Share2", "Shield",
  "ShieldAlert", "ShieldCheck", "ShieldX", "ShoppingBag", "ShoppingCart", "Sidebar",
  "Signal", "SkipBack", "SkipForward", "Slash", "Sliders", "Smartphone",
  "Smile", "Sparkles", "Square", "Star", "Sun", "Sunrise",
  "Sunset", "Table", "Tablet", "Tag", "Tags", "Target",
  "Terminal", "TestTube", "ThumbsDown", "ThumbsUp", "Ticket", "Timer",
  "Trash2", "TrendingDown", "TrendingUp", "Triangle", "Trophy", "Undo",
  "Unlock", "Upload", "User", "UserCheck", "UserCircle", "UserMinus",
  "UserPlus", "Users", "UserSquare", "UserX", "Video", "VideoOff",
  "Volume", "Volume1", "Volume2", "VolumeX", "Wallet", "Wind",
  "Workflow", "Wrench", "X", "XCircle", "XOctagon", "Zap",
  "ZoomIn", "ZoomOut",
] as const;

export type LucideTop300 = typeof LUCIDE_TOP_300[number];

// Lucide Icons — organized by category
type LucideIconName = string;

export const LUCIDE_CATEGORIES: Record<string, LucideTop300[]> = {
  "Interface": [
    "Home", "Settings", "Search", "Menu", "X", "Check", "Plus", "Minus",
    "Edit", "Trash2", "Save", "Download", "Upload", "Copy", "Link",
    "Maximize", "Minimize", "ZoomIn", "ZoomOut", "Filter", "Grid3x3", "List",
    "LayoutGrid", "LayoutList", "Sidebar", "PanelLeft", "PanelRight",
    "ChevronRight", "ChevronLeft", "ChevronDown", "ChevronUp",
    "MoreVertical", "MoreHorizontal",
  ],
  "Arrows & Navigation": [
    "ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown",
    "ArrowUpRight", "ArrowDownRight", "ArrowUpLeft", "ArrowDownLeft",
    "ChevronsRight", "ChevronsLeft", "ChevronsUp", "ChevronsDown",
    "MoveRight", "MoveLeft", "MoveUp", "MoveDown",
    "CornerUpRight", "CornerUpLeft", "CornerDownRight", "CornerDownLeft",
    "Undo", "Redo", "RotateCw", "RotateCcw",
  ],
  "Files & Folders": [
    "File", "FileText", "FileCode", "FileImage", "FileVideo",
    "FileAudio", "Files", "Folder", "FolderOpen", "FolderPlus",
    "FolderMinus", "FolderCheck", "FolderX", "FolderLock", "Archive",
    "Package", "Clipboard", "ClipboardCheck", "ClipboardCopy",
    "ClipboardList", "Paperclip", "Inbox",
  ],
  "System & Settings": [
    "Settings", "Sliders", "Wrench", "Hammer", "Activity", "Zap",
    "Power", "PowerOff", "Plug", "Battery", "BatteryCharging", "Signal",
    "Bluetooth", "Cast", "Monitor", "Smartphone", "Tablet", "Laptop",
    "HardDrive", "Cpu", "Database", "Server",
  ],
  "Users & Authentication": [
    "User", "UserPlus", "UserMinus", "UserCheck", "UserX", "Users",
    "UserCircle", "UserSquare", "Contact", "Shield", "ShieldCheck",
    "ShieldAlert", "ShieldX", "Lock", "Unlock", "LockKeyhole", "LockKeyholeOpen",
    "Key", "DoorClosed", "DoorOpen", "LogOut", "LogIn",
  ],
  "Communication": [
    "Bell", "BellOff", "BellRing", "Mail", "MailOpen", "Inbox", "Send",
    "MessageCircle", "MessageSquare", "MessagesSquare", "Phone", "PhoneCall",
    "PhoneIncoming", "PhoneOutgoing", "PhoneMissed", "PhoneOff", "Video",
    "VideoOff", "Mic", "MicOff", "AtSign", "Hash", "Share", "Share2",
    "Forward", "Reply",
  ],
  "Media & Content": [
    "Image", "Images", "Camera", "Video", "Film", "Music", "Music2",
    "Headphones", "Volume", "Volume1", "Volume2", "VolumeX", "Play", "Pause",
    "SkipForward", "SkipBack", "Square", "Circle", "Triangle", "Radio",
    "Podcast", "Airplay",
  ],
  "Commerce & Business": [
    "ShoppingCart", "ShoppingBag", "CreditCard", "Wallet", "DollarSign",
    "Euro", "PoundSterling", "Coins", "Banknote", "Tag", "Tags", "Ticket",
    "Gift", "Package", "Box", "Percent", "Receipt", "TrendingUp", "TrendingDown",
    "BarChart",
  ],
  "Data & Charts": [
    "BarChart", "BarChart2", "BarChart3", "PieChart", "Activity",
    "TrendingUp", "TrendingDown", "ArrowUpCircle", "ArrowDownCircle",
    "Table", "Database", "Binary", "Code",
  ],
  "Alerts & Status": [
    "AlertCircle", "AlertTriangle", "AlertOctagon", "Info", "HelpCircle",
    "CheckCircle", "CheckCircle2", "XCircle", "XOctagon", "Slash", "Ban",
    "MinusCircle", "PlusCircle", "Clock", "Timer", "Hourglass", "Loader",
    "Loader2", "RefreshCw", "RefreshCcw",
  ],
  "Actions & Editing": [
    "Eye", "EyeOff", "Edit", "Edit2", "Edit3", "PenTool", "PenLine", "Pen",
    "Pencil", "Eraser", "Highlighter", "Scissors", "Move", "Hand", "Grip",
    "GripVertical", "GripHorizontal", "Crosshair", "Target",
  ],
  "Social & Brand": [
    "Heart", "Star", "Bookmark", "ThumbsUp", "ThumbsDown", "Smile", "Frown",
    "Meh", "Laugh", "Flag", "Award", "Trophy", "Crown", "Diamond", "Flame", "Sparkles",
  ],
  "Development & Git": [
    "Code", "Code2", "Terminal", "Command", "Github", "Gitlab", "FileCode",
    "Bug", "TestTube", "Package", "Boxes", "Container", "Layers", "Component",
    "Workflow",
  ],
  "Location & Travel": [
    "Map", "MapPin", "Navigation", "Navigation2", "Globe", "Home",
  ],
  "Misc Utility": [
    "Calendar", "CalendarDays", "CalendarClock", "Clock", "Timer", "AlarmClock",
    "Sun", "Moon", "Sunrise", "Sunset", "Cloud", "CloudRain", "CloudSnow", "Wind",
  ],
};

export const LUCIDE_ICONS_FLAT = Object.values(LUCIDE_CATEGORIES).flat();

// Verify all icons in LUCIDE_TOP_300 are in at least one category (build-time check)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const categorizedIcons = new Set(LUCIDE_ICONS_FLAT);
  const uncategorized = LUCIDE_TOP_300.filter(icon => !categorizedIcons.has(icon));
  if (uncategorized.length > 0) {
    console.warn('[LucideIcons] Uncategorized icons:', uncategorized);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fuzzy match algorithm - returns score (higher is better match)
 * Returns 0 if no match
 */
function fuzzyMatch(str: string, pattern: string): number {
  let score = 0;
  let patternIdx = 0;
  let consecutiveMatches = 0;

  for (let i = 0; i < str.length; i++) {
    if (str[i] === pattern[patternIdx]) {
      score += 1 + consecutiveMatches; // Bonus for consecutive matches
      consecutiveMatches++;
      patternIdx++;
      if (patternIdx === pattern.length) {
        return score;
      }
    } else {
      consecutiveMatches = 0;
    }
  }

  return patternIdx === pattern.length ? score : 0;
}

/**
 * Get Lucide icon component by name
 * Handles both PascalCase and kebab-case, with or without "lucide:" prefix
 */
export function getLucideIcon(name: string): React.ComponentType<LucideProps> | null {
  // Remove prefix if present
  let iconName = name;
  if (iconName.startsWith("lucide:")) {
    iconName = iconName.slice(7);
  }

  // Try exact match from registry (PascalCase)
  if (LUCIDE_ICON_REGISTRY[iconName]) {
    return LUCIDE_ICON_REGISTRY[iconName];
  }

  // Try kebab-case → PascalCase conversion
  const pascalCase = iconName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  if (LUCIDE_ICON_REGISTRY[pascalCase]) {
    return LUCIDE_ICON_REGISTRY[pascalCase];
  }

  // Development warning for missing icons
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    console.warn(
      `[Orqui Icons] Icon "${name}" not found in TOP 300. Available icons:`,
      LUCIDE_TOP_300.slice(0, 10),
      "..."
    );
  }

  return null;
}

/**
 * Render a Lucide icon by name
 */
export function LucideSvg({ name, size = 20, color = "currentColor" }: {
  name: string;
  size?: number;
  color?: string;
}) {
  const IconComponent = getLucideIcon(name);

  if (!IconComponent) {
    return (
      <span style={{ fontSize: size, opacity: 0.3 }} title={`Icon not found: ${name}`}>
        ⚠️
      </span>
    );
  }

  return <IconComponent size={size} color={color} strokeWidth={2} />;
}

// ============================================================================
// LucideIconSelect Component
// ============================================================================

export function LucideIconSelect({ value, onChange, allowEmpty = false, placeholder = "Ícone" }: {
  value: string; // "lucide:Home" or ""
  onChange: (val: string) => void;
  allowEmpty?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | "all">("all");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const iconName = value?.startsWith("lucide:") ? value.slice(7) : value || "";

  // Apply category filter first
  const categoryFiltered = selectedCategory === "all"
    ? LUCIDE_ICONS_FLAT
    : (LUCIDE_CATEGORIES[selectedCategory] || []);

  // Apply fuzzy search with score sorting
  const filtered = search
    ? categoryFiltered
        .map(icon => ({
          icon,
          score: fuzzyMatch(icon.toLowerCase(), search.toLowerCase())
        }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ icon }) => icon)
    : categoryFiltered;

  const groupedFiltered = search
    ? [["Resultados", filtered] as const]
    : (Object.entries(LUCIDE_CATEGORIES) as [string, typeof LUCIDE_ICONS_FLAT][]);

  // Position popover relative to trigger, rendered via portal
  useEffect(() => {
    if (!open || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const margin = 8; // Safety margin from viewport edges
    const maxPopW = Math.min(300, window.innerWidth - margin * 2);

    // Get actual popover height or fallback to maxHeight
    const popH = popoverRef.current?.offsetHeight || 400;

    let top = rect.bottom + 4;
    let left = rect.left;

    // Flip up if not enough space below
    if (top + popH > window.innerHeight - margin) {
      const spaceAbove = rect.top - margin;
      if (spaceAbove >= popH) {
        top = rect.top - popH - 4;
      } else {
        // Not enough space above or below - stick to top with margin
        top = margin;
      }
    }

    // Clamp horizontal with dynamic width
    if (left + maxPopW > window.innerWidth - margin) {
      left = window.innerWidth - maxPopW - margin;
    }
    if (left < margin) left = margin;

    setPos({ top, left });
  }, [open]);

  // Close on outside click or Escape + keyboard navigation
  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (popoverRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && filtered[focusedIndex]) {
        e.preventDefault();
        onChange(`lucide:${filtered[focusedIndex]}`);
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, focusedIndex, filtered, onChange]);

  // Reset focused index when search changes
  useEffect(() => {
    setFocusedIndex(0);
  }, [search, selectedCategory]);

  const popover = open ? ReactDOM.createPortal(
    <div ref={popoverRef} style={{
      position: "fixed", top: pos.top, left: pos.left, zIndex: 99999,
      width: Math.min(300, window.innerWidth - 16),
      maxWidth: "calc(100vw - 16px)",
      maxHeight: Math.min(400, window.innerHeight - 16),
      overflowY: "auto",
      background: COLORS.surface, border: `1px solid ${COLORS.border}`,
      borderRadius: 8, boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
      padding: 8,
    }}>
      <input
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar ícone..."
        style={{ ...s.input, width: "100%", fontSize: 11, marginBottom: 6, padding: "6px 8px", boxSizing: "border-box" }}
      />
      <select
        value={selectedCategory}
        onChange={(e) => setSelectedCategory(e.target.value)}
        style={{ ...s.input, fontSize: 11, marginBottom: 4, width: "100%", padding: "4px 6px", boxSizing: "border-box" }}
      >
        <option value="all">Todas as Categorias</option>
        {Object.keys(LUCIDE_CATEGORIES).map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>
      <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 6, padding: "0 2px" }}>
        {filtered.length} ícone{filtered.length !== 1 ? 's' : ''} {search ? `para "${search}"` : "disponíveis"}
      </div>
      {allowEmpty && (
        <button
          onClick={() => { onChange(""); setOpen(false); }}
          style={{
            ...s.btnSmall, width: "100%", textAlign: "left", padding: "5px 8px",
            marginBottom: 4, fontSize: 11, color: COLORS.textDim,
            background: !value ? COLORS.accent + "15" : "transparent",
            border: "none", borderRadius: 4, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <span style={{ width: 18, textAlign: "center" }}>—</span>
          <span>Nenhum ícone</span>
        </button>
      )}
      {groupedFiltered.map(([cat, icons]) => (
        (icons as typeof LUCIDE_ICONS_FLAT).length > 0 && (
          <div key={cat as string} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 9, color: COLORS.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "4px 4px 2px", marginTop: 2 }}>
              {cat as string}
            </div>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {(icons as typeof LUCIDE_ICONS_FLAT).map(ic => {
                const isSelected = iconName === ic;
                return (
                  <button
                    key={ic}
                    onClick={() => { onChange(`lucide:${ic}`); setOpen(false); }}
                    title={ic}
                    style={{
                      ...s.btnSmall, padding: 5, display: "flex", alignItems: "center", justifyContent: "center",
                      background: isSelected ? COLORS.accent + "25" : COLORS.surface3,
                      border: isSelected ? `1.5px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
                      borderRadius: 5, cursor: "pointer", width: 30, height: 30,
                      color: isSelected ? COLORS.accent : COLORS.textMuted,
                    }}
                  >
                    <LucideSvg name={ic} size={16} color={isSelected ? COLORS.accent : COLORS.textMuted} />
                  </button>
                );
              })}
            </div>
          </div>
        )
      ))}
      {filtered.length === 0 && (
        <div style={{ fontSize: 11, color: COLORS.textDim, padding: 12, textAlign: "center" }}>Nenhum ícone encontrado</div>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => { setOpen(!open); setSearch(""); }}
        style={{
          ...s.btnSmall,
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 10px", minWidth: 80, justifyContent: "space-between",
          background: COLORS.surface3, border: `1px solid ${open ? COLORS.accent : COLORS.border}`,
          borderRadius: 6, cursor: "pointer", fontSize: 11, color: COLORS.text,
        }}
        title={value || placeholder}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {iconName ? <LucideSvg name={iconName} size={14} color={COLORS.text} /> : null}
          <span style={{ color: iconName ? COLORS.text : COLORS.textDim, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {iconName || placeholder}
          </span>
        </span>
        <span style={{ fontSize: 8, color: COLORS.textDim }}>{open ? "▲" : "▼"}</span>
      </button>
      {popover}
    </>
  );
}

// ============================================================================
// IconPicker Component (with Emoji + Lucide tabs)
// ============================================================================

export function IconPicker({ value, onSelect }: { value: string; onSelect: (icon: string) => void }) {
  const [tab, setTab] = useState<"emoji" | "lucide">(value?.startsWith("lucide:") ? "lucide" : "emoji");
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(0);
  const ICONS_PER_PAGE = 100;

  const emojiCategories = Object.entries(ICON_CATEGORIES);
  const lucideCategories = Object.entries(LUCIDE_CATEGORIES);

  const quickIcons = [...emojiCategories[0][1], ...emojiCategories[1][1]];

  // Fuzzy search for lucide icons
  const filteredLucideCategories = search
    ? lucideCategories
        .map(([cat, icons]) => {
          const matched = icons
            .map(icon => ({
              icon,
              score: fuzzyMatch(icon.toLowerCase(), search.toLowerCase())
            }))
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score)
            .map(({ icon }) => icon);
          return [cat, matched] as const;
        })
        .filter(([, icons]) => icons.length > 0)
    : lucideCategories;

  // Pagination for lucide
  const allLucideIcons = filteredLucideCategories.flatMap(([, icons]) => icons);
  const totalPages = Math.ceil(allLucideIcons.length / ICONS_PER_PAGE);
  const paginatedLucideCategories = filteredLucideCategories.map(([cat, icons]) => [
    cat,
    icons.slice(page * ICONS_PER_PAGE, (page + 1) * ICONS_PER_PAGE)
  ] as const).filter(([, icons]) => icons.length > 0);

  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 8 }}>
        {(["emoji", "lucide"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            ...s.btnSmall, padding: "4px 12px", fontSize: 11, fontWeight: tab === t ? 600 : 400,
            background: tab === t ? COLORS.accent : COLORS.surface3,
            color: tab === t ? "#fff" : COLORS.textMuted,
            borderRadius: 4,
          }}>
            {t === "emoji" ? "Emoji" : "Lucide"}
          </button>
        ))}
      </div>

      {tab === "emoji" && (
        <>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {(expanded ? [] : quickIcons).map(ic => (
              <button key={ic} onClick={() => onSelect(ic)} style={{
                ...s.btnSmall, fontSize: 16, padding: "4px 8px",
                background: value === ic ? COLORS.accent + "30" : COLORS.surface3,
                border: value === ic ? `1px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
              }}>{ic}</button>
            ))}
          </div>
          {expanded && emojiCategories.map(([cat, icons]) => (
            <div key={cat} style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{cat}</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {icons.map(ic => (
                  <button key={ic} onClick={() => onSelect(ic)} style={{
                    ...s.btnSmall, fontSize: 16, padding: "4px 8px",
                    background: value === ic ? COLORS.accent + "30" : COLORS.surface3,
                    border: value === ic ? `1px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
                  }}>{ic}</button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => setExpanded(!expanded)} style={{ ...s.btnSmall, marginTop: 8, fontSize: 11, color: COLORS.accent, background: "transparent", border: "none", padding: "4px 0", cursor: "pointer" }}>
            {expanded ? "▲ Menos ícones" : "▼ Mais ícones (100+)"}
          </button>
        </>
      )}

      {tab === "lucide" && (
        <>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar ícone..."
            style={{ ...s.input, fontSize: 11, marginBottom: 6, width: "100%" }}
          />

          {/* View mode toggle */}
          <div style={{ display: "flex", gap: 4, marginBottom: 8, alignItems: "center" }}>
            <button onClick={() => setViewMode("grid")} style={{
              ...s.btnSmall, padding: "4px 10px", fontSize: 10,
              background: viewMode === "grid" ? COLORS.accent : COLORS.surface3,
              color: viewMode === "grid" ? "#fff" : COLORS.textMuted,
              borderRadius: 4,
            }}>
              Grid
            </button>
            <button onClick={() => setViewMode("list")} style={{
              ...s.btnSmall, padding: "4px 10px", fontSize: 10,
              background: viewMode === "list" ? COLORS.accent : COLORS.surface3,
              color: viewMode === "list" ? "#fff" : COLORS.textMuted,
              borderRadius: 4,
            }}>
              Lista
            </button>
            <div style={{ flex: 1, fontSize: 10, color: COLORS.textDim, textAlign: "right" }}>
              {allLucideIcons.length} ícones
            </div>
          </div>

          {paginatedLucideCategories.map(([cat, icons]) => (
            <div key={cat} style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{cat}</div>

              {viewMode === "grid" ? (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {icons.map(ic => {
                    const lucideKey = `lucide:${ic}`;
                    const isSelected = value === lucideKey;
                    return (
                      <button key={ic} onClick={() => onSelect(lucideKey)} title={`${ic} (${cat})`} style={{
                        ...s.btnSmall, padding: "6px",
                        background: isSelected ? COLORS.accent + "30" : COLORS.surface3,
                        border: isSelected ? `1px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: isSelected ? COLORS.accent : COLORS.textMuted,
                      }}>
                        <LucideSvg name={ic} size={18} />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {icons.map(ic => {
                    const lucideKey = `lucide:${ic}`;
                    const isSelected = value === lucideKey;
                    return (
                      <button key={ic} onClick={() => onSelect(lucideKey)} style={{
                        ...s.btnSmall, textAlign: "left", padding: "6px 8px", fontSize: 11,
                        background: isSelected ? COLORS.accent + "15" : COLORS.surface3,
                        border: isSelected ? `1px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
                        display: "flex", alignItems: "center", gap: 8,
                        color: isSelected ? COLORS.accent : COLORS.text,
                      }}>
                        <LucideSvg name={ic} size={16} />
                        <span>{ic}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 8, borderTop: `1px solid ${COLORS.border}` }}>
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                style={{
                  ...s.btnSmall, padding: "4px 10px", fontSize: 10,
                  opacity: page === 0 ? 0.4 : 1,
                  cursor: page === 0 ? "not-allowed" : "pointer",
                  background: COLORS.surface3,
                }}
              >
                ← Anterior
              </button>
              <span style={{ fontSize: 10, color: COLORS.textDim }}>
                Página {page + 1} de {totalPages}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                style={{
                  ...s.btnSmall, padding: "4px 10px", fontSize: 10,
                  opacity: page >= totalPages - 1 ? 0.4 : 1,
                  cursor: page >= totalPages - 1 ? "not-allowed" : "pointer",
                  background: COLORS.surface3,
                }}
              >
                Próxima →
              </button>
            </div>
          )}

          {paginatedLucideCategories.length === 0 && (
            <div style={{ fontSize: 12, color: COLORS.textDim, padding: 16, textAlign: "center" }}>Nenhum ícone encontrado</div>
          )}
        </>
      )}
    </div>
  );
}
