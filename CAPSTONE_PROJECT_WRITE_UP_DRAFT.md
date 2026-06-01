# AI-Powered Anti-Money Laundering System

## Title Page

**Project Title:** AI-Powered Anti-Money Laundering System  
**Student Name:** [Insert student name]  
**Registration Number:** [Insert registration number]  
**Institution / Faculty / Department:** [Insert institution, faculty, and department]  
**Supervisor(s):** [Insert supervisor name(s)]  
**Date of Submission:** [Insert submission date]

---

## Abstract

Financial institutions are required to identify, investigate, and report suspicious financial activity in order to reduce money laundering, terrorist financing, fraud, and other forms of financial crime. Manual transaction review is often slow, inconsistent, and difficult to scale when transaction volumes increase. This project presents an AI-powered Anti-Money Laundering (AML) system designed to support customer onboarding, transaction monitoring, watchlist screening, alert management, investigation workflows, and suspicious activity reporting.

The system was developed using a React frontend and a Django REST Framework backend. The backend includes modules for customer management, Know Your Customer (KYC) profiling, transaction processing, machine-learning-assisted risk scoring, anomaly detection, alert generation, case investigation, suspicious activity reporting, law enforcement transmission tracking, and digital evidence management. The risk scoring engine evaluates transaction amount, transaction velocity, high-risk countries, customer profile risk, pattern deviation, and Politically Exposed Person (PEP) or sanctions indicators. The frontend provides operational dashboards for analysts to view customers, transactions, alerts, screening outcomes, reports, and model management functions.

The outcome of the project is a functional AML compliance platform prototype that automates important monitoring tasks and improves the visibility of suspicious activity. The system supports real-time and batch transaction workflows, configurable alert rules, KYC decision tracking, and compliance reporting. Future work includes integration with live sanctions databases, deployment of trained production-grade machine learning models, and broader performance testing using real institutional datasets.

---

## Acknowledgements

I would like to thank my supervisor(s), [Insert supervisor name(s)], for their guidance and feedback throughout the development of this project. I also acknowledge [Insert institution name] for providing the academic environment and resources required to complete this capstone project. Finally, I thank my classmates, friends, family, and any contributors who supported the design, testing, and documentation of this work.

---

## Table of Contents

1. Abstract  
2. Acknowledgements  
3. List of Abbreviations  
4. Chapter 1: Introduction  
5. Chapter 2: Literature Review  
6. Chapter 3: Methodology and System Design  
7. Chapter 4: System Implementation  
8. Chapter 5: Results and Discussion  
9. Chapter 6: Conclusion and Recommendations  
10. References  
11. Appendices

---

## List of Figures and Tables

**Figure 1:** Proposed AML system architecture  
**Figure 2:** Transaction monitoring workflow  
**Figure 3:** Risk scoring and alert generation pipeline  
**Table 1:** Risk factors used by the transaction scoring engine  
**Table 2:** Main system modules and functions  
**Table 3:** Functional testing summary

---

## List of Abbreviations

**AI** - Artificial Intelligence  
**AML** - Anti-Money Laundering  
**API** - Application Programming Interface  
**CFT** - Countering the Financing of Terrorism  
**CSV** - Comma-Separated Values  
**DRF** - Django REST Framework  
**FATF** - Financial Action Task Force  
**KYC** - Know Your Customer  
**ML** - Machine Learning  
**PEP** - Politically Exposed Person  
**REST** - Representational State Transfer  
**SAR** - Suspicious Activity Report  
**UI** - User Interface  

---

# Chapter 1: Introduction

## 1.1 Background of the Study

Money laundering is the process of hiding the origin of illegally obtained funds so that they appear to come from legitimate sources. It is a major threat to financial institutions, regulators, governments, and society because it enables corruption, organised crime, terrorism financing, fraud, tax evasion, and other criminal activity. Banks and financial service providers are therefore expected to monitor customers, understand customer risk, screen against sanctions and watchlists, detect unusual transactions, investigate alerts, and report suspicious activity to the relevant authorities.

