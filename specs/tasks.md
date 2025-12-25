# Tasks: Ethnobotanical Database Web Interface

**Input**: Design documents from `/specs/001-web-interface/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in specification - test tasks omitted from this plan

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Per plan.md, this project uses web application structure:
- **Backend**: `backend/src/`
- **Frontend**: `frontend/src/`
- **Tests**: `backend/tests/`
- **Docker**: `docker/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create project directory structure per plan.md (backend/, frontend/, docker/, specs/)
- [X] T002 Initialize Node.js project with package.json in repository root
- [X] T003 [P] Install backend dependencies (express, mongodb, ejs) in package.json
- [X] T004 [P] Install frontend build tools (tailwindcss, postcss, autoprefixer) in package.json
- [X] T005 [P] Install development dependencies (nodemon, eslint, jest) in package.json
- [X] T006 [P] Create .gitignore file with node_modules, dist/, .env, coverage/
- [X] T007 [P] Create .env.example file with MONGO_URI, PORT_ACQUISITION, PORT_CURATION, PORT_PRESENTATION, NODE_ENV
- [X] T008 [P] Create ESLint configuration in .eslintrc.json with Node.js/ES6 rules
- [X] T009 [P] Configure Tailwind CSS in tailwind.config.js with content paths for EJS templates
- [X] T010 [P] Create PostCSS configuration in postcss.config.js for Tailwind processing
- [X] T011 [P] Create Jest configuration in jest.config.js for unit and integration tests
- [X] T012 [P] Create npm scripts in package.json (dev, build, test, lint)

**Checkpoint**: Basic project structure ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T013 Create MongoDB connection module in backend/src/shared/database.js
- [X] T014 [P] Create configuration loader in backend/src/shared/config.js (loads from .env)
- [X] T015 [P] Create logger utility in backend/src/shared/logger.js using debug package
- [X] T016 Create Reference data model in backend/src/models/Reference.js (schema definition, no ORM)
- [X] T017 Create validation service in backend/src/services/validation.js (validateReference function per data-model.md)
- [X] T018 Create database service in backend/src/services/database.js (CRUD operations for references)
- [X] T019 [P] Create base Tailwind CSS file in frontend/src/shared/styles/main.css with @tailwind directives
- [X] T020 [P] Create shared layout partial in backend/src/shared/views/layout.ejs (HTML head, HTMX/Alpine.js scripts)
- [X] T021 Create main server entry point in backend/src/server.js (initializes all three contexts on separate ports)
- [X] T022 Create MongoDB index creation script in backend/src/scripts/create-indexes.js (per data-model.md)
- [X] T023 [P] Create Docker Compose file in docker/docker-compose.yml (app + MongoDB services)
- [X] T024 [P] Create development Dockerfile in docker/Dockerfile (multi-stage build pattern)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Data Entry for Scientific References (Priority: P1) 🎯 MVP

**Goal**: Enable researchers to enter hierarchical ethnobotanical data (reference → communities → plants) into the database

**Independent Test**: Access acquisition interface on port 3001, complete nested form with reference metadata, add 2 communities with 3 plants each, submit, verify record in MongoDB with status="pending"

### Implementation for User Story 1

- [X] T025 [P] [US1] Create Express app instance in backend/src/contexts/acquisition/app.js (port 3001 configuration)
- [X] T026 [P] [US1] Create routes file in backend/src/contexts/acquisition/routes.js (GET /, POST /reference/submit, POST /community/add, POST /plant/add/:communityIndex)
- [X] T027 [P] [US1] Create main acquisition form view in backend/src/contexts/acquisition/views/index.ejs (reference metadata fields)
- [X] T028 [P] [US1] Create community form fragment partial in backend/src/contexts/acquisition/views/partials/community-form.ejs (for HTMX rendering)
- [X] T029 [P] [US1] Create plant form fragment partial in backend/src/contexts/acquisition/views/partials/plant-form.ejs (for HTMX rendering)
- [X] T030 [P] [US1] Create success page view in backend/src/contexts/acquisition/views/success.ejs (confirmation message)
- [X] T031 [US1] Implement GET / route handler in routes.js (render empty form)
- [X] T032 [US1] Implement POST /community/add route handler in routes.js (return community form HTML fragment)
- [X] T033 [US1] Implement POST /plant/add/:communityIndex route handler in routes.js (return plant form HTML fragment)
- [X] T034 [US1] Implement POST /reference/submit route handler in routes.js (parse form data, validate, insert to MongoDB with status="pending")
- [X] T035 [US1] Add form data parsing logic to handle nested arrays (comunidades[0][plantas][0][nomeCientifico])
- [X] T036 [US1] Add comma-separated string to array conversion (e.g., "pesca,agricultura" → ["pesca","agricultura"])
- [X] T037 [US1] Add validation error handling and form re-rendering with errors in routes.js
- [X] T038 [P] [US1] Create acquisition-specific styles in frontend/src/acquisition/styles/forms.css (nested form styling)
- [X] T039 [US1] Add Alpine.js client-side interactions in acquisition views (remove community/plant buttons)
- [X] T040 [US1] Integrate database service insertReference function in submit route handler
- [X] T041 [US1] Add logging for acquisition operations (form submissions, validation errors)

