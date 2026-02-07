// ============================================================================
// Orqui Runtime — Icon System (Lucide Icons)
// ============================================================================
import React from "react";
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

// Create icon registry for dynamic lookup
const LUCIDE_ICON_REGISTRY: Record<string, React.ComponentType<LucideProps>> = {
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

// Export registry
export { LUCIDE_ICON_REGISTRY };

// Mapeamento de nomes Phosphor (antigos) para Lucide
const PHOSPHOR_TO_LUCIDE_MAP: Record<string, string> = {
  // Sidebar navigation icons
  "hurricane-duotone": "Tornado",
  "hurricane": "Tornado",
  "brain-duotone": "Brain",
  "brain": "Brain",
  "arrows-clockwise-duotone": "RefreshCw",
  "arrows-clockwise": "RefreshCw",
  "squares-four": "LayoutGrid",
  "file": "File",
  "shield-check": "ShieldCheck",
  "gear": "Settings",

  // Common icons
  "sign-out": "LogOut",
  "sign-in": "LogIn",
  "magnifying-glass": "Search",
  "axe-duotone": "Axe",
  "axe": "Axe",
  "house": "Home",
  "user": "User",
  "caret-right": "ChevronRight",
  "caret-left": "ChevronLeft",
  "caret-down": "ChevronDown",
  "caret-up": "ChevronUp",
  "x": "X",
  "check": "Check",
  "plus": "Plus",
  "minus": "Minus",
};

/**
 * Get Lucide icon component by name (supports both lucide: prefix and ph: legacy)
 */
function getLucideIcon(iconName: string): React.ComponentType<LucideProps> | null {
  // Remove prefix if present
  let name = iconName;
  if (name.startsWith("lucide:")) {
    name = name.slice(7);
  } else if (name.startsWith("ph:")) {
    // Legacy Phosphor support - map to Lucide equivalent
    const phosphorName = name.slice(3);
    name = PHOSPHOR_TO_LUCIDE_MAP[phosphorName] || phosphorName;
  }

  // Try exact match from registry (PascalCase)
  if (LUCIDE_ICON_REGISTRY[name]) {
    return LUCIDE_ICON_REGISTRY[name];
  }

  // Try PascalCase conversion (kebab-case → PascalCase)
  const pascalCase = name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  if (LUCIDE_ICON_REGISTRY[pascalCase]) {
    return LUCIDE_ICON_REGISTRY[pascalCase];
  }

  return null;
}

/**
 * Render an icon value — supports emoji strings, "lucide:icon-name", or legacy "ph:icon-name"
 */
export function IconValue({
  icon,
  size = 20,
  color = "currentColor",
  enhanced = false,
  showDebug = false,
}: {
  icon?: string; // Keep as string for backwards compatibility (IconValue type is too strict for runtime)
  size?: number;
  color?: string;
  enhanced?: boolean;
  showDebug?: boolean;
}) {
  if (!icon) {
    if (showDebug) {
      console.warn('[Orqui Icons] IconValue called with no icon prop');
    }
    // Fallback visual when icon is missing
    return (
      <span
        style={{
          fontSize: size,
          opacity: 0.3,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
        }}
        title="Icon missing"
      >
        ◯
      </span>
    );
  }

  // Check if it's a Lucide icon (lucide: prefix) or legacy Phosphor (ph: prefix)
  if (icon.startsWith("lucide:") || icon.startsWith("ph:")) {
    const IconComponent = getLucideIcon(icon);

    if (!IconComponent) {
      if (showDebug) {
        console.warn(`[Orqui Icons] Icon "${icon}" not found in Lucide`);
      }
      return (
        <span
          style={{ fontSize: size, opacity: 0.5 }}
          title={`Icon not found: ${icon}`}
        >
          ⚠️
        </span>
      );
    }

    // Render Lucide icon with wrapper to enforce size
    // Using ref + useEffect to force display with !important
    const wrapperRef = React.useRef<HTMLSpanElement>(null);

    React.useEffect(() => {
      if (wrapperRef.current) {
        wrapperRef.current.style.setProperty('display', 'inline-flex', 'important');
      }
    }, []);

    return (
      <span
        ref={wrapperRef}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          flexShrink: 0,
          flexGrow: 0,
        }}
      >
        <IconComponent
          size={size}
          color={color}
          strokeWidth={enhanced ? 2.5 : 2}
          style={{
            minWidth: size,
            minHeight: size,
            flexShrink: 0,
          }}
        />
      </span>
    );
  }

  // Emoji fallback
  return <span style={{ fontSize: size, lineHeight: 1 }}>{icon}</span>;
}

// ============================================================================
// LEGACY EXPORTS - Kept for backwards compatibility with other components
// ============================================================================
// These are empty/stub implementations. All new code should use IconValue with Lucide.
// Components still using these: AppShell (favicon), HeaderElements, EmptyState, NodeRenderer

/**
 * @deprecated Use Lucide icons via IconValue instead
 * Legacy Phosphor SVG paths - now empty for backwards compatibility
 */
export const PHOSPHOR_SVG_PATHS: Record<string, any> = {};

/**
 * @deprecated Use IconValue with lucide: prefix instead
 * Legacy Phosphor icon component - returns null
 */
export function PhosphorIcon(): null {
  return null;
}

/**
 * @deprecated Favicon generation should use Lucide or emoji
 * Legacy Phosphor favicon builder - returns null
 */
export function buildPhosphorFaviconSvg(): null {
  return null;
}
