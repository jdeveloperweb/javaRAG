package com.jdeveloperweb.javarag.controller;

import com.jdeveloperweb.javarag.repository.AuditLogRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/observability")
@RequiredArgsConstructor
public class ObservabilityController {

    private final AuditLogRepository auditLogRepository;

    @GetMapping("/stats")
    public ObservabilityStats getStats() {
        return ObservabilityStats.builder()
                .totalTokens(auditLogRepository.getTotalTokens())
                .totalCost(auditLogRepository.getTotalCost())
                .avgResponseTime(auditLogRepository.getAvgResponseTime())
                .totalRequests(auditLogRepository.count())
                .build();
    }

    @Data
    @Builder
    public static class ObservabilityStats {
        private Long totalTokens;
        private Double totalCost;
        private Double avgResponseTime;
        private long totalRequests;
    }
}
