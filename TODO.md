# MTG Collection Value Tracker - Reconciler Service Test & Fix Plan

## Problem Statement

The ReconcilerService has critical bugs that cause DataError and NotFoundError when processing large datasets from Cardmarket and ManaBox imports. These errors prevent proper scan-to-lot and sell-to-lot matching, affecting the accuracy of cost allocation and P&L calculations.

The service works with small test datasets but fails with larger real-world imports, suggesting issues with performance, memory management, or algorithmic complexity that manifest under scale.

## Current State

- The reconciler logic was moved from web worker to main thread (Oct 4, 2025) to address dependency and execution issues
- It currently processes scan-to-lot and sell-to-lot matching using identity buckets
- Has issues with:
  - Scalability with large datasets
  - DataError and NotFoundError exceptions
  - Identity generation for matching transactions

## Testing & Fixing Plan

### Phase 1: Analysis and Test Environment Setup (Week 1)

#### 1.1 Identify Current Issues (Day 1)
- [ ] Create comprehensive logging in the current ReconcilerService to identify exact failure points
- [ ] Add timing measurements to identify bottlenecks
- [ ] Run with a small dataset (working case) to establish baseline behavior
- [ ] Run with a medium dataset to identify when issues start occurring
- [ ] Document specific error messages and stack traces

#### 1.2 Create Test Data (Day 1-2)
- [ ] Generate synthetic test datasets of different sizes:
  - Small (10-50 cards) - known working
  - Medium (100-500 cards) - potential issues
  - Large (1000+ cards) - known failing
  - XL (5000+ cards) - stress test
- [ ] Include realistic data patterns:
  - Multiple lots of same card with different properties (finish, language)
  - Mixed scan and transaction data
  - Different acquisition groups
  - Complex sell scenarios (partial sales across multiple lots)

#### 1.3 Establish Testing Framework (Day 2)
- [ ] Create unit tests for individual ReconcilerService functions
- [ ] Set up integration tests for the full reconciliation workflow
- [ ] Create performance benchmarks for different dataset sizes
- [ ] Implement test harness to measure execution time and memory usage

### Phase 2: Root Cause Analysis (Week 1-2)

#### 2.1 Performance Analysis (Day 3-4)
- [ ] Profile memory usage during reconciliation
- [ ] Identify functions with O(n²) or worse complexity
- [ ] Check for unnecessary database queries in loops
- [ ] Analyze the findLotsByIdentity function for performance issues
- [ ] Check for efficient indexing on database queries

#### 2.2 Data Integrity Analysis (Day 4-5)
- [ ] Verify all referenced IDs exist in the database during reconciliation
- [ ] Check for race conditions or transaction conflicts
- [ ] Validate that all entities have required fields before processing
- [ ] Ensure proper error handling for missing or invalid data

#### 2.3 Algorithm Analysis (Day 5-7)
- [ ] Review the identity matching algorithm for edge cases
- [ ] Check the FIFO allocation logic for sell transactions
- [ ] Validate the time-window matching logic
- [ ] Examine the provisional lot creation and consolidation logic
- [ ] Verify the mergeLots function handles all scenarios

### Phase 3: Implementation of Fixes (Week 2-3)

#### 3.1 Performance Optimizations (Day 8-10)
- [ ] Implement database query optimizations with proper indexes
- [ ] Add caching for frequently accessed data
- [ ] Optimize the findLotsByIdentity and related functions
- [ ] Implement batch processing for database operations
- [ ] Add pagination for large query results

#### 3.2 Robust Error Handling (Day 10-12)
- [ ] Add comprehensive validation before processing each identity bucket
- [ ] Implement graceful degradation for problematic data
- [ ] Add detailed error logging and reporting
- [ ] Create recovery mechanisms for partial failures
- [ ] Implement rollbacks for failed reconciliation operations

#### 3.3 Scalability Improvements (Day 12-14)
- [ ] Implement chunked processing for large datasets
- [ ] Add progress reporting for long-running reconciliations
- [ ] Optimize the algorithm to reduce complexity
- [ ] Implement streaming approach for large data sets
- [ ] Add configurable batch sizes for different operations

### Phase 4: Validation and Testing (Week 3-4)

#### 4.1 Unit Testing (Day 15-16)
- [ ] Create comprehensive unit tests for all ReconcilerService functions
- [ ] Test edge cases and error conditions
- [ ] Verify fix for identified performance bottlenecks
- [ ] Ensure all identity matching scenarios work correctly

#### 4.2 Integration Testing (Day 17-18)
- [ ] Test reconciliation with different import scenarios
- [ ] Validate financial calculations (cost basis, P&L) after reconciliation
- [ ] Verify that manual link updates work correctly
- [ ] Check that the audit trail via scan_sale_links is maintained

#### 4.3 Performance Testing (Day 19-21)
- [ ] Run performance tests with all dataset sizes
- [ ] Compare execution time and memory usage before/after fixes
- [ ] Test under real-world import conditions
- [ ] Verify that reconciliation completes within acceptable time limits
- [ ] Test concurrent reconciliation scenarios

### Phase 5: Quality Assurance and Deployment (Week 4)

#### 5.1 User Acceptance Testing (Day 22-23)
- [ ] Test reconciliation with actual user datasets (anonymized)
- [ ] Validate that previous manual links and corrections are preserved
- [ ] Verify that the UI reflects reconciliation results correctly
- [ ] Test error recovery and retry mechanisms

#### 5.2 Documentation and Handoff (Day 24-25)
- [ ] Document the fixes and improvements for future maintenance
- [ ] Update any relevant architecture documentation
- [ ] Create runbook for troubleshooting reconciliation issues
- [ ] Prepare migration steps if needed for existing deployments

## Success Criteria

### Technical Requirements
- [ ] Reconciliation completes successfully for datasets of 5000+ cards
- [ ] No DataError or NotFoundError exceptions during processing
- [ ] Execution time scales linearly (O(n)) with dataset size
- [ ] Memory usage remains within acceptable limits (under 512MB for large datasets)
- [ ] All financial calculations remain accurate after reconciliation

### Functional Requirements
- [ ] Accurate scan-to-lot matching preserving physical inventory tracking
- [ ] Correct sell-to-lot allocation using FIFO method
- [ ] Proper handling of partial quantity sales across multiple lots
- [ ] Maintained audit trail through scan_sale_links
- [ ] Preservation of manual corrections and locked mappings

## Risk Mitigation

### Performance Risks
- Implement fallback to smaller batch sizes if performance issues persist
- Add circuit breakers to prevent system resource exhaustion

### Data Integrity Risks
- Implement comprehensive backup/restore before running reconciliation
- Add validation checks before and after reconciliation runs
- Maintain audit logs for all reconciliation operations

### Rollback Plan
- Maintain versioned copies of the reconciler service
- Implement feature flags to enable/disable the new reconciler
- Create data recovery procedures in case of issues

## Timeline
- Total duration: 4 weeks (25 business days)
- Week 1: Analysis and test environment setup
- Week 2: Root cause analysis and planning
- Week 3: Implementation of fixes
- Week 4: Validation and deployment preparation

## Dependencies
- Complete understanding of existing data model and relationships
- Access to realistic test datasets of various sizes
- Performance monitoring and profiling tools
- Stable development environment for running comprehensive tests