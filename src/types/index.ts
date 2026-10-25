export interface ChartDataset {
  label: string;
  total: number;
  data: number[];
  fromLabel: string;
  toLabel: string;
}

export interface PieChartSlice {
  id: string;
  label: string;
  value: number;
  color?: string;
}