**Checkpoint**: At this point, User Story 1 should be fully functional - researchers can enter complete references with nested communities and plants

---

## Phase 4: User Story 2 - Search and Browse Ethnobotanical Data (Priority: P2)

**Goal**: Enable public users to search ethnobotanical records by community, plant, state, municipality with card-based results

**Independent Test**: Access presentation interface on port 3003, enter search filters (e.g., state="São Paulo", planta="erva"), verify matching approved references displayed as cards with correct information

### Implementation for User Story 2

- [X] T042 [P] [US2] Create Express app instance in backend/src/contexts/presentation/app.js (port 3003 configuration)
- [X] T043 [P] [US2] Create routes file in backend/src/contexts/presentation/routes.js (GET / with query parameters)
- [X] T044 [P] [US2] Create search interface view in backend/src/contexts/presentation/views/index.ejs (search filters + results grid)
- [X] T045 [P] [US2] Create result card partial in backend/src/contexts/presentation/views/partials/result-card.ejs (card layout for reference display)
- [X] T046 [P] [US2] Create empty state partial in backend/src/contexts/presentation/views/partials/empty-state.ejs (no results message)
- [X] T047 [P] [US2] Create pagination partial in backend/src/contexts/presentation/views/partials/pagination.ejs (prev/next controls)
- [X] T048 [US2] Implement GET / route handler in routes.js (parse query params, build MongoDB query)
- [X] T049 [US2] Add search query builder function in routes.js (handles comunidade, planta, estado, municipio filters with regex)
- [X] T050 [US2] Add MongoDB query for community name filter (status="approved" AND comunidades.nome matches)
- [X] T051 [US2] Add MongoDB query for plant name filter ($or nomeCientifico/nomeVernacular matches)
- [X] T052 [US2] Add MongoDB query for state filter (exact match on comunidades.estado)
- [X] T053 [US2] Add MongoDB query for municipality filter (exact match on comunidades.municipio)
- [X] T054 [US2] Add combined filter logic (AND across all provided filters)
- [X] T055 [US2] Add pagination logic (skip/limit based on page and limit query params)
- [X] T056 [US2] Add result count calculation for pagination metadata
- [X] T057 [P] [US2] Create presentation-specific styles in frontend/src/presentation/styles/cards.css (card grid, responsive breakpoints)
- [X] T058 [US2] Add search result rendering with card layout in index.ejs
- [X] T059 [US2] Add empty state rendering when no results found
- [X] T060 [US2] Add pagination controls rendering with query string preservation
- [X] T061 [US2] Integrate database service searchReferences function in route handler
- [X] T062 [US2] Add input sanitization for search parameters (prevent NoSQL injection)
- [X] T063 [US2] Add logging for search operations (queries, result counts)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - data can be entered (US1) and searched (US2)

---

## Phase 5: User Story 3 - Curate and Validate Submitted References (Priority: P3)

**Goal**: Enable curators to review, edit, and approve/reject references with status workflow

**Independent Test**: Access curation interface on port 3002, view list of pending references, edit a reference (modify community or plant data), approve it, verify status changes to "approved" and reference becomes visible in presentation interface (port 3003)

### Implementation for User Story 3

