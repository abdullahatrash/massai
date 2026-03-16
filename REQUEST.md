# MaaSAI Blockchain and Smart Contracts Workflow

**Project Context and Tool Integration Specification**

| Field | Value |
|---|---|
| Document Version | 1.0 |
| Date | February 25, 2026 |
| Project | MaaSAI - Manufacturing as a Service with AI |
| Purpose | Define blockchain dApp workflows with emphasis on MSB and SCT integration across pilot use cases |

---

## Executive Summary

This document provides a comprehensive overview of the MaaSAI blockchain decentralized application (dApp) development requirements, recapping the initial project context and integrating detailed workflows from the three active pilot implementations. The focus is on two critical tools:

- **MSB (MaaS Blockchain):** The underlying blockchain infrastructure for immutable agreement storage and transaction logging
- **SCT (Smart Contracts Toolkit):** The application layer enabling automated contract creation, monitoring, and execution

The blockchain dApp will receive finalized manufacturing agreements via an exposed HTTP endpoint as JSON objects, store them immutably on the blockchain, and monitor production progress throughout the manufacturing lifecycle. This document addresses the missing parameter definitions needed to design UI mockups and gather pilot feedback.

---

## Project Context Recap

### The Challenge

The MaaSAI project is developing a blockchain-based smart contract dApp for manufacturing agreements. The system architecture is defined, and the high-level workflow is established:

1. Manufacturing agreements are negotiated through MaaSAI Collaboration Hub (MCH) and Cloud MaaS Marketplace (CMM)
2. Finalized agreements are transmitted to the blockchain dApp via HTTP endpoint
3. The dApp creates immutable smart contracts using MSB and SCT
4. During production, the dApp monitors progress and triggers automated actions
5. Milestone completions, quality gates, and payment events are verified and logged

### The Gap

**What we have:**
- System architecture defined
- Integration points identified (MCH, CMM, Data Integrator, Edge Data Storage)
- HTTP endpoint concept established
- Smart contract monitoring functionality outlined

**What we need:**
- Detailed agreement parameters (date, price, milestones, quality criteria, etc.)
- Data schema for JSON agreement transmission
- Pilot-specific workflow integration details
- UI mockup specifications based on actual pilot processes

### The Purpose

This document serves as:
- Foundation for UI mockup design
- Basis for pilot feedback collection
- Technical specification for development team
- Integration guide for MSB and SCT tools

---

## Pilot Use Case Overview

### Pilot 1: Factor (Metal Parts Manufacturing)

| Field | Detail |
|---|---|
| Industrial Partner | Factor Ingeniería y Decoletaje SL (Valencia, Spain) |
| Tech Partner | EXOS |
| Focus | Metal parts machining with tight tolerances |

**Business Processes:**
- **BP01 - Provider Search:** Finding external manufacturing providers when in-house capacity is insufficient
- **BP02 - Production Monitoring:** Real-time tracking of provider production status
- **BP03 - Quality Control:** Receiving and inspecting provider production with verification

**MSB/SCT Role:**
- Fast and reliable business agreements (BP01)
- Secure contracts history registry (BP01)
- Automated production status updates reducing manual communication (BP02)

---

### Pilot 2: Tasowheel (Gears Manufacturing)

| Field | Detail |
|---|---|
| Industrial Partner | Tasowheel Oy (Tampere, Finland) |
| RD Partner | TAU (Tampere University) |
| Focus | Gears manufacturing with quotation process automation |

**Business Process:**
- **BP01 - Quotation Process:** Automated quotation from customer request to order acceptance

**MSB/SCT Role:**
- Store quotation agreements on blockchain
- Automate quote generation and acceptance workflow
- Trigger order processing upon customer acceptance
- Track capacity and delivery commitments

---

### Pilot 5: E4M (Electronics Manufacturing Services)

| Field | Detail |
|---|---|
| Industrial Partner | E4M - Engenharia Mecatrónica Lda (Guimarães, Portugal) |
| Tech Partner | UNINOVA |
| Focus | Custom electronics/PCB manufacturing and mechatronics solutions |

**Business Processes:**
- **BP01 - Customer Interaction:** Initial commercial information exchange
- **BP02 - Development Process:** Design, testing, and validation monitoring
- **BP03 - Maintenance:** Predictive maintenance of deployed products
- **BP04 - End-of-Life:** Circular economy and sustainability management

**MSB/SCT Role:**
- Enable fast and reliable business agreements (BP01)
- Secure contracts history registry (BP01)
- Track development milestones and design iterations (BP02)
- Document lifecycle management for R3T (Repair-Reuse-Recycle) toolkit (BP04)

---

## MSB and SCT Architecture

### MaaS Blockchain (MSB) Overview

MSB provides the foundational blockchain infrastructure with the following characteristics:

| Component | Description |
|---|---|
| Blockchain Network | Distributed ledger technology (Ethereum-compatible or Hyperledger Fabric) |
| Immutable Storage | Permanent storage of agreement terms, amendments, and transaction history |
| Transaction Logging | Cryptographically signed logs of all contract interactions |
| Access Control | Role-based permissions for contract read/write operations |
| Data Privacy | Selective disclosure - sensitive data encrypted, only hashes stored on-chain |
| Consensus Mechanism | Validation of contract state changes through network consensus |
| Smart Contract Deployment | Infrastructure for deploying and executing contract code |
| Event Emission | Blockchain events triggering external system notifications |

*Table 1: MSB Core Capabilities*

### Smart Contracts Toolkit (SCT) Overview

SCT is the application layer built on top of MSB, providing manufacturing-specific functionality:

