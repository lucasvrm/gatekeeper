// Script para verificar quais ícones do Lucide realmente existem
import * as LucideIcons from 'lucide-react';

// Lista de ícones que queremos verificar
const iconsToCheck = [
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
  "Navigation2", "Package", "PanelLeft", "PanelRight", "Paperclip", "Paste", "Pause",
  "Pen", "PenLine", "PenTool", "Pencil", "Percent", "Phone", "PhoneCall", "PhoneIncoming",
  "PhoneMissed", "PhoneOff", "PhoneOutgoing", "PieChart", "Play", "Plus", "PlusCircle",
  "Plug", "Podcast", "PoundSterling", "Power", "PowerOff", "Radio", "Receipt", "Redo",
  "RefreshCcw", "RefreshCw", "Reply", "RotateCcw", "RotateCw", "Save", "Scissors",
  "Search", "Send", "Server", "Settings", "Share", "Share2", "Shield", "ShieldAlert",
  "ShieldCheck", "ShieldX", "ShoppingBag", "ShoppingCart", "Sidebar", "Signal",
  "SkipBack", "SkipForward", "Slash", "Sliders", "Smartphone", "Smile", "Sparkles",
  "Square", "Star", "Sun", "Sunrise", "Sunset", "Table", "Tablet", "Tag", "Tags",
  "Target", "Terminal", "TestTube", "ThumbsDown", "ThumbsUp", "Ticket", "Timer",
  "Tool", "Trash2", "TrendingDown", "TrendingUp", "Triangle", "Trophy", "Undo",
  "Unlock", "Upload", "User", "UserCheck", "UserCircle", "UserMinus", "UserPlus",
  "Users", "UserSquare", "UserX", "Video", "VideoOff", "Volume", "Volume1", "Volume2",
  "VolumeX", "Wallet", "Wind", "Workflow", "Wrench", "X", "XCircle", "XOctagon",
  "Zap", "ZoomIn", "ZoomOut"
];

console.log('\n🔍 Verificando ícones do Lucide React...\n');
console.log(`Total de ícones para verificar: ${iconsToCheck.length}\n`);

const existing = [];
const missing = [];

for (const iconName of iconsToCheck) {
  if (LucideIcons[iconName]) {
    existing.push(iconName);
  } else {
    missing.push(iconName);
  }
}

console.log(`✅ Ícones que EXISTEM: ${existing.length}`);
console.log(`❌ Ícones que NÃO EXISTEM: ${missing.length}\n`);

if (missing.length > 0) {
  console.log('❌ Ícones que não existem:');
  console.log('─────────────────────────────');
  missing.forEach(icon => console.log(`  - ${icon}`));
  console.log('\n');
}

console.log('✅ Lista de ícones válidos (copie para LUCIDE_TOP_300):');
console.log('═══════════════════════════════════════════════════════\n');
console.log('export const LUCIDE_TOP_300 = [');
for (let i = 0; i < existing.length; i += 6) {
  const batch = existing.slice(i, i + 6);
  console.log(`  ${batch.map(icon => `"${icon}"`).join(', ')},`);
}
console.log('] as const;\n');

console.log(`\n📊 Estatísticas:`);
console.log(`   Total verificado: ${iconsToCheck.length}`);
console.log(`   Existem: ${existing.length}`);
console.log(`   Faltando: ${missing.length}`);
console.log(`   Taxa de sucesso: ${((existing.length / iconsToCheck.length) * 100).toFixed(1)}%\n`);

// Exit code
process.exit(missing.length > 0 ? 1 : 0);