- [X] T064 [P] [US3] Create Express app instance in backend/src/contexts/curation/app.js (port 3002 configuration)
- [X] T065 [P] [US3] Create routes file in backend/src/contexts/curation/routes.js (GET /, GET /reference/edit/:id, PUT /reference/update/:id, POST /reference/status/:id, POST /reference/:id/community/add, POST /reference/:id/plant/add/:communityIndex)
- [X] T066 [P] [US3] Create reference list view in backend/src/contexts/curation/views/index.ejs (table with title, authors, year, status, actions)
- [X] T067 [P] [US3] Create reference edit view in backend/src/contexts/curation/views/edit.ejs (pre-populated form with all fields editable)
- [X] T068 [P] [US3] Create status badge partial in backend/src/contexts/curation/views/partials/status-badge.ejs (color-coded status indicators)
- [X] T069 [P] [US3] Create status change section partial in backend/src/contexts/curation/views/partials/status-section.ejs (radio buttons for pending/approved/rejected)
- [X] T070 [US3] Implement GET / route handler in routes.js (list all references with optional status filter)
- [X] T071 [US3] Add status filter logic (query param ?status=pending/approved/rejected/all)
- [X] T072 [US3] Add pagination for reference list (default 50 per page)
- [X] T073 [US3] Add sorting by createdAt descending (most recent first)
- [X] T074 [US3] Implement GET /reference/edit/:id route handler in routes.js (fetch reference by ID, render edit form)
- [X] T075 [US3] Add 404 handling for non-existent reference IDs
- [X] T076 [US3] Implement PUT /reference/update/:id route handler in routes.js (parse form data, validate, update MongoDB document)
- [X] T077 [US3] Add updatedAt timestamp update on content changes
- [X] T078 [US3] Implement POST /reference/status/:id route handler in routes.js (update only status field)
- [X] T079 [US3] Add status value validation (must be pending/approved/rejected)
- [X] T080 [US3] Implement POST /reference/:id/community/add route handler (reuse acquisition community fragment)
- [X] T081 [US3] Implement POST /reference/:id/plant/add/:communityIndex route handler (reuse acquisition plant fragment)
- [X] T082 [P] [US3] Create curation-specific styles in frontend/src/curation/styles/list.css (table styling, status badges)
- [X] T083 [US3] Add success message display on query param ?success=true
- [X] T084 [US3] Add form pre-population logic in edit view (populate from fetched reference data)
- [X] T085 [US3] Integrate database service updateReference function in update route handler
- [X] T086 [US3] Integrate database service updateStatus function in status route handler
- [X] T087 [US3] Add logging for curation operations (edits, status changes)
- [X] T088 [US3] Test integration: approve reference in curation, verify it appears in presentation search

**Checkpoint**: All user stories should now be independently functional - data entry (US1), public search (US2), and curation workflow (US3) all operational

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and production readiness

- [X] T089 [P] Compile Tailwind CSS for production (purge unused styles) in frontend build script
- [X] T090 [P] Add error page template in backend/src/shared/views/error.ejs (500, 404 errors)
- [X] T091 [P] Add global error handling middleware in each context app.js (catch unhandled errors)
- [X] T092 [P] Add request logging middleware in each context app.js (log all HTTP requests)
- [X] T093 [P] Create production Dockerfile in docker/Dockerfile with multi-stage build (builder + production stages)
- [X] T094 [P] Add Docker health check in Dockerfile (curl to each port endpoint)
- [X] T095 [P] Create .dockerignore file (exclude node_modules, tests, docs, .git)
- [X] T096 [P] Add input sanitization utilities in backend/src/shared/utils/sanitize.js (HTML escaping, string length limits)
- [X] T097 [P] Add Portuguese language validation messages in validation.js (all error messages in Portuguese)
- [X] T098 Add MongoDB connection error handling and retry logic in database.js
- [X] T099 Add graceful shutdown handling in server.js (close MongoDB connection on SIGTERM)
- [X] T100 [P] Update README.md with project overview, architecture diagram, and quickstart link
- [X] T101 [P] Add responsive meta tags to layout.ejs (viewport, mobile optimization)
- [ ] T102 [P] Add favicon and app icons in frontend/src/shared/assets/
- [X] T103 [P] Optimize MongoDB queries with projection (limit returned fields) in database service
- [ ] T104 Test Docker build locally (verify image size <500MB per requirement)
- [ ] T105 Test all three contexts accessible on correct ports (3001, 3002, 3003)
- [ ] T106 Validate data entry workflow end-to-end (US1 → US3 → US2 integration)
- [ ] T107 Validate responsive design on mobile (320px), tablet (768px), desktop (1920px)
- [ ] T108 Performance test search with 1000 records (verify <2s response time per requirement)
- [X] T109 [P] Create GitHub Actions workflow in .github/workflows/docker-publish.yml (build and push to ghcr.io/edalcin/)
- [X] T110 [P] Add environment variable documentation in README.md (all required .env variables)