Traditional AML monitoring processes often depend on static rules, spreadsheets, manual review, and fragmented systems. These approaches can produce large numbers of false positives and may fail to identify changing laundering patterns. As financial transactions become more digital and high-volume, institutions need systems that can process transaction data quickly, score risk consistently, support analyst review, and maintain audit trails.

This project addresses that need by developing an AI-powered AML system. The system combines rule-based monitoring with machine-learning-assisted scoring and anomaly detection. It also provides operational modules for KYC onboarding, customer records, transaction uploads, real-time transaction monitoring, watchlist screening, alert handling, case investigation, SAR reporting, and system configuration.

## 1.2 Problem Statement

Financial institutions face difficulty detecting suspicious transactions in a timely and consistent way when transaction volumes are high and risk indicators are spread across customer data, transaction histories, watchlists, and compliance rules. Manual AML monitoring is time-consuming and may result in delayed investigations, missed suspicious activity, inconsistent risk ratings, and weak documentation for regulatory review.

The problem addressed by this project is the lack of an integrated AML platform that can support automated transaction monitoring, customer risk profiling, alert generation, analyst investigation, and reporting in one workflow.

## 1.3 Aim of the Project

The aim of this project is to design and implement an AI-powered Anti-Money Laundering system that helps financial institutions detect suspicious transactions, assess customer and transaction risk, manage compliance alerts, and support AML investigation and reporting workflows.

## 1.4 Objectives

The specific objectives of the project are:

1. To develop a customer management and KYC module for storing customer profiles, risk levels, PEP status, sanctions status, and onboarding information.
2. To implement transaction capture, upload, and real-time monitoring features.
3. To design a risk scoring engine that evaluates transactions using multiple AML risk factors.
4. To implement anomaly, velocity, amount threshold, structuring, high-risk country, PEP, and sanctions-related checks.
5. To generate alerts automatically when suspicious activity is detected.
6. To provide dashboards and user interfaces for analysts to review customers, transactions, alerts, cases, reports, and model information.
7. To support SAR-related reporting and investigation documentation.
8. To provide a configurable and extensible system architecture that can be improved with external watchlists and trained ML models.

## 1.5 Research Questions

This project was guided by the following questions:

1. How can customer and transaction data be combined to support more consistent AML risk assessment?
2. Which risk factors are useful for identifying suspicious financial transactions?
3. How can a system automate alert generation while still supporting analyst review and decision-making?
4. How can KYC, screening, transaction monitoring, investigations, and reporting be integrated into a single AML workflow?

## 1.6 Significance of the Study

The project is significant because it demonstrates how technology can improve AML compliance operations. It can help analysts reduce manual workload, detect suspicious activity earlier, standardise risk scoring, and maintain structured records for investigations. The system is also useful as an academic prototype for understanding how AI and rule-based monitoring can work together in financial crime detection.

## 1.7 Scope of the Study

The project covers the design and implementation of an AML platform with the following modules:

- User authentication and role-based access support.
- Customer and KYC profile management.
- Transaction management, upload, and real-time streaming support.
- AML risk scoring and monitoring.
- Alert generation and alert rules.
- Investigation and case management.
- Watchlist screening support.
- SAR reporting support.
- Operational dashboards and reports.
- Model management and dataset handling.

## 1.8 Limitations

The project has the following limitations:

- The ML prediction engine currently uses a simplified scoring approach and requires real labelled datasets for production-grade model training.
- External sanctions and watchlist APIs require valid API credentials and live integrations.
- Evaluation results depend on the availability and quality of transaction datasets.
- The system is a prototype and would require security hardening, scalability testing, and regulatory validation before use in a live financial institution.

---

# Chapter 2: Literature Review

## 2.1 Anti-Money Laundering and Financial Crime Compliance

