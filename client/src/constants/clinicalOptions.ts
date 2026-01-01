import { TFunction } from 'i18next';

export const specialtyColors: Record<string, { bg: string; color: string }> = {
  general_surgery: { bg: '#e3f2fd', color: '#0d47a1' },
  vascular_surgery: { bg: '#e8f5e9', color: '#1b5e20' },
  plastic_reconstructive: { bg: '#fce4ec', color: '#ad1457' },
  ent: { bg: '#fff8e1', color: '#ff6f00' },
  gynecology: { bg: '#f3e5f5', color: '#6a1b9a' },
  urology: { bg: '#e0f7fa', color: '#006064' },
  ophthalmology: { bg: '#ede7f6', color: '#4527a0' },
  orthopedics: { bg: '#f1f8e9', color: '#2e7d32' },
  dental: { bg: '#fff3e0', color: '#ef6c00' },
  pediatric_surgery: { bg: '#e0f2f1', color: '#00695c' },
};

const specialtyKeys = [
  { value: 'general_surgery', labelKey: 'specialties.general_surgery' },
  { value: 'vascular_surgery', labelKey: 'specialties.vascular_surgery' },
  { value: 'plastic_reconstructive', labelKey: 'specialties.plastic_reconstructive' },
  { value: 'ent', labelKey: 'specialties.ent' },
  { value: 'gynecology', labelKey: 'specialties.gynecology' },
  { value: 'urology', labelKey: 'specialties.urology' },
  { value: 'ophthalmology', labelKey: 'specialties.ophthalmology' },
  { value: 'orthopedics', labelKey: 'specialties.orthopedics' },
  { value: 'dental', labelKey: 'specialties.dental' },
  { value: 'pediatric_surgery', labelKey: 'specialties.pediatric_surgery' },
];

export const getSpecialtyOptions = (t: TFunction) =>
  specialtyKeys.map(item => ({
    value: item.value,
    label: t(item.labelKey),
  }));

export const getSexOptions = (t: TFunction) => ([
  { value: 'F', label: t('sex.female') },
  { value: 'M', label: t('sex.male') },
  { value: 'O', label: t('sex.other') },
]);

export const getSubsystemOptions = (t: TFunction) => ([
  { value: 'ADSE', label: t('subsystems.adse') },
  { value: 'CTH', label: t('subsystems.cth') },
  { value: 'PARTICULAR', label: t('subsystems.private') },
  { value: 'SIGIC', label: t('subsystems.sigic') },
  { value: 'SEGURO', label: t('subsystems.insurance') },
]);
