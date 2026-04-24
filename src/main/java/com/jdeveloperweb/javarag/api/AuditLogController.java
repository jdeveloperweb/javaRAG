package com.jdeveloperweb.javarag.api;

import com.jdeveloperweb.javarag.model.AuditLog;
import com.jdeveloperweb.javarag.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/audit")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditLogRepository auditLogRepository;

    @GetMapping
    public ResponseEntity<List<AuditLog>> getAuditLogs() {
        return ResponseEntity.ok(auditLogRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt")));
    }
}
