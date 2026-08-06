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

import type { ComponentType } from 'svelte';

const ICON_MAP: Record<string, ComponentType> = {
  Clock, Newspaper, Info, GraduationCap, Heart, Users, Megaphone, ExternalLink, FileText, Menu, X,
};

const DEFAULTS: Record<string, string> = {
  route: 'FileText',
  page: 'FileText',
  link: 'ExternalLink',
};

export function getIconComponent(icon: string | null | undefined, kind: string): ComponentType {
  if (icon && ICON_MAP[icon]) return ICON_MAP[icon];
  const fallback = DEFAULTS[kind] ?? 'FileText';
  return ICON_MAP[fallback];
}