| Component | Description |
|---|---|
| Contract Templates | Pre-built contract types for different manufacturing scenarios |
| Agreement Parser | Converts JSON agreements to smart contract parameters |
| Milestone Tracking | Monitors production progress against defined milestones |
| Automated Actions | Executes predefined actions based on contract logic |
| Verification Rules | Validates milestone completion using external data sources |
| Payment Triggers | Automates payment notifications based on milestones |
| Alert System | Generates notifications for delays, quality issues, or violations |
| Amendment Handler | Manages contract modifications with multi-party approval |
| Dispute Resolution | Supports escalation workflows and mediation processes |
| Reporting Interface | Generates compliance and audit reports from blockchain data |

*Table 2: SCT Core Capabilities*

---

## Detailed Workflow Integration

### Pilot 1 Workflows: Factor Metal Parts Manufacturing

#### BP01: Provider Search with MSB/SCT

**Workflow Sequence:**

1. **Consumer Request Initiation**
   - Factor identifies outsourcing need due to capacity constraints
   - Request entered into Cloud MaaS Marketplace (CMM)
   - Product specifications, quantity, and delivery requirements defined

2. **Provider Matching**
   - MaaS Dynamic Catalogue searches for capable providers
   - Recommendation System ranks providers based on:
     - Capability match
     - Historical performance (from MSB contract history)
     - Current capacity
     - Quality ratings
   - Multiple provider options presented to Factor

3. **Quotation Exchange**
   - Selected providers submit quotations via MaaS Collaboration Hub
   - Quotation parameters include:
     - Unit price and total cost
     - Lead time and delivery date
     - Quality certifications
     - Payment terms
   - Factor reviews and selects provider

4. **Agreement Creation via SCT**
   - Final agreement terms compiled into JSON structure
   - JSON transmitted to SCT via HTTP endpoint
   - SCT parses agreement and generates smart contract code
   - Contract deployed on MSB blockchain network
   - Both parties digitally sign contract

5. **Contract Activation**
   - MSB logs contract creation event
   - Contract status: "Active"
   - Monitoring phase begins
   - Initial notifications sent to both parties

**MSB/SCT Data Parameters Required:**

| Parameter Category | Priority | Key Fields |
|---|---|---|
| Provider Selection Criteria | High | Capabilities, certifications, capacity, quality history |
| Agreement Identification | High | Agreement ID, version, creation timestamp, parties |
| Product Specifications | High | Technical drawings, material, tolerances, quantity |
| Commercial Terms | High | Price, payment milestones, delivery terms |
| Quality Requirements | High | Inspection criteria, acceptance standards |
| Timeline | High | Production start, delivery date, milestones |

*Table 3: BP01 Critical Parameters*

---

#### BP02: Monitoring Provider Production with MSB/SCT

**Workflow Sequence:**

1. **Production Start Notification**
   - Provider confirms production start via MaaS Collaboration Hub
   - SCT updates contract state to "InProduction"
   - MSB logs production start event with timestamp

2. **Automated Status Updates**
   - Provider's Edge MaaS Data Storage sends production data to Data Integrator
   - Data includes:
     - Quantity produced (current vs planned)
     - Current production stage
     - Quality inspection results
     - Machine utilization data
   - Data Integrator formats data and sends to SCT
   - SCT updates contract state on MSB

3. **Remote Monitoring Control Panels**
   - Factor accesses Control Panels to view real-time production status
   - Control Panels query SCT for current contract state
   - Visual dashboard displays:
     - Production progress percentage
     - Quality metrics
     - Schedule adherence
     - Next milestone due date

4. **Milestone Completion Verification**
   - Provider submits milestone completion evidence
   - SCT verification rules check:
     - Production data confirms completion
     - Quality gate passed
     - Timeline adherence
   - If verified: MSB logs milestone completion event
   - Notifications sent to Factor automatically (no manual calls/emails)

5. **Alert Generation**
   - SCT monitors for alert conditions:
     - Production delay exceeding threshold
     - Quality rejection rate above acceptable level
     - No data update received within expected timeframe
   - When triggered: SCT generates alert event on MSB
   - Point-to-Point Secure Messaging delivers alerts to relevant parties
   - Alerts logged permanently on blockchain for audit trail

**MSB/SCT Data Parameters Required:**

| Parameter Category | Priority | Key Fields |
|---|---|---|
| Production Monitoring | High | Quantity produced, current stage, quality results, schedule adherence |
| Milestone Definitions | High | Milestone ID, name, planned date, completion criteria |
| Data Source Integration | High | Endpoint URLs, update frequency, authentication |
| Alert Conditions | High | Trigger conditions, severity, recipients, actions |
| Verification Rules | High | Automatic vs manual approval, data sources, thresholds |
| Access Permissions | Medium | Who can view production data, export rights |

*Table 4: BP02 Critical Parameters*

---

#### BP03: Quality Control with MSB/SCT

**Workflow Sequence:**

1. **Production Completion Notification**
   - Provider marks production complete in system
   - SCT verifies all milestones completed
   - Contract state updated to "AwaitingDelivery"

2. **Shipment and Transit Tracking**
   - Shipment details logged via Data Integrator
   - Tracking information stored in MSB
   - Factor receives automated shipment notification

3. **Quality Inspection at Factor**
   - Parts received at Factor facility
   - Quality team accesses inspection checklist from Control Panels
   - Inspection results entered into Data Analytics system
   - Results transmitted to SCT via Data Integrator

4. **Acceptance or Rejection Decision**
   - If quality passed:
     - Factor approves acceptance via digital signature
     - SCT updates contract state to "Completed"
     - MSB logs final acceptance event
     - Final payment milestone triggered
   - If quality issues detected:
     - Factor logs non-conformance in SCT
     - SCT triggers dispute resolution workflow
     - Issue details stored immutably on MSB
     - Escalation process initiated per contract terms

