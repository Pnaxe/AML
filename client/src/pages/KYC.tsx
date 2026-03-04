import React, { useMemo, useState } from 'react'
import { HiOutlineSearch, HiOutlineX, HiOutlineMail, HiOutlinePhone, HiOutlineLocationMarker, HiOutlineGlobe, HiOutlineEye, HiOutlinePencil, HiOutlineTrash, HiOutlineDocument, HiOutlineDownload, HiOutlineArrowLeft, HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineClock, HiOutlinePlus, HiOutlineExclamation } from 'react-icons/hi'
import { useToast } from '../contexts/ToastContext'
import './Customers.css'
import './KYC.css'

type ProfileType = 'Business' | 'Individual'
type VettingStatus = 'Not started' | 'In review' | 'Authentic' | 'Failed'
type ScreeningStatus = 'Not started' | 'In progress' | 'Clear' | 'Match found'
type DecisionStatus = 'Pending' | 'Approved' | 'Rejected'
type CustomerStatus = 'Prospect' | 'Customer' | 'Rejected'
type MonitoringStatus = 'Not eligible' | 'Queued' | 'Active'
type EmploymentStatus = 'Employed' | 'Self-employed' | 'Student' | 'Unemployed'

type IndividualKycDetails = {
  fullLegalName?: string
  dateOfBirth?: string
  gender?: string
  nationality?: string
  countryOfResidence?: string
  maritalStatus?: string
  nationalIdOrPassportNumber?: string
  taxIdentificationNumber?: string
  mobilePhoneNumber?: string
  emailAddress?: string
  residentialAddress?: string
  postalAddress?: string
  idType?: string
  idNumber?: string
  idIssueDate?: string
  idExpiryDate?: string
  idIssuingCountry?: string
  idDocumentFrontBackFile?: string
  selfieOrLivePhotoFile?: string
  proofOfAddressDocumentFile?: string
  addressVerificationDate?: string
  proofOfAddressType?: string
  proofOfAddressIssuerName?: string
  employmentStatus?: EmploymentStatus
  employerName?: string
  occupationOrJobTitle?: string
  sourceOfFunds?: string
  estimatedMonthlyIncomeRange?: string
  expectedAccountActivity?: string
  politicallyExposedPerson?: 'Yes' | 'No'
  relatedToPep?: 'Yes' | 'No'
  countryOfTaxResidence?: string
  fatcaCrsDeclaration?: string
  sanctionsScreeningConsent?: boolean
  termsAccepted?: boolean
}

type BusinessKycDetails = {
  registeredCompanyName?: string
  tradingName?: string
  companyRegistrationNumber?: string
  dateOfIncorporation?: string
  countryOfIncorporation?: string
  businessType?: string
  natureOfBusiness?: string
  industrySector?: string
  taxNumber?: string
  registeredOfficeAddress?: string
  tradingAddress?: string
  addressCountry?: string
  postalCode?: string
  proofOfAddressDocument?: string
  officialEmail?: string
  phoneNumber?: string
  website?: string
  documentsProvided?: string
  directorsInfo?: string
  uboDetails?: string
  authorizedSignatoriesInfo?: string
  sourceOfFunds?: string
  expectedMonthlyTurnover?: string
  expectedTransactionVolume?: string
  primaryBankingCountries?: string
  purposeOfAccount?: string
  pepDeclaration?: 'Yes' | 'No'
  sanctionsDeclaration?: string
  fatcaCrsStatus?: string
  regulatoryConfirmations?: string
  boardResolutionProvided?: boolean
  termsAccepted?: boolean
}

type OnboardingRecord = {
  id: string
  applicantName: string
  profileType: ProfileType
  docsSubmitted: boolean
  vetting: VettingStatus
  watchlist: ScreeningStatus
  blacklist: ScreeningStatus
  pep: ScreeningStatus
  decision: DecisionStatus
  customer: CustomerStatus
  monitoring: MonitoringStatus
  lastUpdated: string
  businessKyc?: BusinessKycDetails
  individualKyc?: IndividualKycDetails
}

const seedRecords: OnboardingRecord[] = [
  {
    id: 'ONB-001234',
    applicantName: 'Acme Trading Ltd',
    profileType: 'Business',
    docsSubmitted: true,
    vetting: 'Authentic',
    watchlist: 'Clear',
    blacklist: 'Clear',
    pep: 'Clear',
    decision: 'Approved',
    customer: 'Customer',
    monitoring: 'Active',
    lastUpdated: '11/21/2025',
  },
  {
    id: 'ONB-001235',
    applicantName: 'Liam Ndlovu',
    profileType: 'Individual',
    docsSubmitted: false,
    vetting: 'Not started',
    watchlist: 'Not started',
    blacklist: 'Not started',
    pep: 'Not started',
    decision: 'Pending',
    customer: 'Prospect',
    monitoring: 'Not eligible',
    lastUpdated: '11/22/2025',
  },
]

const PAGE_SIZE = 25

const screeningClear = (r: OnboardingRecord) => r.watchlist === 'Clear' && r.blacklist === 'Clear' && r.pep === 'Clear'
const screeningAnyMatch = (r: OnboardingRecord) => [r.watchlist, r.blacklist, r.pep].includes('Match found')

const stageOf = (r: OnboardingRecord) => {
  if (r.decision === 'Rejected') return 'Rejected'
  if (r.decision === 'Approved') return 'Customer Monitoring'
  if (!r.docsSubmitted) return 'Document Collection'
  if (r.vetting === 'Not started' || r.vetting === 'In review') return 'Authenticity Vetting'
  if (r.watchlist === 'Not started' || r.blacklist === 'Not started' || r.pep === 'Not started') return 'Screening'
  return 'Decision'
}

const today = () => new Date().toLocaleDateString('en-US')

