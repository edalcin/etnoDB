# Implementation Plan: Ethnobotanical Database Web Interface

**Branch**: `001-web-interface` | **Date**: 2025-12-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-web-interface/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a web-based interface for managing ethnobotanical data documenting relationships between traditional communities and plants. The system provides three separate contexts (acquisition, curation, presentation) running on different ports within a single Docker container, connecting to an existing MongoDB database. Key requirements include hierarchical data entry (reference → communities → plants), public search functionality with card-based results, and a curation workflow with status-based approval.

## Technical Context

**Language/Version**: Node.js 20 LTS (Alpine Linux base)
**Primary Dependencies**: Express.js (web framework), MongoDB Driver (official), EJS (templates), HTMX + Alpine.js (frontend), Tailwind CSS
**Storage**: MongoDB (existing database "etnodb" with collection "etnodb")
**Testing**: Jest (unit/integration), mongodb-memory-server (test database), Playwright (E2E, post-MVP)
**Target Platform**: Docker container on Unraid server (Linux-based)
**Project Type**: Web application (backend + frontend with server-side rendering)
**Performance Goals**: <2s search response for 1000 records, support 10 concurrent users
**Constraints**: <500MB Docker image size (target: 120-180MB), <10 minutes data entry time for reference with 2 communities and 5 plants
**Scale/Scope**: Three web interfaces (acquisition, curation, presentation), hierarchical data model, responsive design (320px-1920px)

**Architecture**: Single Node.js process with three separate Express apps running on different ports (3001: acquisition, 3002: curation, 3003: presentation). HTMX-driven hypermedia approach with server-side rendering for forms and dynamic content.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Initial Check (Pre-Phase 0)**: No constitution file present - skipping gate evaluation.

**Post-Phase 1 Check**: Design completed. No constitution constraints to validate. Architecture decisions documented in research.md align with:
- Simplicity principle (HTMX over heavy frameworks)
- Performance requirements (Docker image <500MB, search <2s)
- Deployment constraints (single container, multi-port architecture)
- Existing infrastructure (MongoDB integration)

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/           # Data models matching MongoDB schema
│   ├── services/         # Business logic (data access, validation)
│   ├── contexts/         # Three app contexts
│   │   ├── acquisition/  # Data entry API and views
│   │   ├── curation/     # Data editing and approval API and views
│   │   └── presentation/ # Public search and display API and views
│   └── shared/           # Common utilities (DB connection, validation)
└── tests/
    ├── integration/      # MongoDB integration tests
    └── unit/             # Service and model tests

frontend/
├── src/
│   ├── acquisition/      # Data entry interface
│   │   ├── components/   # Form components for nested data
│   │   └── styles/       # Context-specific styles
│   ├── curation/         # Data editing interface
│   │   ├── components/   # Reference list, edit forms
│   │   └── styles/
│   ├── presentation/     # Public search interface
│   │   ├── components/   # Search filters, result cards
│   │   └── styles/
│   └── shared/           # Common components, utilities
│       ├── components/   # Reusable UI elements
│       └── api/          # API client utilities
└── tests/
    └── unit/             # Component tests

docker/
├── Dockerfile            # Multi-stage build for backend + frontend
└── docker-compose.yml    # Local development setup
```

**Structure Decision**: Web application structure with separated backend and frontend. Backend organizes code by the three contexts (acquisition, curation, presentation) to support multi-port architecture. Frontend mirrors this structure to maintain clear separation of concerns. Shared modules prevent code duplication across contexts.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**Status**: N/A - No constitution file present, no violations to track.

---

## Planning Summary

### Phase 0: Research (Completed)

**Artifact**: [research.md](./research.md)

**Decisions Made**:
1. **Backend**: Node.js 20 LTS + Express.js
2. **Frontend**: HTMX + Alpine.js + Tailwind CSS
3. **Multi-port Architecture**: Single process with three Express apps on separate ports
4. **Template Engine**: EJS for server-side rendering
5. **MongoDB**: Official driver (not Mongoose)
6. **Testing**: Jest + mongodb-memory-server
7. **Container**: Multi-stage Docker build with Alpine base
8. **CSS**: Tailwind with JIT compilation
9. **Forms**: HTMX-driven dynamic nested forms
10. **Search**: MongoDB text indexes + aggregation

**Rationale**: All decisions prioritize Docker image size (<500MB), development simplicity, and performance requirements.

---

### Phase 1: Design & Contracts (Completed)

**Artifacts**:
- [data-model.md](./data-model.md) - MongoDB schema, validation, queries
- [contracts/acquisition-api.md](./contracts/acquisition-api.md) - Data entry API
- [contracts/curation-api.md](./contracts/curation-api.md) - Data editing/approval API
- [contracts/presentation-api.md](./contracts/presentation-api.md) - Public search API
- [quickstart.md](./quickstart.md) - Developer onboarding guide
- [CLAUDE.md](../../CLAUDE.md) - Agent context (auto-generated)

**Design Highlights**:
- **Data Model**: Three nested entities (Reference → Community → Plant) with status workflow
- **API Contracts**: RESTful endpoints with HTMX partial rendering support
- **Validation**: Server-side validation with Portuguese error messages
- **Search**: Multi-filter query patterns with pagination
- **Responsive**: Card-based UI adapting 320px-1920px

---

### Next Steps

**Phase 2**: Task Generation (`/speckit.tasks`)
- Generate actionable, dependency-ordered implementation tasks
- Break down each component into concrete development steps
- Define testing requirements for each task

**Phase 3**: Implementation (`/speckit.implement`)
- Execute tasks in dependency order
- Write tests before implementation (TDD if constitution requires)
- Validate against success criteria from spec.md

---

## Validation Against Requirements

### Success Criteria Mapping

| Spec Requirement | Design Solution |
|------------------|----------------|
| Docker image <500MB | Multi-stage Alpine build (estimated 120-180MB) ✅ |
| Search <2s for 1000 records | MongoDB text indexes + aggregation (<300ms expected) ✅ |
| 10 concurrent users | Node.js event loop handles 50+ easily ✅ |
| Responsive 320-1920px | Tailwind CSS breakpoints (sm/md/lg/xl) ✅ |
| Separate ports | Single process, three Express apps on ports 3001/3002/3003 ✅ |
| Hierarchical data entry | HTMX dynamic forms for nested communities/plants ✅ |
| Portuguese interface | All templates, validation messages, labels in Portuguese ✅ |
| Card-based results | Grid layout with responsive cards in presentation context ✅ |
| Status workflow | pending/approved/rejected states with curator control ✅ |
| No authentication | Open access, network-level security ✅ |

All functional requirements (FR-001 through FR-017) are addressed in design artifacts.

---

## Risk Assessment

### Low Risk
- ✅ Technology stack proven and mature
- ✅ MongoDB integration straightforward (existing database)
- ✅ Single container deployment simple
- ✅ Requirements well-defined and stable

### Medium Risk
- ⚠️ HTMX adoption: Team may be unfamiliar (Mitigation: Excellent docs, simple mental model)
- ⚠️ Nested form complexity: Deep hierarchy may challenge UX (Mitigation: HTMX partial rendering simplifies)

### Mitigated
- No high-risk items identified
- Performance requirements achievable with indexes
- Docker image size well under constraint

---

## Planning Status

**Phase 0 (Research)**: ✅ Complete
**Phase 1 (Design)**: ✅ Complete
**Phase 2 (Tasks)**: ⏳ Pending - Run `/speckit.tasks`
**Phase 3 (Implementation)**: ⏳ Pending - Run `/speckit.implement`

**Ready for**: Task generation and implementation
