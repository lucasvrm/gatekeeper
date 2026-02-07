// Find which icon from LUCIDE_TOP_300 is not in any category

const LUCIDE_TOP_300 = [
  "Activity", "Airplay", "AlarmClock", "AlertCircle", "AlertOctagon", "AlertTriangle",
  "Archive", "ArrowDown", "ArrowDownCircle", "ArrowDownLeft", "ArrowDownRight", "ArrowLeft",
  "ArrowRight", "ArrowUp", "ArrowUpCircle", "ArrowUpLeft", "ArrowUpRight", "AtSign",
  "Award", "Ban", "Banknote", "BarChart", "BarChart2", "BarChart3", "Battery", "BatteryCharging",
  "Bell", "BellOff", "BellRing", "Binary", "Bluetooth", "Bookmark", "Box", "Boxes",
  "Bug", "Calendar", "CalendarClock", "CalendarDays", "Camera", "Cast", "Check",
  "CheckCircle", "CheckCircle2", "ChevronDown", "ChevronLeft", "ChevronRight", "ChevronsDown",
  "ChevronsLeft", "ChevronsRight", "ChevronsUp", "ChevronUp", "Circle", "Clipboard",
  "ClipboardCheck", "ClipboardCopy", "ClipboardList", "Clock", "Cloud", "CloudRain",
  "CloudSnow", "Code", "Code2", "Coins", "Command", "Component", "Contact",
  "Container", "Copy", "CornerDownLeft", "CornerDownRight", "CornerUpLeft", "CornerUpRight",
  "Cpu", "CreditCard", "Crosshair", "Crown", "Database", "Diamond", "DollarSign",
  "DoorClosed", "DoorOpen", "Download", "Edit", "Edit2", "Edit3", "Eraser", "Euro",
  "Eye", "EyeOff", "File", "FileAudio", "FileCode", "FileImage", "FileText",
  "FileVideo", "Files", "Film", "Filter",
  "Flag", "Flame", "Folder", "FolderCheck", "FolderLock", "FolderMinus", "FolderOpen",
  "FolderPlus", "FolderX", "Forward", "Frown", "Gift", "Github", "Gitlab", "Globe",
  "Grid3x3", "Grip", "GripHorizontal", "GripVertical", "Hammer", "Hand", "HardDrive",
  "Hash", "Headphones", "Heart", "HelpCircle", "Highlighter", "Home", "Hourglass",
  "Image", "Images", "Inbox", "Info", "Key", "Laptop", "Laugh", "Layers", "LayoutGrid",
  "LayoutList", "Link", "List", "Loader", "Loader2", "Lock", "LockKeyhole",
  "LockKeyholeOpen", "LogIn", "LogOut", "Mail", "MailOpen", "Map", "MapPin", "Maximize",
  "Meh", "Menu", "MessageCircle", "MessageSquare", "MessagesSquare", "Mic", "MicOff",
  "Minimize", "Minus", "MinusCircle", "Monitor", "Moon", "MoreHorizontal", "MoreVertical",
  "Move", "MoveDown", "MoveLeft", "MoveRight", "MoveUp", "Music", "Music2", "Navigation",
  "Navigation2", "Package", "PanelLeft", "PanelRight", "Paperclip", "Pause",
  "Pen", "PenLine", "PenTool", "Pencil", "Percent", "Phone", "PhoneCall", "PhoneIncoming",
  "PhoneMissed", "PhoneOff", "PhoneOutgoing", "PieChart", "Play", "Plus", "PlusCircle",
  "Plug", "Podcast", "PoundSterling", "Power", "PowerOff", "Radio", "Receipt", "Redo",
  "RefreshCcw", "RefreshCw", "Reply", "RotateCcw", "RotateCw", "Save", "Scissors",
  "Search", "Send", "Server", "Settings", "Share", "Share2", "Shield", "ShieldAlert",
  "ShieldCheck", "ShieldX", "ShoppingBag", "ShoppingCart", "Sidebar", "Signal",
  "SkipBack", "SkipForward", "Slash", "Sliders", "Smartphone", "Smile", "Sparkles",
  "Square", "Star", "Sun", "Sunrise", "Sunset", "Table", "Tablet", "Tag", "Tags",
  "Target", "Terminal", "TestTube", "ThumbsDown", "ThumbsUp", "Ticket", "Timer",
  "Trash2", "TrendingDown", "TrendingUp", "Triangle", "Trophy", "Undo",
  "Unlock", "Upload", "User", "UserCheck", "UserCircle", "UserMinus", "UserPlus",
  "Users", "UserSquare", "UserX", "Video", "VideoOff", "Volume", "Volume1", "Volume2",
  "VolumeX", "Wallet", "Wind", "Workflow", "Wrench", "X", "XCircle", "XOctagon",
  "Zap", "ZoomIn", "ZoomOut"
];