**Checkpoint**: Production-ready application - all user stories functional, Docker container optimized, ready for Unraid deployment

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion (T001-T012) - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion (T013-T024)
  - **User Story 1 (P1)**: Can start after T024 - No dependencies on other stories
  - **User Story 2 (P2)**: Can start after T024 - Independent of US1 (searches approved records)
  - **User Story 3 (P3)**: Can start after T024 - Independent of US1/US2 (curator workflow)
- **Polish (Phase 6)**: Depends on desired user stories being complete (typically all three)

### User Story Dependencies

- **User Story 1 (P1)**: Foundational only - No other story dependencies
- **User Story 2 (P2)**: Foundational only - Independent (but benefits from US1 creating data and US3 approving it for visibility)
- **User Story 3 (P3)**: Foundational only - Independent (but workflows integrate: US1 creates → US3 approves → US2 displays)

**Note**: While stories are technically independent, the full workflow is: US1 (data entry) → US3 (approval) → US2 (public search displays approved data)

### Within Each User Story

**User Story 1**:
- T025-T030: Express app + views (parallel)
- T031-T034: Route handlers (sequential - depend on T025-T030)
- T035-T037: Form processing logic (sequential - depend on T031-T034)
- T038-T039: Styles + client interactions (parallel with route handlers)
- T040-T041: Integration + logging (after all above)

**User Story 2**:
- T042-T047: Express app + views (parallel)
- T048-T056: Search query logic (sequential - depend on T042-T047)
- T057-T060: Styles + rendering (parallel with query logic)
- T061-T063: Integration + security (after all above)

**User Story 3**:
- T064-T069: Express app + views (parallel)
- T070-T081: Route handlers (sequential - depend on T064-T069)
- T082-T084: Styles + UI logic (parallel with route handlers)
- T085-T088: Integration + testing (after all above)

### Parallel Opportunities

- **Setup**: T003-T005, T006-T012 (all parallel within phase)
- **Foundational**: T014-T015, T019-T020, T023-T024 (parallel groups)
- **After Foundational completes**: All three user stories (Phase 3, 4, 5) can start in parallel if team capacity allows
- **User Story 1**: T025-T030, T038-T039
- **User Story 2**: T042-T047, T057-T060
- **User Story 3**: T064-T069, T082
- **Polish**: T089-T097, T100-T103, T109-T110 (most tasks parallel)

---

## Parallel Example: User Story 1

```bash
# After Foundational phase complete, launch these in parallel:

# Express app + views for acquisition context:
Task T025: "Create Express app instance in backend/src/contexts/acquisition/app.js"
Task T026: "Create routes file in backend/src/contexts/acquisition/routes.js"
Task T027: "Create main acquisition form view in backend/src/contexts/acquisition/views/index.ejs"
Task T028: "Create community form fragment in backend/src/contexts/acquisition/views/partials/community-form.ejs"
Task T029: "Create plant form fragment in backend/src/contexts/acquisition/views/partials/plant-form.ejs"
Task T030: "Create success page view in backend/src/contexts/acquisition/views/success.ejs"

# Then concurrently develop route logic and styles:
Task T031-T037: Route handlers (sequential internally)
Task T038-T039: Styles (parallel with route handlers)
```

---

## Parallel Example: Multiple User Stories

