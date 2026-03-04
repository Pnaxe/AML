export type AmlPageId =
  | 'dashboard'
  | 'activity-feed'
  | 'performance'
  | 'customers'
  | 'kyc'
  | 'screening'
  | 'screening-manual'
  | 'screening-approved'
  | 'screening-declined'
  | 'transactions'
  | 'transactions-upload'
  | 'transactions-upload-data'
  | 'alerts'
  | 'cases'
  | 'sar'
  | 'modelling'
  | 'modelling-load'
  | 'modelling-calibration'
  | 'modelling-testing'
  | 'data-management'
  | 'data-validation'
  | 'validated-data'
  | 'reports'
  | 'reports-sar'
  | 'reports-exports'
  | 'configurations'
  | 'configurations-email'
  | 'configurations-risk'
  | 'configurations-api'

export type AmlSection = {
  id: AmlPageId
  label: string
}

export const AML_SECTIONS: AmlSection[] = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'activity-feed', label: 'Activity Feed' },
  { id: 'performance', label: 'Performance' },
  { id: 'data-management', label: 'Data Upload' },
  { id: 'data-validation', label: 'Data Validation' },
  { id: 'validated-data', label: 'Data Correction' },
  { id: 'customers', label: 'Customers' },
  { id: 'kyc', label: 'Onboarding & KYC' },
  { id: 'screening', label: 'Screening' },
  { id: 'screening-manual', label: 'Manual Screening' },
  { id: 'screening-approved', label: 'Approved Profiles' },
  { id: 'screening-declined', label: 'Declined Profiles' },
  { id: 'transactions', label: 'Real Time Monitoring' },
  { id: 'transactions-upload', label: 'Batch Monitoring' },
  { id: 'transactions-upload-data', label: 'Upload Data' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'cases', label: 'Cases' },
  { id: 'modelling', label: 'Select Models' },
  { id: 'modelling-load', label: 'Load Model' },
  { id: 'modelling-calibration', label: 'Model Calibration' },
  { id: 'modelling-testing', label: 'Testing Accuracy' },
  { id: 'reports', label: 'Operational Reports' },
  { id: 'reports-sar', label: 'SAR Reports' },
  { id: 'reports-exports', label: 'Data Exports' },
  { id: 'configurations', label: 'System & Database' },
  { id: 'configurations-email', label: 'Email & Notifications' },
  { id: 'configurations-risk', label: 'Risk & Automation' },
  { id: 'configurations-api', label: 'API Keys' },
]

