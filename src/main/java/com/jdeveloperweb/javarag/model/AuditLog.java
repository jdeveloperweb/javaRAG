package com.jdeveloperweb.javarag.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String tenantId;
    
    private String userId;

    @Column(columnDefinition = "TEXT")
    private String userQuery;

    @Column(columnDefinition = "TEXT")
    private String aiResponse;

    private String modelUsed;

    private Long responseTimeMillis;
    
    private Integer promptTokens;
    private Integer completionTokens;
    private Integer totalTokens;
    private Double estimatedCost;

    private LocalDateTime createdAt;

    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
