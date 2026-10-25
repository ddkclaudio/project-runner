export interface Timezone {
  id: string;
  label: string;
  offset: string;
}

export const TIMEZONES: Timezone[] = [
  { id: 'auto', label: 'Detectar automaticamente', offset: '' },
  {
    id: 'Etc/GMT+12',
    label: 'International Date Line West',
    offset: 'UTC-12:00',
  },
  {
    id: 'Etc/GMT+11',
    label: 'Coordinated Universal Time-11',
    offset: 'UTC-11:00',
  },
  { id: 'Pacific/Honolulu', label: 'Hawaii', offset: 'UTC-10:00' },
  { id: 'America/Anchorage', label: 'Alaska', offset: 'UTC-09:00' },
  { id: 'America/Santa_Isabel', label: 'Baja California', offset: 'UTC-08:00' },
  {
    id: 'America/Los_Angeles',
    label: 'Pacific Standard Time (US & Canada)',
    offset: 'UTC-08:00',
  },
  { id: 'America/Phoenix', label: 'Arizona', offset: 'UTC-07:00' },
  {
    id: 'America/Chihuahua',
    label: 'Chihuahua, La Paz, Mazatlan',
    offset: 'UTC-07:00',
  },
  {
    id: 'America/Denver',
    label: 'Mountain Time (US & Canada)',
    offset: 'UTC-07:00',
  },
  { id: 'America/Guatemala', label: 'Central America', offset: 'UTC-06:00' },
  {
    id: 'America/Chicago',
    label: 'Central Time (US & Canada)',
    offset: 'UTC-06:00',
  },
  {
    id: 'America/Mexico_City',
    label: 'Guadalajara, Mexico City, Monterrey',
    offset: 'UTC-06:00',
  },
  { id: 'America/Regina', label: 'Saskatchewan', offset: 'UTC-06:00' },
  {
    id: 'America/Bogota',
    label: 'Bogota, Lima, Quito, Rio Branco',
    offset: 'UTC-05:00',
  },
  {
    id: 'America/New_York',
    label: 'Eastern Time (US & Canada)',
    offset: 'UTC-05:00',
  },
  {
    id: 'America/Indiana/Indianapolis',
    label: 'Indiana (East)',
    offset: 'UTC-05:00',
  },
  { id: 'America/Caracas', label: 'Caracas', offset: 'UTC-04:30' },
  { id: 'America/Asuncion', label: 'Asuncion', offset: 'UTC-04:00' },
  {
    id: 'America/Halifax',
    label: 'Atlantic Time (Canada)',
    offset: 'UTC-04:00',
  },
  { id: 'America/Cuiaba', label: 'Cuiaba', offset: 'UTC-04:00' },
  {
    id: 'America/La_Paz',
    label: 'Georgetown, La Paz, Manaus, San Juan',
    offset: 'UTC-04:00',
  },
  { id: 'America/Santiago', label: 'Santiago', offset: 'UTC-04:00' },
  { id: 'America/St_Johns', label: 'Newfoundland', offset: 'UTC-03:30' },
  { id: 'America/Sao_Paulo', label: 'Brasília', offset: 'UTC-03:00' },
  {
    id: 'America/Argentina/Buenos_Aires',
    label: 'Buenos Aires',
    offset: 'UTC-03:00',
  },
  { id: 'America/Cayenne', label: 'Cayenne, Fortaleza', offset: 'UTC-03:00' },
  { id: 'America/Godthab', label: 'Greenland', offset: 'UTC-03:00' },
  { id: 'America/Montevideo', label: 'Montevideo', offset: 'UTC-03:00' },
  {
    id: 'Etc/GMT+2',
    label: 'Coordinated Universal Time-2',
    offset: 'UTC-02:00',
  },
  { id: 'Atlantic/Azores', label: 'Azores', offset: 'UTC-01:00' },
  {
    id: 'Atlantic/Cape_Verde',
    label: 'Cape Verde Islands',
    offset: 'UTC-01:00',
  },
  {
    id: 'Europe/London',
    label: 'Dublin, Edinburgh, Lisbon, London',
    offset: 'UTC+00:00',
  },
  {
    id: 'Europe/Berlin',
    label: 'Amsterdam, Berlin, Bern, Rome, Vienna',
    offset: 'UTC+01:00',
  },
  {
    id: 'Europe/Paris',
    label: 'Brussels, Copenhagen, Madrid, Paris',
    offset: 'UTC+01:00',
  },
  { id: 'Europe/Warsaw', label: 'Warsaw, Zagreb', offset: 'UTC+01:00' },
  {
    id: 'Europe/Athens',
    label: 'Athens, Bucharest, Istanbul',
    offset: 'UTC+02:00',
  },
  { id: 'Africa/Cairo', label: 'Cairo', offset: 'UTC+02:00' },
  {
    id: 'Europe/Helsinki',
    label: 'Helsinki, Kyiv, Riga, Sofia, Tallinn',
    offset: 'UTC+02:00',
  },
  { id: 'Asia/Jerusalem', label: 'Jerusalem', offset: 'UTC+02:00' },
  { id: 'Asia/Baghdad', label: 'Baghdad', offset: 'UTC+03:00' },
  {
    id: 'Europe/Moscow',
    label: 'Moscow, St. Petersburg, Volgograd',
    offset: 'UTC+03:00',
  },
  { id: 'Asia/Tehran', label: 'Tehran', offset: 'UTC+03:30' },
  { id: 'Asia/Dubai', label: 'Abu Dhabi, Muscat', offset: 'UTC+04:00' },
  { id: 'Asia/Kabul', label: 'Kabul', offset: 'UTC+04:30' },
  { id: 'Asia/Tashkent', label: 'Tashkent', offset: 'UTC+05:00' },
  {
    id: 'Asia/Kolkata',
    label: 'Chennai, Kolkata, Mumbai, New Delhi',
    offset: 'UTC+05:30',
  },
  { id: 'Asia/Colombo', label: 'Sri Jayawardenepura', offset: 'UTC+05:30' },
  { id: 'Asia/Dhaka', label: 'Astana, Dhaka', offset: 'UTC+06:00' },
  { id: 'Asia/Rangoon', label: 'Yangon (Rangoon)', offset: 'UTC+06:30' },
  { id: 'Asia/Bangkok', label: 'Bangkok, Hanoi, Jakarta', offset: 'UTC+07:00' },
  {
    id: 'Asia/Shanghai',
    label: 'Beijing, Chongqing, Hong Kong, Urumqi',
    offset: 'UTC+08:00',
  },
  {
    id: 'Asia/Singapore',
    label: 'Kuala Lumpur, Singapore',
    offset: 'UTC+08:00',
  },
  { id: 'Asia/Tokyo', label: 'Osaka, Sapporo, Tokyo', offset: 'UTC+09:00' },
  { id: 'Asia/Seoul', label: 'Seoul', offset: 'UTC+09:00' },
  { id: 'Australia/Sydney', label: 'Sydney, Melbourne', offset: 'UTC+10:00' },
  {
    id: 'Pacific/Auckland',
    label: 'Auckland, Wellington',
    offset: 'UTC+12:00',
  },
];

export function filterTimezones(list: Timezone[], query: string): Timezone[] {
  if (!query.trim()) return list;
  const q = query.toLowerCase();
  return list.filter(
    (tz) =>
      tz.label.toLowerCase().includes(q) ||
      tz.offset.toLowerCase().includes(q) ||
      tz.id.toLowerCase().includes(q),
  );
}