5. **Contract Closure**
   - All milestones verified as complete
   - Final payment confirmed
   - SCT marks contract as "Closed"
   - MSB permanently archives complete contract history
   - Performance data feeds back to provider reputation score

**MSB/SCT Data Parameters Required:**

| Parameter Category | Priority | Key Fields |
|---|---|---|
| Quality Requirements | High | Inspection plan, acceptance criteria, sampling methodology |
| Delivery Logistics | Medium | Shipping method, tracking, packaging requirements |
| Acceptance Workflow | High | Digital signature, approval authority, acceptance conditions |
| Non-Conformance Handling | High | Reporting process, resolution options, cost responsibility |
| Dispute Resolution | Medium | Escalation steps, mediation terms, arbitration clause |
| Contract Closure | Medium | Final payment trigger, performance rating, archival |

*Table 5: BP03 Critical Parameters*

---

### Pilot 2 Workflows: Tasowheel Gears Manufacturing

#### BP01: Automated Quotation Process with MSB/SCT

**Complete Workflow from Customer Request to Order Acceptance:**

1. **Customer Quote Request**
   - Customer enters quote request in Cloud MaaS Marketplace
   - Required information:
     - Technical drawings (2D PDF or 3D CAD model - STEP, IGES)
     - Number of pieces
     - Target delivery time
     - Material preferences (if any)
   - MaaS Consumer Agent submits request

2. **Provider Selection by Marketplace**
   - Cloud MaaS Marketplace evaluates request
   - Matches requirements to Tasowheel capabilities via MaaS Dynamic Catalogue
   - Checks Tasowheel availability and capacity
   - Routes request to Tasowheel via MaaS Provider Agent

3. **Automated Manufacturing Process Definition**
   - MaaS Tool (AI-Assisted): Analyzes 3D model or drawing
   - Defines manufacturing routing steps:
     - Step 1: Turning operations
     - Step 2: Heat treatment (if required)
     - Step 3: Grinding and finishing
     - Step 4: Quality inspection
   - Digital Twin Designer creates process simulation
   - Defines machine assignments per step

4. **Resource Availability Verification (Tasowheel Responsibility)**
   - Raw Material Check:
     - Tasowheel staff verifies material availability via ERP
     - If not in stock: checks lead time from suppliers
     - Subcontracting need assessment (e.g., heat treatment)
   - Tooling and Fixtures Check:
     - Tasowheel verifies tooling availability
     - Identifies if new fixtures needed
     - If tooling required: generates separate tooling quotation

5. **Capacity Planning**
   - MaaS Supply Chain Simulator checks production capacity
   - MaaS Provider Planner integrates with Scheduling (APS) system
   - Calculates:
     - Setup time per operation
     - Cycle time per piece
     - Total production time
     - Quality control time
   - Data Analytics provides historical performance data for estimates

6. **Delivery Time Estimation**
   - MaaS Provider Planner calculates delivery timeline
   - Factors considered:
     - Material procurement lead time
     - Production schedule and capacity
     - Subcontracting lead times
     - Quality inspection duration
     - Packaging and logistics time
   - Estimated delivery date calculated

7. **Pricing and Margin Definition**
   - Automated cost calculation:
     - Material costs (from ERP)
     - Machine hour rates × estimated time
     - Subcontracting costs
     - Quality control costs
     - Tooling amortization (if applicable)
   - Tasowheel Sales defines profit margin (manual step)
   - Final quotation price generated

8. **Quote Transmission to Customer**
   - MaaS Tool compiles complete quotation:
     - Unit price and total price
     - Delivery date
     - Payment terms
     - Quality certifications included
     - Validity period of quote
   - Quote transmitted via Cloud MaaS Marketplace
   - Customer receives quote in MaaS Consumer interface

9. **Customer Acceptance and Smart Contract Creation**
   - Customer reviews quote and accepts offer
   - Acceptance triggers SCT smart contract creation workflow
   - Agreement JSON compiled with all parameters:
     - Agreement metadata
     - Parties information (Tasowheel + Customer)
     - Product specification from drawings
     - Commercial terms from quotation
     - Schedule with delivery date
     - Quality requirements
     - Production monitoring parameters
   - JSON transmitted to SCT via HTTP endpoint
   - SCT creates smart contract on MSB
   - MaaS Blockchain stores agreement immutably

10. **Order Processing Begins**
    - Contract status: "Active" on MSB
    - Data Integrator syncs order to Tasowheel ERP
    - Production planning initiated
    - Material procurement triggered
    - Production milestones defined in SCT
    - Monitoring phase begins

**Key Integration Points:**

| Process Step | MaaSAI Tool | MSB/SCT Role |
|---|---|---|
| Quote request | Cloud MaaS Marketplace | Store request parameters |
| Routing definition | Digital Twin Designer, AI analysis | N/A |
| Capacity check | MaaS Supply Chain Simulator | Query historical data from MSB |
| Delivery estimation | MaaS Provider Planner | N/A |
| Quote generation | Data Integrator | N/A |
| Quote transmission | Cloud MaaS Marketplace | Log quote event on MSB |
| Customer acceptance | MaaS Collaboration Hub | Trigger SCT contract creation |
| Contract storage | N/A | MSB immutable storage |
| Order processing | Data Integrator | SCT milestone tracking begins |

*Table 6: Tasowheel BP01 Tool Integration Matrix*

**MSB/SCT Data Parameters Required (Tasowheel-Specific):**

| Parameter Category | Priority | Key Fields |
|---|---|---|
| 3D Model Handling | High | Drawing format (STEP, IGES), revision, file URL |
| Routing Definition | High | Manufacturing steps, machine assignments, sequence |
| Capacity Data | High | Setup time, cycle time, quality control time estimates |
| Cost Breakdown | High | Material, labor, subcontracting, tooling, margin |
| Tooling Requirements | Medium | Tooling needed, separate quotation, ownership |
| Delivery Calculation | High | Lead time components, buffer time, commitment level |
| Quote Validity | Medium | Quote expiration date, price validity period |
| Acceptance Trigger | High | Customer digital signature, contract activation logic |

