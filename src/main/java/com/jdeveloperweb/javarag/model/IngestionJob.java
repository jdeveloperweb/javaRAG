package com.jdeveloperweb.javarag.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "ingestion_jobs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IngestionJob {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String tenantId;

    @Enumerated(EnumType.STRING)
    private JobStatus status;

    private String errorMessage;

    private LocalDateTime submittedAt;
    
    private LocalDateTime finishedAt;

    @PrePersist
    public void onCreate() {
        this.submittedAt = LocalDateTime.now();
    }

    public enum JobStatus {
        PENDING, RUNNING, COMPLETED, FAILED
    }
}