function ViewProfileContent({
  record,
  onBack,
  onMoveToScreening,
  onReject,
}: {
  record: OnboardingRecord
  onBack: () => void
  onMoveToScreening: (notes?: string) => void
  onReject: (notes?: string) => void
}) {
  const [viewingDocument, setViewingDocument] = useState<{ label: string; fileName: string } | null>(null)
  const [decisionModal, setDecisionModal] = useState<'screening' | 'reject' | null>(null)
  const [decisionNotes, setDecisionNotes] = useState('')

  const documentEntries: { label: string; fileName: string }[] = []
  if (record.profileType === 'Individual' && record.individualKyc) {
    const k = record.individualKyc
    if (k.idDocumentFrontBackFile) documentEntries.push({ label: 'ID document', fileName: k.idDocumentFrontBackFile })
    if (k.selfieOrLivePhotoFile) documentEntries.push({ label: 'Selfie / live photo', fileName: k.selfieOrLivePhotoFile })
    if (k.proofOfAddressDocumentFile) documentEntries.push({ label: 'Proof of address', fileName: k.proofOfAddressDocumentFile })
  }
  if (record.profileType === 'Business' && record.businessKyc?.proofOfAddressDocument) {
    documentEntries.push({ label: 'Proof of address', fileName: record.businessKyc.proofOfAddressDocument })
  }

  const handleDownload = (fileName: string) => {
    const blob = new Blob(['[Document: ' + fileName + ' – file content not stored in demo]'], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName || 'document'
    a.click()
    URL.revokeObjectURL(url)
  }

  const V = (v: string | undefined) => (v && v.trim() !== '' ? v : '—')
  const Vb = (v: boolean | undefined) => (v === undefined ? '—' : v ? 'Yes' : 'No')

  const ind = record.profileType === 'Individual' ? record.individualKyc : undefined
  const biz = record.profileType === 'Business' ? record.businessKyc : undefined

  return (
    <div className="view-profile-page">
      <header className="customers-header">
        <div>
          <h1 className="customers-title">View Profile</h1>
          <p className="customers-subtitle">{record.applicantName} · {record.id}</p>
        </div>
        <div className="customers-header-actions">
          <button type="button" className="btn-primary-action btn-with-icon" onClick={onBack}>
            <HiOutlineArrowLeft size={18} className="icon-primary" aria-hidden />
            Back to list
          </button>
        </div>
      </header>

      <div className="view-profile-card-outer">
        <div className="view-profile-card-inner">
          <div className="view-profile-body">
        <section className="view-profile-section view-profile-documents">
          <h2 className="view-profile-section-title">Documents &amp; images</h2>
          {documentEntries.length === 0 ? (
            <p className="view-profile-no-docs">No documents or images uploaded yet.</p>
          ) : (
            <div className="view-profile-docs-grid">
              {documentEntries.map((doc, idx) => (
                <div key={idx} className="view-profile-doc-card">
                  <div className="view-profile-doc-icon">
                    <HiOutlineDocument size={32} aria-hidden />
                  </div>
                  <div className="view-profile-doc-info">
                    <span className="view-profile-doc-label">{doc.label}</span>
                    <span className="view-profile-doc-filename">{doc.fileName}</span>
                  </div>
                  <div className="view-profile-doc-actions">
                    <button type="button" className="view-profile-doc-btn view-profile-doc-btn-view" onClick={() => setViewingDocument(doc)} title="View">
                      <HiOutlineEye size={18} aria-hidden />
                      View
                    </button>
                    <button type="button" className="view-profile-doc-btn view-profile-doc-btn-download" onClick={() => handleDownload(doc.fileName)} title="Download">
                      <HiOutlineDownload size={18} aria-hidden />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {record.profileType === 'Individual' && (
          <>
            <section className="view-profile-section">
              <h2 className="view-profile-section-title">1. Personal Information</h2>
              <div className="view-profile-grid">
                <div className="view-profile-field"><span className="view-profile-label">Full legal name</span><span className="view-profile-value">{V(record.applicantName)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Date of birth</span><span className="view-profile-value">{V(ind?.dateOfBirth)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Gender</span><span className="view-profile-value">{V(ind?.gender)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Nationality</span><span className="view-profile-value">{V(ind?.nationality)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Country of residence</span><span className="view-profile-value">{V(ind?.countryOfResidence)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Marital status</span><span className="view-profile-value">{V(ind?.maritalStatus)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">National ID / passport number</span><span className="view-profile-value">{V(ind?.nationalIdOrPassportNumber)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Tax Identification Number (optional)</span><span className="view-profile-value">{V(ind?.taxIdentificationNumber)}</span></div>
              </div>
            </section>
            <section className="view-profile-section">
              <h2 className="view-profile-section-title">2. Contact Information</h2>
              <div className="view-profile-grid">
                <div className="view-profile-field"><span className="view-profile-label">Mobile phone number</span><span className="view-profile-value">{V(ind?.mobilePhoneNumber)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Email address</span><span className="view-profile-value">{V(ind?.emailAddress)}</span></div>
                <div className="view-profile-field view-profile-field-full"><span className="view-profile-label">Residential address</span><span className="view-profile-value">{V(ind?.residentialAddress)}</span></div>
                <div className="view-profile-field view-profile-field-full"><span className="view-profile-label">Postal address (if different)</span><span className="view-profile-value">{V(ind?.postalAddress)}</span></div>
              </div>
            </section>
            <section className="view-profile-section">
              <h2 className="view-profile-section-title">3. Identification Details</h2>
              <div className="view-profile-grid">
                <div className="view-profile-field"><span className="view-profile-label">ID type</span><span className="view-profile-value">{V(ind?.idType)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">ID number</span><span className="view-profile-value">{V(ind?.idNumber)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Issue date</span><span className="view-profile-value">{V(ind?.idIssueDate)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Expiry date</span><span className="view-profile-value">{V(ind?.idExpiryDate)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Issuing country</span><span className="view-profile-value">{V(ind?.idIssuingCountry)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">ID document (upload)</span><span className="view-profile-value">{V(ind?.idDocumentFrontBackFile)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Selfie / live photo</span><span className="view-profile-value">{V(ind?.selfieOrLivePhotoFile)}</span></div>
              </div>
            </section>
            <section className="view-profile-section">
              <h2 className="view-profile-section-title">4. Proof of Address</h2>
              <div className="view-profile-grid">
                <div className="view-profile-field"><span className="view-profile-label">Proof of address document</span><span className="view-profile-value">{V(ind?.proofOfAddressDocumentFile)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Address verification date</span><span className="view-profile-value">{V(ind?.addressVerificationDate)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Type of proof</span><span className="view-profile-value">{V(ind?.proofOfAddressType)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Issuer name</span><span className="view-profile-value">{V(ind?.proofOfAddressIssuerName)}</span></div>
              </div>
            </section>
            <section className="view-profile-section">
              <h2 className="view-profile-section-title">5. Employment &amp; Financial</h2>
              <div className="view-profile-grid">
                <div className="view-profile-field"><span className="view-profile-label">Employment status</span><span className="view-profile-value">{V(ind?.employmentStatus)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Employer name</span><span className="view-profile-value">{V(ind?.employerName)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Occupation / job title</span><span className="view-profile-value">{V(ind?.occupationOrJobTitle)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Source of funds</span><span className="view-profile-value">{V(ind?.sourceOfFunds)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Estimated monthly income range</span><span className="view-profile-value">{V(ind?.estimatedMonthlyIncomeRange)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Expected account activity</span><span className="view-profile-value">{V(ind?.expectedAccountActivity)}</span></div>
              </div>
            </section>
            <section className="view-profile-section">
              <h2 className="view-profile-section-title">6. Risk &amp; Compliance</h2>
              <div className="view-profile-grid">
                <div className="view-profile-field"><span className="view-profile-label">Politically exposed person (PEP)</span><span className="view-profile-value">{V(ind?.politicallyExposedPerson)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Related to PEP</span><span className="view-profile-value">{V(ind?.relatedToPep)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Country of tax residence</span><span className="view-profile-value">{V(ind?.countryOfTaxResidence)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">FATCA / CRS declaration</span><span className="view-profile-value">{V(ind?.fatcaCrsDeclaration)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Sanctions screening consent</span><span className="view-profile-value">{Vb(ind?.sanctionsScreeningConsent)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Terms and conditions accepted</span><span className="view-profile-value">{Vb(ind?.termsAccepted)}</span></div>
              </div>
            </section>
          </>
        )}

        {record.profileType === 'Business' && (
          <>
            <section className="view-profile-section">
              <h2 className="view-profile-section-title">1. Company Basic Information</h2>
              <p className="view-profile-section-purpose">Purpose: Legal existence of the entity.</p>
              <div className="view-profile-grid">
                <div className="view-profile-field"><span className="view-profile-label">Registered company name</span><span className="view-profile-value">{V(record.applicantName)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Trading name</span><span className="view-profile-value">{V(biz?.tradingName)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Company registration number</span><span className="view-profile-value">{V(biz?.companyRegistrationNumber)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Date of incorporation</span><span className="view-profile-value">{V(biz?.dateOfIncorporation)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Country of incorporation</span><span className="view-profile-value">{V(biz?.countryOfIncorporation)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Business type</span><span className="view-profile-value">{V(biz?.businessType)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Industry sector</span><span className="view-profile-value">{V(biz?.industrySector)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Nature of business</span><span className="view-profile-value">{V(biz?.natureOfBusiness)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Tax number (TIN)</span><span className="view-profile-value">{V(biz?.taxNumber)}</span></div>
              </div>
            </section>
            <section className="view-profile-section">
              <h2 className="view-profile-section-title">2. Registered Address</h2>
              <p className="view-profile-section-purpose">Purpose: Locate the business.</p>
              <div className="view-profile-grid">
                <div className="view-profile-field view-profile-field-full"><span className="view-profile-label">Registered office address</span><span className="view-profile-value">{V(biz?.registeredOfficeAddress)}</span></div>
                <div className="view-profile-field view-profile-field-full"><span className="view-profile-label">Trading address (if different)</span><span className="view-profile-value">{V(biz?.tradingAddress)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Country</span><span className="view-profile-value">{V(biz?.addressCountry)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Postal code</span><span className="view-profile-value">{V(biz?.postalCode)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Proof of address document</span><span className="view-profile-value">{V(biz?.proofOfAddressDocument)}</span></div>
              </div>
            </section>
            <section className="view-profile-section">
              <h2 className="view-profile-section-title">3. Contact Details</h2>
              <div className="view-profile-grid">
                <div className="view-profile-field"><span className="view-profile-label">Official email</span><span className="view-profile-value">{V(biz?.officialEmail)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Phone number</span><span className="view-profile-value">{V(biz?.phoneNumber)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Website (if available)</span><span className="view-profile-value">{V(biz?.website)}</span></div>
              </div>
            </section>
            <section className="view-profile-section">
              <h2 className="view-profile-section-title">4. Business Documents (Uploads)</h2>
              <p className="view-profile-section-purpose">Typically required: Certificate of Incorporation, Memorandum &amp; Articles, CR14/Directors list, Business license, Proof of business address, Tax clearance (optional).</p>
              <div className="view-profile-grid">
                <div className="view-profile-field view-profile-field-full"><span className="view-profile-label">Documents provided / notes</span><span className="view-profile-value view-profile-value-block">{V(biz?.documentsProvided)}</span></div>
              </div>
            </section>
            <section className="view-profile-section">
              <h2 className="view-profile-section-title">5. Directors Information</h2>
              <p className="view-profile-section-purpose">For each director: Full name, DOB, Nationality, ID/Passport, Residential address, Contact details, PEP status. Each director usually goes through individual KYC.</p>
              <div className="view-profile-grid">
                <div className="view-profile-field view-profile-field-full"><span className="view-profile-label">Directors (details per director)</span><span className="view-profile-value view-profile-value-block">{V(biz?.directorsInfo)}</span></div>
              </div>
            </section>
            <section className="view-profile-section">
              <h2 className="view-profile-section-title">6. Ultimate Beneficial Owners (UBOs)</h2>
              <p className="view-profile-section-purpose">Persons owning ≥25% (or jurisdiction threshold). For each: Full name, Ownership %, ID details, Address, Nationality, Source of wealth, PEP declaration.</p>
              <div className="view-profile-grid">
                <div className="view-profile-field view-profile-field-full"><span className="view-profile-label">UBO details</span><span className="view-profile-value view-profile-value-block">{V(biz?.uboDetails)}</span></div>
              </div>
            </section>
            <section className="view-profile-section">
              <h2 className="view-profile-section-title">7. Authorized Signatories</h2>
              <p className="view-profile-section-purpose">People allowed to operate the account: Full name, Role, Specimen signature, ID details, Contact information.</p>
              <div className="view-profile-grid">
                <div className="view-profile-field view-profile-field-full"><span className="view-profile-label">Signatories</span><span className="view-profile-value view-profile-value-block">{V(biz?.authorizedSignatoriesInfo)}</span></div>
              </div>
            </section>
            <section className="view-profile-section">
              <h2 className="view-profile-section-title">8. Business Financial Profile</h2>
              <p className="view-profile-section-purpose">Purpose: Transaction monitoring baseline.</p>
              <div className="view-profile-grid">
                <div className="view-profile-field"><span className="view-profile-label">Source of funds</span><span className="view-profile-value">{V(biz?.sourceOfFunds)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Expected monthly turnover</span><span className="view-profile-value">{V(biz?.expectedMonthlyTurnover)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Expected transaction volume</span><span className="view-profile-value">{V(biz?.expectedTransactionVolume)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Primary banking countries</span><span className="view-profile-value">{V(biz?.primaryBankingCountries)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Purpose of account</span><span className="view-profile-value">{V(biz?.purposeOfAccount)}</span></div>
              </div>
            </section>
            <section className="view-profile-section">
              <h2 className="view-profile-section-title">9. Risk &amp; Compliance Declarations</h2>
              <div className="view-profile-grid">
                <div className="view-profile-field"><span className="view-profile-label">PEP declaration (entity level)</span><span className="view-profile-value">{V(biz?.pepDeclaration)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Sanctions declaration</span><span className="view-profile-value">{V(biz?.sanctionsDeclaration)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">FATCA / CRS status</span><span className="view-profile-value">{V(biz?.fatcaCrsStatus)}</span></div>
                <div className="view-profile-field view-profile-field-full"><span className="view-profile-label">Regulatory confirmations</span><span className="view-profile-value view-profile-value-block">{V(biz?.regulatoryConfirmations)}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Board resolution provided</span><span className="view-profile-value">{biz?.boardResolutionProvided === undefined ? '—' : biz.boardResolutionProvided ? 'Yes' : 'No'}</span></div>
                <div className="view-profile-field"><span className="view-profile-label">Terms &amp; conditions acceptance</span><span className="view-profile-value">{Vb(biz?.termsAccepted)}</span></div>
              </div>
            </section>
          </>
        )}

        <section className="view-profile-section view-profile-actions">
          <h2 className="view-profile-section-title">Decision</h2>
          <p className="view-profile-decision-intro">Review the profile and submit a decision to move the application to screening or reject it.</p>
          <div className="view-profile-buttons">
            <button type="button" className="btn-primary-action btn-with-icon" onClick={() => { setDecisionModal('screening'); setDecisionNotes(''); }}>
              <HiOutlineCheckCircle size={18} className="icon-success" aria-hidden />
              Move to Screening
            </button>
            <button type="button" className="btn-danger-action btn-with-icon" onClick={() => { setDecisionModal('reject'); setDecisionNotes(''); }}>
              <HiOutlineXCircle size={18} className="icon-danger" aria-hidden />
              Reject
            </button>
          </div>
        </section>
        </div>
      </div>
      </div>

      {viewingDocument && (
        <div className="modal-backdrop" onClick={() => setViewingDocument(null)}>
          <div className="modal-panel view-profile-doc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{viewingDocument.label}</h2>
              <button type="button" className="modal-close-btn" onClick={() => setViewingDocument(null)} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p className="view-profile-doc-modal-filename">{viewingDocument.fileName}</p>
              <div className="view-profile-doc-preview-placeholder">
                <HiOutlineDocument size={48} aria-hidden />
                <p>Preview not available. Use Download to save the file.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary-action" onClick={() => setViewingDocument(null)}>Close</button>
              <button type="button" className="btn-primary-action" onClick={() => { handleDownload(viewingDocument.fileName); setViewingDocument(null); }}>Download</button>
            </div>
          </div>
        </div>
      )}

      {decisionModal && (
        <div className="modal-backdrop" onClick={() => { setDecisionModal(null); setDecisionNotes(''); }}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title modal-title-with-icon">
                {decisionModal === 'screening' ? (
                  <><HiOutlineCheckCircle size={22} className="icon-success" aria-hidden /> Move to Screening</>
                ) : (
                  <><HiOutlineXCircle size={22} className="icon-danger" aria-hidden /> Reject Profile</>
                )}
              </h2>
              <button type="button" className="modal-close-btn" onClick={() => { setDecisionModal(null); setDecisionNotes(''); }} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <label className="modal-label" htmlFor="decisionNotes">Notes about this decision</label>
                <textarea
                  id="decisionNotes"
                  className="modal-input modal-textarea"
                  placeholder="Add notes about this decision (optional)..."
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary-action" onClick={() => { setDecisionModal(null); setDecisionNotes(''); }}>
                Cancel
              </button>
              {decisionModal === 'screening' ? (
                <button type="button" className="btn-primary-action" onClick={() => { onMoveToScreening(decisionNotes.trim() || undefined); setDecisionModal(null); setDecisionNotes(''); }}>
                  Move to Screening
                </button>
              ) : (
                <button type="button" className="btn-danger-action" onClick={() => { onReject(decisionNotes.trim() || undefined); setDecisionModal(null); setDecisionNotes(''); }}>
                  Reject
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const KYC: React.FC = () => {
  const { showToast } = useToast()
  const [records, setRecords] = useState<OnboardingRecord[]>(seedRecords)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeSearchTerm, setActiveSearchTerm] = useState('')
  const [decisionFilter, setDecisionFilter] = useState('')
  const [profileTypeFilter, setProfileTypeFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [viewingRecordId, setViewingRecordId] = useState<string | null>(null)
  const [editRecord, setEditRecord] = useState<OnboardingRecord | null>(null)
  const [deleteRecord, setDeleteRecord] = useState<OnboardingRecord | null>(null)
  const [editApplicantName, setEditApplicantName] = useState('')
  const [editDecision, setEditDecision] = useState<DecisionStatus>('Pending')
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<ProfileType>('Individual')
  const [newBusinessTradingName, setNewBusinessTradingName] = useState('')
  const [newBusinessRegistration, setNewBusinessRegistration] = useState('')
  const [newBusinessDateOfIncorporation, setNewBusinessDateOfIncorporation] = useState('')
  const [newBusinessCountry, setNewBusinessCountry] = useState('')
  const [newBusinessType, setNewBusinessType] = useState('')
  const [newBusinessNatureOfBusiness, setNewBusinessNatureOfBusiness] = useState('')
  const [newBusinessIndustrySector, setNewBusinessIndustrySector] = useState('')
  const [newBusinessTin, setNewBusinessTin] = useState('')
  const [newBusinessRegisteredAddress, setNewBusinessRegisteredAddress] = useState('')
  const [newBusinessTradingAddress, setNewBusinessTradingAddress] = useState('')
  const [newBusinessAddressCountry, setNewBusinessAddressCountry] = useState('')
  const [newBusinessPostalCode, setNewBusinessPostalCode] = useState('')
  const [newBusinessProofOfAddressFile, setNewBusinessProofOfAddressFile] = useState('')
  const [newBusinessEmail, setNewBusinessEmail] = useState('')
  const [newBusinessPhone, setNewBusinessPhone] = useState('')
  const [newBusinessWebsite, setNewBusinessWebsite] = useState('')
  const [newBusinessDocumentsProvided, setNewBusinessDocumentsProvided] = useState('')
  const [newBusinessDirectorsInfo, setNewBusinessDirectorsInfo] = useState('')
  const [newBusinessUboDetails, setNewBusinessUboDetails] = useState('')
  const [newBusinessSignatoriesInfo, setNewBusinessSignatoriesInfo] = useState('')
  const [newBusinessSourceOfFunds, setNewBusinessSourceOfFunds] = useState('')
  const [newBusinessMonthlyTurnover, setNewBusinessMonthlyTurnover] = useState('')
  const [newBusinessTransactionVolume, setNewBusinessTransactionVolume] = useState('')
  const [newBusinessBankingCountries, setNewBusinessBankingCountries] = useState('')
  const [newBusinessPurposeOfAccount, setNewBusinessPurposeOfAccount] = useState('')
  const [newBusinessPepDeclaration, setNewBusinessPepDeclaration] = useState<'Yes' | 'No' | ''>('')
  const [newBusinessSanctionsDeclaration, setNewBusinessSanctionsDeclaration] = useState('')
  const [newBusinessFatcaCrsStatus, setNewBusinessFatcaCrsStatus] = useState('')
  const [newBusinessRegulatoryConfirmations, setNewBusinessRegulatoryConfirmations] = useState('')
  const [newBusinessBoardResolution, setNewBusinessBoardResolution] = useState(false)
  const [newBusinessTermsAccepted, setNewBusinessTermsAccepted] = useState(false)
  const [newIndividualDob, setNewIndividualDob] = useState('')
  const [newIndividualGender, setNewIndividualGender] = useState('')
  const [newIndividualNationality, setNewIndividualNationality] = useState('')
  const [newIndividualCountry, setNewIndividualCountry] = useState('')
  const [newIndividualMaritalStatus, setNewIndividualMaritalStatus] = useState('')
  const [newIndividualIdNumber, setNewIndividualIdNumber] = useState('')
  const [newIndividualTin, setNewIndividualTin] = useState('')
  const [newIndividualMobilePhone, setNewIndividualMobilePhone] = useState('')
  const [newIndividualEmail, setNewIndividualEmail] = useState('')
  const [newIndividualResidentialAddress, setNewIndividualResidentialAddress] = useState('')
  const [newIndividualPostalAddress, setNewIndividualPostalAddress] = useState('')
  const [newIndividualIdType, setNewIndividualIdType] = useState('')
  const [newIndividualIdIssueDate, setNewIndividualIdIssueDate] = useState('')
  const [newIndividualIdExpiryDate, setNewIndividualIdExpiryDate] = useState('')
  const [newIndividualIssuingCountry, setNewIndividualIssuingCountry] = useState('')
  const [newIndividualIdDocumentFile, setNewIndividualIdDocumentFile] = useState('')
  const [newIndividualSelfieFile, setNewIndividualSelfieFile] = useState('')
  const [newIndividualPoaDocumentFile, setNewIndividualPoaDocumentFile] = useState('')
  const [newIndividualAddressVerificationDate, setNewIndividualAddressVerificationDate] = useState('')
  const [newIndividualProofType, setNewIndividualProofType] = useState('')
  const [newIndividualProofIssuerName, setNewIndividualProofIssuerName] = useState('')
  const [newIndividualEmploymentStatus, setNewIndividualEmploymentStatus] = useState<EmploymentStatus | ''>('')
  const [newIndividualEmployerName, setNewIndividualEmployerName] = useState('')
  const [newIndividualOccupation, setNewIndividualOccupation] = useState('')
  const [newIndividualSourceOfFunds, setNewIndividualSourceOfFunds] = useState('')
  const [newIndividualIncomeRange, setNewIndividualIncomeRange] = useState('')
  const [newIndividualExpectedActivity, setNewIndividualExpectedActivity] = useState('')
  const [newIndividualPep, setNewIndividualPep] = useState<'Yes' | 'No' | ''>('')
  const [newIndividualRelatedPep, setNewIndividualRelatedPep] = useState<'Yes' | 'No' | ''>('')
  const [newIndividualTaxResidenceCountry, setNewIndividualTaxResidenceCountry] = useState('')
  const [newIndividualFatcaDeclaration, setNewIndividualFatcaDeclaration] = useState('')
  const [newIndividualSanctionsConsent, setNewIndividualSanctionsConsent] = useState(false)
  const [newIndividualTermsAccepted, setNewIndividualTermsAccepted] = useState(false)

  const filteredRecords = useMemo(() => {
    const term = activeSearchTerm.toLowerCase()
    return records.filter((r) => {
      if (term && !(r.id.toLowerCase().includes(term) || r.applicantName.toLowerCase().includes(term) || r.profileType.toLowerCase().includes(term))) {
        return false
      }
      if (decisionFilter && r.decision !== decisionFilter) return false
      if (profileTypeFilter && r.profileType !== profileTypeFilter) return false
      return true
    })
  }, [records, activeSearchTerm, decisionFilter, profileTypeFilter])

  const totalRecords = filteredRecords.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const pageRecords = filteredRecords.slice(startIndex, startIndex + PAGE_SIZE)
  const displayStart = totalRecords === 0 ? 0 : startIndex + 1
  const displayEnd = startIndex + pageRecords.length

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setActiveSearchTerm(searchTerm.trim())
    setCurrentPage(1)
  }

  const clearSearch = () => {
    setSearchTerm('')
    setActiveSearchTerm('')
    setCurrentPage(1)
  }

  const handleOpenAddModal = () => setShowAddModal(true)
  const handleOpenViewProfile = (r: OnboardingRecord) => setViewingRecordId(r.id)
  const handleBackToList = () => setViewingRecordId(null)
  const handleOpenEditModal = (r: OnboardingRecord) => {
    setEditRecord(r)
    setEditApplicantName(r.applicantName)
    setEditDecision(r.decision)
  }
  const handleCloseEditModal = () => {
    setEditRecord(null)
    setEditApplicantName('')
    setEditDecision('Pending')
  }
  const handleOpenDeleteModal = (r: OnboardingRecord) => setDeleteRecord(r)
  const handleCloseDeleteModal = () => setDeleteRecord(null)
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editRecord) return
    patchRecord(editRecord.id, (r) => ({ ...r, applicantName: editApplicantName.trim(), decision: editDecision, lastUpdated: today() }))
    handleCloseEditModal()
    showToast(`Updated "${editApplicantName.trim()}".`)
  }
  const handleConfirmDelete = () => {
    if (!deleteRecord) return
    setRecords((prev) => prev.filter((r) => r.id !== deleteRecord.id))
    const name = deleteRecord.applicantName
    handleCloseDeleteModal()
    showToast(`Deleted profile "${name}".`)
  }
  const fileNameFromInput = (e: React.ChangeEvent<HTMLInputElement>) => e.target.files?.[0]?.name ?? ''

  const handleCloseAddModal = () => {
    setShowAddModal(false)
    setNewName('')
    setNewType('Individual')
    setNewBusinessTradingName('')
    setNewBusinessRegistration('')
    setNewBusinessDateOfIncorporation('')
    setNewBusinessCountry('')
    setNewBusinessType('')
    setNewBusinessNatureOfBusiness('')
    setNewBusinessIndustrySector('')
    setNewBusinessTin('')
    setNewBusinessRegisteredAddress('')
    setNewBusinessTradingAddress('')
    setNewBusinessAddressCountry('')
    setNewBusinessPostalCode('')
    setNewBusinessProofOfAddressFile('')
    setNewBusinessEmail('')
    setNewBusinessPhone('')
    setNewBusinessWebsite('')
    setNewBusinessDocumentsProvided('')
    setNewBusinessDirectorsInfo('')
    setNewBusinessUboDetails('')
    setNewBusinessSignatoriesInfo('')
    setNewBusinessSourceOfFunds('')
    setNewBusinessMonthlyTurnover('')
    setNewBusinessTransactionVolume('')
    setNewBusinessBankingCountries('')
    setNewBusinessPurposeOfAccount('')
    setNewBusinessPepDeclaration('')
    setNewBusinessSanctionsDeclaration('')
    setNewBusinessFatcaCrsStatus('')
    setNewBusinessRegulatoryConfirmations('')
    setNewBusinessBoardResolution(false)
    setNewBusinessTermsAccepted(false)
    setNewIndividualDob('')
    setNewIndividualGender('')
    setNewIndividualNationality('')
    setNewIndividualCountry('')
    setNewIndividualMaritalStatus('')
    setNewIndividualIdNumber('')
    setNewIndividualTin('')
    setNewIndividualMobilePhone('')
    setNewIndividualEmail('')
    setNewIndividualResidentialAddress('')
    setNewIndividualPostalAddress('')
    setNewIndividualIdType('')
    setNewIndividualIdIssueDate('')
    setNewIndividualIdExpiryDate('')
    setNewIndividualIssuingCountry('')
    setNewIndividualIdDocumentFile('')
    setNewIndividualSelfieFile('')
    setNewIndividualPoaDocumentFile('')
    setNewIndividualAddressVerificationDate('')
    setNewIndividualProofType('')
    setNewIndividualProofIssuerName('')
    setNewIndividualEmploymentStatus('')
    setNewIndividualEmployerName('')
    setNewIndividualOccupation('')
    setNewIndividualSourceOfFunds('')
    setNewIndividualIncomeRange('')
    setNewIndividualExpectedActivity('')
    setNewIndividualPep('')
    setNewIndividualRelatedPep('')
    setNewIndividualTaxResidenceCountry('')
    setNewIndividualFatcaDeclaration('')
    setNewIndividualSanctionsConsent(false)
    setNewIndividualTermsAccepted(false)
  }

  const addProfile = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    const nextId = `ONB-${(1234 + records.length + 1).toString().padStart(6, '0')}`
    const base: OnboardingRecord = {
      id: nextId,
      applicantName: newName.trim(),
      profileType: newType,
      docsSubmitted: false,
      vetting: 'Not started',
      watchlist: 'Not started',
      blacklist: 'Not started',
      pep: 'Not started',
      decision: 'Pending',
      customer: 'Prospect',
      monitoring: 'Not eligible',
      lastUpdated: today(),
    }

    const newRecord: OnboardingRecord =
      newType === 'Business'
        ? {
          ...base,
          businessKyc: {
            registeredCompanyName: newName.trim() || undefined,
            tradingName: newBusinessTradingName || undefined,
            companyRegistrationNumber: newBusinessRegistration || undefined,
            dateOfIncorporation: newBusinessDateOfIncorporation || undefined,
            countryOfIncorporation: newBusinessCountry || undefined,
            businessType: newBusinessType || undefined,
            natureOfBusiness: newBusinessNatureOfBusiness || undefined,
            industrySector: newBusinessIndustrySector || undefined,
            taxNumber: newBusinessTin || undefined,
            registeredOfficeAddress: newBusinessRegisteredAddress || undefined,
            tradingAddress: newBusinessTradingAddress || undefined,
            addressCountry: newBusinessAddressCountry || undefined,
            postalCode: newBusinessPostalCode || undefined,
            proofOfAddressDocument: newBusinessProofOfAddressFile || undefined,
            officialEmail: newBusinessEmail || undefined,
            phoneNumber: newBusinessPhone || undefined,
            website: newBusinessWebsite || undefined,
            documentsProvided: newBusinessDocumentsProvided || undefined,
            directorsInfo: newBusinessDirectorsInfo || undefined,
            uboDetails: newBusinessUboDetails || undefined,
            authorizedSignatoriesInfo: newBusinessSignatoriesInfo || undefined,
            sourceOfFunds: newBusinessSourceOfFunds || undefined,
            expectedMonthlyTurnover: newBusinessMonthlyTurnover || undefined,
            expectedTransactionVolume: newBusinessTransactionVolume || undefined,
            primaryBankingCountries: newBusinessBankingCountries || undefined,
            purposeOfAccount: newBusinessPurposeOfAccount || undefined,
            pepDeclaration: newBusinessPepDeclaration || undefined,
            sanctionsDeclaration: newBusinessSanctionsDeclaration || undefined,
            fatcaCrsStatus: newBusinessFatcaCrsStatus || undefined,
            regulatoryConfirmations: newBusinessRegulatoryConfirmations || undefined,
            boardResolutionProvided: newBusinessBoardResolution || undefined,
            termsAccepted: newBusinessTermsAccepted || undefined,
          },
        }
        : {
          ...base,
          individualKyc: {
            fullLegalName: newName.trim() || undefined,
            dateOfBirth: newIndividualDob || undefined,
            gender: newIndividualGender || undefined,
            nationality: newIndividualNationality || undefined,
            countryOfResidence: newIndividualCountry || undefined,
            maritalStatus: newIndividualMaritalStatus || undefined,
            nationalIdOrPassportNumber: newIndividualIdNumber || undefined,
            taxIdentificationNumber: newIndividualTin || undefined,
            mobilePhoneNumber: newIndividualMobilePhone || undefined,
            emailAddress: newIndividualEmail || undefined,
            residentialAddress: newIndividualResidentialAddress || undefined,
            postalAddress: newIndividualPostalAddress || undefined,
            idType: newIndividualIdType || undefined,
            idNumber: newIndividualIdNumber || undefined,
            idIssueDate: newIndividualIdIssueDate || undefined,
            idExpiryDate: newIndividualIdExpiryDate || undefined,
            idIssuingCountry: newIndividualIssuingCountry || undefined,
            idDocumentFrontBackFile: newIndividualIdDocumentFile || undefined,
            selfieOrLivePhotoFile: newIndividualSelfieFile || undefined,
            proofOfAddressDocumentFile: newIndividualPoaDocumentFile || undefined,
            addressVerificationDate: newIndividualAddressVerificationDate || undefined,
            proofOfAddressType: newIndividualProofType || undefined,
            proofOfAddressIssuerName: newIndividualProofIssuerName || undefined,
            employmentStatus: newIndividualEmploymentStatus || undefined,
            employerName: newIndividualEmployerName || undefined,
            occupationOrJobTitle: newIndividualOccupation || undefined,
            sourceOfFunds: newIndividualSourceOfFunds || undefined,
            estimatedMonthlyIncomeRange: newIndividualIncomeRange || undefined,
            expectedAccountActivity: newIndividualExpectedActivity || undefined,
            politicallyExposedPerson: newIndividualPep || undefined,
            relatedToPep: newIndividualRelatedPep || undefined,
            countryOfTaxResidence: newIndividualTaxResidenceCountry || undefined,
            fatcaCrsDeclaration: newIndividualFatcaDeclaration || undefined,
            sanctionsScreeningConsent: newIndividualSanctionsConsent,
            termsAccepted: newIndividualTermsAccepted,
          },
        }
    setRecords((prev) => [newRecord, ...prev])
    setCurrentPage(1)
    handleCloseAddModal()
    showToast(`Created onboarding profile for "${newRecord.applicantName}".`)
  }

  const patchRecord = (id: string, updater: (r: OnboardingRecord) => OnboardingRecord) => {
    setRecords((prev) => prev.map((r) => (r.id === id ? updater(r) : r)))
  }

  const advance = (id: string) => {
    patchRecord(id, (r) => {
      const next = { ...r, lastUpdated: today() }
      if (!next.docsSubmitted) {
        next.docsSubmitted = true
        next.vetting = 'In review'
      } else if (next.vetting === 'In review' || next.vetting === 'Not started') {
        next.vetting = 'Authentic'
      } else if (next.watchlist === 'Not started' || next.blacklist === 'Not started' || next.pep === 'Not started') {
        next.watchlist = 'Clear'
        next.blacklist = 'Clear'
        next.pep = 'Clear'
      } else if (screeningClear(next) && next.decision === 'Pending') {
        next.decision = 'Approved'
        next.customer = 'Customer'
        next.monitoring = 'Queued'
      } else if (next.monitoring === 'Queued') {
        next.monitoring = 'Active'
      }
      return next
    })
  }

  const reject = (id: string) => {
    patchRecord(id, (r) => ({ ...r, decision: 'Rejected', customer: 'Rejected', monitoring: 'Not eligible', lastUpdated: today() }))
  }

  const markMatch = (id: string) => {
    patchRecord(id, (r) => ({
      ...r,
      watchlist: 'Clear',
      blacklist: 'Match found',
      pep: 'Clear',
      decision: 'Pending',
      customer: 'Prospect',
      monitoring: 'Not eligible',
      lastUpdated: today(),
    }))
  }

  const colCount = 7
  const viewingRecord = viewingRecordId ? records.find((r) => r.id === viewingRecordId) ?? null : null

  return (
    <div className="reports-container">
      {viewingRecordId && !viewingRecord ? (
        <div className="view-profile-page">
          <header className="customers-header">
            <div>
              <h1 className="customers-title">Profile not found</h1>
              <p className="customers-subtitle">This profile may have been removed.</p>
            </div>
            <div className="customers-header-actions">
              <button type="button" className="btn-primary-action btn-with-icon" onClick={handleBackToList}>
                <HiOutlineArrowLeft size={18} className="icon-primary" aria-hidden />
                Back to list
              </button>
            </div>
          </header>
          <div className="view-profile-card-outer">
            <div className="view-profile-card-inner">
            </div>
          </div>
        </div>
      ) : viewingRecordId && viewingRecord ? (
        <ViewProfileContent
          record={viewingRecord}
          onBack={handleBackToList}
          onMoveToScreening={(notes) => { advance(viewingRecord.id); showToast(notes ? `Profile moved to next stage. Notes: ${notes}` : 'Profile moved to next stage.'); }}
          onReject={(notes) => { reject(viewingRecord.id); showToast(notes ? `Profile rejected. Notes: ${notes}` : 'Profile rejected.'); handleBackToList(); }}
        />
      ) : (
        <>
          <header className="customers-header">
            <div>
              <h1 className="customers-title">Onboarding &amp; KYC</h1>
              <p className="customers-subtitle">Profile creation, document submission, vetting, screening, and decision.</p>
            </div>
            <div className="customers-header-actions">
              <button className="btn-primary-action btn-with-icon" onClick={handleOpenAddModal}>
                <HiOutlinePlus size={18} className="icon-primary" aria-hidden />
                Add Profile
              </button>
            </div>
          </header>

          <div className="customers-container">
            <div className="customers-filters-card report-filters">
              <div className="report-filters-left">
                <form onSubmit={handleSearchSubmit} className="filter-group filter-group-search">
                  <div className="search-input-wrapper">
                    <span className="search-icon" aria-hidden>
                      <HiOutlineSearch size={18} />
                    </span>
                    <input
                      type="text"
                      className="filter-input search-input"
                      placeholder="Search by applicant name, onboarding ID, or profile type..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button type="button" className="search-clear-btn" onClick={clearSearch} title="Clear search" aria-label="Clear search">
                        <HiOutlineX size={18} />
                      </button>
                    )}
                  </div>
                </form>

                <div className="filter-group">
                  <span className="filter-label">Decision:</span>
                  <select
                    className="filter-input"
                    value={decisionFilter}
                    onChange={(e) => {
                      setDecisionFilter(e.target.value)
                      setCurrentPage(1)
                    }}
                  >
                    <option value="">All</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                <div className="filter-group">
                  <span className="filter-label">Profile Type:</span>
                  <select
                    className="filter-input"
                    value={profileTypeFilter}
                    onChange={(e) => {
                      setProfileTypeFilter(e.target.value)
                      setCurrentPage(1)
                    }}
                  >
                    <option value="">All Types</option>
                    <option value="Individual">Individual</option>
                    <option value="Business">Business</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="customers-table-card-outer">
              <div className="report-content-container ecl-table-container">
                <table className="ecl-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>APPLICANT</th>
                      <th>TYPE</th>
                      <th>DOCS</th>
                      <th>DECISION</th>
                      <th>LAST UPDATED</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRecords.map((r) => (
                      <tr key={r.id}>
                        <td className="customer-id">{r.id}</td>
                        <td>{r.applicantName}</td>
                        <td className="muted">{r.profileType}</td>
                        <td>
                          <span className={`docs-badge docs-badge-${r.docsSubmitted ? 'submitted' : 'missing'}`}>
                            {r.docsSubmitted ? <HiOutlineCheckCircle size={16} aria-hidden /> : <HiOutlineExclamation size={16} aria-hidden />}
                            {r.docsSubmitted ? 'Submitted' : 'Missing'}
                          </span>
                        </td>
                        <td>
                          <span className={`decision-badge decision-badge-${r.decision.toLowerCase()}`}>
                            {r.decision === 'Pending' && <HiOutlineClock size={16} aria-hidden />}
                            {r.decision === 'Approved' && <HiOutlineCheckCircle size={16} aria-hidden />}
                            {r.decision === 'Rejected' && <HiOutlineXCircle size={16} aria-hidden />}
                            {r.decision}
                          </span>
                        </td>
                        <td className="muted">{r.lastUpdated}</td>
                        <td>
                          <div className="customers-actions">
                            <HiOutlineEye
                              size={18}
                              className="action-icon action-icon-view"
                              onClick={() => handleOpenViewProfile(r)}
                              title="View"
                            />
                            <HiOutlinePencil
                              size={18}
                              className="action-icon action-icon-edit"
                              onClick={() => handleOpenEditModal(r)}
                              title="Edit"
                            />
                            <HiOutlineTrash
                              size={18}
                              className="action-icon action-icon-delete"
                              onClick={() => handleOpenDeleteModal(r)}
                              title="Delete"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                    {Array.from({ length: Math.max(0, PAGE_SIZE - pageRecords.length) }).map((_, idx) => (
                      <tr key={`empty-${idx}`}>
                        {Array.from({ length: colCount }).map((_, cellIdx) => (
                          <td key={cellIdx}>&nbsp;</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="ecl-table-footer">
                <div className="table-footer-left">
                  Showing {displayStart} to {displayEnd} of {totalRecords} results.
                </div>
                <div className="table-footer-right">
                  {totalPages > 1 ? (
                    <div className="pagination-controls">
                      <button
                        type="button"
                        className="pagination-btn"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={safePage === 1}
                      >
                        Previous
                      </button>
                      <span className="pagination-info">
                        Page {safePage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        className="pagination-btn"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage === totalPages}
                      >
                        Next
                      </button>
                    </div>
                  ) : (
                    <span>All data displayed</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {showAddModal && (
        <div className="modal-backdrop" onClick={handleCloseAddModal}>
          <div className="modal-panel kyc-add-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Profile</h2>
              <button className="modal-close-btn" onClick={handleCloseAddModal} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <form className="modal-form" onSubmit={addProfile}>
              <div className="modal-body">
                <div className="modal-field">
                  <label className="modal-label" htmlFor="newProfileType">
                    Profile type
                  </label>
                  <select id="newProfileType" className="modal-input" value={newType} onChange={(e) => setNewType(e.target.value as ProfileType)}>
                    <option value="Individual">Individual</option>
                    <option value="Business">Business</option>
                  </select>
                </div>
                <p className="modal-optional-legend"><span className="field-optional-star">*</span> Optional (not compulsory)</p>
                {newType === 'Individual' && (
                  <div className="individual-kyc-form">
                    <p className="modal-form-intro">
                      Complete all sections below with the applicant’s personal, contact, ID, proof of address, employment, and compliance information.
                    </p>
                    <div className="modal-field">
                      <label className="modal-label" htmlFor="newProfileName">Full legal name</label>
                      <input
                        id="newProfileName"
                        type="text"
                        className="modal-input"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="As shown on ID/passport"
                        autoFocus
                      />
                    </div>
                    <h3 className="modal-section-title">1. Personal Information</h3>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualDob">
                          Date of birth
                        </label>
                        <input
                          id="individualDob"
                          type="date"
                          className="modal-input"
                          value={newIndividualDob}
                          onChange={(e) => setNewIndividualDob(e.target.value)}
                        />
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualGender">
                          Gender
                        </label>
                        <input
                          id="individualGender"
                          type="text"
                          className="modal-input"
                          value={newIndividualGender}
                          onChange={(e) => setNewIndividualGender(e.target.value)}
                          placeholder="Male, Female, Non-binary..."
                        />
                      </div>
                    </div>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualNationality">
                          Nationality
                        </label>
                        <input
                          id="individualNationality"
                          type="text"
                          className="modal-input"
                          value={newIndividualNationality}
                          onChange={(e) => setNewIndividualNationality(e.target.value)}
                          placeholder="South African"
                        />
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualCountry">
                          Country of residence
                        </label>
                        <input
                          id="individualCountry"
                          type="text"
                          className="modal-input"
                          value={newIndividualCountry}
                          onChange={(e) => setNewIndividualCountry(e.target.value)}
                          placeholder="South Africa"
                        />
                      </div>
                    </div>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualMaritalStatus">
                          Marital status
                        </label>
                        <input
                          id="individualMaritalStatus"
                          type="text"
                          className="modal-input"
                          value={newIndividualMaritalStatus}
                          onChange={(e) => setNewIndividualMaritalStatus(e.target.value)}
                          placeholder="Single, Married..."
                        />
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualIdNumber">
                          National ID / passport number
                        </label>
                        <input
                          id="individualIdNumber"
                          type="text"
                          className="modal-input"
                          value={newIndividualIdNumber}
                          onChange={(e) => setNewIndividualIdNumber(e.target.value)}
                          placeholder="ID or passport number"
                        />
                      </div>
                    </div>
                    <div className="modal-field">
                      <label className="modal-label" htmlFor="individualTin">
                        Tax Identification Number (optional)<span className="field-optional-star" aria-label="Optional"> *</span>
                      </label>
                      <input
                        id="individualTin"
                        type="text"
                        className="modal-input"
                        value={newIndividualTin}
                        onChange={(e) => setNewIndividualTin(e.target.value)}
                        placeholder="TIN / tax number"
                      />
                    </div>

                    <h3 className="modal-section-title">2. Contact Information</h3>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualMobilePhone">
                          Mobile phone number
                        </label>
                        <input
                          id="individualMobilePhone"
                          type="tel"
                          className="modal-input"
                          value={newIndividualMobilePhone}
                          onChange={(e) => setNewIndividualMobilePhone(e.target.value)}
                          placeholder="+27 ..."
                        />
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualEmail">
                          Email address
                        </label>
                        <input
                          id="individualEmail"
                          type="email"
                          className="modal-input"
                          value={newIndividualEmail}
                          onChange={(e) => setNewIndividualEmail(e.target.value)}
                          placeholder="name@example.com"
                        />
                      </div>
                    </div>
                    <div className="modal-field">
                      <label className="modal-label" htmlFor="individualResidentialAddress">
                        Residential address
                      </label>
                      <textarea
                        id="individualResidentialAddress"
                        className="modal-input modal-textarea"
                        value={newIndividualResidentialAddress}
                        onChange={(e) => setNewIndividualResidentialAddress(e.target.value)}
                        placeholder="Street, city, postal code, country"
                      />
                    </div>
                    <div className="modal-field">
                      <label className="modal-label" htmlFor="individualPostalAddress">
                        Postal address (if different)<span className="field-optional-star" aria-label="Optional"> *</span>
                      </label>
                      <textarea
                        id="individualPostalAddress"
                        className="modal-input modal-textarea"
                        value={newIndividualPostalAddress}
                        onChange={(e) => setNewIndividualPostalAddress(e.target.value)}
                        placeholder="Postal or mailing address"
                      />
                    </div>

                    <h3 className="modal-section-title">3. Identification Details</h3>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualIdType">
                          ID type
                        </label>
                        <select
                          id="individualIdType"
                          className="modal-input"
                          value={newIndividualIdType}
                          onChange={(e) => setNewIndividualIdType(e.target.value)}
                        >
                          <option value="">Select ID type</option>
                          <option value="National ID">National ID</option>
                          <option value="Passport">Passport</option>
                          <option value="Driver's License">Driver&apos;s License</option>
                        </select>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualIdNumber2">
                          ID number
                        </label>
                        <input
                          id="individualIdNumber2"
                          type="text"
                          className="modal-input"
                          value={newIndividualIdNumber}
                          onChange={(e) => setNewIndividualIdNumber(e.target.value)}
                          placeholder="ID number"
                        />
                      </div>
                    </div>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualIdIssueDate">
                          Issue date
                        </label>
                        <input
                          id="individualIdIssueDate"
                          type="date"
                          className="modal-input"
                          value={newIndividualIdIssueDate}
                          onChange={(e) => setNewIndividualIdIssueDate(e.target.value)}
                        />
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualIdExpiryDate">
                          Expiry date
                        </label>
                        <input
                          id="individualIdExpiryDate"
                          type="date"
                          className="modal-input"
                          value={newIndividualIdExpiryDate}
                          onChange={(e) => setNewIndividualIdExpiryDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualIssuingCountry">
                          Issuing country
                        </label>
                        <input
                          id="individualIssuingCountry"
                          type="text"
                          className="modal-input"
                          value={newIndividualIssuingCountry}
                          onChange={(e) => setNewIndividualIssuingCountry(e.target.value)}
                          placeholder="Issuing country"
                        />
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualIdDoc">ID document (upload)</label>
                        <input id="individualIdDoc" type="file" className="modal-input" onChange={(e) => setNewIndividualIdDocumentFile(fileNameFromInput(e))} accept=".pdf,.jpg,.jpeg,.png" />
                        {newIndividualIdDocumentFile && <span className="modal-file-name">{newIndividualIdDocumentFile}</span>}
                      </div>
                    </div>
                    <div className="modal-field">
                      <label className="modal-label" htmlFor="individualSelfie">Selfie / live photo</label>
                      <input id="individualSelfie" type="file" className="modal-input" onChange={(e) => setNewIndividualSelfieFile(fileNameFromInput(e))} accept=".jpg,.jpeg,.png" />
                      {newIndividualSelfieFile && <span className="modal-file-name">{newIndividualSelfieFile}</span>}
                    </div>

                    <h3 className="modal-section-title">4. Proof of Address</h3>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualPoaDoc">Proof of address document</label>
                        <input id="individualPoaDoc" type="file" className="modal-input" onChange={(e) => setNewIndividualPoaDocumentFile(fileNameFromInput(e))} accept=".pdf,.jpg,.jpeg,.png" />
                        {newIndividualPoaDocumentFile && <span className="modal-file-name">{newIndividualPoaDocumentFile}</span>}
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualPoaDate">Address verification date</label>
                        <input id="individualPoaDate" type="date" className="modal-input" value={newIndividualAddressVerificationDate} onChange={(e) => setNewIndividualAddressVerificationDate(e.target.value)} />
                      </div>
                    </div>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualPoaType">Type of proof</label>
                        <input id="individualPoaType" type="text" className="modal-input" value={newIndividualProofType} onChange={(e) => setNewIndividualProofType(e.target.value)} placeholder="Utility bill, bank statement..." />
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualPoaIssuer">Issuer name</label>
                        <input id="individualPoaIssuer" type="text" className="modal-input" value={newIndividualProofIssuerName} onChange={(e) => setNewIndividualProofIssuerName(e.target.value)} placeholder="Company or institution" />
                      </div>
                    </div>

                    <h3 className="modal-section-title">5. Employment &amp; Financial</h3>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualEmployment">Employment status</label>
                        <select id="individualEmployment" className="modal-input" value={newIndividualEmploymentStatus} onChange={(e) => setNewIndividualEmploymentStatus(e.target.value as EmploymentStatus | '')}>
                          <option value="">Select</option>
                          <option value="Employed">Employed</option>
                          <option value="Self-employed">Self-employed</option>
                          <option value="Student">Student</option>
                          <option value="Unemployed">Unemployed</option>
                        </select>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualEmployer">Employer name<span className="field-optional-star" aria-label="Optional"> *</span></label>
                        <input id="individualEmployer" type="text" className="modal-input" value={newIndividualEmployerName} onChange={(e) => setNewIndividualEmployerName(e.target.value)} placeholder="Employer or company" />
                      </div>
                    </div>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualOccupation">Occupation / job title</label>
                        <input id="individualOccupation" type="text" className="modal-input" value={newIndividualOccupation} onChange={(e) => setNewIndividualOccupation(e.target.value)} placeholder="Job title" />
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualSourceOfFunds">Source of funds</label>
                        <input id="individualSourceOfFunds" type="text" className="modal-input" value={newIndividualSourceOfFunds} onChange={(e) => setNewIndividualSourceOfFunds(e.target.value)} placeholder="Salary, business, investments..." />
                      </div>
                    </div>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualIncome">Estimated monthly income range</label>
                        <input id="individualIncome" type="text" className="modal-input" value={newIndividualIncomeRange} onChange={(e) => setNewIndividualIncomeRange(e.target.value)} placeholder="Range or amount" />
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualActivity">Expected account activity<span className="field-optional-star" aria-label="Optional"> *</span></label>
                        <input id="individualActivity" type="text" className="modal-input" value={newIndividualExpectedActivity} onChange={(e) => setNewIndividualExpectedActivity(e.target.value)} placeholder="Description" />
                      </div>
                    </div>

                    <h3 className="modal-section-title">6. Risk &amp; Compliance</h3>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualPep">Politically exposed person (PEP)</label>
                        <select id="individualPep" className="modal-input" value={newIndividualPep} onChange={(e) => setNewIndividualPep(e.target.value as 'Yes' | 'No' | '')}>
                          <option value="">Select</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualRelatedPep">Related to PEP</label>
                        <select id="individualRelatedPep" className="modal-input" value={newIndividualRelatedPep} onChange={(e) => setNewIndividualRelatedPep(e.target.value as 'Yes' | 'No' | '')}>
                          <option value="">Select</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </div>
                    </div>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualTaxResidence">Country of tax residence</label>
                        <input id="individualTaxResidence" type="text" className="modal-input" value={newIndividualTaxResidenceCountry} onChange={(e) => setNewIndividualTaxResidenceCountry(e.target.value)} placeholder="Country" />
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="individualFatca">FATCA / CRS declaration</label>
                        <input id="individualFatca" type="text" className="modal-input" value={newIndividualFatcaDeclaration} onChange={(e) => setNewIndividualFatcaDeclaration(e.target.value)} placeholder="Declaration or status" />
                      </div>
                    </div>
                    <div className="modal-check-field">
                      <label className="modal-checkbox">
                        <input
                          type="checkbox"
                          checked={newIndividualSanctionsConsent}
                          onChange={(e) => setNewIndividualSanctionsConsent(e.target.checked)}
                        />
                        <span>Sanctions screening consent</span>
                      </label>
                    </div>
                    <div className="modal-check-field">
                      <label className="modal-checkbox">
                        <input
                          type="checkbox"
                          checked={newIndividualTermsAccepted}
                          onChange={(e) => setNewIndividualTermsAccepted(e.target.checked)}
                        />
                        <span>Terms and conditions accepted</span>
                      </label>
                    </div>
                  </div>
                )}
                {newType === 'Business' && (
                  <div className="business-kyc-form">
                    <p className="modal-form-intro">
                      Business KYC is more detailed because you must identify both the company and the people behind it.
                    </p>
                    <h3 className="modal-section-title">1. Company Basic Information</h3>
                    <p className="modal-section-purpose">Purpose: Legal existence of the entity.</p>
                    <div className="modal-field">
                      <label className="modal-label" htmlFor="businessRegisteredName">Registered company name</label>
                      <input id="businessRegisteredName" type="text" className="modal-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="As per registration" />
                    </div>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="businessTradingName">Trading name<span className="field-optional-star" aria-label="Optional"> *</span></label>
                        <input id="businessTradingName" type="text" className="modal-input" value={newBusinessTradingName} onChange={(e) => setNewBusinessTradingName(e.target.value)} placeholder="If different" />
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="businessReg">Company registration number</label>
                        <input id="businessReg" type="text" className="modal-input" value={newBusinessRegistration} onChange={(e) => setNewBusinessRegistration(e.target.value)} placeholder="BRN-123456" />
                      </div>
                    </div>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="businessDateIncorporation">Date of incorporation</label>
                        <input id="businessDateIncorporation" type="date" className="modal-input" value={newBusinessDateOfIncorporation} onChange={(e) => setNewBusinessDateOfIncorporation(e.target.value)} />
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="businessCountry">Country of incorporation</label>
                        <input id="businessCountry" type="text" className="modal-input" value={newBusinessCountry} onChange={(e) => setNewBusinessCountry(e.target.value)} placeholder="e.g. Zimbabwe" />
                      </div>
                    </div>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="businessType">Business type</label>
                        <select id="businessType" className="modal-input" value={newBusinessType} onChange={(e) => setNewBusinessType(e.target.value)}>
                          <option value="">Select type</option>
                          <option value="Private Limited">Private Limited</option>
                          <option value="Partnership">Partnership</option>
                          <option value="NGO">NGO</option>
                          <option value="Public Limited">Public Limited</option>
                          <option value="Sole Proprietor">Sole Proprietor</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="businessIndustry">Industry sector</label>
                        <input id="businessIndustry" type="text" className="modal-input" value={newBusinessIndustrySector} onChange={(e) => setNewBusinessIndustrySector(e.target.value)} placeholder="e.g. Manufacturing, Retail" />
                      </div>
                    </div>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="businessNature">Nature of business</label>
                        <input id="businessNature" type="text" className="modal-input" value={newBusinessNatureOfBusiness} onChange={(e) => setNewBusinessNatureOfBusiness(e.target.value)} placeholder="Brief description" />
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="businessTin">Tax number (TIN)<span className="field-optional-star" aria-label="Optional"> *</span></label>
                        <input id="businessTin" type="text" className="modal-input" value={newBusinessTin} onChange={(e) => setNewBusinessTin(e.target.value)} placeholder="Tax ID" />
                      </div>
                    </div>

                    <h3 className="modal-section-title">2. Registered Address</h3>
                    <p className="modal-section-purpose">Purpose: Locate the business.</p>
                    <div className="modal-field">
                      <label className="modal-label" htmlFor="businessRegAddress">Registered office address</label>
                      <textarea id="businessRegAddress" className="modal-input modal-textarea" value={newBusinessRegisteredAddress} onChange={(e) => setNewBusinessRegisteredAddress(e.target.value)} placeholder="Full registered address" rows={2} />
                    </div>
                    <div className="modal-field">
                      <label className="modal-label" htmlFor="businessTradingAddress">Trading address (if different)<span className="field-optional-star" aria-label="Optional"> *</span></label>
                      <textarea id="businessTradingAddress" className="modal-input modal-textarea" value={newBusinessTradingAddress} onChange={(e) => setNewBusinessTradingAddress(e.target.value)} placeholder="Physical trading address" rows={2} />
                    </div>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="businessAddressCountry">Country</label>
                        <input id="businessAddressCountry" type="text" className="modal-input" value={newBusinessAddressCountry} onChange={(e) => setNewBusinessAddressCountry(e.target.value)} placeholder="Country" />
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="businessPostalCode">Postal code</label>
                        <input id="businessPostalCode" type="text" className="modal-input" value={newBusinessPostalCode} onChange={(e) => setNewBusinessPostalCode(e.target.value)} placeholder="Postal code" />
                      </div>
                    </div>
                    <div className="modal-field">
                      <label className="modal-label" htmlFor="businessPoaDoc">Proof of address document</label>
                      <input id="businessPoaDoc" type="file" className="modal-input" onChange={(e) => setNewBusinessProofOfAddressFile(fileNameFromInput(e))} accept=".pdf,.jpg,.jpeg,.png" />
                      {newBusinessProofOfAddressFile && <span className="modal-file-name">{newBusinessProofOfAddressFile}</span>}
                    </div>

                    <h3 className="modal-section-title">3. Contact Details</h3>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="businessEmail">Official email</label>
                        <input id="businessEmail" type="email" className="modal-input" value={newBusinessEmail} onChange={(e) => setNewBusinessEmail(e.target.value)} placeholder="company@example.com" />
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="businessPhone">Phone number</label>
                        <input id="businessPhone" type="tel" className="modal-input" value={newBusinessPhone} onChange={(e) => setNewBusinessPhone(e.target.value)} placeholder="+263 ..." />
                      </div>
                    </div>
                    <div className="modal-field">
                      <label className="modal-label" htmlFor="businessWebsite">Website (if available)<span className="field-optional-star" aria-label="Optional"> *</span></label>
                      <input id="businessWebsite" type="url" className="modal-input" value={newBusinessWebsite} onChange={(e) => setNewBusinessWebsite(e.target.value)} placeholder="https://..." />
                    </div>

                    <h3 className="modal-section-title">4. Business Documents (Uploads)</h3>
                    <p className="modal-section-purpose">Typically required: Certificate of Incorporation, Memorandum &amp; Articles, CR14/Directors list, Business license, Proof of business address, Tax clearance (optional).</p>
                    <div className="modal-field">
                      <label className="modal-label" htmlFor="businessDocs">Documents provided / notes</label>
                      <textarea id="businessDocs" className="modal-input modal-textarea" value={newBusinessDocumentsProvided} onChange={(e) => setNewBusinessDocumentsProvided(e.target.value)} placeholder="List documents provided: Certificate of Incorporation, Memorandum & Articles, CR14, Business license, Proof of address, Tax clearance..." rows={4} />
                    </div>

                    <h3 className="modal-section-title">5. Directors Information</h3>
                    <p className="modal-section-purpose">For each director: Full name, DOB, Nationality, ID/Passport, Residential address, Contact details, PEP status. Each director usually goes through individual KYC.</p>
                    <div className="modal-field">
                      <label className="modal-label" htmlFor="businessDirectors">Directors (details per director)</label>
                      <textarea id="businessDirectors" className="modal-input modal-textarea" value={newBusinessDirectorsInfo} onChange={(e) => setNewBusinessDirectorsInfo(e.target.value)} placeholder="Name, DOB, nationality, ID number, address, contact, PEP status..." rows={4} />
                    </div>

                    <h3 className="modal-section-title">6. Ultimate Beneficial Owners (UBOs)</h3>
                    <p className="modal-section-purpose">Persons owning ≥25% (or jurisdiction threshold). For each: Full name, Ownership %, ID details, Address, Nationality, Source of wealth, PEP declaration.</p>
                    <div className="modal-field">
                      <label className="modal-label" htmlFor="businessUbo">UBO details</label>
                      <textarea id="businessUbo" className="modal-input modal-textarea" value={newBusinessUboDetails} onChange={(e) => setNewBusinessUboDetails(e.target.value)} placeholder="Per UBO: name, ownership %, ID, address, nationality, source of wealth, PEP..." rows={4} />
                    </div>

                    <h3 className="modal-section-title">7. Authorized Signatories</h3>
                    <p className="modal-section-purpose">People allowed to operate the account: Full name, Role, Specimen signature, ID details, Contact information.</p>
                    <div className="modal-field">
                      <label className="modal-label" htmlFor="businessSignatories">Signatories</label>
                      <textarea id="businessSignatories" className="modal-input modal-textarea" value={newBusinessSignatoriesInfo} onChange={(e) => setNewBusinessSignatoriesInfo(e.target.value)} placeholder="Name, role, contact, ID details..." rows={3} />
                    </div>

                    <h3 className="modal-section-title">8. Business Financial Profile</h3>
                    <p className="modal-section-purpose">Purpose: Transaction monitoring baseline.</p>
                    <div className="modal-field">
                      <label className="modal-label" htmlFor="businessSourceOfFunds">Source of funds</label>
                      <input id="businessSourceOfFunds" type="text" className="modal-input" value={newBusinessSourceOfFunds} onChange={(e) => setNewBusinessSourceOfFunds(e.target.value)} placeholder="Describe source of funds" />
                    </div>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="businessTurnover">Expected monthly turnover<span className="field-optional-star" aria-label="Optional"> *</span></label>
                        <input id="businessTurnover" type="text" className="modal-input" value={newBusinessMonthlyTurnover} onChange={(e) => setNewBusinessMonthlyTurnover(e.target.value)} placeholder="Amount or range" />
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="businessVolume">Expected transaction volume<span className="field-optional-star" aria-label="Optional"> *</span></label>
                        <input id="businessVolume" type="text" className="modal-input" value={newBusinessTransactionVolume} onChange={(e) => setNewBusinessTransactionVolume(e.target.value)} placeholder="Volume/frequency" />
                      </div>
                    </div>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="businessBankingCountries">Primary banking countries</label>
                        <input id="businessBankingCountries" type="text" className="modal-input" value={newBusinessBankingCountries} onChange={(e) => setNewBusinessBankingCountries(e.target.value)} placeholder="Countries" />
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="businessPurpose">Purpose of account</label>
                        <input id="businessPurpose" type="text" className="modal-input" value={newBusinessPurposeOfAccount} onChange={(e) => setNewBusinessPurposeOfAccount(e.target.value)} placeholder="Primary use of account" />
                      </div>
                    </div>

                    <h3 className="modal-section-title">9. Risk &amp; Compliance Declarations</h3>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="businessPep">PEP declaration (entity level)</label>
                        <select id="businessPep" className="modal-input" value={newBusinessPepDeclaration} onChange={(e) => setNewBusinessPepDeclaration(e.target.value as 'Yes' | 'No' | '')}>
                          <option value="">Select</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="businessSanctions">Sanctions declaration</label>
                        <input id="businessSanctions" type="text" className="modal-input" value={newBusinessSanctionsDeclaration} onChange={(e) => setNewBusinessSanctionsDeclaration(e.target.value)} placeholder="Declaration / status" />
                      </div>
                    </div>
                    <div className="modal-field">
                      <label className="modal-label" htmlFor="businessFatca">FATCA / CRS status</label>
                      <input id="businessFatca" type="text" className="modal-input" value={newBusinessFatcaCrsStatus} onChange={(e) => setNewBusinessFatcaCrsStatus(e.target.value)} placeholder="FATCA/CRS declaration or status" />
                    </div>
                    <div className="modal-field">
                      <label className="modal-label" htmlFor="businessRegulatory">Regulatory confirmations<span className="field-optional-star" aria-label="Optional"> *</span></label>
                      <textarea id="businessRegulatory" className="modal-input modal-textarea" value={newBusinessRegulatoryConfirmations} onChange={(e) => setNewBusinessRegulatoryConfirmations(e.target.value)} placeholder="Regulatory confirmations, board resolution notes..." rows={2} />
                    </div>
                    <div className="modal-check-field">
                      <label className="modal-checkbox">
                        <input type="checkbox" checked={newBusinessBoardResolution} onChange={(e) => setNewBusinessBoardResolution(e.target.checked)} />
                        <span>Board resolution provided</span>
                      </label>
                    </div>
                    <div className="modal-check-field">
                      <label className="modal-checkbox">
                        <input type="checkbox" checked={newBusinessTermsAccepted} onChange={(e) => setNewBusinessTermsAccepted(e.target.checked)} />
                        <span>Terms &amp; conditions acceptance</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={handleCloseAddModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-action">
                  Add Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editRecord && (
        <div className="modal-backdrop" onClick={handleCloseEditModal}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Profile</h2>
              <button className="modal-close-btn" onClick={handleCloseEditModal} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <form className="modal-form" onSubmit={handleSaveEdit}>
              <div className="modal-body">
                <div className="modal-field">
                  <label className="modal-label" htmlFor="editApplicantName">Applicant name</label>
                  <input
                    id="editApplicantName"
                    type="text"
                    className="modal-input"
                    value={editApplicantName}
                    onChange={(e) => setEditApplicantName(e.target.value)}
                    placeholder="Applicant name"
                  />
                </div>
                <div className="modal-field">
                  <label className="modal-label" htmlFor="editDecision">Decision</label>
                  <select
                    id="editDecision"
                    className="modal-input"
                    value={editDecision}
                    onChange={(e) => setEditDecision(e.target.value as DecisionStatus)}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={handleCloseEditModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-action">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteRecord && (
        <div className="modal-backdrop" onClick={handleCloseDeleteModal}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Profile</h2>
              <button className="modal-close-btn" onClick={handleCloseDeleteModal} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-delete-message">
                Are you sure you want to delete the profile for <strong>{deleteRecord.applicantName}</strong> ({deleteRecord.id})? This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary-action" onClick={handleCloseDeleteModal}>
                Cancel
              </button>
              <button type="button" className="btn-danger-action" onClick={handleConfirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