*Table 7: Tasowheel BP01 Critical Parameters*

> **Open Questions for Tasowheel:** Which MaaSAI tool can read 3D drawings or 3D models? (Or even 2D drawings?)
> - Implication for MSB/SCT: Agreement must store reference to drawing files with format metadata
> - Parameter needed: `technicalDrawings` array with format specification and AI parsing capability flag

---

### Pilot 5 Workflows: E4M Electronics Manufacturing

#### BP01: Customer Initial Interaction Commercial Exchange with MSB/SCT

**Workflow Sequence:**

1. **Initial Customer Contact**
   - Customer discovers E4M via Cloud MaaS Marketplace (enhanced visibility)
   - Anonymous initial browsing enabled (CMM capability)
   - Customer submits initial inquiry with project scope

2. **Requirement Gathering**
   - MaaS Collaboration Hub facilitates communication
   - Point-to-Point Secure Messaging for confidential discussions
   - E4M and customer exchange:
     - Project type (Design build vs manufacture only)
     - PCB specifications or mechatronics requirements
     - Quantity and delivery timeline
     - Special requirements (certifications, testing, etc.)
   - MaaS Consumer Agent and MaaS Provider Agent coordinate interaction

3. **Design Phase Communication (if Design Build project)**
   - Idealization and concept validation discussions via MCH
   - Design iterations shared through secure channels
   - Customer approval checkpoints defined
   - Design milestones established

4. **Agreement Finalization**
   - Complete project scope defined
   - Commercial terms negotiated (pricing, payment milestones)
   - Delivery schedule agreed
   - Quality standards and testing requirements confirmed
   - Lifetime support and maintenance terms discussed

5. **Smart Contract Creation via SCT**
   - Agreement compiled into JSON structure
   - For E4M projects, includes unique fields:
     - Project type (`DesignAndManufacture` or `ManufactureOnly`)
     - Development phases (if applicable)
     - PCB-specific specifications
     - Testing requirements (AOI, flying probe, functional test)
     - Lifetime support terms
     - End-of-life policy (R3T toolkit integration)
   - JSON transmitted to SCT HTTP endpoint
   - SCT deploys smart contract on MSB
   - Both parties digitally sign

6. **Contract Activation and Benefits**
   - Fast and reliable business agreements (KPI improvement target)
   - Secure contracts history registry on MSB blockchain
   - Immutable record of agreement terms
   - Transparent access for both parties
   - Reduced negotiation and contracting time

**MSB/SCT Data Parameters Required (E4M-Specific for BP01):**

| Parameter Category | Priority | Key Fields |
|---|---|---|
| Project Type | High | DesignAndManufacture, ManufactureOnly |
| Development Phases | High | Idealization, concept validation, engineering, manufacturing with durations |
| PCB Specifications | High | Layers, dimensions, component count, SMT/through-hole |
| Testing Requirements | High | AOI, flying probe, functional test, custom tests |
| Lifetime Support | Medium | Support duration, maintenance contract reference |
| Confidentiality | High | NDA terms, IP ownership, data protection |
| Communication Channels | Medium | Secure messaging, collaboration hub access |

*Table 8: E4M BP01 Critical Parameters*

---

#### BP02: Development Process Monitoring with MSB/SCT

**Workflow Sequence for Design-Build Projects:**

1. **Development Phase Tracking**
   - Smart contract includes development milestones:
     - M1: Idealization complete
     - M2: Concept validation approved
     - M3: Engineering design finalized
     - M4: Prototype manufactured
     - M5: Testing and validation complete
     - M6: Production batch manufactured
   - Each milestone has planned completion date

2. **Status Exchange via Control Panels**
   - E4M updates development status via Control Panels
   - Customer can view real-time progress
   - Status updates stored on MSB via SCT
   - Includes:
     - Current phase
     - Completion percentage
     - Design files (when ready)
     - Test results
     - Issue tracking

3. **Transparency and Data Analytics**
   - Data Analytics processes development data
   - Provides insights:
     - Design iteration efficiency
     - Testing outcomes
     - Bottleneck identification
     - Quality trend analysis
   - All analytics logged on MSB for transparency

4. **Customer Approval Gates**
   - Certain milestones require customer approval
   - Approval workflow via MaaS Collaboration Hub
   - Customer digital signature via SCT
   - MSB logs approval event with timestamp
   - Production cannot proceed without approval

5. **Automated Notifications**
   - SCT sends notifications when:
     - Milestone approaching due date
     - Milestone completed
     - Customer approval required
     - Issue detected requiring attention
   - Point-to-Point Secure Messaging delivers alerts

**MSB/SCT Data Parameters Required (E4M-Specific for BP02):**

| Parameter Category | Priority | Key Fields |
|---|---|---|
| Development Milestones | High | Phase name, planned date, deliverables, approval required |
| Design Deliverables | High | CAD files, PCB layout, BOM, test plans |
| Testing Results | High | Test type, pass/fail, measurements, certifications |
| Issue Tracking | Medium | Issue ID, description, severity, resolution status |
| Approval Workflow | High | Approver role, approval conditions, deadline |
| Iteration History | Medium | Design version, changes made, reason for iteration |

*Table 9: E4M BP02 Critical Parameters*

---

#### BP03: Maintenance Process Monitoring (Post-Delivery)

**Workflow for Deployed Products:**

1. **Maintenance Contract Link**
   - Original manufacturing contract on MSB references maintenance contract
   - Separate smart contract for ongoing maintenance
   - Links preserved on blockchain for traceability