```bash
# After Foundational phase complete (T024), if you have 3 developers:

Developer A: Phase 3 (User Story 1) - T025 through T041
Developer B: Phase 4 (User Story 2) - T042 through T063
Developer C: Phase 5 (User Story 3) - T064 through T088

# All three stories complete independently, then integrate for full workflow
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T012)
2. Complete Phase 2: Foundational (T013-T024) - CRITICAL
3. Complete Phase 3: User Story 1 (T025-T041)
4. **STOP and VALIDATE**: Test data entry independently on port 3001
   - Create reference with 2 communities, 3 plants each
   - Verify saves to MongoDB with status="pending"
   - Verify validation works (required fields, error messages in Portuguese)
   - Verify HTMX dynamic forms (add/remove communities and plants)
5. Optional: Add minimal Polish tasks (T089-T095 for Docker)
6. Deploy/demo MVP

### Incremental Delivery

1. **Foundation** (T001-T024): Setup + Foundational → Development environment ready
2. **MVP** (T025-T041): User Story 1 → Data entry functional → First deployable increment
3. **+Search** (T042-T063): Add User Story 2 → Public can search data → Second increment
4. **+Curation** (T064-T088): Add User Story 3 → Complete workflow → Third increment
5. **Production** (T089-T110): Polish → Production-ready → Final release

Each increment is independently testable and deployable.

### Parallel Team Strategy

With 3 developers after Foundational phase:

1. **Foundation Together** (T001-T024): Whole team collaborates on setup and core infrastructure
2. **Once T024 complete, split**:
   - **Developer A**: User Story 1 (T025-T041) - Acquisition context
   - **Developer B**: User Story 2 (T042-T063) - Presentation context
   - **Developer C**: User Story 3 (T064-T088) - Curation context
3. **Regroup**: Integrate and test full workflow (data entry → curation → search)
4. **Polish Together** (T089-T110): Whole team on production readiness

---

## Task Count Summary

- **Phase 1 (Setup)**: 12 tasks (T001-T012)
- **Phase 2 (Foundational)**: 12 tasks (T013-T024)
- **Phase 3 (User Story 1)**: 17 tasks (T025-T041)
- **Phase 4 (User Story 2)**: 22 tasks (T042-T063)
- **Phase 5 (User Story 3)**: 25 tasks (T064-T088)
- **Phase 6 (Polish)**: 22 tasks (T089-T110)

**Total**: 110 tasks

**Parallel Tasks**: 35 tasks marked [P] can run in parallel with others
**Story-specific**: 64 tasks labeled with [US1], [US2], or [US3]

---

## Independent Test Criteria

### User Story 1 (P1) - Data Entry
**Test**: Access http://localhost:3001, fill reference form (título, autores, ano), add 2 communities (each with nome, município, estado), add 3 plants per community (nomeCientifico, nomeVernacular, tipoUso), submit, verify MongoDB contains document with status="pending"

**Success**: Reference saved with correct nested structure, all arrays properly formatted, timestamps added

### User Story 2 (P2) - Search
**Test**: Access http://localhost:3003, enter filters (comunidade="Ponta do Almada", estado="São Paulo"), verify only approved references matching criteria displayed as cards with reference title, authors, year, community names, and plant lists

**Success**: Search results accurate, pagination works, cards display correctly on mobile/tablet/desktop

### User Story 3 (P3) - Curation
**Test**: Access http://localhost:3002, view reference list with status badges, click "Editar" on pending reference, modify community name, add new plant, save, change status to "approved", verify changes saved and reference now appears in presentation search (port 3003)

**Success**: Edits saved correctly, status change persisted, approved reference visible in public search

---

## MVP Scope Recommendation

**Minimum Viable Product**: Phase 1 + Phase 2 + Phase 3 (User Story 1 only)

**Rationale**:
- User Story 1 (data entry) is foundational - without it, no data exists
- 41 tasks total (T001-T041)
- Delivers core value: researchers can enter ethnobotanical data
- Independently testable and deployable
- Provides immediate value even without search or curation

**Post-MVP Increments**:
1. Add User Story 2 (search): Public discovery of data
2. Add User Story 3 (curation): Quality control workflow
3. Add Polish: Production optimization

---

## Notes

- [P] tasks = different files, no dependencies on each other
- [US1]/[US2]/[US3] labels map task to specific user story for traceability
- Each user story should be independently completable and testable per spec.md requirements
- Commit after each task or logical group for incremental progress
- Stop at any checkpoint to validate story independently before proceeding
- MongoDB connection required for all contexts - ensure database accessible per .env configuration
- Three contexts run on separate ports (3001, 3002, 3003) - all must be accessible for full workflow
- HTMX and Alpine.js loaded via CDN (no build step) - simplifies frontend development
- Tailwind CSS requires build step (PostCSS) - npm run build compiles CSS
- Portuguese language used throughout interface per requirements