const LUCIDE_CATEGORIES = {
  "Interface": [
    "Home", "Settings", "Search", "Menu", "X", "Check", "Plus", "Minus", "Edit", "Trash2",
    "Save", "Download", "Upload", "Copy", "Link", "Filter", "Grid3x3", "List",
    "LayoutGrid", "LayoutList", "Sidebar", "PanelLeft", "PanelRight", "ChevronRight", "ChevronLeft",
    "ChevronDown", "ChevronUp", "MoreVertical", "MoreHorizontal", "Maximize", "Minimize",
    "ZoomIn", "ZoomOut", "Eye", "EyeOff",
  ],
  "Arrows & Navigation": [
    "ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "ArrowUpRight", "ArrowDownRight",
    "ArrowUpLeft", "ArrowDownLeft", "ChevronsRight", "ChevronsLeft", "ChevronsUp", "ChevronsDown",
    "MoveRight", "MoveLeft", "MoveUp", "MoveDown", "CornerUpRight", "CornerUpLeft",
    "CornerDownRight", "CornerDownLeft", "Undo", "Redo", "RotateCw", "RotateCcw",
  ],
  "Files & Folders": [
    "File", "FileText", "FileCode", "FileImage", "FileVideo", "FileAudio",
    "Files", "Folder", "FolderOpen", "FolderPlus", "FolderMinus", "FolderCheck", "FolderX",
    "FolderLock", "Archive", "Package", "Clipboard", "ClipboardCheck", "ClipboardCopy",
    "ClipboardList", "Paperclip", "Inbox",
  ],
  "System & Settings": [
    "Settings", "Sliders", "Wrench", "Hammer", "Activity", "Zap", "Power",
    "PowerOff", "Plug", "Battery", "BatteryCharging", "Bluetooth", "Cast",
    "Monitor", "Smartphone", "Tablet", "Laptop", "HardDrive", "Cpu", "Database", "Server",
    "Signal", "Command", "Terminal", "Component",
  ],
  "Users & Authentication": [
    "User", "UserPlus", "UserMinus", "UserCheck", "UserX", "Users", "UserCircle",
    "UserSquare", "Contact", "Shield", "ShieldCheck", "ShieldAlert", "ShieldX",
    "Lock", "Unlock", "LockKeyhole", "LockKeyholeOpen", "Key", "DoorClosed", "DoorOpen",
    "LogOut", "LogIn",
  ],
  "Communication": [
    "Bell", "BellOff", "BellRing", "Mail", "MailOpen", "Inbox", "Send",
    "MessageCircle", "MessageSquare", "MessagesSquare", "Phone", "PhoneCall", "PhoneIncoming",
    "PhoneOutgoing", "PhoneMissed", "PhoneOff", "Video", "VideoOff", "Mic", "MicOff",
    "AtSign", "Hash", "Share", "Share2", "Forward", "Reply",
  ],
  "Media & Content": [
    "Image", "Images", "Camera", "Video", "Film", "Music", "Music2", "Headphones",
    "Volume", "Volume1", "Volume2", "VolumeX", "Play", "Pause", "SkipForward", "SkipBack",
    "Square", "Circle", "Triangle", "Radio", "Podcast", "Airplay",
  ],
  "Commerce & Business": [
    "ShoppingCart", "ShoppingBag", "CreditCard", "Wallet", "DollarSign", "Euro",
    "PoundSterling", "Coins", "Banknote", "Tag", "Tags", "Ticket", "Gift", "Package",
    "Box", "Percent", "Receipt", "TrendingUp", "TrendingDown", "BarChart",
  ],
  "Data & Charts": [
    "BarChart", "BarChart2", "BarChart3", "PieChart", "Activity", "TrendingUp",
    "TrendingDown", "ArrowUpCircle", "ArrowDownCircle", "Table", "Database", "Binary",
    "Code",
  ],
  "Alerts & Status": [
    "AlertCircle", "AlertTriangle", "AlertOctagon", "Info", "HelpCircle", "CheckCircle",
    "CheckCircle2", "XCircle", "XOctagon", "Slash", "Ban", "MinusCircle", "PlusCircle",
    "Clock", "Timer", "Hourglass", "Loader", "Loader2", "RefreshCw", "RefreshCcw",
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
    "Code", "Code2", "Terminal", "Command", "Github", "Gitlab", "FileCode", "Bug",
    "TestTube", "Package", "Boxes", "Container", "Layers", "Component", "Workflow",
  ],
  "Location & Travel": [
    "Map", "MapPin", "Navigation", "Navigation2", "Globe",
  ],
  "Misc Utility": [
    "Calendar", "CalendarDays", "CalendarClock", "Clock", "Timer", "AlarmClock",
    "Sun", "Moon", "Sunrise", "Sunset", "Cloud", "CloudRain", "CloudSnow", "Wind",
  ],
};

// Flatten all categories
const categorizedIcons = new Set(Object.values(LUCIDE_CATEGORIES).flat());

// Find uncategorized icons
const uncategorized = LUCIDE_TOP_300.filter(icon => !categorizedIcons.has(icon));

console.log('\n📊 Analysis:');
console.log(`Total icons in LUCIDE_TOP_300: ${LUCIDE_TOP_300.length}`);
console.log(`Total categorized icons: ${categorizedIcons.size}`);
console.log(`Uncategorized icons: ${uncategorized.length}`);

if (uncategorized.length > 0) {
  console.log('\n⚠️ Uncategorized icons:');
  uncategorized.forEach(icon => {
    console.log(`  - ${icon}`);
  });
} else {
  console.log('\n✅ All icons are categorized!');
}
