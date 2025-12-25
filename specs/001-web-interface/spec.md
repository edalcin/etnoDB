# Feature Specification: Ethnobotanical Database Web Interface

**Feature Branch**: `001-web-interface`
**Created**: 2025-12-25
**Status**: Draft
**Input**: User description: "Este projeto irá criar uma interface baseada na web para um banco de dados no MongoDB que contém dados sobre a relação de comunidades tradicionais com as plantas. Estes dados são extraídos de artigos científicos, que são as evidências desta relação entre comunidades tradicionais e as plantas. O banco de dados 'etnodb' possui a coleção 'etnodb' já foi criado, e os dados possuirão a estrutura em /docs/dataStructure.json. Preciso de uma interface amigável e simples que permita entrar dados das referencias e, dentro de cada referência, uma ou mais comunidades e, dentro de cada comunidade, uma ou mais plantas, conforme a estrutura em /docs/dataStructure.json. Este projeto deve rodar em um docker que será instalado no Unraid. O docker será gerado automáticamente a cada modificação do código, e ficará disponível em ghcr.io/edalcin/ Este projeto irá commit sempre para o main branch e nunca irá criar qualquer outro branch. Esta aplicação irá rodar no mesmo servidor que o MongoDB, apenas em um outro docker. A interface será dividida nos contextos de 'aquisição' (entrada de dados), 'curadoria' (edição dos dados) e 'apresentação' (busca e apresentação dos dados, em forma de cards), conforme a arquitetura definida em https://github.com/edalcin/etnoArquitetura. A interface de apresentação terá uma busca por comunidade, planta, estado e municipío, retornando os resultados sob a forma de cards. A interface de curadoria terá uma lista das referência que poderão ser editadas no seu conteúdo. A interface de aquisição terá um formulário de entrada de referência -> comunidades -> plantas conforme a estrutura em /docs/dataStructure.json Escolha a melhor plataforma considerando desenpenho, interface limpa, moderna e responsiva e tamanho do docker gerado."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Data Entry for Scientific References (Priority: P1)

Researchers need to enter ethnobotanical data extracted from scientific articles into the database. Each reference contains bibliographic information, one or more traditional communities studied, and the plants used by those communities with their vernacular names and use types.

**Why this priority**: This is the core data entry mechanism that populates the database. Without this capability, no data can be entered into the system, making it foundational for all other features.

**Independent Test**: Can be fully tested by accessing the data acquisition interface, completing the nested reference → community → plant form, submitting it, and verifying the record appears in the database with "pending" status.

**Acceptance Scenarios**:

1. **Given** the researcher accesses the acquisition interface, **When** they fill in reference details (title, authors, year, abstract, DOI), **Then** the system accepts and stores the bibliographic data
2. **Given** a reference is being created, **When** the researcher adds one or more communities with location details (name, municipality, state, local, economic activities, observations), **Then** each community is associated with the reference
3. **Given** a community is being added to a reference, **When** the researcher enters one or more plants with scientific names, vernacular names, and use types, **Then** each plant is properly nested within that community
4. **Given** all nested data is complete, **When** the researcher submits the form, **Then** the complete hierarchical record is saved to the database with status "pending"
5. **Given** the researcher is entering plant data, **When** they add multiple scientific or vernacular names for the same plant, **Then** the system accepts arrays of names as per the data structure

---

### User Story 2 - Search and Browse Ethnobotanical Data (Priority: P2)

Public users and researchers need to search for ethnobotanical records by filtering on community name, plant name (scientific or vernacular), state, or municipality. Results should be displayed as cards showing key information from each reference.

**Why this priority**: This provides public access to the curated data, fulfilling the primary value proposition of making ethnobotanical knowledge discoverable. It depends on data being entered and curated first.

**Independent Test**: Can be fully tested by accessing the presentation interface, entering search terms in the community/plant/state/municipality filters, and verifying that matching records are returned as visually organized cards.

**Acceptance Scenarios**:

1. **Given** the user accesses the presentation interface, **When** they enter a community name in the search field, **Then** all references containing that community are displayed as cards
2. **Given** the user accesses the presentation interface, **When** they enter a plant scientific or vernacular name, **Then** all references containing that plant are displayed as cards
3. **Given** the user accesses the presentation interface, **When** they filter by state name, **Then** all references with communities in that state are displayed
4. **Given** the user accesses the presentation interface, **When** they filter by municipality name, **Then** all references with communities in that municipality are displayed
5. **Given** search results are displayed, **When** the user views a result card, **Then** it shows reference title, authors, year, community name, and associated plants
6. **Given** multiple filters are applied, **When** the user searches, **Then** results match all applied filter criteria (logical AND)

---

### User Story 3 - Curate and Validate Submitted References (Priority: P3)

Curators need to review, edit, and approve references submitted through the acquisition interface. They should see a list of pending references, be able to edit their content (including nested communities and plants), and change their status to approved or rejected.

**Why this priority**: Quality control ensures data accuracy before publication, implementing the C.A.R.E. principles (Collective Benefit, Authority to Control, Responsibility, Ethics). This depends on data entry (P1) but is independent of public search (P2).

**Independent Test**: Can be fully tested by accessing the curation interface (on its dedicated port), viewing the list of pending references, editing a reference's content, and approving it to change its status and make it visible in the presentation interface.

**Acceptance Scenarios**:

1. **Given** a curator accesses the curation interface, **When** they view the reference list, **Then** all references with their current status (pending/approved/rejected) are displayed
2. **Given** a curator selects a pending reference, **When** they open it for editing, **Then** all fields (reference metadata, communities, plants) are editable
3. **Given** a curator is editing a reference, **When** they modify community or plant data, **Then** changes are saved to the nested structure
4. **Given** a curator has reviewed a reference, **When** they mark it as "approved", **Then** the reference status changes and becomes visible in the presentation interface
5. **Given** a curator has reviewed a reference, **When** they mark it as "rejected", **Then** the reference status changes and it remains hidden from public view