2. **Deployed PCB Monitoring**
   - Edge MaaS Data Storage at customer site collects operational data
   - Data includes:
     - Operating hours
     - Performance metrics
     - Error logs
     - Environmental conditions
   - Data transmitted to E4M's Predictive Maintenance Toolkit (PMT)

3. **Predictive Maintenance Triggers**
   - Data Analytics analyzes operational data
   - Predicts potential failures
   - SCT monitors for maintenance trigger conditions
   - When threshold reached: automated maintenance alert

4. **Maintenance Event Logging on MSB**
   - All maintenance events logged:
     - Scheduled maintenance performed
     - Corrective maintenance (failures)
     - Parts replaced
     - Firmware updates
     - Performance improvements
   - Complete product lifecycle history on blockchain

---

#### BP04: End-of-Life Policy with R3T Integration

**Workflow for Circular Economy:**

1. **Product Lifecycle Tracking**
   - Digital Industrial Passport (DIP) stores product information
   - Complete history available from MSB:
     - Manufacturing date and batch
     - Materials used
     - Maintenance history
     - Operating hours
     - Current condition

2. **End-of-Life Assessment**
   - Repair-Reuse-Recycle Toolkit (R3T) evaluates options
   - LCC (Life Cycle Costing) analysis
   - Environmental impact assessment
   - Economic evaluation:
     - Repair cost vs replacement cost
     - Reuse value in other applications
     - Recycling value of materials

3. **Smart Contract End-of-Life Terms**
   - Original contract specifies:
     - Repair support duration (e.g., 5 years)
     - Component recovery policy
     - Recycling partner information
     - Responsibility for disposal costs
   - Terms enforced via SCT

4. **Circular Economy Documentation**
   - R3T decision logged on MSB:
     - Option chosen (repair/reuse/recycle)
     - Environmental impact avoided
     - Materials recovered
     - Compliance with WEEE Directive
   - Sustainability KPIs tracked on blockchain
   - Transparent reporting for circular economy initiatives

**MSB/SCT Data Parameters Required (E4M-Specific for BP03/BP04):**

| Parameter Category | Priority | Key Fields |
|---|---|---|
| Maintenance Contract | Medium | Reference to maintenance agreement, support duration |
| Operational Data Sources | Medium | Edge device endpoints, data collection frequency |
| Predictive Triggers | Medium | Failure prediction thresholds, alert conditions |
| Maintenance History | Medium | Event type, date, parts replaced, cost |
| End-of-Life Policy | High | Repair duration, reuse policy, recycling partner |
| R3T Assessment | High | Decision criteria, economic analysis, environmental impact |
| Circular Economy Metrics | Medium | Materials recovered, GHG savings, waste avoided |

*Table 10: E4M BP03/BP04 Critical Parameters*

---

## MSB and SCT Technical Implementation

### HTTP Endpoint Specification

**Endpoint Details:**

| Attribute | Value |
|---|---|
| URL | `https://api.maasai.eu/blockchain/sct/agreements/submit` |
| Method | POST |
| Content-Type | application/json |
| Authentication | OAuth 2.0 Bearer Token |
| Rate Limiting | 100 requests per minute per organization |
| Max Payload Size | 10 MB (for agreements with large drawing references) |
| Timeout | 30 seconds |

*Table 11: HTTP Endpoint Configuration*

**Request Structure:**

```http
POST /blockchain/sct/agreements/submit HTTP/1.1
Host: api.maasai.eu
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "agreementMetadata": { ... },
  "parties": { ... },
  "productSpecification": { ... },
  "commercialTerms": { ... },
  "scheduleAndDelivery": { ... },
  "qualityRequirements": { ... },
  "productionMonitoring": { ... },
  "complianceAndDocumentation": { ... },
  "disputeResolution": { ... },
  "smartContractParameters": { ... }
}
```

**Success Response (HTTP 201 Created):**

```json
{
  "status": "success",
  "message": "Smart contract created and deployed successfully",
  "agreementId": "550e8400-e29b-41d4-a716-446655440000",
  "contractAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "transactionHash": "0x8bae891d2e3f6a8c4c5b9e1234567890abcdef1234567890abcdef1234567890",
  "blockNumber": 15234567,
  "deploymentTimestamp": "2026-02-25T12:45:30Z",
  "contractStatus": "Active",
  "explorerUrl": "https://blockchainexplorer.maasai.eu/tx/0x8bae891d2e3f6a8c4c5b9e1234567890abcdef1234567890abcdef1234567890"
}
```

**Error Response (HTTP 400 Bad Request):**

```json
{
  "status": "error",
  "errorCode": "INVALID_AGREEMENT_SCHEMA",
  "message": "Agreement validation failed",
  "details": [
    {
      "field": "commercialTerms.totalPrice.amount",
      "error": "Required field missing"
    },
    {
      "field": "productSpecification.technicalDrawings",
      "error": "At least one technical drawing URL required"
    }
  ],
  "timestamp": "2026-02-25T12:45:30Z"
}
```

---

### SCT Processing Workflow

**Internal SCT Processing Steps:**

1. **Receive and Validate JSON**
   - Validate JSON schema
   - Check required fields present
   - Verify data types and formats
   - Validate references (party IDs, product IDs exist)

2. **Select Contract Template**
   - Based on `agreementType` and `pilotIdentifier`
   - Load appropriate smart contract template
   - Templates available:
     - `ManufacturingAgreement_Standard_v2.3`
     - `ManufacturingAgreement_DesignBuild_v2.3`
     - `MaintenanceContract_v1.5`
     - `FrameworkAgreement_v1.2`

3. **Parse Agreement Parameters**
   - Extract parameters from JSON
   - Convert to smart contract function parameters
   - Generate milestone tracking logic
   - Configure automated action triggers
   - Set up verification rules

