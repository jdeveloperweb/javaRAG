package com.jdeveloperweb.javarag.repository;

import com.jdeveloperweb.javarag.model.RagasEvaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RagasEvaluationRepository extends JpaRepository<RagasEvaluation, Long> {
    List<RagasEvaluation> findByTestCaseId(Long testCaseId);
    List<RagasEvaluation> findByTestCaseTenantId(String tenantId);
}