AML refers to the policies, controls, processes, and technologies used to prevent criminals from disguising illicit proceeds as legitimate funds. The Financial Action Task Force provides international AML/CFT standards used by many jurisdictions. These standards encourage risk-based customer due diligence, record keeping, suspicious transaction reporting, and controls for higher-risk customers and transactions.

Financial institutions generally apply AML controls across the customer lifecycle. During onboarding, customers are identified and assessed through KYC checks. During the relationship, transactions are monitored for unusual activity. When suspicious activity is detected, analysts investigate the case and may file a SAR with the relevant authority.

## 2.2 Existing AML Monitoring Approaches

Many AML systems use rule-based detection. Examples include rules for large cash deposits, transactions above reporting thresholds, rapid movement of funds, transactions involving high-risk jurisdictions, repeated transactions just below a threshold, and unusual activity after account dormancy. Rule-based systems are simple to understand and explain, but they may generate many false positives if thresholds are poorly configured.

Machine learning can improve AML monitoring by identifying patterns in historical data and detecting deviations from normal behaviour. Common techniques include anomaly detection, classification models, clustering, network analysis, and risk scoring. However, machine learning in AML must be explainable because analysts and regulators need to understand why a transaction was flagged.

## 2.3 Customer Due Diligence and KYC

KYC processes help institutions verify customer identity, understand customer profiles, and assess risk before and during the customer relationship. Important KYC data includes personal or business details, country, occupation or business activity, source of funds, expected transaction behaviour, PEP status, sanctions status, and document verification results. Strong KYC records improve transaction monitoring because transaction behaviour can be compared against the expected customer profile.

## 2.4 Watchlist, PEP, and Sanctions Screening

Watchlist screening compares customers or counterparties against sanctions lists, PEP lists, adverse media indicators, and other restricted-party databases. A match may not automatically prove wrongdoing, but it requires review. Screening systems often use exact and fuzzy matching because names may appear in different formats or spellings.

## 2.5 Risk-Based AML Monitoring

A risk-based approach prioritises resources toward customers and transactions with higher risk. In this project, the transaction risk score is based on amount, velocity, country risk, customer profile, pattern deviation, and PEP or sanctions indicators. This approach provides a more balanced assessment than relying on only one threshold.

## 2.6 Gaps in Existing Solutions

The reviewed approaches show that AML monitoring works best when several functions are connected: KYC, transaction monitoring, screening, alert handling, investigations, reporting, and audit trails. A gap exists where institutions or students rely on isolated spreadsheets or individual scripts that do not support the full compliance workflow. This project addresses the gap by building an integrated prototype that connects customer records, transactions, risk scoring, alerts, investigation workflows, and reporting interfaces.

---

# Chapter 3: Methodology and System Design

## 3.1 Research Methodology

The project followed a design and development methodology. Requirements were identified from the AML compliance workflow described in the capstone guide and from common financial crime monitoring processes. The system was then designed, implemented, and tested as a functional software prototype.

The development approach was iterative. Core backend models and APIs were created first, followed by frontend interfaces for operational use. AML monitoring logic was then connected to transaction creation and alert generation. Finally, reporting, screening, configuration, and dashboard modules were added to improve usability.

## 3.2 System Requirements

The functional requirements of the system include:

- The system shall allow users to authenticate before accessing AML functions.
- The system shall store customer and KYC profile details.
- The system shall store transaction details and support transaction upload.
- The system shall calculate a risk score for each monitored transaction.
- The system shall flag transactions based on AML risk indicators.
- The system shall generate alerts for suspicious transactions.
- The system shall allow analysts to view, assign, resolve, or escalate alerts.
- The system shall provide dashboards and reports for monitoring AML activity.
- The system shall support SAR and investigation-related records.

The non-functional requirements include:

- The system should be modular and extensible.
- The system should provide clear audit trails.
- The system should expose API endpoints for integration.
- The user interface should be usable by compliance analysts.
- The backend should support future improvements such as trained ML models and external screening APIs.