4. **Deploy Smart Contract on MSB**
   - Compile smart contract code
   - Estimate gas fees
   - Submit deployment transaction to MSB
   - Wait for blockchain confirmation (3-6 blocks)
   - Retrieve contract address

5. **Initialize Contract State**
   - Set initial status: "PendingSignatures"
   - Store agreement hash on-chain
   - Store full JSON in off-chain storage (IPFS or secure database)
   - Link on-chain contract to off-chain data via content hash

6. **Notify Parties**
   - Send notification to provider and consumer
   - Include contract address and signing instructions
   - Provide link to contract viewer
   - Set signature deadline

7. **Await Digital Signatures**
   - Both parties must sign via their MaaS interface
   - Signatures stored as blockchain transactions
   - When both signatures received:
     - Contract status updated to "Active"
     - MSB logs activation event
     - Monitoring phase begins

---

### MSB Data Storage Architecture

**On-Chain vs Off-Chain Storage:**

| Data Type | On-Chain (MSB) | Off-Chain (Linked) |
|---|---|---|
| Agreement Hash | Full hash stored | N/A |
| Contract Address | Full address | N/A |
| Party Identifiers | IDs only (anonymized) | Full party details |
| Key Terms | Price, delivery date, milestones | Detailed specifications |
| Transaction Events | All events logged | N/A |
| Technical Drawings | Content hash only | Full files (IPFS or secure storage) |
| Production Data | Summary metrics | Detailed time-series data |
| Personal Data | Not stored (GDPR) | Encrypted, access-controlled |
| Signatures | Digital signatures | N/A |

*Table 12: MSB Data Storage Strategy*

**Data Privacy Considerations:**
- **GDPR Compliance:** Personal data (operator names, contact details) not stored on blockchain
- **Confidentiality:** Sensitive commercial terms encrypted off-chain
- **Transparency vs Privacy:** Public blockchain uses zero-knowledge proofs for verification without disclosure
- **Right to be Forgotten:** Personal data stored off-chain can be deleted; blockchain only contains anonymized hashes

---

## Critical Parameters Summary

### Minimum Viable Parameter Set

For MVP implementation, the following parameters are **MANDATORY**:

| Category | Essential Fields |
|---|---|
| Agreement Metadata | agreementId, version, timestamp, effectiveDate, type, pilotId |
| Parties | providerId, providerName, consumerId, consumerName, contacts |
| Product | productId, productName, quantity, technicalDrawings (ref) |
| Commercial | currency, totalPrice, paymentTerms |
| Schedule | deliveryDate, milestones (array with ID, name, plannedDate) |
| Quality | qualityStandards, acceptanceCriteria |
| Monitoring | monitoringEnabled, dataUpdateFrequency, alertConditions |
| Smart Contract | blockchainNetwork, contractType, automatedActions |

*Table 13: MVP Mandatory Parameters*

### Pilot-Specific Parameter Extensions

| Pilot | Unique Parameters |
|---|---|
| Factor (P1) | Provider capability matching, remote monitoring access, multi-tier supply chain support |
| Tasowheel (P2) | 3D model handling, routing steps, capacity check results, setup/cycle time, tooling costs |
| E4M (P5) | Project type, development phases, PCB specifications, testing requirements, lifetime support, R3T policy |

*Table 14: Pilot-Specific Parameter Extensions*

---

## UI Mockup Requirements

### Key UI Components Needed

1. **Agreement Creation Wizard**
   - Multi-step form matching JSON structure
   - Pilot-specific customization (shows relevant fields per pilot)
   - Template selection for common agreement types
   - File upload for technical drawings with format detection
   - Auto-calculation of delivery dates and pricing (integration with backend tools)
   - Real-time validation with helpful error messages

2. **Contract Signing Interface**
   - Clear display of agreement terms
   - Digital signature workflow (multi-factor authentication)
   - Cryptographic key management
   - Signature status tracking (who has signed, who pending)

3. **Production Monitoring Dashboard**
   - Timeline view of milestones with progress indicators
   - Real-time production metrics (quantity, quality, schedule adherence)
   - Alert center showing active alerts and history
   - Document access (drawings, inspection reports, certificates)
   - Data export functionality

4. **Blockchain Transaction Viewer**
   - Contract deployment status
   - Event log with timestamps
   - Milestone verification status
   - Transaction hashes with blockchain explorer links
   - Cryptographic proof display for auditors

5. **Amendment and Dispute Management**
   - Amendment proposal form
   - Change comparison view (old vs new terms)
   - Multi-party approval workflow
   - Dispute logging and escalation interface
   - Mediation/arbitration progress tracking

### UI Design Considerations for MSB/SCT

**Blockchain-Specific UX Challenges:**

- **Gas Fees:** Users must understand transaction costs
  - Display estimated gas fee before signing
  - Explain who pays (per gasPolicy in agreement)
  - Show real-time network congestion impact

- **Transaction Confirmation Time:** Blockchain transactions not instant
  - Show pending state during confirmation (3-6 blocks typical)
  - Display estimated confirmation time
  - Provide progress indicator
  - Send notification when confirmed

- **Immutability:** Users must understand they cannot "undo"
  - Warning before signing: "This action cannot be reversed"
  - Confirmation dialogs for critical actions
  - Clear explanation of amendment process for changes

- **Key Management:** Users responsible for private keys
  - Secure key generation and storage
  - Backup and recovery options
  - Multi-factor authentication
  - Option for organizational key custody

- **Transparency vs Complexity:** Balance visibility with usability
  - Basic view: Simple status and key info
  - Advanced view: Technical blockchain details
  - Expert mode: Raw transaction data and logs

---

## Pilot Feedback Questions

