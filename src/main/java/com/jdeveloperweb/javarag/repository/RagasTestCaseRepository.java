package com.jdeveloperweb.javarag.repository;

import com.jdeveloperweb.javarag.model.RagasTestCase;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RagasTestCaseRepository extends JpaRepository<RagasTestCase, Long> {
    List<RagasTestCase> findByTenantId(String tenantId);
}