---

### Edge Cases

- What happens when a reference has no DOI (many older publications lack DOIs)?
- How does the system handle duplicate plant entries within the same community (e.g., same scientific name entered twice)?
- What happens when a user searches with no filters applied (return all records or prompt for criteria)?
- How does the system handle very long arrays of vernacular names or use types?
- What happens when a curator tries to approve an incomplete reference (missing required fields)?
- How does the system handle special characters in plant names (e.g., botanical author abbreviations like "L." or parenthetical authorities)?
- What happens when state or municipality names are misspelled or inconsistent across records?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a web-based interface accessible via standard browsers
- **FR-002**: System MUST connect to the existing MongoDB database "etnodb" with collection "etnodb"
- **FR-003**: System MUST implement three distinct interface contexts running on separate ports: acquisition (data entry), curation (data editing and approval), and presentation (public search and display)
- **FR-004**: System MUST enforce the hierarchical data structure: reference → communities → plants as defined in /docs/dataStructure.json
- **FR-005**: System MUST accept and store reference metadata including title, authors (array), year, abstract, and DOI
- **FR-006**: System MUST accept and store community data including name, municipality, state, location description, economic activities (array), and observations
- **FR-007**: System MUST accept and store plant data including scientific names (array), vernacular names (array), and use types (array)
- **FR-008**: System MUST assign status "pending" to newly submitted references
- **FR-009**: System MUST allow searching/filtering by community name, plant name (scientific or vernacular), state, and municipality in the presentation interface
- **FR-010**: System MUST display search results as visual cards showing reference and plant information
- **FR-011**: System MUST provide curators with a list view of all references showing their status
- **FR-012**: System MUST allow curators to edit all fields of a reference including nested communities and plants
- **FR-013**: System MUST allow curators to change reference status to approved or rejected
- **FR-014**: System MUST only display approved references in the public presentation interface
- **FR-015**: System MUST run in a containerized environment deployable to Unraid
- **FR-016**: System MUST be responsive and function properly on desktop, tablet, and mobile devices
- **FR-017**: System MUST perform basic field validation at data entry (required fields, data types) without taxonomic validation

### Key Entities

- **Reference**: Represents a scientific publication documenting ethnobotanical knowledge. Contains bibliographic metadata (title, authors, year, abstract, DOI) and has a status (pending/approved/rejected). Parent entity that contains one or more communities.

- **Community**: Represents a traditional community studied in a reference. Contains identification (name), geographic location (municipality, state, local description), socioeconomic context (economic activities), and additional notes (observations). Nested within a reference and contains one or more plants.

- **Plant**: Represents a plant species used by a community. Contains botanical identification (scientific names array), local knowledge (vernacular names array), and ethnobotanical use (use types array). Nested within a community.

- **Curator**: A user who accesses the curation interface to edit references and approve/reject submissions. Responsible for maintaining data quality and implementing C.A.R.E. principles.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Researchers can complete entry of a reference with 2 communities and 5 plants in under 10 minutes
- **SC-002**: Public users can locate relevant ethnobotanical records within 30 seconds using the search filters
- **SC-003**: Curators can review and approve/reject a reference in under 5 minutes
- **SC-004**: The interface renders properly and remains usable on screen sizes from 320px (mobile) to 1920px+ (desktop)
- **SC-005**: The system supports concurrent data entry by at least 10 researchers without performance degradation
- **SC-006**: Search results return within 2 seconds for queries matching up to 1000 records
- **SC-007**: 90% of users successfully complete their primary task (data entry, search, or curation) on first attempt without assistance
- **SC-008**: The containerized application runs stably on Unraid for 30+ days without manual intervention
- **SC-009**: The Docker image size remains under 500MB to minimize deployment overhead

## Assumptions

- The MongoDB database "etnodb" with collection "etnodb" is already operational and accessible from the application container
- MongoDB connection credentials and host information will be provided via environment variables or configuration
- The data structure in /docs/dataStructure.json represents the canonical schema and will not change during initial development
- The application will run on the same server as MongoDB, enabling low-latency local network connections
- Continuous deployment to ghcr.io/edalcin/ will be configured via GitHub Actions or similar CI/CD pipeline
- All commits will be made directly to the main branch as specified (no feature branches for code changes)
- Initial deployment will support Portuguese language interface (based on field names and example data)
- The three contexts (acquisition, curation, presentation) will run on separate ports within the same Docker container
- No authentication is required for any context (acquisition, curation, or presentation) - all interfaces are openly accessible
- Access control is managed at the network/infrastructure level (port exposure, firewall rules, etc.)
- No audit trail is needed for curator edits at this stage
- Taxonomic validation will be deferred to future curation context enhancements

## Dependencies

- Existing MongoDB instance with "etnodb" database and collection
- Container runtime environment on Unraid server
- GitHub Container Registry (ghcr.io) access for image hosting
- Network connectivity between application container and MongoDB container
- Data structure specification in /docs/dataStructure.json

## Out of Scope

- Migration or transformation of existing data in the MongoDB collection
- User authentication and access control (handled at network/infrastructure level)
- Audit trail and change history tracking
- Taxonomic validation at acquisition stage (deferred to future curation enhancements)
- Multi-language interface (initial version Portuguese only)
- Data export functionality (download search results as CSV/JSON)
- API endpoints for external system integration
- Real-time collaboration features (multiple curators editing same reference simultaneously)
- Automated extraction of data from PDF scientific articles
- Integration with scientific journal APIs for monitoring new publications
- Community data sovereignty controls beyond curator approval workflow