### Section 1: Workflow Accuracy
1. Do the documented workflows accurately reflect your current business processes?
2. Are there steps missing or incorrectly described?
3. Which workflow steps are most time-consuming in your current operation?
4. Which steps do you expect the most benefit from automation via MSB/SCT?

### Section 2: Parameter Completeness
1. Review the parameter tables for your pilot. Are all necessary fields included?
2. Which parameters can be automatically populated from your existing systems (ERP, MES, QMS)?
3. Which parameters require manual entry?
4. Are there pilot-specific parameters missing from the specification?
5. Which parameters are mandatory vs optional for your use case?

### Section 3: MSB/SCT Integration
1. What concerns do you have about blockchain integration?
2. How should gas fees be handled in your pilot (who pays, how much acceptable)?
3. What level of transparency is appropriate for production data (what should customers see)?
4. How should contract amendments be approved in your organization?
5. What automated actions would be most valuable for your operations?

### Section 4: Data Availability
1. Which production monitoring metrics can your systems provide in real-time?
2. What is the update frequency for production data (hourly, every 4 hours, daily)?
3. Do you have API endpoints available for data integration?
4. What authentication methods are supported by your systems?
5. Are there data privacy constraints we must consider (GDPR, confidentiality)?

### Section 5: UI/UX Preferences
1. Which parameters should be prominently displayed in the monitoring dashboard?
2. What visualizations would be most helpful (Gantt chart, progress bars, graphs)?
3. What reports do you need to generate from the agreement data?
4. How often do you expect to interact with the blockchain interface?
5. What mobile access requirements do you have?

### Section 6: Smart Contract Logic
1. Which alert conditions should trigger immediate notifications?
2. What thresholds should be used for alerts (e.g., delay > X days, quality reject rate > Y%)?
3. How should payment milestones be verified (automatic vs manual approval)?
4. What dispute escalation process should be encoded in the smart contract?
5. What happens if external data sources become unavailable?

---

## Next Steps and Implementation Roadmap

### Phase 1: Specification Validation (Current - Week 2)
- Distribute this document to pilot partners
- Conduct feedback sessions with each pilot
- Collect responses to feedback questionnaire
- Refine parameter definitions based on input
- Finalize JSON schema v1.0

### Phase 2: UI Mockup Design (Weeks 3-5)
- Create wireframes for key UI components
- Design high-fidelity mockups
- Conduct usability testing with pilot representatives
- Iterate designs based on feedback
- Finalize UI specifications

### Phase 3: HTTP Endpoint and SCT Development (Weeks 6-10)
- Implement HTTP endpoint for JSON agreement submission
- Develop smart contract templates for each agreement type
- Build SCT agreement parser and validator
- Integrate with MSB blockchain network (testnet first)
- Implement automated action logic
- Develop milestone verification engine

### Phase 4: Integration Testing (Weeks 11-13)
- Connect to pilot data sources (ERP, MES, QMS APIs)
- Test end-to-end workflow with sample agreements
- Validate data flow from negotiation to monitoring
- Performance testing and optimization
- Security audit of smart contracts

### Phase 5: Pilot Deployment (Weeks 14-16)
- Deploy to production blockchain network
- Onboard pilot users and provide training
- Conduct supervised pilot runs with real agreements
- Monitor for issues and provide support
- Collect user feedback and KPI measurements

### Phase 6: Evaluation and Iteration (Weeks 17-20)
- Analyze pilot results vs baseline KPIs
- Document lessons learned
- Identify improvement opportunities
- Plan feature enhancements for v2.0
- Prepare for wider rollout

---

## Conclusion

This document has provided a comprehensive specification for the MaaSAI blockchain dApp, with particular emphasis on the MSB (MaaS Blockchain) and SCT (Smart Contracts Toolkit) integration across three pilot use cases. The detailed workflows illustrate how manufacturing agreements will be stored, monitored, and executed using blockchain technology.

**Key Takeaways:**
- MSB provides the immutable, transparent infrastructure for agreement storage and transaction logging
- SCT enables manufacturing-specific smart contract functionality including milestone tracking, automated actions, and verification logic
- Each pilot has unique requirements that must be accommodated in the parameter schema
- The HTTP endpoint receives JSON agreements and triggers smart contract deployment
- Production monitoring data flows from edge systems through SCT to MSB
- UI mockups must balance blockchain transparency with usability

**Critical Success Factors:**
1. **Parameter Completeness:** All necessary agreement terms must be captured in JSON schema
2. **Data Integration:** Reliable connections to pilot ERP/MES/QMS systems essential
3. **User Experience:** Blockchain complexity must be hidden behind intuitive interfaces
4. **Performance:** Smart contract execution and monitoring must meet real-time requirements
5. **Security:** Cryptographic integrity and access control must be robust
6. **Pilot Feedback:** Active collaboration with pilots to refine workflows and parameters

The next phase depends on timely pilot feedback to validate and refine this specification. With pilot input, we can proceed to UI mockup design and technical implementation with confidence that the system will meet real manufacturing needs.

---

## Appendices

### Appendix A: Tool Acronym Reference

| Acronym | Full Name |
|---|---|
| MSB | MaaS Blockchain |
| SCT | Smart Contracts Toolkit |
| CMM | Cloud MaaS Marketplace |
| MCH | MaaS Collaboration Hub |
| MCA | MaaS Consumer Agent |
| MPA | MaaS Provider Agent |
| CP | Control Panels |
| DA | Data Analytics |
| DI | Data Integrator |
| DS | Data Storage (Edge MaaS) |
| DIP | Digital Industrial Passport Designer |
| DTD | Digital Twins Designer |
| PMT | Predictive Maintenance Toolkit |
| R3T | Repair-Reuse-Recycle Toolkit |
| PSM | Point-to-Point Secure Messaging |
| LCC | Life Cycle Costing |