## 3.3 System Architecture

The system uses a client-server architecture. The frontend is built with React and Vite. It communicates with the backend through REST API endpoints. The backend is built with Django and Django REST Framework. The database stores users, customers, transactions, KYC profiles, risk scores, alerts, investigations, SAR records, screening records, and configuration data.

The main system layers are:

- **Presentation layer:** React pages for dashboards, customers, transactions, KYC, screening, alerts, cases, reports, SAR, notifications, configuration, and modelling.
- **API layer:** Django REST Framework viewsets and API routes.
- **Business logic layer:** AML risk scoring, transaction monitoring, alert generation, screening, and customer risk profiling services.
- **Data layer:** Django models and relational database tables.
- **Real-time layer:** WebSocket support for transaction streaming.

## 3.4 Main System Modules

The Transactions module stores transaction data, imports transaction files, and supports real-time transaction streams.

## 3.5 Risk Scoring Design

The transaction risk scoring engine calculates a weighted score from six factors:

| Risk Factor | Weight | Purpose |
| --- | ---: | --- |
| Amount | 25% | Identifies large-value transactions. |
| Velocity | 20% | Detects frequent transactions within a short time window. |
| Country risk | 20% | Flags transactions involving high-risk jurisdictions. |
| Customer profile | 15% | Uses existing customer risk information. |
| Pattern deviation | 10% | Compares current behaviour with historical activity. |
| PEP or sanctions | 10% | Increases risk for PEP or sanctioned parties. |

The final score is classified as low, medium, or high risk using configurable thresholds.

## 3.6 Data Collection and Tools

The system is designed to work with customer records, transaction records, KYC records, watchlist records, and alert records. Sample data and uploaded transaction files can be used for testing. In a real deployment, data would be obtained from banking systems, payment platforms, KYC systems, external sanctions providers, and regulatory reporting systems.

The main tools and technologies used include:

- React 18 for the frontend.
- TypeScript for frontend type safety.
- Vite for frontend development and builds.
- Django 5.1.7 for the backend.
- Django REST Framework for APIs.
- MySQL for relational data storage.
- Channels for WebSocket support.
- NumPy, Pandas, and scikit-learn for ML-related processing.
- Celery and Redis support for asynchronous and scheduled processing.

---

# Chapter 4: System Implementation

## 4.1 Backend Implementation

The backend was implemented in Django. The project contains multiple Django apps that represent the main business areas of the AML system. The accounts app manages users and customers. The transactions app manages transaction records and transaction data sources. The ML engine app contains the transaction risk scorer, anomaly detector, structuring detector, prediction engine, risk score records, model records, and monitoring pipeline. The alerts app manages alerts, investigations, and alert rules. Additional apps support KYC, screening, SAR filing, law enforcement workflows, and forensics.

## 4.2 Frontend Implementation

The frontend was implemented using React and TypeScript. It includes pages for the dashboard, customers, KYC, transactions, transaction upload, alerts, cases, SAR, reports, performance, notifications, screening, model management, data management, data validation, and system configurations. The layout includes navigation components that allow users to move between operational areas.

The frontend communicates with the backend through API helper functions. It also supports token-based authentication and uses reusable context providers for authentication, toast messages, and notification counts.

## 4.3 Transaction Monitoring Pipeline

When a transaction is processed, the monitoring service performs the following steps:

1. Calculate a transaction risk score.
2. Run a prediction using the ML prediction engine.
3. Check amount thresholds.
4. Check transaction velocity.
5. Check potential structuring patterns.
6. Check high-risk country involvement.
7. Check customer risk rules.
8. Check dormant account activity.
9. Check cash ratio rules.
10. Check round amount patterns.
11. Check rapid movement of funds.
12. Check PEP and sanctions indicators.
13. Generate an alert if the transaction is suspicious.
14. Save the risk score and anomaly records.

## 4.4 Alert Management

