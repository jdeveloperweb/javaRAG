package com.jdeveloperweb.javarag.repository;

import com.jdeveloperweb.javarag.model.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
}
