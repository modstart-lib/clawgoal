import Activity from '~icons/lucide/activity'
import AlertCircle from '~icons/lucide/alert-circle'
import AlertTriangle from '~icons/lucide/alert-triangle'
import Archive from '~icons/lucide/archive'
import ArrowRight from '~icons/lucide/arrow-right'
import Award from '~icons/lucide/award'
import BarChart from '~icons/lucide/bar-chart'
import BarChart2 from '~icons/lucide/bar-chart-2'
import Bell from '~icons/lucide/bell'
import Bike from '~icons/lucide/bike'
import Book from '~icons/lucide/book'
import BookOpen from '~icons/lucide/book-open'
import Bookmark from '~icons/lucide/bookmark'
import Bot from '~icons/lucide/bot'
import Box from '~icons/lucide/box'
import Briefcase from '~icons/lucide/briefcase'
import Bug from '~icons/lucide/bug'
import Building from '~icons/lucide/building'
import Building2 from '~icons/lucide/building-2'
import Calendar from '~icons/lucide/calendar'
import Camera from '~icons/lucide/camera'
import Car from '~icons/lucide/car'
import Check from '~icons/lucide/check'
import CheckCircle from '~icons/lucide/check-circle'
import CheckSquare from '~icons/lucide/check-square'
import ChevronRight from '~icons/lucide/chevron-right'
import Circle from '~icons/lucide/circle'
import Clipboard from '~icons/lucide/clipboard'
import Clock from '~icons/lucide/clock'
import Cloud from '~icons/lucide/cloud'
import Code from '~icons/lucide/code'
import Code2 from '~icons/lucide/code-2'
import Coffee from '~icons/lucide/coffee'
import Compass from '~icons/lucide/compass'
import CreditCard from '~icons/lucide/credit-card'
import Crown from '~icons/lucide/crown'
import Database from '~icons/lucide/database'
import Diamond from '~icons/lucide/diamond'
import DollarSign from '~icons/lucide/dollar-sign'
import Download from '~icons/lucide/download'
import Dumbbell from '~icons/lucide/dumbbell'
import Edit from '~icons/lucide/edit'
import Eye from '~icons/lucide/eye'
import FileText from '~icons/lucide/file-text'
import Film from '~icons/lucide/film'
import Filter from '~icons/lucide/filter'
import Flag from '~icons/lucide/flag'
import Flame from '~icons/lucide/flame'
import Flower2 from '~icons/lucide/flower-2'
import Folder from '~icons/lucide/folder'
import FolderOpen from '~icons/lucide/folder-open'
import Gift from '~icons/lucide/gift'
import Globe from '~icons/lucide/globe'
import GraduationCap from '~icons/lucide/graduation-cap'
import Grid from '~icons/lucide/grid'
import Hash from '~icons/lucide/hash'
import Heart from '~icons/lucide/heart'
import HeartHandshake from '~icons/lucide/heart-handshake'
import Home from '~icons/lucide/home'
import Image from '~icons/lucide/image'
import Inbox from '~icons/lucide/inbox'
import Info from '~icons/lucide/info'
import Landmark from '~icons/lucide/landmark'
import Laptop from '~icons/lucide/laptop'
import Layers from '~icons/lucide/layers'
import Layout from '~icons/lucide/layout'
import Leaf from '~icons/lucide/leaf'
import Lightbulb from '~icons/lucide/lightbulb'
import Link from '~icons/lucide/link'
import List from '~icons/lucide/list'
import ListChecks from '~icons/lucide/list-checks'
import Lock from '~icons/lucide/lock'
import LogIn from '~icons/lucide/log-in'
import Mail from '~icons/lucide/mail'
import Map from '~icons/lucide/map'
import MapPin from '~icons/lucide/map-pin'
import Medal from '~icons/lucide/medal'
import MessageCircle from '~icons/lucide/message-circle'
import MessageSquare from '~icons/lucide/message-square'
import Mic from '~icons/lucide/mic'
import Moon from '~icons/lucide/moon'
import Music from '~icons/lucide/music'
import Network from '~icons/lucide/network'
import Package from '~icons/lucide/package'
import Pencil from '~icons/lucide/pencil'
import Phone from '~icons/lucide/phone'
import PieChart from '~icons/lucide/pie-chart'
import Pin from '~icons/lucide/pin'
import Play from '~icons/lucide/play'
import Plus from '~icons/lucide/plus'
import PlusCircle from '~icons/lucide/plus-circle'
import Power from '~icons/lucide/power'
import Printer from '~icons/lucide/printer'
import Puzzle from '~icons/lucide/puzzle'
import RefreshCw from '~icons/lucide/refresh-cw'
import Rocket from '~icons/lucide/rocket'
import Save from '~icons/lucide/save'
import Search from '~icons/lucide/search'
import Send from '~icons/lucide/send'
import Settings from '~icons/lucide/settings'
import Share from '~icons/lucide/share'
import Shield from '~icons/lucide/shield'
import ShoppingBag from '~icons/lucide/shopping-bag'
import ShoppingCart from '~icons/lucide/shopping-cart'
import Sliders from '~icons/lucide/sliders'
import Smile from '~icons/lucide/smile'
import Sparkles from '~icons/lucide/sparkles'
import Star from '~icons/lucide/star'
import Sun from '~icons/lucide/sun'
import Tag from '~icons/lucide/tag'
import Target from '~icons/lucide/target'
import Terminal from '~icons/lucide/terminal'
import ThumbsUp from '~icons/lucide/thumbs-up'
import Timer from '~icons/lucide/timer'
import Trash from '~icons/lucide/trash'
import TrendingUp from '~icons/lucide/trending-up'
import Trophy from '~icons/lucide/trophy'
import Truck from '~icons/lucide/truck'
import User from '~icons/lucide/user'
import UserCheck from '~icons/lucide/user-check'
import Users from '~icons/lucide/users'
import Video from '~icons/lucide/video'
import Wallet from '~icons/lucide/wallet'
import Wrench from '~icons/lucide/wrench'
import Zap from '~icons/lucide/zap'
import ZapOff from '~icons/lucide/zap-off'
export interface IconItem {
  name: string
  label: string
  component: any
}

