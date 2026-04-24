package com.jdeveloperweb.javarag.api;

import com.jdeveloperweb.javarag.model.RagasEvaluation;
import com.jdeveloperweb.javarag.model.RagasTestCase;
import com.jdeveloperweb.javarag.repository.RagasEvaluationRepository;
import com.jdeveloperweb.javarag.repository.RagasTestCaseRepository;
import com.jdeveloperweb.javarag.service.RagasEvaluationService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/ragas")
@RequiredArgsConstructor
public class RagasController {

    private final RagasTestCaseRepository testCaseRepository;
    private final RagasEvaluationRepository evaluationRepository;
    private final RagasEvaluationService evaluationService;

    // --- Test Cases ---

    @GetMapping("/test-cases")
    public List<RagasTestCase> getTestCases(@RequestParam(defaultValue = "default") String tenantId) {
        return testCaseRepository.findByTenantId(tenantId);
    }

    @PostMapping("/test-cases")
    public RagasTestCase createTestCase(@RequestBody RagasTestCase testCase) {
        return testCaseRepository.save(testCase);
    }

    @PutMapping("/test-cases/{id}")
    public RagasTestCase updateTestCase(@PathVariable Long id, @RequestBody RagasTestCase testCase) {
        testCase.setId(id);
        return testCaseRepository.save(testCase);
    }

    @DeleteMapping("/test-cases/{id}")
    public void deleteTestCase(@PathVariable Long id) {
        testCaseRepository.deleteById(id);
    }

    // --- Evaluations ---

    @PostMapping("/evaluate/{testCaseId}")
    public RagasEvaluation evaluate(@PathVariable Long testCaseId, @RequestBody EvaluationRequest request) {
        return evaluationService.evaluateTestCase(testCaseId, request.getProvider(), request.getTenantId());
    }

    @PostMapping("/evaluate/batch")
    public ResponseEntity<String> batchEvaluate(@RequestBody EvaluationRequest request) {
        evaluationService.runBatchEvaluation(request.getTenantId(), request.getProvider());
        return ResponseEntity.ok("Batch evaluation started asynchronously.");
    }

    @GetMapping("/results")
    public List<RagasEvaluation> getResults(@RequestParam(defaultValue = "default") String tenantId) {
        return evaluationRepository.findByTestCaseTenantId(tenantId);
    }

    @Data
    public static class EvaluationRequest {
        private String provider;
        private String tenantId;
    }
}
