import type React from 'react';

export interface SwitcherItem {
  id: string;
  label: React.ReactNode;
  searchText?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  disabled?: boolean;
}

export interface SwitcherAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}