export const ICON_LIST: IconItem[] = [
  // 目标 & 进度
  { name: 'Target', label: 'Target', component: Target },
  { name: 'Rocket', label: 'Rocket', component: Rocket },
  { name: 'Flame', label: 'Flame', component: Flame },
  { name: 'Trophy', label: 'Trophy', component: Trophy },
  { name: 'Medal', label: 'Medal', component: Medal },
  { name: 'Award', label: 'Award', component: Award },
  { name: 'Crown', label: 'Crown', component: Crown },
  { name: 'Star', label: 'Star', component: Star },
  { name: 'Sparkles', label: 'Sparkles', component: Sparkles },
  { name: 'Zap', label: 'Zap', component: Zap },
  { name: 'ZapOff', label: 'ZapOff', component: ZapOff },
  { name: 'TrendingUp', label: 'TrendingUp', component: TrendingUp },
  { name: 'Activity', label: 'Activity', component: Activity },
  { name: 'Flag', label: 'Flag', component: Flag },
  { name: 'CheckCircle', label: 'CheckCircle', component: CheckCircle },
  { name: 'CheckSquare', label: 'CheckSquare', component: CheckSquare },
  { name: 'Check', label: 'Check', component: Check },
  // 工作 & 任务
  { name: 'Briefcase', label: 'Briefcase', component: Briefcase },
  { name: 'Clipboard', label: 'Clipboard', component: Clipboard },
  { name: 'ListChecks', label: 'ListChecks', component: ListChecks },
  { name: 'List', label: 'List', component: List },
  { name: 'Grid', label: 'Grid', component: Grid },
  { name: 'Layout', label: 'Layout', component: Layout },
  { name: 'Calendar', label: 'Calendar', component: Calendar },
  { name: 'Clock', label: 'Clock', component: Clock },
  { name: 'Timer', label: 'Timer', component: Timer },
  { name: 'Pin', label: 'Pin', component: Pin },
  { name: 'Bookmark', label: 'Bookmark', component: Bookmark },
  { name: 'Tag', label: 'Tag', component: Tag },
  { name: 'Hash', label: 'Hash', component: Hash },
  { name: 'Filter', label: 'Filter', component: Filter },
  // 学习 & 知识
  { name: 'Book', label: 'Book', component: Book },
  { name: 'BookOpen', label: 'BookOpen', component: BookOpen },
  { name: 'GraduationCap', label: 'GraduationCap', component: GraduationCap },
  { name: 'Lightbulb', label: 'Lightbulb', component: Lightbulb },
  { name: 'Edit', label: 'Edit', component: Edit },
  { name: 'Pencil', label: 'Pencil', component: Pencil },
  { name: 'FileText', label: 'FileText', component: FileText },
  { name: 'Inbox', label: 'Inbox', component: Inbox },
  // 技术 & 开发
  { name: 'Code', label: 'Code', component: Code },
  { name: 'Code2', label: 'Code2', component: Code2 },
  { name: 'Terminal', label: 'Terminal', component: Terminal },
  { name: 'Database', label: 'Database', component: Database },
  { name: 'Cloud', label: 'Cloud', component: Cloud },
  { name: 'Layers', label: 'Layers', component: Layers },
  { name: 'Network', label: 'Network', component: Network },
  { name: 'Bug', label: 'Bug', component: Bug },
  { name: 'Puzzle', label: 'Puzzle', component: Puzzle },
  { name: 'Bot', label: 'Bot', component: Bot },
  { name: 'Laptop', label: 'Laptop', component: Laptop },
  // 健康 & 生活
  { name: 'Heart', label: 'Heart', component: Heart },
  {
    name: 'HeartHandshake',
    label: 'HeartHandshake',
    component: HeartHandshake,
  },
  { name: 'Dumbbell', label: 'Dumbbell', component: Dumbbell },
  { name: 'Bike', label: 'Bike', component: Bike },
  { name: 'Moon', label: 'Moon', component: Moon },
  { name: 'Sun', label: 'Sun', component: Sun },
  { name: 'Flower2', label: 'Flower2', component: Flower2 },
  { name: 'Leaf', label: 'Leaf', component: Leaf },
  { name: 'Coffee', label: 'Coffee', component: Coffee },
  { name: 'Smile', label: 'Smile', component: Smile },
  // 社交 & 通信
  { name: 'Users', label: 'Users', component: Users },
  { name: 'User', label: 'User', component: User },
  { name: 'UserCheck', label: 'UserCheck', component: UserCheck },
  { name: 'Mail', label: 'Mail', component: Mail },
  { name: 'MessageCircle', label: 'MessageCircle', component: MessageCircle },
  { name: 'MessageSquare', label: 'MessageSquare', component: MessageSquare },
  { name: 'Bell', label: 'Bell', component: Bell },
  { name: 'Send', label: 'Send', component: Send },
  { name: 'Phone', label: 'Phone', component: Phone },
  { name: 'Mic', label: 'Mic', component: Mic },
  { name: 'Share', label: 'Share', component: Share },
  { name: 'ThumbsUp', label: 'ThumbsUp', component: ThumbsUp },
  // 财务 & 商业
  { name: 'Wallet', label: 'Wallet', component: Wallet },
  { name: 'CreditCard', label: 'CreditCard', component: CreditCard },
  { name: 'DollarSign', label: 'DollarSign', component: DollarSign },
  { name: 'ShoppingCart', label: 'ShoppingCart', component: ShoppingCart },
  { name: 'ShoppingBag', label: 'ShoppingBag', component: ShoppingBag },
  { name: 'Package', label: 'Package', component: Package },
  { name: 'Box', label: 'Box', component: Box },
  { name: 'Gift', label: 'Gift', component: Gift },
  { name: 'BarChart', label: 'BarChart', component: BarChart },
  { name: 'BarChart2', label: 'BarChart2', component: BarChart2 },
  { name: 'PieChart', label: 'PieChart', component: PieChart },
  // 导航 & 位置
  { name: 'Home', label: 'Home', component: Home },
  { name: 'MapPin', label: 'MapPin', component: MapPin },
  { name: 'Map', label: 'Map', component: Map },
  { name: 'Compass', label: 'Compass', component: Compass },
  { name: 'Globe', label: 'Globe', component: Globe },
  { name: 'ArrowRight', label: 'ArrowRight', component: ArrowRight },
  { name: 'ChevronRight', label: 'ChevronRight', component: ChevronRight },
  { name: 'Link', label: 'Link', component: Link },
  // 设置 & 工具
  { name: 'Settings', label: 'Settings', component: Settings },
  { name: 'Sliders', label: 'Sliders', component: Sliders },
  { name: 'Wrench', label: 'Wrench', component: Wrench },
  { name: 'Lock', label: 'Lock', component: Lock },
  { name: 'Shield', label: 'Shield', component: Shield },
  { name: 'Eye', label: 'Eye', component: Eye },
  { name: 'Search', label: 'Search', component: Search },
  { name: 'RefreshCw', label: 'RefreshCw', component: RefreshCw },
  { name: 'Download', label: 'Download', component: Download },
  { name: 'Save', label: 'Save', component: Save },
  { name: 'Trash', label: 'Trash', component: Trash },
  { name: 'Archive', label: 'Archive', component: Archive },
  { name: 'Printer', label: 'Printer', component: Printer },
  // 媒体 & 创意
  { name: 'Image', label: 'Image', component: Image },
  { name: 'Camera', label: 'Camera', component: Camera },
  { name: 'Video', label: 'Video', component: Video },
  { name: 'Film', label: 'Film', component: Film },
  { name: 'Music', label: 'Music', component: Music },
  { name: 'Play', label: 'Play', component: Play },
  // 地点 & 场所
  { name: 'Building', label: 'Building', component: Building },
  { name: 'Building2', label: 'Building2', component: Building2 },
  { name: 'Landmark', label: 'Landmark', component: Landmark },
  { name: 'Car', label: 'Car', component: Car },
  { name: 'Truck', label: 'Truck', component: Truck },
  // 其它
  { name: 'Circle', label: 'Circle', component: Circle },
  { name: 'Diamond', label: 'Diamond', component: Diamond },
  { name: 'Plus', label: 'Plus', component: Plus },
  { name: 'PlusCircle', label: 'PlusCircle', component: PlusCircle },
  { name: 'Info', label: 'Info', component: Info },
  { name: 'AlertCircle', label: 'AlertCircle', component: AlertCircle },
  { name: 'AlertTriangle', label: 'AlertTriangle', component: AlertTriangle },
  { name: 'LogIn', label: 'LogIn', component: LogIn },
  { name: 'Power', label: 'Power', component: Power },
  { name: 'Folder', label: 'Folder', component: Folder },
  { name: 'FolderOpen', label: 'FolderOpen', component: FolderOpen },
]

export const ICON_MAP = Object.fromEntries(
  ICON_LIST.map((i) => [i.name, i.component])
)

export function getIconComponent(name: string): any {
  return ICON_MAP[name] ?? null
}

export function getRandomIconName(): string {
  return ICON_LIST[Math.floor(Math.random() * ICON_LIST.length)].name
}