Alerts are generated when a transaction is identified as suspicious or when configured rules are triggered. Each alert includes an alert type, severity, customer, title, description, risk score, ML confidence, features, priority, and linked transactions. Analysts can review alerts, assign them, resolve them, or escalate them depending on the investigation outcome.

## 4.5 KYC and Customer Risk

The system stores customer details such as customer type, names, company information, country, risk level, risk score, PEP status, and sanctions status. KYC records support onboarding and verification. Customer risk can be updated based on transaction history, average risk, suspicious transaction ratio, and total transaction volume.

## 4.6 Watchlist Screening

The screening module supports watchlist sources, entries, screening jobs, matches, configuration, and audit logs. The frontend includes pages for manual screening, screening queues, approved profiles, declined profiles, and screened profiles. This supports the compliance workflow where possible matches need to be reviewed before a final decision is made.

## 4.7 SAR and Reporting

The SAR module stores SAR templates, reports, narratives, attachments, exports, deadline tracking, and statistics. The reporting pages allow operational and SAR-related information to be reviewed and exported. This supports the documentation required when suspicious activity must be reported.

## 4.8 Security and Audit Considerations

The system uses authentication before access to protected endpoints. It also separates business modules and maintains structured database records for transactions, alerts, investigations, SARs, screening matches, and evidence. In a production deployment, the system should also enforce HTTPS, environment-based secrets, stronger role permissions, encryption controls, and regular security audits.

---

# Chapter 5: Results and Discussion

## 5.1 Functional Results

The project produced a functional AML platform prototype with the following implemented capabilities:

- Customer and KYC profile management.
- Transaction recording, upload, and streaming support.
- Risk scoring using multiple AML factors.
- Detection of large amounts, high velocity, structuring, high-risk country activity, unusual patterns, PEP indicators, and sanctions indicators.
- Automatic alert generation for suspicious transactions.
- Alert review, assignment, escalation, and resolution support.
- Dashboard and performance views.
- Screening workflows for customer profiles.
- SAR and reporting support.
- System configuration and model management pages.

## 5.2 Risk Scoring Output

The transaction risk scoring engine returns a numerical score, a risk level, risk factor breakdown, and a human-readable explanation. This helps analysts understand why a transaction was flagged. For example, a transaction may be flagged because of a high amount, high transaction frequency, high-risk country involvement, customer risk profile, unusual deviation from historical behaviour, or PEP/sanctions indicators.

## 5.3 Alert Generation Output

When suspicious activity is detected, the system creates an AML alert linked to the relevant customer and transaction. The alert is assigned a type such as structuring, velocity, high-risk country, sanctions, PEP, unusual pattern, large cash, round amount, rapid movement, or threshold. The alert severity is based on the risk level and configured rules.

## 5.4 User Interface Results

The frontend provides an analyst-facing interface for the major AML workflows. Analysts can view dashboard metrics, search customer records, review transaction tables, process screening queues, inspect alerts, manage cases, review reports, and configure system settings. This improves usability compared with manual spreadsheet-based monitoring.

## 5.5 Discussion

The project demonstrates that an integrated AML platform can reduce fragmentation in compliance operations. By connecting KYC, transaction monitoring, risk scoring, alerts, screening, investigations, and reports, the system gives analysts a more complete view of customer and transaction risk.

The risk scoring approach is explainable because each score is broken down into factors. This is important in AML because compliance teams need to justify why an alert was created. The project also shows the value of combining static rules with AI-assisted logic. Rules are useful for known typologies such as structuring and large transactions, while anomaly detection helps identify unusual behaviour.

However, the system should not be treated as a final production AML tool without further validation. The ML engine requires real labelled datasets, model training, testing, and monitoring. External watchlists should be connected to authoritative sources. Thresholds should be calibrated to the institution's customer base and regulatory context.

## 5.6 Testing Summary

