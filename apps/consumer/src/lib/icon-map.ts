import {
  Clock,
  Newspaper,
  Info,
  GraduationCap,
  Heart,
  Users,
  Megaphone,
  ExternalLink,
  FileText,
  Menu,
  X
} from 'lucide-svelte';

const ICON_MAP: Record<string, any> = {
  Clock, Newspaper, Info, GraduationCap, Heart, Users, Megaphone, ExternalLink, FileText, Menu, X,
};

const DEFAULTS: Record<string, string> = {
  route: 'FileText',
  page: 'FileText',
  link: 'ExternalLink',
};

export function getIconComponent(icon: string | null | undefined, kind: string): any {
  if (icon && ICON_MAP[icon]) return ICON_MAP[icon];
  const fallback = DEFAULTS[kind] ?? 'FileText';
  return ICON_MAP[fallback];
}