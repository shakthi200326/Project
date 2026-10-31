/**
 * The symbol for each action, named by what the action does.
 *
 * Kept in one table so "edit" is the same pencil on every screen, and a
 * screen asks for `icon="edit"` rather than importing a glyph of its own --
 * which is how one list ends up with a pencil and the next with a gear.
 *
 * Some entries are aliases (`trash` and `delete`, `chart` and `usage`):
 * the admin screens named their icons by shape before this table existed,
 * and both spellings resolve to the same glyph.
 */

import {
  ArrowDown,
  ArrowUp,
  Ban,
  ChartColumn,
  ChevronRight,
  Copy,
  CopyPlus,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  History,
  Pencil,
  Power,
  RotateCcw,
  ShieldCheck,
  Settings2,
  Trash2,
  Unlink,
  X,
} from "lucide-react";

export const ACTION_ICONS = {
  view: Eye,
  edit: Pencil,
  manage: Settings2,
  permissions: ShieldCheck,
  open: ChevronRight,
  chevronRight: ChevronRight,
  external: ExternalLink,
  delete: Trash2,
  remove: Trash2,
  trash: Trash2,
  unlink: Unlink,
  deactivate: Ban,
  ban: Ban,
  disable: Power,
  restore: RotateCcw,
  download: Download,
  export: Download,
  copy: Copy,
  duplicate: CopyPlus,
  history: History,
  versions: History,
  usage: ChartColumn,
  chart: ChartColumn,
  arrowUp: ArrowUp,
  arrowDown: ArrowDown,
  close: X,
  show: Eye,
  hide: EyeOff,
};
