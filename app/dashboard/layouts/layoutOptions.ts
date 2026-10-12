import { copy } from '@/app/copy'

export type LayoutMode = 'pages' | 'apps' | 'tabs' | 'expandable' | 'widgets'

export const layoutOptions: { id: LayoutMode; label: string }[] = [
  { id: 'pages', label: copy.dashboard.layouts.pages },
  { id: 'apps', label: copy.dashboard.layouts.apps },
  { id: 'tabs', label: copy.dashboard.layouts.tabs },
  { id: 'expandable', label: copy.dashboard.layouts.expandable },
  { id: 'widgets', label: copy.dashboard.layouts.widgets },
]