*Table 15: MaaSAI Tool Acronyms*

---

### Appendix B: Complete Workflow Diagrams

**Pilot 1 - Factor BP01: Provider Search**

```
Customer Need → CMM → Dynamic Catalogue → Provider Matching
                                ↓
                    Provider Options Presented
                                ↓
            Quotation Exchange (via MCH) → Selection
                                ↓
                Agreement JSON → SCT HTTP Endpoint
                                ↓
                Smart Contract Deployed on MSB
                                ↓
                Both Parties Sign → Contract Active
```

**Pilot 2 - Tasowheel BP01: Quotation Process**

```
Customer Request (CMM) → MCA → Marketplace Routing → MPA
                                        ↓
                AI Tool: Analyze 3D Model → Define Routing
                                        ↓
                TSW: Check Materials/Tooling (Manual Gate)
                                        ↓
            Supply Chain Simulator: Check Capacity → Calculate Time
                                        ↓
                    TSW Sales: Define Margin (Manual Gate)
                                        ↓
                    Generate Quote → CMM → Send to Customer
                                        ↓
                        Customer Accepts → SCT Creates Contract
                                        ↓
                MSB Stores Agreement → Order Processing Begins
```

**Pilot 5 - E4M BP01-BP04: Full Lifecycle**

```
BP01: Customer Inquiry (CMM) → MCH Negotiation → Agreement
                                        ↓
                SCT Deploys Contract on MSB → Signed
                                        ↓
BP02: Development Phases → CP Status Updates → Customer Approvals
                                        ↓
                            Production Complete
                                        ↓
BP03: Deployment → Edge DS Monitoring → PMT Analysis → Maintenance Alerts
                                        ↓
                BP04: End-of-Life → R3T Assessment → Decision Logged on MSB
```

---

### Appendix C: Sample JSON Agreement (Minimal)

Minimal viable agreement for Pilot 2 (Tasowheel):

```json
{
  "agreementMetadata": {
    "agreementId": "550e8400-e29b-41d4-a716-446655440000",
    "agreementVersion": "1.0",
    "creationTimestamp": "2026-02-25T10:30:00Z",
    "effectiveDate": "2026-03-01",
    "agreementType": "QuotationAcceptance",
    "pilotIdentifier": "P2-TASOWHEEL",
    "businessProcess": "BP01"
  },
  "parties": {
    "provider": {
      "providerId": "PROV-TSW-001",
      "providerName": "Tasowheel Oy",
      "providerContact": {
        "email": "contact@tasowheel.fi",
        "phone": "+358-40-1234567"
      }
    },
    "consumer": {
      "consumerId": "CONS-ABC-789",
      "consumerName": "ABC Manufacturing GmbH",
      "consumerContact": {
        "email": "orders@abc-mfg.de",
        "phone": "+49-89-9876543"
      }
    }
  },
  "productSpecification": {
    "productId": "GEAR-TSW-5678",
    "productName": "Helical Gear - Type HG250",
    "quantity": { "value": 500, "unit": "pieces" },
    "technicalDrawings": [
      "https://storage.maasai.eu/drawings/GEAR-TSW-5678-v3.2.stp"
    ],
    "drawingFormat": "3D_STEP"
  },
  "commercialTerms": {
    "currency": "EUR",
    "totalPrice": { "amount": 87500.00 },
    "paymentTerms": { "standardTerms": "Net 30 days" }
  },
  "scheduleAndDelivery": {
    "deliveryDate": "2026-05-10",
    "milestones": [
      { "milestoneId": "M1", "name": "Turning complete", "plannedDate": "2026-04-05" },
      { "milestoneId": "M2", "name": "Heat treatment complete", "plannedDate": "2026-04-15" },
      { "milestoneId": "M3", "name": "Grinding complete", "plannedDate": "2026-04-26" }
    ]
  },
  "qualityRequirements": {
    "qualityStandards": ["ISO 9001:2015", "DIN 3962"],
    "acceptanceCriteria": [
      {
        "criterion": "Dimensional conformance",
        "requirement": "All dimensions within tolerance"
      }
    ]
  },
  "productionMonitoring": {
    "monitoringEnabled": true,
    "dataUpdateFrequency": { "scheduledInterval": "4 hours" },
    "alertConditions": [
      {
        "conditionId": "ALERT-001",
        "condition": "Production delay > 2 days",
        "severity": "Medium"
      }
    ]
  },
  "smartContractParameters": {
    "blockchainNetwork": "Ethereum_Sepolia_Testnet",
    "contractType": "ManufacturingAgreement_v2.3",
    "automatedActions": [
      {
        "actionId": "AUTO-001",
        "trigger": "Milestone M1 completion verified",
        "action": "Notify both parties"
      }
    ]
  }
}
```

---

## References

1. MaaSAI Project. (2026). *Pilot 1 FACTOR - Metal Parts Manufacturing as a Service*. 3rd Plenary Meeting Presentation. Tampere, Finland.
2. MaaSAI Project. (2026). *Pilot 2 TASOWHEEL - Optimising a Gears Manufacturing as a Service Production*. 3rd Plenary Meeting Presentation. Tampere, Finland.
3. MaaSAI Project. (2026). *Pilot 5 E4M - Smart Electronics Manufacturing as a Service*. 3rd Plenary Meeting Presentation. Tampere, Finland.
4. Previous document: *Smart Contract Agreement Parameters Definition* (Version 1.0, February 25, 2026).
5. Fraunhofer IUK. (2023). *Blockchain and Smart Contracts: Technologies, Research Issues and Applications*.
6. Kiara Industries. (2025). *Smart Contracts and Blockchain: How They Transform the Manufacturing Industry*.
