package com.jdeveloperweb.javarag.repository;

import com.jdeveloperweb.javarag.model.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.jpa.repository.Query;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    
    @Query("SELECT COALESCE(SUM(a.totalTokens), 0) FROM AuditLog a")
    Long getTotalTokens();

    @Query("SELECT COALESCE(SUM(a.estimatedCost), 0.0) FROM AuditLog a")
    Double getTotalCost();

    @Query("SELECT COALESCE(AVG(a.responseTimeMillis), 0.0) FROM AuditLog a")
    Double getAvgResponseTime();
}