| Test Area | Expected Result | Status |
| --- | --- | --- |
| User authentication | Users can log in and access protected pages. | Implemented |
| Customer records | Users can create and view customers. | Implemented |
| Transaction processing | Transactions can be stored and monitored. | Implemented |
| Risk scoring | Transactions receive risk scores and explanations. | Implemented |
| Alert generation | Suspicious transactions generate alerts. | Implemented |
| Screening workflow | Profiles can be screened and reviewed. | Implemented |
| Reporting | Reports and SAR-related records can be viewed. | Implemented |
| ML accuracy metrics | Requires labelled test dataset. | Pending further evaluation |

---

# Chapter 6: Conclusion and Recommendations

## 6.1 Conclusion

This project successfully designed and implemented an AI-powered Anti-Money Laundering system prototype. The system provides a structured platform for customer management, KYC, transaction monitoring, risk scoring, alert management, screening, SAR reporting, and compliance dashboards. It addresses the problem of fragmented and manual AML monitoring by integrating key compliance workflows into one application.

The project achieved its main objectives by implementing a working backend, frontend, risk scoring engine, monitoring pipeline, and analyst-facing interface. The system can identify suspicious transactions using several indicators, including amount, velocity, structuring, country risk, customer risk, unusual patterns, PEP status, and sanctions status.

## 6.2 Recommendations

The following recommendations are proposed for future improvement:

1. Integrate live sanctions, PEP, and adverse media data sources.
2. Train and evaluate supervised ML models using labelled transaction datasets.
3. Add explainable AI methods such as SHAP or LIME for model interpretability.
4. Improve false positive reduction through threshold calibration and analyst feedback loops.
5. Add stronger role-based access control for different compliance users.
6. Perform load testing with high-volume transaction datasets.
7. Implement production security controls such as HTTPS, encrypted secrets, secure audit logging, and regular penetration testing.
8. Add automated SAR submission integration where supported by the relevant regulator.

## 6.3 Future Work

Future work may include graph-based network analysis to identify related accounts, beneficial ownership networks, mule account clusters, and circular fund flows. The system can also be expanded with real-time streaming integrations, advanced dashboards, mobile access, and regulator-specific SAR formats.

---

# References

Basel Committee on Banking Supervision (2020) *Sound management of risks related to money laundering and financing of terrorism*. Bank for International Settlements. Available at: https://www.bis.org/publ/bcbs252.htm (Accessed: 28 May 2026).

Financial Action Task Force (2025) *International standards on combating money laundering and the financing of terrorism and proliferation: The FATF Recommendations*. Available at: https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html (Accessed: 28 May 2026).

United Nations (n.d.) *Transnational organized crime*. Available at: https://www.un.org/en/peace-and-security/transnational-crime (Accessed: 28 May 2026).

Project source code (2026) *AI-Powered Anti-Money Laundering System*. Local project repository, AML workspace.

---

# Appendices

## Appendix A: Main API Areas

- Authentication API.
- Customer API.
- KYC API.
- Transaction API.
- Alert API.
- Investigation API.
- ML model API.
- Risk score API.
- Screening API.
- SAR API.
- System configuration API.

## Appendix B: Example Transaction Risk Factors

```text
Amount risk
Velocity risk
Country risk
Customer profile risk
Pattern deviation risk
PEP or sanctions risk
```

## Appendix C: Suggested Screenshots to Add

Add screenshots from the running system in the final document:

1. Login page.
2. Main dashboard.
3. Customers page.
4. KYC profile page.
5. Transactions page.
6. Alerts page.
7. Screening page.
8. SAR or reports page.
9. Model management page.
10. System configuration page.

## Appendix D: Suggested Code Snippets to Add

Add short code snippets from the following files if required by the final submission:

- `server/ml_engine/ml_service.py` for the risk scoring logic.
- `server/ml_engine/monitoring.py` for the transaction monitoring pipeline.
- `server/alerts/models.py` for alert records.
- `server/transactions/models.py` for transaction records.
- `client/src/pages/Dashboard.tsx` for the analyst dashboard.
